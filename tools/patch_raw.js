#!/usr/bin/env node
/* ============================================================================
   Интеграция системы кастомизации в файлы на «сыром» WebGL:
   СВД, Remington 870, Glock 18C. Эти движки рисуют свои меши сами, поэтому
   модули конвертируются raw-адаптером и добавляются в их списки отрисовки.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const B = require('./build.js');

const RECIPES = {
  svd: {
    file: 'svd.html', key: 'svd', anchor: 'function buildAll() {',
    /* СВД считает в метрах, геометрия системы — в мм */
    scale: 0.001, fmt: 'pnti', engine: 'svd',
    hook: {
      find: `  buildSVD(addRifle, N);\n  buildSVD2(addRifle, N);`,
      code: `  buildSVD(addRifle, N);
  buildSVD2(addRifle, N);
  /* ATTACH: детали модулей идут в те же узлы, что и базовая винтовка */
  attachBuildModules(function (mesh, mat, nodeName, opt) {
    return addRifle(mesh, mat, nodeName === 'mag' ? N.mag : N.body, opt);
  });`
    }
  },
  remington870: {
    file: 'remington870.html', key: 'remington870', anchor: 'function buildWeapon() {',
    scale: 0.001, fmt: 'posTri', engine: 'rem',
    hook: {
      find: `  var W = buildWeapon();`,
      code: `  var W = buildWeapon();
  /* ATTACH: модули добавляются как обычные детали оружия */
  attachBuildModules(W);`
    }
  },
  glock18c: {
    file: 'glock18c.html', key: 'glock18c', anchor: 'function buildGlock() {',
    scale: 1, fmt: 'pni', engine: 'glock',
    hook: {
      find: `  const parts = buildGlock();`,
      code: `  const parts = buildGlock();
  /* ATTACH: детали модулей — с теми же узлами анимации */
  attachBuildModules(parts);`
    }
  }
};

/* Код, общий для «сырых» движков: сборка конфигурации и конвертация. */
function rawGlue(rec) {
  return `
/* ---- мост системы модулей к движку «${rec.key}» ---- */
const ATTACH_RAW = __ATTACH.RAW;
const ATTACH_SCALE = ${rec.scale};

function attachAssemble() {
  const weapon = {
    caliber: ATTACH_DEF.caliber, weight: ATTACH_DEF.weight,
    ballistics: ATTACH_DEF.ballistics, stats: {}, base: [], nodes: {}, slots: attachSlots()
  };
  const asm = __ATTACH.SYS.assemble(weapon, __ATTACH.REG, ATTACH_STATE.config);
  ATTACH_STATE.asm = asm;
  return asm;
}

ATTACH_STATE.apply = function (slotKey, moduleKey) {
  ATTACH_STATE.ui && ATTACH_STATE.ui.markStats();
  ATTACH_STATE.config[slotKey] = moduleKey;
  if (typeof attachRebuildRaw === 'function') attachRebuildRaw();
  else attachAssemble();
  ATTACH_STATE.ui && ATTACH_STATE.ui.render();
};

function attachConvert() {
  const asm = ATTACH_STATE.asm || attachAssemble();
  return ATTACH_RAW.convert(asm, { fmt: ${JSON.stringify(rec.fmt)},
    engine: ${JSON.stringify(rec.engine)}, scale: ATTACH_SCALE });
}
`;
}

