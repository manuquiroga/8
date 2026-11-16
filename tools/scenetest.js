// Captura cada escena forzando el estado: node tools/scenetest.js <outdir>
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto('file://' + path.resolve(__dirname, '../index.html')); await page.waitForTimeout(1200);
  await page.screenshot({ path: out + '/s_title.png' });
  const go = async (code, name, wait = 900) => { await page.evaluate(code); await page.waitForTimeout(wait); await page.screenshot({ path: out + '/' + name + '.png' }); };
  await go(`OM.R = OM.Run.create('usura', 123); ['tiza_azul','racha','espejo_roto','diablo'].forEach(id=>OM.R.jokers.push(OM.Run.newJoker(id))); OM.R.items.push('tiza','luna_doblete'); OM.R.balls[2].kind='fuego'; OM.R.balls[10].kind='holo'; OM.go('map')`, 's_map');
  await go(`OM.go('shop')`, 's_shop');
  await page.mouse.move((192+30+20)*2, (72+44+20)*2); await page.waitForTimeout(300); await page.screenshot({ path: out + '/s_shop_hover.png' });
  await go(`OM.SCENES.shop.buy({type:'pack', kind:'maldito', price:0})`, 's_pack', 1500);
  await go(`OM.SCENES.shop.pack=null; OM.HUD.useItem(OM.R,-1,'shop',OM.SCENES.map.api,'g_cristal')`, 's_picker');
  await go(`OM.HUD.picker=null; OM.R.tableIdx=2; OM.R.circle=1; OM.go('map')`, 's_map_boss');
  await go(`OM.go('table')`, 's_table_boss', 2500);
  await go(`OM.go('collection')`, 's_collection');
  await go(`OM.go('gameover',{reason:'score',score:900,target:1200})`, 's_gameover');
  await go(`OM.go('victory')`, 's_victory', 1500);
  console.log(errs.length ? errs.join('\n') : 'sin errores'); await b.close();
})();
