/* التبويبات والإقلاع. يجب تحميل هذا الملف أخيراً بعد بقية وحدات اللوحة. */
(function () {
  'use strict';
  const el = App.el, $ = App.$;

  App.buildTabs = function () {
    const t = el('tabs'); t.innerHTML = '';
    App.TABS.forEach(([k, ar], i) => {
      const b = document.createElement('div');
      b.className = 'tab' + (i === 0 ? ' active' : ''); b.textContent = ar;
      b.onclick = () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        $(`.section[data-sec="${k}"]`).classList.add('active');
        if (App.stopGpsPoll) App.stopGpsPoll(); // أوقف استطلاع GPS عند مغادرة تبويبه
        if (App.stopMixerPoll) App.stopMixerPoll(); // أوقف استطلاع المكسر عند مغادرة تبويبه
        if (App.stopUpdatePoll) App.stopUpdatePoll(); // أوقف استطلاع التحديثات عند مغادرة تبويبه
        if (k === 'times' && App.renderLocation) App.renderLocation();
        if (k === 'users') App.loadUsers();
        if (k === 'logs') App.loadLogs();
        if (k === 'timesync') App.renderTimeSync();
        if (k === 'gps') App.renderGps();
        if (k === 'mixer') App.renderMixer();
        if (k === 'update') App.renderUpdate();
        if (k === 'system') App.renderLinks();
      };
      t.appendChild(b);
    });
    document.querySelector('.section[data-sec="identity"]').classList.add('active');
  };

  App.boot = async function () {
    el('login').classList.add('hidden'); el('appui').classList.remove('hidden');
    el('whoName').textContent = App.user;
    App.cfg = await App.api('GET', '/api/config');
    App.buildTabs();
    App.renderForms();
    el('mLogo').onchange = App.mLogoUpload;
  };

  function init() {
    if (App.token) App.boot(); else { el('login').classList.remove('hidden'); }
    el('lgPass').addEventListener('keydown', e => { if (e.key === 'Enter') App.login(); });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
