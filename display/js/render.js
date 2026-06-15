/* عرض الشاشة الرئيسية: الهوية، التواريخ، بطاقات الصلوات، الثلث الأخير، الجنازة. */
(function () {
  'use strict';
  var PE = MD.PE;

  MD.renderIdentity = function () {
    var cfg = MD.cfg;
    MD.$('mosqueName').textContent = (cfg.mosque && cfg.mosque.name) || 'المسجد';
    var logo = MD.$('logo');
    if (cfg.mosque && cfg.mosque.logo) { logo.src = cfg.mosque.logo; logo.style.display = ''; }
    else { logo.style.display = 'none'; }
    document.body.classList.toggle('portrait', cfg.orientation === 'portrait');
    document.body.setAttribute('data-theme', (cfg.display && cfg.display.theme) || 'night');
  };

  MD.renderDates = function (now) {
    MD.$('dateHijri').textContent = PE.hijriString(now, MD.cfg.hijriDayOffset);
    MD.$('dateGreg').textContent = PE.gregorianString(now);
  };

  MD.renderCards = function () {
    var html = '';
    MD.CARD_ORDER.forEach(function (k) {
      var t = MD.fmtTime(MD.times[k]);
      var iq = MD.iqama[k] ? MD.fmtTime(MD.iqama[k]) : null;
      html += '<div class="pcard ' + (k === 'shuruq' ? 'shuruq' : '') + '" data-k="' + k + '">' +
        '<div class="pname">' + PE.PRAYER_AR[k] + '</div>' +
        '<div class="pazan">' + t.hm + '</div>' +
        '<div class="piqama">' + (iq ? 'إقامة <span>' + iq.hm + '</span>' : '—') + '</div>' +
      '</div>';
    });
    MD.$('prayers').innerHTML = html;
  };

  MD.highlightNext = function (np) {
    document.querySelectorAll('.pcard').forEach(function (el) {
      el.classList.toggle('next', el.getAttribute('data-k') === np.next);
    });
  };

  MD.renderLastThird = function (now) {
    var cfg = MD.cfg, box = MD.$('lastThird');
    // يظهر فقط بعد دخول وقت العشاء (ليلاً)، وإلا يُخفى
    var afterIsha = MD.times && MD.times.isha && now.getTime() >= MD.times.isha.getTime();
    if (!cfg.lastThird || !cfg.lastThird.show || !afterIsha) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    var lt = PE.lastThirdOfNight(now, cfg);
    MD.$('ltStart').textContent = MD.fmtTime(lt.start).hm;
    var remMs = lt.start.getTime() - now.getTime();
    if (remMs > 0) {
      var h = Math.floor(remMs / 3600000), m = Math.floor((remMs % 3600000) / 60000);
      MD.$('ltRemain').textContent = (h > 0 ? h + ' س ' : '') + m + ' د';
    } else {
      MD.$('ltRemain').textContent = 'بدأ';
    }
  };

  MD.renderFuneral = function () {
    var f = MD.cfg.funeral || {};
    var el = MD.$('funeral');
    if (f.active) {
      el.textContent = f.text && f.text.trim()
        ? f.text
        : 'صلاة جنازة بعد ' + (PE.PRAYER_AR[f.prayer] || '');
      el.classList.add('active');
    } else { el.classList.remove('active'); }
  };
})();
