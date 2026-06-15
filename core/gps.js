/*
 * مدير جهاز GPS — اختياري بالكامل.
 * أغلب أجهزة GPS عبر USB تظهر كمنفذ تسلسلي وتبثّ جُمل NMEA.
 * هذه الوحدة:
 *   - تكتشف المنفذ تلقائياً (تفحص المنافذ وتختار ما يبثّ جُمل GPS صحيحة).
 *   - عند وصول إشارة (fix) تضبط الموقع تلقائياً، ووقت النظام عبر مزامنة الوقت — دون إنترنت.
 *   - تعمل بأمان حتى لو لم تكن مكتبة serialport مثبّتة (الميزة تُعطَّل بهدوء).
 *
 * منطق التحليل والقرار (المهم) معزول في nmea.js و _ingestLine — قابل للاختبار بلا عتاد.
 */
const nmea = require('./nmea');

// مكتبة serialport اختيارية: لا توقف النظام لو غير موجودة
let SerialPort = null, ReadlineParser = null;
try {
  ({ SerialPort } = require('serialport'));
  ({ ReadlineParser } = require('@serialport/parser-readline'));
} catch (e) { /* الميزة تُعطَّل بهدوء */ }

// معرّفات شرائح GPS شائعة (للأولوية أثناء الفحص)
const KNOWN_VENDORS = ['1546', '067b', '10c4', '0403', '1a86']; // u-blox, Prolific, SiLabs, FTDI, CH340

