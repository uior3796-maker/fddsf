#!/usr/bin/env node
/* ============================================================================
   Проверки системы кастомизации без браузера:
     1) каждый модуль строится и не даёт вырожденной геометрии;
     2) любая допустимая комбинация собирается на каждом оружии;
     3) характеристики меняются в ожидаемую сторону;
     4) пресеты сохраняются и восстанавливаются без потерь;
     5) собранный бандл исполняется автономно.
   ========================================================================== */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

const G = require(path.join(ROOT, 'src/kernel.js'));
const C = require(path.join(ROOT, 'src/attach/common.js'))(G);
const SYS = require(path.join(ROOT, 'src/attach/system.js'))(G, C);
const CATS = [
  require(path.join(ROOT, 'src/attach/optics.js'))(G, C),
  require(path.join(ROOT, 'src/attach/muzzle.js'))(G, C),
  require(path.join(ROOT, 'src/attach/tactical.js'))(G, C),
  require(path.join(ROOT, 'src/attach/mags_stocks.js'))(G, C)
];
const REG = SYS.registry(CATS);
const WEAPONS = require(path.join(ROOT, 'src/weapons/slots.js'));

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  ✗ ' + msg); } };
const finite = (geo) => {
  const b = G.bounds(geo);
  return b.min.concat(b.max).every((v) => isFinite(v));
};

console.log('1. Геометрия модулей');
for (const key of REG.keys()) {
  const built = REG.build(key);
  ok(built.parts.length > 0, key + ': пустой модуль');
  ok(!!built.meta.slot, key + ': не указан тип слота');
  ok(typeof built.meta.name === 'string', key + ': нет названия');
  let tris = 0;
  for (const p of built.parts) {
    ok(finite(p.geo), key + '/' + p.name + ': NaN в координатах');
    ok(!!C.MATS[p.mat], key + '/' + p.name + ': неизвестный материал ' + p.mat);
    tris += p.geo.p.length / 9;
  }
  ok(tris > 100, key + ': подозрительно мало треугольников (' + tris + ')');
}
console.log('   модулей: ' + REG.keys().length);

console.log('2. Сборки на оружии');
let combos = 0;
for (const wk in WEAPONS) {
  const d = WEAPONS[wk];
  const weapon = { caliber: d.caliber, weight: d.weight, ballistics: d.ballistics,
    stats: {}, base: [], nodes: {}, slots: d.slots };
  for (const slot of d.slots) {
    for (const key of REG.keys()) {
      const meta = REG.meta(key);
      if ((slot.accepts || [slot.key]).indexOf(meta.slot) < 0) continue;
      const cfg = Object.assign({}, d.defaults);
      cfg[slot.key] = key;
      const a = SYS.assemble(weapon, REG, cfg);
      combos++;
      ok(a.errors.length === 0, wk + '/' + slot.key + '/' + key + ': ' + a.errors.join('; '));
      for (const p of a.parts) ok(finite(p.geo), wk + '/' + key + '/' + p.name + ': NaN после установки');
    }
  }
}
console.log('   комбинаций: ' + combos);

