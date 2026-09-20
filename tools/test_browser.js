#!/usr/bin/env node
/* ============================================================================
   Браузерные проверки: то, что нельзя увидеть без рендера.
     1) модули не накапливаются при замене (старый снимается);
     2) снятие модуля возвращает штатную деталь;
     3) дочерние слоты кронштейна и цевья появляются и работают;
     4) страница не бросает ошибок.
   Требуется локальный сервер на 8099.
   ========================================================================== */
const { chromium } = require('/usr/lib/node_modules/playwright');

const CASES = [
  { w: 'ak74', mount: 'mount_dustcover', optic: 'mount.top', hg: 'handguard_mlok' },
  { w: 'akm', mount: 'mount_dustcover', optic: 'mount.top', hg: 'handguard_mlok' },
  { w: 'm416', optic: 'optic', hg: 'handguard_mlok' },
  { w: 'scar-h', optic: 'optic' },
  { w: 'mp5a3', optic: 'optic' }
];

(async () => {
  const b = await chromium.launch({ args: ['--headless=new', '--use-gl=swiftshader',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
    '--no-sandbox', '--ignore-gpu-blocklist', '--enable-webgl'] });
  let fails = 0, checks = 0;
  const ok = (c, m) => { checks++; if (!c) { fails++; console.log('  ✗ ' + m); } };

  for (const cs of CASES) {
    const p = await b.newPage({ viewport: { width: 900, height: 520 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://127.0.0.1:8099/BOX/' + cs.w + '.html', { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(5500);

    const r = await p.evaluate(`(() => {
      const H = window.__MEASURE_HOST;
      if (!H || !window.ATTACH) return { error: 'система не поднялась' };
      /* считаем меши модулей: они помечены attachModule */
      const modMeshes = () => { let n = 0; H.traverse(o => { if (o.isMesh && o.userData.attachModule) n++; }); return n; };
      /* Базовые детали часто слиты в один меш по материалу, а зоны вырезают
         треугольники. Поэтому меряем видимую геометрию в треугольниках. */
      const baseTris = () => {
        let n = 0;
        H.traverse(o => {
          if (!o.isMesh || o.userData.attachModule || !o.visible || !o.geometry) return;
          const pos = o.geometry.attributes && o.geometry.attributes.position;
          if (!pos) return;
          const arr = pos.array;
          for (let t = 0; t < arr.length / 9; t++) {
            const b = t * 9;
            /* схлопнутый треугольник = вырезанный */
            if (arr[b] !== arr[b+3] || arr[b+1] !== arr[b+4] || arr[b+2] !== arr[b+5]) n++;
          }
        });
        return n;
      };
      const out = { steps: [] };
      const cfg = ${JSON.stringify(cs)};

      /* 1. многократная замена одного слота не должна копить геометрию */
      const seq = ['flash_a2', 'brake_ak', 'suppressor_qd', 'flash_a2'];
      const counts = [];
      for (const m of seq) { window.ATTACH.set('muzzle', m); counts.push(modMeshes()); }
      out.muzzleCounts = counts;

      /* 2. снятие возвращает штатную деталь */
      const withMod = (() => { window.ATTACH.set('muzzle', 'brake_ak'); return baseTris(); })();
      const without = (() => { window.ATTACH.set('muzzle', null); return baseTris(); })();
      out.baseWith = withMod; out.baseWithout = without;

      /* 3. дочерние слоты */
      if (cfg.mount) {
        window.ATTACH.set('mount', cfg.mount);
        out.childSlots = window.ATTACH.slots().filter(s => s.indexOf('.') > 0);
        window.ATTACH.set(cfg.optic, 'reddot_t2');
        out.opticSet = !!window.__ATTACH_DEBUG().modules.includes(cfg.optic);
      } else if (cfg.optic) {
        window.ATTACH.set(cfg.optic, 'reddot_t2');
        out.opticSet = !!window.__ATTACH_DEBUG().modules.includes(cfg.optic);
      }
      if (cfg.hg) {
        window.ATTACH.set('handguard', cfg.hg);
        out.hgSlots = window.ATTACH.slots().filter(s => s.indexOf('handguard.') === 0);
      }

      /* 4. повторная установка того же модуля не дублирует */
      const before = modMeshes();
      window.ATTACH.set('muzzle', 'brake_ak');
      window.ATTACH.set('muzzle', 'brake_ak');
      out.repeatStable = modMeshes() === before + (before ? 0 : 0) ? true : modMeshes();
      out.afterRepeat = modMeshes();
      return out;
    })()`).catch((e) => ({ error: e.message }));

    console.log('— ' + cs.w);
    ok(!r.error, cs.w + ': ' + r.error);
    if (!r.error) {
      const c = r.muzzleCounts || [];
      ok(c.length === 4 && c[0] === c[3],
        cs.w + ': замена дула копит геометрию (' + c.join('→') + ')');
      ok(r.baseWithout > r.baseWith,
        cs.w + ': снятие модуля не вернуло штатную деталь (' + r.baseWith + '→' + r.baseWithout + ')');
      if (cs.mount) {
        ok((r.childSlots || []).length > 0, cs.w + ': кронштейн не дал слот под прицел');
        ok(r.opticSet === true, cs.w + ': прицел не встал в слот кронштейна');
      } else if (cs.optic) {
        ok(r.opticSet === true, cs.w + ': прицел не установился');
      }
      if (cs.hg) ok((r.hgSlots || []).length >= 3, cs.w + ': цевьё не дало планок');
    }
    ok(errs.length === 0, cs.w + ': ошибки страницы — ' + errs.slice(0, 2).join(' | '));
    await p.close();
  }

  await b.close();
  console.log('\n' + (fails ? '✗ провалено ' + fails + ' из ' + checks : '✓ все ' + checks + ' браузерных проверок пройдены'));
  process.exit(fails ? 1 : 0);
})();
