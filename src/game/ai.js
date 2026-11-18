// 8 — bots (fácil, medio, difícil). Apuntan con geometría de bola fantasma, y los niveles altos
// comprueban el tiro simulándolo en una copia de la mesa. El nivel cambia el pulso (ruido) y cuánto comprueban.
window.OM = window.OM || {};

OM.AI = (function () {
  const L = OM.LAYOUT, F = L.felt, BR = L.ballR, R2 = BR * 2;
  const LV = {
    facil:   { noise: 0.034, sims: 0,  pick: 3 },
    medio:   { noise: 0.012, sims: 6,  pick: 1 },
    dificil: { noise: 0.0035, sims: 30, pick: 1 },
  };
  const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / 0.707; };

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }
  function segClear(W, ax, ay, bx, by, rad, ignore) {
    for (const b of W.balls) { if (!b.alive || ignore.includes(b)) continue; if (segDist(b.x, b.y, ax, ay, bx, by) < rad) return false; }
    for (const P of W.bumpers) if (segDist(P.x, P.y, ax, ay, bx, by) < P.r + BR) return false;
    return true;
  }
  // punto de entrada de una tronera (un poco hacia dentro de la mesa)
  function entry(p) {
    const cx = F.x + F.w / 2, cy = F.y + F.h / 2;
    if (!p.corner) return { x: p.x, y: p.y + (p.y < cy ? 3 : -3) };
    const dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy);
    return { x: p.x + (dx / d) * 4, y: p.y + (dy / d) * 4 };
  }
  // potencia para que la bola objetivo llegue viva a la tronera
  function powerFor(W, m, dCG, dOP, cut) {
    const a = W.decel, vObj = Math.sqrt(2 * a * dOP * 2.4) + 90;
    const vHit = vObj / Math.max(0.25, cut), v0 = Math.sqrt(vHit * vHit + 2 * a * dCG) * 1.08;
    const p = Math.pow(Math.max(0.02, (v0 / m.powerMul - 60) / 960), 0.8);
    return Math.max(0.16, Math.min(1, p));
  }

  // tiros directos posibles desde (cx, cy)
  function candidates(S, W, cx, cy, cue) {
    const out = [];
    const targets = W.balls.filter((b) => b.alive && b.num !== 0 && OM.Match.legalFirst(S, W, b.num));
    for (const t of targets) {
      for (const p of W.pockets) {
        if (p.sealed) continue;
        const e = entry(p);
        let ox = e.x - t.x, oy = e.y - t.y; const dOP = Math.hypot(ox, oy); ox /= dOP; oy /= dOP;
        if (!p.corner && Math.abs(oy) < 0.42) continue; // lateral demasiado de canto
        const gx = t.x - ox * R2, gy = t.y - oy * R2;
        let ax = gx - cx, ay = gy - cy; const dCG = Math.hypot(ax, ay); if (dCG < 1) continue; ax /= dCG; ay /= dCG;
        const cut = ax * ox + ay * oy;
        if (cut < 0.22) continue;
        if (!segClear(W, cx, cy, gx, gy, R2 - 0.5, [cue, t])) continue;
        if (!segClear(W, t.x, t.y, e.x, e.y, R2 - 1.5, [cue, t])) continue;
        const score = Math.pow(cut, 2.2) / (1 + dOP / 220) / (1 + dCG / 600);
        out.push({ t, p, angle: Math.atan2(ay, ax), cut, dCG, dOP, score, gx, gy });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }

  // simula el tiro en una copia: 2 = emboca el objetivo, 1 = emboca otra propia, 0 = nada, -1 = desastre
  function trial(S, W, cue, angle, power, m, tnum) {
    const P = OM.Physics.clone(W); P.breakPending = 0; P.bomb = false;
    const c = P.balls[W.balls.indexOf(cue)];
    OM.Physics.shoot(P, c, angle, OM.Match.shotSpeed(power, m), null, 0, 1);
    let first = null, scratch = false; const pot = [];
    OM.Physics.run(P, 8, (e) => {
      if (e.type === 'hit' && first == null && (e.a === c || e.b === c)) first = (e.a === c ? e.b : e.a).num;
      else if (e.type === 'pocket') { if (e.ball.num === 0) scratch = true; else pot.push(e.ball.num); }
    });
    if (scratch || first !== tnum) return -1;
    const M = S.M;
    if (M.mode === '8' && tnum !== 8 && pot.includes(8)) return -1;
    if (pot.includes(tnum)) return 2;
    if (M.mode === '8') { const g = M.open ? null : M.groups[M.turn]; return pot.some((n) => n !== 8 && (!g || OM.Match.groupOf(n) === g)) ? 1 : 0; }
    return pot.length ? 1 : 0;
  }

  // ¿dónde poner la blanca con bola en mano?
  function place(S, W, level) {
    const M = S.M, cue = OM.Match.cueBall(W), kitchen = M.inHand === 'kitchen';
    const maxX = kitchen ? OM.Match.HEAD_X : F.x + F.w - BR;
    const ok = (x, y) => x >= F.x + BR + 1 && x <= maxX && y >= F.y + BR + 1 && y <= F.y + F.h - BR - 1 && OM.Physics.freeSpot(W, x, y, BR, cue);
    if (M.breakShot) {
      for (let k = 0; k < 30; k++) { const x = OM.Match.HEAD_X - 20 - Math.random() * 40, y = F.y + F.h / 2 + (Math.random() - 0.5) * 70; if (ok(x, y)) return { x, y }; }
    }
    let best = null;
    if (level !== 'facil' || Math.random() < 0.5) {
      const targets = W.balls.filter((b) => b.alive && b.num !== 0 && OM.Match.legalFirst(S, W, b.num));
      for (const t of targets) for (const p of W.pockets) {
        if (p.sealed) continue;
        const e = entry(p);
        let ox = e.x - t.x, oy = e.y - t.y; const dOP = Math.hypot(ox, oy); ox /= dOP; oy /= dOP;
        if (!p.corner && Math.abs(oy) < 0.5) continue;
        if (!segClear(W, t.x, t.y, e.x, e.y, R2 - 1.5, [cue, t])) continue;
        for (const back of [60, 40, 90, 130]) {
          const x = t.x - ox * (R2 + back), y = t.y - oy * (R2 + back);
          if (!ok(x, y) || !segClear(W, x, y, t.x - ox * R2, t.y - oy * R2, R2 - 0.5, [cue, t])) continue;
          const sc = 1 / (1 + dOP / 150) - back / 2000;
          if (!best || sc > best.sc) best = { x, y, sc };
          break;
        }
      }
    }
    if (best) return { x: best.x, y: best.y };
    for (let k = 0; k < 200; k++) { const x = F.x + BR + 2 + Math.random() * (maxX - F.x - BR - 4), y = F.y + BR + 2 + Math.random() * (F.h - R2 - 4); if (ok(x, y)) return { x, y }; }
    return { x: cue.x, y: cue.y };
  }

  // Decide el tiro. Devuelve {angle, power, spin, elev} o {joker: idx} si antes quiere usar un comodín activo.
  function plan(S, W, level) {
    const M = S.M, me = M.turn, P = S.players[me], lv = LV[level] || LV.medio;
    const m = OM.Match.mods(S, me), cue = OM.Match.cueBall(W);
    let noise = lv.noise * (1 + m.shake * 0.8) * (OM.Match.hasObs(S, 'niebla') || m.fog ? 1.5 : 1) * (m.guide === 0 ? 1.4 : 1) * (m.lie ? 2.2 : 1);
    const shot = (angle, power) => ({ angle: angle + gauss() * noise, power: Math.max(0.1, Math.min(1, power * (1 + gauss() * 0.04))), spin: { f: 0, s: 0 }, elev: 0 });
    if (M.breakShot) {
      // saque: a la bola de cabeza, fuerte pero no siempre igual
      const head = W.balls.filter((b) => b.alive && b.num !== 0).sort((a, b) => a.x - b.x)[0];
      return shot(Math.atan2(head.y - cue.y, head.x - cue.x), 0.86 + Math.random() * 0.14);
    }
    const act = (kind) => P.jokers.findIndex((J, i) => OM.jokerDef(J.id).active === kind && OM.Match.canUse(S, me, i));
    const cands = candidates(S, W, cue.x, cue.y, cue);
    const Rv = S.players[1 - me], onFinal = M.mode === '8' && !M.open && !OM.Match.remaining(S, W, me).length;
    const use = (kind, p) => { const i = act(kind); return i >= 0 && Math.random() < p ? { joker: i } : null; };
    const pick = use('heist', Rv.points >= 1500 ? 1 : 0)                       // Atraco: cuando el rival tiene mucho
      || use('pickpocket', Rv.money >= 3 ? 1 : 0)
      || use('hex', 0.25) || use('rush', 0.4) || use('shrink', 0.3)
      || (!cands.length ? use('hand', 1) || use('tornado', 1) || use('quake', level === 'facil' ? 0 : 1) || use('free', 1) || use('rewind', 1)
        : use('bomb', 0.3) || use('xshot', 0.35) || use('boost', 0.3) || use('free', 0.2) || use('rewind', onFinal ? 1 : 0.15));
    if (pick) return pick;
    if (cands.length) {
      let budget = lv.sims;
      if (budget > 0) {
        let fallback = null;
        for (const c of cands.slice(0, 6)) {
          const p0 = powerFor(W, m, c.dCG, c.dOP, c.cut);
          for (const pw of [p0, Math.min(1, p0 * 1.3), p0 * 0.8]) {
            for (const da of [0, 0.006, -0.006, 0.013, -0.013]) {
              if (budget-- <= 0) break;
              const r = trial(S, W, cue, c.angle + da, pw, m, c.t.num);
              if (r === 2) return shot(c.angle + da, pw);
              if (r >= 0 && !fallback) fallback = { a: c.angle + da, p: pw };
            }
          }
          if (budget <= 0) break;
        }
        if (fallback) return shot(fallback.a, fallback.p);
      }
      const c = cands[Math.floor(Math.random() * Math.min(lv.pick, cands.length))];
      return shot(c.angle, powerFor(W, m, c.dCG, c.dOP, c.cut));
    }
    // sin tiro directo: al menos tocar una bola legal
    const legal = W.balls.filter((b) => b.alive && b.num !== 0 && OM.Match.legalFirst(S, W, b.num))
      .sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y));
    for (const t of legal) if (segClear(W, cue.x, cue.y, t.x, t.y, R2 - 0.5, [cue, t])) return shot(Math.atan2(t.y - cue.y, t.x - cue.x), 0.6); // fuerte: alguna bola tiene que tocar banda
    if (level !== 'facil') {
      // a banda: prueba ángulos hasta encontrar uno que toque primero una bola legal
      const v = OM.Match.shotSpeed(0.6, m), a0 = Math.random() * Math.PI * 2;
      for (let k = 0; k < 72; k++) {
        const a = a0 + (k / 72) * Math.PI * 2;
        const tr = OM.Physics.predict(W, cue, a, v, null, 0, { maxBounces: 3, maxLen: 1400 });
        if (tr.target && !tr.scratch && OM.Match.legalFirst(S, W, tr.target.num)) return shot(a, 0.6);
      }
    }
    const t = legal[0];
    return shot(t ? Math.atan2(t.y - cue.y, t.x - cue.x) : Math.random() * 6.28, 0.5);
  }

  // compra en la tienda: llena huecos de comodines, cambia el peor por uno de más rareza, y gasta lo que sobra
  // en hechizo y activo. Sin trampas: usa las mismas funciones que el jugador (OM.Match.buy / sell / reroll).
  const RW = { comun: 1, raro: 2.2, epico: 4, legendario: 7 };
  function shop(S, pi) {
    const MT = OM.Match, P = S.players[pi], sh = MT.openShop(S);
    const val = (id) => RW[OM.jokerDef(id).rarity] * (0.7 + Math.random() * 0.6);
    for (let pass = 0; pass < 2; pass++) {
      // comodines: de más valioso a menos
      const offers = sh.offers[pi].map((o, k) => ({ o, k, v: val(o.id) })).filter((x) => !x.o.sold && MT.typeOf(x.o.id) === 'comodin').sort((a, b) => b.v - a.v);
      for (const x of offers) {
        if (MT.countType(P, 'comodin') < OM.SHOP.slots) { MT.buy(S, pi, x.k); continue; }
        const worst = P.jokers.filter((J) => MT.typeOf(J.id) === 'comodin').sort((a, b) => RW[OM.jokerDef(a.id).rarity] - RW[OM.jokerDef(b.id).rarity])[0];
        if (worst && RW[OM.jokerDef(worst.id).rarity] * 1.5 < x.v) MT.buy(S, pi, x.k, worst.uid);
      }
      // hechizo (dura una partida) y activo, si sobra
      sh.offers[pi].forEach((o, k) => {
        if (o.sold) return;
        const t = MT.typeOf(o.id);
        if (t === 'hechizo' && P.money >= MT.price(o.id) + 1) MT.buy(S, pi, k);
        if (t === 'activo' && !MT.countType(P, 'activo') && P.money >= MT.price(o.id)) MT.buy(S, pi, k);
      });
      // cambia la tienda una vez si sobra mucho dinero
      if (pass === 0 && P.money >= MT.rerollCost(S, pi) + 8) MT.reroll(S, pi); else break;
    }
  }

  // MODO CAOS: una compra en el turno del rival (1 hechizo y 1 activo por turno). Devuelve {a:'buy', k} o null.
  // Prefiere trastadas (caen ya sobre el que tira) y la rareza.
  function caosAct(S, pi) {
    const MT = OM.Match, sh = S.M.caos.shop[pi];
    if (!MT.caosOpen(S, pi)) return null;
    const best = sh.offers.map((o, k) => {
      if (MT.caosCanBuy(S, pi, k)) return { k, v: 0 };
      const d = OM.jokerDef(o.id);
      return { k, v: ((MT.isTrap(d) ? 3 : 2) + RW[d.rarity] * 0.4) * (0.7 + Math.random() * 0.6) };
    }).filter((x) => x.v > 0).sort((a, b) => b.v - a.v)[0];
    return best ? { a: 'buy', k: best.k } : null;
  }

  return { plan, place, shop, candidates, caosAct };
})();
