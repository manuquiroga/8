// 8 — reglas del pool arcade 1v1: serie de 5 partidas, juez de bola 8 y bola 9, puntuación (Puntos × Combo),
// comodines (comodín / hechizo / activo), dinero y tienda. Sin dibujo ni entrada: lo usan la escena de mesa, los bots y las pruebas headless.
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
  const typeOf = (id) => OM.jtype(OM.jokerDef(id));
  const TYPE_ORDER = { comodin: 0, hechizo: 1, activo: 2 };
  function newJoker(S, pi, id) {
    const d = OM.jokerDef(id), P = S.players[pi];
    P.uidN = (P.uidN || 0) + 1;
    return { id, st: d.state ? d.state() : {}, used: false, uid: 'p' + pi + '_' + P.uidN + '_' + id };
  }
  // orden fijo en la fila: comodines (en el orden en que se compraron), luego el hechizo y luego el activo
  function sortJ(P) {
    const rank = (J) => TYPE_ORDER[typeOf(J.id)];
    P.jokers = P.jokers.map((J, i) => [J, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
  }
  function give(S, pi, id) { const J = newJoker(S, pi, id); S.players[pi].jokers.push(J); sortJ(S.players[pi]); return J; }

  // cfg = {seed, mode:'8'|'9'|'mix', players:[{name, kind:'human'|'bot'|'remote', level, cue}]}
  function newSeries(cfg) {
    const seed = (cfg.seed == null ? Math.floor(Math.random() * 1e9) : cfg.seed) >>> 0;
    const S = {
      v: 3, seed, seedStr: OM.seedToStr(seed), mode: cfg.mode || '8', n: 5, matchIdx: 0, lastLoser: seed & 1, done: false,
      players: cfg.players.map((p) => ({ name: p.name, kind: p.kind || 'human', level: p.level || null, cue: p.cue || 'peregrino', jokers: [], points: 0, wins: 0, money: OM.SHOP.start, uidN: 0, stats: { balls: 0, fouls: 0, best: 0, shots: 0, earned: OM.SHOP.start, spent: 0 } })),
      obstacles: [], M: null, shop: null, paid: -1,
      pay: { match: -1, lines: [0, 1].map(() => [{ label: 'Bolsa inicial', v: OM.SHOP.start }]) },
    };
    const rng = OM.RNG(mix(seed, 11));
    S.players.forEach((P, i) => {
      const cue = OM.cueDef(P.cue);
      if (cue.joker) give(S, i, cue.joker);
      if (cue.randomJoker) give(S, i, rng.pick(OM.JOKERS.filter((j) => j.rarity === cue.randomJoker && !j.copy && OM.jtype(j) === 'comodin' && !(j.only8 && S.mode === '9'))).id);
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

  // ---------------- tienda: antes de cada partida ----------------
  // Las ofertas salen de la semilla (iguales en los dos clientes del online): cada jugador tiene su tienda.
  // Una tienda trae comodines, 1 hechizo y 1 activo. El que va por detrás ve un comodín más y cambia gratis una vez.
  const SH = OM.SHOP;
  function price(id) { const d = OM.jokerDef(id); return SH.price[OM.jtype(d)][d.rarity]; }
  function sellPrice(id) { return Math.max(1, Math.floor(price(id) / 2)); }
  function behind(S, pi) { return S.players[pi].points < S.players[1 - pi].points; }
  function countType(P, type) { return P.jokers.filter((J) => typeOf(J.id) === type).length; }
  function offers(S, pi, roll) {
    const P = S.players[pi];
    const rng = OM.RNG(mix(mix(S.seed, S.matchIdx + 1), pi * 977 + roll * 31 + 101));
    const owned = new Set(P.jokers.map((j) => j.id)), taken = new Set();
    const i = S.matchIdx, w = { comun: 60, raro: 30 + 3 * i, epico: 6 + 3 * i, legendario: 1 + 1.5 * i };
    const ok = (j, type) => OM.jtype(j) === type && !owned.has(j.id) && !taken.has(j.id) && !(j.copy && !countType(P, 'comodin')) && !(j.only8 && S.mode === '9');
    const one = (type) => {
      for (let tries = 0; tries < 40; tries++) {
        let r = rng() * (w.comun + w.raro + w.epico + w.legendario), rar = 'comun';
        for (const k of ['comun', 'raro', 'epico', 'legendario']) { if ((r -= w[k]) < 0) { rar = k; break; } }
        const pool = OM.JOKERS.filter((j) => j.rarity === rar && ok(j, type));
        if (pool.length) { const id = rng.pick(pool).id; taken.add(id); return id; }
      }
      const any = OM.JOKERS.filter((j) => ok(j, type));
      if (!any.length) return null;
      const id = rng.pick(any).id; taken.add(id); return id;
    };
    const out = [];
    const n = SH.offers.comodin + (behind(S, pi) ? 1 : 0);
    for (let k = 0; k < n; k++) { const id = one('comodin'); if (id) out.push({ id, sold: false }); }
    ['hechizo', 'activo'].forEach((type) => { for (let k = 0; k < SH.offers[type]; k++) { const id = one(type); if (id) out.push({ id, sold: false }); } });
    return out;
  }
  // abre la tienda de la partida actual (idempotente)
  function openShop(S) {
    if (S.shop && S.shop.match === S.matchIdx) return S.shop;
    const free = [0, 1].map((pi) => behind(S, pi));
    S.shop = { match: S.matchIdx, roll: [0, 0], paidRolls: [0, 0], free, offers: [offers(S, 0, 0), offers(S, 1, 0)] };
    return S.shop;
  }
  function rerollCost(S, pi) { const sh = openShop(S); return sh.free[pi] ? 0 : SH.reroll + sh.paidRolls[pi]; }
  function reroll(S, pi) {
    const sh = openShop(S), P = S.players[pi], cost = rerollCost(S, pi);
    if (P.money < cost) return false;
    P.money -= cost; P.stats.spent += cost;
    if (sh.free[pi]) sh.free[pi] = false; else sh.paidRolls[pi]++;
    sh.roll[pi]++;
    sh.offers[pi] = offers(S, pi, sh.roll[pi]);
    return true;
  }
  // ¿qué carta sale de la fila si compro `id`? (comodín: la que elija el jugador si no hay hueco; hechizo/activo: la que tenga)
  function displaced(S, pi, id, replaceUid) {
    const P = S.players[pi], type = typeOf(id);
    if (type === 'comodin') {
      if (countType(P, 'comodin') < SH.slots) return null;
      return P.jokers.find((J) => J.uid === replaceUid && typeOf(J.id) === 'comodin') || undefined;
    }
    return P.jokers.find((J) => typeOf(J.id) === type) || null;
  }
  // compra la oferta k. Devuelve {J, out} o {err}.
  function buy(S, pi, k, replaceUid) {
    const sh = openShop(S), o = sh.offers[pi][k], P = S.players[pi];
    if (!o || o.sold) return { err: 'Ya está vendida' };
    if (P.jokers.some((J) => J.id === o.id)) return { err: 'Ya la tienes' };
    const out = displaced(S, pi, o.id, replaceUid);
    if (out === undefined) return { err: 'Elige qué comodín reemplazar', full: true };
    const cost = price(o.id), refund = out ? sellPrice(out.id) : 0;
    if (P.money + refund < cost) return { err: 'No te alcanza' };
    P.money += refund - cost; P.stats.spent += cost;
    const J = newJoker(S, pi, o.id);
    if (out) P.jokers[P.jokers.indexOf(out)] = J; else P.jokers.push(J);
    sortJ(P);
    o.sold = true;
    return { J, out, refund };
  }
  function sell(S, pi, uid) {
    const P = S.players[pi], i = P.jokers.findIndex((J) => J.uid === uid);
    if (i < 0) return 0;
    const v = sellPrice(P.jokers[i].id);
    P.jokers.splice(i, 1); P.money += v;
    return v;
  }
  // cobro al terminar una partida (antes de la tienda siguiente). Idempotente. Los hechizos se acaban aquí.
  function payday(S) {
    const M = S.M, i = S.matchIdx;
    if (!M || S.paid === i) return S.pay;
    S.paid = i;
    const lines = [[], []];
    S.players.forEach((P, pi) => {
      const R = S.players[1 - pi], L_ = lines[pi];
      const add = (label, v) => { if (v > 0) { P.money += v; P.stats.earned += v; L_.push({ label, v }); } };
      if (M.tcash && M.tcash[pi]) L_.push({ label: 'Trucos en la partida', v: M.tcash[pi], info: true });
      add('Sueldo', SH.wage);
      if (M.winner != null && M.winner !== pi) add('Partida perdida', SH.loser);
      if (P.points < R.points) add('Vas por detrás', SH.behind);
      const cue = OM.cueDef(P.cue);
      if (cue && cue.wage) add(cue.name, cue.wage);
      P.jokers.forEach((inst, idx) => {
        const J = resolveJ(P, idx), d = J && OM.jokerDef(J.id);
        if (d && d.onPayday) add(OM.jokerDef(inst.id).name, d.onPayday.call({ st: J.st, inst: J, def: d }, S, J, P, R) || 0);
      });
    });
    // los hechizos duran una partida
    S.players.forEach((P, pi) => {
      P.jokers.filter((J) => typeOf(J.id) === 'hechizo').forEach((J) => lines[pi].push({ label: OM.jokerDef(J.id).name + ' se acabó', v: 0, info: true, gone: true }));
      P.jokers = P.jokers.filter((J) => typeOf(J.id) !== 'hechizo');
    });
    S.pay = { match: i, lines };
    return S.pay;
  }
  // estado de un jugador tras la tienda (lo que viaja en el online)
  function shopState(S, pi) { const P = S.players[pi]; return JSON.parse(JSON.stringify({ jokers: P.jokers, money: P.money, uidN: P.uidN, stats: P.stats })); }
  function applyShopState(S, pi, st) { Object.assign(S.players[pi], JSON.parse(JSON.stringify(st))); }

  // ---------------- comodines ----------------
  // Espejo Roto copia al comodín de su izquierda
  function resolveJ(P, i, depth) {
    const J = P.jokers[i]; if (!J) return null;
    if (OM.jokerDef(J.id).copy) {
      if ((depth || 0) > 5 || !P.jokers[i - 1] || typeOf(P.jokers[i - 1].id) !== 'comodin') return null;
      return resolveJ(P, i - 1, (depth || 0) + 1);
    }
    return J;
  }
  function findOnce(P, id) { return P.jokers.find((J) => J.id === id && !J.used) || null; }

  const MUL = ['pocketMul', 'pocketPull', 'powerMul', 'guideLen', 'trickMul', 'pointsMul', 'frictionMul'];
  function merge(m, d) {
    for (const k in d) {
      if (MUL.includes(k)) m[k] *= d[k];
      else if (k === 'clock') m[k] = Math.min(m[k], d[k]);
      else if (k === 'guide' || k === 'foulCost' || k === 'foulPct' || k === 'foulGiftPct') m[k] = Math.max(m[k], d[k]);
      else if (typeof d[k] === 'boolean') m[k] = m[k] || d[k];
      else m[k] = (m[k] || 0) + d[k];
    }
  }
  // modificadores del jugador pi cuando le toca tirar (sus comodines + su taco + trastadas del rival + obstáculos)
  function mods(S, pi) {
    const m = {
      pocketMul: 1, pocketPull: 1, powerMul: 1, guide: 1, guideLen: 1, trickMul: 1, pointsMul: 1, noScratch: false, shake: 0,
      foulCost: PT.foul, foulPct: 0, foulGift: 0, foulGiftPct: 0, bribed: false, retriggerFirst: false, keepStreak: false, allTrick: false,
      clock: PT.clock, noSpin: false, tilt: 0, frictionMul: 1, immune: false, kamikaze: false, hexed: false, boosted: false,
    };
    const P = S.players[pi], Rv = S.players[1 - pi], fx = S.M && S.M.fx;
    const cue = OM.cueDef(P.cue);
    if (cue && cue.mods) merge(m, cue.mods);
    P.jokers.forEach((_, i) => { const J = resolveJ(P, i); const d = J && OM.jokerDef(J.id); if (d && d.mods) merge(m, d.mods); });
    let rg = 0;
    if (!m.immune) {
      // trastadas del rival (Amuleto las anula)
      Rv.jokers.forEach((_, i) => {
        const J = resolveJ(Rv, i); const d = J && OM.jokerDef(J.id); if (!d || !d.rival) return;
        const r = d.rival;
        if (r.pocketMul) m.pocketMul *= r.pocketMul;
        if (r.guide) rg += r.guide;
        if (r.shake) m.shake += r.shake;
        if (r.clock) m.clock = Math.min(m.clock, r.clock);
        if (r.noSpin) m.noSpin = true;
        if (r.tilt) m.tilt += r.tilt;
        if (r.frictionMul) m.frictionMul *= r.frictionMul;
      });
      if (fx && fx.hex === pi) { m.shake += 1.6; rg -= 2; m.hexed = true; } // Muñeco Vudú
    }
    if (fx && fx.boost === pi) { m.pocketMul *= 1.6; m.boosted = true; } // Boca del Infierno
    m.guide = Math.max(0, m.guide + rg);
    if (hasObs(S, 'boca')) m.pocketMul *= 0.78;
    if (hasObs(S, 'ciego')) m.guide = 0;
    if (hasObs(S, 'verdugo')) m.foulCost = Math.max(m.foulCost, 300);
    if (hasObs(S, 'reloj')) m.clock = Math.min(m.clock, 15);
    return m;
  }

  // ---------------- partida ----------------
  function startMatch(S) {
    const i = S.matchIdx, mode = matchMode(S, i);
    const breaker = S.lastLoser; // saca el que perdió la anterior (la primera, por semilla)
    S.M = {
      mode, turn: breaker, breaker, breakShot: true, open: mode === '8', groups: [null, null], inHand: 'kitchen',
      streak: [0, 0], shotIdx: 0, winner: null, obstacles: S.obstacles[i] || [], pts: [0, 0], gold: {}, end: null,
      tcash: [0, 0], // $ por trucos ganado en esta partida (con tope)
      // efectos de activos pendientes. boost/hex: índice del jugador afectado (-1 = nada)
      fx: { bomb: false, rewind: false, free: false, boost: -1, hex: -1, xshot: [0, 0] },
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
    if (!W.base) W.base = { tilt: W.tilt, decel: W.decel };
    W.pocketMul = m.pocketMul; W.pocketPull = m.pocketPull; W.noScratch = m.noScratch;
    W.tilt = W.base.tilt + m.tilt; W.decel = W.base.decel * m.frictionMul; // Mesa Torcida / Escarcha Negra
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
    // los activos armados se gastan en este tiro
    const fx = M.fx;
    if (fx.bomb) { W.bomb = true; fx.bomb = false; cur.bomb = true; }
    if (fx.free) { fx.free = false; cur.freeShot = true; }
    if (fx.boost === M.turn) fx.boost = -1; // las troneras ya están agrandadas para este tiro
    if (fx.hex === M.turn) fx.hex = -1;     // el temblor ya está aplicado a este tiro
    if (fx.rewind) { fx.rewind = false; cur.snap = { s: JSON.parse(JSON.stringify(serialize(S))), balls: OM.Physics.snap(W) }; }
    if (m.noSpin) { p = Object.assign({}, p, { spin: { f: 0, s: 0 }, elev: 0 }); cur.spun = false; cur.elev = 0; } // Grilletes
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
    const Sc = { S, M: S.M, me, rv: 1 - me, P: S.players[me], R: S.players[1 - me], cur, pts: 0, mult: 1, flat: 0, steal: 0, rpts: 0, cash: 0, rcash: 0, events: ev, balls: [], gifts: [], streak: 0, cleared: 0, left: -1, won: false, _src: null };
    // nº de trucos distintos del tiro (El Virtuoso)
    Sc.tricks = () => [Sc.balls.some((b) => b.banked), Sc.balls.some((b) => b.combo), cur.kick, cur.dist > 200, cur.hopped, cur.curved].filter(Boolean).length;
    Sc.add = (o, J) => {
      const src = J ? { type: 'joker', uid: J.uid } : Sc._src;
      if (o.cash) { Sc.cash += o.cash; ev.push({ k: 'cash', v: o.cash, src, label: o.label }); }
      if (o.pts) { Sc.pts += o.pts; ev.push({ k: 'pts', v: o.pts, src }); }
      if (o.mult) { Sc.mult += o.mult; ev.push({ k: 'mult', v: o.mult, src }); }
      if (o.xmult) { Sc.mult *= o.xmult; ev.push({ k: 'xmult', v: o.xmult, src }); }
      if (o.steal) { Sc.steal += o.steal; ev.push({ k: 'steal', v: o.steal, src }); }
    };
    // puntos directos para el que NO tira (comodines del rival)
    Sc.addRival = (o, J) => {
      const src = J ? { type: 'joker', uid: J.uid } : null;
      if (o.pts) { Sc.rpts += o.pts; ev.push({ k: 'rpts', v: o.pts, src }); }
      if (o.cash) { Sc.rcash += o.cash; ev.push({ k: 'rcash', v: o.cash, src }); }
    };
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
    // Kamikaze: meter la blanca no es falta si en el mismo tiro entra una bola tuya
    const ownPot = cur.pocketed.some((p) => (M.mode === '8' ? p.num !== 8 && (M.open || groupOf(p.num) === M.groups[me]) : p.num !== 9));
    const kamikaze = cur.scratch && !isBreak && Mo.kamikaze && ownPot;
    const scratchFoul = cur.scratch && !kamikaze;

    if (M.mode === '8') {
      const myG = M.groups[me];
      const onEight = !M.open && !cur.before.some((n) => groupOf(n) === myG);
      if (cur.timeout) foul = 'SE ACABÓ EL TIEMPO';
      else if (scratchFoul) foul = 'BLANCA DENTRO';
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
      else if (scratchFoul) foul = 'BLANCA DENTRO';
      else if (cur.firstHit == null) foul = 'NO TOCASTE NINGUNA BOLA';
      else if (cur.firstHit !== cur.lowest) foul = 'PRIMERO HAY QUE TOCAR LA ' + cur.lowest;
      else if (!isBreak && !cur.pocketed.length && !cur.railAfter) foul = 'NINGUNA BOLA TOCÓ BANDA';
      if (nums.includes(9)) {
        if (foul || isBreak) { out.respot.push(9); ev.push(msg(isBreak && !foul ? 'LA 9 EN EL SAQUE: VUELVE' : 'LA 9 VUELVE A LA MESA', '7')); }
        else { out.win = me; winBall = cur.pocketed.find((p) => p.num === 9); }
      }
      cur.pocketed.forEach((p) => { if (p.num !== 9) own.push(p); });
    }
    // Marcha Atrás: si el tiro no te sirvió (fallo, falta, la 8 antes de tiempo), se deshace entero
    if (cur.snap && out.win !== me && !(own.length && !foul && !lose)) {
      applySync(S, cur.snap.s);
      OM.Physics.restore(W, cur.snap.balls);
      ev.push(msg('¡MARCHA ATRÁS! EL TIRO NO CUENTA', 'u', null, true));
      ev.push({ k: 'total', v: 0, stolen: 0, rpts: 0 });
      out.win = null; out.cont = true; out.rewound = true;
      return out;
    }
    if (kamikaze && !foul && !lose) ev.push(msg('KAMIKAZE: LA BLANCA NO ES FALTA', 'm'));
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
          scored.forEach((b) => {
            Sc._src = { type: 'ball', x: b.pocket.x, y: b.pocket.y };
            Sc.add({ pts: b === winBall ? PT.finish : PT.breakBall });
            if (b !== winBall) Sc.callJ(me, 'onBreakBall', b);
          });
          Sc._src = null;
        } else {
          const n = Math.min(4, scored.length);
          Sc.mult = PT.multi[n];
          Sc.cleared = M.mode === '8' ? 7 - remaining(S, W, me).length : 9 - onTable(W).length;
          Sc.left = M.mode === '8' ? remaining(S, W, me).length : onTable(W).filter((x) => x !== 9).length;
          Sc.won = !!winBall;
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
          // Gran Golpe
          if (M.fx.xshot[me]) { ev.push(msg('¡GRAN GOLPE!', 'v', null, true)); Sc.add({ xmult: M.fx.xshot[me] }); M.fx.xshot[me] = 0; }
          // dinero por trucos (con tope por partida)
          const TR = OM.SHOP.trick;
          let tc = (n >= 4 ? TR.massacre : n === 3 ? TR.triple : n === 2 ? TR.double : 0)
            + (cur.hopped ? TR.hop : cur.curved ? TR.masse : 0) + (cur.kick ? TR.kick : 0) + (Sc.streak >= 2 ? TR.streak : 0);
          tc = Math.max(0, Math.min(tc, OM.SHOP.trickCap - M.tcash[me]));
          if (tc) { M.tcash[me] += tc; Sc.add({ cash: tc, label: 'TRUCOS' }); }
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
    P.money += Sc.cash; Rv.money += Sc.rcash;
    P.stats.earned += Sc.cash; Rv.stats.earned += Sc.rcash;
    out.cash = Sc.cash; out.rcash = Sc.rcash;
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
    if (!cont && !isFoul && cur.freeShot) { cont = true; ev.splice(ev.length - 1, 0, msg('TIRO GRATIS: ¡SIGUES!', 'v')); }
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
    S.players.forEach((P, pi) => P.jokers.forEach((inst, idx) => {
      const J = resolveJ(P, idx), d = J && OM.jokerDef(J.id);
      if (d && d.onMatchEnd) add(pi, OM.jokerDef(inst.id).name, d.onMatchEnd.call({ st: J.st, inst: J, def: d }, S, J, pi === win) || 0);
    }));
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
  // Se usan en tu turno, antes de tirar, y desaparecen de la fila.
  function canUse(S, pi, idx) {
    const M = S.M, J = S.players[pi].jokers[idx];
    if (!M || !J || M.turn !== pi || M.breakShot || M.winner != null) return false;
    const d = OM.jokerDef(J.id), fx = M.fx;
    if (!d.active) return false;
    switch (d.active) {
      case 'bomb': return !fx.bomb;
      case 'rewind': return !fx.rewind;
      case 'free': return !fx.free;
      case 'boost': return fx.boost !== pi;
      case 'hex': return fx.hex !== 1 - pi;
      case 'xshot': return !fx.xshot[pi];
      case 'heist': return S.players[1 - pi].points > 0;
    }
    return true;
  }
  // Devuelve {kind, name, v?} si se pudo usar (y lo quita de la fila), o null.
  function useActive(S, pi, idx) {
    if (!canUse(S, pi, idx)) return null;
    const M = S.M, fx = M.fx, P = S.players[pi], J = P.jokers[idx], d = OM.jokerDef(J.id);
    const res = { kind: d.active, name: d.name, uid: J.uid };
    P.jokers.splice(idx, 1);
    switch (d.active) {
      case 'bomb': fx.bomb = true; break;
      case 'rewind': fx.rewind = true; break;
      case 'free': fx.free = true; break;
      case 'boost': fx.boost = pi; break;
      case 'hex': fx.hex = 1 - pi; break;
      case 'xshot': fx.xshot[pi] = 3; break;
      case 'hand': M.inHand = 'any'; break;
      case 'heist': {
        const R = S.players[1 - pi], v = Math.min(R.points, Math.max(150, Math.min(800, Math.round(R.points * 0.1))));
        R.points -= v; P.points += v; M.pts[pi] += v; M.pts[1 - pi] -= v; res.v = v;
        break;
      }
    }
    return res;
  }
  // tiro que no llegó a hacerse: se acabó el tiempo (cuenta como falta)
  function timeoutCur(S, W) {
    const before = onTable(W);
    return { me: S.M.turn, timeout: true, isBreak: S.M.breakShot, power: 0, spun: false, elev: 0, pocketed: [], scratch: false, firstHit: null, hits: [], cueContacts: 0, cueCushions: 0, banked: {}, before, lowest: Math.min.apply(null, before), start: { x: 0, y: 0 }, dist: 0 };
  }
  // registro vacío para el rodar libre del Terremoto
  function freeCur() { return { free: true, pocketed: [], scratch: false, banked: {}, hits: [], cueContacts: 0, cueCushions: 0, firstHit: null, start: { x: 0, y: 0 } }; }
  // tras el Terremoto: tus bolas que caen puntúan; las del rival y la 8/9 vuelven; si cae la blanca, bola en mano
  const QUAKE_PTS = 150;
  function resolveQuake(S, W, cur) {
    const M = S.M, me = M.turn, P = S.players[me], back = [], own = [];
    cur.pocketed.forEach((p) => {
      const n = p.num, fin = (M.mode === '8' && n === 8) || (M.mode === '9' && n === 9);
      const mine = !fin && (M.mode === '9' || M.open || groupOf(n) === M.groups[me]);
      if (mine) own.push(p); else { respot(W, n); back.push(n); }
    });
    const v = own.length * QUAKE_PTS;
    P.points += v; M.pts[me] += v; P.stats.balls += own.length;
    if (cur.scratch) M.inHand = 'any';
    return { back, own, v, each: QUAKE_PTS, scratch: cur.scratch };
  }

  // ---------------- sincronización (online) ----------------
  function serialize(S) {
    return { matchIdx: S.matchIdx, lastLoser: S.lastLoser, done: S.done, M: S.M, players: S.players.map((P) => ({ jokers: P.jokers, points: P.points, wins: P.wins, money: P.money, uidN: P.uidN, stats: P.stats })) };
  }
  function applySync(S, d) {
    S.matchIdx = d.matchIdx; S.lastLoser = d.lastLoser; S.done = d.done; S.M = d.M;
    d.players.forEach((p, i) => Object.assign(S.players[i], JSON.parse(JSON.stringify(p))));
  }

  return {
    HEAD_X, FOOT, MID, GROUP_NAME, groupOf, newSeries, matchMode, theme, hasObs, resolveJ, mods, startMatch, worldOpts, typeOf, countType,
    price, sellPrice, behind, openShop, rerollCost, reroll, displaced, buy, sell, payday, shopState, applyShopState,
    buildWorld, rack, applyTurn, shotSpeed, cueBall, onTable, remaining, legalFirst, goal, beginShot, track, resolve, respot,
    seriesWinner, canUse, useActive, freeCur, timeoutCur, resolveQuake, serialize, applySync,
  };
})();
