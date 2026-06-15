/*
 * التحديثات التلقائية عبر GitHub Releases (electron-updater).
 * تعمل فقط داخل النسخة المبنيّة من Electron؛ وفي غير ذلك تُعطَّل بهدوء.
 * يُمرَّر الكائن الناتج إلى الخادم ليتحكّم به من اللوحة:
 *   التحقق من التحديثات، تثبيتها، ومتابعة الحالة.
 */
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch (e) { /* غير متوفرة في وضع التطوير/standalone */ }

function createUpdater(opts) {
  opts = opts || {};

  const status = {
    available: !!autoUpdater,
    currentVersion: opts.currentVersion || null,
    state: 'idle',     // idle | checking | not-available | downloading | downloaded | error
    version: null,     // الإصدار المتاح للتحديث
    progress: 0,       // نسبة التنزيل
    error: null,
  };

  if (autoUpdater) {
    autoUpdater.autoDownload = true;            // نزّل التحديث تلقائياً عند توفّره
    autoUpdater.autoInstallOnAppQuit = true;    // ثبّته عند إغلاق التطبيق
    autoUpdater.on('checking-for-update', () => { status.state = 'checking'; status.error = null; });
    autoUpdater.on('update-available', (info) => { status.state = 'downloading'; status.version = info && info.version; status.progress = 0; });
    autoUpdater.on('update-not-available', () => { status.state = 'not-available'; });
    autoUpdater.on('download-progress', (p) => { status.state = 'downloading'; status.progress = Math.round((p && p.percent) || 0); });
    autoUpdater.on('update-downloaded', (info) => { status.state = 'downloaded'; status.version = info && info.version; status.progress = 100; });
    autoUpdater.on('error', (e) => { status.state = 'error'; status.error = String((e && e.message) || e); });
  }

  function check() {
    if (!autoUpdater) return { ok: false, error: 'updater_unavailable' };
    try { autoUpdater.checkForUpdates(); return { ok: true }; }
    catch (e) { status.state = 'error'; status.error = String((e && e.message) || e); return { ok: false, error: status.error }; }
  }

  function install() {
    if (!autoUpdater) return { ok: false, error: 'updater_unavailable' };
    if (status.state !== 'downloaded') return { ok: false, error: 'not_ready' };
    setTimeout(() => { try { autoUpdater.quitAndInstall(); } catch (e) {} }, 400);
    return { ok: true };
  }

  function getStatus() { return Object.assign({}, status); }

  return { available: !!autoUpdater, check, install, getStatus };
}

module.exports = { createUpdater };
