/* ساعة الشاشة مع مزامنة الوقت.
   MD.now() يعيد الوقت الصحيح = ساعة الجهاز + إزاحة المزامنة (offsetMs).
   كل وحدات الشاشة تستخدم MD.now() بدل new Date() ليُطبَّق التصحيح تلقائياً. */
(function () {
  'use strict';

  MD.timeOffset = function () {
    var ts = MD.cfg && MD.cfg.timeSync;
    return (ts && typeof ts.offsetMs === 'number') ? ts.offsetMs : 0;
  };

  MD.now = function () {
    return new Date(Date.now() + MD.timeOffset());
  };
})();
