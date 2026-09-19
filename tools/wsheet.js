/* Контактный лист по оружиям: открывает каждый файл, крутит вид, склеивает. */
const { chromium } = require('/usr/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const list = process.argv[2].split(',');
  const out = process.argv[3];
  const CW = 760, CH = 430, cols = 2;
  const b = await chromium.launch({ args: ['--headless=new', '--use-gl=swiftshader',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
    '--no-sandbox', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const shots = [];
  for (const it of list) {
    const page = await b.newPage({ viewport: { width: CW, height: CH } });
    page.on('pageerror', (e) => console.log('  ERR ' + it + ': ' + e.message));
    await page.goto('http://127.0.0.1:8099/BOX/' + it + '.html', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(6500);
    await page.mouse.move(CW / 2, CH / 2);
    await page.mouse.down();
    await page.mouse.move(CW / 2 + 240, CH / 2 - 30, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(1600);
    const f = '/tmp/w_' + it + '.png';
    await page.screenshot({ path: f });
    shots.push(f);
    await page.close();
    process.stdout.write(it + ' ');
  }
  await b.close();
  const b2 = await chromium.launch({ args: ['--headless=new', '--no-sandbox'] });
  const rows = Math.ceil(shots.length / cols);
  const p2 = await b2.newPage({ viewport: { width: CW * cols, height: CH * rows } });
  const d = shots.map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
  await p2.setContent('<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(' +
    cols + ',' + CW + 'px)">' + d.map((x) => '<img src="' + x + '" width="' + CW + '" height="' + CH + '">').join('') + '</body>');
  await p2.waitForTimeout(600);
  await p2.screenshot({ path: out });
  await b2.close();
  console.log('\n' + out);
})();
