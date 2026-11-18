// Prueba headless: series completas bot contra bot con las reglas y la física reales.
//   node tools/simtest.js [series=20] [nivelA=medio] [nivelB=medio] [modo=8|9|mix] [formato=serie|caos]
// Sirve para comprobar que nada revienta y para medir balance (quién gana, puntos, tiros por partida, saque).
global.window = global; global.document = { createElement: () => ({ getContext: () => ({}) }) };
['core/px.js', 'game/data.js', 'game/physics.js', 'game/match.js', 'game/ai.js'].forEach((f) => require('../src/' + f));
const [N = '20', A = 'medio', B = 'medio', MODE = '8', FMT = 'serie'] = process.argv.slice(2);
const CAOS = FMT === 'caos';
const M = OM.Match, P = OM.Physics;

function playShot(S, W, st) {
  const lvl = S.players[S.M.turn].level;
  const cue = M.cueBall(W);
  if (CAOS) { const f = M.caosTurnStart(S, W); if (f) f.forEach((r) => { st.actives[r.kind] = (st.actives[r.kind] || 0) + 1; }); M.applyTurn(S, W); }
  if (S.M.inHand) {
    if (!cue.alive) { cue.alive = true; cue.sinking = false; cue.sink = 0; }
    const p = OM.AI.place(S, W, lvl); cue.x = p.x; cue.y = p.y; S.M.inHand = null;
  }
  let pl = OM.AI.plan(S, W, lvl), guard = 0;
  while (pl.joker != null && guard++ < 4) {
    const r = M.useActive(S, S.M.turn, pl.joker, W), kind = r && r.kind;
    if (kind) st.actives[kind] = (st.actives[kind] || 0) + 1;
    if (kind === 'boost') M.applyTurn(S, W);
    if (kind === 'quake') {
      const cur = M.freeCur();
      P.quake(W, 260); P.run(W, 15, (e) => M.track(cur, e)); M.resolveQuake(S, W, cur); st.quakes++;
      if (!cue.alive) { cue.alive = true; cue.sinking = false; }
    }
    if (S.M.inHand) { const p = OM.AI.place(S, W, lvl); cue.x = p.x; cue.y = p.y; S.M.inHand = null; }
    pl = OM.AI.plan(S, W, lvl);
  }
  if (pl.joker != null) pl = { angle: 0, power: 0.5, spin: { f: 0, s: 0 }, elev: 0 };
  const wasBreak = S.M.breakShot, who = S.M.turn;
  // CAOS: el que espera compra (y a veces usa trampas) mientras el otro apunta
  if (CAOS) for (let k = 0; k < 3; k++) {
    const pi = 1 - S.M.turn, a = OM.AI.caosAct(S, pi);
    if (!a) break;
    const r = M.caosOp(S, Object.assign({ pi, n: S.M.caos.ops[pi] }, a), W);
    if (r && !r.err) { st.caosOps[a.a] = (st.caosOps[a.a] || 0) + 1; if (a.a === 'buy') st.seenBuy[r.id] = 1; }
    M.applyTurn(S, W);
  }
  const cur = M.beginShot(S, W, pl);
  P.run(W, 30, (e) => M.track(cur, e));
  if (P.moving(W)) st.stuck++;
  const out = M.resolve(S, W, cur);
  if (out.rewound) st.rewinds++;
  if (out.bag) st.bags++;
  if (out.rally != null) st.rallies++;
  if (out.fuse) st.fuses = (st.fuses || 0) + 1;
  if (S.M) st.maxChain = Math.max(st.maxChain || 0, S.M.chain || 0);
  if (out.caos) { st.turns++; if (out.caos.cond) st.conds[S.M.obstacles.join('+')] = (st.conds[S.M.obstacles.join('+')] || 0) + 1; st.expired += out.caos.expired.length; }
  st.shots++; if (out.foul) st.fouls++; if (cur.pocketed.length) st.pots++;
  if (wasBreak) { st.breaks++; st.breakBalls += cur.pocketed.length; if (cur.scratch) st.breakScratch++; }
  st.byLevel[who].shots++; if (out.total > 0) st.byLevel[who].scoring++;
  st.best = Math.max(st.best, out.total);
  if (out.win == null) M.applyTurn(S, W);
  return out;
}

