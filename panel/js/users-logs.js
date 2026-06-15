/* إدارة المستخدمين وسجل العمليات. */
(function () {
  'use strict';
  const el = App.el;

  // ---------- المستخدمون ----------
  App.loadUsers = async function () {
    const list = await App.api('GET', '/api/users');
    const tb = el('usersTbl').querySelector('tbody'); tb.innerHTML = '';
    list.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.username}</td><td>${u.role}</td>`;
      const td = document.createElement('td');
      if (u.username !== 'admin') {
        const b = document.createElement('button'); b.className = 'btn sm red'; b.textContent = 'حذف';
        b.onclick = async () => { await App.api('DELETE', `/api/users/${u.username}?by=${App.user}`); App.loadUsers(); };
        td.appendChild(b);
      }
      tr.appendChild(td); tb.appendChild(tr);
    });
  };

  App.addUser = async function () {
    const u = el('nuUser').value, p = el('nuPass').value;
    if (!u || !p) return App.toast('أدخل البيانات', true);
    const r = await App.api('POST', '/api/users', { username: u, password: p, by: App.user });
    if (r.ok) { el('nuUser').value = ''; el('nuPass').value = ''; App.loadUsers(); App.toast('تمت الإضافة'); }
    else App.toast('اسم المستخدم موجود', true);
  };

  // ---------- السجل ----------
  App.loadLogs = async function () {
    const s = el('logSearch').value;
    const rows = await App.api('GET', '/api/logs?search=' + encodeURIComponent(s));
    const tb = el('logsTbl').querySelector('tbody'); tb.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      const d = new Date(r.ts).toLocaleString('ar-SA');
      tr.innerHTML = `<td>${d}</td><td>${r.username || ''}</td><td>${r.action || ''}</td><td>${r.target || ''}</td>`;
      tb.appendChild(tr);
    });
  };

  App.exportLogs = function () { window.open('/api/logs/export', '_blank'); };
})();
