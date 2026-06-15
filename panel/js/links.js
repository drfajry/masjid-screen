/* روابط الوصول: يعرض رابط اللوحة وشاشة العرض مع رمز QR (يعمل دون إنترنت). */
(function () {
  'use strict';
  const el = App.el;

  function isIp(h) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(h); }

  async function resolveHost() {
    // إن كان العنوان الحالي IP فاستخدمه؛ وإلا اسأل الخادم عن عنوانه على الشبكة
    const port = location.port || '3777';
    if (isIp(location.hostname)) return { host: location.hostname + ':' + port, note: '' };
    try {
      const info = await App.api('GET', '/api/netinfo');
      const ip = (info.ips && info.ips[0]);
      const p = info.port || port;
      if (ip) return { host: ip + ':' + p, note: '' };
    } catch (e) {}
    return {
      host: location.host,
      note: 'أنت تفتح اللوحة عبر ' + location.hostname + '؛ لفتحها من جهاز آخر استخدم عنوان IP لجهاز الشاشة.'
    };
  }

  function drawQR(text) {
    const box = el('qrBox');
    try {
      const qr = window.qrcode(0, 'M'); // نوع تلقائي، تصحيح خطأ متوسط
      qr.addData(text);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 0, scalable: true });
      const svg = box.querySelector('svg');
      if (svg) { svg.style.width = '180px'; svg.style.height = '180px'; }
    } catch (e) { box.innerHTML = ''; }
  }

  App.renderLinks = async function () {
    const { host, note } = await resolveHost();
    const panelUrl = location.protocol + '//' + host + '/';
    const displayUrl = location.protocol + '//' + host + '/display/index.html';
    el('lnkPanel').textContent = panelUrl;
    el('lnkDisplay').textContent = displayUrl;
    el('lnkHint').textContent = note || 'الدخول الافتراضي: admin / admin';
    drawQR(panelUrl);
  };

  App.copyLink = function (id) {
    const text = el(id).textContent;
    const done = () => App.toast('تم نسخ الرابط');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback(text, done));
    } else { fallback(text, done); }
  };
  function fallback(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }
})();
