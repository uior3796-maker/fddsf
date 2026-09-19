/* ============================================================================
   СИСТЕМА КАСТОМИЗАЦИИ — единый бандл (генерируется tools/build.js).
   Источники: src/kernel.js, src/attach/*.js, src/adapters/three_adapter.js
   Не редактируйте этот блок вручную: правьте исходники и пересоберите.
   ========================================================================== */
const __ATTACH = (function () {
  const __M = {};
  const __C = {};
  function __def(n, f) { __M[n] = f; }
  function __req(n) {
    if (__C[n]) return __C[n].exports;
    const m = { exports: {} };
    __C[n] = m;
    __M[n](m, m.exports);
    return m.exports;
  }

__def("kernel", function (module, exports) {
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

});

__def("common", function (module, exports) {
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
    fde:      { color: [0.250, 0.196, 0.116], metal: 0.06, rough: 0.63 },  // FDE-полимер / Cerakote
    od:       { color: [0.090, 0.104, 0.062], metal: 0.06, rough: 0.64 },  // olive drab
    steel:    { color: [0.165, 0.170, 0.180], metal: 1.00, rough: 0.33 },
    steelDk:  { color: [0.072, 0.075, 0.080], metal: 0.95, rough: 0.44 },
    nitride:  { color: [0.042, 0.043, 0.046], metal: 0.92, rough: 0.36 },  // нитрид/QPQ дульных устройств
    inconel:  { color: [0.205, 0.198, 0.186], metal: 1.00, rough: 0.41 },  // перегородки глушителя
    poly:     { color: [0.029, 0.030, 0.033], metal: 0.00, rough: 0.58 },
    wood:     { color: [0.330, 0.130, 0.046], metal: 0.00, rough: 0.42 },  // лакированная берёза
    woodDk:   { color: [0.198, 0.074, 0.026], metal: 0.00, rough: 0.48 },
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
});

__def("optics", function (module, exports) {
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

});

__def("muzzle", function (module, exports) {
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

});

__def("tactical", function (module, exports) {
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

});

__def("mags_stocks", function (module, exports) {
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
    const Y = 18.0;                         // ось буферной трубы над коробкой
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

});

__def("system", function (module, exports) {
/* ============================================================================
   Система навески модулей.

   Оружие объявляет набор слотов (SLOTS), система:
     · собирает геометрию выбранных модулей и ставит её по трансформу слота;
     · проверяет совместимость (тип слота, калибр, конфликты, занятые пазы);
     · агрегирует характеристики (отдача, разброс, скорость прицеливания…);
     · отдаёт итоговые узлы (точка вспышки, оптическая ось, хват, эмиттеры).

   Слот описывается так:
     { key:'optic', type:'rail', pos:[x,y,z], rot:[rx,ry,rz],
       accepts:['optic','magnifier'], length: 140, blocks:['ironRear'],
       railSlots: 12, order: 0 }
   pos/rot — положение посадочной точки в системе оружия (мм, радианы).
   Для планочных слотов посадка — верхняя плоскость планки.
   ========================================================================== */
module.exports = function (G, C) {
  const { PI } = C;

  /* Матрица слота: перенос + повороты XYZ (порядок Rz·Ry·Rx, как в three 'XYZ'). */
  function slotMatrix(slot) {
    const p = slot.pos || [0, 0, 0], r = slot.rot || [0, 0, 0];
    let m = G.mIdent();
    if (r[2]) m = G.mMul(G.mRotZ(r[2]), m);
    if (r[1]) m = G.mMul(G.mRotY(r[1]), m);
    if (r[0]) m = G.mMul(G.mRotX(r[0]), m);
    m = G.mMul(G.mTrans(p[0], p[1], p[2]), m);
    return m;
  }

  /* Перенос точки/направления модуля в систему оружия. */
  function xformPoint(m, v) {
    return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
  }
  function xformDir(m, v) {
    const o = [m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
    const l = Math.hypot(o[0], o[1], o[2]) || 1;
    return [o[0] / l, o[1] / l, o[2] / l];
  }

  /* -------------------------------------------------------------------
     Реестр модулей: объединяет каталоги в единый справочник по ключу.
     ------------------------------------------------------------------- */
  function registry(catalogs) {
    const items = {};
    for (const cat of catalogs)
      for (const key of Object.keys(cat)) {
        if (key[0] === '_') continue;
        items[key] = cat[key];
      }
    return {
      keys: () => Object.keys(items),
      has: (k) => !!items[k],
      build(key, opts) {
        const f = items[key];
        if (!f) throw new Error('Неизвестный модуль: ' + key);
        const r = f(opts || {});
        r.key = key;
        return r;
      },
      /* метаданные без построения геометрии — для списков в интерфейсе */
      meta(key, opts) { return this.build(key, opts).meta; }
    };
  }

  /* -------------------------------------------------------------------
     Проверка совместимости модуля со слотом.
     ------------------------------------------------------------------- */
  function checkFit(slot, meta, weapon, current) {
    const errs = [];
    const accepts = slot.accepts || [slot.key];
    if (accepts.indexOf(meta.slot) < 0)
      errs.push('Слот «' + (slot.label || slot.key) + '» не принимает модуль типа «' + meta.slot + '»');
    /* длина: модуль не должен быть длиннее посадочного места */
    if (slot.length && meta.len && meta.len > slot.length + 0.5)
      errs.push('Модуль длиннее посадочного места (' + meta.len + ' > ' + slot.length + ' мм)');
    /* калибр магазина */
    if (meta.slot === 'mag' && weapon.caliber && meta.caliber && meta.caliber !== 'auto'
      && meta.caliber !== weapon.caliber)
      errs.push('Магазин под ' + meta.caliber + ', оружие под ' + weapon.caliber);
    /* явные ограничения слота */
    if (slot.only && slot.only.indexOf(meta.key || '') < 0 && slot.only.length)
      errs.push('Слот принимает только: ' + slot.only.join(', '));
    if (slot.deny && meta.key && slot.deny.indexOf(meta.key) >= 0)
      errs.push('Этот модуль несовместим со слотом');
    /* взаимные конфликты уже установленных модулей */
    for (const k in current) {
      const cm = current[k];
      if (!cm || k === slot.key) continue;
      if (cm.conflicts && meta.slot && cm.conflicts.indexOf(meta.slot) >= 0)
        errs.push('Конфликт с модулем «' + cm.name + '»');
      if (meta.conflicts && meta.conflicts.indexOf(cm.slot) >= 0)
        errs.push('Конфликт с модулем «' + cm.name + '»');
    }
    return { ok: errs.length === 0, errors: errs };
  }

  /* -------------------------------------------------------------------
     Сбор конфигурации: геометрия + узлы + характеристики.
     weapon: { base, slots, stats, caliber, nodes }
     config: { slotKey: moduleKey | {key, opts} | null }
     ------------------------------------------------------------------- */
  function assemble(weapon, reg, config, opts) {
    const O = Object.assign({ strict: false }, opts || {});
    const out = {
      parts: [],                 // детали базы + модулей (геометрия в системе оружия)
      modules: {},               // slotKey -> {key, meta, matrix, parts:[имена]}
      nodes: Object.assign({}, weapon.nodes || {}),
      stats: Object.assign({}, weapon.stats || {}),
      weight: weapon.weight || 0,
      warnings: [], errors: [],
      emitters: [], glass: [], emissive: [], reticles: []
    };

    /* база оружия */
    for (const p of weapon.base) out.parts.push({ name: p.name, mat: p.mat, geo: p.geo, group: p.group || 'body', src: 'base' });

    /* порядок сборки: сначала носители (цевьё/планки), затем то, что на них */
    const slots = weapon.slots.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    /* цевьё может добавлять новые слоты — собираем их динамически */
    const dynamic = [];
    const resolved = {};

    const pickSpec = (key) => {
      const raw = config[key];
      if (!raw) return null;
      return typeof raw === 'string' ? { key: raw, opts: {} } : { key: raw.key, opts: raw.opts || {} };
    };

    const process = (slot) => {
      const spec = pickSpec(slot.key);
      if (!spec || !spec.key || spec.key === 'none') return;
      if (!reg.has(spec.key)) { out.errors.push('Нет модуля «' + spec.key + '» для слота ' + slot.key); return; }
      const built = reg.build(spec.key, spec.opts);
      const meta = Object.assign({ key: spec.key }, built.meta);
      const fit = checkFit(slot, meta, weapon, resolved);
      if (!fit.ok) {
        if (O.strict) { out.errors.push.apply(out.errors, fit.errors); return; }
        out.warnings.push.apply(out.warnings, fit.errors);
      }
      const M = slotMatrix(slot);
      const names = [];
      for (const p of built.parts) {
        const geo = { p: p.geo.p.slice(), n: p.geo.n.slice() };
        G.transform(geo, M);
        const nm = slot.key + ':' + p.name;
        names.push(nm);
        out.parts.push({ name: nm, mat: p.mat, geo, group: slot.group || 'body', src: slot.key, module: spec.key });
      }
      resolved[slot.key] = meta;
      out.modules[slot.key] = { key: spec.key, meta, matrix: M, parts: names, slot };

      /* стёкла, эмиссивные детали, сетки — адаптеру рендера */
      for (const gname of meta.glass || []) out.glass.push(slot.key + ':' + gname);
      for (const ename of meta.emissive || []) out.emissive.push(slot.key + ':' + ename);
      if (meta.reticle) out.reticles.push({
        part: slot.key + ':' + meta.reticle.part, color: meta.reticle.color, moa: meta.reticle.moa });

      /* узлы модуля в системе оружия */
      if (meta.opticY !== undefined && (meta.slot === 'optic' || meta.slot === 'magnifier')) {
        out.nodes[slot.key + 'Axis'] = xformPoint(M, [0, meta.opticY, 0]);
        if (meta.slot === 'optic') {
          out.nodes.sightAxis = out.nodes[slot.key + 'Axis'];
          out.nodes.eye = xformPoint(M, [0, meta.opticY, meta.eyeZ || 100]);
          out.activeOptic = { slot: slot.key, meta };
        }
      }
      if (meta.tip !== undefined) {
        out.nodes.muzzle = xformPoint(M, [0, 0, meta.tip]);
        out.nodes.muzzleDir = xformDir(M, [0, 0, -1]);
        out.muzzleMeta = meta;
      }
      if (meta.gripNode) out.nodes.gripL = xformPoint(M, meta.gripNode);
      if (meta.buttZ !== undefined) {
        out.nodes.butt = xformPoint(M, [0, meta.cheekY || 0, meta.buttZ]);
        out.nodes.cheek = xformPoint(M, [0, meta.cheekY || 0, meta.buttZ - 60]);
      }
      for (const ek of ['emitter', 'emitterIR', 'emitterLaser']) {
        const e = meta[ek];
        if (!e) continue;
        out.emitters.push(Object.assign({}, e, {
          slot: slot.key, module: spec.key,
          pos: xformPoint(M, e.pos), dir: xformDir(M, e.dir)
        }));
      }

      /* характеристики */
      out.weight += meta.weight || 0;
      for (const k in meta.stats || {}) out.stats[k] = (out.stats[k] || 0) + meta.stats[k];
      if (meta.cap) out.magCap = meta.cap;

      /* носитель добавил свои планки — регистрируем производные слоты */
      if (meta.rails) {
        for (const rk in meta.rails) {
          const r = meta.rails[rk];
          const childKey = slot.key + '.' + rk;
          dynamic.push({
            key: childKey, label: (slot.label || slot.key) + ' / ' + rk,
            type: 'rail', parent: slot.key,
            pos: xformPoint(M, r.pos),
            rot: [(slot.rot || [0, 0, 0])[0] + (r.rot || [0, 0, 0])[0],
              (slot.rot || [0, 0, 0])[1] + (r.rot || [0, 0, 0])[1],
              (slot.rot || [0, 0, 0])[2] + (r.rot || [0, 0, 0])[2]],
            length: r.len, accepts: r.accepts || ['optic', 'tactical', 'under', 'magnifier', 'ironRear', 'ironFront'],
            order: (slot.order || 0) + 1
          });
        }
      }
    };

    for (const s of slots) process(s);
    /* динамические слоты цевья — второй проход */
    let guard = 0;
    while (dynamic.length && guard++ < 4) {
      const wave = dynamic.splice(0, dynamic.length).sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const s of wave) { out.slotsDynamic = (out.slotsDynamic || []).concat([s]); process(s); }
    }

    /* правила, зависящие от комбинации */
    const optic = resolved.optic;
    if (optic && optic.foldIrons) out.foldIrons = true;
    if (optic && optic.mountType === 'sidemount' && !resolved.sidemount)
      out.warnings.push('Для ПСО нужен боковой кронштейн');
    if (resolved.magnifier && !optic)
      out.warnings.push('Магнифер без коллиматора бесполезен');
    if (out.muzzleMeta && out.muzzleMeta.sound === 'suppressed') out.suppressed = true;

    /* производные показатели */
    out.derived = derive(weapon, out);
    return out;
  }

  /* -------------------------------------------------------------------
     Пересчёт «сырых» баллов в игровые величины.
     Базовые значения оружия — в weapon.base stats (проценты/абсолюты).
     ------------------------------------------------------------------- */
  function derive(weapon, asm) {
    const b = weapon.ballistics || {};
    const s = asm.stats;
    const pct = (v) => 1 + (v || 0) / 100;
    const baseWeight = weapon.weight || 3000;
    const massFactor = 1 + (asm.weight - baseWeight) / Math.max(baseWeight, 1) * 0.35;

    return {
      /* подброс и увод: модули уменьшают, тяжёлый ствол гасит */
      vertRecoil: (b.vertRecoil || 1) * pct(s.vertRecoil) / Math.max(0.7, massFactor * 0.6 + 0.4),
      horizRecoil: (b.horizRecoil || 1) * pct(s.horizRecoil) / Math.max(0.7, massFactor * 0.6 + 0.4),
      /* разброс от бедра */
      hipSpread: Math.max(0.05, (b.hipSpread || 1) * pct(s.hipSpread)),
      /* скорость вскидки: тяжёлое оружие вскидывается дольше */
      adsTime: Math.max(0.08, (b.adsTime || 0.25) * (1 - (s.adsSpeed || 0) / 100) * massFactor),
      /* подвижность */
      mobility: Math.max(20, (b.mobility || 100) * pct(s.mobility) / massFactor),
      /* перезарядка */
      reloadTime: Math.max(0.6, (b.reloadTime || 2.2) * (1 - (s.reload || 0) / 100)),
      /* дальность/скорость пули и звук */
      muzzleVelocity: (b.muzzleVelocity || 880) * pct(s.velocity),
      effectiveRange: (b.effectiveRange || 300) * pct(s.range),
      loudness: Math.max(0, (b.loudness || 100) + (s.sound || 0)),
      flashVisible: Math.max(0, 100 - (s.flashHide || 0)),
      magCap: asm.magCap || (b.magCap || 30),
      weight: asm.weight,
      /* точность серии — сводный показатель для интерфейса */
      precision: Math.round(50 + (s.precision || 0) - (s.hipSpread || 0) * 0.3)
    };
  }

  /* -------------------------------------------------------------------
     Пресеты: сохранение/загрузка сборок.
     ------------------------------------------------------------------- */
  function presetCodec() {
    return {
      encode(config) {
        const keys = Object.keys(config).filter((k) => config[k]).sort();
        return keys.map((k) => k + '=' + (typeof config[k] === 'string' ? config[k] : config[k].key)).join(';');
      },
      decode(str) {
        const out = {};
        for (const part of String(str || '').split(';')) {
          if (!part) continue;
          const i = part.indexOf('=');
          if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
        }
        return out;
      }
    };
  }

  return { slotMatrix, xformPoint, xformDir, registry, checkFit, assemble, derive, presetCodec };
};

});

__def("ui", function (module, exports) {
/* ============================================================================
   Интерфейс кастомизации: список слотов, карусель модулей, панель
   характеристик со стрелками +/− (в духе экрана модификации из Bodycam).
   Интерфейс намеренно простой — вся глубина в моделях и в системе слотов.
   ========================================================================== */
module.exports = function () {
  const CSS = `
#cust{position:fixed;left:0;right:0;bottom:0;z-index:20;font:500 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8eaed;pointer-events:none;letter-spacing:.06em}
#cust.hidden{display:none}
#custSlots{display:flex;gap:6px;justify-content:center;padding:0 10px 10px;flex-wrap:wrap;pointer-events:auto}
.cslot{min-width:104px;border:1px solid rgba(255,255,255,.16);background:rgba(12,14,17,.72);backdrop-filter:blur(12px);padding:7px 10px;cursor:pointer;transition:border-color .15s,background .15s}
.cslot:hover{background:rgba(26,30,36,.82)}
.cslot.on{border-color:#e8b45c;background:rgba(232,180,92,.16)}
.cslot .k{font-size:9.5px;color:rgba(255,255,255,.42);text-transform:uppercase}
.cslot .v{font-size:12px;color:#fff;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}
#custList{display:flex;gap:6px;justify-content:center;padding:0 10px 8px;flex-wrap:wrap;pointer-events:auto}
.copt{border:1px solid rgba(255,255,255,.14);background:rgba(12,14,17,.66);padding:6px 11px;cursor:pointer;font-size:11.5px}
.copt:hover{background:rgba(26,30,36,.8)}
.copt.sel{border-color:#e8b45c;color:#ffd79a;background:rgba(232,180,92,.14)}
.copt.bad{opacity:.42;border-style:dashed}
#custStats{position:fixed;left:18px;top:86px;z-index:20;font:500 11px/1.7 ui-monospace,Menlo,monospace;pointer-events:none;min-width:190px}
.cstat{display:flex;justify-content:space-between;gap:14px;padding:1px 7px;background:rgba(10,12,15,.55);border-left:2px solid rgba(255,255,255,.16)}
.cstat.up{border-left-color:#6fcf7f;color:#a9e6b3}
.cstat.dn{border-left-color:#e07a6a;color:#efa99b}
.cstat b{font-weight:600}
#custHint{text-align:center;padding-bottom:9px;color:rgba(255,255,255,.34);font-size:10.5px}
#custWarn{text-align:center;color:#e6b07a;font-size:10.5px;padding-bottom:5px;min-height:14px}
`;

  /* Подписи и порядок показа характеристик. up=true — больше значит лучше. */
  const STAT_DEFS = [
    { k: 'vertRecoil', label: 'Подброс', up: false, fmt: (v) => v.toFixed(2) },
    { k: 'horizRecoil', label: 'Увод', up: false, fmt: (v) => v.toFixed(2) },
    { k: 'hipSpread', label: 'Разброс от бедра', up: false, fmt: (v) => v.toFixed(2) },
    { k: 'adsTime', label: 'Вскидка, с', up: false, fmt: (v) => v.toFixed(3) },
    { k: 'mobility', label: 'Подвижность', up: true, fmt: (v) => v.toFixed(0) },
    { k: 'reloadTime', label: 'Перезарядка, с', up: false, fmt: (v) => v.toFixed(2) },
    { k: 'muzzleVelocity', label: 'Скорость, м/с', up: true, fmt: (v) => v.toFixed(0) },
    { k: 'effectiveRange', label: 'Дальность, м', up: true, fmt: (v) => v.toFixed(0) },
    { k: 'loudness', label: 'Громкость', up: false, fmt: (v) => v.toFixed(0) },
    { k: 'flashVisible', label: 'Заметность вспышки', up: false, fmt: (v) => v.toFixed(0) },
    { k: 'weight', label: 'Масса, г', up: false, fmt: (v) => v.toFixed(0) },
    { k: 'magCap', label: 'Ёмкость', up: true, fmt: (v) => v.toFixed(0) }
  ];

  /* Возвращает исходник браузерного модуля интерфейса (строкой). */
  function source() {
    return `
/* --- интерфейс кастомизации (генерируется src/attach/ui.js) --- */
const CUST_CSS = ${JSON.stringify(CSS)};
const STAT_DEFS = ${JSON.stringify(STAT_DEFS.map((s) => ({ k: s.k, label: s.label, up: s.up, d: s.k === 'vertRecoil' || s.k === 'horizRecoil' || s.k === 'hipSpread' ? 2 : (s.k === 'adsTime' || s.k === 'reloadTime' ? 3 : 0) })))};

function createCustomizer(opts) {
  const style = document.createElement('style');
  style.textContent = CUST_CSS;
  document.head.appendChild(style);

  const host = document.createElement('div'); host.id = 'cust';
  const warn = document.createElement('div'); warn.id = 'custWarn';
  const list = document.createElement('div'); list.id = 'custList';
  const slots = document.createElement('div'); slots.id = 'custSlots';
  const hint = document.createElement('div'); hint.id = 'custHint';
  hint.textContent = 'TAB — кастомизация · ← → выбор модуля · 1…9 слот · B — сошки/приклад · L — фонарь · K — ЛЦУ';
  host.append(warn, list, slots, hint);
  document.body.appendChild(host);

  const statBox = document.createElement('div'); statBox.id = 'custStats';
  document.body.appendChild(statBox);

  let active = null, prevStats = null;

  function render() {
    const cfg = opts.getConfig(), defs = opts.getSlots();
    slots.innerHTML = '';
    for (const s of defs) {
      const el = document.createElement('div');
      el.className = 'cslot' + (active === s.key ? ' on' : '');
      const cur = cfg[s.key];
      el.innerHTML = '<div class="k">' + s.label + '</div><div class="v">' +
        (cur ? opts.nameOf(cur) : '—') + '</div>';
      el.onclick = () => { active = s.key; render(); };
      slots.appendChild(el);
    }
    list.innerHTML = '';
    if (active) {
      const slot = defs.find((s) => s.key === active);
      const options = opts.optionsFor(active);
      for (const o of options) {
        const el = document.createElement('div');
        el.className = 'copt' + (cfg[active] === o.key ? ' sel' : '') + (o.fits === false ? ' bad' : '');
        el.textContent = o.label;
        el.onclick = () => { opts.setModule(active, o.key); render(); };
        list.appendChild(el);
      }
    }
    const st = opts.getStats();
    statBox.innerHTML = '';
    for (const d of STAT_DEFS) {
      if (st[d.k] === undefined) continue;
      const v = st[d.k], pv = prevStats ? prevStats[d.k] : v;
      let cls = 'cstat';
      if (pv !== undefined && Math.abs(v - pv) > 1e-6) cls += ((v > pv) === d.up) ? ' up' : ' dn';
      const row = document.createElement('div');
      row.className = cls;
      row.innerHTML = '<span>' + d.label + '</span><b>' + v.toFixed(d.d) + '</b>';
      statBox.appendChild(row);
    }
    const w = opts.getWarnings();
    warn.textContent = w && w.length ? w.join(' · ') : '';
  }

  return {
    render,
    markStats() { prevStats = Object.assign({}, opts.getStats()); },
    setActive(k) { active = k; render(); },
    getActive() { return active; },
    toggle(on) { host.classList.toggle('hidden', on === false); statBox.style.display = on === false ? 'none' : ''; },
    visible() { return !host.classList.contains('hidden'); }
  };
}
`;
  }

  return { CSS, STAT_DEFS, source };
};

});

__def("three_adapter", function (module, exports) {
/* ============================================================================
   Адаптер three.js: превращает сборку системы модулей в Object3D.

   На вход — результат assemble() и палитра материалов (common.MATS).
   На выходе — группа с подгруппами по слотам, узлами-ориентирами,
   лучом фонаря, лазерным лучом и API управления модулями в рантайме.

   Геометрия считается в миллиметрах, сцена — в метрах (масштаб 0.001).
   ========================================================================== */
module.exports = function (G, C) {
  const S = 0.001;

  function build(THREE, asm, opts) {
    const O = Object.assign({ scale: S, shadows: true, envIntensity: 1 }, opts || {});
    const root = new THREE.Group();
    root.name = 'weapon';

    const geos = [], mats = [], matMap = {};
    const glassSet = new Set(asm.glass || []);
    const emisSet = new Set(asm.emissive || []);

    const mkMat = (key, partName) => {
      const isGlass = glassSet.has(partName);
      const isEmis = emisSet.has(partName);
      const id = key + (isGlass ? '|g' : '') + (isEmis ? '|e' : '');
      if (matMap[id]) return matMap[id];
      const d = C.MATS[key] || C.MATS.steel;
      let m;
      if (d.alpha !== undefined && d.alpha < 1) {
        m = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(d.color[0], d.color[1], d.color[2]),
          metalness: d.metal, roughness: d.rough,
          transparent: true, opacity: d.alpha, side: THREE.DoubleSide,
          clearcoat: d.coat || 0, clearcoatRoughness: 0.04, depthWrite: false
        });
      } else {
        m = new THREE.MeshStandardMaterial({
          color: new THREE.Color(d.color[0], d.color[1], d.color[2]),
          metalness: d.metal, roughness: d.rough
        });
      }
      if (d.emis) {
        m.emissive = new THREE.Color(d.emis[0], d.emis[1], d.emis[2]);
        m.emissiveIntensity = 1;
        m.toneMapped = false;
      }
      m.envMapIntensity = O.envIntensity;
      matMap[id] = m; mats.push(m);
      return m;
    };

    const toGeo = (raw) => {
      const n = raw.p.length;
      const pos = new Float32Array(n), nrm = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i] = raw.p[i] * O.scale; nrm[i] = raw.n[i]; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.computeBoundingSphere();
      geos.push(g);
      return g;
    };

    /* группировка: слот + материал, чтобы модуль можно было скрыть целиком */
    const buckets = {}, order = [];
    for (const p of asm.parts) {
      const grp = p.src || 'base';
      const anim = p.group || 'body';
      /* стёкла и эмиссив держим отдельными мешами — им нужен свой материал */
      const solo = glassSet.has(p.name) || emisSet.has(p.name);
      const key = grp + '|' + anim + '|' + p.mat + (solo ? '|' + p.name : '');
      if (!buckets[key]) { buckets[key] = { grp, anim, mat: p.mat, name: p.name, list: [] }; order.push(key); }
      buckets[key].list.push(p.geo);
    }

    const slotGroups = {}, animGroups = {};
    const groupFor = (slot, anim) => {
      if (!slotGroups[slot]) {
        const g = new THREE.Group();
        g.name = 'slot:' + slot;
        /* хост может увести слот в свою анимируемую группу (магазин, затвор) */
        const host = O.parentFor && O.parentFor(slot);
        (host || root).add(g);
        slotGroups[slot] = g;
      }
      const key = slot + '|' + anim;
      if (!animGroups[key]) {
        const g = new THREE.Group(); g.name = anim; slotGroups[slot].add(g); animGroups[key] = g;
      }
      return animGroups[key];
    };

    const meshByPart = {};
    for (const k of order) {
      const b = buckets[k];
      const mesh = new THREE.Mesh(toGeo(G.merge(b.list)), mkMat(b.mat, b.name));
      mesh.name = k;
      mesh.castShadow = O.shadows;
      mesh.receiveShadow = O.shadows;
      groupFor(b.grp, b.anim).add(mesh);
      meshByPart[b.name] = mesh;
    }

    /* узлы-ориентиры */
    const nodes = {};
    for (const nk in asm.nodes) {
      const v = asm.nodes[nk];
      if (!Array.isArray(v) || v.length !== 3) continue;
      const o = new THREE.Object3D();
      o.name = nk;
      o.position.set(v[0] * O.scale, v[1] * O.scale, v[2] * O.scale);
      root.add(o);
      nodes[nk] = o;
    }

    /* ---- луч фонаря и лазер как объекты сцены ---- */
    const beams = [];
    for (const e of asm.emitters || []) {
      const anchor = new THREE.Object3D();
      anchor.position.set(e.pos[0] * O.scale, e.pos[1] * O.scale, e.pos[2] * O.scale);
      const d = new THREE.Vector3(e.dir[0], e.dir[1], e.dir[2]);
      anchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), d);
      anchor.name = 'emitter:' + e.slot + ':' + e.type;
      root.add(anchor);

      if (e.type === 'light') {
        const spot = new THREE.SpotLight(e.color || 0xfff1dc, 0, 60, e.spillAngle || 0.4, 0.45, 1.2);
        spot.position.set(0, 0, 0);
        spot.target.position.set(0, 0, -20);
        anchor.add(spot, spot.target);
        /* видимый конус рассеяния */
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(Math.tan(e.spillAngle || 0.4) * 18, 18, 28, 1, true),
          new THREE.MeshBasicMaterial({ color: e.color || 0xfff1dc, transparent: true,
            opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        );
        cone.rotation.x = Math.PI / 2;
        cone.position.z = -9;
        anchor.add(cone);
        geos.push(cone.geometry); mats.push(cone.material);
        beams.push({ kind: 'light', slot: e.slot, anchor, spot, cone, meta: e, level: 0 });
      } else {
        const len = 80;
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry((e.beamR || 0.9) * 0.001, (e.beamR || 0.9) * 0.0028, len, 8, 1, true),
          new THREE.MeshBasicMaterial({ color: e.color || 0xff2020, transparent: true,
            opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        beam.rotation.x = -Math.PI / 2;
        beam.position.z = -len / 2;
        anchor.add(beam);
        const dot = new THREE.Sprite(new THREE.SpriteMaterial({ color: e.color || 0xff2020,
          transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        dot.scale.setScalar(0.02);
        anchor.add(dot);
        geos.push(beam.geometry); mats.push(beam.material, dot.material);
        beams.push({ kind: e.type === 'ir' ? 'ir' : 'laser', slot: e.slot, anchor, beam, dot, meta: e, level: 0 });
      }
    }

    /* ---- API рантайма ---- */
    const api = {
      root, nodes, slots: slotGroups, meshes: meshByPart, beams,
      modules: asm.modules, stats: asm.derived, warnings: asm.warnings, errors: asm.errors,

      /* показать/скрыть модуль слота без пересборки */
      setSlotVisible(slotKey, on) {
        const g = slotGroups[slotKey];
        if (g) g.visible = on !== false;
      },

      /* включение фонаря/лазера: level 0..1 */
      setBeam(kind, level, slotKey) {
        for (const b of beams) {
          if (b.kind !== kind) continue;
          if (slotKey && b.slot !== slotKey) continue;
          b.level = Math.max(0, Math.min(1, level));
          if (b.kind === 'light') {
            b.spot.intensity = b.level * (b.meta.lumens ? b.meta.lumens / 120 : 8);
            b.cone.material.opacity = b.level * 0.10;
          } else {
            const vis = b.kind === 'ir' ? b.level * 0.18 : b.level;
            b.beam.material.opacity = vis * 0.30;
            b.dot.material.opacity = vis * 0.95;
          }
        }
      },

      /* подсветка марки прицела */
      setReticle(on, brightness) {
        for (const r of asm.reticles || []) {
          const m = meshByPart[r.part];
          if (!m) continue;
          m.visible = on !== false;
          if (m.material.emissiveIntensity !== undefined)
            m.material.emissiveIntensity = 0.4 + 3.2 * (brightness === undefined ? 1 : brightness);
        }
      },

      /* складывание/раскладывание подвижных модулей (сошки, приклад, магнифер) */
      setDeploy(slotKey, t) {
        const mod = asm.modules[slotKey];
        if (!mod) return;
        const d = mod.meta.deploy || mod.meta.fold || mod.meta.flipAxis;
        if (!d) return;
        const g = slotGroups[slotKey];
        if (!g) return;
        const a0 = d.foldedAngle !== undefined ? d.foldedAngle : 0;
        const a1 = d.deployedAngle !== undefined ? d.deployedAngle : (d.angle || 0);
        const ang = (a0 + (a1 - a0) * t) * Math.PI / 180;
        /* поворот вокруг оси модуля: пивот задан в мм локально */
        const piv = d.pivot || [0, 0, 0];
        const M = mod.matrix;
        const wp = require_xform(M, piv);
        g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
        const v = new THREE.Vector3(wp[0] * O.scale, wp[1] * O.scale, wp[2] * O.scale);
        const q = new THREE.Quaternion().setFromAxisAngle(
          d.axis === 'y' ? new THREE.Vector3(0, 1, 0) : d.axis === 'z'
            ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), ang);
        g.position.copy(v).applyQuaternion(q).multiplyScalar(-1).add(v);
        g.quaternion.copy(q);
      },

      dispose() {
        for (const g of geos) g.dispose();
        for (const m of mats) m.dispose();
      }
    };

    function require_xform(M, v) {
      return [M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12],
        M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13],
        M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]];
    }

    api.setReticle(true, 1);
    api.setBeam('light', 0); api.setBeam('laser', 0); api.setBeam('ir', 0);
    return api;
  }

  return { build };
};

});

