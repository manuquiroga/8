// Simula un jugador "medio" para estimar puntos por mesa sin comodines: node tools/balance.js
global.window = global; global.document = { createElement: () => ({ getContext: () => ({}) }) };
require('../src/core/px.js'); require('../src/game/data.js'); require('../src/game/physics.js'); require('../src/game/run.js');
const R = OM.Run.create('peregrino', 7);
// Modelo simple: por tiro, nº de bolas ~ distribución de jugador medio
function sampleBalls(skill) { const r = Math.random(); if (r < 0.35 - skill * 0.15) return 0; if (r < 0.8) return 1; if (r < 0.95) return 2; return 3; }
for (const skill of [0, 0.5, 1]) {
  let tot = 0; const N = 2000;
  for (let i = 0; i < N; i++) {
    let sc = 0;
    const set = R.rng.shuffle(R.balls.slice());
    for (let s = 0; s < 5; s++) {
      const n = sampleBalls(skill);
      const balls = set.splice(0, n).map((b) => ({ ball: b, pocket: { corner: true }, banked: Math.random() < 0.2 }));
      sc += OM.Run.score(R, { balls, cueContacts: 1, cueCushions: 1, shotIndex: s, shotsLeft: 4 - s, ballsLeft: 10 }).total;
    }
    tot += sc;
  }
  console.log('habilidad', skill, 'puntos medios por mesa (5 tiros, sin comodines):', Math.round(tot / N));
}
