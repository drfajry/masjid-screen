/* لوحة مزامنة الوقت: عرض الحالة، حفظ الإعدادات، مزامنة فورية، وضبط يدوي. */
(function () {
  'use strict';
  const el = App.el;
  let nowTimer = null;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // الوقت المصحَّح = ساعة المتصفح + إزاحة المزامنة
  function correctedNow() {
    const off = (App.cfg && App.cfg.timeSync && App.cfg.timeSync.offsetMs) || 0;
    return new Date(Date.now() + off);
  }

  function fmtDateTime(d) {
    return d.toLocaleString('ar-SA', { hour12: true });
  }

  App.renderTimeSync = function () {
    const ts = App.cfg.timeSync || {};
    el('tsMode').value = ts.mode || 'auto';
    el('tsInterval').value = ts.intervalMin != null ? ts.intervalMin : 360;
    el('tsHost').value = ts.host || '';
    el('tsLast').textContent = ts.lastSync
      ? fmtDateTime(new Date(ts.lastSync)) + (ts.lastResult === 'failed' ? ' (فشل)' : '')
      : 'لم تتم بعد';
    const off = ts.offsetMs || 0;
    const sec = Math.round(off / 1000);
    el('tsOffset').textContent = sec === 0 ? 'بدون فرق' : (sec > 0 ? '+' : '') + sec + ' ثانية';

    // ساعة حيّة تعرض الوقت المصحَّح
    clearInterval(nowTimer);
    const paint = () => { el('tsNow').textContent = fmtDateTime(correctedNow()); };
    paint();
    nowTimer = setInterval(paint, 1000);
  };

  App.saveTimeSync = async function () {
    await App.api('POST', '/api/config', {
      patch: { timeSync: {
        mode: el('tsMode').value,
        intervalMin: +el('tsInterval').value || 360,
        host: el('tsHost').value.trim()
      } },
      __user: App.user
    }).then(c => { App.cfg = c; });
    App.toast('تم حفظ إعدادات المزامنة');
    App.renderTimeSync();
  };

  App.timeSyncNow = async function () {
    App.toast('جارٍ المزامنة…');
    const r = await App.api('POST', '/api/time/sync', { user: App.user });
    App.cfg = await App.api('GET', '/api/config');
    App.renderTimeSync();
    App.toast(r && r.ok ? 'تمت المزامنة' : 'تعذّرت المزامنة (تحقق من الإنترنت)', !(r && r.ok));
  };

  // تعبئة حقل الوقت اليدوي من ساعة هذا الجهاز (الجوال)
  App.timeManualFill = function () {
    const d = new Date();
    el('tsManual').value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  };

  App.timeManualSet = async function () {
    const v = el('tsManual').value;
    if (!v) return App.toast('أدخل الوقت أولاً', true);
    const iso = new Date(v).toISOString();
    const r = await App.api('POST', '/api/time/manual', { iso, user: App.user });
    App.cfg = await App.api('GET', '/api/config');
    App.renderTimeSync();
    App.toast(r && r.ok ? 'تم ضبط الوقت' : 'قيمة غير صالحة', !(r && r.ok));
  };
})();
