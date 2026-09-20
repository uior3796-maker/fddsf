/* ============================================================================
   Интерфейс кастомизации: список слотов, карусель модулей, панель
   характеристик со стрелками +/− (в духе экрана модификации из Bodycam).
   Интерфейс намеренно простой — вся глубина в моделях и в системе слотов.
   ========================================================================== */
module.exports = function () {
  const CSS = `
/* Панель кастомизации. Системный шрифт, широкие поля, никаких наложений:
   слоты — сетка фиксированной ширины, список модулей — горизонтальная лента
   с прокруткой, а не перенос в несколько рядов. */
#cust{position:fixed;left:0;right:0;bottom:0;z-index:20;pointer-events:none;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif}
#cust.hidden{display:none}
#cust *{box-sizing:border-box}

#custSlots{display:flex;gap:8px;justify-content:center;align-items:stretch;
  padding:10px 16px calc(14px + env(safe-area-inset-bottom));pointer-events:auto;
  overflow-x:auto;scrollbar-width:none}
#custSlots::-webkit-scrollbar{display:none}
.cslot{flex:0 0 auto;width:132px;min-height:54px;border:1px solid rgba(255,255,255,.14);
  border-radius:8px;background:rgba(14,16,19,.88);backdrop-filter:blur(14px);
  padding:8px 11px;cursor:pointer;transition:border-color .14s,background .14s;
  display:flex;flex-direction:column;justify-content:center;gap:4px}
.cslot:hover{background:rgba(30,34,40,.92);border-color:rgba(255,255,255,.26)}
.cslot.on{border-color:#e8b45c;background:rgba(232,180,92,.18)}
.cslot .k{font-size:10px;line-height:1.1;letter-spacing:.09em;text-transform:uppercase;
  color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cslot .v{font-size:13px;line-height:1.25;color:#fff;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.cslot.empty .v{color:rgba(255,255,255,.34)}

#custList{display:flex;gap:7px;justify-content:flex-start;padding:0 16px 10px;
  pointer-events:auto;overflow-x:auto;scrollbar-width:none;scroll-behavior:smooth}
#custList::-webkit-scrollbar{display:none}
#custList:empty{display:none}
.copt{flex:0 0 auto;border:1px solid rgba(255,255,255,.14);border-radius:7px;
  background:rgba(14,16,19,.86);padding:9px 14px;cursor:pointer;font-size:12.5px;
  line-height:1.2;color:#dfe3e8;white-space:nowrap;transition:background .14s,border-color .14s}
.copt:hover{background:rgba(32,36,42,.94)}
.copt.sel{border-color:#e8b45c;color:#ffd79a;background:rgba(232,180,92,.16)}
.copt.bad{opacity:.38;border-style:dashed;cursor:not-allowed}

#custStats{position:fixed;left:18px;top:84px;z-index:20;pointer-events:none;
  width:238px;display:flex;flex-direction:column;gap:2px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}
.cstat{display:flex;align-items:baseline;justify-content:space-between;gap:12px;
  padding:4px 10px;border-radius:5px;background:rgba(10,12,15,.78);
  border-left:2px solid rgba(255,255,255,.18);font-size:11.5px;line-height:1.35}
.cstat span{color:rgba(255,255,255,.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cstat b{font-weight:600;font-variant-numeric:tabular-nums;color:#f0f2f5;white-space:nowrap}
.cstat.up{border-left-color:#63c97a}
.cstat.up b{color:#96e6a6}
.cstat.dn{border-left-color:#e07a6a}
.cstat.dn b{color:#f0a598}
.cstat i{font-style:normal;font-size:10px;margin-left:5px;opacity:.85}

#custHint{text-align:center;padding:0 16px 10px;font-size:11px;line-height:1.5;
  color:rgba(255,255,255,.34);letter-spacing:.02em}
#custWarn{text-align:center;padding:0 16px 6px;font-size:11.5px;line-height:1.45;
  color:#e8b45c;min-height:16px}
@media (max-width:760px){
  .cslot{width:112px}
  #custStats{width:190px;top:70px;left:10px}
}
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
  hint.textContent = 'TAB — панель · 1…9 — слот · ← → — модуль · B — сошки/приклад · L — фонарь · K — ЛЦУ';
  host.append(warn, list, slots, hint);
  document.body.appendChild(host);

  const statBox = document.createElement('div'); statBox.id = 'custStats';
  document.body.appendChild(statBox);

  let active = null, prevStats = null, flash = {};

  function renderSlots(defs, cfg) {
    slots.innerHTML = '';
    defs.forEach((s, i) => {
      const cur = cfg[s.key];
      const el = document.createElement('div');
      el.className = 'cslot' + (active === s.key ? ' on' : '') + (cur ? '' : ' empty');
      const k = document.createElement('div'); k.className = 'k';
      k.textContent = (i < 9 ? (i + 1) + ' · ' : '') + s.label;
      const v = document.createElement('div'); v.className = 'v';
      v.textContent = cur ? opts.nameOf(cur) : '—';
      v.title = v.textContent;
      el.append(k, v);
      el.onclick = () => { active = s.key; render(); };
      slots.appendChild(el);
      if (active === s.key) requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'nearest', inline: 'center' });
      });
    });
  }

  function renderOptions(cfg) {
    list.innerHTML = '';
    if (!active) return;
    let selected = null;
    for (const o of opts.optionsFor(active)) {
      const el = document.createElement('div');
      const isSel = (cfg[active] || null) === o.key;
      el.className = 'copt' + (isSel ? ' sel' : '') + (o.fits === false ? ' bad' : '');
      el.textContent = o.label;
      el.title = o.fits === false ? 'Не подходит этому слоту' : o.label;
      el.onclick = () => { if (o.fits !== false) { opts.setModule(active, o.key); render(); } };
      list.appendChild(el);
      if (isSel) selected = el;
    }
    if (selected) requestAnimationFrame(() => {
      selected.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
  }

  function renderStats() {
    const st = opts.getStats();
    statBox.innerHTML = '';
    for (const d of STAT_DEFS) {
      if (st[d.k] === undefined) continue;
      const v = st[d.k], pv = prevStats ? prevStats[d.k] : undefined;
      const changed = pv !== undefined && Math.abs(v - pv) > 1e-6;
      let cls = 'cstat';
      if (changed) cls += ((v > pv) === d.up) ? ' up' : ' dn';
      const row = document.createElement('div');
      row.className = cls;
      const name = document.createElement('span'); name.textContent = d.label;
      const val = document.createElement('b');
      val.textContent = v.toFixed(d.d);
      if (changed) {
        const diff = document.createElement('i');
        const delta = v - pv;
        diff.textContent = (delta > 0 ? '▲' : '▼') + Math.abs(delta).toFixed(d.d);
        val.appendChild(diff);
      }
      row.append(name, val);
      statBox.appendChild(row);
    }
  }

  function render() {
    const cfg = opts.getConfig(), defs = opts.getSlots();
    if (active && !defs.some((s) => s.key === active)) active = null;
    renderSlots(defs, cfg);
    renderOptions(cfg);
    renderStats();
    const w = opts.getWarnings();
    warn.textContent = w && w.length ? w.join(' · ') : '';
  }

  return {
    render,
    markStats() { prevStats = Object.assign({}, opts.getStats()); },
    setActive(k) { active = k; render(); },
    getActive() { return active; },
    toggle(on) {
      const show = on !== false;
      host.classList.toggle('hidden', !show);
      statBox.style.display = show ? '' : 'none';
      if (show) render();
    },
    visible() { return !host.classList.contains('hidden'); }
  };
}
`;
  }

  return { CSS, STAT_DEFS, source };
};
