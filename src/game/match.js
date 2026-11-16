// 8 — reglas del pool arcade 1v1: serie de 5 partidas, juez de bola 8 y bola 9, puntuación (Puntos × Combo),
// comodines y draft. Sin dibujo ni entrada: lo usan la escena de mesa, los bots y las pruebas headless.
// Todo el estado de la serie (S) es JSON plano para poder sincronizarlo en el online.
window.OM = window.OM || {};

// RNG con semilla (mulberry32)
OM.RNG = function (seed) {
  let s = seed >>> 0;
  const r = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  return r;
};
OM.seedToStr = (n) => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) { s += A[n % 32]; n = Math.floor(n / 32); } return s; };

OM.jokerDef = (id) => OM.JOKERS.find((j) => j.id === id);
OM.cueDef = (id) => OM.CUES.find((j) => j.id === id);
OM.obstacleDef = (id) => OM.OBSTACLES.find((j) => j.id === id);

OM.Match = (function () {
  const PT = OM.POINTS, L = OM.LAYOUT, F = L.felt;
  const HEAD_X = F.x + F.w * 0.25;
  const FOOT = { x: F.x + F.w * 0.72, y: F.y + F.h / 2 };
  const MID = { x: F.x + F.w / 2, y: F.y + F.h / 2 };
  const groupOf = (n) => (n === 8 ? 'eight' : n < 8 ? 'solid' : 'stripe');
  const GROUP_NAME = { solid: 'LISAS', stripe: 'RAYADAS' };
  const mix = (a, b) => (Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 40503)) >>> 0;
  const msg = (v, color, J, big) => ({ k: 'msg', v, color: color || '8', src: J ? { type: 'joker', uid: J.uid } : null, big: !!big });

  // ---------------- serie ----------------
  function newJoker(id, uid) { const d = OM.jokerDef(id); return { id, st: d.state ? d.state() : {}, used: false, uid }; }
  function give(S, pi, id) { const P = S.players[pi]; P.jokers.push(newJoker(id, 'p' + pi + '_' + P.jokers.length + '_' + id)); }

  // cfg = {seed, mode:'8'|'9'|'mix', players:[{name, kind:'human'|'bot'|'remote', level, cue}]}
  function newSeries(cfg) {
    const seed = (cfg.seed == null ? Math.floor(Math.random() * 1e9) : cfg.seed) >>> 0;
    const S = {
      v: 3, seed, seedStr: OM.seedToStr(seed), mode: cfg.mode || '8', n: 5, matchIdx: 0, lastLoser: seed & 1, done: false,
      players: cfg.players.map((p) => ({ name: p.name, kind: p.kind || 'human', level: p.level || null, cue: p.cue || 'peregrino', jokers: [], points: 0, wins: 0, stats: { balls: 0, fouls: 0, best: 0, shots: 0 } })),
      obstacles: [], M: null,
    };
    const rng = OM.RNG(mix(seed, 11));
    S.players.forEach((P, i) => {
      const cue = OM.cueDef(P.cue);
      if (cue.joker) give(S, i, cue.joker);
      if (cue.randomJoker) give(S, i, rng.pick(OM.JOKERS.filter((j) => j.rarity === cue.randomJoker && !j.copy)).id);
    });
    // obstáculos: partidas 3 y 4 con uno, la final con dos (de grupos distintos)
    const pool = rng.shuffle(OM.OBSTACLES.map((o) => o.id));
    const a = pool[0], b = pool[1], c = pool[2];
    const d = pool.slice(3).find((id) => { const x = OM.obstacleDef(id), y = OM.obstacleDef(c); return !(x.grp && x.grp === y.grp); });
    S.obstacles = [[], [], [a], [b], [c, d]];
    return S;
  }
  function matchMode(S, i) { return S.mode === 'mix' ? (i % 2 ? '9' : '8') : S.mode; }
  function theme(S) { return OM.MATCH_THEMES[Math.min(S.matchIdx, OM.MATCH_THEMES.length - 1)]; }
  function hasObs(S, id) { return !!(S.M && S.M.obstacles.includes(id)); }

  // ---------------- draft: antes de cada partida cada jugador elige 1 comodín ----------------
  // Las ofertas salen de la semilla (iguales en los dos clientes del online). El que va por detrás ve una carta más.
  function draftOffers(S, pi) {
    const P = S.players[pi], Rv = S.players[1 - pi];
    const rng = OM.RNG(mix(mix(S.seed, S.matchIdx + 1), pi + 101));
    const n = 3 + (P.points < Rv.points ? 1 : 0);
    const owned = new Set(P.jokers.map((j) => j.id));
    const w = { comun: 60, raro: 30 + 3 * S.matchIdx, epico: 6 + 3 * S.matchIdx, legendario: 1 + 1.5 * S.matchIdx };
    const out = [];
    for (let tries = 0; out.length < n && tries < 200; tries++) {
      let r = rng() * (w.comun + w.raro + w.epico + w.legendario), rar = 'comun';
      for (const k of ['comun', 'raro', 'epico', 'legendario']) { if ((r -= w[k]) < 0) { rar = k; break; } }
      const pool = OM.JOKERS.filter((j) => j.rarity === rar && !owned.has(j.id) && !out.includes(j.id) && !(j.copy && !P.jokers.length) && !(matchModeAll9(S) && j.only8));
      if (pool.length) out.push(rng.pick(pool).id);
    }
    return out;
  }
  function matchModeAll9(S) { return S.mode === '9'; }
  function pick(S, pi, id) { if (id && OM.jokerDef(id)) give(S, pi, id); }

  // ---------------- comodines ----------------
  // Espejo Roto copia al comodín de su izquierda
  function resolveJ(P, i, depth) {
    const J = P.jokers[i]; if (!J) return null;
    if (OM.jokerDef(J.id).copy) { if ((depth || 0) > 5) return null; return resolveJ(P, i - 1, (depth || 0) + 1); }
    return J;
  }
  function findOnce(P, id) { return P.jokers.find((J) => J.id === id && !J.used) || null; }

  const MUL = ['pocketMul', 'pocketPull', 'powerMul', 'guideLen', 'trickMul', 'pointsMul'];
  function merge(m, d) {
    for (const k in d) {
      if (MUL.includes(k)) m[k] *= d[k];
      else if (k === 'guide' || k === 'foulCost' || k === 'foulPct' || k === 'foulGiftPct') m[k] = Math.max(m[k], d[k]);
      else if (typeof d[k] === 'boolean') m[k] = m[k] || d[k];
      else m[k] = (m[k] || 0) + d[k];
    }
  }
  // modificadores del jugador pi cuando le toca tirar (sus comodines + su taco + trastadas del rival + obstáculos)
  function mods(S, pi) {
    const m = { pocketMul: 1, pocketPull: 1, powerMul: 1, guide: 1, guideLen: 1, trickMul: 1, pointsMul: 1, noScratch: false, shake: 0, foulCost: PT.foul, foulPct: 0, foulGift: 0, foulGiftPct: 0, bribed: false, retriggerFirst: false, keepStreak: false, allTrick: false };
    const P = S.players[pi], Rv = S.players[1 - pi];
    const cue = OM.cueDef(P.cue);
    if (cue && cue.mods) merge(m, cue.mods);
    P.jokers.forEach((_, i) => { const J = resolveJ(P, i); const d = J && OM.jokerDef(J.id); if (d && d.mods) merge(m, d.mods); });
    let rg = 0;
    Rv.jokers.forEach((_, i) => {
      const J = resolveJ(Rv, i); const d = J && OM.jokerDef(J.id); if (!d || !d.rival) return;
      if (d.rival.pocketMul) m.pocketMul *= d.rival.pocketMul;
      if (d.rival.guide) rg += d.rival.guide;
      if (d.rival.shake) m.shake += d.rival.shake;
    });
    m.guide = Math.max(0, m.guide + rg);
    if (hasObs(S, 'boca')) m.pocketMul *= 0.78;
    if (hasObs(S, 'ciego')) m.guide = 0;
    if (hasObs(S, 'verdugo')) m.foulCost = Math.max(m.foulCost, 300);
    return m;
  }

  // ---------------- partida ----------------
  function startMatch(S) {
    const i = S.matchIdx, mode = matchMode(S, i);
    const breaker = S.lastLoser; // saca el que perdió la anterior (la primera, por semilla)
    S.M = {
      mode, turn: breaker, breaker, breakShot: true, open: mode === '8', groups: [null, null], inHand: 'kitchen',
      streak: [0, 0], shotIdx: 0, winner: null, obstacles: S.obstacles[i] || [], pts: [0, 0], gold: {}, armed: null, end: null,
    };
    S.players.forEach((P) => P.jokers.forEach((J) => { J.used = false; const d = OM.jokerDef(J.id); if (d.onMatchStart) d.onMatchStart(S, J); }));
    return S.M;
  }
  function worldOpts(S) {
    const o = { seed: mix(S.seed, 1000 + S.matchIdx) };
    if (hasObs(S, 'sepulturero')) o.sealedSides = true;
    if (hasObs(S, 'cienaga')) o.frictionMul = 2;
    if (hasObs(S, 'escarcha')) o.frictionMul = 0.45;
    if (hasObs(S, 'pendulo')) o.tilt = 70;
    if (hasObs(S, 'pilares')) o.bumpers = [{ x: MID.x - 60, y: MID.y - 52, r: 7 }, { x: MID.x - 60, y: MID.y + 52, r: 7 }, { x: MID.x + 20, y: MID.y, r: 7 }];
    if (hasObs(S, 'vortice')) o.vortex = { x: MID.x, y: MID.y, r: 62, k: 5 };
    if (hasObs(S, 'portales')) o.portals = [{ x: F.x + 52, y: F.y + 38, r: 9 }, { x: F.x + F.w - 52, y: F.y + F.h - 38, r: 9 }];
    return o;
  }
  function cueBall(W) { return W.balls.find((b) => b.num === 0); }

  function rack(S, W) {
    const M = S.M, rng = OM.RNG(mix(S.seed, 2000 + S.matchIdx));
    const d = L.ballR * 2 + 0.3, jit = () => (rng() - 0.5) * 0.3; // el triángulo nunca queda igual: el saque varía
    const put = (num, k, j, size) => OM.Physics.addBall(W, { num, kind: 'normal', x: FOOT.x + k * d * 0.866 + jit(), y: FOOT.y + (j - (size - 1) / 2) * d + jit() });
    if (M.mode === '8') {
      const solids = rng.shuffle([1, 2, 3, 4, 5, 6, 7]), stripes = rng.shuffle([9, 10, 11, 12, 13, 14, 15]);
      const cA = solids.pop(), cB = stripes.pop();
      const rest = rng.shuffle(solids.concat(stripes));
      let idx = 0;
      for (let k = 0; k < 5; k++) for (let j = 0; j <= k; j++, idx++) {
        const num = idx === 4 ? 8 : idx === 10 ? cA : idx === 14 ? cB : rest.pop();
        put(num, k, j, k + 1);
      }
    } else {
      const rest = rng.shuffle([2, 3, 4, 5, 6, 7, 8]);
      const rows = [1, 2, 3, 2, 1];
      rows.forEach((size, k) => { for (let j = 0; j < size; j++) put(k === 0 ? 1 : k === 2 && j === 1 ? 9 : rest.pop(), k, j, size); });
    }
    W.balls.forEach((b) => { b.rollX = rng() * 40; b.rollY = rng() * 40; });
    // Bola de Oro
    S.players.forEach((P, pi) => {
      if (!P.jokers.some((_, i) => { const J = resolveJ(P, i); return J && OM.jokerDef(J.id).gold; })) return;
      const pool = W.balls.filter((b) => b.num !== 8 && b.num !== 9 && b.num !== 0 && b.kind === 'normal');
      const b = rng.pick(pool); b.kind = 'oro'; M.gold[b.num] = pi;
    });
  }
  function buildWorld(S) {
    const W = OM.Physics.create(worldOpts(S));
    rack(S, W);
    OM.Physics.addBall(W, { num: 0, kind: 'normal', x: HEAD_X - 30, y: MID.y });
    applyTurn(S, W);
    return W;
  }
  // al cambiar de turno: tamaño de troneras, imán y blanca fantasma del que tira
  function applyTurn(S, W) {
    const m = mods(S, S.M.turn);
    W.pocketMul = m.pocketMul; W.pocketPull = m.pocketPull; W.noScratch = m.noScratch;
    OM.Physics.setPockets(W);
    return m;
  }
  function shotSpeed(power, m) { return (60 + Math.pow(power, 1.25) * 960) * m.powerMul; }

  function onTable(W) { return W.balls.filter((b) => b.alive && b.num !== 0).map((b) => b.num); }
  // bolas que le quedan a un jugador (bola 8: su grupo; bola 9: todas)
  function remaining(S, W, pi) {
    const M = S.M, t = onTable(W);
    if (M.mode === '9') return t.slice().sort((a, b) => a - b);
    if (M.open) return [];
    return t.filter((n) => groupOf(n) === M.groups[pi]).sort((a, b) => a - b);
  }
  // ¿es legal que el jugador de turno toque primero la bola `num`?
  function legalFirst(S, W, num) {
    const M = S.M, t = onTable(W);
    if (M.mode === '9') return num === Math.min.apply(null, t);
    if (M.breakShot) return true;
    const g = groupOf(num);
    if (M.open) return g !== 'eight';
    const mine = t.some((n) => groupOf(n) === M.groups[M.turn]);
    return mine ? g === M.groups[M.turn] : g === 'eight';
  }
  // texto corto de qué tiene que tocar el que tira
  function goal(S, W) {
    const M = S.M, t = onTable(W);
    if (M.mode === '9') return 'BOLA ' + Math.min.apply(null, t);
    if (M.breakShot) return 'SAQUE';
    if (M.open) return 'MESA ABIERTA';
    return t.some((n) => groupOf(n) === M.groups[M.turn]) ? GROUP_NAME[M.groups[M.turn]] : 'LA 8';
  }

  // ---------------- tiro ----------------
  // p = {angle, power (0..1), spin:{f,s}, elev (0..1)}
  function beginShot(S, W, p) {
    const M = S.M, m = mods(S, M.turn), cue = cueBall(W);
    const before = onTable(W);
    const cur = {
      me: M.turn, power: p.power, spun: Math.hypot(p.spin.f, p.spin.s) > 0.2, elev: p.elev || 0, isBreak: M.breakShot,
      pocketed: [], scratch: false, firstHit: null, cueContacts: 0, hits: [], cueCushions: 0, kick: false, banked: {},
      before, lowest: Math.min.apply(null, before), start: { x: cue.x, y: cue.y }, dist: 0, jumped: false, curved: false,
    };
    if (M.breakShot) W.breakPending = Math.max(0.2, p.power);
    if (M.armed === 'bomb') { W.bomb = true; M.armed = null; cur.bomb = true; }
    const tr = OM.Physics.shoot(W, cue, p.angle, shotSpeed(p.power, m), p.spin, p.elev || 0, m.trickMul);
    cur.jumped = tr.jump; cur.curved = Math.abs(tr.curve) > 0.6;
    return cur;
  }
  // procesa un evento de física dentro del registro del tiro
  function track(cur, e) {
    if (e.type === 'hit') {
      const cue = e.a.num === 0 ? e.a : e.b.num === 0 ? e.b : null;
      if (!cue) return;
      const o = cue === e.a ? e.b : e.a;
      if (cur.firstHit == null) { cur.firstHit = o.num; cur.kick = cur.cueCushions > 0; cur.dist = Math.hypot(e.x - cur.start.x, e.y - cur.start.y); }
      if (!cur.hits.includes(o.num)) { cur.hits.push(o.num); cur.cueContacts = cur.hits.length; }
    } else if (e.type === 'hop') {
      if (e.ball.num === 0) cur.hopped = (cur.hopped || 0) + 1;
    } else if (e.type === 'cushion' || e.type === 'bumper') {
      if (cur.firstHit != null) cur.railAfter = true; // tras el contacto alguna bola tocó banda
      if (e.ball.num === 0) { if (!e.jaw) cur.cueCushions++; } else cur.banked[e.ball.num] = true;
    } else if (e.type === 'pocket') {
      if (e.ball.num === 0) cur.scratch = true;
      else cur.pocketed.push({ num: e.ball.num, pocket: { x: e.pocket.x, y: e.pocket.y, corner: e.pocket.corner }, banked: !!cur.banked[e.ball.num] });
    }
  }

  function respot(W, num) {
    const b = W.balls.find((o) => o.num === num); if (!b) return null;
    let x = FOOT.x, y = FOOT.y, ok = false;
    for (let k = 0; k < 200 && !ok; k++) {
      x = FOOT.x + (k % 40) * 3; y = FOOT.y + (k >= 40 ? ((k >> 3) % 2 ? 1 : -1) * Math.floor(k / 40) * 13 : 0);
      ok = OM.Physics.freeSpot(W, x, y, b.r, b) && !W.pockets.some((p) => Math.hypot(p.x - x, p.y - y) < p.mouth + b.r);
    }
    b.alive = true; b.sinking = false; b.sink = 0; b.x = x; b.y = y; b.vx = b.vy = 0; b.z = 0; b.vz = 0;
    return b;
  }

  // marcador del tiro: Puntos × Combo, con eventos para animar
  function scorer(S, me, cur, ev) {
    const Sc = { S, M: S.M, me, rv: 1 - me, P: S.players[me], R: S.players[1 - me], cur, pts: 0, mult: 1, flat: 0, steal: 0, rpts: 0, events: ev, balls: [], gifts: [], streak: 0, cleared: 0, _src: null };
    Sc.add = (o, J) => {
      const src = J ? { type: 'joker', uid: J.uid } : Sc._src;
      if (o.pts) { Sc.pts += o.pts; ev.push({ k: 'pts', v: o.pts, src }); }
      if (o.mult) { Sc.mult += o.mult; ev.push({ k: 'mult', v: o.mult, src }); }
      if (o.xmult) { Sc.mult *= o.xmult; ev.push({ k: 'xmult', v: o.xmult, src }); }
      if (o.steal) { Sc.steal += o.steal; ev.push({ k: 'steal', v: o.steal, src }); }
    };
    // puntos directos para el que NO tira (comodines del rival)
    Sc.addRival = (o, J) => { if (o.pts) { Sc.rpts += o.pts; ev.push({ k: 'rpts', v: o.pts, src: J ? { type: 'joker', uid: J.uid } : null }); } };
    Sc.callJ = (who, hook, arg) => {
      const Pl = S.players[who];
      Pl.jokers.forEach((inst, i) => {
        const J = resolveJ(Pl, i); if (!J) return;
        const d = OM.jokerDef(J.id); if (!d[hook]) return;
        // "this" = carta que se ilumina (la copia si es Espejo Roto); st/inst = dueño del estado
        const self = { uid: inst.uid, st: J.st, inst: J, def: d };
        d[hook].call(self, Sc, arg, self);
      });
    };
    return Sc;
  }

  // Juzga y puntúa el tiro. Muta S (puntos, grupos, turno...) y devuelve lo que la escena tiene que animar:
  // {events, foul, total, win, cont, respot:[nums], inHand}
  function resolve(S, W, cur) {
    const M = S.M, me = M.turn, rv = 1 - me, P = S.players[me], Rv = S.players[rv];
    const Mo = mods(S, me);
    const ev = [];
    const out = { events: ev, foul: null, forgiven: false, total: 0, win: null, cont: false, respot: [], shooter: me };
    const nums = cur.pocketed.map((p) => p.num);
    const isBreak = cur.isBreak;
    let foul = null, lose = null, winBall = null;
    const own = [], gifts = [];
    P.stats.shots++;

    if (M.mode === '8') {
      const myG = M.groups[me];
      const onEight = !M.open && !cur.before.some((n) => groupOf(n) === myG);
      if (cur.timeout) foul = 'SE ACABÓ EL TIEMPO';
      else if (cur.scratch) foul = 'BLANCA DENTRO';
      else if (cur.firstHit == null) foul = 'NO TOCASTE NINGUNA BOLA';
      else if (!isBreak) {
        const g = groupOf(cur.firstHit);
        if (onEight) { if (g !== 'eight') foul = 'TENÍAS QUE TOCAR LA 8'; }
        else if (g === 'eight') foul = 'TOCASTE PRIMERO LA 8';
        else if (!M.open && g !== myG) foul = 'TOCASTE PRIMERO UNA BOLA RIVAL';
        else if (!cur.pocketed.length && !cur.railAfter) foul = 'NINGUNA BOLA TOCÓ BANDA';
      }
      if (nums.includes(8)) {
        if (isBreak) { out.respot.push(8); ev.push(msg('LA 8 EN EL SAQUE: VUELVE', '7')); }
        else if (!foul && onEight) { out.win = me; winBall = cur.pocketed.find((p) => p.num === 8); }
        else {
          const seg = findOnce(P, 'seguro');
          if (seg) { seg.used = true; out.respot.push(8); foul = foul || 'LA 8 ANTES DE TIEMPO'; ev.push(msg('¡SEGURO DE VIDA!', 'm', seg)); }
          else lose = foul ? 'METIÓ LA 8 CON FALTA' : 'METIÓ LA 8 ANTES DE TIEMPO';
        }
      }
      if (M.open && !isBreak && !foul && !lose && out.win == null) {
        const first = cur.pocketed.find((p) => p.num !== 8);
        if (first) {
          const g = groupOf(first.num);
          M.groups[me] = g; M.groups[rv] = g === 'solid' ? 'stripe' : 'solid'; M.open = false;
          ev.push(msg(P.name.toUpperCase() + ': ' + GROUP_NAME[g], 'i', null, true));
        }
      }
      cur.pocketed.forEach((p) => { if (p.num === 8) return; if (M.open || groupOf(p.num) === M.groups[me]) own.push(p); else gifts.push(p); });
    } else {
      if (cur.timeout) foul = 'SE ACABÓ EL TIEMPO';
      else if (cur.scratch) foul = 'BLANCA DENTRO';
      else if (cur.firstHit == null) foul = 'NO TOCASTE NINGUNA BOLA';
      else if (cur.firstHit !== cur.lowest) foul = 'PRIMERO HAY QUE TOCAR LA ' + cur.lowest;
      else if (!isBreak && !cur.pocketed.length && !cur.railAfter) foul = 'NINGUNA BOLA TOCÓ BANDA';
      if (nums.includes(9)) {
        if (foul || isBreak) { out.respot.push(9); ev.push(msg(isBreak && !foul ? 'LA 9 EN EL SAQUE: VUELVE' : 'LA 9 VUELVE A LA MESA', '7')); }
        else { out.win = me; winBall = cur.pocketed.find((p) => p.num === 9); }
      }
      cur.pocketed.forEach((p) => { if (p.num !== 9) own.push(p); });
    }
    // Mano Negra: una falta perdonada por partida (cuenta como fallo)
    if (foul && !lose) {
      const mn = findOnce(P, 'mano_negra');
      if (mn) { mn.used = true; out.forgiven = true; ev.push(msg('MANO NEGRA: FALTA PERDONADA', 'm', mn)); }
    }

    const Sc = scorer(S, me, cur, ev);
    Sc.balls = own; Sc.gifts = gifts; Sc.streak = M.streak[me];
    const scored = winBall ? own.concat([winBall]) : own;
    let potted = false;
    if (lose) {
      out.foul = lose; out.win = rv;
      ev.push({ k: 'msg', v: '¡' + lose + '!', color: 'c', bad: true, big: true });
    } else if (foul && !out.forgiven) {
      out.foul = foul;
      ev.push({ k: 'msg', v: 'FALTA: ' + foul, color: 'c', bad: true, big: true });
      P.stats.fouls++;
      if (!Mo.bribed) {
        const cost = Math.max(Mo.foulCost, Math.round(P.points * Mo.foulPct));
        Sc.flat -= cost; ev.push({ k: 'pen', v: -cost });
      } else ev.push(msg('ÁRBITRO COMPRADO', 'm'));
      if (Mo.foulGift) {
        // Taco del Pacto: le pasa al rival un porcentaje de tus puntos
        const gift = Math.min(P.points, Math.max(Mo.foulGift, Math.round(P.points * Mo.foulGiftPct)));
        if (gift) { Sc.flat -= gift; Sc.addRival({ pts: gift }); ev.push(msg('EL PACTO SE COBRA ' + gift, 'c')); }
      }
      Sc.callJ(me, 'onFoul'); Sc.callJ(rv, 'onRivalFoul');
    } else if (!out.forgiven) {
      gifts.forEach((g) => {
        Sc._src = { type: 'ball', x: g.pocket.x, y: g.pocket.y };
        ev.push({ k: 'msg', v: 'REGALO: LA ' + g.num, color: '6', src: Sc._src });
        Sc.callJ(me, 'onPot', g); Sc.callJ(rv, 'onRivalGift', g);
      });
      Sc._src = null;
      if (scored.length) {
        potted = true;
        if (isBreak) {
          // saque nerfeado: puntos fijos, sin combo ni comodines
          ev.push({ k: 'type', v: 'SAQUE', mult: 1 });
          scored.forEach((b) => { Sc._src = { type: 'ball', x: b.pocket.x, y: b.pocket.y }; Sc.add({ pts: b === winBall ? PT.finish : PT.breakBall }); });
          Sc._src = null;
        } else {
          const n = Math.min(4, scored.length);
          Sc.mult = PT.multi[n];
          Sc.cleared = M.mode === '8' ? 7 - remaining(S, W, me).length : 9 - onTable(W).length;
          ev.push({ k: 'type', v: OM.MULTI_NAMES[n], n, mult: Sc.mult });
          if (Sc.streak > 0) { ev.push(msg('TACADA x' + (Sc.streak + 1), 'v')); Sc.add({ mult: Math.min(PT.streakCap, Sc.streak) }); }
          scored.forEach((b, idx) => {
            b.combo = Mo.allTrick || b.num !== cur.firstHit;
            b.banked = Mo.allTrick || b.banked;
            const reps = idx === 0 && Mo.retriggerFirst ? 2 : 1;
            for (let rep = 0; rep < reps; rep++) {
              Sc._src = { type: 'ball', x: b.pocket.x, y: b.pocket.y };
              if (rep) ev.push({ k: 'msg', v: '¡ECO!', color: 't', src: Sc._src });
              if (b === winBall) { ev.push({ k: 'msg', v: M.mode === '8' ? '¡LA 8!' : '¡LA 9!', color: 'i', src: Sc._src, big: true }); Sc.add({ pts: PT.finish }); }
              else Sc.add({ pts: PT.ball });
              if (b.banked) { ev.push({ k: 'msg', v: 'BANDA', color: 'n', src: Sc._src }); Sc.add({ pts: PT.bank }); }
              if (b.combo) { ev.push({ k: 'msg', v: 'COMBINACIÓN', color: 'n', src: Sc._src }); Sc.add({ pts: PT.combo }); }
              Sc.callJ(me, 'onBall', b); Sc.callJ(me, 'onPot', b);
            }
          });
          Sc._src = null;
          if (cur.kick) { ev.push(msg('DE REBOTE', 'r')); Sc.add({ pts: PT.kick }); }
          if (cur.dist > 200) { ev.push(msg('DE LEJOS', 'r')); Sc.add({ pts: PT.far }); }
          if (cur.hopped) { ev.push(msg(cur.hopped > 1 ? '¡SALTO x' + cur.hopped + '!' : '¡SALTO!', 'u', null, true)); Sc.add({ pts: PT.trick * cur.hopped }); }
          else if (cur.curved) { ev.push(msg('¡MASSÉ!', 'u', null, true)); Sc.add({ pts: PT.trick }); }
          if (winBall) Sc.callJ(me, 'onWinBall');
          Sc.callJ(me, 'onShot');
        }
        own.forEach((b) => Sc.callJ(rv, 'onRivalBall', b));
        P.stats.balls += own.length;
      } else {
        ev.push(msg('FALLO', '6'));
        Sc.callJ(me, 'onMiss');
      }
    }

    // total del tiro
    let total = Math.floor(Sc.pts * Sc.mult * Mo.pointsMul) + Sc.flat;
    const stolen = Math.min(Sc.steal, Rv.points);
    if (total < 0) total = -Math.min(-total, P.points); // los puntos no bajan de 0
    P.points += total + stolen; Rv.points += Sc.rpts - stolen;
    M.pts[me] += total + stolen; M.pts[rv] += Sc.rpts - stolen;
    P.stats.best = Math.max(P.stats.best, total);
    out.total = total; out.stolen = stolen; out.rpts = Sc.rpts; out.pts = Sc.pts; out.mult = Sc.mult;
    ev.push({ k: 'total', v: total, stolen, rpts: Sc.rpts });

    // reposiciones
    out.respot.forEach((n) => respot(W, n));

    // turno
    M.shotIdx++; M.breakShot = !!(cur.timeout && isBreak); // si se acaba el tiempo en el saque, saca el rival
    if (out.win == null && M.shotIdx > 160) out.win = M.pts[me] >= M.pts[rv] ? me : rv; // tope de seguridad
    if (out.win != null) { finishMatch(S, W, out.win, lose ? P.name + ' ' + lose.toLowerCase() : null); return out; }
    const isFoul = !!out.foul;
    let cont = !isFoul && potted;
    if (!cont && !isFoul) {
      const sg = findOnce(P, 'segunda');
      if (sg) { sg.used = true; cont = true; ev.splice(ev.length - 1, 0, msg('¡SEGUNDA OPORTUNIDAD!', 'm', sg)); }
    }
    out.cont = cont;
    if (potted && !isFoul) M.streak[me]++;
    else if (isFoul || !Mo.keepStreak) M.streak[me] = 0;
    if (!cont) M.turn = rv;
    // bola en mano: tras una falta el rival coloca donde quiera; si la blanca cayó sin castigo, desde cabecera
    M.inHand = isFoul ? (Mo.bribed ? (cur.scratch ? 'kitchen' : null) : 'any') : cur.scratch ? 'kitchen' : null;
    if (M.breakShot) M.inHand = 'kitchen';
    return out;
  }

  function finishMatch(S, W, win, reason) {
    const M = S.M, i = S.matchIdx, ls = 1 - win;
    const lines = [];
    const add = (pi, label, v) => { if (!v) return; S.players[pi].points += v; M.pts[pi] += v; lines.push({ pi, label, v }); };
    M.winner = win; S.players[win].wins++;
    add(win, 'Victoria', PT.win[Math.min(i, PT.win.length - 1)]);
    if (M.mode === '8' && !M.open) {
      const left = remaining(S, W, ls).length;
      add(win, 'Paliza: ' + left + (left === 1 ? ' bola' : ' bolas') + ' del rival', left * PT.leftover);
    }
    const cw = OM.cueDef(S.players[win].cue), cl = OM.cueDef(S.players[ls].cue);
    if (cw.winBonus) add(win, cw.name, cw.winBonus);
    if (cl.loseBonus) add(ls, cl.name, cl.loseBonus);
    S.lastLoser = ls;
    M.end = { lines, reason: reason || null };
    if (i >= S.n - 1) S.done = true;
  }
  // ganador de la serie: más puntos; si empatan, más partidas; si no, el de la última
  function seriesWinner(S) {
    const [a, b] = S.players;
    if (a.points !== b.points) return a.points > b.points ? 0 : 1;
    if (a.wins !== b.wins) return a.wins > b.wins ? 0 : 1;
    return S.M && S.M.winner != null ? S.M.winner : 0;
  }

  // ---------------- comodines activos ----------------
  // Devuelve 'hand' | 'quake' | 'bomb' si se pudo usar (y lo marca gastado), o null.
  function canUse(S, pi, idx) {
    const M = S.M, J = S.players[pi].jokers[idx];
    if (!M || !J || J.used || M.turn !== pi || M.breakShot || M.winner != null) return false;
    const d = OM.jokerDef(J.id);
    if (!d.active) return false;
    if (d.active === 'bomb' && M.armed) return false;
    return true;
  }
  function useActive(S, pi, idx) {
    if (!canUse(S, pi, idx)) return null;
    const J = S.players[pi].jokers[idx], kind = OM.jokerDef(J.id).active;
    J.used = true;
    if (kind === 'bomb') S.M.armed = 'bomb';
    if (kind === 'hand') S.M.inHand = 'any';
    return kind;
  }
  // tiro que no llegó a hacerse: se acabó el tiempo (cuenta como falta)
  function timeoutCur(S, W) {
    const before = onTable(W);
    return { me: S.M.turn, timeout: true, isBreak: S.M.breakShot, power: 0, spun: false, elev: 0, pocketed: [], scratch: false, firstHit: null, hits: [], cueContacts: 0, cueCushions: 0, banked: {}, before, lowest: Math.min.apply(null, before), start: { x: 0, y: 0 }, dist: 0 };
  }
  // registro vacío para el rodar libre del Terremoto
  function freeCur() { return { free: true, pocketed: [], scratch: false, banked: {}, hits: [], cueContacts: 0, cueCushions: 0, firstHit: null, start: { x: 0, y: 0 } }; }
  // tras el Terremoto: nada puntúa; la 8/9 vuelven; si cae la blanca, bola en mano para el que tira
  function resolveQuake(S, W, cur) {
    const M = S.M, back = [];
    cur.pocketed.forEach((p) => { if ((M.mode === '8' && p.num === 8) || (M.mode === '9' && p.num === 9)) { respot(W, p.num); back.push(p.num); } });
    if (M.mode === '9' && !onTable(W).some((n) => n !== 9)) { /* solo queda la 9: sigue el juego */ }
    if (cur.scratch) M.inHand = 'any';
    return { back, scratch: cur.scratch };
  }

  // ---------------- sincronización (online) ----------------
  function serialize(S) {
    return { matchIdx: S.matchIdx, lastLoser: S.lastLoser, done: S.done, M: S.M, players: S.players.map((P) => ({ jokers: P.jokers, points: P.points, wins: P.wins, stats: P.stats })) };
  }
  function applySync(S, d) {
    S.matchIdx = d.matchIdx; S.lastLoser = d.lastLoser; S.done = d.done; S.M = d.M;
    d.players.forEach((p, i) => Object.assign(S.players[i], p));
  }

  return {
    HEAD_X, FOOT, MID, GROUP_NAME, groupOf, newSeries, matchMode, theme, hasObs, draftOffers, pick, resolveJ, mods, startMatch, worldOpts,
    buildWorld, rack, applyTurn, shotSpeed, cueBall, onTable, remaining, legalFirst, goal, beginShot, track, resolve, respot,
    seriesWinner, canUse, useActive, freeCur, timeoutCur, resolveQuake, serialize, applySync,
  };
})();
