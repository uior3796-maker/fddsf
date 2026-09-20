/* ============================================================================
   Общая библиотека деталей навесных модулей.

   Единицы — миллиметры. Локальная система координат модуля:
     X — вправо, Y — вверх, Z — назад (дуло смотрит в −Z).
   Начало координат модуля — точка посадки:
     · для «планочных» модулей   — центр верхней плоскости планки Пикатинни;
     · для дульных               — торец резьбы ствола, ось канала по Y=0;
     · для магазинов             — плоскость шахты (верх магазина).
   Такая привязка позволяет оружию задавать слот одной точкой + поворотом.
   ========================================================================== */
module.exports = function (G) {
  const PI = Math.PI, TAU = PI * 2, D = (d) => d * PI / 180;
  const { tr, rx, ry, rz, merge, extrude, extrudeX, lathe, cyl, tube, torus, round, circle, mirrorX, loft } = G;

  /* ------------------------------------------------------------ материалы */
  /* Цвет — линейный RGB, metal/rough — как в PBR. Адаптеры движков
     переводят эти записи в свои материалы. alpha<1 → прозрачная деталь. */
  const MATS = {
    anod:     { color: [0.026, 0.028, 0.031], metal: 0.84, rough: 0.47 },  // чёрный анодированный алюминий
    anodMatt: { color: [0.030, 0.031, 0.033], metal: 0.55, rough: 0.66 },  // матовая анодировка корпусов
    fde:      { color: [0.170, 0.132, 0.077], metal: 0.06, rough: 0.63 },  // FDE-полимер / Cerakote
    od:       { color: [0.044, 0.052, 0.030], metal: 0.10, rough: 0.62 },  // olive drab
    steel:    { color: [0.165, 0.170, 0.180], metal: 1.00, rough: 0.33 },
    steelDk:  { color: [0.072, 0.075, 0.080], metal: 0.95, rough: 0.44 },
    nitride:  { color: [0.042, 0.043, 0.046], metal: 0.92, rough: 0.36 },  // нитрид/QPQ дульных устройств
    park:     { color: [0.052, 0.052, 0.050], metal: 0.90, rough: 0.58 },  // фосфатирование (АК)
    inconel:  { color: [0.205, 0.198, 0.186], metal: 1.00, rough: 0.41 },  // перегородки глушителя
    poly:     { color: [0.029, 0.030, 0.033], metal: 0.00, rough: 0.58 },
    wood:     { color: [0.196, 0.083, 0.031], metal: 0.00, rough: 0.44 },  // лакированная берёза
    woodDk:   { color: [0.118, 0.046, 0.017], metal: 0.00, rough: 0.50 },
    bakelite: { color: [0.245, 0.072, 0.062], metal: 0.06, rough: 0.38 },  // «слива»
    rubber:   { color: [0.011, 0.011, 0.013], metal: 0.00, rough: 0.93 },
    glass:    { color: [0.560, 0.640, 0.620], metal: 0.00, rough: 0.05, alpha: 0.16, coat: 1 },
    glassAR:  { color: [0.180, 0.420, 0.360], metal: 0.10, rough: 0.05, alpha: 0.30, coat: 1 },  // просветление
    reticle:  { color: [0.000, 0.000, 0.000], metal: 0.00, rough: 1.00, emis: [2.60, 0.22, 0.10], alpha: 0.95 },
    lampHot:  { color: [0.000, 0.000, 0.000], metal: 0.00, rough: 1.00, emis: [3.00, 2.70, 2.20] },
    laserRed: { color: [0.000, 0.000, 0.000], metal: 0.00, rough: 1.00, emis: [4.00, 0.10, 0.05] },
    laserIR:  { color: [0.020, 0.004, 0.004], metal: 0.00, rough: 0.80, emis: [0.30, 0.02, 0.02] },
    mark:     { color: [0.520, 0.525, 0.530], metal: 0.30, rough: 0.52 },  // белая/серая маркировка
    brass:    { color: [0.620, 0.465, 0.170], metal: 1.00, rough: 0.25 },
    copper:   { color: [0.575, 0.320, 0.160], metal: 1.00, rough: 0.29 },
    lead:     { color: [0.330, 0.335, 0.345], metal: 1.00, rough: 0.45 },
    bore:     { color: [0.009, 0.009, 0.011], metal: 0.35, rough: 0.82 }
  };

  /* ------------------------------------------------- накопитель деталей */
  function bag() {
    const list = [];
    const api = {
      list,
      add(name, mat, geo) { if (geo && geo.p.length) list.push({ name, mat, geo }); return geo; },
      addAll(src, prefix) {
        for (const p of src) api.add(prefix ? prefix + '_' + p.name : p.name, p.mat, p.geo);
        return api;
      },
      /* сдвинуть/повернуть всё содержимое */
      xform(m) { for (const p of list) G.transform(p.geo, m); return api; }
    };
    return api;
  }

  /* --------------------------------------------------------- примитивы */
  /* коробка со скруглением углов в XY, вытянутая по Z */
  const boxZ = (x0, y0, x1, y1, z0, z1, r, ch) =>
    extrude(round([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], r || 0), { z0, z1, ch: ch === undefined ? 0.25 : ch });

  /* коробка, заданная центром и габаритами */
  const boxC = (cx, cy, cz, w, h, l, r, ch) =>
    boxZ(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cz - l / 2, cz + l / 2, r, ch);

  /* профиль в плоскости (Z,Y) → толщина по X (полезно для щёк, кронштейнов) */
  const plateZY = (pts, x0, x1, ch) =>
    extrudeX(round(pts.map((p) => (p.length > 2 ? [-p[0], p[1], p[2]] : [-p[0], p[1]])), 0),
      { z0: x0, z1: x1, ch: ch === undefined ? 0.25 : ch });

  /* цилиндр вдоль X / Y */
  const cylX = (r0, r1, x0, x1, seg, caps) => tr(ry(cyl(r0, r1, 0, x1 - x0, seg || 24, caps !== false), PI / 2), x0, 0, 0);
  const cylY = (r0, r1, y0, y1, seg, caps) => tr(rx(cyl(r0, r1, 0, y1 - y0, seg || 24, caps !== false), -PI / 2), 0, y0, 0);

  function sphere(r, seg) {
    const p = [], n = seg || 16;
    for (let i = 0; i <= n; i++) { const a = -PI / 2 + PI * i / n; p.push({ r: r * Math.cos(a), z: r * Math.sin(a), s: true }); }
    p[0].s = false; p[p.length - 1].s = false;
    return lathe(p, (seg || 16) * 2, false);
  }

  /* --------------------------------------------- планка Пикатинни (1913) */
  /* Сечение: верх 15,7 мм, скос 45° до 21,2 мм, далее вертикальные борта.
     Верхняя плоскость лежит на y = 0, тело уходит вниз. Пазы 5,35 / шаг 10,16. */
  const RAIL = { top: 15.7, wide: 21.2, bevel: 2.75, slotW: 5.35, pitch: 10.16, slotD: 3.0, base: 4.6 };

  function railCrossSection(h) {
    const hh = h === undefined ? RAIL.base : h;
    return round([
      [-RAIL.top / 2, 0], [RAIL.top / 2, 0],
      [RAIL.wide / 2, -RAIL.bevel], [RAIL.wide / 2, -RAIL.bevel - 0.9],
      [RAIL.wide / 2 - 1.1, -hh], [-RAIL.wide / 2 + 1.1, -hh],
      [-RAIL.wide / 2, -RAIL.bevel - 0.9], [-RAIL.wide / 2, -RAIL.bevel]
    ], 0.25);
  }

  /* Отрезок планки: длина len, задний торец в z = zBack, пазы нарезаны.
     phase — смещение первого паза, чтобы пазы соседних секций совпадали. */
  function railStrip(len, zBack, h, phase) {
    const hh = h === undefined ? RAIL.base : h;
    const z0 = zBack - len, z1 = zBack;
    const g = [];
    const sec = railCrossSection(hh);
    /* тело планки режем на «зубья» между пазами */
    const cuts = [];
    let z = z1 - (phase === undefined ? (RAIL.pitch - RAIL.slotW) / 2 : phase);
    while (z - RAIL.slotW > z0) { cuts.push([z - RAIL.slotW, z]); z -= RAIL.pitch; }
    let cur = z1;
    const solid = [];
    for (const c of cuts) { if (cur - c[1] > 0.05) solid.push([c[1], cur]); cur = c[0]; }
    if (cur - z0 > 0.05) solid.push([z0, cur]);
    for (const s of solid) g.push(extrude(sec, { z0: s[0], z1: s[1], ch: 0.3 }));
    /* дно паза — сплошная подошва высотой (hh − slotD) */
    const floorSec = round([
      [-RAIL.wide / 2 + 1.1, -hh], [RAIL.wide / 2 - 1.1, -hh],
      [RAIL.wide / 2 - 0.4, -RAIL.slotD], [-RAIL.wide / 2 + 0.4, -RAIL.slotD]
    ], 0.2);
    g.push(extrude(floorSec, { z0: z0, z1: z1, ch: 0.2 }));
    return merge(g);
  }

  /* Индексы пазов относительно точки посадки — для «щелчка» при установке. */
  const railSlotZ = (n, zBack) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push((zBack || 0) - (RAIL.pitch - RAIL.slotW) / 2 - RAIL.slotW / 2 - i * RAIL.pitch);
    return out;
  };

  /* ------------------------------------------- зажим модуля на планку */
  /* Губки охватывают скосы планки снизу, поперечный винт с барашком/рычагом.
     opts: {len, style:'crossbolt'|'qd'|'thumb', side:+1|-1, lugs:[z...], base} */
  function railClamp(opts) {
    const O = Object.assign({ len: 40, style: 'crossbolt', side: 1, lugs: [], base: 5.0, width: 26 }, opts);
    const P = bag();
    const zB = O.len / 2, zF = -O.len / 2;
    const bodyTop = O.base;                    // низ модуля над планкой

    /* корпус-подошва над планкой */
    P.add('clampBody', 'anod', boxZ(-O.width / 2, 0.15, O.width / 2, bodyTop, zF, zB, 1.6, 0.5));

    /* неподвижная губка (слева) и подвижная (справа) — обе цепляют скос 45° */
    for (const s of [-1, 1]) {
      const moving = s === O.side;
      const xOut = RAIL.wide / 2 + (moving ? 3.4 : 2.6);
      const xIn = RAIL.top / 2 - 0.2;
      const jaw = round([
        [s * xIn, 0.1], [s * xOut, 0.1],
        [s * xOut, -RAIL.bevel - 3.2], [s * (xOut - 1.0), -RAIL.bevel - 3.4],
        [s * (RAIL.wide / 2 - 0.15), -RAIL.bevel - 0.15], [s * (xIn + 0.1), -0.05]
      ], 0.35);
      const zj0 = moving ? zF + 2.5 : zF + 1.0, zj1 = moving ? zB - 2.5 : zB - 1.0;
      P.add(moving ? 'clampJawMove' : 'clampJawFix', 'anod', extrude(jaw, { z0: zj0, z1: zj1, ch: 0.4 }));
    }

    /* поперечные винты/рычаги */
    const nz = O.len > 52 ? 2 : 1;
    for (let i = 0; i < nz; i++) {
      const zc = nz === 1 ? 0 : (i === 0 ? zF + O.len * 0.28 : zB - O.len * 0.28);
      const xHead = O.side * (RAIL.wide / 2 + 4.0);
      /* стержень винта сквозь обе губки */
      P.add('clampBolt', 'steel', tr(cylX(2.4, 2.4, -RAIL.wide / 2 - 3.6, RAIL.wide / 2 + 3.6, 18), 0, -RAIL.bevel - 1.4, zc));
      if (O.style === 'thumb') {
        /* барашек с насечкой */
        P.add('clampNut', 'steelDk', tr(cylX(6.6, 6.6, xHead, xHead + O.side * 3.4, 22), 0, -RAIL.bevel - 1.4, zc));
        P.addAll(knurlBand({ r: 6.6, seg: 22, n: 18, depth: 0.55, axis: 'x',
          a0: xHead, a1: xHead + O.side * 3.4, at: [0, -RAIL.bevel - 1.4, zc], mat: 'steelDk' }));
      } else if (O.style === 'qd') {
        /* рычаг быстросъёма: ось, эксцентрик, рукоять с пружиной */
        const ax = xHead;
        P.add('qdCam', 'steel', tr(cylX(5.2, 5.2, ax, ax + O.side * 5.0, 20), 0, -RAIL.bevel - 1.4, zc));
        const lever = round([[0, -1.9], [17.5, -3.4], [19.2, -1.2], [19.2, 1.6], [16.5, 3.2], [0, 2.4]], 1.0);
        P.add('qdLever', 'anod', tr(rz(extrudeX(lever, { z0: ax + O.side * 1.2, z1: ax + O.side * 4.2, ch: 0.4 }), 0),
          0, -RAIL.bevel - 1.4, zc));
        P.add('qdSpring', 'steel', tr(cylX(3.1, 3.1, ax + O.side * 5.0, ax + O.side * 6.2, 16), 0, -RAIL.bevel - 1.4, zc));
      } else {
        /* обычный винт под шестигранник с гайкой */
        P.add('clampHead', 'steel', tr(hexHeadX(4.6, 2.8, O.side), xHead, -RAIL.bevel - 1.4, zc));
        P.add('clampNut', 'steelDk', tr(hexHeadX(4.2, 2.4, -O.side), -xHead, -RAIL.bevel - 1.4, zc));
      }
    }

    /* отдачный упор (штифт) в паз планки — то, чем модуль держит отдачу */
    for (const lz of (O.lugs.length ? O.lugs : [0])) {
      P.add('recoilLug', 'steel', boxC(0, -1.4, lz, RAIL.slotW - 0.25, 3.1, RAIL.top - 3.0, 0.3, 0.2));
    }
    return P.list;
  }

  /* шестигранная головка вдоль X (толщина t, «размер под ключ» 2r) */
  function hexHeadX(r, t, dir) {
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + PI / 6; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const g = extrudeX(round(pts, 0.18), { z0: 0, z1: (dir < 0 ? -t : t), ch: 0.25 });
    /* утопленный шестигранник под ключ */
    const key = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; key.push([Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52]); }
    const hole = extrudeX(round(key, 0.1), { z0: (dir < 0 ? -t * 0.98 : t * 0.98), z1: (dir < 0 ? -t * 0.25 : t * 0.25), ch: 0.1 });
    return merge([g, hole]);
  }

  /* винт с цилиндрической головкой и шлицем Torx, ось +Z */
  function capScrew(d, len, headH) {
    const r = d / 2, hR = r * 1.55, hH = headH === undefined ? r * 0.95 : headH;
    const g = [cyl(r, r, -len, 0, 18, true), cyl(hR, hR, 0, hH, 22, true)];
    /* шлиц Torx — шесть лепестков-впадин */
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      g.push(tr(cyl(hR * 0.19, hR * 0.19, hH - 0.55, hH + 0.02, 10, true), Math.cos(a) * hR * 0.42, Math.sin(a) * hR * 0.42, 0));
    }
    g.push(cyl(hR * 0.36, hR * 0.36, hH - 0.55, hH + 0.02, 14, true));
    return merge(g);
  }

  /* --------------------------------------------------------- накатка */
  /* Кольцевая насечка: n продольных или ромбических валиков по радиусу r.
     axis: 'z' (по умолчанию) | 'x'; для 'x' задаются a0/a1 и точка at. */
  function knurlBand(o) {
    const O = Object.assign({ r: 10, z0: 0, z1: 10, n: 24, depth: 0.42, seg: 8, mat: 'steel', axis: 'z', at: [0, 0, 0] }, o);
    const P = bag();
    const zA = O.axis === 'x' ? O.a0 : O.z0, zB = O.axis === 'x' ? O.a1 : O.z1;
    const len = Math.abs(zB - zA);
    const g = [];
    for (let i = 0; i < O.n; i++) {
      const a = i / O.n * TAU;
      const rib = cyl(O.depth, O.depth * 0.75, Math.min(zA, zB) + 0.3, Math.max(zA, zB) - 0.3, 6, false);
      g.push(tr(rib, Math.cos(a) * O.r, Math.sin(a) * O.r, 0));
    }
    let m = merge(g);
    if (O.axis === 'x') m = tr(ry(m, PI / 2), O.at[0], O.at[1], O.at[2]);
    P.add('knurl', O.mat, m);
    return P.list;
  }

  /* Продольные рифления на плоскости y = const (кнопки, площадки) */
  function ribsZ(n, z0, z1, x0, x1, y, h, w) {
    const g = [];
    for (let i = 0; i < n; i++) {
      const zc = z0 + (z1 - z0) * (i + 0.5) / n;
      g.push(boxZ(x0, y - h, x1, y + h * 0.1, zc - w / 2, zc + w / 2, w * 0.45, 0.1));
    }
    return merge(g);
  }

  /* -------------------------------------------------------- резьба */
  /* Витки резьбы как наклонная спираль — видно на срезе дульного устройства. */
  function threadHelix(rOut, rIn, z0, z1, pitch, seg) {
    const turns = Math.abs(z1 - z0) / pitch;
    const steps = Math.max(12, Math.round(turns * (seg || 26)));
    const rings = [];
    const K = 7;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = t * turns * TAU, z = z0 + (z1 - z0) * t;
      const cx = Math.cos(a), cy = Math.sin(a);
      const ring = [];
      const rm = (rOut + rIn) / 2, w = (rOut - rIn) / 2, h = pitch * 0.34;
      for (let k = 0; k < K; k++) {
        const b = k / K * TAU;
        const dr = Math.cos(b) * w, dz = Math.sin(b) * h;
        ring.push([cx * (rm + dr), cy * (rm + dr), z + dz]);
      }
      rings.push(ring);
    }
    return loft(rings, true, true);
  }

  /* ------------------------------------------------------- оптика */
  /* Линза: двояковыпуклое стекло радиуса r, стрелка прогиба sag, центр в z. */
  function lens(r, thick, sagF, sagB, seg) {
    const n = seg || 28, prof = [];
    const zF = -thick / 2, zB = thick / 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n, rr = r * t;
      prof.push({ r: rr, z: zF - (sagF || 0) * (1 - (rr / r) * (rr / r)), s: true });
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n, rr = r * t;
      prof.push({ r: rr, z: zB + (sagB || 0) * (1 - (rr / r) * (rr / r)), s: true });
    }
    return lathe(prof, 48, true);
  }

  /* Кольцо-оправа линзы с резьбовым буртиком */
  function lensRing(rIn, rOut, z0, z1) {
    return lathe([
      { r: rIn, z: z0 }, { r: rOut, z: z0 }, { r: rOut, z: z1 }, { r: rIn, z: z1 }
    ], 48, true);
  }

  /* Сетка прицела как набор плоских полос в плоскости z = zR */
  function reticleShapes(list, zR) {
    const g = [];
    for (const s of list) {
      if (s.k === 'bar') g.push(boxZ(s.x0, s.y0, s.x1, s.y1, zR, zR + 0.05, 0, 0));
      else if (s.k === 'dot') g.push(tr(cyl(s.r, s.r, zR, zR + 0.05, 16, true), s.x || 0, s.y || 0, 0));
      else if (s.k === 'ring') g.push(tr(tube(s.r - s.w, s.r, zR, zR + 0.05, 64), s.x || 0, s.y || 0, 0));
      else if (s.k === 'chevron') {
        const t = s.w, h = s.h, x = s.x || 0, y = s.y || 0;
        g.push(tr(extrude(round([[-h, -h], [-h + t, -h], [0, -t * 0.4], [h - t, -h], [h, -h], [0, t * 0.6]], 0), { z0: zR, z1: zR + 0.05 }), x, y, 0));
      }
    }
    return merge(g);
  }

  /* ------------------------------------------------- прочая мелочёвка */
  /* Витая пружина вдоль Z */
  function spring(R, wire, z0, z1, turns, seg) {
    const steps = Math.max(24, Math.round(turns * (seg || 20)));
    const rings = [], K = 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = t * turns * TAU, z = z0 + (z1 - z0) * t;
      const cx = Math.cos(a), cy = Math.sin(a);
      const ring = [];
      for (let k = 0; k < K; k++) {
        const b = k / K * TAU;
        ring.push([cx * (R + Math.cos(b) * wire), cy * (R + Math.cos(b) * wire), z + Math.sin(b) * wire]);
      }
      rings.push(ring);
    }
    return loft(rings, true, true);
  }

  /* Крышка батарейного отсека с накаткой и уплотнением */
  function batteryCap(r, z0, z1, mat) {
    const P = bag();
    P.add('battCap', mat || 'anod', lathe([
      { r: 0, z: z0 }, { r: r * 0.92, z: z0 }, { r: r, z: z0 + 0.8, s: true },
      { r: r, z: z1 - 0.6, s: true }, { r: r * 0.86, z: z1 }, { r: 0, z: z1 }
    ], 36, true));
    P.addAll(knurlBand({ r: r + 0.06, z0: z0 + 1.0, z1: z1 - 1.0, n: 26, depth: 0.32, mat: mat || 'anod' }));
    P.add('battSeal', 'rubber', tube(r * 0.80, r * 0.94, z0 - 0.7, z0 - 0.1, 30));
    return P.list;
  }

  /* Резиновая кнопка-«пятак» с рифлением, ось +Y */
  function padButton(r, y0, h, at) {
    const g = [
      tr(cylY(r, r * 0.96, y0, y0 + h, 24), at[0], 0, at[2]),
      tr(rx(lathe([{ r: 0, z: 0 }, { r: r * 0.96, z: 0 }, { r: r * 0.72, z: h * 0.45, s: true }, { r: 0, z: h * 0.55 }], 24, true), -PI / 2), at[0], y0 + h, at[2])
    ];
    return merge(g);
  }

  return {
    PI, TAU, D, MATS, RAIL,
    bag, boxZ, boxC, plateZY, cylX, cylY, sphere,
    railCrossSection, railStrip, railSlotZ, railClamp, hexHeadX, capScrew,
    knurlBand, ribsZ, threadHelix, lens, lensRing, reticleShapes, spring, batteryCap, padButton
  };
};