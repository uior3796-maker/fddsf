#!/usr/bin/env node
/* ============================================================================
   Сборщик: внедряет систему кастомизации в HTML-файлы оружия.

   Что делает:
     1) собирает единый браузерный бандл (ядро геометрии + каталоги модулей +
        система слотов + адаптер three.js + интерфейс);
     2) вставляет бандл и код интеграции в каждый файл оружия между маркерами
        <!-- ATTACH:BEGIN --> … <!-- ATTACH:END -->, так что пересборка
        идемпотентна и не дублирует код.

   Запуск:  node tools/build.js [файл…]
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BOX = path.join(ROOT, 'BOX');

const read = (p) => fs.readFileSync(p, 'utf8');

/* --- собрать бандл: каждый CommonJS-модуль оборачивается в функцию --- */
function bundle() {
  const wrap = (name, code) =>
    `__def(${JSON.stringify(name)}, function (module, exports) {\n${code}\n});\n`;

  const parts = [];
  parts.push(`/* ============================================================================
   СИСТЕМА КАСТОМИЗАЦИИ — единый бандл (генерируется tools/build.js).
   Источники: src/kernel.js, src/attach/*.js, src/adapters/three_adapter.js
   Не редактируйте этот блок вручную: правьте исходники и пересоберите.
   ========================================================================== */
const __ATTACH = (function () {
  const __M = {};
  const __C = {};
  function __def(n, f) { __M[n] = f; }
  function __req(n) {
    if (__C[n]) return __C[n].exports;
    const m = { exports: {} };
    __C[n] = m;
    __M[n](m, m.exports);
    return m.exports;
  }
`);

  parts.push(wrap('kernel', read(path.join(SRC, 'kernel.js'))));
  for (const f of ['common', 'optics', 'muzzle', 'tactical', 'mags_stocks', 'system', 'occlude', 'ui'])
    parts.push(wrap(f, read(path.join(SRC, 'attach', f + '.js'))));
  parts.push(wrap('three_adapter', read(path.join(SRC, 'adapters', 'three_adapter.js'))));
  parts.push(wrap('raw_adapter', read(path.join(SRC, 'adapters', 'raw_adapter.js'))));
  parts.push(wrap('slots', read(path.join(SRC, 'weapons', 'slots.js'))));

  parts.push(`
  const G = __req('kernel');
  const C = __req('common')(G);
  const SYS = __req('system')(G, C);
  const CATALOGS = [
    __req('optics')(G, C), __req('muzzle')(G, C),
    __req('tactical')(G, C), __req('mags_stocks')(G, C)
  ];
  const REG = SYS.registry(CATALOGS);
  const ADAPTER = __req('three_adapter')(G, C);
  const RAW = __req('raw_adapter')(G, C);
  const OCC = __req('occlude')();
  const UI = __req('ui')();
  const SLOTS = __req('slots');
  return { G, C, SYS, REG, ADAPTER, RAW, OCC, UI, SLOTS, catalogs: CATALOGS };
})();
`);
  /* интерфейс живёт в глобальной области файла оружия */
  parts.push(__ATTACH_UI_SOURCE());
  return parts.join('\n');
}

function __ATTACH_UI_SOURCE() {
  const uiMod = require(path.join(SRC, 'attach', 'ui.js'))();
  return uiMod.source();
}

