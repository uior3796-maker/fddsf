#!/usr/bin/env node
/* ============================================================================
   Универсальная интеграция системы кастомизации в three.js-файлы оружия.

   Для каждого файла задаётся рецепт: якорь вставки бандла, выражение группы
   оружия, куда добавить модули, и (опционально) синхронизация точки вспышки
   и оси прицеливания. Патч идемпотентен: повторный запуск переписывает блок.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const B = require('./build.js');

/* rec: { file, key, anchor, hostExpr, magExpr, after, muzzleSync, sightSync, drop } */
const RECIPES = [
  {
    file: 'akm.html', key: 'akm',
    anchor: 'function buildAKM(THREE, opts = {}) {',
    after: `\tconst akm = buildAKM(THREE, {})\n\trig.add(akm)`,
    hostExpr: 'akm', magExpr: 'akm.parts && akm.parts.magazine',
    muzzle: { find: '\tflash.position.copy(nodes.muzzle.position)', varName: 'flash' }
  },
  {
    file: 'm416.html', key: 'm416',
    anchor: 'function buildM416(THREE, opts = {}) {',
    after: `  gun = buildM416(THREE);\n  scene.add(gun);`,
    hostExpr: 'gun', magExpr: 'gun.parts && gun.parts.magazine'
  },
  {
    file: 'scar-h.html', key: 'scarh',
    anchor: 'function buildSCAR(THREE, opts = {}) {',
    after: `const gun = buildSCAR(THREE, {});`,
    hostExpr: 'gun', magExpr: 'gun.parts && gun.parts.magazine'
  },
  {
    file: 'mp5a3.html', key: 'mp5a3',
    anchor: 'function buildMP5() {',
    after: `weapon.add(toObject(modelRoot));`,
    hostExpr: 'weapon', magExpr: 'nodes && nodes.mag'
  }
];

function patchFile(rec) {
  const file = path.join(B.BOX, rec.file);
  let src = fs.readFileSync(file, 'utf8');
  const BEG = '/* ATTACH:BEGIN ' + rec.key + ' */', END = '/* ATTACH:END ' + rec.key + ' */';

  /* 1) бандл + интеграция */
  const block = B.bundle() + '\n' + B.integration(rec.key, {});
  const payload = BEG + '\n' + block + '\n' + END;
  const i = src.indexOf(BEG), j = src.indexOf(END);
  if (i >= 0 && j > i) src = src.slice(0, i) + payload + src.slice(j + END.length);
  else {
    const at = src.indexOf(rec.anchor);
    if (at < 0) throw new Error(rec.file + ': не найден якорь ' + rec.anchor);
    src = src.slice(0, at) + payload + '\n\n' + src.slice(at);
  }

  /* 2) подключение модулей к группе оружия */
  const HOOK = '/* ATTACH: подключение (' + rec.key + ') */';
  if (src.indexOf(HOOK) < 0) {
    const at = src.indexOf(rec.after);
    if (at < 0) throw new Error(rec.file + ': не найдена точка подключения');
    const ins = at + rec.after.length;
    const code = `

${HOOK}
const ATTACH_HOST = ${rec.hostExpr};
const ATTACH_MAGHOST = () => (${rec.magExpr}) || null;
let ATTACH_ASM = attachRebuildWeapon();

function attachRebuildWeapon() {
  if (ATTACH_STATE.view) {
    const r = ATTACH_STATE.view.root;
    if (r.parent) r.parent.remove(r);
    ATTACH_STATE.view.dispose();
  }
  const weapon = {
    caliber: ATTACH_DEF.caliber, weight: ATTACH_DEF.weight,
    ballistics: ATTACH_DEF.ballistics, stats: {}, base: [], nodes: {}, slots: attachSlots()
  };
  const asm = __ATTACH.SYS.assemble(weapon, __ATTACH.REG, ATTACH_STATE.config);
  const view = __ATTACH.ADAPTER.build(THREE, asm, {
    scale: 0.001,
    parentFor: (slotKey) => (slotKey === 'mag' ? ATTACH_MAGHOST() : null)
  });
  ATTACH_HOST.add(view.root);
  ATTACH_STATE.asm = asm;
  ATTACH_STATE.view = view;
  view.setBeam('light', ATTACH_STATE.toggles.light);
  view.setBeam('laser', ATTACH_STATE.toggles.laser);
  view.setBeam('ir', ATTACH_STATE.toggles.ir);
  for (const k in ATTACH_STATE.toggles.deploy) view.setDeploy(k, ATTACH_STATE.toggles.deploy[k]);
  return asm;
}

const attachApply = ATTACH_STATE.apply = (slotKey, moduleKey) => {
  ATTACH_STATE.ui && ATTACH_STATE.ui.markStats();
  ATTACH_STATE.config[slotKey] = moduleKey;
  ATTACH_ASM = attachRebuildWeapon();
  if (typeof attachOnRebuild === 'function') attachOnRebuild(ATTACH_ASM);
  ATTACH_STATE.ui && ATTACH_STATE.ui.render();
};

ATTACH_STATE.ui = createCustomizer({
  getConfig: () => ATTACH_STATE.config,
  getSlots: () => attachSlots(),
  getStats: () => (ATTACH_ASM ? ATTACH_ASM.derived : {}),
  getWarnings: () => (ATTACH_ASM ? ATTACH_ASM.warnings : []),
  optionsFor: attachOptionsFor,
  nameOf: attachNameOf,
  setModule: attachApply
});
ATTACH_STATE.ui.render();
ATTACH_STATE.ui.toggle(false);
attachBindKeys(attachApply);
window.__ATTACH_DEBUG = () => ({
  weapon: ${JSON.stringify(rec.key)},
  config: ATTACH_STATE.config,
  modules: Object.keys(ATTACH_ASM.modules),
  parts: ATTACH_ASM.parts.length,
  errors: ATTACH_ASM.errors, warnings: ATTACH_ASM.warnings,
  stats: ATTACH_ASM.derived
});
`;
    src = src.slice(0, ins) + code + src.slice(ins);
  }

  fs.writeFileSync(file, src);
  return src.length;
}

const only = process.argv.slice(2);
for (const rec of RECIPES) {
  if (only.length && only.indexOf(rec.key) < 0) continue;
  try {
    const n = patchFile(rec);
    console.log('✓', rec.file, n, 'символов');
  } catch (e) {
    console.log('✗', rec.file, e.message);
  }
}
