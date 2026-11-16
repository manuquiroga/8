// Simula jugadores para calibrar objetivos (sin comodines): node tools/balance.js
// v1.1: distribuciones medidas con física real (ver DEVLOG) — dobletes ~3-8%, no 15% como en v1.0.
global.window = global; global.document = { createElement: () => ({ getContext: () => ({}) }) };
require('../src/core/px.js'); require('../src/game/data.js'); require('../src/game/physics.js'); require('../src/game/run.js');
const R = OM.Run.create('peregrino', 7);
const BREAK = [0.2, 0.35, 0.3, 0.15];                  // P(0,1,2,3 bolas) en el saque
const PLAYERS = { flojo: [0.5, 0.45, 0.05, 0], medio: [0.38, 0.54, 0.07, 0.01], bueno: [0.28, 0.6, 0.1, 0.02] };
const pick = (d) => { let r = Math.random(); for (let i = 0; i < d.length; i++) { if ((r -= d[i]) < 0) return i; } return 0; };
function table(dist, shots = 5) {
  let sc = 0, streak = 0; const set = R.rng.shuffle(R.balls.filter((b) => b.num !== 8));
  for (let s = 0; s < shots; s++) {
    const n = pick(s === 0 ? BREAK : dist);
    const balls = set.splice(0, n).map((b) => ({ ball: b, pocket: { corner: Math.random() < 0.67 }, banked: Math.random() < 0.15 }));
    const t = OM.Run.score(R, { balls, cueContacts: 1, cueCushions: 1, shotIndex: s, shotsLeft: shots - 1 - s, ballsLeft: 10, streak, isBreak: s === 0 }).total;
    streak = t > 0 ? streak + 1 : 0; sc += t;
  }
  return sc;
}
const tg = [0, 1, 2].map((k) => OM.Run.target(R, 0, k));
for (const [name, d] of Object.entries(PLAYERS)) {
  const N = 4000, arr = []; for (let i = 0; i < N; i++) arr.push(table(d));
  arr.sort((a, b) => a - b);
  const pass = tg.map((t) => Math.round(100 * arr.filter((v) => v >= t).length / N) + '%');
  console.log(name.padEnd(6), 'media', Math.round(arr.reduce((a, b) => a + b) / N), 'p25', arr[N / 4 | 0], 'p50', arr[N / 2 | 0], '| supera Círculo I', tg.join('/'), '→', pass.join(' / '));
}
