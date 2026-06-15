/* لوحة التحديثات: الإصدار الحالي، حالة التحديث، التحقق والتثبيت. */
(function () {
  'use strict';
  const el = App.el;
  let pollTimer = null;

  const STATE_AR = {
    idle: 'جاهز',
    checking: 'جارٍ التحقق…',
    'not-available': 'النظام محدّث',
    downloading: 'جارٍ التنزيل',
    downloaded: 'تم التنزيل — جاهز للتثبيت',
    error: 'حدث خطأ'
  };

  async function loadStatus() {
    let s;
    try { s = await App.api('GET', '/api/update/status'); } catch (e) { return; }
    el('updCurrent').textContent = s.currentVersion || '—';
    if (!s.available) {
      el('updState').textContent = 'التحديث التلقائي يعمل فقط في النسخة المثبّتة';
      el('updState').style.color = 'var(--muted)';
      el('updInstall').disabled = true;
      el('updNew').textContent = '—';
      el('updProgress').textContent = '';
      return;
    }
    el('updState').textContent = STATE_AR[s.state] || s.state;
    el('updState').style.color = s.state === 'error' ? 'var(--red)'
      : (s.state === 'downloaded' || s.state === 'not-available') ? 'var(--teal)' : 'var(--gold)';
    el('updNew').textContent = s.version || '—';
    el('updProgress').textContent = s.state === 'downloading' && s.progress ? ('%' + s.progress) : '';
    el('updInstall').disabled = s.state !== 'downloaded';
    if (s.error) { el('updState').textContent = STATE_AR.error + ': ' + s.error; }
  }

  App.renderUpdate = function () {
    loadStatus();
    clearInterval(pollTimer);
    pollTimer = setInterval(loadStatus, 2000);
  };
  App.stopUpdatePoll = function () { clearInterval(pollTimer); };

  App.updateCheck = async function () {
    const r = await App.api('POST', '/api/update/check', { user: App.user });
    if (r && r.ok) App.toast('جارٍ التحقق من التحديثات…');
    else App.toast('التحديث غير متاح في هذه النسخة', true);
    setTimeout(loadStatus, 500);
  };

  App.updateInstall = async function () {
    if (!confirm('سيُعاد تشغيل النظام لتثبيت التحديث. متابعة؟')) return;
    const r = await App.api('POST', '/api/update/install', { user: App.user });
    App.toast(r && r.ok ? 'جارٍ التثبيت وإعادة التشغيل…' : 'لا يوجد تحديث جاهز', !(r && r.ok));
  };
})();
