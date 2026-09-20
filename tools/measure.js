/* Обмер базовых моделей в ЛОКАЛЬНОЙ системе оружия (без вращения показа).
   Нужен, чтобы сажать модули по реальной геометрии, а не на глаз. */
const { chromium } = require('/usr/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--headless=new', '--use-gl=swiftshader',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
    '--no-sandbox', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const out = {};
  for (const w of process.argv[2].split(',')) {
    const p = await b.newPage();
    p.on('pageerror', (e) => console.log('# ' + w + ' ERR ' + e.message));
    await p.goto('http://127.0.0.1:8099/BOX/' + w + '.html', { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(5500);
    const r = await p.evaluate(`(() => {
      const THREE = window.__MEASURE_THREE, host = window.__MEASURE_HOST;
      if (!host) return { error: 'нет хоста' };
      host.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(host.matrixWorld).invert();
      const N = (v) => +(v * 1000).toFixed(1);
      const res = { parts: {}, groups: {} };
      host.traverse((o) => {
        if (o.userData && o.userData.attachModule) return;
        if (o.isMesh && o.geometry) {
          o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox.clone();
          const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
          bb.applyMatrix4(m);
          const nm = o.name || '(no-name)';
          const prev = res.parts[nm];
          const cur = [N(bb.min.x), N(bb.min.y), N(bb.min.z), N(bb.max.x), N(bb.max.y), N(bb.max.z)];
          res.parts[nm] = prev ? [Math.min(prev[0],cur[0]),Math.min(prev[1],cur[1]),Math.min(prev[2],cur[2]),
            Math.max(prev[3],cur[3]),Math.max(prev[4],cur[4]),Math.max(prev[5],cur[5])] : cur;
        } else if (!o.isMesh && o.name && !/^slot:|^emitter:/.test(o.name)) {
          res.groups[o.name] = [N(o.position.x), N(o.position.y), N(o.position.z)];
        }
      });
      return res;
    })()`).catch((e) => ({ error: String(e.message) }));
    out[w] = r;
    await p.close();
    console.log('# измерено: ' + w + ' (' + Object.keys(r.parts || {}).length + ' деталей)');
  }
  await b.close();
  require('fs').writeFileSync(process.argv[3] || '/tmp/measures.json', JSON.stringify(out, null, 1));
})();
