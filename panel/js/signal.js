/* لوحة مراقبة إشارة المكسر: الحالة الحيّة، المصدر (شبكة/تسلسلي)، والإعدادات. */
(function () {
  'use strict';
  const el = App.el;
  let pollTimer = null;

  function fmt(ts) { return ts ? new Date(ts).toLocaleTimeString('ar-SA', { hour12: true }) : '—'; }

  async function loadStatus() {
    let s;
    try { s = await App.api('GET', '/api/signal/status'); } catch (e) { return; }
    const box = el('sigState');
    if (s.active) { box.textContent = 'الإشارة نشطة (صلاة جارية)'; box.style.color = 'var(--teal)'; }
    else { box.textContent = 'لا توجد إشارة'; box.style.color = 'var(--muted)'; }
    el('sigSource').textContent = s.source || '—';
    el('sigLast').textContent = fmt(s.lastActiveAt);
    el('sigSerial').textContent = !s.available ? 'مكتبة المنفذ غير مثبّتة'
      : (s.connected ? 'متصل' : (s.error || 'غير متصل'));
  }

  function toggleSerialFields() {
    const isSerial = el('sigSourceSel').value === 'serial';
    el('sigSerialBox').style.display = isSerial ? '' : 'none';
    el('sigHttpBox').style.display = isSerial ? 'none' : '';
  }

  App.renderMixer = function () {
    const g = App.cfg.signal || {};
    const sr = g.serial || {};
    el('sigEnabled').checked = !!g.enabled;
    el('sigSourceSel').value = g.source || 'http';
    el('sigGrace').value = g.graceSec != null ? g.graceSec : 3;
    el('sigReturn').value = (App.cfg.iqamaMode && App.cfg.iqamaMode.returnSilenceSec) || 45;
    el('sigPort').value = sr.port || 'auto';
    el('sigBaud').value = sr.baud || 9600;
    el('sigQuery').value = sr.queryHex || '';
    el('sigByteIdx').value = sr.activeByteIndex || 0;
    el('sigMask').value = sr.activeMask != null ? sr.activeMask : 1;
    el('sigActiveHigh').checked = sr.activeHigh !== false;
    // عنوان نقطة الشبكة للجهاز الخارجي
    el('sigUrl').textContent = location.protocol + '//' + location.host + '/api/signal';
    toggleSerialFields();
    el('sigSourceSel').onchange = toggleSerialFields;
    loadStatus();
    clearInterval(pollTimer);
    pollTimer = setInterval(loadStatus, 2000);
  };

  App.stopMixerPoll = function () { clearInterval(pollTimer); };

  App.saveMixer = async function () {
    App.cfg = await App.api('POST', '/api/config', {
      patch: {
        iqamaMode: { returnSilenceSec: +el('sigReturn').value || 45 },
        signal: {
          enabled: el('sigEnabled').checked,
          source: el('sigSourceSel').value,
          graceSec: +el('sigGrace').value || 3,
          serial: {
            port: el('sigPort').value.trim() || 'auto',
            baud: +el('sigBaud').value || 9600,
            queryHex: el('sigQuery').value.trim(),
            activeByteIndex: +el('sigByteIdx').value || 0,
            activeMask: +el('sigMask').value || 1,
            activeHigh: el('sigActiveHigh').checked
          }
        }
      },
      __user: App.user
    });
    App.toast('تم حفظ إعدادات المراقبة');
    setTimeout(loadStatus, 500);
  };
})();
