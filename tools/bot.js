// Bot de balance: juega partidas completas sin gráficos y escribe registros en el MISMO formato
// que el juego (OM.LOG), para analizarlos igual que las partidas reales.
//
//   node tools/bot.js [--runs 300] [--skill medio] [--policy greedy] [--cue todos] [--out registro-bot.json]
//
// Usa la lógica real de puntuación, comodines, ediciones, jefes, tienda, sobres y economía.
// La física NO se simula tiro a tiro (sería lentísimo): el nº de bolas por tiro sale de
// distribuciones medidas con la física real (ver DEVLOG v1.1), ajustadas por troneras, jefes y skill.
// Para el modelo de efecto/bandas se sortean valores plausibles (sirven para activar comodines).
global.window = global; global.document = { createElement: () => ({ getContext: () => ({}) }) };
const path = require('path'), fs = require('fs');
['core/px.js', 'game/data.js', 'game/physics.js', 'game/run.js', 'game/telemetry.js', 'game/analytics.js'].forEach((f) => require(path.join(__dirname, '../src', f)));

// ---- argumentos ----
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]) : a), []));
const RUNS = +args.runs || 300;
const SKILL = args.skill || 'medio';
const POLICY = args.policy || 'greedy';
const CUE = args.cue || 'todos';
const OUT = args.out || null;
const QUIET = !!args.quiet;

// experimentos de curva: --bases 200,550,1500,... --kinds 1,1.5,2
if (args.bases) String(args.bases).split(',').forEach((v, i) => { if (OM.CIRCLES[i]) OM.CIRCLES[i].base = +v; });
if (args.kinds) String(args.kinds).split(',').forEach((v, i) => { if (OM.TABLE_KINDS[i]) OM.TABLE_KINDS[i].mul = +v; });

// --set SHOT_TYPES.simple.chips=30,CUES.0.shots=6 → cambia datos de diseño para experimentar
if (args.set) String(args.set).split(',').forEach((kv) => { const [p, v] = kv.split('='); const ks = p.split('.'); let o = OM; ks.slice(0, -1).forEach((k) => (o = o[k])); o[ks[ks.length - 1]] = isNaN(+v) ? v : +v; });

// todo desbloqueado: el bot prueba todo el contenido
OM.META = { best: 9, wins: 9, maxStreak: 20, bosses: 99, seen: {} };

// ---- modelo de tiro ----
const BREAK = [0.2, 0.35, 0.3, 0.15];
const SKILLS = { flojo: [0.5, 0.45, 0.05, 0], medio: [0.38, 0.54, 0.07, 0.01], bueno: [0.28, 0.6, 0.1, 0.02] };
const BOSS_MISS = { boca: 1.6, sepulturero: 1.25, niebla: 1.3, ciego: 1.35, pendulo: 1.2, cienaga: 1.1, escarcha: 1.15 };
function dist(R, T, isBreak) {
  const base = (isBreak ? BREAK : SKILLS[SKILL]).slice();
  const M = OM.Run.mods(R);
  let miss = base[0] * (BOSS_MISS[T.boss] || 1) / Math.pow(M.pocketMul, 2) / Math.pow(M.pocketPull, 0.15);
  if (M.guide >= 2) miss *= 0.85;
  miss = Math.min(0.85, Math.max(0.05, miss));
  const rest = base.slice(1), sum = rest.reduce((a, b) => a + b, 0) || 1;
  return [miss].concat(rest.map((p) => (p / sum) * (1 - miss)));
}
const pick = (rng, d) => { let r = rng(); for (let i = 0; i < d.length; i++) { if ((r -= d[i]) < 0) return i; } return 0; };

