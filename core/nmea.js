/*
 * محلّل جُمل NMEA 0183 الصادرة من أجهزة GPS.
 * يدعم جُمل الموقع/الوقت الأساسية: RMC (موقع + وقت + تاريخ) و GGA (جودة الإشارة + الأقمار).
 * يتعامل مع جميع معرّفات المتحدث: GP/GN/GL/GA/GB (GPS، GLONASS، Galileo، BeiDou...).
 * وحدة نقية بلا أي عتاد — قابلة للاختبار بالكامل.
 */

// حساب الـ checksum (XOR لكل ما بين $ و *)
function checksum(sentence) {
  let cs = 0;
  for (let i = 0; i < sentence.length; i++) cs ^= sentence.charCodeAt(i);
  return cs;
}

// التحقق من صحة سطر NMEA كامل: يبدأ بـ $ وينتهي بـ *XX صحيح
function validate(line) {
  if (typeof line !== 'string') return false;
  const s = line.trim();
  if (s[0] !== '$') return false;
  const star = s.indexOf('*');
  if (star < 0 || star + 3 > s.length) return false;
  const body = s.slice(1, star);
  const given = parseInt(s.slice(star + 1, star + 3), 16);
  if (isNaN(given)) return false;
  return checksum(body) === given;
}

// تحويل ddmm.mmmm (أو dddmm.mmmm) + الاتجاه إلى درجات عشرية
function parseCoord(raw, hemi) {
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot < 3) return null;               // يلزم دقيقتان قبل النقطة على الأقل
  const degEnd = dot - 2;                  // الدرجات = كل ما قبل آخر رقمين قبل النقطة
  const deg = parseInt(raw.slice(0, degEnd), 10);
  const min = parseFloat(raw.slice(degEnd));
  if (isNaN(deg) || isNaN(min)) return null;
  let val = deg + min / 60;
  if (hemi === 'S' || hemi === 'W') val = -val;
  return val;
}

// بناء وقت UTC بالمللي ثانية من حقلي الوقت (hhmmss.ss) والتاريخ (ddmmyy)
function parseUtc(timeStr, dateStr) {
  if (!timeStr || timeStr.length < 6 || !dateStr || dateStr.length < 6) return null;
  const hh = +timeStr.slice(0, 2), mi = +timeStr.slice(2, 4);
  const ssFull = parseFloat(timeStr.slice(4));
  const ss = Math.floor(ssFull), ms = Math.round((ssFull - ss) * 1000);
  const dd = +dateStr.slice(0, 2), mm = +dateStr.slice(2, 4), yy = +dateStr.slice(4, 6);
  if ([hh, mi, ss, dd, mm, yy].some(isNaN)) return null;
  const year = yy >= 80 ? 1900 + yy : 2000 + yy; // محور السنتين: 80-99 ⇒ 19xx، وإلا 20xx
  return Date.UTC(year, mm - 1, dd, hh, mi, ss, ms);
}

// تحليل سطر واحد. يعيد كائناً موصوفاً أو null لو لم يكن RMC/GGA صالحاً.
function parse(line) {
  if (!validate(line)) return null;
  const s = line.trim();
  const star = s.indexOf('*');
  const f = s.slice(1, star).split(',');
  const tag = f[0].slice(2); // أزل معرّف المتحدث (GP/GN/...)

  if (tag === 'RMC') {
    // $..RMC,time,status,lat,N,lon,E,speed,course,date,...
    const valid = f[2] === 'A';
    const lat = parseCoord(f[3], f[4]);
    const lng = parseCoord(f[5], f[6]);
    const timeMs = parseUtc(f[1], f[9]);
    return { type: 'RMC', valid, lat, lng, timeMs };
  }

  if (tag === 'GGA') {
    // $..GGA,time,lat,N,lon,E,fixQuality,numSats,...
    const fixQ = parseInt(f[6], 10);
    return {
      type: 'GGA',
      fix: !isNaN(fixQ) && fixQ > 0,
      sats: parseInt(f[7], 10) || 0,
      lat: parseCoord(f[2], f[3]),
      lng: parseCoord(f[4], f[5]),
    };
  }

  return null;
}

// هل السطر جملة GPS صالحة؟ (للتعرّف التلقائي على المنفذ)
function looksLikeGps(line) {
  if (typeof line !== 'string') return false;
  const s = line.trim();
  return /^\$G[PNLABS]/.test(s) && validate(s);
}

module.exports = { checksum, validate, parse, parseCoord, parseUtc, looksLikeGps };
