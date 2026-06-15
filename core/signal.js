/*
 * مراقبة إشارة المكسر (إشارة كهربائية: نشط/متوقف) — لتحديد نهاية الصلاة والعودة التلقائية.
 * ليست صوتاً يُحلَّل، بل حالة كهربائية تصل بإحدى طريقتين:
 *
 *   1) عبر الشبكة (http): جهاز صغير (Arduino/ESP) موصول بأوبتوكبلر على إشارة المكسر
 *      يرسل الحالة إلى:  POST /api/signal {active:true|false}   أو نبضة  POST /api/signal/ping
 *
 *   2) عبر منفذ تسلسلي (serial): لوحة USB لدخل رقمي تظهر كمنفذ COM؛ يُقرأ بايت الحالة
 *      ويُستخرج منه بِت الطرف حسب الإعداد (activeByteIndex/activeMask/activeHigh).
 *
 * كلاهما يحدّث حالة واحدة ويبثّها للشاشة فوراً عبر WebSocket. منطق القرار معزول
 * في report/ping/_ingestSerial — قابل للاختبار بلا عتاد.
 */

// serialport اختيارية (نفس مكتبة GPS)
let SerialPort = null;
try { ({ SerialPort } = require('serialport')); } catch (e) { /* تُعطَّل بهدوء */ }

function createSignal(ctx) {
  const db = ctx.db, broadcast = ctx.broadcast;
  let port = null, watchdog = null, pollTimer = null, reconnectTimer = null;

  const state = {
    available: !!SerialPort, // لقراءة المنفذ التسلسلي (طريق http لا يحتاجها)
    active: false,           // هل الإشارة نشطة الآن؟
    lastActiveAt: 0,         // آخر لحظة كانت نشطة
    source: null,            // http | serial
    connected: false,        // للمنفذ التسلسلي
    error: null,
  };
  function getState() { return Object.assign({}, state); }

  function emit() {
    if (broadcast) broadcast({ type: 'signal', active: state.active, ts: Date.now() });
  }

  function setActive(active, source) {
    const was = state.active;
    state.active = !!active;
    if (source) state.source = source;
    if (state.active) state.lastActiveAt = Date.now();
    if (was !== state.active) emit();
  }

  // ---- طريق الشبكة (http) ----
  // تقرير صريح بالحالة (نشط/متوقف)
  function report(active, source) {
    clearTimeout(watchdog);
    setActive(active, source || 'http');
  }
  // نبضة = نشط الآن؛ يُعتبر متوقفاً تلقائياً إن انقطعت النبضات (graceSec)
  function ping(source) {
    setActive(true, source || 'http');
    clearTimeout(watchdog);
    const g = (db.getConfig().signal || {}).graceSec || 3;
    watchdog = setTimeout(function () { setActive(false, state.source); }, g * 1000);
  }

  // ---- طريق المنفذ التسلسلي (serial) ----
  // استخراج حالة الطرف من بايت الاستجابة (نقطة قابلة للاختبار)
  function _ingestSerial(buf) {
    const s = (db.getConfig().signal || {}).serial || {};
    const idx = s.activeByteIndex || 0;
    const mask = s.activeMask != null ? s.activeMask : 1;
    const activeHigh = s.activeHigh !== false;
    if (!buf || buf.length <= idx) return;
    const bitSet = (buf[idx] & mask) !== 0;
    setActive(activeHigh ? bitSet : !bitSet, 'serial');
  }

  function connectSerial() {
    closePort();
    if (!SerialPort) { state.error = 'مكتبة serialport غير مثبّتة'; return; }
    const s = (db.getConfig().signal || {}).serial || {};
    const path = s.port && s.port !== 'auto' ? s.port : null;
    if (!path) { state.error = 'حدّد منفذ لوحة الدخل'; return; }
    try {
      port = new SerialPort({ path: path, baudRate: s.baud || 9600, autoOpen: true });
      port.on('open', function () {
        state.connected = true; state.error = null;
        // إرسال استعلام دوري إن لزم (لوحات تتطلب طلباً لإرجاع الحالة)
        if (s.queryHex) {
          const q = Buffer.from(s.queryHex.replace(/\s+/g, ''), 'hex');
          clearInterval(pollTimer);
          pollTimer = setInterval(function () { try { port.write(q); } catch (e) {} }, s.pollMs || 500);
        }
      });
      port.on('data', function (buf) { try { _ingestSerial(buf); } catch (e) {} });
      port.on('error', function (e) { state.error = String(e && e.message || e); });
      port.on('close', function () {
        state.connected = false; clearInterval(pollTimer);
        scheduleReconnect();
      });
    } catch (e) { state.error = String(e && e.message || e); }
  }

  function closePort() {
    clearInterval(pollTimer);
    try { port && port.close(function () {}); } catch (e) {}
    port = null;
  }
  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    const sig = db.getConfig().signal || {};
    if (sig.enabled && sig.source === 'serial') reconnectTimer = setTimeout(start, 8000);
  }

  function start() {
    const sig = db.getConfig().signal || {};
    closePort(); clearTimeout(watchdog);
    if (!sig.enabled) { setActive(false, state.source); return; }
    if (sig.source === 'serial') connectSerial();
    // طريق http لا يحتاج بدءاً: ينتظر طلبات الجهاز الخارجي
  }
  function stop() {
    clearTimeout(watchdog); clearTimeout(reconnectTimer); closePort();
  }

  return { start, stop, report, ping, getState, _ingestSerial };
}

module.exports = { createSignal };
