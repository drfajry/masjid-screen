/* ضبط موقع المسجد: مدن سعودية جاهزة أو إحداثيات مخصّصة (لمن لا يملك GPS). */
(function () {
  'use strict';
  const el = App.el;

  // مدن سعودية رئيسية (إحداثيات تقريبية للمركز)
  const CITIES = [
    ['مكة المكرمة', 21.3891, 39.8579],
    ['المدينة المنورة', 24.4709, 39.6122],
    ['الرياض', 24.7136, 46.6753],
    ['جدة', 21.4858, 39.1925],
    ['الدمام', 26.4207, 50.0888],
    ['الطائف', 21.2703, 40.4158],
    ['بريدة', 26.3260, 43.9750],
    ['تبوك', 28.3838, 36.5550],
    ['أبها', 18.2164, 42.5053],
    ['حائل', 27.5114, 41.7208],
    ['نجران', 17.4917, 44.1322],
    ['جازان', 16.8892, 42.5511],
    ['الأحساء (الهفوف)', 25.3833, 49.5860],
    ['ينبع', 24.0890, 38.0618],
    ['عرعر', 30.9753, 41.0381],
    ['سكاكا', 29.9697, 40.2064],
    ['الباحة', 20.0129, 41.4677],
  ];

  let built = false;
  function buildCityList() {
    if (built) return; built = true;
    const sel = el('cityPreset');
    CITIES.forEach(([name, lat, lng]) => {
      const o = document.createElement('option');
      o.value = lat + ',' + lng; o.textContent = name;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      if (!sel.value) return;
      const [lat, lng] = sel.value.split(',');
      el('locLat').value = lat; el('locLng').value = lng;
      el('locCity').value = sel.options[sel.selectedIndex].textContent;
    };
  }

  App.renderLocation = function () {
    buildCityList();
    const loc = App.cfg.location || {};
    el('locCity').value = loc.city || '';
    el('locLat').value = loc.lat != null ? loc.lat : '';
    el('locLng').value = loc.lng != null ? loc.lng : '';
    // طابق القائمة على الإحداثيات الحالية إن وُجدت
    const match = CITIES.find(c => Math.abs(c[1] - loc.lat) < 0.01 && Math.abs(c[2] - loc.lng) < 0.01);
    el('cityPreset').value = match ? (match[1] + ',' + match[2]) : '';
  };

  App.saveLocation = async function () {
    const lat = parseFloat(el('locLat').value), lng = parseFloat(el('locLng').value);
    if (isNaN(lat) || isNaN(lng)) return App.toast('أدخل إحداثيات صحيحة', true);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return App.toast('إحداثيات خارج النطاق', true);
    App.cfg = await App.api('POST', '/api/config', {
      patch: { location: { lat, lng, city: el('locCity').value.trim() } },
      __user: App.user
    });
    App.toast('تم حفظ الموقع — أُعيد حساب المواقيت');
  };
})();
