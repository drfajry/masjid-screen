/*
 * مزامنة الوقت — تحسب فرق (إزاحة) بين ساعة الجهاز والوقت الصحيح،
 * دون تغيير ساعة النظام (لا تحتاج صلاحيات). الشاشة تطبّق الإزاحة عند العرض.
 *
 * مصدر الوقت الصحيح: ترويسة Date في رد HTTP من مضيف موثوق (دقة ~ثانية،
 * أكثر من كافية لأوقات الصلاة). تُصحَّح بنصف زمن الذهاب والإياب.
 * عند انقطاع الإنترنت تبقى آخر إزاحة محفوظة (لا تُفقد).
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

// يجلب الوقت الصحيح من ترويسة Date. يعيد { trueMs } أو null عند الفشل.
function fetchTrueTime(host, timeoutMs) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(host); } catch (e) { return resolve(null); }
    const lib = u.protocol === 'http:' ? http : https;
    const t0 = Date.now();
    const req = lib.request(
      { method: 'GET', hostname: u.hostname, path: u.pathname || '/', port: u.port || undefined, timeout: timeoutMs || 5000 },
      (res) => {
        const dateHeader = res.headers['date'];
        const t1 = Date.now();
        res.destroy(); // نحتاج الترويسات فقط، لا حاجة لتنزيل الجسم
        if (!dateHeader) return resolve(null);
        const serverMs = new Date(dateHeader).getTime();
        if (isNaN(serverMs)) return resolve(null);
        resolve({ trueMs: serverMs + (t1 - t0) / 2, at: t1 });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function createTimeSync(ctx) {
  const db = ctx.db, broadcast = ctx.broadcast;
  let timer = null;

  function persist(patch) {
    db.patchConfig({ timeSync: patch }, 'مزامنة الوقت');
    if (broadcast) broadcast({ type: 'config', config: db.getConfig() });
  }

  // مزامنة فورية من المصدر الموثوق
  async function syncNow() {
    const ts = db.getConfig().timeSync || {};
    const host = ts.host || 'https://www.google.com';
    const r = await fetchTrueTime(host);
    if (!r) {
      persist({ lastResult: 'failed' });
      return { ok: false };
    }
    const offsetMs = Math.round(r.trueMs - Date.now());
    persist({ offsetMs, lastSync: new Date().toISOString(), lastResult: 'ok', source: host });
    return { ok: true, offsetMs };
  }

  // ضبط الإزاحة من مصدر وقت خارجي موثوق (مثل GPS) دون تغيير الوضع
  function setExternal(trueMs, source) {
    const ms = typeof trueMs === 'number' ? trueMs : new Date(trueMs).getTime();
    if (isNaN(ms)) return { ok: false };
    const offsetMs = Math.round(ms - Date.now());
    persist({ offsetMs, lastSync: new Date().toISOString(), lastResult: 'ok', source: source || 'خارجي' });
    return { ok: true, offsetMs };
  }

  // ضبط يدوي: يحوّل الوقت الصحيح المُدخل إلى إزاحة
  function setManual(trueValue) {
    const trueMs = typeof trueValue === 'number' ? trueValue : new Date(trueValue).getTime();
    if (isNaN(trueMs)) return { ok: false, error: 'وقت غير صالح' };
    const offsetMs = Math.round(trueMs - Date.now());
    persist({ mode: 'manual', offsetMs, lastSync: new Date().toISOString(), lastResult: 'ok', source: 'يدوي' });
    return { ok: true, offsetMs };
  }

  // تعطيل المزامنة وتصفير الإزاحة
  function disable() {
    persist({ mode: 'off', offsetMs: 0, source: null });
  }

  // إعادة جدولة المزامنة التلقائية حسب الإعداد الحالي
  function schedule() {
    clearInterval(timer);
    const ts = db.getConfig().timeSync || {};
    if (ts.mode !== 'auto') return;
    const min = Math.max(5, ts.intervalMin || 360);
    timer = setInterval(function () { syncNow().catch(function () {}); }, min * 60 * 1000);
    setTimeout(function () { syncNow().catch(function () {}); }, 3000); // مزامنة أولى بعد الإقلاع
  }

  function stop() { clearInterval(timer); }

  return { syncNow, setManual, setExternal, disable, schedule, stop };
}

module.exports = { createTimeSync, fetchTrueTime };
