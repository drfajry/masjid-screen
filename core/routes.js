/*
 * مسارات الـ API للوحة التحكم.
 * تُسجَّل عبر registerRoutes(ctx) حيث ctx يوفّر ما تحتاجه المسارات:
 *   { app, db, broadcast, sessions, newToken, requireAuth, opts }
 */
function registerRoutes(ctx) {
  const { app, db, broadcast, sessions, newToken, requireAuth, opts, timeSync, gps, signal, updater } = ctx;

  // الإصدار الحالي من package.json (يعمل دائماً حتى بدون محدّث Electron)
  let APP_VERSION = '';
  try { APP_VERSION = require('../package.json').version; } catch (e) {}

  // ---------- المصادقة ----------
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const u = db.verifyUser(username, password);
    if (!u) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    const token = newToken();
    sessions.add(token);
    db.addLog(username, 'تسجيل دخول', 'لوحة التحكم');
    res.json({ token, user: u });
  });

  // ---------- الإعدادات ----------
  // قراءة الإعدادات متاحة دون مصادقة (الشاشة تحتاجها بلا حساب)
  app.get('/api/config', (req, res) => res.json(db.getConfig()));

  app.post('/api/config', requireAuth, (req, res) => {
    const user = req.body.__user || 'admin';
    const patch = req.body.patch || req.body;
    delete patch.__user;
    const cfg = db.patchConfig(patch, user);
    broadcast({ type: 'config', config: cfg });
    if (patch.timeSync && timeSync) timeSync.schedule(); // أعد الجدولة عند تغيير إعداد المزامنة
    if (patch.gps && gps) gps.start();                   // أعد تشغيل GPS عند تغيير إعداده
    if (patch.signal && signal) signal.start();          // أعد تشغيل مراقبة المكسر عند تغيير إعدادها
    res.json(cfg);
  });

  // رفع الشعار (data URL)
  app.post('/api/logo', requireAuth, (req, res) => {
    const { dataUrl, user } = req.body || {};
    const cfg = db.patchConfig({ mosque: { logo: dataUrl || null } }, user || 'admin');
    db.addLog(user, 'تغيير الشعار', 'هوية المسجد');
    broadcast({ type: 'config', config: cfg });
    res.json({ ok: true });
  });

  // ---------- أوامر حالة الشاشة (إقامة/أذكار/عودة/جنازة) ----------
  app.post('/api/command', requireAuth, (req, res) => {
    const { command, prayer, user } = req.body || {};
    db.addLog(user, 'أمر شاشة', command + (prayer ? ' / ' + prayer : ''));
    broadcast({ type: 'command', command, prayer });
    res.json({ ok: true });
  });

  // ---------- إعادة التشغيل ----------
  app.post('/api/system/restart', requireAuth, (req, res) => {
    db.addLog(req.body.user, 'إعادة تشغيل النظام');
    res.json({ ok: true });
    broadcast({ type: 'command', command: 'reload' });
    if (opts.onRestart) setTimeout(opts.onRestart, 400);
  });

  // ---------- مزامنة الوقت ----------
  app.post('/api/time/sync', requireAuth, async (req, res) => {
    if (!timeSync) return res.status(500).json({ ok: false });
    const r = await timeSync.syncNow();
    db.addLog(req.body.user, 'مزامنة الوقت', r.ok ? 'تلقائي ناجح' : 'فشل');
    res.json(r);
  });
  app.post('/api/time/manual', requireAuth, (req, res) => {
    if (!timeSync) return res.status(500).json({ ok: false });
    const r = timeSync.setManual(req.body.iso != null ? req.body.iso : req.body.ms);
    db.addLog(req.body.user, 'ضبط الوقت يدوياً', r.ok ? 'تم' : 'قيمة غير صالحة');
    res.json(r);
  });

  // ---------- جهاز GPS ----------
  app.get('/api/gps/status', requireAuth, (req, res) => {
    res.json(gps ? gps.getStatus() : { available: false });
  });
  app.get('/api/gps/ports', requireAuth, async (req, res) => {
    res.json(gps ? await gps.listPorts() : []);
  });
  app.post('/api/gps/scan', requireAuth, async (req, res) => {
    if (!gps) return res.status(500).json({ ok: false });
    const r = await gps.scan();
    db.addLog(req.body.user, 'فحص جهاز GPS', r.ok ? ('عُثر عليه: ' + r.port) : 'لم يُعثر عليه');
    res.json(r);
  });

  // ---------- مراقبة إشارة المكسر ----------
  // مفتوحة على الشبكة المحلية ليستطيع جهاز خارجي (Arduino/ESP) إرسال الحالة
  app.post('/api/signal', (req, res) => {
    if (signal) signal.report(!!(req.body && req.body.active), req.body && req.body.source);
    res.json({ ok: true });
  });
  app.post('/api/signal/ping', (req, res) => {
    if (signal) signal.ping(req.body && req.body.source);
    res.json({ ok: true });
  });
  app.get('/api/signal/status', requireAuth, (req, res) => {
    res.json(signal ? signal.getState() : { available: false });
  });

  // ---------- فحص الصحّة (للاستضافة السحابية) ----------
  app.get('/healthz', (req, res) => res.json({ ok: true, version: APP_VERSION }));

  // ---------- معلومات الشبكة (لعرض روابط الوصول في اللوحة) ----------
  app.get('/api/netinfo', (req, res) => {
    const os = require('os');
    const ips = [];
    const ifs = os.networkInterfaces();
    for (const name in ifs) {
      for (const ni of ifs[name]) {
        if (ni.family === 'IPv4' && !ni.internal) ips.push(ni.address);
      }
    }
    res.json({ ips, port: (req.socket && req.socket.localPort) || null });
  });

  // ---------- التحديثات التلقائية ----------
  app.get('/api/version', (req, res) => res.json({ version: APP_VERSION }));

  app.get('/api/update/status', requireAuth, (req, res) => {
    if (updater) {
      const s = updater.getStatus();
      if (!s.currentVersion) s.currentVersion = APP_VERSION;
      return res.json(s);
    }
    res.json({ available: false, currentVersion: APP_VERSION, state: 'idle' });
  });
  app.post('/api/update/check', requireAuth, (req, res) => {
    if (!updater) return res.json({ ok: false, error: 'updater_unavailable' });
    db.addLog(req.body.user, 'فحص التحديثات');
    res.json(updater.check());
  });
  app.post('/api/update/install', requireAuth, (req, res) => {
    if (!updater) return res.json({ ok: false, error: 'updater_unavailable' });
    db.addLog(req.body.user, 'تثبيت تحديث');
    res.json(updater.install());
  });

  // ---------- المستخدمون ----------
  app.get('/api/users', requireAuth, (req, res) => res.json(db.listUsers()));
  app.post('/api/users', requireAuth, (req, res) => {
    const { username, password, role, by } = req.body || {};
    try { db.addUser(username, password, role); db.addLog(by, 'إضافة مستخدم', username); res.json({ ok: true }); }
    catch (e) { res.status(400).json({ error: 'اسم المستخدم موجود' }); }
  });
  app.delete('/api/users/:username', requireAuth, (req, res) => {
    db.deleteUser(req.params.username);
    db.addLog(req.query.by, 'حذف مستخدم', req.params.username);
    res.json({ ok: true });
  });

  // ---------- السجل ----------
  app.get('/api/logs', requireAuth, (req, res) => {
    res.json(db.getLogs({ search: req.query.search, from: req.query.from, to: req.query.to, limit: 1000 }));
  });
  app.get('/api/logs/export', requireAuth, (req, res) => {
    const rows = db.getLogs({ limit: 100000 });
    const head = 'التاريخ,المستخدم,العملية,العنصر,القيمة القديمة,القيمة الجديدة\n';
    const csv = head + rows.map(r =>
      [r.ts, r.username, r.action, r.target, r.old_value, r.new_value]
        .map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="masjid-logs.csv"');
    res.send('\uFEFF' + csv); // BOM لدعم العربية في Excel
  });
}

module.exports = { registerRoutes };
