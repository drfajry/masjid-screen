/*
 * الخادم المدمج — Express + WebSocket
 * يخدم لوحة التحكم (الجوال/المتصفح) ويبث التحديثات للشاشة فوراً.
 * يعمل داخل Electron وأيضاً كعملية Node مستقلة.
 * المسارات نفسها معرّفة في routes.js لتسهيل التعديل.
 */
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const { DB } = require('./db');
const { registerRoutes } = require('./routes');
const { createTimeSync } = require('./timesync');
const { createGps } = require('./gps');
const { createSignal } = require('./signal');

function createServer(opts) {
  opts = opts || {};
  const dbPath = opts.dbPath || path.join(__dirname, '..', 'data', 'masjid.db');
  const db = new DB(dbPath);

  const app = express();
  app.use(express.json({ limit: '8mb' })); // يكفي لرفع الشعار كـ base64

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // جلسات بسيطة في الذاكرة (شبكة محلية)
  const sessions = new Set();
  function newToken() { return crypto.randomBytes(16).toString('hex'); }
  function authed(req) {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    return sessions.has(t);
  }
  function requireAuth(req, res, next) {
    if (authed(req)) return next();
    res.status(401).json({ error: 'غير مصرّح' });
  }

  // بثّ لكل الشاشات المتصلة
  function broadcast(msg) {
    const data = JSON.stringify(msg);
    wss.clients.forEach((c) => { if (c.readyState === 1) c.send(data); });
  }

  // أرسل الإعدادات الحالية فور اتصال أي شاشة
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'config', config: db.getConfig() }));
  });

  // مزامنة الوقت
  const timeSync = createTimeSync({ db, broadcast });

  // جهاز GPS (اختياري)
  const gps = createGps({ db, broadcast, timeSync });

  // مراقبة إشارة المكسر (اختياري)
  const signal = createSignal({ db, broadcast });

  // تسجيل مسارات الـ API
  registerRoutes({ app, db, broadcast, sessions, newToken, requireAuth, opts, timeSync, gps, signal, updater: opts.updater });

  // بدء جدولة المزامنة التلقائية + محاولة تشغيل GPS إن كان مفعّلاً
  timeSync.schedule();
  gps.start();
  signal.start();

  // ---------- الملفات الثابتة ----------
  app.use('/vendor', express.static(path.join(__dirname, '..', 'vendor')));
  app.use('/core', express.static(path.join(__dirname, '..', 'core')));
  app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
  app.use('/display', express.static(path.join(__dirname, '..', 'display')));
  app.use('/', express.static(path.join(__dirname, '..', 'panel'))); // لوحة التحكم على الجذر

  return { app, server, wss, db, broadcast, timeSync, gps, signal, listen: (port, cb) => server.listen(port, '0.0.0.0', cb) };
}

module.exports = { createServer };
