// Uso: node tools/shot.js <pagina.html> <salida.png> [escala=2] [esperaMs=600] [ancho=640] [alto=360]
// Admite query string ("tools/preview_table.html?theme=ira"). Abre la página por file:// y hace captura. Útil para revisar arte (luego abre el PNG con Read).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [page_, out, scale = '2', wait = '600', w = '640', h = '360'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const qi = page_.search(/[?#]/); // admite query string: pagina.html?theme=ira
  const file = qi >= 0 ? page_.slice(0, qi) : page_, query = qi >= 0 ? page_.slice(qi) : '';
  await page.goto('file://' + path.resolve(file) + query);
  await page.waitForTimeout(+wait);
  await page.screenshot({ path: out });
  if (errs.length) console.log('ERRORES:\n' + errs.join('\n'));
  else console.log('ok', out);
  await browser.close();
})();
