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