const st = { rallies: 0, endCash: [], caosOps: {}, seenBuy: {}, bags: 0, turns: 0, conds: {}, expired: 0, actives: {}, rewinds: 0, bought: {}, money: [], shots: 0, fouls: 0, pots: 0, breaks: 0, breakBalls: 0, breakScratch: 0, stuck: 0, quakes: 0, best: 0, byLevel: [{ shots: 0, scoring: 0 }, { shots: 0, scoring: 0 }] };
const res = { comeback: 0, wins: [0, 0], matches: [0, 0], pts: [0, 0], shotsPerMatch: [], early8: 0 };
const t0 = Date.now();
for (let s = 0; s < +N; s++) {
  const S = M.newSeries({ seed: 1000 + s * 7919, mode: MODE, caos: CAOS, players: [{ name: 'A', kind: 'bot', level: A, cue: OM.CUES[s % OM.CUES.length].id }, { name: 'B', kind: 'bot', level: B, cue: OM.CUES[(s + 3) % OM.CUES.length].id }] });
  for (let i = 0; i < S.n && !S.done; i++) {
    if (i > 0) { M.payday(S); S.matchIdx = i; S.M = null; }
    if (!CAOS) [0, 1].forEach((pi) => { st.money.push(S.players[pi].money); OM.AI.shop(S, pi); });
    S.players.forEach((Pl) => Pl.jokers.forEach((J) => { st.bought[J.id] = (st.bought[J.id] || 0) + 1; }));
    M.startMatch(S);
    const W = M.buildWorld(S);
    let n = 0, out;
    do { out = playShot(S, W, st); n++; } while (out.win == null && n < 400);
    if (out.win == null) throw new Error('partida sin final, semilla ' + S.seed);
    res.shotsPerMatch.push(n); res.matches[out.win]++;
    if (CAOS) { res.brk = (res.brk || 0) + (out.win === S.M.breaker ? 1 : 0); res.maxChain = Math.max(res.maxChain || 0, st.maxChain || 0); }
    if (CAOS) res.lead3 = -1;
    if (i === 2) res.lead3 = S.players[0].points >= S.players[1].points ? 0 : 1;
    if (S.M.end.reason) res.early8++;
    S.M.end.lines.filter((l) => /Dinero sobrante/.test(l.label)).forEach((l) => st.endCash.push(l.v / OM.POINTS.cash));
  }
  const w = M.seriesWinner(S); res.wins[w]++; if (w !== res.lead3) res.comeback++; res.pts[0] += S.players[0].points; res.pts[1] += S.players[1].points;
}
console.log('remontadas (el que iba detrás tras la partida 3 gana la serie):', res.comeback, 'de', N);
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`${N} series · ${A} vs ${B} · modo ${MODE} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('series ganadas   A/B:', res.wins.join(' / '));
console.log('partidas ganadas A/B:', res.matches.join(' / '), '· perdidas por la 8:', res.early8);
console.log('puntos medios    A/B:', Math.round(res.pts[0] / N), '/', Math.round(res.pts[1] / N), '· mejor tiro', st.best);
console.log('tiros por partida:', avg(res.shotsPerMatch), '· % tiros que embocan', (100 * st.pots / st.shots).toFixed(0), '· % faltas', (100 * st.fouls / st.shots).toFixed(0));
console.log('acierto A/B:', st.byLevel.map((b) => (100 * b.scoring / Math.max(1, b.shots)).toFixed(0) + '%').join(' / '));
const ear = [0, 1].map(() => 0);
console.log('dinero al abrir tienda (media):', avg(st.money), '· activos usados', JSON.stringify(st.actives), '· marchas atrás', st.rewinds);
console.log('saque: bolas/saque', (st.breakBalls / st.breaks).toFixed(2), '· blanca dentro', (100 * st.breakScratch / st.breaks).toFixed(0) + '%', '· simulaciones cortadas', st.stuck, '· terremotos', st.quakes);
if (CAOS) {
  console.log('CAOS · mechas consumidas', st.fuses || 0, '· gana el que saca', res.brk + ' de ' + N);
  console.log('CAOS · turnos/partida', (st.turns / N).toFixed(1), '· bolsas cogidas', st.bags, '· hechizos caducados', st.expired, '· acciones de tienda', JSON.stringify(st.caosOps));
  console.log('CAOS · trampas por tacada', st.rallies, '· dinero sobrante medio al final $' + (st.endCash.reduce((a, b) => a + b, 0) / Math.max(1, st.endCash.length)).toFixed(1));
  console.log('CAOS · cartas de puntos compradas:', Object.keys(st.seenBuy).filter((id) => OM.jokerDef(id).pts).length, '· condiciones de puntos:', Object.keys(st.conds).filter((k) => k.split('+').some((id) => OM.obstacleDef(id).pts)).length);
  console.log('CAOS · condiciones vistas:', Object.keys(st.conds).length, '· cartas compradas distintas', Object.keys(st.seenBuy).length);
}