__def("slots", function (module, exports) {
/* ============================================================================
   Описания слотов и базовая баллистика по каждому оружию.

   Координаты слотов заданы в системе конкретной модели (мм), взяты из её
   собственных узлов: ось канала ствола, верх крышки/планки, окно магазина.
   pos для планочного слота — центр верхней плоскости планки.
   ========================================================================== */
module.exports = {

  /* --------------------------------------------------------------- АК-74 */
  ak74: {
    title: 'АК-74',
    caliber: 'auto', weight: 3300,
    ballistics: { vertRecoil: 1.35, horizRecoil: 0.80, hipSpread: 2.6, adsTime: 0.30,
      mobility: 100, reloadTime: 2.48, muzzleVelocity: 900, effectiveRange: 400,
      loudness: 100, magCap: 30 },
    /* BORE = 75, крышка коробки ~ y=128, колодка прицела z=-248 */
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 75, -636], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'handguard', label: 'ЦЕВЬЁ', type: 'barrel', pos: [0, 75, -300], rot: [0, 0, 0],
        accepts: ['handguard'], length: 240, order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 130, -200], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier', 'ironRear'], length: 150, order: 2, group: 'body' },
      { key: 'sidemount', label: 'КРОНШТЕЙН', type: 'side', pos: [-19, 96, -150], rot: [0, 0, 0],
        accepts: ['sidemount'], order: 1, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, 42, -122], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, 62, 4], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'brake_ak', handguard: 'handguard_wood', mag: 'mag_ak_30',
      stock: 'stock_wood', optic: null, sidemount: null }
  },

  /* ---------------------------------------------------------------- АКМ */
  akm: {
    title: 'АКМ',
    caliber: 'auto', weight: 3600,
    ballistics: { vertRecoil: 1.70, horizRecoil: 1.05, hipSpread: 2.9, adsTime: 0.32,
      mobility: 96, reloadTime: 2.55, muzzleVelocity: 715, effectiveRange: 350,
      loudness: 106, magCap: 30 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 75, -600], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'handguard', label: 'ЦЕВЬЁ', type: 'barrel', pos: [0, 75, -290], rot: [0, 0, 0],
        accepts: ['handguard'], length: 220, order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 128, -195], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier', 'ironRear'], length: 150, order: 2, group: 'body' },
      { key: 'sidemount', label: 'КРОНШТЕЙН', type: 'side', pos: [-19, 95, -148], rot: [0, 0, 0],
        accepts: ['sidemount'], order: 1, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, 42, -120], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, 62, 6], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'flash_cone', handguard: 'handguard_wood', mag: 'mag_ak_30',
      stock: 'stock_wood' }
  },

  /* --------------------------------------------------------------- M416 */
  m416: {
    title: 'M416',
    caliber: '5.56', weight: 3200,
    ballistics: { vertRecoil: 1.05, horizRecoil: 0.62, hipSpread: 2.2, adsTime: 0.27,
      mobility: 104, reloadTime: 2.30, muzzleVelocity: 880, effectiveRange: 420,
      loudness: 98, magCap: 30 },
    /* BORE = 70, верхняя планка ресивера y=98..104, длина цевья 240 */
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 70, -500], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'handguard', label: 'ЦЕВЬЁ', type: 'barrel', pos: [0, 70, -110], rot: [0, 0, 0],
        accepts: ['handguard'], length: 260, order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 104, -60], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier', 'ironRear'], length: 170, order: 2, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, 52, -92], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, 58, 10], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'flash_a2', handguard: 'handguard_mlok', mag: 'mag_stanag_30',
      stock: 'stock_telescopic', optic: 'reddot_t2' }
  },

  /* -------------------------------------------------------------- MP5A3 */
  mp5a3: {
    title: 'MP5A3',
    caliber: '9mm', weight: 2900,
    ballistics: { vertRecoil: 0.72, horizRecoil: 0.45, hipSpread: 1.9, adsTime: 0.23,
      mobility: 112, reloadTime: 2.35, muzzleVelocity: 400, effectiveRange: 180,
      loudness: 92, magCap: 30 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 0, -232], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'handguard', label: 'ЦЕВЬЁ', type: 'barrel', pos: [0, 0, -110], rot: [0, 0, 0],
        accepts: ['handguard'], length: 200, order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 38, -40], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier', 'ironRear'], length: 150, order: 2, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, -24, -96], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, 6, 108], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'thread_cap', mag: 'mag_pistol_33', stock: 'stock_telescopic' }
  },

  /* ------------------------------------------------------------- SCAR-H */
  scarh: {
    title: 'SCAR-H',
    caliber: '7.62', weight: 3580,
    ballistics: { vertRecoil: 1.55, horizRecoil: 0.95, hipSpread: 2.7, adsTime: 0.31,
      mobility: 94, reloadTime: 2.60, muzzleVelocity: 800, effectiveRange: 500,
      loudness: 104, magCap: 20 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 0, -430], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 40, -60], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier', 'ironRear'], length: 200, order: 2, group: 'body' },
      { key: 'under', label: 'НИЖНЯЯ', type: 'rail', pos: [0, -26, -220], rot: [0, 0, Math.PI],
        accepts: ['under'], length: 110, order: 2, group: 'body' },
      { key: 'tactical', label: 'БОКОВАЯ', type: 'rail', pos: [-26, 0, -230], rot: [0, 0, Math.PI / 2],
        accepts: ['tactical'], length: 110, order: 2, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, -28, -120], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, -10, 20], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'flash_a2', optic: 'reddot_t2', mag: 'mag_762_20',
      stock: 'stock_telescopic' }
  },

  /* ----------------------------------------------------------------- СВД */
  svd: {
    title: 'СВД',
    caliber: '7.62', weight: 4300,
    ballistics: { vertRecoil: 2.10, horizRecoil: 1.20, hipSpread: 3.4, adsTime: 0.38,
      mobility: 84, reloadTime: 2.90, muzzleVelocity: 830, effectiveRange: 800,
      loudness: 112, magCap: 10 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 0, -560], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'sidemount', label: 'КРОНШТЕЙН', type: 'side', pos: [-18, 30, -140], rot: [0, 0, 0],
        accepts: ['sidemount'], order: 1, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 44, -150], rot: [0, 0, 0],
        accepts: ['optic', 'magnifier'], length: 260, order: 2, group: 'body' },
      { key: 'under', label: 'СОШКИ', type: 'rail', pos: [0, -26, -330], rot: [0, 0, Math.PI],
        accepts: ['under'], length: 100, order: 2, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, -26, -110], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'magazine' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, 0, 30], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'flash_cone', optic: 'scope_pso1', under: 'bipod',
      mag: 'mag_svd_10', stock: 'stock_wood' }
  },

  /* --------------------------------------------------------- Remington 870 */
  remington870: {
    title: 'Remington 870',
    caliber: '12ga', weight: 3600,
    ballistics: { vertRecoil: 3.20, horizRecoil: 1.60, hipSpread: 5.0, adsTime: 0.34,
      mobility: 92, reloadTime: 0.85, muzzleVelocity: 400, effectiveRange: 60,
      loudness: 118, magCap: 5 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 0, -480], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 32, -60], rot: [0, 0, 0],
        accepts: ['optic', 'ironRear'], length: 120, order: 2, group: 'body' },
      { key: 'tactical', label: 'ФОНАРЬ', type: 'rail', pos: [-22, -8, -300], rot: [0, 0, Math.PI / 2],
        accepts: ['tactical'], length: 90, order: 2, group: 'body' },
      { key: 'stock', label: 'ПРИКЛАД', type: 'rear', pos: [0, 0, 30], rot: [0, 0, 0],
        accepts: ['stock'], order: 0, group: 'body' }
    ],
    defaults: { muzzle: 'thread_cap', optic: 'reddot_rmr', stock: 'stock_wood' }
  },

  /* ---------------------------------------------------------- Glock 18C */
  glock18c: {
    title: 'Glock 18C',
    caliber: '9mm', weight: 620,
    ballistics: { vertRecoil: 0.95, horizRecoil: 0.70, hipSpread: 2.8, adsTime: 0.18,
      mobility: 126, reloadTime: 1.85, muzzleVelocity: 375, effectiveRange: 90,
      loudness: 94, magCap: 17 },
    slots: [
      { key: 'muzzle', label: 'ДУЛО', type: 'thread', pos: [0, 0, -114], rot: [0, 0, 0],
        accepts: ['muzzle'], order: 0, group: 'body' },
      { key: 'optic', label: 'ПРИЦЕЛ', type: 'rail', pos: [0, 15, 40], rot: [0, 0, 0],
        accepts: ['optic'], length: 50, order: 2, group: 'slide' },
      { key: 'tactical', label: 'ФОНАРЬ', type: 'rail', pos: [0, -28, -62], rot: [0, 0, Math.PI],
        accepts: ['tactical'], length: 40, order: 2, group: 'body' },
      { key: 'mag', label: 'МАГАЗИН', type: 'well', pos: [0, -46, 6], rot: [0, 0, 0],
        accepts: ['mag'], order: 0, group: 'mag' }
    ],
    defaults: { muzzle: 'thread_cap', optic: 'reddot_rmr', mag: 'mag_pistol_17' }
  }
};

});


  const G = __req('kernel');
  const C = __req('common')(G);
  const SYS = __req('system')(G, C);
  const CATALOGS = [
    __req('optics')(G, C), __req('muzzle')(G, C),
    __req('tactical')(G, C), __req('mags_stocks')(G, C)
  ];
  const REG = SYS.registry(CATALOGS);
  const ADAPTER = __req('three_adapter')(G, C);
  const UI = __req('ui')();
  const SLOTS = __req('slots');
  return { G, C, SYS, REG, ADAPTER, UI, SLOTS, catalogs: CATALOGS };
})();


