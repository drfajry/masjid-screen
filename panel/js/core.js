/* النواة المشتركة للوحة التحكم — الحالة، الثوابت، وأدوات الاتصال.
   كل وحدات اللوحة تعلّق دوالها على الكائن App المعرّف هنا. */
window.App = (function () {
  'use strict';

  const App = {
    // الحالة المشتركة
    token: sessionStorage.getItem('mtok') || null,
    user: sessionStorage.getItem('muser') || null,
    cfg: null,

    // الثوابت
    PRAYERS: [['fajr', 'الفجر'], ['shuruq', 'الشروق'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء']],
    IQAMA_P: [['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء']],
    OCCASIONS: [['jumuah', 'الجمعة'], ['eid', 'العيد'], ['istisqa', 'الاستسقاء'], ['kusuf', 'الكسوف'], ['khusuf', 'الخسوف']],
    TABS: [
      ['identity', 'الهوية'], ['times', 'الأوقات'], ['iqama', 'الإقامة'], ['live', 'تحكم مباشر'],
      ['adhkar', 'الأذكار'], ['funeral', 'الجنازة'], ['occasions', 'المناسبات'],
      ['users', 'المستخدمون'], ['logs', 'السجل'], ['timesync', 'مزامنة الوقت'], ['gps', 'GPS'], ['mixer', 'مراقبة المكسر'], ['update', 'التحديثات'], ['system', 'النظام']
    ],
  };

  // ---------- أدوات ----------
  App.$ = (s) => document.querySelector(s);
  App.el = (id) => document.getElementById(id);

  App.toast = function (msg, err) {
    const t = App.el('toast'); t.textContent = msg;
    t.className = 'toast show' + (err ? ' err' : '');
    setTimeout(() => (t.className = 'toast'), 1800);
  };

  App.api = async function (method, path, body) {
    const r = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + App.token },
      body: body ? JSON.stringify(body) : undefined
    });
    if (r.status === 401) { App.logout(); throw new Error('انتهت الجلسة'); }
    return r.headers.get('content-type')?.includes('json') ? r.json() : r;
  };

  return App;
})();
