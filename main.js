/*
 * عملية Electron الرئيسية.
 * - يشغّل الخادم المدمج (لوحة التحكم + البث).
 * - يفتح الشاشة في وضع عرض كامل (Kiosk).
 * - يدعم التشغيل التلقائي عند الإقلاع.
 */
const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { createServer } = require('./core/server');
const { createUpdater } = require('./updater');

const PORT = process.env.PORT || 3777;
let win = null;
let srv = null;

// منع التشغيل المزدوج
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function localIPs() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name in nets) {
    for (const ni of nets[name]) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

function createWindow() {
  const primary = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    width: primary.size.width,
    height: primary.size.height,
    fullscreen: true,
    kiosk: true,
    frame: false,
    backgroundColor: '#0a1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const ips = localIPs();
  win.loadURL(`http://127.0.0.1:${PORT}/display/index.html?ip=${encodeURIComponent(ips[0] || '127.0.0.1')}&port=${PORT}`);

  // ESC للخروج من وضع العرض (للصيانة)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'Escape') { win.setKiosk(false); win.setFullScreen(false); }
    if (input.key === 'F11') { win.setKiosk(true); win.setFullScreen(true); }
  });
}

app.whenReady().then(() => {
  // التحديثات التلقائية (عبر GitHub Releases)
  const updater = createUpdater({ currentVersion: app.getVersion() });

  srv = createServer({
    dbPath: path.join(app.getPath('userData'), 'masjid.db'),
    onRestart: () => { app.relaunch(); app.exit(0); },
    updater
  });
  srv.listen(PORT, () => {
    console.log(`[نظام المسجد] الخادم يعمل على المنفذ ${PORT}`);
    console.log('لوحة التحكم على الجوال:', localIPs().map(ip => `http://${ip}:${PORT}`).join('  '));
    createWindow();
  });

  // فحص تلقائي للتحديثات بعد الإقلاع (يفشل بهدوء دون إنترنت)
  setTimeout(() => { try { updater.check(); } catch (e) {} }, 12000);

  // التشغيل التلقائي عند بدء النظام
  app.setLoginItemSettings({ openAtLogin: true });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
