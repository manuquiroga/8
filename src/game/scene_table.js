// 8 — escena de mesa: apuntar, tirar, simular, puntuar, cobrar.
window.OM = window.OM || {};
OM.SCENES = OM.SCENES || {};

(function () {
  const L = OM.LAYOUT, F = L.felt;
  const HEAD_X = F.x + F.w * 0.25;
  const FOOT = { x: F.x + F.w * 0.72, y: F.y + F.h / 2 };
  let T = null; // estado de la mesa

  function rackPositions() {
    const d = L.ballR * 2 + 0.15, pos = [];
    for (let k = 0; k < 5; k++) for (let j = 0; j <= k; j++)
      pos.push({ x: FOOT.x + k * d * 0.866 + (Math.random() - 0.5) * 0.3, y: FOOT.y + (j - k / 2) * d + (Math.random() - 0.5) * 0.3, k, j });
    return pos;
  }

  function placeRack(R, sources) {
    const pos = rackPositions();
    const eightIdx = 4; // fila 3, centro
    const others = R.rng.shuffle(sources.filter((b) => b.num !== 8));
    const eight = sources.find((b) => b.num === 8);
    // esquinas traseras: una lisa y una rayada si es posible
    const order = [];
    const slots = pos.map((_, i) => i).filter((i) => i !== eightIdx);
    const placed = new Array(15).fill(null);
    if (eight) placed[eightIdx] = eight;
    const solids = others.filter((b) => b.num < 8), stripes = others.filter((b) => b.num > 8);
    if (solids.length && stripes.length) {
      placed[10] = solids.pop(); placed[14] = stripes.pop();
    }
    const rest = R.rng.shuffle(solids.concat(stripes));
    slots.forEach((i) => { if (!placed[i] && rest.length) placed[i] = rest.pop(); });
    placed.forEach((src, i) => { if (src) order.push({ src, p: pos[i] }); });
    return order;
  }

  function newWorld(R) {
    const M = OM.Run.mods(R);
    const boss = OM.Run.boss(R);
    let pocketMul = M.pocketMul;
    if (boss === 'boca') pocketMul *= 0.62;
    const W = OM.Physics.create({
      pocketMul,
      sealedSides: boss === 'sepulturero',
      noScratch: M.noScratch,
      frictionMul: boss === 'cienaga' ? 2 : boss === 'escarcha' ? 0.45 : 1,
      tilt: boss === 'pendulo' ? 70 : 0,
      pocketPull: M.pocketPull,
    });
    return W;
  }

  function rack(full) {
    const R = OM.R, W = T.W;
    W.balls = W.balls.filter((b) => b.num === 0 && b.alive);
    const srcs = full ? R.balls.slice() : T.remaining();
    placeRack(R, srcs).forEach(({ src, p }) => {
      OM.Physics.addBall(W, { num: src.num, kind: src.kind, src, x: p.x, y: p.y });
    });
    W.balls.forEach((b) => { if (b.num !== 0) { b.rollX = Math.random() * 40; b.rollY = Math.random() * 40; } });
  }

  function cueBall() { return T.W.balls.find((b) => b.num === 0); }

  function ensureCue(anywhere) {
    let c = cueBall();
    if (!c || !c.alive) {
      T.W.balls = T.W.balls.filter((b) => b.num !== 0);
      c = OM.Physics.addBall(T.W, { num: 0, kind: 'normal', x: F.x + F.w * 0.2, y: F.y + F.h / 2 });
    }
    T.phase = 'place'; T.placeAny = !!anywhere;
    return c;
  }

  OM.SCENES.table = {
    drawsFX: true,
    enter() {
      const R = OM.R;
      const M = OM.Run.mods(R);
      const boss = OM.Run.boss(R);
      T = {
        W: null, phase: 'place', placeAny: false, angle: 0, power: 0, charging: false, strike: 0,
        shots: R.baseShots + M.extraShots - (boss === 'reloj' ? 1 : 0), shotIndex: 0, score: 0, scoreShown: 0, refunded: false,
        target: OM.Run.target(R), boss, guide: boss === 'ciego' ? 0 : M.guide, cur: null, play: null, endT: 0,
        chips: 0, mult: 0, shotName: '', shotColor: '7', bump: { c: 0, m: 0 }, multStr: '0',
        showBalls: false, paused: false, lastHit: 0, cashout: null, msg: null, t0: OM.time, aimKey: false,
        spin: { f: 0, s: 0 }, streak: 0, carga: 0,
      };
      T.remaining = () => {
        const onTable = new Set(T.W.balls.filter((b) => b.alive && b.num !== 0).map((b) => b.src));
        return R.balls.filter((b) => onTable.has(b));
      };
      T.W = newWorld(R);
      rack(true);
      const c = ensureCue(false);
      c.x = HEAD_X - 30; c.y = F.y + F.h / 2;
      T.angle = 0;
      OM.Run.tableHook(R, 'onTableStart');
      OM.FX.clear();
      OM.music(boss ? 'boss' : 'table');
      if (boss) { setTimeout(() => OM.sfx('boss'), 400); OM.FX.flash('a', 0.35, 0.6); }
      OM.HUD.sel = null;
      T.intro = 1.6;
      OM.LOG.tableStart(R, T);
    },

    api: {
      canUseItem: () => T && (T.phase === 'aim' || T.phase === 'place') && !T.charging,
      addShot(n) { T.shots += n; },
      ballInHand() { ensureCue(true); },
      rerack() {
        const c = cueBall();
        const rem0 = T.remaining();
        T.W.balls = T.W.balls.filter((b) => b.num === 0);
        const rem = rem0;
        placeRack(OM.R, rem).forEach(({ src, p }) => OM.Physics.addBall(T.W, { num: src.num, kind: src.kind, src, x: p.x, y: p.y }));
        if (c && !OM.Physics.freeSpot(T.W, c.x, c.y, c.r, c)) ensureCue(true);
        OM.sfx('reroll');
      },
      fullGuide() { T.guide = 2; },
      onEngrave() {
        // refrescar el aspecto de las bolas en mesa
        T.W.balls.forEach((b) => { if (b.src) { b.kind = b.src.kind; b.m = b.kind === 'plomo' ? 2 : 1; } });
      },
    },

    update(dt, t) {
      const R = OM.R, IN = OM.IN, W = T.W;
      if (T.intro > 0) T.intro -= dt;
      T.bump.c = Math.max(0, T.bump.c - dt * 5); T.bump.m = Math.max(0, T.bump.m - dt * 5);
      if (IN.kp.Escape && !OM.HUD.picker && !T.showBalls && T.phase !== 'won' && T.phase !== 'lost') T.paused = !T.paused;
      if (T.paused || OM.HUD.picker || T.showBalls) return;
      // suavizar marcador
      T.scoreShown += (T.score - T.scoreShown) * Math.min(1, dt * 8);
      if (Math.abs(T.score - T.scoreShown) < 1) T.scoreShown = T.score;

      if (T.phase === 'place') updatePlace(dt);
      else if (T.phase === 'aim') updateAim(dt);
      else if (T.phase === 'strike') {
        T.strike -= dt;
        if (T.strike <= 0) doShoot();
      } else if (T.phase === 'rolling') updateRolling(dt);
      else if (T.phase === 'scoring') updateScoring(dt);
      else if (T.phase === 'lost') T.endT -= dt; // el paso a 'gameover' lo hace el botón de drawLost (una sola vez)
      if (T.phase !== 'rolling') OM.Physics.step(W, dt); // animaciones de caída
    },

    draw(ctx, t) { drawTable(ctx, t); },
  };

  // ---------------- colocar blanca ----------------
  function updatePlace(dt) {
    const IN = OM.IN, c = cueBall();
    const maxX = T.placeAny ? F.x + F.w - c.r : HEAD_X;
    let x = Math.min(Math.max(IN.mx, F.x + c.r), maxX), y = Math.min(Math.max(IN.my, F.y + c.r), F.y + F.h - c.r);
    const overTable = OM.G.inside(L.table.x, L.table.y, L.table.w, L.table.h);
    if (overTable) {
      if (OM.Physics.freeSpot(T.W, x, y, c.r, c)) { c.x = x; c.y = y; }
      OM.G.cursor = 'grab';
      if (IN.released && !IN.consumed && OM.Physics.freeSpot(T.W, c.x, c.y, c.r, c)) {
        IN.consumed = true; T.phase = 'aim'; OM.sfx('click');
        OM.FX.burst(c.x, c.y, 'dust', 6);
      }
    }
    if (IN.kp.Enter || IN.kp.Space) { T.phase = 'aim'; }
  }

  // ---------------- apuntar ----------------
  function inPlayArea() { const IN = OM.IN; return IN.my > 66 && IN.my < L.bottom.y - 2 && IN.mx > 186 && !OM.HUD.sel; }

  // ---- selector de efecto (punto de impacto en la blanca) ----
  const SPIN_UI = { x: L.bottom.x + L.bottom.w - 24, y: L.bottom.y + 20, r: 15 };
  function updateSpin() {
    const IN = OM.IN, S = SPIN_UI, sp = T.spin;
    const step = 0.25, clamp = () => {
      const d = Math.hypot(sp.f, sp.s); if (d > 1) { sp.f /= d; sp.s /= d; }
      sp.f = Math.round(sp.f * 100) / 100; sp.s = Math.round(sp.s * 100) / 100;
    };
    if (IN.kp.KeyW) { sp.f += step; clamp(); OM.sfx('click'); }
    if (IN.kp.KeyS) { sp.f -= step; clamp(); OM.sfx('click'); }
    if (IN.kp.KeyA) { sp.s -= step; clamp(); OM.sfx('click'); }
    if (IN.kp.KeyD) { sp.s += step; clamp(); OM.sfx('click'); }
    if (IN.kp.KeyR) { sp.f = sp.s = 0; OM.sfx('click'); }
    const dx = IN.mx - S.x, dy = IN.my - S.y, inside = dx * dx + dy * dy <= (S.r + 3) * (S.r + 3);
    if (inside) {
      OM.G.cursor = 'grab';
      OM.G.tooltip(S.x - 60, L.bottom.y - 62, 'EFECTO', 'Clic en la blanca: arriba = {m}seguimiento{/}, abajo = {c}retroceso{/}, lados = efecto en banda. Clic derecho o R: centro. Teclas W A S D.', 'r');
      if (IN.rpressed) { sp.f = sp.s = 0; OM.sfx('click'); }
      if (IN.down && !T.charging) { sp.s = dx / S.r; sp.f = -dy / S.r; clamp(); IN.consumed = true; }
      if (IN.released) { OM.sfx('click'); IN.consumed = true; }
    }
    return inside;
  }
  function drawSpin(ctx, t) {
    const S = SPIN_UI, sp = T.spin, P = OM.PAL;
    ctx.fillStyle = P['1']; ctx.beginPath(); ctx.arc(S.x, S.y, S.r + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P['7']; ctx.beginPath(); ctx.arc(S.x, S.y, S.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P['8']; ctx.beginPath(); ctx.arc(S.x - 4, S.y - 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P['6']; ctx.fillRect(S.x - S.r + 2, S.y, S.r * 2 - 4, 1); ctx.fillRect(S.x, S.y - S.r + 2, 1, S.r * 2 - 4);
    const px = Math.round(S.x + sp.s * (S.r - 3)), py = Math.round(S.y - sp.f * (S.r - 3));
    const col = sp.f > 0.05 ? 'm' : sp.f < -0.05 ? 'c' : sp.s ? 'q' : 'b';
    ctx.fillStyle = P['0']; ctx.fillRect(px - 3, py - 2, 7, 5); ctx.fillRect(px - 2, py - 3, 5, 7);
    ctx.fillStyle = P[col]; ctx.fillRect(px - 2, py - 1, 5, 3); ctx.fillRect(px - 1, py - 2, 3, 5);
    const lbl = sp.f > 0.05 ? 'SEGUIR' : sp.f < -0.05 ? 'RETRO' : sp.s ? 'LADO' : 'CENTRO';
    OM.FONT.draw(ctx, lbl, S.x - S.r - 6, S.y - 4, { color: col === 'b' ? '6' : col, align: 'right' });
  }

  function updateAim(dt) {
    const IN = OM.IN, c = cueBall(), R = OM.R;
    const M = OM.Run.mods(R);
    if (!T.charging) updateSpin();
    if (!T.charging) {
      if (IN.kp.ArrowLeft || IN.kp.ArrowRight || IN.keys.ArrowLeft || IN.keys.ArrowRight) {
        const sp = IN.keys.ShiftLeft || IN.keys.ShiftRight ? 0.03 : 0.004;
        if (IN.keys.ArrowLeft) T.angle -= sp; if (IN.keys.ArrowRight) T.angle += sp;
        T.aimKey = true; T.lastMouse = { x: IN.mx, y: IN.my };
      }
      if (IN.wheel) { T.angle += IN.wheel * 0.006; T.aimKey = true; T.lastMouse = { x: IN.mx, y: IN.my }; }
      const moved = !T.lastMouse || Math.hypot(IN.mx - T.lastMouse.x, IN.my - T.lastMouse.y) > 2;
      if (inPlayArea() && (!T.aimKey || moved)) {
        T.aimKey = false;
        const dx = IN.mx - c.x, dy = IN.my - c.y;
        if (dx * dx + dy * dy > 16) T.angle = Math.atan2(dy, dx);
      }
      if (inPlayArea()) OM.G.cursor = 'aim';
      if (IN.pressed && inPlayArea() && !IN.consumed) {
        const dx = IN.mx - c.x, dy = IN.my - c.y;
        if (dx * dx + dy * dy > 16 && !T.aimKey) T.angle = Math.atan2(dy, dx);
        T.charging = true; T.chargeFrom = { x: IN.mx, y: IN.my }; T.power = 0; T.kbd = false;
      }
      if (IN.kp.Space) { T.charging = true; T.kbd = true; T.power = 0; T.kdir = 1; }
    } else {
      if (T.kbd) {
        T.power += T.kdir * dt * 0.9;
        if (T.power >= 1) { T.power = 1; T.kdir = -1; } if (T.power <= 0) { T.power = 0; T.kdir = 1; }
        if (!IN.keys.Space) release();
      } else {
        const dx = IN.mx - T.chargeFrom.x, dy = IN.my - T.chargeFrom.y;
        // solo cuenta el arrastre hacia atrás (opuesto al tiro)
        const back = -(dx * Math.cos(T.angle) + dy * Math.sin(T.angle));
        const raw = Math.max(Math.hypot(dx, dy) * 0.35, back);
        T.power = Math.min(1, Math.max(0, raw / 90));
        OM.G.cursor = 'grab';
        if (!IN.down) release();
      }
      if (IN.rpressed || IN.kp.Escape) { T.charging = false; T.power = 0; }
    }
    function release() {
      T.charging = false;
      if (T.power < 0.03) { T.power = 0; return; }
      T.phase = 'strike'; T.strike = 0.08; T.strikePow = T.power;
    }
    void M;
  }

  function doShoot() {
    const R = OM.R, c = cueBall(), M = OM.Run.mods(R);
    const pw = T.strikePow;
    const v = (60 + Math.pow(pw, 1.25) * 960) * M.powerMul;
    OM.Physics.shoot(T.W, c, T.angle, v, T.spin);
    OM.sfx('cue_hit', { vol: 0.4 + pw * 0.6 });
    OM.FX.burst(c.x - Math.cos(T.angle) * 6, c.y - Math.sin(T.angle) * 6, 'dust', 4 + Math.round(pw * 8));
    if (pw > 0.85) OM.FX.shake(2, 0.15);
    T.cur = {
      pocketed: [], scratch: false, cueContacts: new Set(), cueCushions: 0, banked: new Set(), eight: false,
      spun: Math.hypot(T.spin.f, T.spin.s) > 0.2,
      isBreak: T.W.balls.filter((b) => b.alive && b.num !== 0).length === R.balls.length,
    };
    T._lastRemaining = null;
    T.phase = 'rolling';
    T.W.tiltActive = false;
    T.power = 0;
    R.stats.shots++;
  }

  // ---------------- simulación ----------------
  function updateRolling(dt) {
    const W = T.W, cur = T.cur;
    // cámara lenta si una bola va a la tronera rápido (solo un pelín de drama)
    OM.Physics.step(W, dt);
    for (const e of W.events) {
      if (e.type === 'hit') {
        const vol = Math.min(1, e.speed / 600);
        if (OM.time - T.lastHit > 0.015 || vol > 0.5) { OM.sfx('clack', { vol: 0.15 + vol * 0.85, pan: (e.x - 320) / 320 }); T.lastHit = OM.time; }
        if (e.speed > 250) OM.FX.burst(e.x, e.y, 'spark', 2 + Math.round(vol * 5));
        if (e.speed > 700) OM.FX.shake(1.5, 0.1);
        const cue = e.a.num === 0 ? e.a : e.b.num === 0 ? e.b : null;
        if (cue) cur.cueContacts.add(cue === e.a ? e.b : e.a);
        if (cue && cur.isBreak && !cur.boosted) {
          cur.boosted = true;
          OM.Physics.breakBoost(W, cue, T.strikePow);
          OM.FX.shake(2 + T.strikePow * 4, 0.3); OM.FX.burst(e.x, e.y, 'spark', 16);
          OM.sfx('clack', { vol: 1 }); OM.sfx('clack', { vol: 0.8, pitch: 0.9 });
        }
        [e.a, e.b].forEach((b) => {
          if (b.kind === 'bomba' && !b.exploded && b.alive) {
            b.exploded = true;
            OM.Physics.explode(W, b.x, b.y, 70, 560);
            OM.FX.burst(b.x, b.y, 'explosion', 30); OM.FX.shake(5, 0.35); OM.FX.flash('v', 0.3, 0.2);
            OM.sfx('explosion');
          }
        });
      } else if (e.type === 'cushion') {
        if (e.speed > 30) OM.sfx('cushion', { vol: Math.min(1, e.speed / 600), pan: (e.x - 320) / 320 });
        if (e.ball.num === 0) { if (!e.jaw) cur.cueCushions++; } else cur.banked.add(e.ball);
      } else if (e.type === 'pocket') {
        const b = e.ball;
        OM.sfx('pocket', { vol: 0.5 + Math.min(0.5, e.speed / 800), pan: (e.x - 320) / 320 });
        OM.FX.burst(e.x, e.y, 'pocket', 14);
        T.glow = { p: e.pocket, t: 0.6, color: b.num === 0 ? 'c' : b.num === 8 ? 'b' : 'h' };
        if (b.num === 0) { cur.scratch = true; OM.sfx('scratch'); OM.FX.popText(e.x, e.y - 10, 'FALTA', 'c'); }
        else {
          cur.pocketed.push({ ball: b.src, pocket: e.pocket, banked: cur.banked.has(b), phys: b });
          if (b.num === 8) cur.eight = true;
          const n = cur.pocketed.length;
          OM.FX.popText(e.x, e.y - 12, n > 1 ? 'x' + n + '!' : '¡DENTRO!', n > 1 ? 'n' : '8');
          if (b.num !== 8) OM.FX.burst(e.x, e.y, 'ember', 6);
        }
      } else if (e.type === 'ghostBounce') {
        OM.FX.burst(e.x, e.y, 'smoke', 10); OM.sfx('curse', { vol: 0.4 });
      }
    }
    W.events.length = 0;
    if (!OM.Physics.moving(W)) finishShot();
  }

  function finishShot() {
    const R = OM.R, cur = T.cur;
    const remainingObj = T.W.balls.filter((b) => b.alive && b.num !== 0).length;
    const eightLeftOnTable = T.W.balls.some((b) => b.alive && b.num === 8);
    const cursed = cur.eight && remainingObj > 0;
    const clear = cur.eight && remainingObj === 0 && !cur.scratch;
    T._lastRemaining = new Set(T.W.balls.filter((b) => b.alive && b.num !== 0).map((b) => b.src));
    if (!cur.isBreak) T.shots--; // SAQUE LIBRE: no gasta tiro
    const shot = {
      balls: cur.pocketed, scratch: cur.scratch, cueContacts: cur.cueContacts.size, cueCushions: cur.cueCushions,
      shotIndex: T.shotIndex, shotsLeft: T.shots, isBreak: cur.isBreak, ballsLeft: remainingObj, cursed, clear, streak: T.streak, spun: cur.spun, carga: T.carga,
    };
    const S = cur.isBreak ? OM.Run.breakShot(R, shot) : OM.Run.score(R, shot);
    if (cur.isBreak) T.carga += S.carga; else if (S.usedCarga) T.carga = 0;
    OM.LOG.shot(R, shot, S, { power: Math.round(T.strikePow * 100) / 100, spinF: T.spin.f, spinS: T.spin.s, left: T.shots });
    T.S = S;
    T.play = { i: 0, timer: 0.25, events: S.events, done: false, totalT: 0 };
    T.chips = 0; T.mult = 0; T.multStr = '0'; T.shotName = ''; T.shotColor = '7';
    T.phase = 'scoring';
    void eightLeftOnTable;
  }

  function evPos(src) {
    if (!src) return { x: F.x + F.w / 2, y: F.y + 40 };
    if (src.type === 'joker') {
      const i = OM.R.jokers.findIndex((j) => j.uid === src.uid);
      if (i >= 0) { OM.HUD.bump(src.uid); return { x: OM.HUD.jokerX(OM.R, i) + 20, y: L.jokers.y + 62 }; }
    }
    if (src.type === 'ball') return { x: Math.min(Math.max(src.x, F.x + 10), F.x + F.w - 10), y: Math.min(Math.max(src.y, F.y + 12), F.y + F.h - 10) };
    return { x: F.x + F.w / 2, y: F.y + 40 };
  }
  const fmtMult = (m) => (Math.abs(m - Math.round(m)) < 0.01 ? OM.fmt(m) : m.toFixed(1));

  function updateScoring(dt) {
    const P = T.play, R = OM.R;
    P.timer -= dt;
    if (P.timer > 0) return;
    if (P.i < P.events.length) {
      const e = P.events[P.i++];
      const p = evPos(e.src);
      const speed = Math.max(0.09, 0.26 - P.i * 0.014);
      P.timer = speed;
      const pitch = 1 + Math.min(1.2, P.i * 0.06);
      switch (e.k) {
        case 'type': {
          const Ty = OM.SHOT_TYPES[e.v];
          T.shotName = Ty.name.toUpperCase() + ' nv.' + e.lvl; T.shotColor = e.v === 'limpia' ? 'h' : e.v === 'masacre' ? 'c' : '8';
          T.chips = e.chips; T.mult = e.mult; T.multStr = fmtMult(T.mult); T.bump.c = T.bump.m = 1;
          OM.FX.popText(F.x + F.w / 2, F.y + F.h / 2 - 20, Ty.name.toUpperCase(), T.shotColor, { size: 2 });
          OM.sfx('card_flip');
          if (e.v === 'masacre' || e.v === 'limpia') { OM.FX.shake(3, 0.3); OM.FX.flash('c', 0.2, 0.2); }
          P.timer = 0.35;
          break;
        }
        case 'carga': OM.FX.popText(F.x + F.w / 2, F.y + F.h / 2 + 4, 'CARGA +' + e.v + ' MULT', 'q', { size: 2 }); OM.sfx('mult', { pitch: 1.2 }); OM.FX.burst(F.x + F.w / 2, F.y + F.h / 2, 'spark', 12); P.timer = 0.5; break;
        case 'chips': T.chips += e.v; T.bump.c = 1; OM.FX.popText(p.x, p.y, (e.v < 0 ? '-' : '+') + OM.fmt(Math.abs(e.v)), e.v < 0 ? 'b' : 'q'); OM.sfx('chips', { pitch }); break;
        case 'mult': T.mult += e.v; T.multStr = fmtMult(T.mult); T.bump.m = 1; OM.FX.popText(p.x, p.y, '+' + e.v + ' Mult', 'c'); OM.sfx('mult', { pitch }); break;
        case 'xmult': T.mult *= e.v; T.multStr = fmtMult(T.mult); T.bump.m = 1.6; OM.FX.popText(p.x, p.y, 'x' + (Math.round(e.v * 100) / 100), 'c', { size: 2 }); OM.sfx('xmult', { pitch }); OM.FX.shake(2, 0.15); P.timer += 0.08; break;
        case 'money': R.money += e.v; OM.FX.popText(p.x, p.y - 8, (e.v > 0 ? '+$' : '-$') + Math.abs(e.v), 'h'); if (e.v > 0) { OM.sfx('coin'); OM.FX.burst(p.x, p.y, 'gold', 6); } break;
        case 'msg':
          OM.FX.popText(e.src ? p.x : F.x + F.w / 2, e.src ? p.y - 10 : F.y + F.h / 2, e.v, e.color || '8', { size: 2 });
          if (e.curse) { OM.sfx('curse'); OM.FX.flash('a', 0.5, 0.5); OM.FX.shake(4, 0.4); OM.FX.burst(F.x + F.w / 2, F.y + F.h / 2, 'blood', 30); }
          else if (e.v === 'FALTA') OM.sfx('lose', { vol: 0.5 });
          P.timer = 0.5;
          break;
      }
      return;
    }
    if (!P.done) {
      P.done = true;
      const total = T.S.total;
      const before = T.score;
      T.score += total;
      R.stats.bestShot = Math.max(R.stats.bestShot, total);
      if (total > OM.META.bestShot) { OM.META.bestShot = total; OM.saveMeta(); }
      if (total > 0) {
        OM.FX.popText(F.x + F.w / 2, F.y + F.h / 2 + 8, OM.fmt(total), total >= T.target * 0.5 ? 'd' : '8', { size: 2, big: true });
        const big = total >= T.target * 0.4;
        OM.sfx('score_total', { pitch: big ? 1.2 : 1 });
        if (big) { OM.FX.shake(4, 0.35); OM.FX.burst(F.x + F.w / 2, F.y + F.h / 2, 'ember', 40); }
        if (before < T.target && T.score >= T.target) { OM.FX.flash('h', 0.3, 0.4); OM.FX.burst(100, 90, 'gold', 30); }
      }
      P.timer = total > 0 ? 0.9 : 0.4;
      return;
    }
    afterShot();
  }

  function afterShot() {
    const R = OM.R, cur = T.cur, S = T.S;
    OM.Run.afterShot(R, S);
    R.stats.balls += cur.pocketed.length;
    // cristal: puede romperse
    const free = !!S.isFreeBreak;
    cur.pocketed.forEach((pb) => {
      if (!free && pb.ball.kind === 'cristal' && R.rng() < 0.25) {
        const i = R.balls.indexOf(pb.ball);
        if (i >= 0) R.balls.splice(i, 1);
        OM.FX.burst(pb.pocket.x, pb.pocket.y, 'shard', 20); OM.sfx('glass_break');
        OM.FX.popText(pb.pocket.x, pb.pocket.y - 14, '¡ROTA!', 'r');
      }
    });
    if (!free && T.boss === 'verdugo' && (cur.scratch || !cur.pocketed.length)) { T.shots = Math.max(0, T.shots - 1); OM.FX.popText(F.x + F.w / 2, F.y + F.h / 2 + 24, 'EL VERDUGO: -1 TIRO', 'b', { size: 2 }); }
    if (!free) { T.shotIndex++; T.streak = S.total > 0 ? T.streak + 1 : 0; }
    if (T.streak > (OM.META.maxStreak || 0)) { OM.META.maxStreak = T.streak; OM.saveMeta(); }
    // Segunda Oportunidad: el primer tiro fallido de la mesa no gasta tiro
    if (!free && !T.refunded && !cur.pocketed.length && !cur.scratch && OM.Run.mods(R).refundMiss && T.shots >= 0) {
      T.refunded = true; T.shots++;
      const J = R.jokers.find((j) => j.id === 'segunda'); if (J) OM.HUD.bump(J.uid);
      OM.FX.popText(F.x + F.w / 2, F.y + F.h / 2, '¡TIRO RECUPERADO!', 'm', { size: 2 }); OM.sfx('level_up');
    }
    // la 8 maldita vuelve al punto
    if (S.cursed !== undefined && cur.eight && T.W.balls.some((b) => b.alive && b.num !== 0)) {
      const e = T.W.balls.find((b) => b.num === 8);
      if (e) {
        let x = FOOT.x, y = FOOT.y;
        while (!OM.Physics.freeSpot(T.W, x, y, e.r, e) && x < F.x + F.w - 10) x += 3;
        e.alive = true; e.sinking = false; e.x = x; e.y = y; e.vx = e.vy = 0;
        OM.FX.burst(x, y, 'smoke', 16);
      }
    }
    // victoria
    if (T.score >= T.target) { win(); return; }
    if (T.shots <= 0) { OM.LOG.tableEnd(R, false, T); T.phase = 'lost'; T.endT = 1.8; OM.sfx('lose'); OM.FX.flash('a', 0.5, 1); OM.music('gameover'); return; }
    // mesa vacía → nuevo triángulo
    const left = T.W.balls.filter((b) => b.alive && b.num !== 0).length;
    if (left === 0) {
      OM.FX.popText(F.x + F.w / 2, F.y + F.h / 2, '¡NUEVO TRIÁNGULO!', 'n', { size: 2 });
      T.W.balls = T.W.balls.filter((b) => b.num === 0 && b.alive);
      rack(true);
      const c = ensureCue(false); c.x = HEAD_X - 30; c.y = F.y + F.h / 2;
      return;
    }
    if (cur.scratch) ensureCue(true);
    else T.phase = 'aim';
    // intensidad musical
    try { OM.AUDIO.intensity(Math.min(1, T.score / T.target * 0.7 + (T.shots <= 1 ? 0.3 : 0))); } catch (e) {}
  }

  function win() {
    const R = OM.R;
    T.phase = 'won';
    R.stats.tables++;
    if (T.boss) { OM.META.bosses = (OM.META.bosses || 0) + 1; OM.saveMeta(); }
    OM.Run.tableHook(R, 'onTableEnd');
    OM.sfx('win_table');
    OM.FX.burst(F.x + F.w / 2, F.y + F.h / 2, 'gold', 40);
    T.cashout = { lines: OM.Run.cashout(R, T.shots), t: 0 };
    T.cashout.total = T.cashout.lines.reduce((a, l) => a + l.v, 0);
    OM.LOG.tableEnd(R, true, T, T.cashout.total);
    try { OM.AUDIO.intensity(0); } catch (e) {}
  }

  function collect() {
    const R = OM.R;
    R.money += T.cashout.total;
    R.stats.money += T.cashout.total;
    OM.sfx('coin');
    R.tableIdx++;
    if (R.tableIdx > 2) {
      R.tableIdx = 0; R.circle++;
      OM.META.best = Math.max(OM.META.best, R.circle); OM.saveMeta();
      if (R.circle >= OM.CIRCLES.length && !R.infinite) { OM.go('victory'); return; }
    }
    OM.go('shop');
  }

  function aimLabel() {
    const isBreak = T.W.balls.filter((b) => b.alive && b.num !== 0).length === OM.R.balls.length;
    if (isBreak) return 'SAQUE LIBRE';
    const p = [];
    if (T.carga) p.push('CARGA +' + T.carga);
    if (T.streak) p.push('RACHA +' + Math.min(8, T.streak));
    return p.length ? p.join(' · ') + ' Mult' : 'apunta...';
  }

  // ---------------- dibujo ----------------
  function drawTable(ctx, t) {
    const R = OM.R, W = T.W, G = OM.G, IN = OM.IN;
    const theme = OM.Run.circleDef(R).theme;
    const sh = OM.FX.shakeOffset();
    ctx.save();
    OM.TABLE.drawBackdrop(ctx, theme, t);
    ctx.translate(Math.round(sh.x), Math.round(sh.y));
    OM.TABLE.drawTable(ctx, theme, t, { sealedSides: T.boss === 'sepulturero', pocketScale: W.pockets[0].r / L.pocketR });
    if (T.glow) { T.glow.t -= 1 / 60; if (T.glow.t > 0) OM.TABLE.drawPocketGlow(ctx, T.glow.p, t, T.glow.color); else T.glow = null; }
    // bolas
    for (const b of W.balls) if (b.alive) OM.TABLE.drawBallShadow(ctx, Math.round(b.x), Math.round(b.y));
    for (const b of W.balls) {
      if (!b.alive && !b.sinking) continue;
      if (b.sinking) {
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - b.sink);
        const s = 1 - b.sink * 0.5;
        ctx.translate(b.x, b.y); ctx.scale(s, s);
        OM.TABLE.drawBall(ctx, b, 0, 0, t);
        ctx.restore();
      } else OM.TABLE.drawBall(ctx, b, Math.round(b.x), Math.round(b.y), t);
    }
    const c = cueBall();
    if (T.boss === 'niebla' && c) OM.TABLE.drawFog(ctx, c.x, c.y, 62, t);
    // guía + taco
    if (c && c.alive && (T.phase === 'aim' || T.phase === 'strike') && !T.paused) {
      const g = T.guide;
      const tr = g > 0 ? OM.Physics.trace(W, c, T.angle, g >= 2 ? 2 : 0, g >= 2 ? 900 : 380, T.spin.f) : { pts: [], ghost: null };
      const opts = {};
      if (tr.ghost) {
        const ol = (g >= 2 ? 90 : 34) * Math.max(0.25, tr.objDir.k), cl = (g >= 2 ? 60 : 30) * tr.cueDir.k;
        opts.objPath = [{ x: tr.target.x, y: tr.target.y }, { x: tr.target.x + tr.objDir.x * ol, y: tr.target.y + tr.objDir.y * ol }];
        if (cl > 3) opts.cuePath = [{ x: tr.ghost.x, y: tr.ghost.y }, { x: tr.ghost.x + tr.cueDir.x * cl, y: tr.ghost.y + tr.cueDir.y * cl }];
      }
      if (g > 0) OM.TABLE.drawAim(ctx, tr.pts, tr.ghost, t, opts);
      const pull = T.phase === 'strike' ? -2 + (T.strike / 0.08) * (4 + T.strikePow * 26) : 4 + T.power * 26;
      OM.TABLE.drawCue(ctx, R.cue, c.x - Math.cos(T.angle) * (c.r + 1), c.y - Math.sin(T.angle) * (c.r + 1), T.angle, pull, t);
    }
    if (T.phase === 'place' && c) {
      ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.2;
      if (!T.placeAny) { ctx.fillStyle = OM.PAL['7']; for (let y = F.y + 2; y < F.y + F.h; y += 4) ctx.fillRect(HEAD_X, y, 1, 2); }
      ctx.globalAlpha = 1;
    }
    OM.FX.draw(ctx);
    ctx.restore();

    // ---- HUD ----
    const multStr = T.multStr;
    OM.HUD.drawPanel(ctx, R, t, {
      title: (T.boss ? OM.bossDef(T.boss).name : OM.TABLE_KINDS[R.tableIdx].name).toUpperCase(),
      bossId: T.boss, target: T.target, score: T.score, scoreShown: T.scoreShown,
      sub: T.boss ? null : 'Recompensa: $' + OM.TABLE_KINDS[R.tableIdx].reward,
      shotName: T.shotName || (T.phase === 'aim' ? aimLabel() : ''), shotColor: T.shotName ? T.shotColor : T.carga ? 'q' : T.streak ? 'v' : '5',
      chips: T.chips, mult: T.mult, multStr, bump: T.bump, shots: T.shots,
      buttons(y) {
        if (G.button(L.panel.x + 8, y, 80, 16, 'BOLAS', 'blue')) { T.showBalls = true; }
        if (G.button(L.panel.x + 92, y, 80, 16, 'MENÚ', 'dark', T.phase === 'lost')) { T.paused = true; }
      },
    });
    const ui = T.phase === 'aim' || T.phase === 'place';
    OM.HUD.drawJokers(ctx, R, t, { interactive: ui });
    OM.HUD.drawItems(ctx, R, t, 'table', OM.SCENES.table.api);
    // barra inferior
    const B = L.bottom;
    if (T.charging || T.phase === 'strike') {
      OM.FONT.draw(ctx, 'POTENCIA', B.x + 8, B.y + 12, { color: '7' });
      OM.UI.bar(ctx, B.x + 64, B.y + 10, 300, 10, T.phase === 'strike' ? T.strikePow : T.power, T.power > 0.85 ? 'c' : T.power > 0.5 ? 'v' : 'h');
      OM.FONT.draw(ctx, Math.round((T.phase === 'strike' ? T.strikePow : T.power) * 100) + '%', B.x + 372, B.y + 12, { color: '8' });
    } else {
      let hint = '';
      const hx = B.x + (B.w - 84) / 2;
      if (T.phase === 'place') hint = T.placeAny ? 'BOLA EN MANO · clic para colocar la blanca' : 'SAQUE LIBRE · no gasta tiro · cada bola = +2 Mult de carga';
      else if (T.phase === 'aim') hint = 'Apunta · mantén pulsado, arrastra atrás y suelta';
      else if (T.phase === 'rolling') hint = '...';
      if (hint) OM.FONT.draw(ctx, hint, hx, B.y + 12, { color: '6', align: 'center' });
      if (T.phase === 'aim') OM.FONT.draw(ctx, '← → / rueda: ajuste · Espacio: potencia · WASD: efecto', hx, B.y + 24, { color: '4', align: 'center' });
    }
    if (T.phase === 'aim' || T.phase === 'place' || T.charging || T.phase === 'strike') drawSpin(ctx, t);
    // intro de mesa
    if (T.intro > 0) {
      const a = Math.min(1, T.intro * 1.5);
      ctx.globalAlpha = a;
      const bw = 300, bx = (L.felt.x + L.felt.w / 2) - bw / 2, by = 150;
      OM.UI.panel(ctx, bx, by, bw, 64, T.boss ? 'blood' : 'dark');
      if (T.boss) {
        const bd = OM.bossDef(T.boss);
        OM.FONT.draw(ctx, bd.name.toUpperCase(), bx + bw / 2, by + 10, { color: 'c', size: 2, align: 'center', shadow: '0', wave: 1, t });
        OM.FONT.draw(ctx, bd.desc, bx + bw / 2, by + 34, { color: '7', align: 'center' });
        OM.FONT.draw(ctx, 'Objetivo: ' + OM.fmt(T.target), bx + bw / 2, by + 48, { color: 'd', align: 'center' });
      } else {
        OM.FONT.draw(ctx, OM.TABLE_KINDS[R.tableIdx].name.toUpperCase(), bx + bw / 2, by + 12, { color: '8', size: 2, align: 'center', shadow: '0' });
        OM.FONT.draw(ctx, 'Consigue ' + OM.fmt(T.target) + ' puntos en ' + T.shots + ' tiros', bx + bw / 2, by + 40, { color: '7', align: 'center' });
      }
      ctx.globalAlpha = 1;
    }
    // overlays
    if (T.phase === 'won') drawCashout(ctx, t);
    if (T.phase === 'lost') drawLost(ctx, t);
    if (T.showBalls) OM.HUD.drawBallsView(ctx, R, t, () => (T.showBalls = false));
    if (OM.HUD.picker) OM.HUD.drawPicker(ctx, R, t);
    if (T.paused) OM.drawPause(ctx, t, () => (T.paused = false));
  }

  // derrota: overlay con botón claro; se sale a 'gameover' una sola vez
  function drawLost(ctx, t) {
    const G = OM.G, a = Math.min(1, 1.8 - T.endT);
    ctx.globalAlpha = a * 0.7; ctx.fillStyle = OM.PAL['9']; ctx.fillRect(0, 0, OM.W, OM.H); ctx.globalAlpha = 1;
    const cx = L.felt.x + L.felt.w / 2, w = 240, h = 92, x = cx - w / 2, y = 132;
    ctx.globalAlpha = a; OM.UI.panel(ctx, x, y, w, h, 'blood'); ctx.globalAlpha = 1;
    OM.FONT.draw(ctx, 'SIN TIROS', cx, y + 10, { color: 'c', size: 2, align: 'center', shadow: '0', wave: 2, t });
    OM.FONT.draw(ctx, OM.fmt(T.score) + ' / ' + OM.fmt(T.target), cx, y + 36, { color: '7', align: 'center' });
    if (T.endT < 1 && !T.leaving && G.button(cx - 70, y + h - 30, 140, 20, 'VER RESULTADOS', 'red', false, 'Enter')) {
      T.leaving = true;
      OM.go('gameover', { reason: 'score', score: T.score, target: T.target, silent: true });
    }
  }

  function drawCashout(ctx, t) {
    const C = T.cashout, G = OM.G;
    C.t += 1 / 60;
    const w = 260, h = 70 + C.lines.length * 14 + 30, x = L.felt.x + L.felt.w / 2 - w / 2, y = 110;
    ctx.globalAlpha = Math.min(0.6, C.t * 2); ctx.fillStyle = OM.PAL['0']; ctx.fillRect(L.table.x, L.table.y, L.table.w, L.table.h); ctx.globalAlpha = 1;
    OM.UI.panel(ctx, x, y, w, h, 'gold');
    OM.FONT.draw(ctx, '¡MESA SUPERADA!', x + w / 2, y + 10, { color: 'i', size: 2, align: 'center', shadow: '0', wave: 1, t });
    OM.FONT.draw(ctx, OM.fmt(T.score) + ' / ' + OM.fmt(T.target), x + w / 2, y + 32, { color: '7', align: 'center' });
    C.lines.forEach((l, i) => {
      if (C.t < 0.3 + i * 0.25) return;
      if (!l.shown) { l.shown = true; OM.sfx('coin', { pitch: 1 + i * 0.1 }); }
      const yy = y + 50 + i * 14;
      OM.FONT.draw(ctx, l.label, x + 16, yy, { color: '7' });
      OM.FONT.draw(ctx, '+$' + l.v, x + w - 16, yy, { color: 'h', align: 'right' });
    });
    const ready = C.t > 0.3 + C.lines.length * 0.25;
    if (ready && G.button(x + w / 2 - 60, y + h - 24, 120, 18, 'COBRAR $' + C.total, 'gold', false, 'Enter')) collect();
  }
  // depuración / playtest automatizado
  OM.dbg = () => T && { balls: T.W.balls, phase: T.phase, T };
})();
