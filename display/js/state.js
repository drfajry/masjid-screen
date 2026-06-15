/* آلة الحالات: إعادة بناء الجدول، الانتقال بين الأوضاع، نبضة التحديث، والأوامر. */
(function () {
  'use strict';
  var PE = MD.PE;

  MD.rebuildSchedule = function (now) {
    MD.times = PE.computeForDate(now, MD.cfg);
    MD.iqama = PE.iqamaTimes(MD.times, MD.cfg.iqamaGap);
    MD.lastDay = now.getDate();
    MD.renderCards();
    MD.renderIdentity();
    MD.renderDates(now);
  };

  MD.enterPhase = function (name, prayer) {
    var cfg = MD.cfg, phase = MD.phase;
    phase.name = name; phase.prayer = prayer || null;
    if (name === 'iqama') {
      phase.until = Date.now() + ((cfg.iqamaMode && cfg.iqamaMode.returnSilenceSec) || 45) * 1000;
      MD.show('iqama');
    } else if (name === 'adhkar') {
      MD.show('adhkar'); MD.startAdhkar();
    } else if (name === 'countdown') {
      MD.show('countdown');
    } else {
      clearInterval(MD.adhTimer); MD.show('main');
    }
  };

  MD.handleCommand = function (cmd, prayer) {
    if (cmd === 'start_iqama') MD.enterPhase('iqama', prayer);
    else if (cmd === 'show_adhkar') MD.enterPhase('adhkar', prayer);
    else if (cmd === 'return_normal') MD.enterPhase('main');
    else if (cmd === 'reload') location.reload();
  };

  MD.tick = function () {
    var now = MD.now();
    var cfg = MD.cfg, phase = MD.phase;
    if (!cfg) return;
    if (now.getDate() !== MD.lastDay) { MD.tonePlayedFor = {}; MD.rebuildSchedule(now); }

    // ساعة الشاشة الرئيسية + ساعة شاشة الإقامة
    var ct = MD.fmtTime(now);
    MD.$('clock').innerHTML = ct.hm + '<span class="sec">:' + MD.pad(now.getSeconds()) +
      '</span><span class="ampm">' + ct.ampm + '</span>';
    MD.$('iqClock').textContent = ct.hm;

    // الصلاة القادمة
    var np = PE.nextPrayer(now, cfg);
    var remToNext = Math.max(0, np.nextTime.getTime() - now.getTime());
    var hh = Math.floor(remToNext / 3600000),
        mm = Math.floor((remToNext % 3600000) / 60000),
        ss = Math.floor((remToNext % 60000) / 1000);
    MD.$('nextName').textContent = PE.PRAYER_AR[np.next];
    MD.$('nextCountdown').textContent = (hh > 0 ? hh + ':' : '') + MD.pad(mm) + ':' + MD.pad(ss);
    MD.highlightNext(np);
    MD.renderLastThird(now);
    MD.renderFuneral();

    // نغمة دخول الوقت
    MD.IQAMA_PRAYERS.forEach(function (k) {
      if (!MD.tonePlayedFor[k]) {
        var diff = now.getTime() - MD.times[k].getTime();
        if (diff >= 0 && diff < 1500) { MD.tonePlayedFor[k] = true; MD.playTone(); }
      }
    });

    // الأوامر اليدوية لها أولوية حتى انتهاء مدتها
    if (phase.name === 'iqama') {
      var silenceMs = ((cfg.iqamaMode && cfg.iqamaMode.returnSilenceSec) || 45) * 1000;
      var sig = cfg.signal;
      if (sig && sig.enabled && MD.signal) {
        // مراقبة إشارة المكسر: أثناء الصلاة (إشارة نشطة) مدّد المؤقّت؛
        // وعند انقطاع الإشارة للمدة المحددة عُد إلى الأذكار.
        if (MD.signal.active) { phase.until = Date.now() + silenceMs; }
        else if (Date.now() >= phase.until) { MD.enterPhase('adhkar'); }
      } else {
        // الوضع الافتراضي: مؤقّت ثابت من دخول الإقامة
        if (Date.now() >= phase.until) { MD.enterPhase('adhkar'); }
      }
      return;
    }
    if (phase.name === 'adhkar') { return; } // يُدار بالمؤقّت

    // تحديد تلقائي: هل نحن بين الأذان والإقامة؟
    var inWindow = null;
    for (var i = 0; i < MD.IQAMA_PRAYERS.length; i++) {
      var k = MD.IQAMA_PRAYERS[i];
      if (now >= MD.times[k] && now < MD.iqama[k]) { inWindow = k; break; }
    }

    if (inWindow) {
      if (phase.name !== 'countdown' || phase.prayer !== inWindow) MD.enterPhase('countdown', inWindow);
      MD.renderCountdown(now, inWindow);
    } else if (phase.name === 'countdown') {
      // انتهى وقت الإقامة → ادخل وضع الإقامة (الشاشة السوداء)
      MD.enterPhase('iqama', phase.prayer);
    } else {
      if (phase.name !== 'main') MD.enterPhase('main');
    }
  };
})();
