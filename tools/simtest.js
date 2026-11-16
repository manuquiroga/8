// Prueba headless de física y puntuación: node tools/simtest.js
global.window = global; global.document = { createElement: () => ({ getContext: () => ({}) }) };
require('../src/core/px.js'); require('../src/game/data.js'); require('../src/game/physics.js'); require('../src/game/run.js');
const L = OM.LAYOUT, F = L.felt;
function rackWorld() {
  const W = OM.Physics.create({});
  const d = 12.15, fx = F.x + F.w * 0.72, fy = F.y + F.h / 2; let n = 1;
  for (let k = 0; k < 5; k++) for (let j = 0; j <= k; j++) OM.Physics.addBall(W, { num: n++, kind: 'normal', x: fx + k * d * 0.866 + (Math.random()-0.5)*0.3, y: fy + (j - k / 2) * d + (Math.random()-0.5)*0.3 });
  const cue = OM.Physics.addBall(W, { num: 0, kind: 'normal', x: F.x + 70, y: fy + (Math.random() - 0.5) * 6 });
  return { W, cue };
}
let totPocket = 0, totTime = 0, scratches = 0; const N = 200;
for (let i = 0; i < N; i++) {
  const { W, cue } = rackWorld();
  OM.Physics.shoot(W, cue, (Math.random() - 0.5) * 0.04, 60 + Math.pow(0.9 + Math.random() * 0.1, 1.25) * 960);
  let t = 0, pk = 0, boosted = false;
  while (OM.Physics.moving(W) && t < 30) { OM.Physics.step(W, 1 / 60); t += 1 / 60; for (const e of W.events) if (e.type === 'hit' && !boosted) { boosted = true; OM.Physics.breakBoost(W, cue, 0.95); } else if (e.type === 'pocket') { if (e.ball.num === 0) scratches++; else pk++; } W.events.length = 0; }
  totPocket += pk; totTime += t;
}
console.log('saque: bolas/saque', (totPocket / N).toFixed(2), 'tiempo medio', (totTime / N).toFixed(2) + 's', 'faltas', scratches);
// tiro recto a tronera esquina
{
  const W = OM.Physics.create({}); const p = W.pockets[5];
  const b = OM.Physics.addBall(W, { num: 3, kind: 'normal', x: p.x - 60, y: p.y - 30 });
  const cue = OM.Physics.addBall(W, { num: 0, kind: 'normal', x: p.x - 150, y: p.y - 75 });
  OM.Physics.shoot(W, cue, Math.atan2(b.y - cue.y, b.x - cue.x), 400);
  let t = 0, res = []; while (OM.Physics.moving(W) && t < 20) { OM.Physics.step(W, 1 / 60); t += 1 / 60; W.events.forEach((e) => e.type === 'pocket' && res.push(e.ball.num)); W.events.length = 0; }
  console.log('tiro a esquina, embocadas:', res, 'pockets', W.pockets.map(p=>[p.x|0,p.y|0]).join(' '));
}
// puntuación
const R = OM.Run.create('peregrino', 42);
R.jokers.push(OM.Run.newJoker('tiza_azul'), OM.Run.newJoker('espejo_roto'), OM.Run.newJoker('doble_fondo'), OM.Run.newJoker('racha'));
const pocket = { x: 0, y: 0, corner: true };
const S = OM.Run.score(R, { balls: [{ ball: R.balls[8], pocket, banked: true }, { ball: R.balls[2], pocket, banked: false }], scratch: false, cueContacts: 2, cueCushions: 1, shotIndex: 0, shotsLeft: 4, isBreak: false, ballsLeft: 10 });
console.log('doblete:', S.typeId, 'chips', S.chips, 'mult', S.mult, 'total', S.total, 'eventos', S.events.length);
OM.Run.afterShot(R, S); console.log('racha st', R.jokers[3].st);
console.log('objetivos', OM.CIRCLES.map((c, i) => [0, 1, 2].map((k) => OM.Run.target(R, i, k)).join('/')).join(' | '), 'inf', OM.Run.target(R, 6, 0));
{
  const { W, cue } = rackWorld();
  OM.Physics.shoot(W, cue, 0, 1020);
  for (let i = 0; i < 30; i++) { OM.Physics.step(W, 1 / 60); }
  console.log('tras 0.5s velocidades:', W.balls.map((b) => Math.hypot(b.vx, b.vy) | 0).join(','));
}