/* --- интерфейс кастомизации (генерируется src/attach/ui.js) --- */
const CUST_CSS = "\n#cust{position:fixed;left:0;right:0;bottom:0;z-index:20;font:500 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8eaed;pointer-events:none;letter-spacing:.06em}\n#cust.hidden{display:none}\n#custSlots{display:flex;gap:6px;justify-content:center;padding:0 10px 10px;flex-wrap:wrap;pointer-events:auto}\n.cslot{min-width:104px;border:1px solid rgba(255,255,255,.16);background:rgba(12,14,17,.72);backdrop-filter:blur(12px);padding:7px 10px;cursor:pointer;transition:border-color .15s,background .15s}\n.cslot:hover{background:rgba(26,30,36,.82)}\n.cslot.on{border-color:#e8b45c;background:rgba(232,180,92,.16)}\n.cslot .k{font-size:9.5px;color:rgba(255,255,255,.42);text-transform:uppercase}\n.cslot .v{font-size:12px;color:#fff;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}\n#custList{display:flex;gap:6px;justify-content:center;padding:0 10px 8px;flex-wrap:wrap;pointer-events:auto}\n.copt{border:1px solid rgba(255,255,255,.14);background:rgba(12,14,17,.66);padding:6px 11px;cursor:pointer;font-size:11.5px}\n.copt:hover{background:rgba(26,30,36,.8)}\n.copt.sel{border-color:#e8b45c;color:#ffd79a;background:rgba(232,180,92,.14)}\n.copt.bad{opacity:.42;border-style:dashed}\n#custStats{position:fixed;left:18px;top:86px;z-index:20;font:500 11px/1.7 ui-monospace,Menlo,monospace;pointer-events:none;min-width:190px}\n.cstat{display:flex;justify-content:space-between;gap:14px;padding:1px 7px;background:rgba(10,12,15,.55);border-left:2px solid rgba(255,255,255,.16)}\n.cstat.up{border-left-color:#6fcf7f;color:#a9e6b3}\n.cstat.dn{border-left-color:#e07a6a;color:#efa99b}\n.cstat b{font-weight:600}\n#custHint{text-align:center;padding-bottom:9px;color:rgba(255,255,255,.34);font-size:10.5px}\n#custWarn{text-align:center;color:#e6b07a;font-size:10.5px;padding-bottom:5px;min-height:14px}\n";
const STAT_DEFS = [{"k":"vertRecoil","label":"Подброс","up":false,"d":2},{"k":"horizRecoil","label":"Увод","up":false,"d":2},{"k":"hipSpread","label":"Разброс от бедра","up":false,"d":2},{"k":"adsTime","label":"Вскидка, с","up":false,"d":3},{"k":"mobility","label":"Подвижность","up":true,"d":0},{"k":"reloadTime","label":"Перезарядка, с","up":false,"d":3},{"k":"muzzleVelocity","label":"Скорость, м/с","up":true,"d":0},{"k":"effectiveRange","label":"Дальность, м","up":true,"d":0},{"k":"loudness","label":"Громкость","up":false,"d":0},{"k":"flashVisible","label":"Заметность вспышки","up":false,"d":0},{"k":"weight","label":"Масса, г","up":false,"d":0},{"k":"magCap","label":"Ёмкость","up":true,"d":0}];

