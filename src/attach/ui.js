/* ============================================================================
   Интерфейс кастомизации: список слотов, карусель модулей, панель
   характеристик со стрелками +/− (в духе экрана модификации из Bodycam).
   Интерфейс намеренно простой — вся глубина в моделях и в системе слотов.
   ========================================================================== */
module.exports = function () {
  const CSS = `
#cust{position:fixed;left:0;right:0;bottom:0;z-index:20;font:500 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8eaed;pointer-events:none;letter-spacing:.06em}
#cust.hidden{display:none}
#custSlots{display:flex;gap:6px;justify-content:center;padding:0 10px 10px;flex-wrap:wrap;pointer-events:auto}
.cslot{min-width:104px;border:1px solid rgba(255,255,255,.16);background:rgba(12,14,17,.72);backdrop-filter:blur(12px);padding:7px 10px;cursor:pointer;transition:border-color .15s,background .15s}
.cslot:hover{background:rgba(26,30,36,.82)}
.cslot.on{border-color:#e8b45c;background:rgba(232,180,92,.16)}
.cslot .k{font-size:9.5px;color:rgba(255,255,255,.42);text-transform:uppercase}
.cslot .v{font-size:12px;color:#fff;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}
#custList{display:flex;gap:6px;justify-content:center;padding:0 10px 8px;flex-wrap:wrap;pointer-events:auto}
.copt{border:1px solid rgba(255,255,255,.14);background:rgba(12,14,17,.66);padding:6px 11px;cursor:pointer;font-size:11.5px}
.copt:hover{background:rgba(26,30,36,.8)}
.copt.sel{border-color:#e8b45c;color:#ffd79a;background:rgba(232,180,92,.14)}
.copt.bad{opacity:.42;border-style:dashed}
#custStats{position:fixed;left:18px;top:86px;z-index:20;font:500 11px/1.7 ui-monospace,Menlo,monospace;pointer-events:none;min-width:190px}
.cstat{display:flex;justify-content:space-between;gap:14px;padding:1px 7px;background:rgba(10,12,15,.55);border-left:2px solid rgba(255,255,255,.16)}
.cstat.up{border-left-color:#6fcf7f;color:#a9e6b3}
.cstat.dn{border-left-color:#e07a6a;color:#efa99b}
.cstat b{font-weight:600}
#custHint{text-align:center;padding-bottom:9px;color:rgba(255,255,255,.34);font-size:10.5px}
#custWarn{text-align:center;color:#e6b07a;font-size:10.5px;padding-bottom:5px;min-height:14px}
`;

  /* Подписи и порядок показа характеристик. up=true — больше значит лучше. */
  const STAT_DEFS = [
    { k: 'vertRecoil', label: 'Подброс', up: false, fmt: (v) => v.toFixed(2) },
    { k: 'horizRecoil', label: 'Увод', up: false, fmt: (v) => v.toFixed(2) },
    { k: 'hipSpread', label: 'Разброс от бедра', up: false, fmt: (v) => v.toFixed(2) },
    { k: 'adsTime', label: 'Вскидка, с', up: false, fmt: (v) => v.toFixed(3) },
    { k: 'mobility', label: 'Подвижность', up: true, fmt: (v) => v.toFixed(0) },
    { k: 'reloadTime', label: 'Перезарядка, с', up: false, fmt: (v) => v.toFixed(2) },
    { k: 'muzzleVelocity', label: 'Скорость, м/с', up: true, fmt: (v) => v.toFixed(0) },
    { k: 'effectiveRange', label: 'Дальность, м', up: true, fmt: (v) => v.toFixed(0) },
    { k: 'loudness', label: 'Громкость', up: false, fmt: (v) => v.toFixed(0) },
    { k: 'flashVisible', label: 'Заметность вспышки', up: false, fmt: (v) => v.toFixed(0) },
    { k: 'weight', label: 'Масса, г', up: false, fmt: (v) => v.toFixed(0) },
    { k: 'magCap', label: 'Ёмкость', up: true, fmt: (v) => v.toFixed(0) }
  ];

  /* Возвращает исходник браузерного модуля интерфейса (строкой). */
  function source() {
    return `
/* --- интерфейс кастомизации (генерируется src/attach/ui.js) --- */
const CUST_CSS = ${JSON.stringify(CSS)};
const STAT_DEFS = ${JSON.stringify(STAT_DEFS.map((s) => ({ k: s.k, label: s.label, up: s.up, d: s.k === 'vertRecoil' || s.k === 'horizRecoil' || s.k === 'hipSpread' ? 2 : (s.k === 'adsTime' || s.k === 'reloadTime' ? 3 : 0) })))};

function createCustomizer(opts) {
  const style = document.createElement('style');
  style.textContent = CUST_CSS;
  document.head.appendChild(style);

  const host = document.createElement('div'); host.id = 'cust';
  const warn = document.createElement('div'); warn.id = 'custWarn';
  const list = document.createElement('div'); list.id = 'custList';
  const slots = document.createElement('div'); slots.id = 'custSlots';
  const hint = document.createElement('div'); hint.id = 'custHint';
  hint.textContent = 'TAB — кастомизация · ← → выбор модуля · 1…9 слот · B — сошки/приклад · L — фонарь · K — ЛЦУ';
  host.append(warn, list, slots, hint);
  document.body.appendChild(host);

  const statBox = document.createElement('div'); statBox.id = 'custStats';
  document.body.appendChild(statBox);

  let active = null, prevStats = null;

  function render() {
    const cfg = opts.getConfig(), defs = opts.getSlots();
    slots.innerHTML = '';
    for (const s of defs) {
      const el = document.createElement('div');
      el.className = 'cslot' + (active === s.key ? ' on' : '');
      const cur = cfg[s.key];
      el.innerHTML = '<div class="k">' + s.label + '</div><div class="v">' +
        (cur ? opts.nameOf(cur) : '—') + '</div>';
      el.onclick = () => { active = s.key; render(); };
      slots.appendChild(el);
    }
    list.innerHTML = '';
    if (active) {
      const slot = defs.find((s) => s.key === active);
      const options = opts.optionsFor(active);
      for (const o of options) {
        const el = document.createElement('div');
        el.className = 'copt' + (cfg[active] === o.key ? ' sel' : '') + (o.fits === false ? ' bad' : '');
        el.textContent = o.label;
        el.onclick = () => { opts.setModule(active, o.key); render(); };
        list.appendChild(el);
      }
    }
    const st = opts.getStats();
    statBox.innerHTML = '';
    for (const d of STAT_DEFS) {
      if (st[d.k] === undefined) continue;
      const v = st[d.k], pv = prevStats ? prevStats[d.k] : v;
      let cls = 'cstat';
      if (pv !== undefined && Math.abs(v - pv) > 1e-6) cls += ((v > pv) === d.up) ? ' up' : ' dn';
      const row = document.createElement('div');
      row.className = cls;
      row.innerHTML = '<span>' + d.label + '</span><b>' + v.toFixed(d.d) + '</b>';
      statBox.appendChild(row);
    }
    const w = opts.getWarnings();
    warn.textContent = w && w.length ? w.join(' · ') : '';
  }

  return {
    render,
    markStats() { prevStats = Object.assign({}, opts.getStats()); },
    setActive(k) { active = k; render(); },
    getActive() { return active; },
    toggle(on) { host.classList.toggle('hidden', on === false); statBox.style.display = on === false ? 'none' : ''; },
    visible() { return !host.classList.contains('hidden'); }
  };
}
`;
  }

  return { CSS, STAT_DEFS, source };
};
