/* النواة المشتركة لشاشة العرض — الحالة، الثوابت، وأدوات مساعدة.
   كل وحدات الشاشة تعلّق دوالها على الكائن MD المعرّف هنا. */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);

  window.MD = {
    PE: window.PrayerEngine,

    // ثوابت
    IQAMA_PRAYERS: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
    CARD_ORDER: ['fajr', 'shuruq', 'dhuhr', 'asr', 'maghrib', 'isha'],
    ringC: 2 * Math.PI * 130,
    HOST: location.host || ((qs.get('ip') || '127.0.0.1') + ':' + (qs.get('port') || '3777')),

    // الحالة المشتركة
    cfg: null,
    times: null,
    iqama: null,
    lastDay: -1,
    tonePlayedFor: {},                 // منع تكرار النغمة لنفس الصلاة
    phase: { name: 'main', prayer: null, until: 0 },
    signal: null,                      // حالة إشارة المكسر {active, ts} عند تفعيل المراقبة

    // حالة الأذكار
    adhPages: [],
    adhPageIdx: 0,
    adhTimer: 0,
  };

  // ---------- أدوات مساعدة ----------
  MD.$ = function (id) { return document.getElementById(id); };
  MD.pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  MD.fmtTime = function (d) {
    var h = d.getHours(), m = d.getMinutes();
    var ap = h < 12 ? 'ص' : 'م'; var h12 = h % 12 || 12;
    return { hm: MD.pad(h12) + ':' + MD.pad(m), ampm: ap, full: MD.pad(h) + ':' + MD.pad(m) };
  };
  MD.show = function (screen) {
    ['main', 'countdown', 'iqama', 'adhkar'].forEach(function (s) {
      MD.$(s).classList.toggle('active', s === screen);
    });
  };
})();
