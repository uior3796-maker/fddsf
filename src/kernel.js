/* Геометрическое ядро: треугольный суп {p:[],n:[]} в миллиметрах.
   Извлечено из модели АК-74 и вынесено в общий модуль без изменений логики. */
/* ============================================================================
   AKGeom — компактное ядро процедурной геометрии (без внешних зависимостей).
   Выдаёт «суп» треугольников {p:[x,y,z...], n:[nx,ny,nz...]}.
   Работает и в Node (экспорт/рендер-проверка), и в браузере.
   ========================================================================== */
(function (root, factory) {
  const G = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.AKGeom = G;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const EPS = 1e-9;

  /* ---------------------------------------------------------------- базовое */
  const geo = () => ({ p: [], n: [] });

  function tri(g, A, B, C, nA, nB, nC) {
    g.p.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
    g.n.push(nA[0], nA[1], nA[2], nB[0], nB[1], nB[2], nC[0], nC[1], nC[2]);
  }
  function quad(g, A, B, C, D, nA, nB, nC, nD) {
    tri(g, A, B, C, nA, nB, nC);
    tri(g, A, C, D, nA, nC, nD);
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function norm(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  const faceN = (A, B, C) => norm(cross(sub(B, A), sub(C, A)));

  /* треугольник с плоской нормалью */
  function triFlat(g, A, B, C) { const n = faceN(A, B, C); tri(g, A, B, C, n, n, n); }
  function quadFlat(g, A, B, C, D) { triFlat(g, A, B, C); triFlat(g, A, C, D); }

  /* убрать вырожденные треугольники и починить нормали */
  function clean(g) {
    const out = geo(), p = g.p, n = g.n;
    for (let i = 0; i < p.length; i += 9) {
      const A = [p[i], p[i + 1], p[i + 2]], B = [p[i + 3], p[i + 4], p[i + 5]], C = [p[i + 6], p[i + 7], p[i + 8]];
      if (!isFinite(A[0] + A[1] + A[2] + B[0] + B[1] + B[2] + C[0] + C[1] + C[2])) continue;
      const c = cross(sub(B, A), sub(C, A));
      const a2 = Math.hypot(c[0], c[1], c[2]);
      if (!(a2 > 1e-6)) continue;
      const fn = [c[0] / a2, c[1] / a2, c[2] / a2];
      out.p.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
      for (let k = 0; k < 3; k++) {
        const o = i + k * 3, l = Math.hypot(n[o], n[o + 1], n[o + 2]);
        if (!(l > 1e-4)) out.n.push(fn[0], fn[1], fn[2]);
        else out.n.push(n[o] / l, n[o + 1] / l, n[o + 2] / l);
      }
    }
    return out;
  }

  function merge(list) {
    const out = geo();
    for (const g of list) {
      if (!g) continue;
      const gp = g.p, gn = g.n;
      for (let i = 0; i < gp.length; i++) out.p.push(gp[i]);
      for (let i = 0; i < gn.length; i++) out.n.push(gn[i]);
    }
    return out;
  }

  /* ------------------------------------------------------------ трансформы */
  function transform(g, m) {                       // m — 4x4, column-major (как в three)
    const p = g.p, n = g.n;
    // нормальная матрица = верхняя 3x3 без переноса (масштаб у нас однородный)
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      p[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
      p[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      p[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const a = n[i], b = n[i + 1], c = n[i + 2];
      let nx = m[0] * a + m[4] * b + m[8] * c;
      let ny = m[1] * a + m[5] * b + m[9] * c;
      let nz = m[2] * a + m[6] * b + m[10] * c;
      const l = Math.hypot(nx, ny, nz) || 1;
      n[i] = nx / l; n[i + 1] = ny / l; n[i + 2] = nz / l;
    }
    return g;
  }
  const mIdent = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function mMul(a, b) {                            // a*b
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  const mTrans = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const mScale = (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  const mRotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };
  const mRotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
  const mRotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
  /* базис из трёх ортов + начало координат */
  const mBasis = (e1, e2, e3, o) => [e1[0], e1[1], e1[2], 0, e2[0], e2[1], e2[2], 0, e3[0], e3[1], e3[2], 0, o[0], o[1], o[2], 1];

  const tr = (g, x, y, z) => transform(g, mTrans(x, y, z));
  const rx = (g, a) => transform(g, mRotX(a));
  const ry = (g, a) => transform(g, mRotY(a));
  const rz = (g, a) => transform(g, mRotZ(a));

  /* зеркало по X с исправлением обхода треугольников */
  function mirrorX(src) {
    const g = { p: src.p.slice(), n: src.n.slice() };
    for (let i = 0; i < g.p.length; i += 3) { g.p[i] = -g.p[i]; g.n[i] = -g.n[i]; }
    for (let i = 0; i < g.p.length; i += 9) {       // поменять местами 2-ю и 3-ю вершины
      for (let k = 0; k < 3; k++) {
        let t = g.p[i + 3 + k]; g.p[i + 3 + k] = g.p[i + 6 + k]; g.p[i + 6 + k] = t;
        t = g.n[i + 3 + k]; g.n[i + 3 + k] = g.n[i + 6 + k]; g.n[i + 6 + k] = t;
      }
    }
    return g;
  }

  /* ------------------------------------------------------- 2D: контуры */
  /* pts: [[x,y] | [x,y,r]] — замкнутый многоугольник; r — радиус скругления угла.
     Возврат: [{x,y,s}] где s=true — гладкая стыковка с предыдущим ребром. */
  function round(pts, defR) {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const c = pts[i], p0 = pts[(i - 1 + n) % n], p1 = pts[(i + 1) % n];
      const r = c.length > 2 ? c[2] : (defR || 0);
      const d0 = [p0[0] - c[0], p0[1] - c[1]], d1 = [p1[0] - c[0], p1[1] - c[1]];
      const l0 = Math.hypot(d0[0], d0[1]), l1 = Math.hypot(d1[0], d1[1]);
      if (r <= 1e-6 || l0 < EPS || l1 < EPS) { out.push({ x: c[0], y: c[1], s: false }); continue; }
      const rr = Math.min(r, l0 * 0.499, l1 * 0.499);
      const u0 = [d0[0] / l0, d0[1] / l0], u1 = [d1[0] / l1, d1[1] / l1];
      const A = [c[0] + u0[0] * rr, c[1] + u0[1] * rr];
      const B = [c[0] + u1[0] * rr, c[1] + u1[1] * rr];
      const dot = Math.max(-1, Math.min(1, u0[0] * u1[0] + u0[1] * u1[1]));
      const segs = Math.max(2, Math.min(14, Math.ceil((Math.PI - Math.acos(dot)) / 0.26)));
      for (let k = 0; k <= segs; k++) {
        const t = k / segs, it = 1 - t;
        out.push({
          x: it * it * A[0] + 2 * it * t * c[0] + t * t * B[0],
          y: it * it * A[1] + 2 * it * t * c[1] + t * t * B[1],
          s: true
        });
      }
    }
    return out;
  }
  const rect = (x0, y0, x1, y1, r) => round([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], r || 0);
  function circle(cx, cy, r, seg) {
    seg = seg || Math.max(16, Math.ceil(r * 6));
    const o = [];
    for (let i = 0; i < seg; i++) { const a = i / seg * TAU; o.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, s: true }); }
    return o;
  }
  function ellipse(cx, cy, rx0, ry0, seg) {
    seg = seg || 40; const o = [];
    for (let i = 0; i < seg; i++) { const a = i / seg * TAU; o.push({ x: cx + Math.cos(a) * rx0, y: cy + Math.sin(a) * ry0, s: true }); }
    return o;
  }
  const area2 = (c) => { let a = 0; for (let i = 0, n = c.length; i < n; i++) { const p = c[i], q = c[(i + 1) % n]; a += p.x * q.y - q.x * p.y; } return a / 2; };
  const ccw = (c) => (area2(c) < 0 ? c.slice().reverse() : c);
  const cw = (c) => (area2(c) > 0 ? c.slice().reverse() : c);

  /* --------------------------------------------------- триангуляция (ear) */
  function bridgeHoles(outer, holes) {
    let poly = outer.map((p, i) => ({ x: p.x, y: p.y, s: p.s }));
    const hs = holes.slice().sort((a, b) => hMaxX(b) - hMaxX(a));
    for (const h of hs) poly = bridgeOne(poly, h);
    return poly;
  }
  function hMaxX(h) { let m = -Infinity; for (const p of h) m = Math.max(m, p.x); return m; }
  function bridgeOne(poly, hole) {
    let hi = 0;
    for (let i = 1; i < hole.length; i++) if (hole[i].x > hole[hi].x) hi = i;
    const H = hole[hi];
    let best = -1, bestD = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i];
      const d = (P.x - H.x) * (P.x - H.x) + (P.y - H.y) * (P.y - H.y);
      if (d >= bestD) continue;
      if (!visible(poly, hole, H, P, i, hi)) continue;
      best = i; bestD = d;
    }
    if (best < 0) best = 0;
    const out = poly.slice(0, best + 1);
    for (let k = 0; k <= hole.length; k++) out.push(hole[(hi + k) % hole.length]);
    out.push(poly[best]);
    return out.concat(poly.slice(best + 1));
  }
  function visible(poly, hole, A, B, ai, bi) {
    const test = (arr) => {
      for (let i = 0, n = arr.length; i < n; i++) {
        const P = arr[i], Q = arr[(i + 1) % n];
        if (segInt(A, B, P, Q)) return false;
      }
      return true;
    };
    return test(poly) && test(hole);
  }
  function segInt(a, b, c, d) {
    const sameP = (p, q) => Math.abs(p.x - q.x) < 1e-7 && Math.abs(p.y - q.y) < 1e-7;
    if (sameP(a, c) || sameP(a, d) || sameP(b, c) || sameP(b, d)) return false;
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
  }
  /* ear clipping для простого многоугольника (CCW) → массив индексов */
  function earcut(poly) {
    const n = poly.length;
    const idx = []; for (let i = 0; i < n; i++) idx.push(i);
    const out = [];
    let guard = 0;
    const A = (i, j, k) => {
      const p = poly[i], q = poly[j], r = poly[k];
      return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    };
    const inTri = (a, b, c, p) => {
      const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
      const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
      const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
      const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
      const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
      return !(neg && pos);
    };
    while (idx.length > 3 && guard++ < 40000) {
      let clipped = false;
      for (let i = 0; i < idx.length; i++) {
        const i0 = idx[(i - 1 + idx.length) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
        if (A(i0, i1, i2) <= 1e-12) continue;
        let ok = true;
        for (let j = 0; j < idx.length; j++) {
          const jj = idx[j];
          if (jj === i0 || jj === i1 || jj === i2) continue;
          if (inTri(poly[i0], poly[i1], poly[i2], poly[jj])) { ok = false; break; }
        }
        if (!ok) continue;
        out.push(i0, i1, i2);
        idx.splice(i, 1);
        clipped = true;
        break;
      }
      if (!clipped) { idx.splice(1, 1); }        // аварийный выход из вырожденного случая
    }
    if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
    return out;
  }

  /* --------------------------------------------------------------- контур */
  /* нормали рёбер и вершин контура */
  function contourNormals(c) {
    const n = c.length, en = [], vn = [];
    for (let i = 0; i < n; i++) {
      const a = c[i], b = c[(i + 1) % n];
      let dx = b.x - a.x, dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      en.push([dy / l, -dx / l]);
    }
    for (let i = 0; i < n; i++) {
      const prev = en[(i - 1 + n) % n], cur = en[i];
      if (c[i].s) {
        let x = prev[0] + cur[0], y = prev[1] + cur[1];
        const l = Math.hypot(x, y) || 1;
        vn.push({ a: [x / l, y / l], b: [x / l, y / l] });
      } else vn.push({ a: prev, b: cur });
    }
    return { en, vn };
  }
  /* смещение контура внутрь материала на d (митра с ограничением) */
  function offsetContour(c, d) {
    const { en } = contourNormals(c), n = c.length, out = [];
    for (let i = 0; i < n; i++) {
      const prev = en[(i - 1 + n) % n], cur = en[i];
      let mx = prev[0] + cur[0], my = prev[1] + cur[1];
      const l = Math.hypot(mx, my);
      if (l < 1e-6) { out.push({ x: c[i].x, y: c[i].y, s: c[i].s }); continue; }
      mx /= l; my /= l;
      let k = d / Math.max(0.4, mx * cur[0] + my * cur[1]);
      out.push({ x: c[i].x - mx * k, y: c[i].y - my * k, s: c[i].s });
    }
    return out;
  }

  /* ------------------------------------------------------------- extrude */
  /* shape: {outer:[pts], holes:[[pts],...]}  |  просто контур
     o: {z0, z1, ch (фаска), capA, capB} */
  function extrude(shape, o) {
    o = o || {};
    const outer = ccw(Array.isArray(shape) ? shape : shape.outer);
    const holes = ((shape.holes) || []).map(cw);
    const z0 = o.z0 !== undefined ? o.z0 : 0;
    const z1 = o.z1 !== undefined ? o.z1 : (z0 + (o.depth || 1));
    const ch = Math.max(0, Math.min(o.ch === undefined ? 0 : o.ch, Math.abs(z1 - z0) * 0.45));
    const capA = o.capA !== false, capB = o.capB !== false;
    const g = geo();
    const zs = ch > 0 ? [z0, z0 + ch, z1 - ch, z1] : [z0, z1];
    const offs = ch > 0 ? [ch, 0, 0, ch] : [0, 0];
    const all = [outer].concat(holes);

    for (const c of all) {
      const rings = offs.map((d) => (d > 0 ? offsetContour(c, d) : c));
      const nrm = rings.map(contourNormals);
      for (let L = 0; L < zs.length - 1; L++) {
        const cA = rings[L], cB = rings[L + 1], zA = zs[L], zB = zs[L + 1];
        const bevel = offs[L] !== offs[L + 1];
        const zdir = offs[L] > offs[L + 1] ? -1 : 1;   // фаска у ближнего или дальнего торца
        const sgn = L === 0 ? -1 : 1;
        const nA = nrm[L], nB = nrm[L + 1];
        for (let i = 0, n = cA.length; i < n; i++) {
          const j = (i + 1) % n;
          const P0 = [cA[i].x, cA[i].y, zA], P1 = [cA[j].x, cA[j].y, zA];
          const P2 = [cB[j].x, cB[j].y, zB], P3 = [cB[i].x, cB[i].y, zB];
          const e = nA.en[i];
          let n0, n1;
          if (bevel) {
            const kz = (offs[L] > offs[L + 1]) ? -1 : 1;
            const w = norm([e[0], e[1], kz * 1.0]);
            n0 = w; n1 = w;
          } else {
            n0 = [nA.vn[i].b[0], nA.vn[i].b[1], 0];
            n1 = [nA.vn[j].a[0], nA.vn[j].a[1], 0];
          }
          const m0 = bevel ? n0 : n0, m1 = bevel ? n1 : n1;
          quad(g, P0, P1, P2, P3, m0, m1, m1, m0);
        }
      }
    }
    /* торцы */
    const capRing = (d) => ({
      outer: d > 0 ? offsetContour(outer, d) : outer,
      holes: holes.map((h) => (d > 0 ? offsetContour(h, d) : h))
    });
    if (capB) {
      const r = capRing(offs[offs.length - 1]);
      const poly = r.holes.length ? bridgeHoles(r.outer, r.holes) : r.outer;
      const ids = earcut(poly);
      const N = [0, 0, 1];
      for (let i = 0; i < ids.length; i += 3) {
        tri(g, [poly[ids[i]].x, poly[ids[i]].y, z1], [poly[ids[i + 1]].x, poly[ids[i + 1]].y, z1],
          [poly[ids[i + 2]].x, poly[ids[i + 2]].y, z1], N, N, N);
      }
    }
    if (capA) {
      const r = capRing(offs[0]);
      const poly = r.holes.length ? bridgeHoles(r.outer, r.holes) : r.outer;
      const ids = earcut(poly);
      const N = [0, 0, -1];
      for (let i = 0; i < ids.length; i += 3) {
        tri(g, [poly[ids[i]].x, poly[ids[i]].y, z0], [poly[ids[i + 2]].x, poly[ids[i + 2]].y, z0],
          [poly[ids[i + 1]].x, poly[ids[i + 1]].y, z0], N, N, N);
      }
    }
    return g;
  }
  /* удобные обёртки: выдавливание вдоль X и Y */
  const extrudeX = (s, o) => ry(extrude(s, o), Math.PI / 2);   // локальные (u,v)→(z→x)
  const extrudeY = (s, o) => rx(extrude(s, o), -Math.PI / 2);

  /* --------------------------------------------------------------- lathe */
  /* профиль: [{r,z,s}] — обход «материал слева»; вращение вокруг оси Z */
  function lathe(profile, seg, closed, arc, a0) {
    seg = seg || 48; arc = arc === undefined ? TAU : arc; a0 = a0 || 0;
    const g = geo();
    /* профиль должен быть CCW в плоскости (r,z) — иначе нормали смотрят внутрь */
    {
      let ar = 0;
      for (let i = 0; i < profile.length; i++) {
        const a = profile[i], b = profile[(i + 1) % profile.length];
        ar += a.r * b.z - b.r * a.z;
      }
      if (ar < 0) profile = profile.slice().reverse();
    }
    const N = profile.length;
    const last = closed ? N : N - 1;
    // нормали в плоскости (r,z)
    const en = [];
    for (let i = 0; i < last; i++) {
      const a = profile[i], b = profile[(i + 1) % N];
      let dr = b.r - a.r, dz = b.z - a.z;
      const l = Math.hypot(dr, dz) || 1;
      en.push([dz / l, -dr / l]);
    }
    const vnA = [], vnB = [];
    for (let i = 0; i < N; i++) {
      const pe = en[(i - 1 + last) % last], ce = en[Math.min(i, last - 1)];
      const usePrev = closed || i > 0, useCur = closed || i < last;
      const P = usePrev ? pe : ce, C = useCur ? ce : pe;
      if (profile[i].s) {
        let x = P[0] + C[0], y = P[1] + C[1];
        const l = Math.hypot(x, y) || 1;
        vnA.push([x / l, y / l]); vnB.push([x / l, y / l]);
      } else { vnA.push(P); vnB.push(C); }
    }
    const full = Math.abs(arc - TAU) < 1e-6;
    for (let s = 0; s < seg; s++) {
      const t0 = a0 + arc * s / seg, t1 = a0 + arc * (s + 1) / seg;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      for (let i = 0; i < last; i++) {
        const a = profile[i], b = profile[(i + 1) % N];
        if (a.r < EPS && b.r < EPS) continue;
        const nA = vnB[i], nB = vnA[(i + 1) % N];
        const A0 = [a.r * c0, a.r * s0, a.z], A1 = [a.r * c1, a.r * s1, a.z];
        const B0 = [b.r * c0, b.r * s0, b.z], B1 = [b.r * c1, b.r * s1, b.z];
        const na0 = [nA[0] * c0, nA[0] * s0, nA[1]], na1 = [nA[0] * c1, nA[0] * s1, nA[1]];
        const nb0 = [nB[0] * c0, nB[0] * s0, nB[1]], nb1 = [nB[0] * c1, nB[0] * s1, nB[1]];
        if (a.r < EPS) tri(g, A0, B1, B0, na0, nb1, nb0);
        else if (b.r < EPS) tri(g, A0, A1, B0, na0, na1, nb0);
        else quad(g, A1, B1, B0, A0, na1, nb1, nb0, na0);
      }
    }
    if (!full) {                                   // боковые «щёки» у сектора
      [[a0, -1], [a0 + arc, 1]].forEach(([t, sg]) => {
        const c = Math.cos(t), s = Math.sin(t);
        const nx = -Math.sin(t) * sg, ny = Math.cos(t) * sg;
        const NN = [nx, ny, 0];
        const poly = profile.map((q) => ({ x: q.r, y: q.z }));
        const ids = earcut(ccw(poly.map((q) => ({ x: q.x, y: q.y, s: false }))));
        const src = ccw(poly.map((q) => ({ x: q.x, y: q.y, s: false })));
        for (let i = 0; i < ids.length; i += 3) {
          const P = [0, 1, 2].map((k) => {
            const q = src[ids[i + k]];
            return [q.x * c, q.x * s, q.y];
          });
          if (sg > 0) tri(g, P[0], P[2], P[1], NN, NN, NN);
          else tri(g, P[0], P[1], P[2], NN, NN, NN);
        }
      });
    }
    return g;
  }

  /* цилиндр/труба вдоль Z */
  function cyl(r0, r1, z0, z1, seg, caps) {
    const pr = [];
    if (caps !== false) pr.push({ r: 0, z: z0, s: false });
    pr.push({ r: r0, z: z0, s: false }, { r: r1, z: z1, s: false });
    if (caps !== false) pr.push({ r: 0, z: z1, s: false });
    return lathe(pr, seg || 32, false);
  }
  function tube(rIn, rOut, z0, z1, seg) {
    return lathe([{ r: rIn, z: z0, s: false }, { r: rOut, z: z0, s: false },
    { r: rOut, z: z1, s: false }, { r: rIn, z: z1, s: false }], seg || 40, true);
  }
  function torus(R, r, segA, segB, arc, a0) {
    segA = segA || 40; segB = segB || 16; arc = arc === undefined ? TAU : arc; a0 = a0 || 0;
    const pr = [];
    for (let i = 0; i < segB; i++) {
      const a = i / segB * TAU;
      pr.push({ r: R + Math.cos(a) * r, z: Math.sin(a) * r, s: true });
    }
    return lathe(pr, segA, true, arc, a0);
  }

  /* ---------------------------------------------------------------- loft */
  /* rings: [[ [x,y,z] × K ] × M] — замкнутые кольца одинаковой длины */
  function loft(rings, capA, capB, openRing) {
    const M = rings.length, K = rings[0].length;
    const acc = [];
    for (let s = 0; s < M; s++) { acc.push([]); for (let i = 0; i < K; i++) acc[s].push([0, 0, 0]); }
    const kEnd = openRing ? K - 1 : K;
    const addN = (s, i, n) => { const a = acc[s][i]; a[0] += n[0]; a[1] += n[1]; a[2] += n[2]; };
    for (let s = 0; s < M - 1; s++) {
      for (let i = 0; i < kEnd; i++) {
        const j = (i + 1) % K;
        const A = rings[s][i], B = rings[s][j], C = rings[s + 1][j], D = rings[s + 1][i];
        const n = norm(cross(sub(B, A), sub(D, A)));
        addN(s, i, n); addN(s, j, n); addN(s + 1, j, n); addN(s + 1, i, n);
      }
    }
    for (let s = 0; s < M; s++) for (let i = 0; i < K; i++) acc[s][i] = norm(acc[s][i]);
    const g = geo();
    for (let s = 0; s < M - 1; s++) {
      for (let i = 0; i < kEnd; i++) {
        const j = (i + 1) % K;
        quad(g, rings[s][i], rings[s][j], rings[s + 1][j], rings[s + 1][i],
          acc[s][i], acc[s][j], acc[s + 1][j], acc[s + 1][i]);
      }
    }
    const cap = (ring, flip) => {
      const c = [0, 0, 0];
      for (const p of ring) { c[0] += p[0] / K; c[1] += p[1] / K; c[2] += p[2] / K; }
      for (let i = 0; i < K; i++) {
        const j = (i + 1) % K;
        if (flip) triFlat(g, c, ring[j], ring[i]); else triFlat(g, c, ring[i], ring[j]);
      }
    };
    if (capA) cap(rings[0], true);
    if (capB) cap(rings[M - 1], false);
    return g;
  }

  /* суперэллипс — база для рукояток, прикладов, магазинов */
  function superRing(a, bUp, bDn, k, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / n * TAU, c = Math.cos(t), s = Math.sin(t);
      const b = s >= 0 ? bUp : bDn;
      out.push([
        Math.sign(c) * a * Math.pow(Math.abs(c), 2 / k),
        Math.sign(s) * b * Math.pow(Math.abs(s), 2 / k)
      ]);
    }
    return out;
  }

  /* сетка-оболочка с отверстиями (дульный тормоз, кожухи) */
  function perfShell(o) {
    const rO = o.rOut, rI = o.rIn, th = o.thetas, zs = o.zs, hole = o.hole;
    const g = geo();
    const V = (r, t, z) => [Math.cos(t) * r, Math.sin(t) * r, z];
    const nT = th.length - 1, nZ = zs.length - 1, open = [];
    for (let i = 0; i < nT; i++) { open.push([]); for (let j = 0; j < nZ; j++) open[i].push(hole((th[i] + th[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)); }
    for (let i = 0; i < nT; i++) for (let j = 0; j < nZ; j++) {
      const t0 = th[i], t1 = th[i + 1], z0 = zs[j], z1 = zs[j + 1];
      const n0 = [Math.cos(t0), Math.sin(t0), 0], n1 = [Math.cos(t1), Math.sin(t1), 0];
      const m0 = [-n0[0], -n0[1], 0], m1 = [-n1[0], -n1[1], 0];
      if (!open[i][j]) {
        quad(g, V(rO, t0, z0), V(rO, t1, z0), V(rO, t1, z1), V(rO, t0, z1), n0, n1, n1, n0);
        quad(g, V(rI, t0, z0), V(rI, t0, z1), V(rI, t1, z1), V(rI, t1, z0), m0, m0, m1, m1);
        if (o.capBack && j === 0) { const n = [0, 0, -1]; quad(g, V(rI, t1, z0), V(rO, t1, z0), V(rO, t0, z0), V(rI, t0, z0), n, n, n, n); }
        if (o.capFront && j === nZ - 1) { const n = [0, 0, 1]; quad(g, V(rO, t0, z1), V(rO, t1, z1), V(rI, t1, z1), V(rI, t0, z1), n, n, n, n); }
      } else {
        const L = open[(i - 1 + nT) % nT][j], R = open[(i + 1) % nT][j];
        const B = j > 0 ? open[i][j - 1] : true, F = j < nZ - 1 ? open[i][j + 1] : true;
        if (!L) { const n = [-Math.sin(t0), Math.cos(t0), 0]; quad(g, V(rI, t0, z1), V(rO, t0, z1), V(rO, t0, z0), V(rI, t0, z0), n, n, n, n); }
        if (!R) { const n = [Math.sin(t1), -Math.cos(t1), 0]; quad(g, V(rO, t1, z0), V(rO, t1, z1), V(rI, t1, z1), V(rI, t1, z0), n, n, n, n); }
        if (!B) { const n = [0, 0, 1]; quad(g, V(rO, t0, z0), V(rO, t1, z0), V(rI, t1, z0), V(rI, t0, z0), n, n, n, n); }
        if (!F) { const n = [0, 0, -1]; quad(g, V(rI, t1, z1), V(rO, t1, z1), V(rO, t0, z1), V(rI, t0, z1), n, n, n, n); }
      }
    }
    return g;
  }

  function bounds(g) {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < g.p.length; i += 3) for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], g.p[i + k]); mx[k] = Math.max(mx[k], g.p[i + k]);
    }
    return { min: mn, max: mx };
  }

  return {
    TAU, geo, tri, quad, triFlat, quadFlat, merge, transform, bounds,
    mIdent, mMul, mTrans, mScale, mRotX, mRotY, mRotZ, mBasis,
    tr, rx, ry, rz, mirrorX, norm, cross, sub,
    round, rect, circle, ellipse, ccw, cw, offsetContour,
    extrude, extrudeX, extrudeY, lathe, cyl, tube, torus, loft, superRing, perfShell, earcut, bridgeHoles, clean
  };
});
