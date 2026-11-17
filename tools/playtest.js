// Playtest automatizado: node tools/playtest.js [outdir] [partidas=1]
// Recorre título → preparación → tienda → mesa (el jugador humano tira al azar contra el bot) y captura cada escena.
// Necesita playwright (PLAYWRIGHT=/ruta/a/node_modules/playwright si no está instalado aquí).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '/tmp', matches = +process.argv[3] || 1;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  const shot = async (n) => { await page.screenshot({ path: path.join(out, n + '.png') }); };
  const click = async (x, y) => { await page.mouse.move(x * 2, y * 2); await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up(); await page.waitForTimeout(80); };
  const st = () => page.evaluate(() => ({ scene: OM.sceneName, phase: OM.dbg() && OM.dbg().phase, turn: OM.S && OM.S.M ? OM.S.M.turn : -1, err: OM.lastError || null }));
  await page.waitForTimeout(1500); await shot('01_title');
  await page.keyboard.press('Enter'); await page.waitForTimeout(900); await shot('02_setup');
  await page.keyboard.press('Enter'); await page.waitForTimeout(1600); await shot('03_shop');
  if (process.env.START) { await page.evaluate((i) => { OM.S.matchIdx = i; OM.go('shop'); }, +process.env.START); await page.waitForTimeout(1500); }
  for (let m = 0; m < matches; m++) {
    // tienda: elige la primera carta, la compra (B) y sale (Enter)
    await page.waitForTimeout(700); await page.keyboard.press('Digit1'); await page.waitForTimeout(300); await shot(`m${m}_03a_shop_sel`);
    await page.keyboard.press('KeyB'); await page.waitForTimeout(400); await shot(`m${m}_03b_shop_buy`);
    await page.keyboard.press('Enter'); await page.waitForTimeout(3200); await shot(`m${m}_04_intro`);
    await page.keyboard.press('Enter'); await page.waitForTimeout(600);
    let shots = 0, shotAim = false;
    for (let k = 0; k < 2400; k++) {
      const s = await st();
      if (s.err) { errs.push('OM.lastError: ' + s.err); break; }
      if (s.scene !== 'table') break;
      if (s.phase === 'end') { await page.waitForTimeout(2500); await shot(`m${m}_09_end`); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); break; }
      if (s.turn === 0 && s.phase === 'place') { await click(250 + Math.random() * 40, 150 + Math.random() * 80); continue; }
      if (s.turn === 0 && s.phase === 'aim') {
        // dispara a una bola legal al azar (acelerado: usa las acciones del juego con el teclado/ratón reales)
        const aim = await page.evaluate(() => {
          const T = OM.dbg().T, c = T.W.balls.find((b) => b.num === 0);
          const o = T.W.balls.filter((b) => b.alive && b.num && OM.Match.legalFirst(OM.S, T.W, b.num));
          const t = o[Math.floor(Math.random() * o.length)] || { x: 400, y: 190 };
          return { cx: c.x, cy: c.y, tx: t.x, ty: t.y };
        });
        if (shots % 3 === 1) { await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE'); await page.keyboard.press('KeyD'); await page.keyboard.press('KeyD'); }
        if (shots % 5 === 3) { for (let i = 0; i < 6; i++) await page.keyboard.press('KeyE'); }
        await page.mouse.move(aim.tx * 2, aim.ty * 2); await page.waitForTimeout(120);
        if (!shotAim && shots === 1) { await shot(`m${m}_05_aim_masse`); shotAim = true; }
        await page.mouse.down();
        const dx = aim.tx - aim.cx, dy = aim.ty - aim.cy, d = Math.hypot(dx, dy) || 1;
        await page.mouse.move((aim.tx - dx / d * 75) * 2, (aim.ty - dy / d * 75) * 2, { steps: 4 });
        if (shots === 0) await shot(`m${m}_06_charge`);
        await page.mouse.up(); shots++;
        await page.waitForTimeout(500); if (shots === 1) await shot(`m${m}_07_rolling`);
        continue;
      }
      if (s.phase === 'scoring' && k % 9 === 0 && shots < 6) await shot(`m${m}_08_scoring_${k}`);
      await page.waitForTimeout(200);
    }
    const s = await st();
    console.log('partida', m + 1, 'tiros del jugador', shots, '→ escena', s.scene, await page.evaluate(() => OM.S.players.map((p) => p.name + ' ' + p.points + 'pts ' + p.wins + 'w').join(' | ')));
    if (s.scene === 'shop') { await page.waitForTimeout(800); await shot(`m${m}_10_shop`); }
    if (s.scene === 'final') { await page.waitForTimeout(800); await shot('11_final'); break; }
  }
  console.log(errs.length ? errs.join('\n') : 'sin errores');
  await browser.close();
})();
