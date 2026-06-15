/*
 * تشغيل الخادم كعملية Node مستقلة (بدون Electron) — للاختبار أو للاستضافة السحابية.
 *   الشاشة : /display/index.html      اللوحة : /
 *
 * يقرأ من البيئة: PORT، DB_PATH. وعند وجود GITHUB_TOKEN + GITHUB_REPO يحفظ البيانات
 * في مستودع GitHub (نفس نمط «ناشر») لتبقى محفوظة رغم إعادة تشغيل الاستضافة المجانية.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { createServer } = require('./server');
const cloud = require('./cloud-store');

const PORT = process.env.PORT || 3777;
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'masjid.db');
// نفس تحويل المسار في db.js (.db → .json) لنعرف الملف الفعلي
const jsonPath = dbPath.replace(/\.db$/i, '') + '.json';

let currentSha = null;       // sha الملف على GitHub (للكتابة الآمنة)
let pushTimer = null;        // مؤقّت الدمج (debounce)
let pushing = false;

function lanIPs() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const ni of ifs[name]) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out.length ? out : ['127.0.0.1'];
}

// دفع التغييرات إلى GitHub بعد فترة هدوء قصيرة (تجميع عدة تعديلات)
function schedulePush() {
  if (!cloud.enabled()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(doPush, 4000);
}
async function doPush() {
  if (pushing) { schedulePush(); return; }
  pushing = true;
  try {
    const content = fs.readFileSync(jsonPath, 'utf8');
    currentSha = await cloud.push(content, currentSha);
    console.log('☁️  حُفظت البيانات على GitHub');
  } catch (e) {
    console.warn('تعذّر الحفظ على GitHub:', e.message, '— سيُعاد المحاولة عند التعديل التالي');
  } finally {
    pushing = false;
  }
}

async function boot() {
  // سحب البيانات من GitHub قبل بدء الخادم (إن كان التخزين السحابي مفعّلاً)
  if (cloud.enabled()) {
    try {
      const { content, sha } = await cloud.pull();
      if (content) {
        fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
        fs.writeFileSync(jsonPath, content);
        currentSha = sha;
        console.log('☁️  استُرجعت البيانات من GitHub');
      } else {
        console.log('☁️  لا توجد بيانات سابقة على GitHub — ستُنشأ عند أول تعديل');
      }
    } catch (e) {
      console.warn('تعذّر السحب من GitHub:', e.message, '— البدء ببيانات محلية');
    }
  }

  const srv = createServer({
    dbPath,
    onRestart: () => { console.log('طلب إعادة تشغيل العملية.'); process.exit(0); },
  });

  // راقب ملف البيانات؛ أي تعديل (إعدادات/مستخدمون/سجل) يُجدول حفظاً سحابياً
  if (cloud.enabled()) {
    try { fs.watchFile(jsonPath, { interval: 2000 }, schedulePush); } catch (e) {}
  }

  srv.listen(PORT, () => {
    console.log('================ نظام شاشة المسجد ================');
    console.log('الخادم يعمل على المنفذ: ' + PORT);
    if (cloud.enabled()) console.log('التخزين السحابي: مُفعّل (GitHub)');
    lanIPs().forEach((ip) => {
      console.log('  الشاشة : http://' + ip + ':' + PORT + '/display/index.html');
      console.log('  اللوحة : http://' + ip + ':' + PORT + '/');
    });
    console.log('  المستخدم الافتراضي: admin / admin');
    console.log('=================================================');
  });
}

boot();
