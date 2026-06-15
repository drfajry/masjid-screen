/* حفظ الإعدادات، رفع الشعار، أوامر الشاشة، وإعادة التشغيل. */
(function () {
  'use strict';
  const el = App.el;

  async function patch(p) {
    App.cfg = await App.api('POST', '/api/config', { patch: p, __user: App.user });
    App.toast('تم الحفظ');
  }

  App.saveIdentity = () => patch({ mosque: { name: el('mName').value }, orientation: el('orientation').value, display: { theme: el('theme').value } });
  App.saveTimes = () => patch({ timeAdjust: App.cfg.timeAdjust, hijriDayOffset: App.cfg.hijriDayOffset, ramadanIshaOffset: App.cfg.ramadanIshaOffset });
  App.saveIqama = () => patch({ iqamaGap: App.cfg.iqamaGap });
  App.saveCounters = () => patch({
    iqamaCountdown: { enabled: el('cdEnabled').checked },
    lastThird: { show: el('ltShow').checked },
    tone: { enabled: el('toneEnabled').checked, volume: +el('toneVol').value },
    iqamaMode: { returnSilenceSec: +el('silenceSec').value }
  });
  App.saveAdhkar = () => patch({ adhkar: { mode: el('adhMode').value, autosec: +el('adhSec').value } });
  App.saveFuneral = () => patch({ funeral: { active: el('funActive').checked, prayer: el('funPrayer').value, text: el('funText').value } });
  App.saveOccasions = () => patch({ occasions: App.cfg.occasions });

  App.mLogoUpload = function () {
    const f = el('mLogo').files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => { await App.api('POST', '/api/logo', { dataUrl: reader.result, user: App.user }); App.toast('تم رفع الشعار'); };
    reader.readAsDataURL(f);
  };

  App.cmd = async function (command, prayer) {
    await App.api('POST', '/api/command', { command, prayer, user: App.user });
    App.toast('تم الإرسال');
  };

  App.restart = async function () {
    if (!confirm('إعادة تشغيل النظام؟')) return;
    await App.api('POST', '/api/system/restart', { user: App.user });
    App.toast('جارٍ إعادة التشغيل');
  };
})();
