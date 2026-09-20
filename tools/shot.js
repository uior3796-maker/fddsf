/* Снимок страницы оружия в headless-Chromium + сбор ошибок консоли. */
const { chromium } = require('/usr/lib/node_modules/playwright');

(async () => {
  const url = process.argv[2];
  const out = process.argv[3] || 'tools/shots/shot.png';
  const actions = process.argv[4] || '';
  const browser = await chromium.launch({
    args: ['--headless=new', '--use-gl=swiftshader', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--disable-gpu-sandbox', '--no-sandbox',
      '--ignore-gpu-blocklist', '--enable-webgl', '--disable-web-security'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => logs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  for (const a of actions.split(',').filter(Boolean)) {
    if (a.startsWith('key:')) await page.keyboard.press(a.slice(4));
    else if (a.startsWith('wait:')) await page.waitForTimeout(parseInt(a.slice(5), 10));
    else if (a.startsWith('eval:')) {
      const r = await page.evaluate(a.slice(5)).catch((e) => 'EVAL ERR ' + e.message);
      logs.push('[eval] ' + JSON.stringify(r));
    }
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out });
  console.log(logs.join('\n') || '(консоль пуста)');
  await browser.close();
})();
