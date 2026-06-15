/* لوحة جهاز GPS: عرض الحالة الحيّة، حفظ الإعدادات، الفحص التلقائي، واختيار المنفذ. */
(function () {
  'use strict';
  const el = App.el;
  let pollTimer = null;

  function fmt(d) { return d ? new Date(d).toLocaleString('ar-SA', { hour12: true }) : '—'; }

  async function loadStatus() {
    let s;
    try { s = await App.api('GET', '/api/gps/status'); } catch (e) { return; }
    if (!s.available) {
      el('gpsState').textContent = 'مكتبة GPS غير مثبّتة على هذا الجهاز';
      el('gpsState').style.color = 'var(--muted)';
    } else if (s.connected && s.fix) {
      el('gpsState').textContent = 'متصل — إشارة جيدة (' + (s.sats || 0) + ' قمر)';
      el('gpsState').style.color = 'var(--teal)';
    } else if (s.connected) {
      el('gpsState').textContent = 'متصل — بانتظار الإشارة…';
      el('gpsState').style.color = 'var(--gold)';
    } else {
      el('gpsState').textContent = s.error || 'غير متصل';
      el('gpsState').style.color = 'var(--muted)';
    }
    el('gpsCoords').textContent = (s.lat != null && s.lng != null)
      ? s.lat.toFixed(5) + ', ' + s.lng.toFixed(5) : '—';
    el('gpsSats').textContent = s.sats != null ? s.sats : '—';
    el('gpsPort').textContent = s.port || '—';
    el('gpsLastFix').textContent = fmt(s.lastFix);
  }

  async function loadPorts() {
    let ports = [];
    try { ports = await App.api('GET', '/api/gps/ports'); } catch (e) {}
    const sel = el('gpsPortSel');
    const cur = App.cfg.gps && App.cfg.gps.port || 'auto';
    sel.innerHTML = '<option value="auto">كشف تلقائي</option>' +
      ports.map(p => `<option value="${p.path}">${p.path}${p.manufacturer ? ' — ' + p.manufacturer : ''}</option>`).join('');
    sel.value = cur;
  }

  App.renderGps = function () {
    const g = App.cfg.gps || {};
    el('gpsEnabled').checked = !!g.enabled;
    el('gpsAutoLoc').checked = g.autoLocation !== false;
    el('gpsAutoTime').checked = g.autoTime !== false;
    el('gpsBaud').value = g.baud || 9600;
    loadPorts();
    loadStatus();
    clearInterval(pollTimer);
    pollTimer = setInterval(loadStatus, 2000); // تحديث حيّ للحالة كل ثانيتين
  };

  // أوقف الاستطلاع عند مغادرة التبويب (يستدعيه التبويب عند التبديل)
  App.stopGpsPoll = function () { clearInterval(pollTimer); };

  App.saveGps = async function () {
    App.cfg = await App.api('POST', '/api/config', {
      patch: { gps: {
        enabled: el('gpsEnabled').checked,
        autoLocation: el('gpsAutoLoc').checked,
        autoTime: el('gpsAutoTime').checked,
        port: el('gpsPortSel').value,
        baud: +el('gpsBaud').value || 9600
      } },
      __user: App.user
    });
    App.toast('تم حفظ إعدادات GPS');
    setTimeout(loadStatus, 500);
  };

  App.gpsScan = async function () {
    App.toast('جارٍ البحث عن الجهاز…');
    const r = await App.api('POST', '/api/gps/scan', { user: App.user });
    await loadPorts();
    await loadStatus();
    App.toast(r && r.ok ? ('تم العثور على الجهاز: ' + r.port) : 'لم يُعثر على جهاز GPS', !(r && r.ok));
  };
})();