/* --- код интеграции: строит оружие, вешает управление --- */
function integration(weaponKey, o) {
  const opt = Object.assign({ buildFn: null, mount: 'gun', scale: 0.001 }, o || {});
  return `
/* ---- интеграция кастомизации для «${weaponKey}» ---- */
const ATTACH_DEF = __ATTACH.SLOTS[${JSON.stringify(weaponKey)}];
const ATTACH_STATE = {
  config: Object.assign({}, ATTACH_DEF.defaults),
  asm: null, view: null, ui: null,
  toggles: { light: 0, laser: 0, ir: 0, deploy: {} }
};
/* деталь базовой модели -> слот, который её заменяет (для точечного скрытия) */
const ATTACH_HIDE_BY_NAME = ${JSON.stringify(opt.hideByName || {})};

/* Список модулей, подходящих слоту (для интерфейса). */
function attachOptionsFor(slotKey) {
  const slot = attachSlots().find((s) => s.key === slotKey);
  if (!slot) return [];
  const accepts = slot.accepts || [slot.key];
  const out = [{ key: null, label: '— НЕТ —', fits: true }];
  for (const key of __ATTACH.REG.keys()) {
    let meta;
    try { meta = __ATTACH.REG.meta(key); } catch (e) { continue; }
    if (accepts.indexOf(meta.slot) < 0) continue;
    const fit = __ATTACH.SYS.checkFit(slot, Object.assign({ key }, meta),
      { caliber: ATTACH_DEF.caliber }, {});
    out.push({ key, label: meta.name, fits: fit.ok });
  }
  return out;
}

/* Слоты: статические из описания + динамические от цевья. */
function attachSlots() {
  const base = ATTACH_DEF.slots.slice();
  if (ATTACH_STATE.asm && ATTACH_STATE.asm.slotsDynamic)
    for (const d of ATTACH_STATE.asm.slotsDynamic)
      if (!base.some((b) => b.key === d.key)) base.push(d);
  return base;
}

function attachNameOf(key) {
  try { return __ATTACH.REG.meta(key).name; } catch (e) { return String(key); }
}

/* Пересборка: снять старую группу, собрать новую, вернуть узлы. */
function attachRebuild(THREE, parent, baseParts, weaponNodes) {
  if (ATTACH_STATE.view) {
    parent.remove(ATTACH_STATE.view.root);
    ATTACH_STATE.view.dispose();
  }
  const weapon = {
    caliber: ATTACH_DEF.caliber, weight: ATTACH_DEF.weight,
    ballistics: ATTACH_DEF.ballistics, stats: {},
    base: baseParts || [], nodes: weaponNodes || {}, slots: attachSlots()
  };
  const asm = __ATTACH.SYS.assemble(weapon, __ATTACH.REG, ATTACH_STATE.config);
  const view = __ATTACH.ADAPTER.build(THREE, asm, { scale: ${opt.scale} });
  parent.add(view.root);
  ATTACH_STATE.asm = asm;
  ATTACH_STATE.view = view;
  /* вернуть прежние состояния переключателей */
  view.setBeam('light', ATTACH_STATE.toggles.light);
  view.setBeam('laser', ATTACH_STATE.toggles.laser);
  view.setBeam('ir', ATTACH_STATE.toggles.ir);
  for (const k in ATTACH_STATE.toggles.deploy) view.setDeploy(k, ATTACH_STATE.toggles.deploy[k]);
  return asm;
}

/* Скрытие заменяемых деталей базовой модели: зоны включаются по конфигурации.
   Вызывается после каждой пересборки, поэтому снятие модуля возвращает
   исходную деталь на место. */
function attachOcclude(THREE, host) {
  if (!host) return null;
  return __ATTACH.OCC.apply(THREE, host, ${JSON.stringify(weaponKey)}, ATTACH_STATE.config, {
    names: ATTACH_HIDE_BY_NAME, groups: {}
  });
}

/* Публичный API: смена модулей из консоли, автотестов и внешнего интерфейса.
   Реальная функция подстановки регистрируется интеграцией оружия. */
window.ATTACH = {
  set(slotKey, moduleKey) {
    if (!ATTACH_STATE.apply) throw new Error('система ещё не готова');
    ATTACH_STATE.apply(slotKey, moduleKey);
    return window.__ATTACH_DEBUG();
  },
  get: () => Object.assign({}, ATTACH_STATE.config),
  slots: () => attachSlots().map((s) => s.key),
  options: (slotKey) => attachOptionsFor(slotKey),
  preset: {
    save: () => __ATTACH.SYS.presetCodec().encode(ATTACH_STATE.config),
    load(code) {
      const cfg = __ATTACH.SYS.presetCodec().decode(code);
      for (const k of attachSlots().map((s) => s.key))
        window.ATTACH.set(k, cfg[k] || null);
      return window.__ATTACH_DEBUG();
    }
  },
  beam: (kind, level) => ATTACH_STATE.view.setBeam(kind, level),
  deploy: (slotKey, t) => ATTACH_STATE.view.setDeploy(slotKey, t),
  stats: () => (ATTACH_STATE.asm ? ATTACH_STATE.asm.derived : {})
};

/* Отладочный хук: состояние сборки доступно из консоли и автотестов. */
window.__ATTACH_DEBUG = () => ({
  weapon: ${JSON.stringify(weaponKey)},
  config: ATTACH_STATE.config,
  modules: ATTACH_STATE.asm ? Object.keys(ATTACH_STATE.asm.modules) : [],
  parts: ATTACH_STATE.asm ? ATTACH_STATE.asm.parts.length : 0,
  errors: ATTACH_STATE.asm ? ATTACH_STATE.asm.errors : [],
  warnings: ATTACH_STATE.asm ? ATTACH_STATE.asm.warnings : [],
  stats: ATTACH_STATE.asm ? ATTACH_STATE.asm.derived : {}
});

/* Управление с клавиатуры: TAB — панель, цифры — слот, стрелки — перебор. */
function attachBindKeys(onChange) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const ui = ATTACH_STATE.ui;
    if (e.code === 'Tab') { e.preventDefault(); if (ui) ui.toggle(!ui.visible()); return; }
    if (e.code === 'KeyL') { ATTACH_STATE.toggles.light = ATTACH_STATE.toggles.light ? 0 : 1;
      ATTACH_STATE.view.setBeam('light', ATTACH_STATE.toggles.light); return; }
    if (e.code === 'KeyK') { ATTACH_STATE.toggles.laser = ATTACH_STATE.toggles.laser ? 0 : 1;
      ATTACH_STATE.view.setBeam('laser', ATTACH_STATE.toggles.laser); return; }
    if (e.code === 'KeyB') {
      for (const sk in ATTACH_STATE.asm.modules) {
        const m = ATTACH_STATE.asm.modules[sk];
        if (!(m.meta.deploy || m.meta.fold || m.meta.flipAxis)) continue;
        const cur = ATTACH_STATE.toggles.deploy[sk] || 0;
        const next = cur > 0.5 ? 0 : 1;
        ATTACH_STATE.toggles.deploy[sk] = next;
        ATTACH_STATE.view.setDeploy(sk, next);
      }
      return;
    }
    if (!ui || !ui.visible()) return;
    const slots = attachSlots();
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= slots.length) { ui.setActive(slots[n - 1].key); return; }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const act = ui.getActive();
      if (!act) return;
      e.preventDefault();
      const opts = attachOptionsFor(act).filter((o) => o.fits);
      const cur = ATTACH_STATE.config[act] || null;
      let i = opts.findIndex((o) => o.key === cur);
      if (i < 0) i = 0;
      i = (i + (e.code === 'ArrowRight' ? 1 : opts.length - 1)) % opts.length;
      onChange(act, opts[i].key);
      ui.render();
    }
  });
}
`;
}

/* --- вставка блока в HTML --- */
function inject(file, block, marker) {
  const src = read(file);
  const b = '/* ATTACH:BEGIN ' + marker + ' */';
  const e = '/* ATTACH:END ' + marker + ' */';
  const payload = b + '\n' + block + '\n' + e;
  const i = src.indexOf(b), j = src.indexOf(e);
  if (i >= 0 && j > i) return src.slice(0, i) + payload + src.slice(j + e.length);
  return null;   // вставку места определяет патчер конкретного файла
}

module.exports = { bundle, integration, inject, BOX, ROOT };

if (require.main === module) {
  const out = bundle();
  fs.writeFileSync(path.join(ROOT, 'dist_bundle.js'), out);
  console.log('бандл собран:', out.length, 'символов');
}
