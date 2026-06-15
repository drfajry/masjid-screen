/* تسجيل الدخول والخروج. */
(function () {
  'use strict';

  App.login = async function () {
    const u = App.el('lgUser').value, p = App.el('lgPass').value;
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    if (!r.ok) { App.el('lgErr').textContent = 'بيانات الدخول غير صحيحة'; return; }
    const data = await r.json();
    App.token = data.token; App.user = data.user.username;
    sessionStorage.setItem('mtok', App.token); sessionStorage.setItem('muser', App.user);
    App.boot();
  };

  App.logout = function () {
    App.token = null; App.user = null; sessionStorage.clear();
    App.el('appui').classList.add('hidden'); App.el('login').classList.remove('hidden');
  };
})();
