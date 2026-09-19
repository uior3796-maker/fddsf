/* ============================================================================
   Тактические модули: фонарь, лазерный целеуказатель, комбо-блок,
   передние рукоятки, упор кисти, сошки.

   Посадка: начало координат — центр верхней плоскости планки Пикатинни.
   Для нижних слотов оружие само поворачивает модуль на 180° вокруг Z,
   поэтому все модули строятся в «нормальной» ориентации (вверх от планки).
   ========================================================================== */
module.exports = function (G, C) {
  const { PI, TAU, D } = C;
  const { tr, rx, ry, rz, merge, lathe, cyl, tube, loft } = G;
  const { bag, boxC, boxZ, plateZY, cylX, cylY, sphere, railClamp, capScrew,
    knurlBand, lens, batteryCap, padButton, spring } = C;

  const OUT = {};

  /* Единая система: модуль растёт в +Y от плоскости планки, зажим смотрит в −Y.
     Нижние модули (рукоятки, сошки) удобнее строить «свисающими», поэтому после
     сборки их тело разворачивается на 180° вокруг Z. Слот нижней планки сам
     повернёт готовый модуль обратно вниз. */
  const flipUp = (list) => { for (const p of list) G.transform(p.geo, G.mRotZ(PI)); return list; };

  /* Хвостовик фонаря: колпачок с накаткой, резиновая кнопка, гнездо выноса. */
  function tailCap(r, z0, len, mat) {
    const P = bag();
    P.add('tailBody', mat || 'anod', lathe([
      { r: 0, z: z0 }, { r: r, z: z0 }, { r: r, z: z0 + len - 2.5, s: true },
      { r: r - 1.6, z: z0 + len }, { r: 0, z: z0 + len }], 30, true));
    P.addAll(knurlBand({ r: r + 0.05, z0: z0 + 1.5, z1: z0 + len - 3.5, n: 24, depth: 0.36, mat: mat || 'anod' }));
    P.add('tailButton', 'rubber', tr(lathe([{ r: 0, z: 0 }, { r: r - 2.6, z: 0 },
      { r: r - 3.2, z: 1.8, s: true }, { r: 0, z: 2.4 }], 24, true), 0, 0, z0 + len));
    P.add('remotePort', 'steelDk', tr(ry(cyl(2.6, 2.6, 0, 3.4, 16, true), PI / 2), r - 0.8, 0, z0 + len * 0.45));
    return P.list;
  }

  /* ==================================================================
     1. Тактический фонарь: безель-корона, параболический рефлектор, LED
     ================================================================== */
  OUT.light_tac = function (o) {
    const O = Object.assign({ mat: 'anod' }, o || {});
    const P = bag();
    const Y = 30.0, R_HEAD = 15.4, R_BODY = 11.6, Z_LENS = -66, Z_TAIL = 34;

    P.add('bezel', O.mat, lathe([
      { r: R_HEAD - 3.0, z: Z_LENS }, { r: R_HEAD, z: Z_LENS },
      { r: R_HEAD, z: Z_LENS + 6, s: true }, { r: R_HEAD - 0.8, z: Z_LENS + 9, s: true },
      { r: R_HEAD - 0.8, z: Z_LENS + 22, s: true }, { r: R_BODY + 0.6, z: Z_LENS + 28, s: true },
      { r: R_BODY - 1.4, z: Z_LENS + 28 }, { r: R_BODY - 1.4, z: Z_LENS + 22, s: true },
      { r: R_HEAD - 3.0, z: Z_LENS + 9, s: true }], 44, true));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      P.add('crenel', O.mat, tr(cyl(1.9, 1.5, Z_LENS - 2.6, Z_LENS, 10, true),
        Math.cos(a) * (R_HEAD - 1.6), Math.sin(a) * (R_HEAD - 1.6), 0));
    }
    const refl = [], F = 2.0;
    for (let i = 0; i <= 22; i++) { const rr = 1.4 + (R_HEAD - 4.4) * (i / 22); refl.push({ r: rr, z: Z_LENS + 20 - rr * rr / (4 * F) * 0.62, s: true }); }
    for (let i = 22; i >= 0; i--) { const rr = 1.4 + (R_HEAD - 4.4) * (i / 22); refl.push({ r: rr, z: Z_LENS + 20.6 - rr * rr / (4 * F) * 0.62, s: true }); }
    P.add('reflector', 'steel', lathe(refl, 48, true));
    P.add('lens', 'glass', tr(lens(R_HEAD - 3.2, 2.2, 0.0, 0.0, 34), 0, 0, Z_LENS + 4.6));
    P.add('led', 'lampHot', tr(cyl(1.9, 1.9, 0, 0.9, 16, true), 0, 0, Z_LENS + 19.6));
    P.add('ledBoard', 'steelDk', tr(cyl(4.4, 4.4, -0.8, 0, 20, true), 0, 0, Z_LENS + 19.6));

    P.add('body', O.mat, lathe([
      { r: R_BODY - 1.6, z: Z_LENS + 28 }, { r: R_BODY, z: Z_LENS + 28 },
      { r: R_BODY, z: Z_TAIL - 6, s: true }, { r: R_BODY + 0.8, z: Z_TAIL - 4, s: true },
      { r: R_BODY + 0.8, z: Z_TAIL }, { r: R_BODY - 1.6, z: Z_TAIL }], 40, true));
    for (let i = 0; i < 5; i++)
      P.add('fin', O.mat, tr(tube(R_BODY - 0.2, R_BODY + 1.3, -1.0, 1.0, 40), 0, 0, Z_LENS + 34 + i * 6));
    P.addAll(knurlBand({ r: R_BODY + 0.05, z0: Z_LENS + 70, z1: Z_TAIL - 8, n: 34, depth: 0.42, mat: O.mat }));
    P.addAll(tailCap(R_BODY + 0.8, Z_TAIL, 9, O.mat));

    P.add('ringMount', O.mat, tr(tube(R_BODY, R_BODY + 3.4, -9, 9, 36), 0, 0, -10));
    P.add('ringGap', O.mat, boxC(0, -R_BODY - 3.0, -10, 8.0, 7.0, 18, 1.0, 0.3));
    P.add('ringScrew', 'steel', tr(rx(capScrew(3.0, 8, 1.5), PI), 0, -R_BODY - 6.6, -10));
    P.add('mountArm', O.mat, boxC(0, -Y / 2 - 1, -10, 16, Y - 8, 22, 1.6, 0.3));
    P.add('mountFoot', O.mat, boxC(0, -Y + 4.0, -10, 24, 8.0, 40, 1.6, 0.3));
    P.add('remotePad', 'rubber', tr(boxC(0, 0, 0, 22, 4.2, 30, 3.0, 0.4), 0, -Y + 3.0, 42));
    P.add('remoteCable', 'rubber', (() => {
      const rings = [];
      for (let i = 0; i <= 18; i++) {
        const t = i / 18, z = 24 + t * 20, y = -Y + 6 + Math.sin(t * PI) * 5.5, x = (1 - t) * (R_BODY + 1.5);
        const ring = [];
        for (let k = 0; k < 7; k++) { const b = k / 7 * TAU; ring.push([x + Math.cos(b) * 1.5, y + Math.sin(b) * 1.5, z]); }
        rings.push(ring);
      }
      return loft(rings, true, true);
    })());

    const lift = G.mTrans(0, Y, 0);
    for (const p of P.list) G.transform(p.geo, lift);
    for (const p of railClamp({ len: 40, style: 'thumb', side: 1, lugs: [-10.16, 10.16], base: 4.0, width: 24 }))
      P.add(p.name, p.mat, tr(p.geo, 0, 0, -10));

    return { parts: P.list, meta: {
      slot: 'tactical', name: 'Тактический фонарь', short: 'ФОНАРЬ', weight: 168,
      emitter: { pos: [0, Y, Z_LENS + 4], dir: [0, 0, -1], type: 'light',
        hotAngle: 0.125, spillAngle: 0.40, color: 0xfff1dc, lumens: 1000 },
      toggle: ['off', 'low', 'high', 'strobe'],
      glass: ['lens'], emissive: ['led'],
      stats: { adsSpeed: -2, hipSpread: 0, stealth: -15, visibility: 40 } } };
  };

  /* ==================================================================
     2. ЛЦУ / ИК-блок: корпус 40×35×75, видимый и ИК каналы, винты пристрелки
     ================================================================== */
  OUT.laser_dbal = function (o) {
    const O = Object.assign({ mat: 'od' }, o || {});
    const P = bag();
    const BW = 40, BH = 35, BL = 75, CLAMP_H = 12.6;
    const BY = CLAMP_H + BH / 2, TOP = BY + BH / 2, EMIT_Y = BY + 4;
    const ZF = -BL / 2, ZB = BL / 2;

    P.add('body', O.mat, boxC(0, BY, 0, BW, BH, BL, 3.0, 0.8));
    for (const s of [-1, 1]) {
      P.add('ribLong', O.mat, boxC(s * (BW / 2 + 0.3), BY, 4, 1.2, 2.6, 28, 0.4, 0.15));
      for (const dz of [-10, 4, 18])
        P.add('ribCross', O.mat, boxC(s * (BW / 2 + 0.3), BY, dz, 1.2, 18, 2.6, 0.4, 0.15));
    }
    for (const [dx, nm, mat] of [[-9.5, 'emitVis', 'laserRed'], [9.5, 'emitIR', 'laserIR']]) {
      P.add('emitWell', O.mat, tr(cyl(7.5, 7.5, ZF, ZF + 4, 24, true), dx, EMIT_Y, 0));
      P.add('emitBore', 'bore', tr(tube(5.6, 6.0, ZF - 0.4, ZF + 3.6, 24), dx, EMIT_Y, 0));
      P.add(nm, mat, tr(cyl(3.6, 3.6, ZF + 1.0, ZF + 1.4, 20, true), dx, EMIT_Y, 0));
      P.add(nm + 'Lens', 'glassAR', tr(lens(3.9, 1.4, 0.2, 0.2, 20), dx, EMIT_Y, ZF + 2.0));
    }
    for (const [pos, dir] of [[[-9.5, TOP, ZF + 16], 'up'], [[BW / 2, EMIT_Y, ZF + 16], 'right']]) {
      const g = [cyl(4.5, 4.5, 0, 1.6, 22, true), cyl(2.5, 2.5, 1.6, 4.0, 20, true),
        boxZ(-2.3, -0.4, 2.3, 0.4, 3.6, 4.2, 0.1, 0), boxZ(-0.4, -2.3, 0.4, 2.3, 3.6, 4.2, 0.1, 0)];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU;
        g.push(tr(cyl(0.34, 0.34, 0.2, 1.0, 8, true), Math.cos(a) * 5.6, Math.sin(a) * 5.6, 0));
      }
      let m = merge(g);
      m = dir === 'up' ? rx(m, -PI / 2) : ry(m, PI / 2);
      P.add('zeroScrew', 'steelDk', tr(m, pos[0], pos[1], pos[2]));
    }
    P.add('modeDial', 'steelDk', tr(lathe([{ r: 0, z: 0 }, { r: 8.5, z: 0 },
      { r: 8.5, z: 4.5, s: true }, { r: 7.0, z: 5.4 }, { r: 0, z: 5.4 }], 28, true), 0, BY, ZB));
    for (const k of knurlBand({ r: 8.55, z0: 0.8, z1: 4.0, n: 24, depth: 0.38, mat: 'steelDk' }))
      P.add(k.name, k.mat, tr(k.geo, 0, BY, ZB));
    P.add('modePointer', 'mark', boxC(0, BY + 6.2, ZB + 3.0, 1.4, 4.4, 1.0, 0.2, 0.1));
    for (let i = 0; i < 4; i++) {
      const a = D(-60 + i * 40);
      P.add('modeMark', 'mark', tr(cyl(0.45, 0.45, 0, 1.0, 8, true),
        Math.sin(a) * 10.5, BY + Math.cos(a) * 10.5, ZB + 0.2));
    }
    P.add('battDoor', O.mat, boxC(0, CLAMP_H + 3.0, ZB - 22, BW - 8, 5.0, 30, 2.0, 0.3));
    P.add('battScrew', 'steel', tr(rx(capScrew(3.0, 6, 1.4), PI), 0, CLAMP_H + 1.0, ZB - 34));
    P.add('pushButton', 'rubber', tr(padButton(5.0, 0, 2.0, [0, 0, 0]), -12, TOP, ZB - 12));
    P.add('remotePort', 'steelDk', tr(ry(cyl(3.0, 3.0, 0, 4.0, 16, true), -PI / 2), -BW / 2 - 2, BY - 8, ZB - 8));

    for (const p of railClamp({ len: 66, style: 'thumb', side: 1, lugs: [-20.32, -10.16, 0, 10.16], base: 4.2, width: 30 }))
      P.add(p.name, p.mat, p.geo);

    return { parts: P.list, meta: {
      slot: 'tactical', name: 'ЛЦУ / ИК-блок', short: 'ЛЦУ', weight: 260,
      emitter: { pos: [-9.5, EMIT_Y, ZF], dir: [0, 0, -1], type: 'laser',
        color: 0xff2020, divergence: 0.0006, beamR: 0.9 },
      emitterIR: { pos: [9.5, EMIT_Y, ZF], dir: [0, 0, -1], type: 'ir', color: 0x330404 },
      toggle: ['off', 'visible', 'ir', 'ir_illum'],
      glass: ['emitVisLens', 'emitIRLens'], emissive: ['emitVis', 'emitIR'],
      stats: { adsSpeed: -1, hipSpread: -22, precision: 4, stealth: -10 } } };
  };

  /* ==================================================================
     3. Комбо-блок «свет + лазер»
     ================================================================== */
  OUT.combo_light_laser = function () {
    const P = bag();
    const W = 46, H = 30, L = 82, CY = 6.0 + H / 2;

    P.add('body', 'anod', boxC(0, CY, 0, W, H, L, 3.4, 0.8));
    P.add('lightTube', 'anod', tr(lathe([{ r: 0, z: -L / 2 - 6 }, { r: 13.0, z: -L / 2 - 6 },
      { r: 13.0, z: -L / 2 + 2, s: true }, { r: 11.5, z: -L / 2 + 6 }, { r: 0, z: -L / 2 + 6 }], 34, true), -11.5, CY, 0));
    P.add('reflector', 'steel', (() => {
      const pr = [];
      for (let i = 0; i <= 18; i++) { const rr = 1.2 + 9.4 * (i / 18); pr.push({ r: rr, z: -L / 2 + 14 - rr * rr / 9, s: true }); }
      for (let i = 18; i >= 0; i--) { const rr = 1.2 + 9.4 * (i / 18); pr.push({ r: rr, z: -L / 2 + 14.5 - rr * rr / 9, s: true }); }
      return tr(lathe(pr, 40, true), -11.5, CY, 0);
    })());
    P.add('lightLens', 'glass', tr(lens(10.6, 2.0, 0, 0, 30), -11.5, CY, -L / 2 - 1.5));
    P.add('led', 'lampHot', tr(cyl(1.8, 1.8, 0, 0.8, 14, true), -11.5, CY, -L / 2 + 13.5));
    P.add('laserWell', 'anod', tr(cyl(6.8, 6.8, -L / 2 - 4, -L / 2 + 3, 24, true), 12.0, CY + 2, 0));
    P.add('laserBore', 'bore', tr(tube(4.8, 5.2, -L / 2 - 4.4, -L / 2 + 2.6, 22), 12.0, CY + 2, 0));
    P.add('laserDiode', 'laserRed', tr(cyl(3.2, 3.2, -L / 2 - 2.6, -L / 2 - 2.2, 18, true), 12.0, CY + 2, 0));
    P.add('laserLens', 'glassAR', tr(lens(3.4, 1.2, 0.2, 0.2, 18), 12.0, CY + 2, -L / 2 - 1.6));
    for (const [dx, nm] of [[-11.5, 'swLight'], [12.0, 'swLaser']])
      P.add(nm, 'rubber', tr(padButton(4.4, 0, 1.8, [0, 0, 0]), dx, CY + H / 2, L / 2 - 10));
    P.add('modeSlider', 'steelDk', boxC(0, CY + H / 2 + 1.0, L / 2 - 28, 7.0, 4.0, 16, 1.2, 0.3));
    for (const p of batteryCap(9.0, 0, 6.0, 'anod'))
      P.add(p.name, p.mat, tr(rx(p.geo, -PI / 2), 0, 6.5, L / 2 - 6));
    for (const p of railClamp({ len: 60, style: 'thumb', side: 1, lugs: [-10.16, 0, 10.16], base: 4.2, width: 30 }))
      P.add(p.name, p.mat, p.geo);

    return { parts: P.list, meta: {
      slot: 'tactical', name: 'Комбо-блок свет+лазер', short: 'КОМБО', weight: 310,
      emitter: { pos: [-11.5, CY, -L / 2 - 2], dir: [0, 0, -1], type: 'light',
        hotAngle: 0.14, spillAngle: 0.44, color: 0xfff0d8, lumens: 800 },
      emitterLaser: { pos: [12.0, CY + 2, -L / 2 - 2], dir: [0, 0, -1], type: 'laser', color: 0xff2020 },
      toggle: ['off', 'light', 'laser', 'both'],
      glass: ['lightLens', 'laserLens'], emissive: ['led', 'laserDiode'],
      stats: { adsSpeed: -3, hipSpread: -18, stealth: -18, visibility: 35 } } };
  };

  /* ==================================================================
     4. Вертикальная передняя рукоятка: колонна с «талией» и насечкой
     ================================================================== */
  OUT.grip_vertical = function (o) {
    const O = Object.assign({ mat: 'fde', len: 108 }, o || {});
    const P = bag();
    const L = O.len, TOP = -4.0;

    const rings = [], N = 26;
    for (let i = 0; i <= N; i++) {
      const t = i / N, y = TOP - t * L;
      const waist = 1 - 0.14 * Math.sin(t * PI) + 0.10 * Math.pow(t, 2.4);
      const a = 13.6 * waist, b = 15.4 * waist, ring = [];
      for (let k = 0; k < 28; k++) {
        const th = k / 28 * TAU, cs = Math.cos(th), sn = Math.sin(th), p = 2.7;
        ring.push([a * Math.sign(cs) * Math.pow(Math.abs(cs), 2 / p), y,
          b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / p)]);
      }
      rings.push(ring);
    }
    P.add('column', O.mat, loft(rings, true, true));
    P.add('capBottom', O.mat, tr(rx(lathe([{ r: 0, z: 0 }, { r: 13.2, z: 0 },
      { r: 13.6, z: 2.6, s: true }, { r: 12.0, z: 4.4 }, { r: 0, z: 4.4 }], 30, true), PI / 2),
      0, TOP - L - 0.4, 0));
    P.add('capScrew', 'steel', tr(rx(capScrew(3.0, 7, 1.4), PI), 0, TOP - L - 4.8, 0));
    for (let i = 0; i < 14; i++) {
      const y = TOP - 14 - i * (L - 26) / 14;
      for (const sz of [-1, 1])
        P.add('grooveRib', O.mat, tr(ry(cyl(1.15, 1.15, -11.5, 11.5, 8, false), PI / 2), 0, y, sz * 14.6));
    }
    for (const sx of [-1, 1])
      P.add('fingerSwell', O.mat, tr(sphere(6.2, 14), sx * 12.0, TOP - L * 0.42, 0));
    P.add('flange', O.mat, boxC(0, TOP - 3.0, 0, 26, 7.0, 44, 2.2, 0.4));
    /* рукоятка строится «свисающей», а хранится в общей системе (тело вверх от планки) */
    flipUp(P.list);
    for (const p of railClamp({ len: 42, style: 'crossbolt', side: 1, lugs: [-10.16, 10.16], base: 0.6, width: 24 }))
      P.add(p.name, p.mat, p.geo);

    return { parts: P.list, meta: {
      slot: 'under', name: 'Вертикальная рукоятка', short: 'VFG', weight: 96,
      gripNode: [0, -(TOP - L * 0.55), 0], handPose: 'vertical', flipForUnder: true,
      stats: { vertRecoil: -12, horizRecoil: -6, hipSpread: -4, adsSpeed: -3, mobility: -2 } } };
  };

  /* ==================================================================
     5. Угловая рукоятка AFG
     ================================================================== */
  OUT.grip_angled = function (o) {
    const O = Object.assign({ mat: 'poly' }, o || {});
    const P = bag();
    const prof = [[-52, -2], [16, -2], [20, -8], [16, -34], [-16, -40], [-52, -18]];
    P.add('body', O.mat, plateZY(prof, -13.0, 13.0));
    for (let i = 0; i < 12; i++) {
      const t = i / 11, z = -44 + t * 52, y = -6 - t * 24;
      P.add('rib', O.mat, boxC(0, y, z, 26, 1.6, 2.6, 0.5, 0.15));
    }
    P.add('thumbRest', O.mat, tr(sphere(8.0, 16), 0, -6.0, 14.0));
    P.add('flange', O.mat, boxC(0, -2.2, -16, 26, 5.0, 52, 2.0, 0.4));
    flipUp(P.list);
    for (const p of railClamp({ len: 50, style: 'crossbolt', side: 1, lugs: [-10.16, 10.16], base: 0.6, width: 24 }))
      P.add(p.name, p.mat, tr(p.geo, 0, 0, -16));

    return { parts: P.list, meta: {
      slot: 'under', name: 'Угловая рукоятка', short: 'AFG', weight: 62,
      gripNode: [0, 22, -14], handPose: 'angled', flipForUnder: true,
      stats: { vertRecoil: -6, horizRecoil: -10, hipSpread: -2, adsSpeed: 2, mobility: 0 } } };
  };

  /* ==================================================================
     6. Упор кисти
     ================================================================== */
  OUT.handstop = function () {
    const P = bag();
    P.add('body', 'poly', plateZY([[-16, -2], [14, -2], [16, -10], [8, -24], [-10, -22], [-16, -10]], -11, 11));
    for (let i = 0; i < 5; i++)
      P.add('rib', 'poly', boxC(0, -8 - i * 3.0, 6 - i * 2.0, 22, 1.4, 2.2, 0.4, 0.15));
    P.add('flange', 'poly', boxC(0, -2.0, -2, 24, 4.4, 30, 1.8, 0.3));
    flipUp(P.list);
    for (const p of railClamp({ len: 28, style: 'crossbolt', side: 1, lugs: [0], base: 0.6, width: 22 }))
      P.add(p.name, p.mat, tr(p.geo, 0, 0, -2));
    return { parts: P.list, meta: {
      slot: 'under', name: 'Упор кисти', short: 'STOP', weight: 28,
      gripNode: [0, 14, -4], handPose: 'extended', flipForUnder: true,
      stats: { vertRecoil: -2, horizRecoil: -4, hipSpread: -6, adsSpeed: 3, mobility: 2 } } };
  };

  /* ==================================================================
     7. Сошки: качание, складывание, выдвижные ноги с фиксатором
     ================================================================== */
  OUT.bipod = function (o) {
    const O = Object.assign({ mat: 'anod' }, o || {});
    const P = bag();
    const PIVOT_Y = -18.0;

    P.add('head', O.mat, boxC(0, -9.0, 0, 30, 18, 46, 3.0, 0.5));
    P.add('panAxis', 'steel', tr(cylY(4.0, 4.0, -22, 4, 20), 0, 0, 0));
    P.add('tiltLock', 'steelDk', tr(cylX(5.0, 5.0, 15, 21, 18), 0, -9.0, 12));
    P.addAll(knurlBand({ r: 5.0, a0: 15.4, a1: 20.6, n: 20, depth: 0.34, axis: 'x', at: [0, -9.0, 12], mat: 'steelDk' }));
    P.add('legAxis', 'steel', tr(cylX(3.2, 3.2, -26, 26, 18), 0, PIVOT_Y, -6));

    for (const s of [-1, 1]) {
      const ox = s * 15.0;
      const legParts = [
        ['legTube', O.mat, cyl(7.0, 7.0, -96, -4, 24, true)],
        ['legTubeIn', 'bore', tube(5.4, 5.8, -95, -6, 22)],
        ['legButton', 'steelDk', tr(rx(cyl(3.6, 3.6, -8.8, -6.6, 16, true), PI / 2), 0, 0, -88)],
        ['legSpring', 'steel', spring(4.4, 0.8, -144, -99, 9)],
        ['legExt', 'steel', cyl(5.2, 5.2, -150, -92, 20, true)],
        ['foot', 'rubber', lathe([{ r: 0, z: -162 }, { r: 8.4, z: -162 },
          { r: 8.8, z: -156, s: true }, { r: 6.2, z: -150 }, { r: 0, z: -150 }], 26, true)],
        ['footTread', 'rubber', tube(5.0, 8.6, -163.4, -161.6, 26)]
      ];
      for (let i = 0; i < 5; i++)
        legParts.push(['legHole', 'bore', tr(rx(cyl(2.0, 2.0, -7.6, -6.4, 12, true), PI / 2), 0, 0, -30 - i * 14.34)]);
      for (const [n, m, g0] of legParts) {
        let g = rx(g0, -PI / 2);
        g = rz(g, s * D(12));
        P.add(n, m, tr(g, ox, PIVOT_Y, -6));
      }
      P.add('legYoke', O.mat, boxC(ox, PIVOT_Y + 4, -6, 7.0, 16, 12, 1.4, 0.3));
    }

    P.add('mountBase', O.mat, boxC(0, -2.6, 0, 26, 6.0, 48, 2.0, 0.4));
    flipUp(P.list);
    for (const p of railClamp({ len: 46, style: 'thumb', side: 1, lugs: [-10.16, 10.16], base: 0.6, width: 26 }))
      P.add(p.name, p.mat, p.geo);

    return { parts: P.list, meta: {
      slot: 'under', name: 'Сошки', short: 'СОШКИ', weight: 380, flipForUnder: true,
      deploy: { pivot: [0, -PIVOT_Y, -6], axis: 'x', foldedAngle: 86, deployedAngle: 0,
        parts: ['legTube', 'legTubeIn', 'legHole', 'legButton', 'legSpring', 'legExt', 'foot', 'footTread'] },
      heightRange: [152, 224], panRange: 32, tiltRange: 28,
      stats: { vertRecoil: -34, horizRecoil: -28, hipSpread: 14, adsSpeed: -8, mobility: -10, proneBonus: 40 } } };
  };

  return OUT;
};
