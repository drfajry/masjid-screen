/* العدّاد الدائري للإقامة: دقائق في الوسط، يتحوّل لثوانٍ في الدقيقة الأخيرة. */
(function () {
  'use strict';
  var PE = MD.PE;

  MD.renderCountdown = function (now, prayer) {
    var cfg = MD.cfg;
    var iqTime = MD.iqama[prayer];
    var remSec = Math.max(0, (iqTime.getTime() - now.getTime()) / 1000);
    var ring = MD.$('ring'), fg = MD.$('ringFg');
    var big, unit, frac;
    if (remSec > 60) {
      big = Math.floor(remSec / 60);
      unit = 'دقيقة';
      var total = (cfg.iqamaGap[prayer] || 1) * 60;
      frac = Math.min(1, remSec / total);
      ring.classList.remove('seconds');
    } else {
      big = Math.ceil(remSec);
      unit = 'ثانية';
      frac = remSec / 60;
      ring.classList.add('seconds');
    }
    MD.$('cdBig').textContent = big;
    MD.$('cdUnit').textContent = unit;
    MD.$('cdPrayer').textContent = 'صلاة ' + PE.PRAYER_AR[prayer];
    fg.style.strokeDasharray = MD.ringC;
    fg.style.strokeDashoffset = MD.ringC * (1 - frac);
  };
})();