function createCustomizer(opts) {
  const style = document.createElement('style');
  style.textContent = CUST_CSS;
  document.head.appendChild(style);

  const host = document.createElement('div'); host.id = 'cust';
  const warn = document.createElement('div'); warn.id = 'custWarn';
  const list = document.createElement('div'); list.id = 'custList';
  const slots = document.createElement('div'); slots.id = 'custSlots';
  const hint = document.createElement('div'); hint.id = 'custHint';
  hint.textContent = 'TAB — кастомизация · ← → выбор модуля · 1…9 слот · B — сошки/приклад · L — фонарь · K — ЛЦУ';
  host.append(warn, list, slots, hint);
  document.body.appendChild(host);

  const statBox = document.createElement('div'); statBox.id = 'custStats';
  document.body.appendChild(statBox);

  let active = null, prevStats = null;

  function render() {
    const cfg = opts.getConfig(), defs = opts.getSlots();
    slots.innerHTML = '';
    for (const s of defs) {
      const el = document.createElement('div');
      el.className = 'cslot' + (active === s.key ? ' on' : '');
      const cur = cfg[s.key];
      el.innerHTML = '<div class="k">' + s.label + '</div><div class="v">' +
        (cur ? opts.nameOf(cur) : '—') + '</div>';
      el.onclick = () => { active = s.key; render(); };
      slots.appendChild(el);
    }
    list.innerHTML = '';
    if (active) {
      const slot = defs.find((s) => s.key === active);
      const options = opts.optionsFor(active);
      for (const o of options) {
        const el = document.createElement('div');
        el.className = 'copt' + (cfg[active] === o.key ? ' sel' : '') + (o.fits === false ? ' bad' : '');
        el.textContent = o.label;
        el.onclick = () => { opts.setModule(active, o.key); render(); };
        list.appendChild(el);
      }
    }
    const st = opts.getStats();
    statBox.innerHTML = '';
    for (const d of STAT_DEFS) {
      if (st[d.k] === undefined) continue;
      const v = st[d.k], pv = prevStats ? prevStats[d.k] : v;
      let cls = 'cstat';
      if (pv !== undefined && Math.abs(v - pv) > 1e-6) cls += ((v > pv) === d.up) ? ' up' : ' dn';
      const row = document.createElement('div');
      row.className = cls;
      row.innerHTML = '<span>' + d.label + '</span><b>' + v.toFixed(d.d) + '</b>';
      statBox.appendChild(row);
    }
    const w = opts.getWarnings();
    warn.textContent = w && w.length ? w.join(' · ') : '';
  }

  return {
    render,
    markStats() { prevStats = Object.assign({}, opts.getStats()); },
    setActive(k) { active = k; render(); },
    getActive() { return active; },
    toggle(on) { host.classList.toggle('hidden', on === false); statBox.style.display = on === false ? 'none' : ''; },
    visible() { return !host.classList.contains('hidden'); }
  };
}
