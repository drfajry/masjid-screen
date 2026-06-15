/*
 * تخزين سحابي اختياري — يحفظ ملف بيانات النظام (JSON) في مستودع GitHub خاص،
 * ليبقى محفوظاً رغم إعادة تشغيل الاستضافة المجانية (Render وغيرها بلا قرص دائم).
 * نفس نمط «ناشر»: GET للقراءة + PUT مع sha للكتابة.
 *
 * يُفعَّل تلقائياً عند وجود متغيّرات البيئة:
 *   GITHUB_TOKEN  : توكن fine-grained بصلاحية Contents (read/write)
 *   GITHUB_REPO   : "owner/repo" للمستودع الخاص بالبيانات
 *   GITHUB_PATH   : اسم الملف داخله (افتراضي: masjid-data.json)
 *   GITHUB_BRANCH : الفرع (افتراضي: main)
 */
const https = require('https');

function cfg() {
  return {
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO,
    path: process.env.GITHUB_PATH || 'masjid-data.json',
    branch: process.env.GITHUB_BRANCH || 'main',
  };
}

function enabled() {
  const c = cfg();
  return !!(c.token && c.repo);
}

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const c = cfg();
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        'Authorization': 'Bearer ' + c.token,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'masjid-screen',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
      },
      timeout: 15000,
    }, (res) => {
      let buf = '';
      res.on('data', (d) => (buf += d));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(buf); } catch (e) {}
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

// اقرأ المحتوى من GitHub. يعيد { content, sha } أو { content:null, sha:null } لو غير موجود.
async function pull() {
  const c = cfg();
  const r = await api('GET', '/repos/' + c.repo + '/contents/' + encodeURIComponent(c.path) + '?ref=' + c.branch);
  if (r.status === 200 && r.json && r.json.content) {
    const content = Buffer.from(r.json.content, 'base64').toString('utf8');
    return { content, sha: r.json.sha };
  }
  return { content: null, sha: null }; // 404 = أول مرة
}

// اكتب المحتوى إلى GitHub (يحتاج sha الحالي إن كان الملف موجوداً). يعيد sha الجديد.
async function push(content, sha) {
  const c = cfg();
  const body = {
    message: 'تحديث بيانات شاشة المسجد - ' + new Date().toISOString(),
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: c.branch,
  };
  if (sha) body.sha = sha;
  const r = await api('PUT', '/repos/' + c.repo + '/contents/' + encodeURIComponent(c.path), body);
  if (r.status === 200 || r.status === 201) {
    return r.json && r.json.content && r.json.content.sha;
  }
  throw new Error('push failed: ' + r.status + ' ' + (r.json && r.json.message || ''));
}

module.exports = { enabled, pull, push };