function toRad(d) { return d * Math.PI / 180; }
function meters(a, b, c, d) {
  if (a == null || c == null) return Infinity;
  const R = 6371000, dLat = toRad(c - a), dLng = toRad(d - b);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
function round6(n) { return Math.round(n * 1e6) / 1e6; }

function createGps(ctx) {
  const db = ctx.db, broadcast = ctx.broadcast, timeSync = ctx.timeSync;
  let port = null, lastTimeSet = 0, lastLoc = null;

  const status = {
    available: !!SerialPort,   // هل مكتبة serialport متوفرة؟
    connected: false,          // هل المنفذ مفتوح؟
    fix: false,                // هل توجد إشارة؟
    sats: 0,                   // عدد الأقمار
    lat: null, lng: null,
    lastFix: null,             // وقت آخر إشارة (ISO)
    port: null,                // المنفذ المستخدم
    error: null,
  };
  function setStatus(p) { Object.assign(status, p); }
  function getStatus() { return Object.assign({}, status); }

  // ---- استيعاب سطر NMEA واحد (نقطة الدخول القابلة للاختبار) ----
  function _ingestLine(line) {
    const m = nmea.parse(line);
    if (!m) return;
    if (m.type === 'GGA') {
      setStatus({ fix: m.fix, sats: m.sats });
    } else if (m.type === 'RMC' && m.valid) {
      if (m.lat != null && m.lng != null) {
        setStatus({ connected: true, fix: true, lat: m.lat, lng: m.lng, lastFix: new Date().toISOString() });
        _maybeUpdateLocation(m.lat, m.lng);
      }
      if (m.timeMs) _maybeUpdateTime(m.timeMs);
    }
  }

  function _maybeUpdateLocation(lat, lng) {
    const cfg = db.getConfig(), g = cfg.gps || {};
    if (!g.enabled || !g.autoLocation) return;
    const cur = cfg.location || {};
    // حدّث فقط عند أول إشارة أو تحرّك ملموس (>30م) لتفادي الكتابة المتكررة
    const moved = lastLoc == null ? meters(cur.lat, cur.lng, lat, lng) > 30 : meters(lastLoc.lat, lastLoc.lng, lat, lng) > 30;
    if (!moved) return;
    db.patchConfig({ location: { lat: round6(lat), lng: round6(lng) } }, 'GPS');
    db.addLog('GPS', 'تحديث الموقع تلقائياً', lat.toFixed(5) + ', ' + lng.toFixed(5));
    lastLoc = { lat, lng };
    if (broadcast) broadcast({ type: 'config', config: db.getConfig() });
  }

  function _maybeUpdateTime(trueMs) {
    const cfg = db.getConfig(), g = cfg.gps || {};
    if (!g.enabled || !g.autoTime) return;
    if ((cfg.timeSync || {}).mode === 'off') return;
    if (Date.now() - lastTimeSet < 60000) return;   // مرة كل دقيقة تكفي
    lastTimeSet = Date.now();
    if (timeSync && timeSync.setExternal) timeSync.setExternal(trueMs, 'GPS');
  }

  // ---- سرد المنافذ المتاحة ----
  async function listPorts() {
    if (!SerialPort) return [];
    try {
      const ports = await SerialPort.list();
      return ports.map((p) => ({ path: p.path, vendorId: p.vendorId, manufacturer: p.manufacturer || '' }));
    } catch (e) { return []; }
  }

  // ترتيب المنافذ المرشّحة: شرائح GPS المعروفة أولاً
  function rank(ports) {
    return ports.slice().sort((a, b) => {
      const av = KNOWN_VENDORS.includes((a.vendorId || '').toLowerCase()) ? 0 : 1;
      const bv = KNOWN_VENDORS.includes((b.vendorId || '').toLowerCase()) ? 0 : 1;
      return av - bv;
    });
  }

  // جرّب منفذاً: افتحه وانتظر سطر GPS صالحاً خلال مهلة
  function testPort(path, baud) {
    return new Promise((resolve) => {
      let p, done = false;
      const finish = (ok) => { if (done) return; done = true; try { p && p.close(() => {}); } catch (e) {} resolve(ok); };
      try {
        p = new SerialPort({ path, baudRate: baud, autoOpen: true });
        const parser = p.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        parser.on('data', (line) => { if (nmea.looksLikeGps(line)) finish(true); });
        p.on('error', () => finish(false));
        setTimeout(() => finish(false), 4000);
      } catch (e) { finish(false); }
    });
  }

  // الاتصال الفعلي بالمنفذ والاستماع المستمر
  function connect(path, baud) {
    closePort();
    try {
      port = new SerialPort({ path, baudRate: baud, autoOpen: true });
      const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
      parser.on('data', (line) => { try { _ingestLine(line); } catch (e) {} });
      port.on('open', () => setStatus({ connected: true, port: path, error: null }));
      port.on('error', (e) => setStatus({ error: String(e && e.message || e) }));
      port.on('close', () => { setStatus({ connected: false, fix: false }); scheduleReconnect(); });
    } catch (e) {
      setStatus({ error: String(e && e.message || e) });
    }
  }

  function closePort() { try { port && port.close(() => {}); } catch (e) {} port = null; }

  let reconnectTimer = null;
  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    const g = db.getConfig().gps || {};
    if (!g.enabled) return;
    reconnectTimer = setTimeout(() => start(), 8000);
  }

  // الفحص التلقائي عن جهاز GPS
  async function scan() {
    if (!SerialPort) { setStatus({ available: false, error: 'مكتبة serialport غير مثبّتة' }); return { ok: false, error: 'no_serialport' }; }
    const g = db.getConfig().gps || {};
    const baud = g.baud || 9600;
    const ports = rank(await listPorts());
    if (g.port && g.port !== 'auto') {
      // منفذ محدّد من المستخدم
      if (await testPort(g.port, baud)) { connect(g.port, baud); return { ok: true, port: g.port }; }
      setStatus({ error: 'لم يستجب المنفذ المحدّد' });
      return { ok: false };
    }
    for (const p of ports) {
      if (await testPort(p.path, baud)) { connect(p.path, baud); return { ok: true, port: p.path }; }
    }
    setStatus({ error: 'لم يُعثر على جهاز GPS' });
    return { ok: false };
  }

  // بدء/إيقاف حسب الإعداد
  function start() {
    const g = db.getConfig().gps || {};
    if (!SerialPort) { setStatus({ available: false }); return; }
    if (!g.enabled) { closePort(); setStatus({ connected: false, fix: false }); return; }
    scan().catch(() => {});
  }
  function stop() { clearTimeout(reconnectTimer); closePort(); }

  return { start, stop, scan, listPorts, getStatus, _ingestLine };
}

module.exports = { createGps };
