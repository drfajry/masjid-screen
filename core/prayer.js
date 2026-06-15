/*
 * محرك أوقات الصلاة — تقويم أم القرى (يعمل أوفلاين بالكامل)
 * يعمل في المتصفح (window.adhan) وفي Node (للاختبار).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('adhan'));
  } else {
    root.PrayerEngine = factory(root.adhan);
  }
})(typeof self !== 'undefined' ? self : this, function (adhan) {
  'use strict';

  var PRAYER_KEYS = ['fajr', 'shuruq', 'dhuhr', 'asr', 'maghrib', 'isha'];

  var PRAYER_AR = {
    fajr: 'الفجر',
    shuruq: 'الشروق',
    dhuhr: 'الظهر',
    asr: 'العصر',
    maghrib: 'المغرب',
    isha: 'العشاء',
    jumuah: 'الجمعة'
  };

  // أضف/اطرح دقائق على كائن تاريخ (نسخة جديدة)
  function addMinutes(date, mins) {
    return new Date(date.getTime() + mins * 60000);
  }

  // رقم الشهر الهجري (1..12) بتقويم أم القرى مع مراعاة إزاحة الأيام
  function hijriMonthNumber(date, dayOffset) {
    var d = addMinutes(date, (dayOffset || 0) * 1440);
    var m = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { month: 'numeric' }).format(d);
    return parseInt(m, 10);
  }

  // نص التاريخ الهجري الكامل بالعربية مع إزاحة الأيام
  function hijriString(date, dayOffset) {
    var d = addMinutes(date, (dayOffset || 0) * 1440);
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(d) ;
  }

  // نص التاريخ الميلادي بالعربية (نُجبر التقويم الميلادي صراحةً؛ وإلا يتحوّل لهجري على أجهزة السعودية)
  function gregorianString(date) {
    return new Intl.DateTimeFormat('ar-u-ca-gregory', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(date);
  }

  /*
   * احسب أوقات الصلاة ليوم معيّن.
   * cfg: { lat, lng, timeAdjust:{fajr,shuruq,dhuhr,asr,maghrib,isha}, ramadanIshaOffset, hijriDayOffset }
   * يعيد كائناً يحتوي تواريخ JS لكل صلاة (بعد الإزاحات).
   */
  function computeForDate(date, cfg) {
    // الإحداثيات مخزّنة تحت cfg.location؛ مع توافق خلفي لو مُرّرت في الجذر
    var loc = cfg.location || {};
    var lat = loc.lat != null ? loc.lat : (cfg.lat != null ? cfg.lat : 24.4709);
    var lng = loc.lng != null ? loc.lng : (cfg.lng != null ? cfg.lng : 39.6122);
    var coords = new adhan.Coordinates(lat, lng);
    var params = adhan.CalculationMethod.UmmAlQura();
    var pt = new adhan.PrayerTimes(coords, date, params);

    var adj = cfg.timeAdjust || {};
    var times = {
      fajr: addMinutes(pt.fajr, adj.fajr || 0),
      shuruq: addMinutes(pt.sunrise, adj.shuruq || 0),
      dhuhr: addMinutes(pt.dhuhr, adj.dhuhr || 0),
      asr: addMinutes(pt.asr, adj.asr || 0),
      maghrib: addMinutes(pt.maghrib, adj.maghrib || 0),
      isha: addMinutes(pt.isha, adj.isha || 0)
    };

    // رمضان: إعداد مستقل للعشاء (تقديم/تأخير) يُطبّق تلقائياً في شهر رمضان فقط
    if (hijriMonthNumber(date, cfg.hijriDayOffset) === 9 && cfg.ramadanIshaOffset) {
      times.isha = addMinutes(times.isha, cfg.ramadanIshaOffset);
    }

    return times;
  }

  // الثلث الأخير من الليل: من مغرب اليوم إلى فجر الغد
  function lastThirdOfNight(date, cfg) {
    var todayMaghrib = computeForDate(date, cfg).maghrib;
    var tomorrow = addMinutes(date, 1440);
    var tomorrowFajr = computeForDate(tomorrow, cfg).fajr;
    var nightMs = tomorrowFajr.getTime() - todayMaghrib.getTime();
    var start = new Date(todayMaghrib.getTime() + (nightMs * 2) / 3);
    return { start: start, fajr: tomorrowFajr, nightMs: nightMs };
  }

  /*
   * احسب وقت الإقامة لكل صلاة: وقت الأذان + فجوة الإقامة بالدقائق.
   * iqamaGap: { fajr, dhuhr, asr, maghrib, isha } بالدقائق.
   */
  function iqamaTimes(times, iqamaGap) {
    var g = iqamaGap || {};
    var out = {};
    ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(function (k) {
      out[k] = addMinutes(times[k], g[k] != null ? g[k] : 0);
    });
    return out;
  }

  /*
   * حدّد الصلاة القادمة والصلاة الحالية بالنسبة لوقت "now".
   * يعيد: { current, next, nextTime } — يتعامل مع تجاوز منتصف الليل (القادمة فجر الغد).
   */
  function nextPrayer(now, cfg) {
    var today = computeForDate(now, cfg);
    var order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    for (var i = 0; i < order.length; i++) {
      if (today[order[i]].getTime() > now.getTime()) {
        return {
          current: i > 0 ? order[i - 1] : 'isha',
          next: order[i],
          nextTime: today[order[i]]
        };
      }
    }
    // بعد العشاء: القادمة فجر الغد
    var tomorrow = computeForDate(addMinutes(now, 1440), cfg);
    return { current: 'isha', next: 'fajr', nextTime: tomorrow.fajr };
  }

  function isRamadan(date, cfg) {
    return hijriMonthNumber(date, cfg.hijriDayOffset) === 9;
  }

  return {
    PRAYER_KEYS: PRAYER_KEYS,
    PRAYER_AR: PRAYER_AR,
    addMinutes: addMinutes,
    computeForDate: computeForDate,
    iqamaTimes: iqamaTimes,
    lastThirdOfNight: lastThirdOfNight,
    nextPrayer: nextPrayer,
    hijriString: hijriString,
    gregorianString: gregorianString,
    hijriMonthNumber: hijriMonthNumber,
    isRamadan: isRamadan
  };
});
