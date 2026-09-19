/* Контактный лист: снимает набор модулей и клеит в одну картинку. */
const { chromium } = require('/usr/lib/node_modules/playwright');
const fs = require('fs');

(async () => {
  const items = process.argv[2].split(',');
  const out = process.argv[3];
  const view = process.argv[4] || 'side';
  const cols = parseInt(process.argv[5] || '3', 10);
  const CW = 620, CH = 360;
  const browser = await chromium.launch({ args: ['--headless=new', '--use-gl=swiftshader',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
    '--no-sandbox', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: CW, height: CH } });
  const shots = [];
  for (const it of items) {
    const url = 'http://127.0.0.1:8099/tools/preview.html?mode=module&m=' + it + '&view=' + view;
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__READY === true', { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(900);
    const f = '/tmp/cell_' + it + '.png';
    await page.screenshot({ path: f });
    shots.push(f);
    process.stdout.write(it + ' ');
  }
  await browser.close();
  /* склейка через второй headless-контекст на canvas */
  const b2 = await chromium.launch({ args: ['--headless=new', '--no-sandbox'] });
  const rows = Math.ceil(shots.length / cols);
  const p2 = await b2.newPage({ viewport: { width: CW * cols, height: CH * rows } });
  const datas = shots.map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
  await p2.setContent('<body style="margin:0;background:#0f1113;display:grid;grid-template-columns:repeat(' +
    cols + ',' + CW + 'px)">' + datas.map((d) => '<img src="' + d + '" width="' + CW + '" height="' + CH + '">').join('') + '</body>');
  await p2.waitForTimeout(700);
  await p2.screenshot({ path: out });
  await b2.close();
  console.log('\nготово:', out);
})();
