/* ============================================================================
   Скрытие заменяемых деталей базовой модели.

   Проблема: у разных файлов оружия детали называются по-разному, а в части
   моделей они вообще слиты в один меш по материалу. Поэтому скрытие работает
   двумя способами, которые дополняют друг друга:

     1) по имени/группе  — когда деталь существует отдельным мешем;
     2) по зоне (боксу)  — деталь вырезается из общего меша на уровне
        треугольников: всё, что попало в зону слота, помечается невидимым.

   Зона задаётся в системе координат оружия, в миллиметрах:
     { box:[x0,y0,z0,x1,y1,z1], when:'always'|'ifModule', slot:'handguard' }
   ========================================================================== */
module.exports = function () {

  /* Зоны для каждого оружия: что убрать, когда в слоте стоит модуль.
     Координаты получены обмером реальных моделей (tools/measure.js). */
  const ZONES = {
    ak74: {
      /* цевьё: нижняя и верхняя накладки между газблоком и коробкой */
      handguard: [{ box: [-26, 30, -500, 26, 118, -296] }],
      /* приклад: всё позади коробки */
      stock: [{ box: [-30, -20, 4, 30, 110, 300] }],
      /* дульное устройство: от резьбы вперёд */
      muzzle: [{ box: [-16, 58, -722, 16, 92, -634] }],
      /* магазин живёт в своей группе — убираем целиком */
      mag: [{ group: 'magazine' }],
      /* штатная крышка коробки заменяется крышкой с планкой */
      mount: [{ box: [-21, 96, -258, 21, 126, 16] }]
    },
    akm: {
      handguard: [{ box: [-26, 28, -478, 26, 124, -285] }],
      stock: [{ box: [-30, -30, 30, 30, 100, 300] }],
      muzzle: [{ box: [-16, 58, -670, 16, 92, -638] }],
      mag: [{ group: 'magazine' }],
      mount: [{ box: [-21, 92, -250, 21, 124, 20] }]
    },
    m416: {
      /* Штатные механические прицелы стоят на планке (ось 138 мм) и
         перекрывают любой установленный прицел — при установке оптики
         они «складываются», то есть убираются. */
      optic: [
        { box: [-16, 106, -230, 16, 150, -160] },   // целик
        { box: [-16, 106, -30, 16, 150, 40] }       // мушка на газблоке/планке
      ],
      /* Штатное цевьё: труба вокруг ствола и планка над ней. Зона не должна
         задевать сам ствол (Ø~20 у оси 70) и газблок, поэтому вырезаем
         только «скорлупу»: два боковых и верхний объёмы. */
      handguard: [
        { box: [-30, 84, -400, 30, 110, -40] },    // верхняя планка цевья
        { box: [-30, 40, -400, -12, 100, -40] },   // левая стенка
        { box: [12, 40, -400, 30, 100, -40] },     // правая стенка
        { box: [-30, 40, -400, 30, 58, -40] }      // низ
      ],
      stock: [{ box: [-34, -10, 0, 34, 116, 300] }],
      muzzle: [{ box: [-16, 54, -575, 16, 88, -518] }],
      mag: [{ group: 'magazine' }]
    },
    scarh: {
      handguard: [{ box: [-30, -30, -330, 30, 40, -60] }],
      stock: [{ box: [-40, -60, 0, 40, 60, 320] }],
      muzzle: [{ box: [-18, -20, -505, 18, 20, -425] }],
      mag: [{ group: 'magazine' }]
    },
    mp5a3: {
      handguard: [{ box: [-28, -34, -215, 28, 34, -70] }],
      stock: [{ box: [-36, -40, 60, 36, 60, 340] }],
      muzzle: [{ box: [-16, -18, -260, 16, 18, -225] }],
      mag: [{ group: 'magazine' }]
    },
    svd: { muzzle: [{ box: [-18, -20, -600, 18, 20, -545] }] },
    remington870: { muzzle: [{ box: [-18, -20, -505, 18, 20, -455] }] },
    glock18c: { muzzle: [{ box: [-14, -16, -125, 14, 16, -108] }] }
  };

  /* Проверка: попадает ли точка в зону (с допуском). */
  const inBox = (b, x, y, z, eps) => {
    const e = eps || 0;
    return x >= b[0] - e && x <= b[3] + e && y >= b[1] - e && y <= b[4] + e
      && z >= b[2] - e && z <= b[5] + e;
  };

  /* Активные зоны для текущей конфигурации: слот занят → его зона включается. */
  function activeZones(weaponKey, config) {
    const table = ZONES[weaponKey] || {};
    const out = [];
    for (const slot in table) {
      const mod = config[slot];
      if (!mod) continue;                        // модуль не установлен — базовая деталь остаётся
      for (const z of table[slot]) out.push(Object.assign({ slot }, z));
    }
    return out;
  }

  /* Вырезание треугольников меша, попавших в зоны.
     Работает с BufferGeometry three.js: помечает вершины «схлопнутыми»
     (все три в одну точку), поэтому треугольник исчезает без перестройки
     индексов. Исходные координаты сохраняются, чтобы вернуть деталь. */
  function carveGeometry(THREE, mesh, zones, matrixToWeapon) {
    const geo = mesh.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) return 0;
    const pos = geo.attributes.position;
    if (!mesh.userData.__origPos) mesh.userData.__origPos = pos.array.slice();
    const orig = mesh.userData.__origPos;
    const arr = pos.array;
    arr.set(orig);
    if (!zones.length) { pos.needsUpdate = true; return 0; }

    const v = new THREE.Vector3();
    let cut = 0;
    const n = arr.length / 9;                    // треугольников (неиндексированная геометрия)
    for (let t = 0; t < n; t++) {
      const o = t * 9;
      let inside = 0;
      for (let k = 0; k < 3; k++) {
        v.set(orig[o + k * 3], orig[o + k * 3 + 1], orig[o + k * 3 + 2]);
        if (matrixToWeapon) v.applyMatrix4(matrixToWeapon);
        const x = v.x * 1000, y = v.y * 1000, z = v.z * 1000;
        for (const zn of zones) if (inBox(zn.box, x, y, z, 1.5)) { inside++; break; }
      }
      /* треугольник убираем, если он целиком внутри зоны */
      if (inside === 3) {
        for (let k = 1; k < 3; k++) {
          arr[o + k * 3] = arr[o];
          arr[o + k * 3 + 1] = arr[o + 1];
          arr[o + k * 3 + 2] = arr[o + 2];
        }
        cut++;
      }
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
    return cut;
  }

  /* Индексированная геометрия (у некоторых моделей): убираем индексы. */
  function carveIndexed(THREE, mesh, zones, matrixToWeapon) {
    const geo = mesh.geometry;
    const idx = geo.index;
    if (!idx) return carveGeometry(THREE, mesh, zones, matrixToWeapon);
    if (!mesh.userData.__origIdx) mesh.userData.__origIdx = idx.array.slice();
    const orig = mesh.userData.__origIdx;
    const arr = idx.array;
    arr.set(orig);
    if (!zones.length) { idx.needsUpdate = true; return 0; }
    const pos = geo.attributes.position.array;
    const v = new THREE.Vector3();
    let cut = 0;
    for (let t = 0; t < orig.length / 3; t++) {
      let inside = 0;
      for (let k = 0; k < 3; k++) {
        const vi = orig[t * 3 + k] * 3;
        v.set(pos[vi], pos[vi + 1], pos[vi + 2]);
        if (matrixToWeapon) v.applyMatrix4(matrixToWeapon);
        for (const zn of zones) if (inBox(zn.box, v.x * 1000, v.y * 1000, v.z * 1000, 1.5)) { inside++; break; }
      }
      if (inside === 3) {
        arr[t * 3] = arr[t * 3 + 1] = arr[t * 3 + 2] = orig[t * 3];
        cut++;
      }
    }
    idx.needsUpdate = true;
    return cut;
  }

  /* Главная функция: применить скрытие ко всей базовой модели. */
  function apply(THREE, host, weaponKey, config, opts) {
    const O = Object.assign({ names: {}, groups: {} }, opts || {});
    const zones = activeZones(weaponKey, config);
    const byGroup = {};
    for (const z of zones) if (z.group) (byGroup[z.group] = byGroup[z.group] || []).push(z);

    host.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(host.matrixWorld).invert();
    let cutTotal = 0, hidden = 0;

    /* Сначала вернуть всё, что скрывали раньше: снятие модуля возвращает
       базовую деталь на место. */
    host.traverse((o) => {
      if (o.isMesh && o.userData && o.userData.__occHidden && !(o.userData.attachModule)) {
        o.visible = true;
        o.userData.__occHidden = false;
      }
    });

    host.traverse((o) => {
      if (o.userData && o.userData.attachModule) return;   // сами модули не трогаем

      /* Группа-носитель (например «magazine») содержит и базовый магазин,
         и модуль: скрываем в ней только базовые меши, иначе исчезнет и модуль. */
      if (!o.isMesh && o.name && byGroup[o.name]) {
        o.traverse((c) => {
          if (c.isMesh && !(c.userData && c.userData.attachModule)) {
            c.visible = false; c.userData.__occHidden = true; hidden++;
          }
        });
        return;
      }

      if (!o.isMesh) return;
      /* точечное скрытие по имени детали */
      const byName = O.names[o.name];
      if (byName && config[byName]) { o.visible = false; o.userData.__occHidden = true; hidden++; return; }

      /* геометрическое вырезание по зонам */
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const own = zones.filter((z) => !z.group && z.box);
      cutTotal += o.geometry && o.geometry.index
        ? carveIndexed(THREE, o, own, m)
        : carveGeometry(THREE, o, own, m);
    });

    return { zones: zones.length, cut: cutTotal, hidden };
  }

  return { ZONES, activeZones, apply, carveGeometry, carveIndexed };
};
