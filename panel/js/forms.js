/* بناء عناصر التحكم وتعبئة النماذج من الإعدادات الحالية. */
(function () {
  'use strict';
  const el = App.el;

  // عنصر زيادة/إنقاص رقمي
  App.stepper = function (value, onChange) {
    const wrap = document.createElement('div'); wrap.className = 'stepper';
    const dec = document.createElement('button'); dec.textContent = '−';
    const inp = document.createElement('input'); inp.className = 'num'; inp.type = 'number'; inp.value = value;
    const inc = document.createElement('button'); inc.textContent = '+';
    dec.onclick = () => { inp.value = (+inp.value - 1); onChange(+inp.value); };
    inc.onclick = () => { inp.value = (+inp.value + 1); onChange(+inp.value); };
    inp.oninput = () => onChange(+inp.value || 0);
    wrap.append(dec, inp, inc);
    return wrap;
  };

  App.renderForms = function () {
    const cfg = App.cfg, stepper = App.stepper;

    // الهوية
    el('mName').value = cfg.mosque.name || '';
    el('orientation').value = cfg.orientation || 'landscape';
    el('theme').value = (cfg.display && cfg.display.theme) || 'night';

    // إزاحات الأوقات
    const adj = el('adjRows'); adj.innerHTML = '';
    App.PRAYERS.forEach(([k, ar]) => {
      const row = document.createElement('div'); row.className = 'row';
      const lbl = document.createElement('label'); lbl.textContent = ar;
      row.appendChild(lbl);
      row.appendChild(stepper(cfg.timeAdjust[k] || 0, v => cfg.timeAdjust[k] = v));
      adj.appendChild(row);
    });
    el('hijriStep').appendChild(stepper(cfg.hijriDayOffset || 0, v => cfg.hijriDayOffset = v));
    el('ramStep').appendChild(stepper(cfg.ramadanIshaOffset || 0, v => cfg.ramadanIshaOffset = v));

    // الإقامة
    const iq = el('iqamaRows'); iq.innerHTML = '';
    App.IQAMA_P.forEach(([k, ar]) => {
      const row = document.createElement('div'); row.className = 'row';
      const lbl = document.createElement('label'); lbl.textContent = ar;
      row.appendChild(lbl);
      row.appendChild(stepper(cfg.iqamaGap[k] != null ? cfg.iqamaGap[k] : 0, v => cfg.iqamaGap[k] = v));
      iq.appendChild(row);
    });
    el('cdEnabled').checked = cfg.iqamaCountdown.enabled;
    el('ltShow').checked = cfg.lastThird.show;
    el('toneEnabled').checked = cfg.tone.enabled;
    el('toneVol').value = cfg.tone.volume;
    el('silenceSec').value = cfg.iqamaMode.returnSilenceSec;

    // تحكم مباشر
    const live = el('liveCtl'); live.innerHTML = '';
    App.IQAMA_P.forEach(([k, ar]) => {
      const pill = document.createElement('div'); pill.className = 'prayer-pill';
      pill.innerHTML = `<b>${ar}</b>`;
      const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = 'بدء الإقامة';
      b.onclick = () => App.cmd('start_iqama', k);
      pill.appendChild(b); live.appendChild(pill);
    });

    // الأذكار
    el('adhMode').value = cfg.adhkar.mode;
    el('adhSec').value = cfg.adhkar.autosec;

    // الجنازة
    el('funActive').checked = cfg.funeral.active;
    el('funPrayer').value = cfg.funeral.prayer;
    el('funText').value = cfg.funeral.text || '';

    // المناسبات
    const occ = el('occRows'); occ.innerHTML = '';
    App.OCCASIONS.forEach(([k, ar]) => {
      const o = cfg.occasions[k] || { gap: 0, msg: '' };
      const box = document.createElement('div'); box.className = 'card'; box.style.background = 'var(--card2)';
      box.innerHTML = `<h2 style="font-size:14px">${ar}</h2>`;
      const r1 = document.createElement('div'); r1.className = 'row';
      r1.innerHTML = '<label>فجوة الإقامة (دقيقة)</label>';
      r1.appendChild(stepper(o.gap || 0, v => cfg.occasions[k].gap = v));
      const r2 = document.createElement('div'); r2.className = 'row'; r2.style.flexDirection = 'column'; r2.style.alignItems = 'stretch';
      const ta = document.createElement('textarea'); ta.rows = 2; ta.value = o.msg || ''; ta.placeholder = 'رسالة المناسبة';
      ta.oninput = () => cfg.occasions[k].msg = ta.value;
      r2.innerHTML = '<label style="margin-bottom:6px">الرسالة</label>'; r2.appendChild(ta);
      box.append(r1, r2); occ.appendChild(box);
    });
  };
})();