function playTable(R) {
  const M = OM.Run.mods(R), boss = OM.Run.boss(R), rng = R.rng;
  const T = { target: OM.Run.target(R), shots: R.baseShots + M.extraShots - (boss === 'reloj' ? 1 : 0), boss, score: 0, refunded: false, streak: 0 };
  // consumibles de mesa: la Tiza se usa al empezar
  for (let i = R.items.length - 1; i >= 0; i--) if (R.items[i] === 'tiza') { OM.LOG.item(R, 'tiza', 'table'); R.items.splice(i, 1); T.shots++; }
  R.jokers.forEach((J) => J.def.onTableStart && J.def.onTableStart(R, J));
  OM.LOG.tableStart(R, T);
  let onTable = R.balls.slice(), shotIndex = 0;
  while (T.shots > 0 && T.score < T.target) {
    if (!onTable.length) onTable = R.balls.slice();
    const isBreak = shotIndex === 0 || onTable.length === R.balls.length;
    let n = Math.min(pick(rng, dist(R, T, isBreak && shotIndex === 0)), onTable.length);
    const scratch = !M.noScratch && rng() < (isBreak ? 0.08 : 0.06);
    // las bolas: no la 8 salvo que sea la última (o maldición rara)
    const pool = rng.shuffle(onTable.filter((b) => b.num !== 8));
    let balls = pool.slice(0, n);
    const eightLeft = onTable.find((b) => b.num === 8);
    let cursed = false, clear = false;
    if (eightLeft && onTable.length - balls.length === 1 && n > 0 && rng() < 0.5) { balls.push(eightLeft); clear = !scratch; }
    else if (eightLeft && rng() < 0.015 && onTable.length > 1) { balls.push(eightLeft); cursed = true; }
    const shot = {
      balls: balls.map((b) => ({ ball: b, pocket: { corner: rng() < 0.67, x: 0, y: 0 }, banked: rng() < 0.15 })),
      scratch, cueContacts: 1 + (rng() < 0.4 ? 1 : 0) + (rng() < 0.15 ? 1 : 0), cueCushions: Math.floor(rng() * 4),
      shotIndex, shotsLeft: T.shots - 1, isBreak: shotIndex === 0, ballsLeft: onTable.length - balls.length, cursed, clear,
      streak: T.streak, spun: rng() < 0.35,
    };
    T.shots--;
    const S = OM.Run.score(R, shot);
    OM.LOG.shot(R, shot, S, { left: T.shots });
    S.events.forEach((e) => { if (e.k === 'money') R.money += e.v; });
    T.score += S.total;
    OM.Run.afterShot(R, S);
    R.stats.balls += balls.length; R.stats.shots++; R.stats.bestShot = Math.max(R.stats.bestShot, S.total);
    // la 8 maldita vuelve; las demás salen de la mesa
    onTable = onTable.filter((b) => !balls.includes(b) || (cursed && b.num === 8 && !M.eightSafe));
    // cristal
    balls.forEach((b) => { if (b.kind === 'cristal' && rng() < 0.25) { const i = R.balls.indexOf(b); if (i >= 0) R.balls.splice(i, 1); } });
    if (boss === 'verdugo' && (scratch || !balls.length)) T.shots = Math.max(0, T.shots - 1);
    T.streak = S.total > 0 ? T.streak + 1 : 0;
    if (!T.refunded && !balls.length && !scratch && M.refundMiss) { T.refunded = true; T.shots++; }
    shotIndex++;
  }
  const won = T.score >= T.target;
  let cash = 0;
  if (won) {
    R.stats.tables++;
    cash = OM.Run.cashout(R, T.shots).reduce((a, l) => a + l.v, 0);
    OM.LOG.tableEnd(R, true, T, cash);
    R.money += cash; R.stats.money += cash;
  } else OM.LOG.tableEnd(R, false, T);
  return won;
}