console.log('3. Влияние модулей на характеристики');
{
  const d = WEAPONS.ak74;
  const weapon = { caliber: d.caliber, weight: d.weight, ballistics: d.ballistics,
    stats: {}, base: [], nodes: {}, slots: d.slots };
  const bare = SYS.assemble(weapon, REG, Object.assign({}, d.defaults, { muzzle: 'thread_cap' }));
  const brake = SYS.assemble(weapon, REG, Object.assign({}, d.defaults, { muzzle: 'brake_ak' }));
  const supp = SYS.assemble(weapon, REG, Object.assign({}, d.defaults, { muzzle: 'suppressor_qd' }));
  ok(brake.derived.vertRecoil < bare.derived.vertRecoil, 'ДТК должен снижать подброс');
  ok(supp.derived.loudness < bare.derived.loudness, 'Глушитель должен снижать громкость');
  ok(supp.derived.flashVisible < bare.derived.flashVisible, 'Глушитель должен прятать вспышку');
  ok(supp.derived.adsTime > bare.derived.adsTime, 'Глушитель должен замедлять вскидку');

  /* На АК прицел ставится через кронштейн: сначала крышка с планкой,
     затем в её дочерний слот — оптика. */
  const noOptic = SYS.assemble(weapon, REG, Object.assign({}, d.defaults, { mount: null }));
  const scoped = SYS.assemble(weapon, REG, Object.assign({}, d.defaults,
    { mount: 'mount_dustcover', 'mount.top': 'scope_1_6x' }));
  ok(!!scoped.modules['mount.top'], 'Кронштейн должен давать слот под прицел');
  ok(scoped.derived.adsTime > noOptic.derived.adsTime, 'Кратный прицел должен замедлять вскидку');
  ok(scoped.derived.precision > noOptic.derived.precision, 'Прицел должен повышать точность');
  ok(!!scoped.nodes.eye, 'Прицел должен задавать точку глаза');
  ok(!!scoped.activeOptic, 'Прицел должен становиться активным');

  /* Прицел без кронштейна на АК поставить нельзя — слота просто нет. */
  const noMount = SYS.assemble(weapon, REG, Object.assign({}, d.defaults, { mount: null }));
  ok(!noMount.modules['mount.top'], 'Без кронштейна слота под прицел быть не должно');

  const drum = SYS.assemble(weapon, REG, Object.assign({}, d.defaults, { mag: 'mag_drum_75' }));
  ok(drum.derived.magCap === 75, 'Барабан должен давать 75 патронов');
  ok(drum.derived.reloadTime > noOptic.derived.reloadTime, 'Барабан должен удлинять перезарядку');
  ok(drum.derived.mobility < noOptic.derived.mobility, 'Барабан должен снижать подвижность');

  const light = SYS.assemble(weapon, REG, Object.assign({}, d.defaults,
    { optic: 'holo_exps3', handguard: 'handguard_mlok' }));
  const dyn = (light.slotsDynamic || []).map((s) => s.key);
  ok(dyn.length >= 3, 'Цевьё M-LOK должно добавлять слоты планок, получено: ' + dyn.join(','));
}

console.log('4. Несовместимости');
{
  const d = WEAPONS.scarh;
  const weapon = { caliber: d.caliber, weight: d.weight, ballistics: d.ballistics,
    stats: {}, base: [], nodes: {}, slots: d.slots };
  const wrong = SYS.assemble(weapon, REG, Object.assign({}, d.defaults, { mag: 'mag_pistol_17' }));
  ok(wrong.warnings.some((w) => /Магазин под/.test(w)), 'Должно предупреждать о чужом калибре');
  const strict = SYS.assemble(weapon, REG, Object.assign({}, d.defaults, { mag: 'mag_pistol_17' }), { strict: true });
  ok(strict.errors.length > 0, 'В строгом режиме чужой магазин — ошибка');
}

console.log('5. Пресеты');
{
  const codec = SYS.presetCodec();
  const cfg = { optic: 'holo_exps3', muzzle: 'suppressor_qd', mag: 'mag_ak_45', stock: null };
  const back = codec.decode(codec.encode(cfg));
  ok(back.optic === 'holo_exps3' && back.muzzle === 'suppressor_qd' && back.mag === 'mag_ak_45',
    'Пресет должен восстанавливаться без потерь');
  ok(back.stock === undefined, 'Пустые слоты не сохраняются');
}

console.log('6. Бандл');
{
  const file = path.join(ROOT, 'dist_bundle.js');
  if (fs.existsSync(file)) {
    const A = new Function(fs.readFileSync(file, 'utf8') + ';return __ATTACH;')();
    ok(A.REG.keys().length === REG.keys().length, 'Бандл должен содержать все модули');
    ok(Object.keys(A.SLOTS).length === Object.keys(WEAPONS).length, 'Бандл должен содержать все оружия');
    ok(typeof A.ADAPTER.build === 'function' && typeof A.RAW.convert === 'function', 'Адаптеры должны быть в бандле');
  } else ok(false, 'Бандл не собран: запустите node tools/build.js');
}

console.log('\n' + (fails ? '✗ провалено ' + fails + ' из ' + checks : '✓ все ' + checks + ' проверок пройдены'));
process.exit(fails ? 1 : 0);
