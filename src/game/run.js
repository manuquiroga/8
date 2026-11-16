// OCHO MALDITO — estado de partida, puntuación (Fichas × Mult), comodines, tienda.
window.OM = window.OM || {};

// RNG con semilla (mulberry32)
OM.RNG = function (seed) {
  let s = seed >>> 0;
  const r = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  r.state = () => s;
  return r;
};
OM.seedToStr = (n) => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) { s += A[n % 32]; n = Math.floor(n / 32); } return s; };

OM.jokerDef = (id) => OM.JOKERS.find((j) => j.id === id);
OM.itemDef = (id) => OM.ITEMS.find((j) => j.id === id);
OM.bossDef = (id) => OM.BOSSES.find((j) => j.id === id);
OM.cueDef = (id) => OM.CUES.find((j) => j.id === id);

OM.Run = (function () {
  function newJoker(id) {
    const def = OM.jokerDef(id);
    const r = OM.RARITY[def.rarity];
    const price = Math.round((r.price[0] + r.price[1]) / 2);
    return { id, def, st: def.state ? def.state() : {}, price, uid: Math.random().toString(36).slice(2) };
  }

  function create(cueId, seed) {
    seed = seed == null ? Math.floor(Math.random() * 1e9) : seed;
    const cue = OM.cueDef(cueId);
    const rng = OM.RNG(seed);
    const R = {
      seed, seedStr: OM.seedToStr(seed), rng, cue: cueId,
      money: cue.money, baseShots: cue.shots, interestCap: cue.interestCap || 5,
      jokerSlots: 5 + (cue.slots || 0), itemSlots: 2,
      jokers: [], items: [],
      balls: [], // el "mazo": 15 bolas con grabados
      levels: { simple: 1, doblete: 1, triplete: 1, masacre: 1, limpia: 1 },
      circle: 0, tableIdx: 0, bosses: [], infinite: false,
      rerollCost: 5, stats: { bestShot: 0, balls: 0, shots: 0, tables: 0, money: 0 },
      seen: {},
    };
    for (let n = 1; n <= 15; n++) R.balls.push({ num: n, kind: 'normal' });
    if (cue.joker) R.jokers.push(newJoker(cue.joker));
    if (cue.randomEng) {
      const kinds = ['oro', 'cristal', 'plomo', 'fuego', 'holo', 'bomba'];
      rng.shuffle(R.balls.filter((b) => b.num !== 8)).slice(0, cue.randomEng).forEach((b) => (b.kind = rng.pick(kinds)));
    }
    // jefes por círculo
    const pool = rng.shuffle(OM.BOSSES.filter((b) => !b.final).map((b) => b.id));
    for (let i = 0; i < 5; i++) R.bosses.push(pool[i]);
    R.bosses.push('boca');
    return R;
  }

  function target(R, circle = R.circle, tableIdx = R.tableIdx) {
    let base;
    if (circle < OM.CIRCLES.length) base = OM.CIRCLES[circle].base;
    else base = OM.CIRCLES[OM.CIRCLES.length - 1].base * Math.pow(2.4, circle - OM.CIRCLES.length + 1);
    const v = base * OM.TABLE_KINDS[tableIdx].mul;
    const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
    return Math.round(v / mag) * mag;
  }
  function circleDef(R) { return OM.CIRCLES[Math.min(R.circle, OM.CIRCLES.length - 1)]; }
  function bossId(R) { return R.bosses[R.circle % R.bosses.length]; }
  function isBoss(R) { return R.tableIdx === 2; }
  function boss(R) { return isBoss(R) ? bossId(R) : null; }

  // ---- comodines: modificadores pasivos agregados ----
  function resolve(R, i, depth = 0) {
    const J = R.jokers[i];
    if (!J) return null;
    if (J.def.copy) { if (depth > 5) return null; return resolve(R, i + 1, depth + 1); }
    return J;
  }
  function mods(R) {
    const m = { extraShots: 0, pocketMul: 1, powerMul: 1, guide: 1, noScratch: false, eightSafe: false, scratchScores: false, retriggerFirst: false };
    R.jokers.forEach((_, i) => {
      const J = resolve(R, i); if (!J || !J.def.mods) return;
      const d = J.def.mods;
      if (d.extraShots) m.extraShots += d.extraShots;
      if (d.pocketMul) m.pocketMul *= d.pocketMul;
      if (d.powerMul) m.powerMul *= d.powerMul;
      if (d.guide) m.guide = Math.max(m.guide, d.guide);
      ['noScratch', 'eightSafe', 'scratchScores', 'retriggerFirst'].forEach((k) => { if (d[k]) m[k] = true; });
    });
    return m;
  }

  // ---- PUNTUACIÓN ----
  // shot = {balls:[{ball,pocket,banked}], scratch, cueContacts, cueCushions, shotIndex, shotsLeft, isBreak, ballsLeft, cursed, clearBonus}
  function score(R, shot) {
    const M = mods(R);
    const bossId_ = boss(R);
    const ev = [];
    const S = Object.assign({}, shot, { chips: 0, mult: 0, events: ev });
    S.add = (o, J) => {
      const src = J ? { type: 'joker', uid: J.uid } : S._src;
      if (o.chips) { S.chips += o.chips; ev.push({ k: 'chips', v: o.chips, src }); }
      if (o.mult) { S.mult += o.mult; ev.push({ k: 'mult', v: o.mult, src }); }
      if (o.xmult) { S.mult *= o.xmult; ev.push({ k: 'xmult', v: o.xmult, src }); }
      if (o.money) { ev.push({ k: 'money', v: o.money, src }); }
    };
    const callJ = (hook, ...args) => {
      R.jokers.forEach((inst, i) => {
        const J = resolve(R, i);
        if (!J || !J.def[hook]) return;
        // "this" = carta que se ilumina (la copia si es Espejo Roto); J = dueño del estado
        const self = { uid: inst.uid, st: J.st, def: J.def };
        J.def[hook].call(self, S, ...args, self);
      });
    };

    // falta / maldición
    if (shot.scratch && !M.scratchScores) {
      ev.push({ k: 'msg', v: 'FALTA', color: 'c' });
      callJ('onScratch');
      S.total = 0; return S;
    }
    if (shot.scratch) callJ('onScratch');
    if (shot.cursed && !M.eightSafe) {
      ev.push({ k: 'msg', v: '¡MALDICIÓN!', color: 'b', curse: true });
      S.total = 0; return S;
    }
    let counted = shot.balls.slice();
    if (bossId_ === 'coleccionista') counted = counted.filter((b) => b.ball.num >= 9 || (b.ball.num === 8 && shot.clear));
    S.balls = counted;
    const n = counted.length;
    if (!n) { ev.push({ k: 'msg', v: 'FALLO', color: '6' }); S.total = 0; return S; }
    const typeId = shot.clear ? 'limpia' : n >= 4 ? 'masacre' : n === 3 ? 'triplete' : n === 2 ? 'doblete' : 'simple';
    const T = OM.SHOT_TYPES[typeId], lvl = R.levels[typeId];
    S.typeId = typeId;
    S.chips = T.chips + T.lvlChips * (lvl - 1);
    S.mult = T.mult + T.lvlMult * (lvl - 1);
    ev.push({ k: 'type', v: typeId, lvl, chips: S.chips, mult: S.mult });

    counted.forEach((b, idx) => {
      const reps = idx === 0 && M.retriggerFirst ? 2 : 1;
      for (let rep = 0; rep < reps; rep++) {
        S._src = { type: 'ball', ball: b.ball, x: b.pocket.x, y: b.pocket.y, rep };
        if (rep) ev.push({ k: 'msg', v: '¡ECO!', color: 't', src: S._src });
        const gl = bossId_ === 'gloton' && idx === 0;
        const base = b.ball.num === 8 ? 40 : b.ball.num * 5;
        if (gl) ev.push({ k: 'msg', v: 'DEVORADA', color: 'b', src: S._src });
        else S.add({ chips: base });
        if (b.banked) S.add({ chips: 10 });
        const k = b.ball.kind;
        if (k === 'oro') S.add({ money: 3 });
        if (k === 'plomo') S.add({ chips: 50 });
        if (k === 'holo') S.add({ mult: 10 });
        if (k === 'fuego') S.add({ mult: 3 * n });
        if (k === 'bomba') S.add({ chips: 30 });
        if (k === 'cristal') S.add({ xmult: 2 });
        callJ('onBall', b);
        S._src = null;
      }
    });
    callJ('onShot');
    if (bossId_ === 'sanguijuela') ev.push({ k: 'money', v: -1, src: { type: 'boss' } });
    S.total = Math.floor(S.chips * S.mult);
    return S;
  }

  // efectos de comodín que no dependen de embocar (dinero por tiro, etc.) se ejecutan en score.
  function afterShot(R, S) {
    R.jokers.forEach((J) => { if (J.def.onAfter) J.def.onAfter.call(J, S, J); });
  }

  // ---- ECONOMÍA ----
  function cashout(R, shotsLeft) {
    const kind = OM.TABLE_KINDS[R.tableIdx];
    const lines = [{ label: kind.name, v: kind.reward }];
    if (shotsLeft > 0) lines.push({ label: 'Tiros sobrantes', v: shotsLeft });
    const interest = Math.min(R.interestCap, Math.floor(Math.max(0, R.money) / 5));
    if (interest > 0) lines.push({ label: 'Interés ($1 cada $5)', v: interest });
    return lines;
  }

  function sellPrice(J) { return Math.max(1, Math.floor((J.price || 4) / 2)); }

  // ---- TIENDA ----
  function rollRarity(rng, allowLegend) {
    const r = rng() * 100;
    if (allowLegend && r < 3) return 'legendario';
    if (r < 5) return 'epico';
    if (r < 30) return 'raro';
    return 'comun';
  }
  function randomJoker(R, allowLegend, exclude = []) {
    const owned = new Set(R.jokers.map((j) => j.id).concat(exclude));
    for (let tries = 0; tries < 30; tries++) {
      const rar = rollRarity(R.rng, allowLegend);
      const pool = OM.JOKERS.filter((j) => j.rarity === rar && !owned.has(j.id));
      if (pool.length) return R.rng.pick(pool).id;
    }
    const pool = OM.JOKERS.filter((j) => j.rarity !== 'legendario' && !owned.has(j.id));
    return pool.length ? R.rng.pick(pool).id : null;
  }
  function randomItem(R, kind) {
    const pool = OM.ITEMS.filter((i) => !kind || i.kind === kind);
    return R.rng.pick(pool).id;
  }
  function itemPrice(id) { const d = OM.itemDef(id); return d.kind === 'luna' ? 3 : d.kind === 'grabado' ? 3 : 4; }

  function makeShop(R) {
    const slots = [];
    const ex = [];
    for (let i = 0; i < 2; i++) {
      const id = randomJoker(R, false, ex); if (!id) continue; ex.push(id);
      const J = newJoker(id);
      slots.push({ type: 'joker', id, J, price: J.price });
    }
    const items = [];
    for (let i = 0; i < 2; i++) {
      const roll = R.rng();
      const id = randomItem(R, roll < 0.4 ? 'arcano' : roll < 0.7 ? 'luna' : 'grabado');
      items.push({ type: 'item', id, price: itemPrice(id) });
    }
    const packs = [];
    const pk = ['arcano', 'luna', 'grabado', 'maldito'];
    for (let i = 0; i < 2; i++) {
      const kind = R.rng() < 0.25 ? 'maldito' : R.rng.pick(pk.slice(0, 3));
      packs.push({ type: 'pack', kind, price: kind === 'maldito' ? 6 : 4 });
    }
    return { slots, items, packs };
  }
  function openPack(R, kind) {
    const opts = [];
    if (kind === 'maldito') {
      const ex = [];
      for (let i = 0; i < 3; i++) { const id = randomJoker(R, true, ex); if (id) { ex.push(id); opts.push({ type: 'joker', id, J: newJoker(id) }); } }
    } else {
      const ex = new Set();
      for (let i = 0; i < 3; i++) {
        let id, t = 0;
        do { id = randomItem(R, kind); t++; } while (ex.has(id) && t < 20);
        ex.add(id); opts.push({ type: 'item', id });
      }
    }
    return opts;
  }

  return { create, target, circleDef, bossId, isBoss, boss, mods, score, afterShot, cashout, sellPrice, makeShop, openPack, newJoker, randomJoker };
})();
