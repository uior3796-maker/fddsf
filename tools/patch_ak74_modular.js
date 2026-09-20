#!/usr/bin/env node
/* Интеграция системы кастомизации в BOX/ak74.html. Идемпотентно. */
const fs = require('fs');
const path = require('path');
const B = require('./build.js');

/* Итог кладём в ОТДЕЛЬНЫЙ файл, чтобы его было легко отличить от старого. */
const SRC_FILE = path.join(B.BOX, 'ak74.html');
const FILE = path.join(B.BOX, 'ak74_modular.html');
let src = fs.readFileSync(fs.existsSync(FILE) ? FILE : SRC_FILE, 'utf8');

/* --- 1. Бандл + интеграция вставляются перед функцией buildAK74 --- */
const block = B.bundle() + '\n' + B.integration('ak74', {
  /* детали, собираемые отдельными мешами — их проще скрыть по имени */
  hideByName: {
    muzzleBrake: 'muzzle',
    handguardLower: 'handguard', hgFerrule: 'handguard',
    handguardUpper: 'handguard', hgFerruleUp: 'handguard',
    stock: 'stock', buttPlate: 'stock', buttTrap: 'stock', slingLoop: 'stock',
    magBody: 'mag', magLugFront: 'mag', magLugRear: 'mag', magMouth: 'mag', magTopRound: 'mag',
    dustCover: 'mount'
  }
});
const BEG = '/* ATTACH:BEGIN ak74 */', END = '/* ATTACH:END ak74 */';
const payload = BEG + '\n' + block + '\n' + END;

const i = src.indexOf(BEG), j = src.indexOf(END);
if (i >= 0 && j > i) {
  src = src.slice(0, i) + payload + src.slice(j + END.length);
} else {
  const anchor = '/* ================== СБОРКА THREE-ОБЪЕКТА';
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error('не найдена точка вставки бандла');
  src = src.slice(0, at) + payload + '\n\n' + src.slice(at);
}

/* --- 2. Базовые детали: убрать те, что теперь дают модули --- */
const MARK = '/* ATTACH: детали, заменённые модулями */';
if (src.indexOf(MARK) < 0) {
  const from = `  const M = __AKM.model(G, H,
    [__AKM.p_receiver, __AKM.p_barrel, __AKM.p_furn, __AKM.p_mag, __AKM.p_intern],
    { furniture: opts.furniture || 'wood' });`;
  const to = `  const M = __AKM.model(G, H,
    [__AKM.p_receiver, __AKM.p_barrel, __AKM.p_furn, __AKM.p_mag, __AKM.p_intern],
    { furniture: opts.furniture || 'wood' });

  ${MARK}
  /* Дульный тормоз, цевьё, приклад и магазин приходят из системы модулей,
     поэтому одноимённые детали базовой модели исключаются из сборки. */
  if (opts.dropParts && opts.dropParts.length) {
    const drop = new Set(opts.dropParts);
    M.parts = M.parts.filter((p) => !drop.has(p.name));
    M.meshes = (function () {
      const buckets = {}, order = [];
      const GRP = {
        magBody: 'magazine', magLugFront: 'magazine', magLugRear: 'magazine',
        magMouth: 'magazine', magTopRound: 'magazine',
        boltCarrier: 'bolt', bolt: 'bolt', charging: 'bolt',
        trigger: 'trigger', selector: 'selector'
      };
      for (const p of M.parts) {
        const grp = GRP[p.name] || 'body', key = grp + '|' + p.mat;
        if (!buckets[key]) { buckets[key] = { group: grp, mat: p.mat, list: [] }; order.push(key); }
        buckets[key].list.push(p.geo);
      }
      return order.map((k) => ({ name: k, group: buckets[k].group, mat: buckets[k].mat,
        geo: G.merge(buckets[k].list) }));
    })();
  }`;
  if (src.indexOf(from) < 0) throw new Error('не найден вызов __AKM.model');
  src = src.replace(from, to);
}

/* --- 3. Подключение системы к сцене --- */
const HOOK = '/* ATTACH: подключение системы модулей */';
if (src.indexOf(HOOK) < 0) {
  const from = `  const gun = buildAK74(THREE, {});
  tiltRig.add(gun);
  const N = gun.nodes, P = gun.parts;`;
  const to = `  ${HOOK}
  /* Базовая модель строится целиком: съёмные узлы скрываются системой
     зон только тогда, когда в соответствующий слот поставлен модуль.
     Благодаря этому снятие модуля возвращает штатную деталь на место. */
  const gun = buildAK74(THREE, {});
  tiltRig.add(gun);
  const N = gun.nodes, P = gun.parts;

  /* Слоты магазина крутятся вместе с анимируемой группой магазина. */
  const ATTACH_PARENT = (slotKey) => (slotKey === 'mag' ? P.magazine : null);
  let ATTACH_ASM = attachRebuildAK();

  function attachRebuildAK() {
    if (ATTACH_STATE.view) {
      ATTACH_STATE.view.root.parent && ATTACH_STATE.view.root.parent.remove(ATTACH_STATE.view.root);
      ATTACH_STATE.view.dispose();
    }
    const weapon = {
      caliber: ATTACH_DEF.caliber, weight: ATTACH_DEF.weight,
      ballistics: ATTACH_DEF.ballistics, stats: {}, base: [],
      nodes: {}, slots: attachSlots()
    };
    const asm = __ATTACH.SYS.assemble(weapon, __ATTACH.REG, ATTACH_STATE.config);
    const view = __ATTACH.ADAPTER.build(THREE, asm, { scale: 0.001, parentFor: ATTACH_PARENT });
    view.root.traverse((o) => { o.userData.attachModule = true; });
    gun.add(view.root);
    ATTACH_STATE.asm = asm;
    ATTACH_STATE.view = view;
    attachOcclude(THREE, gun);
    view.setBeam('light', ATTACH_STATE.toggles.light);
    view.setBeam('laser', ATTACH_STATE.toggles.laser);
    view.setBeam('ir', ATTACH_STATE.toggles.ir);
    for (const k in ATTACH_STATE.toggles.deploy) view.setDeploy(k, ATTACH_STATE.toggles.deploy[k]);
    return asm;
  }`;
  if (src.indexOf(from) < 0) throw new Error('не найдено подключение gun');
  src = src.replace(from, to);
}

