/* ============================================================================
   Магазины, приклады, цевья и боковые модули.

   Магазин: начало координат — плоскость шахты (верх магазина), корпус растёт
   вниз по −Y, изгиб задаётся радиусом. Приклад: начало — торец коробки,
   растёт в +Z. Цевьё: начало — стык со ствольной коробкой.
   ========================================================================== */
module.exports = function (G, C) {
  const { PI, TAU, D } = C;
  const { tr, rx, ry, rz, merge, extrude, lathe, cyl, tube, loft, mBasis } = G;
  const { bag, boxC, boxZ, plateZY, cylX, cylY, sphere, railStrip, railClamp,
    capScrew, knurlBand, spring, padButton, RAIL } = C;

  const OUT = {};

  /* --------------------------------------------------------------------
     Изогнутый магазин: дуга радиуса R, сечение ширина W × глубина Dz.
     cap — ёмкость, влияет на длину; window — окна контроля патронов.
     -------------------------------------------------------------------- */
  function curvedMag(o) {
    const O = Object.assign({ R: 380, len: 172, W: 26, Dz: 64, cap: 30,
      tilt: 5, mat: 'poly', window: false, ribs: 7, floorplate: true }, o || {});
    const P = bag();
    const HW = O.W / 2, HD = O.Dz / 2;
    const T0 = [-Math.sin(D(O.tilt)), -Math.cos(D(O.tilt))];
    const CEN = [O.R * T0[1], -O.R * T0[0]];
    const rot = (v, a) => [v[0] * Math.cos(a) + v[1] * Math.sin(a), -v[0] * Math.sin(a) + v[1] * Math.cos(a)];
    /* s ∈ [0..1] вдоль магазина; кадр даёт точку и нормаль дуги в (z,y) */
    function frame(s) {
      const phi = s * O.len / O.R;
      const rp = rot([-CEN[0], -CEN[1]], phi);
      return { P: [CEN[0] + rp[0], CEN[1] + rp[1]], T: rot(T0, phi) };
    }
    /* кольцо сечения магазина в мировых координатах */
    const ring = (s, shrink, nSeg) => {
      const f = frame(s), T = f.T, N = [-T[1], T[0]];
      const out = [], n = nSeg || 4;
      const w = HW * (1 - shrink * 0.10), d = HD * (1 - shrink * 0.06);
      const corners = [[-w, -d], [w, -d], [w, d], [-w, d]];
      for (const [x, v] of corners) {
        /* скругление углов — по 3 точки на угол */
        out.push([x, f.P[1] + v * N[1], f.P[0] + v * N[0]]);
        out.push([x, f.P[1] + v * N[1], f.P[0] + v * N[0]]);
      }
      return out;
    };
    /* корпус лофтом по дуге, с сужением книзу */
    const rings = [];
    const NS = 16;
    for (let i = 0; i <= NS; i++) {
      const s = i / NS;
      const f = frame(s), T = f.T, N = [-T[1], T[0]];
      const taper = 1 - 0.045 * s;
      const w = HW * taper, d = HD * taper;
      const rr = [];
      const pts = [];
      const R2 = 3.2;
      /* прямоугольник со скруглёнными углами в плоскости (x, N) */
      for (const [cx, cv, a0] of [[-w + R2, -d + R2, PI], [w - R2, -d + R2, -PI / 2],
        [w - R2, d - R2, 0], [-w + R2, d - R2, PI / 2]]) {
        for (let k = 0; k <= 4; k++) {
          const a = a0 + k / 4 * (PI / 2);
          pts.push([cx + Math.cos(a) * R2, cv + Math.sin(a) * R2]);
        }
      }
      for (const [x, v] of pts) rr.push([x, f.P[1] + v * N[1], f.P[0] + v * N[0]]);
      rings.push(rr);
    }
    P.add('magBody', O.mat, loft(rings, true, true));

    /* рёбра жёсткости поперёк корпуса */
    for (let i = 1; i <= O.ribs; i++) {
      const s = i / (O.ribs + 1);
      const f = frame(s), T = f.T, N = [-T[1], T[0]];
      const rr = [];
      for (const ds of [-0.022, 0.022]) {
        const g = frame(s + ds), Tg = g.T, Ng = [-Tg[1], Tg[0]];
        const row = [];
        const w = HW * 1.03, d = HD * 1.02;
        for (let k = 0; k < 20; k++) {
          const a = k / 20 * TAU;
          const cx = Math.cos(a) * w, cv = Math.sin(a) * d * 0.98;
          row.push([cx, g.P[1] + cv * Ng[1], g.P[0] + cv * Ng[0]]);
        }
        rr.push(row);
      }
      P.add('magRib', O.mat, loft(rr, false, false));
    }

    /* горловина: губки подачи и зацеп за шахту */
    const f0 = frame(0), N0 = [f0.T[1] * -1, f0.T[0]];
    P.add('magMouth', 'steelDk', boxC(0, -3.0, -2.0, O.W + 0.6, 8.0, O.Dz * 0.94, 2.0, 0.4));
    P.add('magLugFront', 'steelDk', boxC(0, -9.0, -HD + 3.0, O.W - 6, 10.0, 5.0, 1.0, 0.3));
    P.add('magLugRear', 'steelDk', boxC(0, -12.0, HD - 4.0, O.W - 8, 14.0, 6.0, 1.2, 0.3));

    /* окна контроля патронов */
    if (O.window) for (let i = 0; i < 4; i++) {
      const s = 0.25 + i * 0.16;
      const f = frame(s), T = f.T, N = [-T[1], T[0]];
      P.add('magWindow', 'bore', tr(rz(boxC(0, 0, 0, 3.0, 22, 8.0, 1.0, 0.2), 0),
        HW - 0.6, f.P[1], f.P[0]));
    }

    /* пятка и подаватель */
    if (O.floorplate) {
      const fe = frame(1.0), Te = fe.T, Ne = [-Te[1], Te[0]];
      P.add('magFloor', 'steelDk', tr(rz(boxC(0, 0, 0, O.W + 2.4, 6.0, O.Dz + 1.0, 2.2, 0.4),
        Math.atan2(Te[0], -Te[1])), 0, fe.P[1] - 1.0, fe.P[0]));
      P.add('magFloorLatch', 'steelDk', tr(boxC(0, 0, 0, 8.0, 4.0, 6.0, 0.8, 0.2),
        0, fe.P[1] + 4.0, fe.P[0] - HD + 5));
    }
    const fF = frame(0.06), NF = [-fF.T[1], fF.T[0]];
    P.add('magFollower', 'poly', tr(boxC(0, 0, 0, O.W - 4.0, 7.0, O.Dz - 6.0, 1.5, 0.3),
      0, fF.P[1], fF.P[0]));

    return { parts: P.list, frame, meta: { cap: O.cap, len: O.len } };
  }

  /* Патрон: гильза + пуля, ось +Z вперёд; используется как «верхний патрон». */
  function cartridge(o) {
    const O = Object.assign({ caseL: 39, caseR: 5.0, rimR: 5.6, bulletL: 25, bulletR: 2.8 }, o || {});
    const P = bag();
    P.add('case', 'brass', lathe([
      { r: 0, z: 0 }, { r: O.rimR, z: 0 }, { r: O.rimR, z: 1.4, s: true },
      { r: O.caseR * 0.92, z: 3.0, s: true }, { r: O.caseR, z: O.caseL * 0.62, s: true },
      { r: O.bulletR + 0.4, z: O.caseL - 3, s: true }, { r: O.bulletR + 0.4, z: O.caseL },
      { r: 0, z: O.caseL }], 26, true));
    P.add('bullet', 'copper', tr(lathe([
      { r: 0, z: 0 }, { r: O.bulletR, z: 0 }, { r: O.bulletR, z: O.bulletL * 0.42, s: true },
      { r: O.bulletR * 0.62, z: O.bulletL * 0.82, s: true }, { r: 0, z: O.bulletL }], 24, true),
      0, 0, O.caseL - 4));
    return P.list;
  }
  OUT._cartridge = cartridge;

  /* ==================================================================
     Магазины
     ================================================================== */
  OUT.mag_ak_30 = function () {
    const m = curvedMag({ R: 380, len: 172, W: 26, Dz: 64, cap: 30, tilt: 5, mat: 'poly', ribs: 7 });
    return { parts: m.parts, meta: {
      slot: 'mag', name: 'Магазин 30 (7,62/5,45)', short: '30', cap: 30, weight: 330,
      caliber: 'auto', reloadMod: 0,
      stats: { reload: 0, mobility: 0, ergonomics: 0 } } };
  };

  OUT.mag_ak_45 = function () {
    const m = curvedMag({ R: 420, len: 236, W: 26, Dz: 64, cap: 45, tilt: 5, mat: 'poly', ribs: 10 });
    return { parts: m.parts, meta: {
      slot: 'mag', name: 'Магазин 45 (РПК)', short: '45', cap: 45, weight: 470,
      caliber: 'auto', reloadMod: -10,
      stats: { reload: -12, mobility: -4, ergonomics: -3 } } };
  };

  OUT.mag_stanag_30 = function () {
    const m = curvedMag({ R: 560, len: 178, W: 24, Dz: 58, cap: 30, tilt: 3, mat: 'poly', ribs: 6, window: true });
    return { parts: m.parts, meta: {
      slot: 'mag', name: 'Магазин STANAG 30', short: '30', cap: 30, weight: 280,
      caliber: '5.56', reloadMod: 0,
      stats: { reload: 0, mobility: 0, ergonomics: 0 } } };
  };

  OUT.mag_drum_75 = function () {
    const P = bag();
    const R = 92, TH = 44;
    /* барабан: две «щеки» с рёбрами и заводная крышка */
    P.add('drumShell', 'poly', tr(rx(lathe([
      { r: 0, z: -TH / 2 }, { r: R - 4, z: -TH / 2 }, { r: R, z: -TH / 2 + 5, s: true },
      { r: R, z: TH / 2 - 5, s: true }, { r: R - 4, z: TH / 2 }, { r: 0, z: TH / 2 }], 56, true), PI / 2),
      0, -R - 22, 4));
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU;
      P.add('drumRib', 'poly', tr(rz(boxC(0, R * 0.42, 0, 4.6, R * 0.74, TH + 0.8, 1.2, 0.2), a), 0, -R - 22, 4));
    }
    P.add('drumHub', 'steelDk', tr(rx(cyl(13, 13, -TH / 2 - 2.5, TH / 2 + 2.5, 28, true), PI / 2), 0, -R - 22, 4));
    P.add('windKnob', 'steelDk', tr(rx(cyl(9, 9, TH / 2 + 2.5, TH / 2 + 7.0, 22, true), PI / 2), 0, -R - 22, 4));
    /* горловина-«башня» к шахте */
    P.add('drumNeck', 'poly', boxC(0, -13.0, 0, 26, 30, 62, 3.0, 0.5));
    P.add('magMouth', 'steelDk', boxC(0, -3.0, -2.0, 26.6, 8.0, 60, 2.0, 0.4));
    P.add('magLugRear', 'steelDk', boxC(0, -12.0, 27.0, 18, 14.0, 6.0, 1.2, 0.3));
    P.add('drumWindow', 'glass', tr(rx(tube(R * 0.42, R * 0.58, -TH / 2 - 0.4, -TH / 2 + 0.6, 40), PI / 2), 0, -R - 22, 4));

    return { parts: P.list, meta: {
      slot: 'mag', name: 'Барабан 75', short: '75', cap: 75, weight: 1100,
      caliber: 'auto', reloadMod: -40,
      stats: { reload: -45, mobility: -14, ergonomics: -10, adsSpeed: -6 } } };
  };

  OUT.mag_pistol_17 = function () {
    const P = bag();
    const W = 21, Dz = 32, L = 108;
    P.add('magBody', 'poly', boxC(0, -L / 2, 0, W, L, Dz, 2.4, 0.5));
    /* контрольные отверстия с нумерацией по задней стенке */
    for (let i = 0; i < 9; i++)
      P.add('magWitness', 'bore', tr(ry(cyl(1.5, 1.5, W / 2 - 1.4, W / 2 + 0.2, 12, true), PI / 2),
        0, -16 - i * 9.5, Dz / 2 - 6));
    P.add('magFloor', 'poly', boxC(0, -L - 3.0, 0, W + 2.0, 7.0, Dz + 2.0, 2.0, 0.4));
    P.add('magFollower', 'poly', boxC(0, -8.0, 0, W - 3.0, 6.0, Dz - 4.0, 1.4, 0.3));
    P.add('magLugRear', 'steelDk', boxC(0, -14.0, Dz / 2 - 2.0, 10, 12.0, 4.0, 1.0, 0.2));
    return { parts: P.list, meta: {
      slot: 'mag', name: 'Пистолетный 17', short: '17', cap: 17, weight: 190,
      caliber: '9mm', reloadMod: 0, stats: { reload: 0, mobility: 0, ergonomics: 0 } } };
  };

  OUT.mag_pistol_33 = function () {
    const P = bag();
    const W = 21, Dz = 32, L = 196;
    P.add('magBody', 'poly', boxC(0, -L / 2, 0, W, L, Dz, 2.4, 0.5));
    P.add('magFloor', 'poly', boxC(0, -L - 3.0, 0, W + 2.0, 7.0, Dz + 2.0, 2.0, 0.4));
    P.add('magFollower', 'poly', boxC(0, -8.0, 0, W - 3.0, 6.0, Dz - 4.0, 1.4, 0.3));
    P.add('magLugRear', 'steelDk', boxC(0, -14.0, Dz / 2 - 2.0, 10, 12.0, 4.0, 1.0, 0.2));
    for (let i = 0; i < 6; i++)
      P.add('magRib', 'poly', boxC(0, -30 - i * 28, 0, W + 1.2, 3.0, Dz + 1.0, 1.0, 0.2));
    return { parts: P.list, meta: {
      slot: 'mag', name: 'Пистолетный 33', short: '33', cap: 33, weight: 300,
      caliber: '9mm', reloadMod: -8, stats: { reload: -10, mobility: -3, ergonomics: -4 } } };
  };


  OUT.mag_762_20 = function () {
    const m = curvedMag({ R: 480, len: 182, W: 26, Dz: 72, cap: 20, tilt: 4, mat: 'poly', ribs: 6 });
    return { parts: m.parts, meta: {
      slot: 'mag', name: 'Магазин 20 (7,62×51)', short: '20', cap: 20, weight: 310,
      caliber: '7.62', reloadMod: 0,
      stats: { reload: 4, mobility: 2, ergonomics: 2 } } };
  };

  OUT.mag_762_25 = function () {
    const m = curvedMag({ R: 470, len: 218, W: 26, Dz: 72, cap: 25, tilt: 4, mat: 'poly', ribs: 8, window: true });
    return { parts: m.parts, meta: {
      slot: 'mag', name: 'Магазин 25 (7,62×51)', short: '25', cap: 25, weight: 390,
      caliber: '7.62', reloadMod: -6,
      stats: { reload: -6, mobility: -2, ergonomics: -1 } } };
  };

  OUT.mag_svd_10 = function () {
    const m = curvedMag({ R: 620, len: 132, W: 24, Dz: 74, cap: 10, tilt: 3, mat: 'steelDk', ribs: 4 });
    return { parts: m.parts, meta: {
      slot: 'mag', name: 'Магазин 10 (СВД)', short: '10', cap: 10, weight: 240,
      caliber: '7.62', reloadMod: 0,
      stats: { reload: 6, mobility: 3, ergonomics: 2 } } };
  };

  /* ==================================================================
     Приклады. Начало координат — торец ствольной коробки, рост в +Z.
     ================================================================== */

  /* Телескопический приклад: труба, салазка, щека, затыльник */
  OUT.stock_telescopic = function (o) {
    const O = Object.assign({ mat: 'poly', ext: 2, mounts: 6 }, o || {});
    const P = bag();
    const Y = 0.0;                          // ось буферной трубы на уровне посадки
    const R_T = 14.6;                        // труба Ø29,2 (карабинная)
    const L_T = 196;
    const pos = 26 + O.ext * 17.5;           // вылет салазки по фиксатору

    P.add('bufferTube', 'anod', tr(cyl(R_T, R_T, 0, L_T, 34, true), 0, Y, 0));
    P.add('tubeThread', 'steelDk', tr(C.threadHelix(R_T + 0.5, R_T, 2, 16, 1.4, 20), 0, Y, 0));
    /* риски фиксации */
    for (let i = 0; i < O.mounts; i++)
      P.add('detentNotch', 'bore', tr(rx(cyl(3.0, 3.0, -R_T - 0.4, -R_T + 2.0, 12, true), PI / 2),
        0, Y, 34 + i * 17.5));
    P.add('castleNut', 'steelDk', tr(cyl(R_T + 4.0, R_T + 4.0, -6, 0, 30, true), 0, Y, 0));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      P.add('castleSlot', 'bore', tr(cyl(1.8, 1.8, -6.2, 0.2, 10, true),
        Math.cos(a) * (R_T + 3.2), Y + Math.sin(a) * (R_T + 3.2), 0));
    }

    /* салазка приклада: корпус, пазы, рычаг фиксатора */
    const bodyL = 86;
    P.add('slider', O.mat, boxC(0, Y + 2.0, pos + bodyL / 2, 44, 52, bodyL, 5.0, 0.8));
    P.add('sliderChannel', 'bore', tr(cyl(R_T + 0.5, R_T + 0.5, pos - 2, pos + bodyL + 2, 30, true), 0, Y, 0));
    P.add('lockLever', 'poly', boxC(0, Y - 25.0, pos + 22, 26, 9.0, 34, 2.0, 0.4));
    P.add('lockPin', 'steel', tr(cylY(2.6, 2.6, Y - 24, Y - 12, 14), 0, 0, pos + 22));
    P.add('lockSpring', 'steel', tr(spring(3.4, 0.7, 0, 10, 6), 0, Y - 22, pos + 22));

    /* щека и «скелетный» вырез */
    P.add('cheek', O.mat, boxC(0, Y + 24.0, pos + bodyL / 2 + 14, 34, 16, bodyL - 16, 4.0, 0.6));
    for (const s of [-1, 1])
      P.add('skeletonRib', O.mat, boxC(s * 19.0, Y + 4.0, pos + bodyL / 2, 4.0, 40, bodyL - 12, 2.0, 0.4));

    /* затыльник с резиновым амортизатором */
    P.add('buttPlate', O.mat, boxC(0, Y + 2.0, pos + bodyL + 6, 46, 62, 12, 5.0, 0.8));
    P.add('recoilPad', 'rubber', boxC(0, Y + 2.0, pos + bodyL + 16, 45, 60, 10, 5.0, 0.8));
    for (let i = 0; i < 5; i++)
      P.add('padGroove', 'rubber', boxC(0, Y - 22 + i * 12, pos + bodyL + 21.2, 43, 2.4, 1.6, 0.6, 0.15));

    /* антабки: петля и QD-гнездо */
    for (const s of [-1, 1])
      P.add('qdSocket', 'steelDk', tr(cylX(5.0, 5.0, s * 20.0, s * 23.0, 18), 0, Y - 6, pos + 20));
    P.add('slingLoop', 'steelDk', tr(rx(tube(4.0, 6.4, -2.0, 2.0, 22), PI / 2), 0, Y - 26, pos + bodyL - 6));

    return { parts: P.list, meta: {
      slot: 'stock', name: 'Телескопический приклад', short: 'ТЕЛЕСКОП', weight: 340,
      lengthOfPull: pos + bodyL + 22, adjust: { steps: O.mounts, step: 17.5, current: O.ext },
      cheekY: Y + 32, buttZ: pos + bodyL + 22,
      stats: { vertRecoil: -16, horizRecoil: -10, adsSpeed: -2, mobility: -2, ergonomics: 6 } } };
  };

  /* Складной рамочный приклад (треугольник в духе АКС) */
  OUT.stock_folding = function (o) {
    const O = Object.assign({ mat: 'steelDk', folded: false }, o || {});
    const P = bag();
    const Y = 26.0, L = 230;
    /* два стержня рамы + затыльник */
    for (const sy of [-1, 1]) {
      const y0 = Y + sy * 22;
      P.add('frameRod', O.mat, tr(cyl(5.2, 5.2, 14, L - 18, 18, true), 0, y0, 0));
      P.add('frameBendF', O.mat, tr(rx(G.torus(12, 5.2, 18, 10, PI / 2, sy > 0 ? 0 : -PI / 2), 0), 0, y0 - sy * 12, 14));
    }
    P.add('crossBar', O.mat, tr(cylX(4.6, 4.6, -20, 20, 16), 0, Y, L - 20));
    P.add('buttPlate', O.mat, boxC(0, Y, L - 8, 42, 58, 10, 6.0, 0.8));
    P.add('buttPad', 'rubber', boxC(0, Y, L + 1, 41, 56, 8, 6.0, 0.8));
    /* шарнир складывания слева от коробки */
    P.add('hingeBlock', O.mat, boxC(-16.0, Y, 8, 22, 40, 26, 3.0, 0.5));
    P.add('hingeAxis', 'steel', tr(cylY(4.0, 4.0, Y - 24, Y + 24, 18), -16.0, 0, 8));
    P.add('hingeLatch', 'steel', boxC(-16.0, Y - 22, 22, 9.0, 8.0, 16, 1.2, 0.3));
    P.add('latchSpring', 'steel', tr(spring(3.0, 0.6, 0, 9, 5), -16.0, Y - 24, 22));
    P.add('slingLoop', O.mat, tr(rx(tube(4.0, 6.4, -2.0, 2.0, 22), PI / 2), 0, Y - 26, 30));

    return { parts: P.list, meta: {
      slot: 'stock', name: 'Складной рамочный', short: 'СКЛАДНОЙ', weight: 520,
      lengthOfPull: L, cheekY: Y + 22, buttZ: L + 5,
      fold: { pivot: [-16.0, Y, 8], axis: 'y', angle: 178,
        parts: ['frameRod', 'frameBendF', 'crossBar', 'buttPlate', 'buttPad', 'slingLoop'] },
      stats: { vertRecoil: -12, horizRecoil: -8, adsSpeed: 0, mobility: 6, ergonomics: 2 } } };
  };

  /* Классический деревянный приклад: силуэт задаётся верхней и нижней
     линиями профиля, ширина — отдельной кривой. */
  OUT.stock_wood = function (o) {
    const O = Object.assign({ mat: 'wood' }, o || {});
    const P = bag();
    const Y = 22.0, L = 250;
    /* [t, верх, низ, полуширина] — t вдоль приклада от шейки к затыльнику */
    const TAB = [
      [0.00, 30, -18, 15.0],
      [0.10, 26, -26, 15.4],
      [0.24, 22, -34, 16.2],
      [0.42, 20, -40, 17.0],
      [0.60, 21, -44, 17.6],
      [0.78, 24, -46, 18.2],
      [0.92, 28, -46, 18.6],
      [1.00, 31, -45, 18.8]
    ];
    const at = (t, i) => {
      for (let k = 1; k < TAB.length; k++) {
        if (t <= TAB[k][0]) {
          const a = TAB[k - 1], b = TAB[k];
          const u = (t - a[0]) / (b[0] - a[0] || 1);
          return a[i] + (b[i] - a[i]) * u;
        }
      }
      return TAB[TAB.length - 1][i];
    };
    const rings = [];
    const NS = 22;
    for (let i = 0; i <= NS; i++) {
      const t = i / NS, z = t * L;
      const top = Y + at(t, 1), bot = Y + at(t, 2), hw = at(t, 3);
      const yc = (top + bot) / 2, hh = (top - bot) / 2;
      const ring = [];
      for (let k = 0; k < 30; k++) {
        const a = k / 30 * TAU, cs = Math.cos(a), sn = Math.sin(a);
        /* прямоугольное сечение со скруглением — суперэллипс степени 4,6 */
        const p = 4.6;
        ring.push([hw * Math.sign(cs) * Math.pow(Math.abs(cs), 2 / p),
          yc + hh * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p), z]);
      }
      rings.push(ring);
    }
    P.add('stockBody', O.mat, loft(rings, true, true));
    /* затыльник по обводу торца, чуть шире дерева */
    P.add('buttPlate', 'steelDk', boxC(0, Y - 7, L + 4, 39, 78, 7, 4.0, 0.8));
    P.add('buttScrew', 'steel', tr(capScrew(4.0, 8, 2.0), 0, Y + 26, L + 8));
    P.add('buttScrewLow', 'steel', tr(capScrew(4.0, 8, 2.0), 0, Y - 38, L + 8));
    /* паз антабки и лючок пенала */
    P.add('slingSlot', 'woodDk', boxC(0, Y - 44.0, L - 62, 15, 4.0, 30, 1.6, 0.3));
    P.add('cleaningTrap', 'steelDk', tr(cyl(7.0, 7.0, L - 1, L + 5, 22, true), 0, Y + 6, 0));

    return { parts: P.list, meta: {
      slot: 'stock', name: 'Деревянный приклад', short: 'ДЕРЕВО', weight: 640,
      lengthOfPull: L, cheekY: Y + 24, buttZ: L + 8,
      stats: { vertRecoil: -20, horizRecoil: -14, adsSpeed: -4, mobility: -6, ergonomics: 4 } } };
  };

  /* «Пистолетная» заглушка вместо приклада (труба без салазки) */
  OUT.stock_none = function () {
    const P = bag();
    const Y = 18.0, R_T = 14.6;
    P.add('bufferTube', 'anod', tr(cyl(R_T, R_T, 0, 88, 32, true), 0, Y, 0));
    P.add('tubeCap', 'anod', tr(lathe([{ r: 0, z: 88 }, { r: R_T, z: 88 },
      { r: R_T - 1.5, z: 92 }, { r: 0, z: 92 }], 30, true), 0, Y, 0));
    P.add('castleNut', 'steelDk', tr(cyl(R_T + 4.0, R_T + 4.0, -6, 0, 30, true), 0, Y, 0));
    P.add('slingLoop', 'steelDk', tr(rx(tube(3.6, 5.8, -2.0, 2.0, 20), PI / 2), 0, Y - 16, 20));
    return { parts: P.list, meta: {
      slot: 'stock', name: 'Без приклада', short: 'НЕТ', weight: 120,
      lengthOfPull: 92, cheekY: Y + 14, buttZ: 92,
      stats: { vertRecoil: 22, horizRecoil: 16, adsSpeed: 6, mobility: 14, ergonomics: -12 } } };
  };

  /* ==================================================================
     Цевья. Начало координат — стык с коробкой, рост в −Z.
     ================================================================== */

  /* Модульное цевьё M-LOK: труба с гранями, планка сверху, слоты по бокам */
  OUT.handguard_mlok = function (o) {
    const O = Object.assign({ len: 240, mat: 'anod', slots: true }, o || {});
    const P = bag();
    const L = O.len, R = 21.0, Y = 0;

    /* восьмигранная труба */
    const rings = [];
    for (const z of [-L, -L + 6, -8, 0]) {
      const ring = [];
      const rr = (z > -10) ? R + 2.2 : R;
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * TAU + PI / 8;
        ring.push([Math.cos(a) * rr, Math.sin(a) * rr, z]);
        ring.push([Math.cos(a) * rr, Math.sin(a) * rr, z]);
      }
      rings.push(ring);
    }
    P.add('shell', O.mat, loft(rings, false, false));
    /* внутренняя стенка, чтобы труба не была «бумажной» */
    const ringsIn = rings.map((r) => r.map((p) => {
      const l = Math.hypot(p[0], p[1]) || 1;
      return [p[0] / l * (l - 3.0), p[1] / l * (l - 3.0), p[2]];
    }));
    P.add('shellInner', 'bore', loft(ringsIn, false, false));
    P.add('capFront', O.mat, tr(tube(R - 3.2, R + 0.3, -L - 3, -L, 26), 0, 0, 0));

    /* верхняя планка по всей длине */
    for (const p of [{ g: railStrip(L - 4, -4, 5.2, 4.2) }])
      P.add('topRail', O.mat, tr(p.g, 0, R + 4.6, 0));

    /* M-LOK слоты: по 3 ряда на каждой из нижних граней */
    if (O.slots) {
      for (const side of [-1, 1, 0]) {
        const a = side === 0 ? -PI / 2 : (side > 0 ? 0 : PI);
        for (let i = 0; i < Math.floor((L - 40) / 42); i++) {
          const z = -30 - i * 42;
          const g = boxC(0, 0, z, 6.0, 3.0, 32, 1.5, 0.3);
          P.add('mlokSlot', 'bore', tr(rz(tr(g, 0, R - 1.0, 0), a), 0, 0, 0));
        }
      }
    }
    /* вентиляционные отверстия по верхним скосам */
    for (const s of [-1, 1]) for (let i = 0; i < Math.floor((L - 50) / 30); i++) {
      const a = s * D(45);
      P.add('vent', 'bore', tr(rz(tr(cyl(4.6, 4.6, R - 3.4, R + 0.6, 16, true), 0, 0, 0), 0), 0, 0, 0));
      P.list.pop();
      const g = rx(cyl(4.6, 4.6, R - 3.4, R + 0.6, 16, true), -PI / 2);
      P.add('vent', 'bore', tr(rz(tr(g, 0, 0, -36 - i * 30), a), 0, 0, 0));
    }
    /* гайка ствола и антиротационные зубья */
    P.add('barrelNut', 'steelDk', tr(tube(15.0, R - 1.6, -6, 10, 30), 0, 0, 0));
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      P.add('nutTooth', 'steelDk', tr(cyl(1.6, 1.6, -5, 8, 8, true),
        Math.cos(a) * (R - 3.4), Math.sin(a) * (R - 3.4), 0));
    }
    for (const s of [-1, 1])
      P.add('clampScrew', 'steel', tr(rx(capScrew(3.4, 9, 1.6), PI), s * 12.0, -R - 2.0, -6));

    return { parts: P.list, meta: {
      slot: 'handguard', name: 'Цевьё M-LOK', short: 'M-LOK', weight: 320, len: L,
      rails: {
        top: { pos: [0, R + 4.6, -4], rot: [0, 0, 0], len: L - 4 },
        bottom: { pos: [0, -R - 0.6, -30], rot: [0, 0, PI], len: L - 60 },
        left: { pos: [-R - 0.6, 0, -30], rot: [0, 0, PI / 2], len: L - 60 },
        right: { pos: [R + 0.6, 0, -30], rot: [0, 0, -PI / 2], len: L - 60 }
      },
      stats: { vertRecoil: -4, adsSpeed: -1, mobility: 0, ergonomics: 6 } } };
  };

  /* Классическое деревянное цевьё с газовой трубкой */
  OUT.handguard_wood = function (o) {
    const O = Object.assign({ len: 200, mat: 'wood' }, o || {});
    const P = bag();
    const L = O.len;
    /* нижняя накладка */
    const rings = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, z = -t * L;
      const w = 20.5 - 2.6 * Math.pow(t, 1.6), h = 17.5 - 3.5 * t;
      const ring = [];
      for (let k = 0; k < 20; k++) {
        const a = k / 20 * TAU, cs = Math.cos(a), sn = Math.sin(a), p = 2.4;
        ring.push([w * Math.sign(cs) * Math.pow(Math.abs(cs), 2 / p),
          -6 + h * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p) * (sn < 0 ? 1.15 : 0.8), z]);
      }
      rings.push(ring);
    }
    P.add('lowerWood', O.mat, loft(rings, true, true));
    /* верхняя накладка над газовой трубкой */
    const ringsUp = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, z = -8 - t * (L - 30);
      const w = 14.5 - 1.6 * t, h = 11.0 - 1.4 * t;
      const ring = [];
      for (let k = 0; k < 18; k++) {
        const a = k / 18 * TAU, cs = Math.cos(a), sn = Math.sin(a), p = 2.3;
        ring.push([w * Math.sign(cs) * Math.pow(Math.abs(cs), 2 / p),
          26 + h * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p), z]);
      }
      ringsUp.push(ring);
    }
    P.add('upperWood', O.mat, loft(ringsUp, true, true));
    /* стальные обоймицы и «ласточкин хвост» под боковой кронштейн */
    for (const z of [-12, -L + 16])
      P.add('ferrule', 'steelDk', tr(tube(19.0, 21.4, z - 4, z + 4, 26), 0, -6, 0));
    /* пальцевые выемки — тёмные полосы заподлицо с боковиной */
    /* пальцевые выемки — неглубокие овальные впадины на боковинах */
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++)
      P.add('grooveCut', 'woodDk', tr(ry(cyl(5.4, 5.4, 0, 1.6, 20, true), PI / 2),
        s * 19.0, -6, -40 - i * 26));

    return { parts: P.list, meta: {
      slot: 'handguard', name: 'Деревянное цевьё', short: 'ДЕРЕВО', weight: 260, len: L,
      rails: {},
      stats: { vertRecoil: 0, adsSpeed: 1, mobility: 2, ergonomics: -4 } } };
  };

  /* Цевьё с «квад-рейл»: четыре планки Пикатинни */
  OUT.handguard_quad = function (o) {
    const O = Object.assign({ len: 230, mat: 'anod' }, o || {});
    const P = bag();
    const L = O.len, R = 19.5;
    P.add('core', O.mat, tube(R - 3.0, R, -L, 0, 26));
    for (const [nm, a, y, x] of [['top', 0, R, 0], ['bottom', PI, -R, 0],
      ['left', PI / 2, 0, -R], ['right', -PI / 2, 0, R]]) {
      const strip = railStrip(L - 8, -6, 5.0, 4.2);
      P.add(nm + 'Rail', O.mat, tr(rz(tr(strip, 0, R + 4.4, 0), a), 0, 0, 0));
    }
    P.add('barrelNut', 'steelDk', tr(tube(14.6, R - 1.4, -6, 12, 28), 0, 0, 0));
    for (const s of [-1, 1])
      P.add('clampScrew', 'steel', tr(rx(capScrew(3.4, 9, 1.6), PI), s * 11.0, -R - 6.5, -8));
    return { parts: P.list, meta: {
      slot: 'handguard', name: 'Квад-рейл', short: 'QUAD', weight: 430, len: L,
      rails: {
        top: { pos: [0, R + 4.4, -6], rot: [0, 0, 0], len: L - 8 },
        bottom: { pos: [0, -R - 4.4, -6], rot: [0, 0, PI], len: L - 8 },
        left: { pos: [-R - 4.4, 0, -6], rot: [0, 0, PI / 2], len: L - 8 },
        right: { pos: [R + 4.4, 0, -6], rot: [0, 0, -PI / 2], len: L - 8 }
      },
      stats: { vertRecoil: -6, adsSpeed: -3, mobility: -4, ergonomics: 8 } } };
  };


  /* ==================================================================
     ОПТИЧЕСКИЕ КРОНШТЕЙНЫ (OPTIC MOUNT)

     Отдельный слот-переходник: на АК прицел нельзя поставить напрямую,
     сначала ставится кронштейн, и уже он даёт планку под оптику.
     Каждый кронштейн объявляет rails.top — система подхватывает её как
     дочерний слот и предлагает туда прицелы.
     ================================================================== */

  /* Крышка ствольной коробки с планкой (самый частый вариант на АК) */
  OUT.mount_dustcover = function (o) {
    const O = Object.assign({ mat: 'anod' }, o || {});
    const P = bag();
    const L = 200, W = 36, H = 26;           // габариты крышки
    const RAIL_Y = H + 4.6;

    /* корпус крышки: арочный профиль с рёбрами жёсткости */
    const arch = [];
    for (let k = 0; k <= 16; k++) {
      const a = PI * (k / 16);
      arch.push([Math.cos(a) * (W / 2), Math.sin(a) * H * 0.92]);
    }
    arch.push([-W / 2, -2], [W / 2, -2]);
    P.add('cover', O.mat, extrude(G.round(arch, 1.2), { z0: -L, z1: 0, ch: 0.5 }));
    for (let i = 0; i < 5; i++)
      P.add('coverRib', O.mat, boxC(0, H * 0.5, -18 - i * 40, W + 0.8, H * 0.7, 3.0, 1.0, 0.2));

    /* передний зацеп и задняя защёлка — то, чем крышка держится */
    P.add('frontLug', 'steelDk', boxC(0, 6.0, -L + 4, W - 6, 8.0, 10, 1.0, 0.3));
    P.add('rearLatch', 'steelDk', boxC(0, 8.0, -6, 14, 12.0, 12, 1.2, 0.3));
    P.add('latchSpring', 'steel', tr(spring(3.0, 0.6, 0, 9, 5), 0, 12.0, -10));

    /* планка Пикатинни сверху, на всю длину крышки */
    P.add('rail', O.mat, tr(railStrip(L - 16, -8, 5.2, 4.2), 0, RAIL_Y, 0));
    /* усиленные боковые щёки — крышка с планкой не «гуляет» */
    for (const s of [-1, 1])
      P.add('sideWall', O.mat, boxC(s * (W / 2 - 1.2), H * 0.45, -L / 2, 2.4, H * 0.8, L - 20, 1.0, 0.3));

    return { parts: P.list, meta: {
      slot: 'mount', name: 'Крышка с планкой', short: 'КРЫШКА', weight: 240,
      rails: { top: { pos: [0, RAIL_Y, -8], rot: [0, 0, 0], len: L - 16, accepts: ['optic', 'magnifier'] } },
      stats: { adsSpeed: -1, ergonomics: 4 } } };
  };

  /* Боковой кронштейн-переходник на «ласточкин хвост» АК */
  OUT.mount_side = function (o) {
    const O = Object.assign({ mat: 'anod' }, o || {});
    const P = bag();
    const RAIL_Y = 58;                        // планка над осью канала ствола

    /* зажим на боковую планку: скоба + прижимной рычаг */
    P.add('clampPlate', O.mat, boxC(0, 14, 0, 10, 40, 78, 2.4, 0.5));
    P.add('dovetailJaw', 'steelDk', tr(rz(boxC(0, 0, 0, 8, 11, 74, 1.0, 0.3), D(6)), -4.0, 2.0, 0));
    P.add('lever', 'steel', tr(cylX(4.2, 4.2, -17, -7, 18), 0, 8.0, 24));
    P.add('leverArm', O.mat, boxC(-14.0, 22.0, 24, 5.0, 30.0, 8.0, 1.6, 0.3));
    P.add('leverSpring', 'steel', tr(spring(3.0, 0.6, 0, 8, 5), -10.0, 8.0, 12));

    /* вынос вверх и вперёд — прицел встаёт над ствольной коробкой */
    P.add('arm', O.mat, boxC(6.0, RAIL_Y - 14, -6, 22, 26, 68, 2.4, 0.5));
    P.add('armRib', O.mat, boxC(6.0, RAIL_Y - 24, -6, 10, 14, 64, 1.4, 0.3));
    P.add('rail', O.mat, tr(railStrip(84, 34, 5.2, 4.2), 0, RAIL_Y, 0));

    return { parts: P.list, meta: {
      slot: 'mount', name: 'Боковой кронштейн', short: 'БОК', weight: 290,
      rails: { top: { pos: [0, RAIL_Y, 34], rot: [0, 0, 0], len: 84, accepts: ['optic', 'magnifier'] } },
      stats: { adsSpeed: -2, mobility: -1, ergonomics: 2 } } };
  };

  /* Низкий переходник: просто планка поверх штатной колодки прицела */
  OUT.mount_rearsight = function (o) {
    const O = Object.assign({ mat: 'anod' }, o || {});
    const P = bag();
    const RAIL_Y = 12.4;
    P.add('base', O.mat, boxC(0, 4.0, 0, 24, 8.0, 64, 2.0, 0.4));
    for (const s of [-1, 1])
      P.add('clawJaw', 'steelDk', boxC(s * 11.0, 1.0, 0, 4.0, 10.0, 56, 1.0, 0.3));
    for (const z of [-20, 20])
      P.add('clampScrew', 'steel', tr(rx(capScrew(3.4, 9, 1.6), PI), 11.0, -2.0, z));
    P.add('rail', O.mat, tr(railStrip(60, -2, 5.0, 4.2), 0, RAIL_Y, 0));
    return { parts: P.list, meta: {
      slot: 'mount', name: 'Низкий переходник', short: 'НИЗКИЙ', weight: 90,
      rails: { top: { pos: [0, RAIL_Y, -2], rot: [0, 0, 0], len: 60, accepts: ['optic'] } },
      stats: { adsSpeed: 1, ergonomics: 1 } } };
  };

  /* Боковая планка под фонарь/ЛЦУ (SIDERAIL) — вешается на цевьё */
  OUT.siderail_short = function (o) {
    const O = Object.assign({ mat: 'anod', len: 76 }, o || {});
    const P = bag();
    const L = O.len;
    P.add('base', O.mat, boxC(0, 3.0, 0, 22, 6.0, L, 1.8, 0.4));
    P.add('rail', O.mat, tr(railStrip(L - 8, (L - 8) / 2, 5.0, 4.2), 0, 9.6, 0));
    for (const z of [-L / 2 + 12, L / 2 - 12])
      P.add('screw', 'steel', tr(rx(capScrew(3.0, 7, 1.4), PI), 0, 0.5, z));
    return { parts: P.list, meta: {
      slot: 'siderail', name: 'Боковая планка', short: 'ПЛАНКА', weight: 58, len: L,
      rails: { top: { pos: [0, 9.6, (L - 8) / 2], rot: [0, 0, 0], len: L - 8,
        accepts: ['tactical'] } },
      stats: { mobility: -1, ergonomics: 2 } } };
  };

  /* ==================================================================
     Боковые модули и мелочи
     ================================================================== */

  /* Боковая планка-переходник (для АК: планка на левую стенку) */
  OUT.sidemount_rail = function () {
    const P = bag();
    P.add('plate', 'anod', boxC(0, 0, 0, 8.0, 34, 86, 2.4, 0.5));
    P.add('dovetail', 'steelDk', tr(rz(boxC(0, 0, 0, 7.0, 12, 82, 1.0, 0.3), D(6)), -5.0, -12, 0));
    P.add('lever', 'steel', tr(cylX(4.5, 4.5, -18, -6, 18), 0, -6, 24));
    P.add('leverArm', 'anod', boxC(-16.0, 6.0, 24, 5.0, 28, 8.0, 1.6, 0.3));
    P.add('topRail', 'anod', tr(railStrip(80, 40, 5.0, 4.2), 0, 21.0, 0));
    return { parts: P.list, meta: {
      slot: 'sidemount', name: 'Боковая планка', short: 'ПЛАНКА', weight: 130,
      rails: { top: { pos: [0, 21.0, 40], rot: [0, 0, 0], len: 80 } },
      stats: { adsSpeed: -1, mobility: -1, ergonomics: 2 } } };
  };

  /* Ремень-антабка QD */
  OUT.sling_qd = function () {
    const P = bag();
    P.add('socket', 'steelDk', tr(cylX(5.6, 5.6, -4, 4, 20), 0, 0, 0));
    P.add('pushButton', 'steel', tr(cylX(2.4, 2.4, 4, 6.4, 14), 0, 0, 0));
    P.add('loop', 'steelDk', tr(ry(G.torus(8.0, 2.2, 26, 12), 0), 0, -10.0, 0));
    P.add('strap', 'rubber', boxC(0, -22.0, 0, 3.0, 22, 26, 1.0, 0.2));
    return { parts: P.list, meta: {
      slot: 'sling', name: 'Антабка QD', short: 'РЕМЕНЬ', weight: 40,
      stats: { adsSpeed: 1, mobility: 3, ergonomics: 2 } } };
  };

  return OUT;
};