// ---- política de tienda ----
const RANK = { comun: 1, raro: 2, epico: 3, legendario: 4 };
function value(J) { return RANK[J.def.rarity] * 10 + (J.edition ? 6 : 0) + R_rand() * 5; }
let R_rand = Math.random;
function useItemBot(R, id) {
  const def = OM.itemDef(id);
  OM.LOG.item(R, id, 'shop');
  if (def.kind === 'luna') { R.levels[def.shot]++; return true; }
  if (def.kind === 'grabado') { const pool = R.balls.filter((b) => b.kind === 'normal' && b.num !== 8); if (pool.length) R.rng.pick(pool).kind = def.eng; return true; }
  if (id === 'ermitano') { R.money += Math.min(20, Math.max(0, R.money)); return true; }
  if (id === 'alquimista') { R.rng.shuffle(R.balls.filter((b) => b.kind === 'normal')).slice(0, 2).forEach((b) => (b.kind = 'oro')); return true; }
  if (id === 'juicio') { const j = OM.Run.randomJoker(R, false); if (j && !OM.Run.jokersFull(R)) R.jokers.push(OM.Run.newJoker(j)); return true; }
  return false; // de mesa: se guarda
}
function shop(R) {
  let S = OM.Run.makeShop(R); R.rerollCost = 5;
  OM.LOG.shopStart(R, S, false);
  const keep = POLICY === 'ahorro' ? 25 : POLICY === 'interes' ? 10 : 0; // dinero que intenta conservar
  const afford = (p) => R.money - p >= keep || (POLICY === 'greedy' && R.money >= p);
  for (let round = 0; round < 4; round++) {
    let boughtSomething = false;
    // comodines por valor
    S.slots.filter((o) => !o.sold).sort((a, b) => value(b.J) - value(a.J)).forEach((o) => {
      if (R.money < o.price || !afford(o.price)) return;
      if (OM.Run.jokersFull(R) && o.J.edition !== 'negativo') {
        // reemplazo: vende el peor si el nuevo es claramente mejor
        const worst = R.jokers.slice().sort((a, b) => value(a) - value(b))[0];
        if (!worst || value(worst) + 8 > value(o.J)) return;
        const p = OM.Run.sellPrice(worst); R.jokers.splice(R.jokers.indexOf(worst), 1); R.money += p; OM.LOG.sell(R, 'joker', worst.id + (worst.edition ? '+' + worst.edition : ''), p);
      }
      R.money -= o.price; o.sold = true; OM.LOG.buy(R, o); R.jokers.push(o.J); boughtSomething = true;
    });
    // lunas y grabados (se usan ya); tiza para la mesa
    S.items.filter((o) => !o.sold).forEach((o) => {
      const d = OM.itemDef(o.id);
      const useful = d.kind !== 'arcano' || ['ermitano', 'alquimista', 'juicio', 'tiza'].includes(o.id);
      if (!useful || R.money < o.price || !afford(o.price + 2)) return;
      if (o.id === 'tiza' && R.items.length >= R.itemSlots) return;
      R.money -= o.price; o.sold = true; OM.LOG.buy(R, o); boughtSomething = true;
      if (!useItemBot(R, o.id)) R.items.push(o.id);
    });
    // sobres
    S.packs.filter((o) => !o.sold).forEach((o) => {
      if (R.money < o.price || !afford(o.price + 2)) return;
      if (o.kind === 'maldito' && OM.Run.jokersFull(R)) return;
      R.money -= o.price; o.sold = true; OM.LOG.buy(R, o); boughtSomething = true;
      const opts = OM.Run.openPack(R, o.kind);
      let chosen = null;
      if (o.kind === 'maldito') { chosen = opts.slice().sort((a, b) => value(b.J) - value(a.J))[0]; if (chosen && (!OM.Run.jokersFull(R) || chosen.J.edition === 'negativo')) R.jokers.push(chosen.J); else chosen = null; }
      else { chosen = opts.find((op) => OM.itemDef(op.id).kind !== 'arcano' || ['ermitano', 'alquimista', 'juicio'].includes(op.id)) || null; if (chosen) useItemBot(R, chosen.id); }
      OM.LOG.packPick(R, o.kind, opts, chosen ? chosen.id + (chosen.J && chosen.J.edition ? '+' + chosen.J.edition : '') : null);
    });
    // reroll si sobra dinero y no compró
    if (!boughtSomething && R.money - R.rerollCost >= Math.max(12, keep) && round < 3) {
      const cost = R.rerollCost; R.money -= cost; R.rerollCost++;
      const packs = S.packs; S = OM.Run.makeShop(R); S.packs = packs;
      OM.LOG.reroll(R, S, cost);
    } else break;
  }
  OM.LOG.shopEnd(R);
}

// ---- partida ----
function playRun(i) {
  const cues = OM.CUES.map((c) => c.id);
  const cue = CUE === 'todos' ? cues[i % cues.length] : CUE;
  const R = OM.Run.create(cue, 1000 + i * 7919);
  R_rand = R.rng;
  OM.LOG.startRun(R, 'bot');
  R.log.bot = { skill: SKILL, policy: POLICY };
  for (;;) {
    const won = playTable(R);
    if (!won) { OM.LOG.endRun(R, 'lose'); break; }
    R.tableIdx++;
    if (R.tableIdx > 2) { R.tableIdx = 0; R.circle++; if (R.circle >= OM.CIRCLES.length) { OM.LOG.endRun(R, 'victory'); break; } }
    shop(R);
  }
  return R.log;
}

const t0 = Date.now();
const logs = [];
for (let i = 0; i < RUNS; i++) logs.push(playRun(i));
const A = OM.Analytics.aggregate(logs);
if (!QUIET) console.log(OM.Analytics.report(A));
console.log('\n' + RUNS + ' partidas de bot (skill ' + SKILL + ', política ' + POLICY + ') en ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify({ game: '8', exportedAt: new Date().toISOString(), runs: logs }));
  console.log('registro escrito en ' + OUT + ' (impórtalo en el juego: REGISTRO → IMPORTAR)');
}
