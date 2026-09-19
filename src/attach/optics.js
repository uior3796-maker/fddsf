/* ============================================================================
   Оптика: коллиматоры, голографический прицел, кратные прицелы, магнифер,
   ночной монокуляр и складная механика. Размеры в миллиметрах.

   Посадка: начало координат — центр верхней плоскости планки Пикатинни,
   +Z назад, дуло в −Z. Каждый модуль возвращает
     { parts:[{name,mat,geo}], meta:{...} }
   opticY — высота оптической оси над планкой (нужна камере ADS),
   glass  — имена деталей-стёкол (адаптер делает их прозрачными).
   ========================================================================== */
module.exports = function (G, C) {
  const { PI, TAU, D } = C;
  const { tr, rx, ry, rz, merge, extrude, lathe, cyl, tube } = G;
  const { bag, boxC, plateZY, cylX, cylY, railClamp, capScrew, knurlBand,
    lens, lensRing, reticleShapes, batteryCap, padButton, spring } = C;

  const OUT = {};

  /* Барабанчик поправок: гнездо, головка с накаткой, риски, шлиц под монету. */
  function turret(at, dir, o) {
    const O = Object.assign({ r: 6.0, h: 7.5, clicks: 12, mat: 'anod' }, o || {});
    const g = [];
    g.push(lathe([{ r: 0, z: 0 }, { r: O.r + 1.6, z: 0 }, { r: O.r + 1.6, z: 1.8, s: true },
      { r: O.r + 0.4, z: 2.4 }, { r: 0, z: 2.4 }], 28, true));
    g.push(tr(lathe([{ r: 0, z: 0 }, { r: O.r, z: 0 }, { r: O.r, z: O.h - 1.0, s: true },
      { r: O.r - 1.1, z: O.h }, { r: 0, z: O.h }], 30, true), 0, 0, 2.2));
    for (let i = 0; i < O.clicks; i++) {
      const a = i / O.clicks * TAU, long = i % 3 === 0;
      g.push(tr(cyl(0.3, 0.22, 3.2, 3.2 + (long ? 2.4 : 1.4), 6, true),
        Math.cos(a) * (O.r + 0.05), Math.sin(a) * (O.r + 0.05), 0));
    }
    g.push(C.boxZ(-O.r * 0.75, -0.8, O.r * 0.75, 0.8, O.h + 1.5, O.h + 2.4, 0.1, 0));
    for (const k of knurlBand({ r: O.r + 0.05, z0: 3.4, z1: O.h + 1.0, n: 28, depth: 0.34 })) g.push(k.geo);
    let all = merge(g);
    if (dir === 'up') all = rx(all, -PI / 2);
    else if (dir === 'right') all = ry(all, PI / 2);
    else if (dir === 'left') all = ry(all, -PI / 2);
    return [{ name: 'turret', mat: O.mat, geo: tr(all, at[0], at[1], at[2]) }];
  }

  /* Поднять детали модуля на высоту оптической оси, кроме деталей зажима. */
  const liftAll = (list, y) => {
    const m = G.mTrans(0, y, 0);
    for (const p of list) G.transform(p.geo, m);
    return list;
  };

  /* ==================================================================
     1. Коллиматор закрытого типа T-2: труба Ø30, QD-кронштейн lower 1/3
     ================================================================== */
  OUT.reddot_t2 = function (o) {
    const O = Object.assign({ mount: 'lower13', color: 'red' }, o || {});
    const P = bag();
    const OPT_Y = O.mount === 'absolute' ? 38.1 : 22.3;
    const R_OUT = 15.0, R_IN = 11.6, Z0 = -33, Z1 = 33;

    P.add('tube', 'anod', lathe([
      { r: R_IN, z: Z0 }, { r: R_OUT, z: Z0 }, { r: R_OUT, z: Z0 + 7, s: true },
      { r: R_OUT - 1.1, z: Z0 + 9, s: true }, { r: R_OUT - 1.1, z: Z1 - 9, s: true },
      { r: R_OUT, z: Z1 - 7, s: true }, { r: R_OUT, z: Z1 }, { r: R_IN, z: Z1 }], 48, true));
    P.add('lensFront', 'glassAR', tr(lens(R_IN - 0.3, 3.0, 0.9, 0.5, 30), 0, 0, Z0 + 5.5));
    P.add('lensRear', 'glass', tr(lens(R_IN - 0.3, 2.6, 0.5, 0.8, 30), 0, 0, Z1 - 5.5));
    P.add('lensRingF', 'steelDk', lensRing(R_IN - 0.4, R_IN + 0.5, Z0 + 3.4, Z0 + 4.1));
    P.add('lensRingR', 'steelDk', lensRing(R_IN - 0.4, R_IN + 0.5, Z1 - 4.1, Z1 - 3.4));

    P.add('turretBoss', 'anod', boxC(0, 0, 4.0, 26, 26, 22, 3.0, 0.4));
    P.addAll(turret([0, 13.0, 4.0], 'up', { r: 6.4, h: 8.0 }));
    P.addAll(turret([13.0, 0, 4.0], 'right', { r: 6.4, h: 8.0 }));

    P.add('battBoss', 'anod', tr(ry(lathe([{ r: 0, z: 0 }, { r: 10.5, z: 0 },
      { r: 10.5, z: 5.5, s: true }, { r: 0, z: 5.5 }], 32, true), -PI / 2), -13.0, 0, 4.0));
    for (const p of batteryCap(10.0, 5.2, 9.6, 'anod'))
      P.add(p.name, p.mat, tr(ry(p.geo, -PI / 2), -13.0, 0, 4.0));

    P.add('brightKnob', 'steelDk', tr(ry(lathe([{ r: 0, z: 0 }, { r: 7.0, z: 0 },
      { r: 7.0, z: 3.2, s: true }, { r: 5.6, z: 4.0 }, { r: 0, z: 4.0 }], 28, true), PI / 2), 13.4, 0, -10.0));
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      P.add('brightTick', 'mark', tr(ry(cyl(0.32, 0.32, 0, 1.2, 8, true), PI / 2),
        14.0, Math.sin(a) * 5.4, -10.0 + Math.cos(a) * 5.4));
    }

    for (const [z, nm] of [[Z0 - 1.5, 'capFront'], [Z1 + 1.5, 'capRear']]) {
      const s = z < 0 ? 1 : -1;
      P.add(nm, 'poly', tr(rx(lathe([{ r: 0, z: 0 }, { r: R_OUT + 0.6, z: 0 },
        { r: R_OUT + 0.6, z: 1.6, s: true }, { r: 0, z: 1.6 }], 34, true), -PI / 2), 0, R_OUT + 2.0, z + s * 12));
      P.add(nm + 'Hinge', 'poly', tr(cylX(2.2, 2.2, -3, 3, 14), 0, R_OUT + 1.0, z));
    }

    P.add('mountPost', 'anod', boxC(0, -OPT_Y / 2 + 2, 0, 24, OPT_Y - 6, 44, 2.4, 0.4));
    P.add('mountFoot', 'anod', boxC(0, -OPT_Y + 4.0, 0, 26, 8.0, 52, 2.0, 0.4));
    P.add('mountRing', 'anod', tube(R_OUT, R_OUT + 3.4, -14, 14, 40));
    P.add('mountRingSplit', 'anod', boxC(0, -R_OUT - 3.0, 0, 9.0, 8.0, 28, 1.0, 0.3));
    for (const z of [-11, 11]) P.add('ringScrew', 'steel', tr(rx(capScrew(3.0, 7, 1.5), PI), 0, -R_OUT - 6.4, z));
    P.add('reticle', 'reticle', tr(reticleShapes([{ k: 'dot', x: 0, y: 0, r: 0.30 }], 0), 0, 0, Z0 + 7.0));

    liftAll(P.list, OPT_Y);
    for (const p of railClamp({ len: 52, style: 'qd', side: -1, lugs: [-10.16, 0, 10.16], base: 4.2, width: 26 }))
      P.add(p.name, p.mat, p.geo);

    return { parts: P.list, meta: {
      slot: 'optic', name: 'Коллиматор T-2', short: 'T-2', opticY: OPT_Y,
      eyeZ: 120, exitPupil: 62, magnify: 1, glass: ['lensFront', 'lensRear'],
      reticle: { part: 'reticle', color: O.color, moa: 2 }, weight: 145, zeroClickMOA: 0.5,
      stats: { adsSpeed: -4, precision: 8, hipSpread: 0 }, foldIrons: true } };
  };

  /* ==================================================================
     2. Голографический прицел EXPS3: тоннель 52x54, окно 33x23
     ================================================================== */
  OUT.holo_exps3 = function (o) {
    const O = Object.assign({ color: 'red' }, o || {});
    const P = bag();
    const MH = 12, OPT_Y = 35, SH_W = 52, SH_H = 54, WW = 33, WH = 23, WR = 3;
    const Z0 = -34, Z1 = 54, CY = SH_H / 2;

    const outer = G.round([[-SH_W / 2, -SH_H / 2], [SH_W / 2, -SH_H / 2],
      [SH_W / 2, SH_H / 2], [-SH_W / 2, SH_H / 2]], 5);
    const win = G.round([[-WW / 2, OPT_Y - CY - WH / 2], [WW / 2, OPT_Y - CY - WH / 2],
      [WW / 2, OPT_Y - CY + WH / 2], [-WW / 2, OPT_Y - CY + WH / 2]], WR);
    P.add('shell', 'anodMatt', tr(extrude({ outer, holes: [win] }, { z0: Z0, z1: Z1, ch: 0.6 }), 0, MH + CY, 0));

    for (let i = 0; i < 3; i++)
      P.add('ribTop', 'anodMatt', boxC(0, MH + SH_H + 0.4, 6 + i * 12, SH_W - 6, 2.2, 3.2, 0.6, 0.2));
    P.add('ribSpine', 'anodMatt', boxC(0, MH + SH_H + 0.6, 12, 10, 2.4, 70, 1.0, 0.3));
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++)
      P.add('vent', 'anodMatt', boxC(s * (SH_W / 2 + 0.3), 20 + i * 6, 30, 1.6, 4.5, 22, 0.4, 0.1));

    P.add('window', 'glassAR', tr(rx(C.boxZ(-WW / 2 + 0.6, -WH / 2 + 0.6, WW / 2 - 0.6, WH / 2 - 0.6,
      -1.1, 1.1, WR - 0.6, 0.2), D(6)), 0, MH + OPT_Y, -30));
    P.add('windowRear', 'glass', tr(C.boxZ(-WW / 2 + 1.4, -WH / 2 + 1.4, WW / 2 - 1.4, WH / 2 - 1.4,
      -0.7, 0.7, WR - 1, 0.2), 0, MH + OPT_Y, 44));
    P.add('reticle', 'reticle', tr(reticleShapes([{ k: 'ring', r: 5.9, w: 0.42 },
      { k: 'dot', x: 0, y: 0, r: 0.22 }], 0), 0, MH + OPT_Y, -29));

    P.addAll(turret([0, MH + SH_H, 40], 'up', { r: 6.0, h: 5.0, clicks: 10, mat: 'anodMatt' }));
    P.addAll(turret([SH_W / 2, MH + 30, 40], 'right', { r: 6.0, h: 5.0, clicks: 10, mat: 'anodMatt' }));

    P.add('battBody', 'anodMatt', boxC(0, MH + 19.5, -27, 25, 15, 30, 2.5, 0.4));
    for (const p of batteryCap(5.6, 0, 3.4, 'anodMatt'))
      P.add(p.name, p.mat, tr(rx(p.geo, -PI / 2), 0, MH + 19.5, -43.0));

    P.add('btnBoss', 'anodMatt', tr(ry(boxC(0, 0, 0, 16, 30, 4, 2.5, 0.4), PI / 2), -SH_W / 2 - 0.6, MH + 24, 34));
    for (const dz of [-5.5, 5.5])
      P.add('button', 'rubber', tr(rz(padButton(4.6, 0, 1.6, [0, 0, 0]), PI / 2), -SH_W / 2 - 1.0, MH + 24, 34 + dz));

    P.add('mountBody', 'anodMatt', boxC(0, MH / 2 + 2.2, 0, 28, MH - 3.4, 60, 2.0, 0.4));
    for (const p of railClamp({ len: 58, style: 'qd', side: -1, lugs: [-10.16, 0, 10.16], base: 4.4, width: 26 }))
      P.add(p.name, p.mat, p.geo);

    return { parts: P.list, meta: {
      slot: 'optic', name: 'Голографический EXPS3', short: 'EXPS3', opticY: MH + OPT_Y,
      eyeZ: 130, exitPupil: 70, magnify: 1, glass: ['window', 'windowRear'],
      reticle: { part: 'reticle', color: O.color, moa: 68 }, weight: 320, zeroClickMOA: 0.5,
      stats: { adsSpeed: -6, precision: 10, hipSpread: 0 }, foldIrons: true } };
  };

  /* ==================================================================
     3. Мини-коллиматор RMR: открытый, ставится на затвор или на 45°
     ================================================================== */
  OUT.reddot_rmr = function (o) {
    const O = Object.assign({ color: 'red', lowMount: true }, o || {});
    const P = bag();
    const BASE = O.lowMount ? 2.2 : 7.0, OPT_Y = BASE + 13.6, W = 25.6, L = 45.0;

    for (const s of [-1, 1]) {
      const side = [[-L / 2, BASE], [L / 2 - 2, BASE], [L / 2 - 1, BASE + 6],
        [L / 2 - 2.5, BASE + 20], [-L / 2 + 4, BASE + 21.5], [-L / 2, BASE + 12]];
      P.add('body', 'anod', tr(plateZY(side, 0, 3.4), s * (W / 2 - 1.7), 0, 0));
    }
    P.add('bridge', 'anod', boxC(0, BASE + 19.5, L / 2 - 4.0, W, 4.2, 7.0, 1.4, 0.3));
    P.add('floor', 'anod', boxC(0, BASE + 1.6, 0, W, 3.2, L - 3, 1.4, 0.3));
    P.add('window', 'glassAR', tr(rx(C.boxZ(-9.5, -7.5, 9.5, 7.5, -0.6, 0.6, 1.6, 0.2), D(8)), 0, OPT_Y, -6.0));
    P.add('reticle', 'reticle', tr(reticleShapes([{ k: 'dot', r: 0.26 }], 0), 0, OPT_Y, -5.2));
    P.addAll(turret([0, BASE + 21.5, -14], 'up', { r: 4.2, h: 3.4, clicks: 8 }));
    P.addAll(turret([W / 2 - 1.2, OPT_Y - 2, -14], 'right', { r: 4.2, h: 3.4, clicks: 8 }));
    P.add('battTray', 'anod', boxC(0, BASE + 0.8, -L / 2 + 8, 17, 2.6, 15, 1.2, 0.2));
    for (const z of [-12, 12]) {
      P.add('rmrPin', 'steel', tr(cylY(2.0, 2.0, BASE - 3.2, BASE, 14), 0, 0, z));
      P.add('rmrScrew', 'steel', tr(rx(capScrew(3.0, 6.5, 1.4), PI), 0, BASE + 4.6, z + (z > 0 ? -5 : 5)));
    }
    if (!O.lowMount)
      for (const p of railClamp({ len: 38, style: 'crossbolt', side: 1, lugs: [0], base: 3.4, width: 24 }))
        P.add(p.name, p.mat, p.geo);

    return { parts: P.list, meta: {
      slot: 'optic', name: 'Мини-коллиматор RMR', short: 'RMR', opticY: OPT_Y,
      eyeZ: 110, exitPupil: 999, magnify: 1, glass: ['window'],
      reticle: { part: 'reticle', color: O.color, moa: 3.25 }, weight: 32, zeroClickMOA: 1,
      stats: { adsSpeed: -1, precision: 5, hipSpread: 0 }, foldIrons: false, canBeOffset: true } };
  };

  /* ==================================================================
     4. Прицел 1-6x24: труба Ø30, кольца, кольцо кратности, сетка с падением
     ================================================================== */
  OUT.scope_1_6x = function (o) {
    const O = Object.assign({ mag: 4 }, o || {});
    const P = bag();
    const OPT_Y = 38.0, R_T = 15.0, R_OBJ = 21.0, R_OC = 20.0, Z_OBJ = -118, Z_OC = 112;

    P.add('objBell', 'anod', lathe([
      { r: R_OBJ - 1.2, z: Z_OBJ }, { r: R_OBJ, z: Z_OBJ }, { r: R_OBJ, z: Z_OBJ + 26, s: true },
      { r: R_T, z: Z_OBJ + 44, s: true }, { r: R_T, z: Z_OBJ + 52 }, { r: R_T - 1.4, z: Z_OBJ + 52 },
      { r: R_T - 1.4, z: Z_OBJ + 44, s: true }, { r: R_OBJ - 1.2, z: Z_OBJ + 26, s: true }], 44, true));
    P.add('tube', 'anod', tube(R_T - 1.4, R_T, Z_OBJ + 52, 46, 44));
    P.add('ocBell', 'anod', lathe([
      { r: R_T - 1.4, z: 46 }, { r: R_T, z: 46 }, { r: R_OC, z: 70, s: true },
      { r: R_OC, z: Z_OC - 8, s: true }, { r: R_OC + 1.4, z: Z_OC - 6, s: true },
      { r: R_OC + 1.4, z: Z_OC }, { r: R_OC - 2.0, z: Z_OC },
      { r: R_OC - 2.0, z: Z_OC - 6, s: true }, { r: R_T - 1.4, z: 70, s: true }], 44, true));
    P.add('lensObj', 'glassAR', tr(lens(R_OBJ - 2.0, 5.5, 1.8, 1.0, 34), 0, 0, Z_OBJ + 6));
    P.add('lensOc', 'glass', tr(lens(R_OC - 3.0, 4.0, 0.9, 1.4, 32), 0, 0, Z_OC - 8));
    P.add('lensErector', 'glass', tr(lens(R_T - 4.0, 3.0, 0.8, 0.8, 26), 0, 0, -20));

    P.add('magRing', 'anodMatt', lathe([{ r: R_T - 1.0, z: 58 }, { r: R_OC - 1.0, z: 58 },
      { r: R_OC - 1.0, z: 80, s: true }, { r: R_T - 1.0, z: 80 }], 40, true));
    P.addAll(knurlBand({ r: R_OC - 0.9, z0: 60, z1: 78, n: 40, depth: 0.45, mat: 'anodMatt' }));
    P.add('magLever', 'anod', tr(rz(boxC(0, 9.0, 0, 5.0, 18.0, 6.0, 1.4, 0.3), D(-28)), 0, R_OC - 2, 69));
    for (let i = 1; i <= 6; i++) {
      const a = D(-60 + i * 22);
      P.add('magMark', 'mark', tr(cyl(0.4, 0.4, 0, 1.0, 8, true),
        Math.sin(a) * (R_OC - 0.5), Math.cos(a) * (R_OC - 0.5), 82));
    }

    P.add('turretBoss', 'anod', tr(lathe([{ r: 0, z: 0 }, { r: 19.0, z: 0 },
      { r: 19.0, z: 24, s: true }, { r: 0, z: 24 }], 34, true), 0, 0, -30));
    P.addAll(turret([0, 18.0, -18], 'up', { r: 8.5, h: 11.0, clicks: 16 }));
    P.addAll(turret([18.0, 0, -18], 'right', { r: 8.0, h: 10.0, clicks: 16 }));
    P.addAll(turret([-18.0, 0, -18], 'left', { r: 7.0, h: 7.0, clicks: 8 }));

    P.add('eyecup', 'rubber', tr(lathe([{ r: R_OC - 2.0, z: 0 }, { r: R_OC + 1.8, z: 0 },
      { r: R_OC + 1.8, z: 10, s: true }, { r: R_OC - 1.0, z: 12 }, { r: R_OC - 3.0, z: 12 },
      { r: R_OC - 3.0, z: 2, s: true }], 40, true), 0, 0, Z_OC));
    P.add('sunshade', 'anod', tube(R_OBJ - 1.2, R_OBJ, Z_OBJ - 26, Z_OBJ, 40));

    const ret = [
      { k: 'bar', x0: -6.2, y0: -0.10, x1: -0.7, y1: 0.10 },
      { k: 'bar', x0: 0.7, y0: -0.10, x1: 6.2, y1: 0.10 },
      { k: 'bar', x0: -0.10, y0: 0.7, x1: 0.10, y1: 6.2 },
      { k: 'dot', x: 0, y: 0, r: 0.13 }];
    for (let i = 1; i <= 5; i++) {
      const y = -0.9 - i * 0.95, w = 0.95 - i * 0.11;
      ret.push({ k: 'bar', x0: -w, y0: y - 0.07, x1: w, y1: y + 0.07 });
    }
    for (const s of [-1, 1]) for (let i = 1; i <= 4; i++)
      ret.push({ k: 'bar', x0: s * i * 1.6 - 0.07, y0: -0.45, x1: s * i * 1.6 + 0.07, y1: 0.45 });
    P.add('reticle', 'reticle', tr(reticleShapes(ret, 0), 0, 0, 40));

    for (const z of [-60, 20]) {
      P.add('ring', 'anod', tr(tube(R_T, R_T + 4.2, -9, 9, 36), 0, 0, z));
      P.add('ringFoot', 'anod', boxC(0, -R_T - 6.0, z, 24, 8.0, 20, 1.6, 0.3));
      for (const s of [-1, 1]) {
        P.add('ringScrew', 'steel', tr(rx(capScrew(3.4, 8, 1.6), PI), s * 9.0, -R_T - 9.2, z));
        P.add('ringScrewTop', 'steel', tr(capScrew(3.4, 8, 1.6), s * 9.0, R_T + 1.2, z));
      }
    }
    P.add('mountBar', 'anod', boxC(0, -R_T - 11.0, -20, 26, 6.0, 108, 1.6, 0.3));
    liftAll(P.list, OPT_Y);
    for (const p of railClamp({ len: 104, style: 'crossbolt', side: 1, lugs: [-30, -10, 10, 30], base: 4.4, width: 26 }))
      P.add(p.name, p.mat, tr(p.geo, 0, 0, -20));

    return { parts: P.list, meta: {
      slot: 'optic', name: 'Прицел 1-6x24', short: '1-6x', opticY: OPT_Y,
      eyeZ: 95, exitPupil: 88, fov: 10.5, magnify: O.mag, magRange: [1, 6],
      glass: ['lensObj', 'lensOc', 'lensErector'], reticle: { part: 'reticle', color: 'red', moa: 0.8 },
      weight: 620, zeroClickMOA: 0.25, stats: { adsSpeed: -14, precision: 26, hipSpread: 6 },
      foldIrons: true, scopeShadow: true } };
  };

  /* ==================================================================
     5. ПСО-1 4×24 на боковом кронштейне «ласточкин хвост»
     ================================================================== */
  OUT.scope_pso1 = function () {
    const P = bag();
    const OPT_Y = 60.0, R_T = 17.0, R_OBJ = 19.0, Z_OBJ = -128, Z_OC = 96;

    P.add('objBell', 'anodMatt', lathe([
      { r: R_OBJ - 1.4, z: Z_OBJ }, { r: R_OBJ, z: Z_OBJ }, { r: R_OBJ, z: Z_OBJ + 60, s: true },
      { r: R_T, z: Z_OBJ + 70, s: true }, { r: R_T, z: Z_OBJ + 76 }, { r: R_T - 1.5, z: Z_OBJ + 76 },
      { r: R_T - 1.5, z: Z_OBJ + 70, s: true }, { r: R_OBJ - 1.4, z: Z_OBJ + 60, s: true }], 40, true));
    P.add('tube', 'anodMatt', tube(R_T - 1.5, R_T, Z_OBJ + 76, 60, 40));
    P.add('ocBell', 'anodMatt', lathe([{ r: R_T - 1.5, z: 60 }, { r: R_T, z: 60 },
      { r: 19.5, z: 74, s: true }, { r: 19.5, z: Z_OC, s: true }, { r: 16.5, z: Z_OC },
      { r: 16.5, z: 74, s: true }], 40, true));
    P.add('lensObj', 'glassAR', tr(lens(R_OBJ - 2.4, 5.0, 1.6, 0.9, 32), 0, 0, Z_OBJ + 7));
    P.add('lensOc', 'glass', tr(lens(15.5, 3.6, 0.8, 1.2, 30), 0, 0, Z_OC - 7));
    P.add('eyecup', 'rubber', tr(lathe([{ r: 16.0, z: 0 }, { r: 21.0, z: 0 },
      { r: 21.0, z: 14, s: true }, { r: 17.5, z: 16 }, { r: 15.0, z: 16 },
      { r: 15.0, z: 2, s: true }], 36, true), 0, 0, Z_OC));

    P.add('turretHousing', 'anodMatt', boxC(0, 6.0, -34, 30, 24, 34, 3.0, 0.5));
    P.addAll(turret([0, 19.0, -34], 'up', { r: 10.5, h: 14.0, clicks: 10, mat: 'anodMatt' }));
    P.addAll(turret([16.0, 2.0, -34], 'right', { r: 9.5, h: 12.0, clicks: 10, mat: 'anodMatt' }));
    P.add('illumBody', 'anodMatt', tr(ry(lathe([{ r: 0, z: 0 }, { r: 9.0, z: 0 },
      { r: 9.0, z: 26, s: true }, { r: 7.4, z: 28 }, { r: 0, z: 28 }], 28, true), -PI / 2), -14.0, -2.0, -34));
    P.add('illumSwitch', 'poly', tr(boxC(0, 0, 0, 5.0, 9.0, 5.0, 1.0, 0.2), -42.0, 2.0, -34));
    P.add('sunFilter', 'poly', tr(rx(tube(11.0, R_OBJ - 1.0, 0, 2.4, 30), D(-70)), 0, R_OBJ + 8, Z_OBJ + 2));
    P.add('filterArm', 'anodMatt', tr(boxC(0, 0, 0, 3.0, 14.0, 3.0, 0.8, 0.2), 0, R_OBJ + 3, Z_OBJ + 8));

    const ret = [{ k: 'chevron', x: 0, y: 0, w: 0.16, h: 1.15 }];
    for (let i = 1; i <= 3; i++) ret.push({ k: 'chevron', x: 0, y: -1.5 * i, w: 0.13, h: 0.72 });
    for (const s of [-1, 1]) for (let i = 1; i <= 5; i++)
      ret.push({ k: 'bar', x0: s * i * 1.05 - 0.07, y0: 0, x1: s * i * 1.05 + 0.07, y1: i % 2 ? 0.38 : 0.60 });
    for (let i = 0; i < 7; i++) {
      const x = -6.4 + i * 0.52;
      ret.push({ k: 'bar', x0: x - 0.05, y0: -2.0, x1: x + 0.05, y1: -2.0 + 0.36 + i * 0.075 });
    }
    ret.push({ k: 'bar', x0: -6.6, y0: -2.06, x1: -3.0, y1: -1.94 });
    P.add('reticle', 'reticle', tr(reticleShapes(ret, 0), 0, 0, 30));

    P.add('mountBody', 'anodMatt', tr(boxC(0, 0, 0, 16, 46, 72, 3.0, 0.5), -16.0, -OPT_Y + 26, -18));
    P.add('mountArm', 'anodMatt', tr(boxC(0, 0, 0, 30, 14, 40, 2.4, 0.4), -6.0, -OPT_Y + 46, -18));
    P.add('mountDovetail', 'steelDk', tr(rz(boxC(0, 0, 0, 12, 10, 68, 1.0, 0.3), D(6)), -24.0, -OPT_Y + 14, -18));
    P.add('mountLever', 'steel', tr(cylX(4.0, 4.0, -34, -18, 18), 0, -OPT_Y + 12, 6));
    P.add('mountLeverArm', 'anodMatt', tr(boxC(0, 0, 0, 5.0, 26.0, 8.0, 1.6, 0.3), -32.0, -OPT_Y + 22, 6));
    for (const z of [-40, 4]) P.add('mountRing', 'anodMatt', tr(tube(R_T, R_T + 4.0, -8, 8, 34), 0, 0, z));

    liftAll(P.list, OPT_Y);
    return { parts: P.list, meta: {
      slot: 'optic', name: 'ПСО-1 4×24', short: 'ПСО-1', opticY: OPT_Y,
      eyeZ: 78, exitPupil: 68, fov: 6.0, magnify: 4, glass: ['lensObj', 'lensOc'],
      reticle: { part: 'reticle', color: 'red', moa: 0.6 }, weight: 580, zeroClickMOA: 0.34,
      mountType: 'sidemount', stats: { adsSpeed: -18, precision: 30, hipSpread: 8 },
      foldIrons: false, scopeShadow: true } };
  };

  /* ==================================================================
     6. Магнифер 3x на откидном кронштейне
     ================================================================== */
  OUT.magnifier_3x = function () {
    const P = bag();
    const OPT_Y = 22.3, R = 17.5, Z0 = -40, Z1 = 40;
    P.add('body', 'anod', lathe([{ r: R - 1.6, z: Z0 }, { r: R, z: Z0 },
      { r: R, z: Z0 + 10, s: true }, { r: R - 0.8, z: Z0 + 13, s: true },
      { r: R - 0.8, z: Z1 - 16, s: true }, { r: R, z: Z1 - 13, s: true },
      { r: R, z: Z1 }, { r: R - 1.6, z: Z1 }], 42, true));
    P.add('lensFront', 'glassAR', tr(lens(R - 3.0, 4.2, 1.3, 0.8, 30), 0, 0, Z0 + 6));
    P.add('lensRear', 'glass', tr(lens(R - 3.4, 3.4, 0.7, 1.1, 30), 0, 0, Z1 - 7));
    P.add('diopterRing', 'anodMatt', lathe([{ r: R - 0.7, z: Z1 - 14 }, { r: R + 1.2, z: Z1 - 14 },
      { r: R + 1.2, z: Z1 - 2, s: true }, { r: R - 0.7, z: Z1 - 2 }], 36, true));
    P.addAll(knurlBand({ r: R + 1.25, z0: Z1 - 12, z1: Z1 - 4, n: 34, depth: 0.4, mat: 'anodMatt' }));
    P.add('eyecup', 'rubber', tube(R - 2.0, R + 1.0, Z1, Z1 + 6, 36));
    P.add('mountRing', 'anod', tube(R, R + 3.6, -12, 12, 34));
    P.add('mountArm', 'anod', tr(boxC(0, 0, 0, 9.0, OPT_Y + 4, 22, 1.8, 0.3), -(R + 6.0), -OPT_Y / 2 + 2, 0));
    P.add('flipPivot', 'steel', tr(cylY(3.2, 3.2, -OPT_Y + 2, 6, 18), -(R + 6.0), 0, 0));
    P.add('flipLatch', 'steel', tr(boxC(0, 0, 0, 5.0, 6.0, 16, 1.0, 0.2), R + 5.0, -OPT_Y + 8, 0));
    P.add('mountBase', 'anod', tr(boxC(0, 0, 0, 26, 7.0, 54, 1.8, 0.3), 0, -OPT_Y + 3.5, 0));
    liftAll(P.list, OPT_Y);
    for (const p of railClamp({ len: 54, style: 'thumb', side: 1, lugs: [-10.16, 10.16], base: 4.0, width: 26 }))
      P.add(p.name, p.mat, p.geo);

    return { parts: P.list, meta: {
      slot: 'magnifier', name: 'Магнифер 3x', short: '3x', opticY: OPT_Y, magnify: 3,
      glass: ['lensFront', 'lensRear'], weight: 260,
      flipAxis: { pivot: [-(R + 6.0), OPT_Y, 0], axis: 'y', angle: 90 },
      pivotParts: ['body', 'lensFront', 'lensRear', 'diopterRing', 'eyecup', 'mountRing', 'flipLatch'],
      stats: { adsSpeed: -6, precision: 12, hipSpread: 0 } } };
  };

  /* ==================================================================
     7. Складная механика BUIS: целик с диоптром / мушка в подкове
     ================================================================== */
  OUT.irons_buis = function (o) {
    const O = Object.assign({ which: 'rear' }, o || {});
    const P = bag();
    const H = 36.0;
    P.add('base', 'anod', boxC(0, 3.0, 0, 20, 6.0, 26, 1.4, 0.3));
    P.add('hinge', 'steel', tr(cylX(2.6, 2.6, -8, 8, 16), 0, 6.5, 10.0));

    if (O.which === 'rear') {
      for (const s of [-1, 1])
        P.add('ear', 'anod', tr(plateZY([[-9, 6], [9, 6], [7, H], [4, H + 3], [-4, H + 3], [-7, H]], 0, 2.6), s * 7.0, 0, 0));
      P.add('aperture', 'anod', tr(tube(2.1, 5.2, -1.4, 1.4, 28), 0, H - 4, 0));
      P.add('apertureBig', 'anod', tr(tube(3.6, 6.4, -1.4, 1.4, 28), 0, H - 4, 9.0));
      P.add('windageKnob', 'steelDk', tr(cylX(3.6, 3.6, 9.4, 13.0, 18), 0, H - 8, 0));
      P.addAll(knurlBand({ r: 3.6, a0: 9.6, a1: 12.8, n: 16, depth: 0.28, axis: 'x', at: [0, H - 8, 0], mat: 'steelDk' }));
      P.add('detentSpring', 'steel', tr(spring(2.2, 0.5, 0, 7, 5), 0, 8.0, 6.0));
    } else {
      P.add('wing', 'anod', tr(tube(5.0, 7.2, -3.0, 3.0, 26), 0, H - 6, 0));
      for (const s of [-1, 1])
        P.add('wingLeg', 'anod', boxC(s * 5.6, H / 2 + 3, 0, 2.8, H - 10, 6.0, 0.8, 0.2));
      P.add('post', 'steelDk', tr(cylY(1.1, 0.9, H - 12, H - 2.0, 14), 0, 0, 0));
      P.add('postBase', 'steelDk', tr(cylY(2.6, 2.6, H - 14, H - 12, 16), 0, 0, 0));
    }
    for (const p of railClamp({ len: 26, style: 'crossbolt', side: 1, lugs: [0], base: 3.0, width: 20 }))
      P.add(p.name, p.mat, p.geo);

    return { parts: P.list, meta: {
      slot: O.which === 'rear' ? 'ironRear' : 'ironFront',
      name: O.which === 'rear' ? 'Складной целик' : 'Складная мушка',
      short: 'BUIS', opticY: H - 4, weight: 60,
      foldAxis: { pivot: [0, 6.5, 10.0], axis: 'x', angle: -88 },
      stats: { adsSpeed: 0, precision: 2, hipSpread: 0 } } };
  };

  /* ==================================================================
     8. Ночной монокуляр PVS-14 за коллиматором
     ================================================================== */
  OUT.nvg_pvs14 = function () {
    const P = bag();
    const OPT_Y = 22.3, R = 17.0, Z0 = -46, Z1 = 52;
    P.add('body', 'od', lathe([{ r: R - 2.0, z: Z0 }, { r: R, z: Z0 },
      { r: R, z: Z0 + 20, s: true }, { r: R + 2.6, z: Z0 + 24, s: true },
      { r: R + 2.6, z: Z1 - 26, s: true }, { r: R, z: Z1 - 22, s: true },
      { r: R, z: Z1 }, { r: R - 2.0, z: Z1 }], 40, true));
    P.add('objLens', 'glassAR', tr(lens(R - 3.4, 4.0, 1.2, 0.7, 30), 0, 0, Z0 + 6));
    P.add('ocLens', 'glass', tr(lens(R - 4.0, 3.2, 0.7, 1.0, 30), 0, 0, Z1 - 8));
    P.add('screen', 'laserIR', cyl(R - 5.0, R - 5.0, 6, 6.4, 30, true));
    P.add('gainKnob', 'od', tr(ry(cyl(5.4, 5.4, 0, 4.0, 22, true), PI / 2), R + 1.0, 0, 8));
    P.add('battTube', 'od', tr(ry(cyl(8.0, 8.0, 0, 34, 26, true), -PI / 2), -R - 4, 0, 24));
    for (const p of batteryCap(8.2, 0, 5.0, 'od'))
      P.add(p.name, p.mat, tr(ry(p.geo, -PI / 2), -R - 38, 0, 24));
    P.add('mountBase', 'od', boxC(0, -OPT_Y + 4, 0, 24, 8.0, 44, 1.6, 0.3));
    liftAll(P.list, OPT_Y);
    for (const p of railClamp({ len: 44, style: 'thumb', side: 1, lugs: [-10.16, 10.16], base: 4.0, width: 24 }))
      P.add(p.name, p.mat, p.geo);

    return { parts: P.list, meta: {
      slot: 'magnifier', name: 'Монокуляр PVS-14', short: 'PVS-14', opticY: OPT_Y,
      magnify: 1, glass: ['objLens', 'ocLens'], weight: 340, nightVision: true,
      stats: { adsSpeed: -8, precision: 4, hipSpread: 0 } } };
  };

  return OUT;
};