/* --- 4. Узлы вспышки/прицела берутся из сборки --- */
const HOOK2 = '/* ATTACH: узлы от модулей */';
if (src.indexOf(HOOK2) < 0) {
  const from = `  const muzzleRig = new THREE.Object3D();
  muzzleRig.position.copy(N.muzzle.position);`;
  const to = `  const muzzleRig = new THREE.Object3D();
  ${HOOK2}
  /* Точка вспышки — срез установленного дульного устройства. */
  const attachSyncMuzzle = () => {
    const v = ATTACH_ASM && ATTACH_ASM.nodes.muzzle;
    if (v) muzzleRig.position.set(v[0] * 0.001, v[1] * 0.001, v[2] * 0.001);
    else muzzleRig.position.copy(N.muzzle.position);
  };
  attachSyncMuzzle();`;
  if (src.indexOf(from) < 0) throw new Error('не найден muzzleRig');
  src = src.replace(from, to);
}

/* --- 5. ADS-камера: ось активного прицела --- */
const HOOK3 = '/* ATTACH: ось прицеливания */';
if (src.indexOf(HOOK3) < 0) {
  const from = `  adsAnchor.position.set(0, mm(117.6), mm(-44));`;
  const to = `  ${HOOK3}
  /* Глаз стрелка встаёт на ось активного прицела; без оптики — механика. */
  const attachSyncSight = () => {
    const a = ATTACH_ASM && ATTACH_ASM.activeOptic;
    if (a && ATTACH_ASM.nodes.eye) {
      const e = ATTACH_ASM.nodes.eye;
      adsAnchor.position.set(e[0] * 0.001, e[1] * 0.001, e[2] * 0.001);
    } else {
      adsAnchor.position.set(0, mm(117.6), mm(-44));
    }
  };
  attachSyncSight();`;
  if (src.indexOf(from) < 0) throw new Error('не найден adsAnchor');
  src = src.replace(from, to);
}

/* --- 6. Интерфейс и горячие клавиши --- */
const HOOK4 = '/* ATTACH: интерфейс */';
if (src.indexOf(HOOK4) < 0) {
  const from = `  /* ================= цикл ================= */
  setAmmo(MAG);`;
  const to = `  ${HOOK4}
  const attachApply = ATTACH_STATE.apply = (slotKey, moduleKey) => {
    ATTACH_STATE.ui && ATTACH_STATE.ui.markStats();
    ATTACH_STATE.config[slotKey] = moduleKey;
    ATTACH_ASM = attachRebuildAK();
    attachSyncMuzzle();
    attachSyncSight();
    attachSyncAmmo();
    ATTACH_STATE.ui && ATTACH_STATE.ui.render();
  };
  const attachSyncAmmo = () => {
    const cap = (ATTACH_ASM && ATTACH_ASM.derived.magCap) || MAG;
    magCap = cap;
    if (ammo > cap) setAmmo(cap);
    const cell = document.querySelector('#hud i');
    if (cell) cell.textContent = '5,45×39 · МАГАЗИН ' + cap;
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
  window.__MEASURE_HOST = gun; window.__MEASURE_THREE = THREE;
  window.__ATTACH_DEBUG = () => ({
    magGroup: (function () {
      const g = ATTACH_STATE.view.slots.mag;
      if (!g) return 'нет группы mag';
      const box = new THREE.Box3().setFromObject(g);
      return { parent: g.parent && g.parent.name, children: g.children.length,
        visible: g.visible, min: box.min.toArray(), max: box.max.toArray() };
    })(),
    config: ATTACH_STATE.config,
    modules: Object.keys(ATTACH_ASM.modules),
    parts: ATTACH_ASM.parts.length,
    errors: ATTACH_ASM.errors, warnings: ATTACH_ASM.warnings,
    children: ATTACH_STATE.view.root.children.map((c) => c.name + ':' + c.children.length),
    rootParent: ATTACH_STATE.view.root.parent && ATTACH_STATE.view.root.parent.name,
    nodes: ATTACH_ASM.nodes
  });
  attachBindKeys(attachApply);
  attachSyncAmmo();

  /* ================= цикл ================= */
  setAmmo(MAG);`;
  if (src.indexOf(from) < 0) throw new Error('не найден старт цикла');
  src = src.replace(from, to);
}

/* --- 7. Ёмкость магазина зависит от модуля --- */
if (src.indexOf('let magCap = MAG;') < 0) {
  src = src.replace(`  let ammo = MAG;`, `  let ammo = MAG;
  let magCap = MAG;                       // ATTACH: реальная ёмкость от модуля`);
  src = src.split('setAmmo(MAG);').join('setAmmo(magCap);');
  src = src.replace(/ammo >= MAG/g, 'ammo >= magCap');
  src = src.replace(/setAmmo\(MAG\)/g, 'setAmmo(magCap)');
}

fs.writeFileSync(FILE, src);
console.log('BOX/ak74_modular.html собран:', src.length, 'символов');
