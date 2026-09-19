/* ============================================================================
   Дульные устройства: пламегасители, компенсаторы, ДТК, глушители.

   Посадка: начало координат — торец дульной резьбы, ось канала по (0,0),
   устройство растёт в −Z. Метаданные:
     tip        — вылет среза от посадки (мм, отрицательный), точка вспышки;
     flash      — множитель размера дульной вспышки (0 = скрыта);
     sound      — 'normal' | 'loud' | 'suppressed';
     gasPorts   — точки боковых струй газа [x,y,z,dx,dy,dz];
     stats      — влияние на отдачу/разброс/скорость.
   ========================================================================== */
module.exports = function (G, C) {
  const { PI, TAU, D } = C;
  const { tr, rx, ry, rz, merge, extrude, lathe, cyl, tube } = G;
  const { bag, boxC, boxZ, cylX, knurlBand, threadHelix, capScrew } = C;

  const OUT = {};

  /* Резьбовая муфта: внутренняя резьба + лыски под ключ. Общая для всех. */
  function threadMount(o) {
    const O = Object.assign({ rOut: 9.6, rIn: 7.0, len: 16, flats: true, mat: 'nitride' }, o || {});
    const P = bag();
    P.add('mount', O.mat, lathe([
      { r: O.rIn, z: -O.len }, { r: O.rOut, z: -O.len }, { r: O.rOut, z: -1.2, s: true },
      { r: O.rOut + 0.6, z: 0 }, { r: O.rIn, z: 0 }], 36, true));
    /* внутренняя резьба видна с торца */
    P.add('thread', 'steelDk', threadHelix(O.rIn + 0.55, O.rIn + 0.05, -O.len + 1, -1.5, 1.0, 22));
    if (O.flats) for (const s of [-1, 1])
      P.add('wrenchFlat', O.mat, boxC(s * (O.rOut - 0.45), 0, -O.len / 2, 1.2, O.rOut * 1.5, O.len - 3, 0.3, 0.2));
    return P.list;
  }

  /* ==================================================================
     1. Классический пламегаситель-«птичья клетка» A2: 5 прорезей
     ================================================================== */
  OUT.flash_a2 = function () {
    const P = bag();
    const R = 11.0, L = 50.0, rBore = 5.6;
    P.addAll(threadMount({ rOut: R - 0.4, rIn: 7.6, len: 14 }));

    /* тело: конус с расширением к срезу */
    P.add('body', 'nitride', lathe([
      { r: rBore, z: -L }, { r: R - 0.8, z: -L }, { r: R - 0.8, z: -L + 4, s: true },
      { r: R - 1.8, z: -L + 8, s: true }, { r: R - 1.6, z: -16, s: true },
      { r: R - 0.2, z: -14 }, { r: rBore, z: -14 }], 34, true));

    /* пять прорезей: сверху и по бокам, снизу глухо (не поднимает пыль) */
    for (let i = 0; i < 5; i++) {
      const a = D(-72 + i * 36);                 // веер в верхней полусфере
      const w = 2.9;
      for (const zc of [-L + 8, -L + 18, -L + 28]) {
        P.add('tine', 'nitride', tr(rz(boxC(0, R - 1.2, zc, w, 3.0, 8.0, 0.4, 0.15), a), 0, 0, 0));
      }
    }
    /* перемычки между прорезями: кольца жёсткости */
    for (const z of [-L + 13, -L + 23, -16.5])
      P.add('ring', 'nitride', tube(R - 2.2, R - 0.6, z - 1.3, z + 1.3, 34));
    P.add('bore', 'bore', tube(rBore - 0.15, rBore, -L, 0, 30));

    return { parts: P.list, meta: {
      slot: 'muzzle', name: 'Пламегаситель A2', short: 'A2', tip: -L,
      flash: 0.55, sound: 'normal', weight: 85,
      gasPorts: [[0, 7, -L + 20, 0.4, 0.9, -0.2], [0, -7, -L + 20, 0.2, -0.9, -0.2]],
      stats: { vertRecoil: -8, horizRecoil: -4, hipSpread: 0, adsSpeed: -1, sound: 0, flashHide: 70 } } };
  };

  /* ==================================================================
     2. Дульный тормоз-компенсатор с боковыми камерами (в духе АК-74)
     ================================================================== */
  OUT.brake_ak = function () {
    const P = bag();
    const R = 11.6, L = 82.0, rBore = 5.8;
    P.addAll(threadMount({ rOut: R - 1.2, rIn: 7.2, len: 18, mat: 'park' }));

    /* передняя камера с двумя большими боковыми окнами */
    P.add('chamberFront', 'park', G.perfShell({
      rOut: R, rIn: R - 2.2,
      thetas: (() => { const t = []; for (let i = 0; i <= 64; i++) t.push(i / 64 * TAU); return t; })(),
      zs: (() => { const z = []; for (let i = 0; i <= 16; i++) z.push(-L + i * (34 / 16)); return z; })(),
      hole: (th, z) => {
        const a = ((th % TAU) + TAU) % TAU;
        const side = (a > D(50) && a < D(130)) || (a > D(230) && a < D(310));
        return side && z > -L + 6 && z < -L + 28;
      }, capFront: true, capBack: false }));

    /* задняя камера: три круглых отверстия с каждой стороны */
    P.add('chamberRear', 'park', G.perfShell({
      rOut: R, rIn: R - 2.2,
      thetas: (() => { const t = []; for (let i = 0; i <= 72; i++) t.push(i / 72 * TAU); return t; })(),
      zs: (() => { const z = []; for (let i = 0; i <= 18; i++) z.push(-L + 34 + i * (30 / 18)); return z; })(),
      hole: (th, z) => {
        const a = ((th % TAU) + TAU) % TAU;
        for (let k = 0; k < 3; k++) {
          const zc = -L + 40 + k * 9;
          for (const ac of [D(90), D(270)]) {
            const da = Math.abs(((a - ac + PI) % TAU) - PI);
            if (da < D(17) && Math.abs(z - zc) < 3.2) return true;
          }
        }
        return false;
      }, capFront: false, capBack: false }));

    /* передний обод и косой срез компенсатора */
    P.add('crown', 'park', lathe([{ r: rBore, z: -L }, { r: R + 0.6, z: -L },
      { r: R + 0.6, z: -L + 3, s: true }, { r: R, z: -L + 5 }, { r: rBore, z: -L + 5 }], 40, true));
    /* перегородка между камерами */
    P.add('baffle', 'park', tr(tube(rBore + 0.6, R - 2.0, -1.6, 1.6, 34), 0, 0, -L + 34));
    /* нижняя перемычка (компенсатор не выбрасывает газ вниз) */
    P.add('strut', 'park', boxC(0, -(R - 1.2), -L + 17, 4.0, 2.6, 26, 0.5, 0.2));
    P.add('bore', 'bore', tube(rBore - 0.15, rBore, -L, 0, 30));
    for (const s of [-1, 1])
      P.add('pinDetent', 'steel', tr(cylX(1.5, 1.5, s * (R - 2.4), s * (R + 0.4), 12), 0, 0, -8));

    return { parts: P.list, meta: {
      slot: 'muzzle', name: 'ДТК компенсатор', short: 'ДТК', tip: -L,
      flash: 1.25, sound: 'loud', weight: 195,
      gasPorts: [[10, 0, -L + 18, 0.95, 0.12, -0.28], [-10, 0, -L + 18, -0.95, 0.12, -0.28],
        [9, 0, -L + 46, 0.9, 0.2, -0.3], [-9, 0, -L + 46, -0.9, 0.2, -0.3]],
      stats: { vertRecoil: -26, horizRecoil: -18, hipSpread: 4, adsSpeed: -3, sound: 12, flashHide: -20 } } };
  };

  /* ==================================================================
     3. Линейный компенсатор («blast can») — гонит газ вперёд
     ================================================================== */
  OUT.comp_linear = function () {
    const P = bag();
    const R = 13.5, L = 62.0, rBore = 6.2;
    P.addAll(threadMount({ rOut: 10.4, rIn: 7.4, len: 15 }));
    P.add('body', 'nitride', lathe([
      { r: rBore, z: -L }, { r: R, z: -L }, { r: R, z: -L + 6, s: true },
      { r: R - 0.6, z: -L + 10, s: true }, { r: R - 0.6, z: -18, s: true },
      { r: 10.4, z: -15 }, { r: rBore, z: -15 }], 40, true));
    P.addAll(knurlBand({ r: R - 0.55, z0: -L + 14, z1: -22, n: 44, depth: 0.5, mat: 'nitride' }));
    /* конус-«воронка» внутри, который направляет газ вперёд */
    P.add('cone', 'inconel', lathe([{ r: rBore, z: -L + 4 }, { r: R - 2.4, z: -16 },
      { r: R - 1.6, z: -16 }, { r: rBore + 0.8, z: -L + 4 }], 34, true));
    P.add('bore', 'bore', tube(rBore - 0.15, rBore, -L, 0, 30));
    /* отверстия сброса газа в крыше — уводят подброс ствола вниз */
    for (let i = 0; i < 6; i++)
      P.add('port', 'bore', tr(rx(cyl(1.5, 1.5, R - 2.4, R + 0.3, 12, true), -PI / 2), 0, 0, -26 - i * 5));

    return { parts: P.list, meta: {
      slot: 'muzzle', name: 'Линейный компенсатор', short: 'LINEAR', tip: -L,
      flash: 0.9, sound: 'loud', weight: 150,
      gasPorts: [[0, 0, -L, 0, 0, -1]],
      stats: { vertRecoil: -10, horizRecoil: -6, hipSpread: 0, adsSpeed: -2, sound: 8, flashHide: 20 } } };
  };

  /* ==================================================================
     4. Быстросъёмный глушитель: корпус, перегородки, тепловой кожух
     ================================================================== */
  OUT.suppressor_qd = function (o) {
    const O = Object.assign({ baffles: 7, cover: true }, o || {});
    const P = bag();
    const R = 19.0, L = 178.0, rBore = 6.4;

    /* корпус: труба с коническим носом и утолщением у казны */
    P.add('tube', 'nitride', lathe([
      { r: R - 4.2, z: -L }, { r: R - 1.6, z: -L }, { r: R, z: -L + 10, s: true },
      { r: R, z: -22, s: true }, { r: R + 1.4, z: -18, s: true },
      { r: R + 1.4, z: -4 }, { r: R - 5.0, z: -4 }, { r: R - 5.0, z: -L + 10, s: true }], 48, true));
    /* передний торец с фаской */
    P.add('endCap', 'nitride', lathe([{ r: rBore, z: -L - 2 }, { r: R - 1.6, z: -L - 2 },
      { r: R - 1.6, z: -L + 1 }, { r: rBore + 1.2, z: -L + 4 }, { r: rBore, z: -L + 4 }], 40, true));

    /* перегородки-конусы внутри: видны через срез и определяют звук */
    const step = (L - 34) / O.baffles;
    for (let i = 0; i < O.baffles; i++) {
      const z = -20 - i * step;
      P.add('baffle', 'inconel', lathe([
        { r: rBore, z: z }, { r: R - 5.2, z: z - step * 0.62 },
        { r: R - 5.2, z: z - step * 0.62 - 1.6 }, { r: rBore, z: z - 1.6 }], 30, true));
      P.add('baffleClip', 'inconel', tr(tube(R - 5.4, R - 4.6, -1.0, 1.0, 30), 0, 0, z - step * 0.62 - 0.8));
    }
    /* «клиппинг» газа: первая расширительная камера длиннее */
    P.add('blastChamber', 'inconel', tr(tube(R - 5.2, R - 4.4, -9, 9, 32), 0, 0, -12));

    /* QD-хвостовик: байонет с зубьями под дульное устройство */
    P.add('qdCollar', 'steelDk', lathe([{ r: 9.2, z: -4 }, { r: R + 1.4, z: -4 },
      { r: R + 1.4, z: 0 }, { r: 9.2, z: 0 }], 34, true));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      P.add('qdTooth', 'steelDk', tr(boxC(0, 0, 0, 3.4, 3.0, 5.0, 0.4, 0.15),
        Math.cos(a) * 11.0, Math.sin(a) * 11.0, -1.8));
    }
    P.addAll(knurlBand({ r: R + 1.45, z0: -17, z1: -5, n: 46, depth: 0.5, mat: 'steelDk' }));
    P.add('qdLatch', 'steel', tr(boxC(0, 0, 0, 6.0, 4.0, 14, 1.0, 0.2), 0, R + 2.0, -11));

    /* тепловой кожух-чехол с продольными прорезями */
    if (O.cover) {
      P.add('cover', 'rubber', tube(R + 0.2, R + 2.2, -L + 14, -26, 44));
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * TAU;
        P.add('coverRib', 'rubber', tr(cyl(1.1, 1.1, -L + 18, -30, 8, false),
          Math.cos(a) * (R + 2.3), Math.sin(a) * (R + 2.3), 0));
      }
    }
    P.add('bore', 'bore', tube(rBore - 0.2, rBore, -L, -4, 28));

    return { parts: P.list, meta: {
      slot: 'muzzle', name: 'Глушитель QD', short: 'SUPP', tip: -L - 2,
      flash: 0.18, sound: 'suppressed', weight: 480,
      gasPorts: [[0, 0, -L, 0, 0, -1]],
      heatHaze: true,
      stats: { vertRecoil: -14, horizRecoil: -8, hipSpread: -6, adsSpeed: -12,
        sound: -70, flashHide: 85, range: 6, velocity: 3 } } };
  };

  /* ==================================================================
     5. Компактный «моноблок» — короткий пламегаситель-хайдер
     ================================================================== */
  OUT.flash_cone = function () {
    const P = bag();
    const R = 13.0, L = 46.0, rBore = 6.0;
    P.addAll(threadMount({ rOut: 9.8, rIn: 7.2, len: 13 }));
    /* раструб-конус с тремя продольными прорезями */
    P.add('cone', 'nitride', lathe([
      { r: rBore, z: -L }, { r: R, z: -L }, { r: R - 1.0, z: -L + 3, s: true },
      { r: 9.9, z: -14, s: true }, { r: 9.9, z: -13 }, { r: rBore, z: -13 }], 42, true));
    for (let i = 0; i < 3; i++) {
      const a = D(90 + i * 120);
      P.add('slot', 'nitride', tr(rz(boxC(0, R - 1.6, -L + 12, 2.6, 3.2, 20, 0.4, 0.15), a), 0, 0, 0));
    }
    P.add('crown', 'nitride', lathe([{ r: R - 1.4, z: -L - 1.5 }, { r: R + 0.4, z: -L - 1.5 },
      { r: R + 0.4, z: -L + 1 }, { r: R - 1.4, z: -L + 1 }], 42, true));
    P.add('bore', 'bore', tube(rBore - 0.15, rBore, -L, 0, 28));

    return { parts: P.list, meta: {
      slot: 'muzzle', name: 'Конусный пламегаситель', short: 'CONE', tip: -L - 1.5,
      flash: 0.4, sound: 'normal', weight: 96,
      gasPorts: [[0, 8, -L + 10, 0.2, 0.9, -0.3]],
      stats: { vertRecoil: -5, horizRecoil: -3, hipSpread: -2, adsSpeed: -1, sound: 0, flashHide: 80 } } };
  };

  /* ==================================================================
     6. Голый ствол: защитная гайка на резьбу
     ================================================================== */
  OUT.thread_cap = function () {
    const P = bag();
    P.add('cap', 'nitride', lathe([{ r: 6.0, z: -12 }, { r: 9.2, z: -12 },
      { r: 9.2, z: -1.0, s: true }, { r: 8.4, z: 0 }, { r: 6.0, z: 0 }], 30, true));
    P.addAll(knurlBand({ r: 9.25, z0: -10.5, z1: -2.0, n: 26, depth: 0.42, mat: 'nitride' }));
    P.add('bore', 'bore', tube(5.85, 6.0, -12, 0, 26));
    return { parts: P.list, meta: {
      slot: 'muzzle', name: 'Дульная гайка', short: 'CAP', tip: -12,
      flash: 1.0, sound: 'loud', weight: 22, gasPorts: [],
      stats: { vertRecoil: 0, horizRecoil: 0, hipSpread: 0, adsSpeed: 2, sound: 0, flashHide: 0 } } };
  };

  return OUT;
};
