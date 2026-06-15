/* عرض الأذكار بعد الصلاة: بناء الصفحات حسب الوضع، وتدويرها تلقائياً.
   نصوص الأذكار نفسها في ملف البيانات adhkar-data.js (window.ADHKAR). */
(function () {
  'use strict';

  MD.buildAdhkarPages = function () {
    var cfg = MD.cfg;
    var mode = (cfg.adhkar && cfg.adhkar.mode) || 'one_per_screen';
    var list = window.ADHKAR;
    var pages = [];
    if (mode === 'one_screen') {
      pages = [{ cols: 1, items: list }];
    } else if (mode === 'two_screens') {
      var h = Math.ceil(list.length / 2);
      pages = [{ cols: 2, items: list.slice(0, h) }, { cols: 2, items: list.slice(h) }];
    } else if (mode === 'three_screens') {
      var t = Math.ceil(list.length / 3);
      pages = [
        { cols: 1, items: list.slice(0, t) },
        { cols: 1, items: list.slice(t, 2 * t) },
        { cols: 1, items: list.slice(2 * t) }
      ];
    } else { // one_per_screen
      pages = list.map(function (x) { return { cols: 1, items: [x] }; });
    }
    MD.adhPages = pages;
    MD.adhPageIdx = 0;
  };

  MD.renderAdhkarPage = function () {
    var p = MD.adhPages[MD.adhPageIdx];
    if (!p) return;
    var grid = MD.$('adhGrid');
    grid.className = 'adh-grid cols-' + p.cols;
    grid.innerHTML = p.items.map(function (it) {
      return '<div class="adh-item"><div class="adh-text">' + it.text + '</div>' +
        (it.count ? '<div class="adh-count">' + it.count + '</div>' : '') + '</div>';
    }).join('');
    MD.$('adhDots').innerHTML = MD.adhPages.map(function (_, i) {
      return '<i class="' + (i === MD.adhPageIdx ? 'on' : '') + '"></i>';
    }).join('');
  };

  MD.startAdhkar = function () {
    MD.buildAdhkarPages();
    MD.renderAdhkarPage();
    var sec = (MD.cfg.adhkar && MD.cfg.adhkar.autosec) || 12;
    clearInterval(MD.adhTimer);
    MD.adhTimer = setInterval(function () {
      MD.adhPageIdx++;
      if (MD.adhPageIdx >= MD.adhPages.length) { clearInterval(MD.adhTimer); MD.enterPhase('main'); return; }
      MD.renderAdhkarPage();
    }, sec * 1000);
  };
})();
