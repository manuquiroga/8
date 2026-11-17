// Prueba headless: series completas bot contra bot con las reglas y la física reales.
//   node tools/simtest.js [series=20] [nivelA=medio] [nivelB=medio] [modo=8|9|mix]
// Sirve para comprobar que nada revienta y para medir balance (quién gana, puntos, tiros por partida, saque).
global.window = global; global.document = { createElement: () => ({ getContext: () => ({}) }) };
['core/px.js', 'game/data.js', 'game/physics.js', 'game/match.js', 'game/ai.js'].forEach((f) => require('../src/' + f));
const [N = '20', A = 'medio', B = 'medio', MODE = '8'] = process.argv.slice(2);
const M = OM.Match, P = OM.Physics;

function playShot(S, W, st) {
  const lvl = S.players[S.M.turn].level;
  const cue = M.cueBall(W);
  if (S.M.inHand) {
    if (!cue.alive) { cue.alive = true; cue.sinking = false; cue.sink = 0; }
    const p = OM.AI.place(S, W, lvl); cue.x = p.x; cue.y = p.y; S.M.inHand = null;
  }
  let pl = OM.AI.plan(S, W, lvl), guard = 0;
  while (pl.joker != null && guard++ < 4) {
    const r = M.useActive(S, S.M.turn, pl.joker), kind = r && r.kind;
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
  const cur = M.beginShot(S, W, pl);
  P.run(W, 30, (e) => M.track(cur, e));
  if (P.moving(W)) st.stuck++;
  const out = M.resolve(S, W, cur);
  if (out.rewound) st.rewinds++;
  st.shots++; if (out.foul) st.fouls++; if (cur.pocketed.length) st.pots++;
  if (wasBreak) { st.breaks++; st.breakBalls += cur.pocketed.length; if (cur.scratch) st.breakScratch++; }
  st.byLevel[who].shots++; if (out.total > 0) st.byLevel[who].scoring++;
  st.best = Math.max(st.best, out.total);
  if (out.win == null) M.applyTurn(S, W);
  return out;
}

const st = { actives: {}, rewinds: 0, bought: {}, money: [], shots: 0, fouls: 0, pots: 0, breaks: 0, breakBalls: 0, breakScratch: 0, stuck: 0, quakes: 0, best: 0, byLevel: [{ shots: 0, scoring: 0 }, { shots: 0, scoring: 0 }] };
const res = { comeback: 0, wins: [0, 0], matches: [0, 0], pts: [0, 0], shotsPerMatch: [], early8: 0 };
const t0 = Date.now();
for (let s = 0; s < +N; s++) {
  const S = M.newSeries({ seed: 1000 + s * 7919, mode: MODE, players: [{ name: 'A', kind: 'bot', level: A, cue: OM.CUES[s % OM.CUES.length].id }, { name: 'B', kind: 'bot', level: B, cue: OM.CUES[(s + 3) % OM.CUES.length].id }] });
  for (let i = 0; i < S.n; i++) {
    if (i > 0) { M.payday(S); S.matchIdx = i; S.M = null; }
    [0, 1].forEach((pi) => { st.money.push(S.players[pi].money); OM.AI.shop(S, pi); });
    S.players.forEach((Pl) => Pl.jokers.forEach((J) => { st.bought[J.id] = (st.bought[J.id] || 0) + 1; }));
    M.startMatch(S);
    const W = M.buildWorld(S);
    let n = 0, out;
    do { out = playShot(S, W, st); n++; } while (out.win == null && n < 400);
    if (out.win == null) throw new Error('partida sin final, semilla ' + S.seed);
    res.shotsPerMatch.push(n); res.matches[out.win]++;
    if (i === 2) res.lead3 = S.players[0].points >= S.players[1].points ? 0 : 1;
    if (S.M.end.reason) res.early8++;
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
