/*
 * الإعدادات الافتراضية للنظام.
 * هذا هو الملف الأنسب للتعديل عند تغيير القيم المبدئية:
 * الموقع، فجوات الإقامة، رسائل المناسبات، أوضاع العرض... إلخ.
 * تُطبَّق هذه القيم عند أول تشغيل، وتُدمج المفاتيح الجديدة تلقائياً على
 * الإعدادات المحفوظة عند الترقية (لا تُفقد إعدادات المستخدم).
 */
const DEFAULT_CONFIG = {
  mosque: { name: 'المسجد', logo: null },

  // الموقع الافتراضي: المدينة المنورة — غيّره من الإعداد عند التركيب
  location: { lat: 24.4709, lng: 39.6122, city: 'المدينة المنورة' },

  // إزاحة وقت كل صلاة بالدقائق (+/−)
  timeAdjust: { fajr: 0, shuruq: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },

  hijriDayOffset: 0,        // إضافة/إنقاص أيام للتاريخ الهجري (للرؤية الشرعية)
  ramadanIshaOffset: 0,     // تقديم/تأخير عشاء رمضان بالدقائق (يُطبّق في رمضان فقط)

  // فجوة الإقامة بعد الأذان بالدقائق لكل صلاة
  iqamaGap: { fajr: 25, dhuhr: 20, asr: 20, maghrib: 7, isha: 15 },

  // المناسبات: فجوة إقامة مستقلة ورسالة لكل مناسبة
  occasions: {
    jumuah:  { gap: 0, msg: '' },
    eid:     { gap: 0, msg: 'تقبل الله منا ومنكم' },
    istisqa: { gap: 0, msg: 'صلاة الاستسقاء' },
    kusuf:   { gap: 0, msg: 'صلاة كسوف الشمس' },
    khusuf:  { gap: 0, msg: 'صلاة خسوف القمر' }
  },

  iqamaCountdown: { enabled: true },                 // العدّاد الدائري
  lastThird: { show: true },                         // عرض ثلث الليل الأخير
  tone: { enabled: true, volume: 0.7, durationSec: 2 }, // نغمة دخول الوقت
  iqamaMode: { returnSilenceSec: 45 },               // مدة العودة بعد الإقامة
  adhkar: { mode: 'one_per_screen', autosec: 12 },   // one_screen | two_screens | three_screens | one_per_screen
  funeral: { active: false, prayer: 'asr', text: '' },

  // مزامنة الوقت — إزاحة تُضاف لساعة الجهاز (لا تحتاج صلاحيات نظام)
  timeSync: {
    mode: 'auto',          // auto | manual | off
    offsetMs: 0,           // فرق المللي ثانية بين الوقت الصحيح وساعة الجهاز
    intervalMin: 360,      // دورية المزامنة التلقائية بالدقائق (٦ ساعات)
    host: 'https://www.google.com', // مصدر الوقت الصحيح (ترويسة Date)
    lastSync: null,        // وقت آخر مزامنة ناجحة (ISO)
    lastResult: null,      // ok | failed | null
    source: null           // المصدر المستخدم في آخر مزامنة
  },

  // جهاز GPS (اختياري) — يضبط الموقع والوقت تلقائياً عند توفّر إشارة، دون إنترنت
  gps: {
    enabled: false,        // فعّله من اللوحة عند توصيل الجهاز
    autoLocation: true,    // ضبط الموقع تلقائياً عند الإشارة
    autoTime: true,        // ضبط الوقت تلقائياً من GPS
    port: 'auto',          // 'auto' للكشف التلقائي، أو مسار محدد (COM3 / /dev/ttyUSB0)
    baud: 9600             // سرعة المنفذ التسلسلي
  },

  // مراقبة إشارة المكسر (إشارة كهربائية نشط/متوقف) للعودة التلقائية بعد الصلاة
  signal: {
    enabled: false,
    source: 'http',        // http (جهاز خارجي يرسل الحالة) | serial (لوحة USB دخل رقمي)
    graceSec: 3,           // مهلة اعتبار الإشارة متوقفة في نمط النبض
    serial: {
      port: 'auto',        // منفذ لوحة الدخل (COM3 / /dev/ttyUSB0)
      baud: 9600,
      queryHex: '',        // طلب hex يُرسل دورياً إن كانت اللوحة تتطلبه (فارغ = بثّ تلقائي)
      pollMs: 500,         // دورية الاستعلام
      activeByteIndex: 0,  // موضع بايت الحالة في الاستجابة
      activeMask: 1,       // قناع البِت الذي يمثّل الطرف
      activeHigh: true     // true: البِت العالي = نشط
    }
    // ملاحظة: مدة الانقطاع قبل العودة تؤخذ من iqamaMode.returnSilenceSec
  },

  orientation: 'landscape',                          // landscape | portrait
  display: { theme: 'night' }
};

module.exports = { DEFAULT_CONFIG };
