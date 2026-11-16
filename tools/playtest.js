// Playtest automatizado: node tools/playtest.js [outdir]
// Recorre título → taco → mapa → mesa (tira varios golpes) → captura cada escena y reporta errores.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '/tmp';
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  const shot = async (n) => { await page.screenshot({ path: path.join(out, n + '.png') }); };
  const click = async (x, y) => { await page.mouse.move(x * 2, y * 2); await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up(); await page.waitForTimeout(80); };
  await page.waitForTimeout(1500); await shot('01_title');
  await page.keyboard.press('Enter'); await page.waitForTimeout(900); await shot('02_cues');
  await page.keyboard.press('Enter'); await page.waitForTimeout(900); await shot('03_map');
  await page.keyboard.press('Enter'); await page.waitForTimeout(1200); await shot('04_table_intro'); await page.evaluate(() => { OM.dbg().T.target = 40; });
  await page.waitForTimeout(1200);
  // colocar blanca
  await click(250, 190); await page.waitForTimeout(300);
  // tirar varios golpes hacia la bola más cercana
  for (let s = 0; s < 6; s++) {
    const st = await page.evaluate(() => OM.sceneName);
    if (st !== 'table') break;
    const tgt = await page.evaluate(() => {
      const W = OM._T && OM._T.W; return null;
    });
    // apuntar hacia el centro del triángulo/alguna bola
    const aim = await page.evaluate(() => {
      const balls = (OM.dbg && OM.dbg().balls) || [];
      const c = balls.find((b) => b.num === 0), o = balls.filter((b) => b.num !== 0 && b.alive);
      if (!c || !o.length) return null;
      const t = o[Math.floor(Math.random() * o.length)];
      return { cx: c.x, cy: c.y, tx: t.x, ty: t.y, phase: OM.dbg().phase };
    });
    if (!aim) break;
    if (aim.phase === 'place') { await click(250, 190); await page.waitForTimeout(200); continue; }
    await page.mouse.move(aim.tx * 2, aim.ty * 2); await page.waitForTimeout(100);
    if (s === 0) await shot('05_aim');
    await page.mouse.down();
    const dx = aim.tx - aim.cx, dy = aim.ty - aim.cy, d = Math.hypot(dx, dy);
    await page.mouse.move((aim.tx - dx / d * 70) * 2, (aim.ty - dy / d * 70) * 2, { steps: 5 });
    if (s === 0) await shot('06_charge');
    await page.mouse.up();
    await page.waitForTimeout(700); if (s === 0) await shot('07_rolling');
    for (let k = 0; k < 40; k++) { const ph = await page.evaluate(() => OM.dbg && OM.dbg().phase); if (ph === 'aim' || ph === 'place' || ph === 'won' || ph === 'lost') break; if (ph === 'scoring' && k % 6 === 0) await shot('08_scoring_' + s + '_' + k); await page.waitForTimeout(250); }
  }
  await shot('09_after');
  console.log(errs.length ? errs.join('\n') : 'sin errores');
  await browser.close();
})();
