/*
 * طبقة قاعدة البيانات — محرّك تخزين JSON نقي (بدون أي مكتبات أصلية / بدون بناء C++).
 * يخزّن كل شيء في ملف JSON واحد على القرص: الإعدادات، الشعار، المستخدمون، السجلات.
 * مناسب لأجهزة المساجد (Mini PC) التي لا تملك أدوات تطوير. الكتابة ذرّية (ملف مؤقت ثم استبدال).
 * نفس واجهة الإصدار السابق تماماً، فلا يتأثّر باقي النظام.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DEFAULT_CONFIG } = require('./config-defaults');

function sha256(text, salt) {
  return crypto.createHash('sha256').update(salt + ':' + text).digest('hex');
}

function deepMerge(target, source) {
  for (const k in source) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      target[k] = deepMerge(target[k] && typeof target[k] === 'object' ? target[k] : {}, source[k]);
    } else {
      target[k] = source[k];
    }
  }
  return target;
}

class DB {
  constructor(dbPath) {
    // نخزّن JSON؛ نستبدل امتداد .db بـ .json لتفادي الالتباس مع قواعد قديمة
    this.file = dbPath.replace(/\.db$/i, '') + '.json';
    const dir = path.dirname(this.file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this._load();
    this._init();
  }

  _load() {
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (e) {
      this.data = null;
    }
    if (!this.data || typeof this.data !== 'object') {
      this.data = { config: null, users: [], logs: [], seqUser: 0, seqLog: 0 };
    }
    this.data.users = this.data.users || [];
    this.data.logs = this.data.logs || [];
    this.data.seqUser = this.data.seqUser || 0;
    this.data.seqLog = this.data.seqLog || 0;
  }

  // كتابة ذرّية: ملف مؤقت ثم استبدال (يمنع التلف عند انقطاع الكهرباء)
  _save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }

  _init() {
    if (!this.data.config) {
      this.setConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
    } else {
      // دمج المفاتيح الجديدة على الإعدادات القديمة (ترقية آمنة)
      const merged = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), this.data.config);
      this.setConfig(merged);
    }
    // مستخدم افتراضي admin/admin
    if (this.data.users.length === 0) this.addUser('admin', 'admin', 'admin');
  }

  getConfig() {
    return this.data.config
      ? JSON.parse(JSON.stringify(this.data.config))
      : JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  setConfig(cfg) {
    this.data.config = cfg;
    this._save();
    return cfg;
  }

  // دمج جزئي + تسجيل التغييرات في السجل
  patchConfig(patch, username) {
    const before = this.getConfig();
    const after = deepMerge(JSON.parse(JSON.stringify(before)), patch);
    this.data.config = after;
    for (const k in patch) {
      this._pushLog(username, 'تعديل إعداد', k, JSON.stringify(before[k]), JSON.stringify(after[k]));
    }
    this._save();
    return after;
  }

  // ---- المستخدمون ----
  addUser(username, password, role) {
    if (this.data.users.some(u => u.username === username)) {
      throw new Error('اسم المستخدم موجود');
    }
    const salt = crypto.randomBytes(8).toString('hex');
    this.data.users.push({
      id: ++this.data.seqUser,
      username, salt, hash: sha256(password, salt),
      role: role || 'admin', created_at: new Date().toISOString()
    });
    this._save();
  }

  verifyUser(username, password) {
    const u = this.data.users.find(x => x.username === username);
    if (!u) return null;
    return sha256(password, u.salt) === u.hash ? { username: u.username, role: u.role } : null;
  }

  listUsers() {
    return this.data.users
      .slice()
      .sort((a, b) => a.id - b.id)
      .map(u => ({ id: u.id, username: u.username, role: u.role, created_at: u.created_at }));
  }

  deleteUser(username) {
    const n = this.data.users.length;
    this.data.users = this.data.users.filter(u => u.username !== username);
    this._save();
    return { changes: n - this.data.users.length };
  }

  // ---- السجل ----
  _pushLog(username, action, target, oldVal, newVal) {
    this.data.logs.push({
      id: ++this.data.seqLog,
      ts: new Date().toISOString(),
      username: username || 'النظام',
      action,
      target: target || null,
      old_value: oldVal || null,
      new_value: newVal || null
    });
    // حدّ أعلى لحجم السجل (نُبقي آخر 5000)
    if (this.data.logs.length > 5000) this.data.logs = this.data.logs.slice(-5000);
  }

  addLog(username, action, target, oldVal, newVal) {
    this._pushLog(username, action, target, oldVal, newVal);
    this._save();
  }

  getLogs(opts) {
    opts = opts || {};
    let rows = this.data.logs.slice();
    if (opts.search) {
      const s = String(opts.search).toLowerCase();
      rows = rows.filter(r =>
        (r.action && r.action.toLowerCase().includes(s)) ||
        (r.target && r.target.toLowerCase().includes(s)) ||
        (r.username && r.username.toLowerCase().includes(s)));
    }
    if (opts.from) rows = rows.filter(r => r.ts >= opts.from);
    if (opts.to)   rows = rows.filter(r => r.ts <= opts.to);
    rows.sort((a, b) => b.id - a.id); // الأحدث أولاً
    return rows.slice(0, opts.limit || 500);
  }
}

module.exports = { DB, DEFAULT_CONFIG };
