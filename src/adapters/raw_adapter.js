/* ============================================================================
   Адаптер для «сырых» WebGL-движков (СВД, Remington 870, Glock 18C).

   Эти файлы рисуют индексированные меши собственного формата и не используют
   three.js. Адаптер конвертирует треугольный суп системы модулей в нужный
   формат и отдаёт материалы в терминах конкретного движка.

   Поддерживаемые форматы:
     'pnti' — {p,n,t,e,i}  (СВД): позиция, нормаль, UV, ребро, индексы;
     'pni'  — {p,n,i}      (Glock);
     'posTri' — {pos,nrm,tri} (Remington).
   ========================================================================== */
module.exports = function (G, C) {

  /* Сварка вершин: суп → индексированный меш. Порог 0,02 мм. */
  function weld(raw, fmt) {
    const map = new Map();
    const P = [], N = [], I = [];
    const Q = 50;                                   // 1/0.02 мм
    const n = raw.p.length / 3;
    for (let i = 0; i < n; i++) {
      const x = raw.p[i * 3], y = raw.p[i * 3 + 1], z = raw.p[i * 3 + 2];
      const nx = raw.n[i * 3], ny = raw.n[i * 3 + 1], nz = raw.n[i * 3 + 2];
      /* нормаль входит в ключ: острые рёбра не сглаживаются */
      const k = Math.round(x * Q) + ',' + Math.round(y * Q) + ',' + Math.round(z * Q) + '|' +
        Math.round(nx * 16) + ',' + Math.round(ny * 16) + ',' + Math.round(nz * 16);
      let idx = map.get(k);
      if (idx === undefined) {
        idx = P.length / 3;
        P.push(x, y, z); N.push(nx, ny, nz);
        map.set(k, idx);
      }
      I.push(idx);
    }
    const vc = P.length / 3;
    if (fmt === 'pni') return { p: P, n: N, i: I };
    if (fmt === 'posTri') return { pos: P, nrm: N, tri: I };
    /* pnti: UV по проекции + признак ребра */
    const T = new Array(vc * 2).fill(0), E = new Array(vc).fill(0);
    for (let v = 0; v < vc; v++) {
      T[v * 2] = P[v * 3] * 0.01;
      T[v * 2 + 1] = P[v * 3 + 2] * 0.01;
    }
    return { p: P, n: N, t: T, e: E, i: I };
  }

  /* Материал системы → материал движка. */
  function material(matKey, engine) {
    const d = C.MATS[matKey] || C.MATS.steel;
    if (engine === 'svd') {
      return { base: d.color.slice(), metal: d.metal, rough: d.rough, kind: 0,
        wear: 0.35, axis: 2, opacity: d.alpha === undefined ? 1 : d.alpha,
        emis: d.emis ? d.emis.slice() : [0, 0, 0], aoStr: 1, name: matKey };
    }
    if (engine === 'glock') {
      return { a: d.color.slice(), m: d.metal, r: d.rough, cc: d.coat || 0,
        d: 0, mk: 0, emis: d.emis ? d.emis.slice() : null, alpha: d.alpha };
    }
    /* remington */
    return { base: d.color.slice(), metal: d.metal, rough: d.rough, type: 0,
      ao: 1.0, emis: d.emis ? d.emis.slice() : undefined, alpha: d.alpha };
  }

  /* Разложить сборку по деталям в формате движка.
     scale — множитель (движки работают в мм или в метрах). */
  function convert(asm, o) {
    const O = Object.assign({ fmt: 'pnti', engine: 'svd', scale: 1 }, o || {});
    const out = [];
    for (const p of asm.parts) {
      const raw = O.scale === 1 ? p.geo
        : { p: p.geo.p.map((v) => v * O.scale), n: p.geo.n.slice() };
      out.push({
        name: p.name, slot: p.src, module: p.module,
        mesh: weld(raw, O.fmt),
        mat: material(p.mat, O.engine),
        matKey: p.mat,
        glass: (asm.glass || []).indexOf(p.name) >= 0,
        emissive: (asm.emissive || []).indexOf(p.name) >= 0
      });
    }
    return out;
  }

  return { weld, material, convert };
};
