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
      out.warnings.push('Прицелу нужен боковой кронштейн');
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
