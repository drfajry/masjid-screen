/* الاتصال بالخادم (جلب الإعدادات + WebSocket للبث الفوري) وإقلاع الشاشة.
   يجب تحميل هذا الملف أخيراً بعد بقية وحدات الشاشة. */
(function () {
  'use strict';

  // اختر البروتوكول حسب الصفحة: wss/https على الاستضافة السحابية، ws/http محلياً
  var httpBase = location.protocol === 'https:' ? 'https://' : 'http://';
  var wsBase = location.protocol === 'https:' ? 'wss://' : 'ws://';

  function connectWS() {
    var ws = new WebSocket(wsBase + MD.HOST);
    ws.onmessage = function (ev) {
      var msg = JSON.parse(ev.data);
      if (msg.type === 'config') {
        MD.cfg = msg.config;
        MD.rebuildSchedule(MD.now());
      } else if (msg.type === 'command') {
        MD.handleCommand(msg.command, msg.prayer);
      } else if (msg.type === 'signal') {
        MD.signal = { active: msg.active, ts: msg.ts };
      }
    };
    ws.onclose = function () { setTimeout(connectWS, 2000); }; // إعادة اتصال تلقائية
  }
  MD.connectWS = connectWS;

  // ---------- الإقلاع ----------
  fetch(httpBase + MD.HOST + '/api/config')
    .then(function (r) { return r.json(); })
    .then(function (c) {
      MD.cfg = c;
      MD.rebuildSchedule(MD.now());
      connectWS();
      setInterval(MD.tick, 250);
      MD.tick();
    })
    .catch(function () {
      document.body.innerHTML = '<div style="color:#fff;text-align:center;margin-top:30vh;font-size:4vh">' +
        'تعذّر الاتصال بالخادم<br><small style="font-size:2.4vh;color:#9aa">' + MD.HOST + '</small></div>';
    });
})();