function glueFor(key) {
  if (key === 'svd') return `
/* СВД: add(mesh, mat, node, opt) — mat в формате Mat, узлы уже созданы. */
function attachBuildModules(add) {
  const parts = attachConvert();
  ATTACH_BATCHES.length = 0;
  for (const p of parts) {
    const m = new Mesh();
    m.p = p.mesh.p; m.n = p.mesh.n; m.t = p.mesh.t; m.e = p.mesh.e; m.i = p.mesh.i;
    const mat = new Mat({ base: p.mat.base, metal: p.mat.metal, rough: p.mat.rough,
      kind: p.mat.kind, wear: p.mat.wear, axis: p.mat.axis,
      opacity: p.glass ? 0.22 : 1, emis: p.mat.emis, aoStr: 1, name: p.matKey });
    const b = add(m, mat, p.slot === 'mag' ? 'mag' : 'body', {});
    if (b) ATTACH_BATCHES.push({ batch: b, slot: p.slot });
  }
}
const ATTACH_BATCHES = [];
/* Пересборка без перезапуска: прячем старые батчи и грузим новые. */
function attachRebuildRaw() {
  for (const e of ATTACH_BATCHES) e.batch.visible = false;
  attachAssemble();
  attachBuildModules(function (mesh, mat, nodeName, opt) {
    return R.addMesh(mesh, mat, nodeName === 'mag' ? NODES.mag : NODES.body,
      Object.assign({ tag: 'rifle' }, opt || {}));
  });
  return ATTACH_STATE.asm;
}
`;
  if (key === 'remington870') return `
/* Remington: W.parts — список {data, mat, node, gpu, world}. */
function attachBuildModules(W) {
  const parts = attachConvert();
  ATTACH_RAWPARTS.length = 0;
  for (const p of parts) {
    const me = { pos: p.mesh.pos, tri: p.mesh.tri, nrm: p.mesh.nrm };
    const d = finalizeMesh({ pos: me.pos, tri: me.tri }, 38);
    const rec = { data: d, mat: { base: p.mat.base, metal: p.mat.metal, rough: p.mat.rough,
      type: 0, ao: 1.0 }, node: W.root, gpu: null, world: W.root.world, attach: true, slot: p.slot };
    W.parts.push(rec);
    ATTACH_RAWPARTS.push(rec);
  }
}
const ATTACH_RAWPARTS = [];
`;
  if (key === 'glock18c') return `
/* Glock: parts — список {node, mat, mesh} до загрузки в VAO. */
function attachBuildModules(parts) {
  const mods = attachConvert();
  for (const p of mods) {
    parts.push({ node: p.slot === 'mag' ? 'mag' : (p.slot === 'optic' ? 'slide' : 'frame'),
      mat: { a: p.mat.a, m: p.mat.m, r: p.mat.r, cc: p.mat.cc, d: 0, mk: 0 },
      mesh: { p: p.mesh.p, n: p.mesh.n, i: p.mesh.i } });
  }
}
`;
  return '';
}

function patch(key) {
  const rec = RECIPES[key];
  const file = path.join(B.BOX, rec.file);
  let src = fs.readFileSync(file, 'utf8');
  const BEG = '/* ATTACH:BEGIN ' + rec.key + ' */', END = '/* ATTACH:END ' + rec.key + ' */';
  const block = B.bundle() + '\n' + B.integration(rec.key, {}) + '\n' + rawGlue(rec) + '\n' + glueFor(key);
  const payload = BEG + '\n' + block + '\n' + END;

  const i = src.indexOf(BEG), j = src.indexOf(END);
  if (i >= 0 && j > i) src = src.slice(0, i) + payload + src.slice(j + END.length);
  else {
    const at = src.indexOf(rec.anchor);
    if (at < 0) throw new Error(rec.file + ': нет якоря');
    src = src.slice(0, at) + payload + '\n\n' + src.slice(at);
  }

  if (src.indexOf('/* ATTACH: ') < 0 || src.indexOf(rec.hook.code.trim().split('\n').pop().trim()) < 0) {
    const at = src.indexOf(rec.hook.find);
    if (at < 0) throw new Error(rec.file + ': нет точки подключения');
    src = src.slice(0, at) + rec.hook.code + src.slice(at + rec.hook.find.length);
  }

  fs.writeFileSync(file, src);
  return src.length;
}

const only = process.argv.slice(2);
for (const k of Object.keys(RECIPES)) {
  if (only.length && only.indexOf(k) < 0) continue;
  try { console.log('✓', RECIPES[k].file, patch(k)); }
  catch (e) { console.log('✗', RECIPES[k].file, e.message); }
}
