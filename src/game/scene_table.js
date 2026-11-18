// 8 — escena de mesa del 1v1: turnos (humano, bot o rival online), apuntar, efecto, elevación,
// simulación, puntuación animada y final de partida. Las reglas viven en OM.Match.
window.OM = window.OM || {};
OM.SCENES = OM.SCENES || {};

(function () {
  const L = OM.LAYOUT, F = L.felt, MT = OM.Match, PH = OM.Physics;
  const PCOL = ['q', 'v'];
  const MID = { x: F.x + F.w / 2, y: F.y + F.h / 2 };
  const FUSE = { x: F.x + 24, y: L.table.y + 7 }; // mecha del CAOS, sobre la banda de arriba
  let T = null; // estado de la mesa

  const S_ = () => OM.S;
  const cueBall = () => MT.cueBall(T.W);
  const online = () => OM.NET.on;
  const ctl = () => S_().players[S_().M.turn].kind; // 'human' | 'bot' | 'remote'
  const idle = () => T.phase === 'aim' || T.phase === 'place';

  OM.SCENES.table = {
    drawsFX: true,
    enter() {
      const S = S_();
      MT.startMatch(S);
      T = {
        W: MT.buildWorld(S), phase: 'intro', intro: S.caos ? 7 : 3.2, introMax: S.caos ? 7 : 3.2, angle: 0, power: 0, charging: false, strike: 0, strikePow: 0,
        spin: { f: 0, s: 0 }, elev: 0, cur: null, out: null, play: null, shooter: S.M.turn, turnShown: S.M.turn,
        shown: [S.players[0].points, S.players[1].points], pts: 0, mult: 1, multStr: '1', shotName: '', shotColor: '7', bump: { c: 0, m: 0 },
        paused: false, help: false, lastHit: 0, glow: null, bot: null, clock: 15, aimSend: 0, syncBuf: null, after: null,
        end: null, mods: MT.mods(S, S.M.turn), guideKey: '', guide: null, bumpFx: {}, banner: null, leaving: false, t0: OM.time,
        // MODO CAOS: tienda desplegable, acciones propias aún sin confirmar (online), bot que compra fuera de turno, aviso de mesa nueva
        caos: S.caos ? { open: false, pending: [], note: null, botT: 3, cond: null, fly: [], tray: {}, closeT: 0, hov: null } : null,
      };
      OM.FX.clear(); OM.HUD.sel = null;
      OM.music(S.M.obstacles.length ? 'boss' : 'table');
      if (S.M.obstacles.length) { setTimeout(() => OM.sfx('boss'), 400); OM.FX.flash('a', 0.3, 0.6); }
      try { OM.AUDIO.intensity(S.matchIdx / 4); } catch (e) {}
    },
    update(dt, t) {
      const S = S_(), IN = OM.IN, W = T.W;
      T.bump.c = Math.max(0, T.bump.c - dt * 5); T.bump.m = Math.max(0, T.bump.m - dt * 5);
      for (const k in T.bumpFx) T.bumpFx[k] = Math.max(0, T.bumpFx[k] - dt * 4);
      if (T.banner) { T.banner.t -= dt; if (T.banner.t <= 0) T.banner = null; }
      netPoll();
      if (IN.kp.Escape && T.phase !== 'end' && !T.charging) { if (T.help) T.help = false; else T.paused = !T.paused; }
      const frozen = (T.paused || T.help) && !online(); // el online no se puede pausar
      if (frozen) return;
      const block = T.paused || T.help; // con menú abierto no se leen los mandos
      if (T.phase !== 'scoring') for (let i = 0; i < 2; i++) {
        const tg = S.players[i].points;
        T.shown[i] += (tg - T.shown[i]) * Math.min(1, dt * 6);
        if (Math.abs(tg - T.shown[i]) < 1) T.shown[i] = tg;
      }
      if (T.phase === 'intro') {
        T.intro -= dt;
        if (T.intro <= 0 || (T.intro < T.introMax - 0.6 && (IN.kp.Enter || IN.kp.Space || (IN.released && !IN.consumed)))) { IN.consumed = true; beginTurn(); }
      } else if (T.phase === 'place') { if (!block || ctl() !== 'human') updatePlace(dt); }
      else if (T.phase === 'aim') { if (!block || ctl() !== 'human') updateAim(dt); }
      else if (T.phase === 'strike') { T.strike -= dt; if (T.strike <= 0) doShoot(); }
      else if (T.phase === 'rolling' || T.phase === 'quake') updateRolling(dt);
      else if (T.phase === 'scoring') updateScoring(dt);
      else if (T.phase === 'wait') { if (T.syncBuf) settle(); }
      tickClock(dt);
      if (T.caos) updateCaos(dt);
      if (T.phase !== 'rolling' && T.phase !== 'quake') PH.step(W, dt); // animaciones de caída
    },
    draw(ctx, t) { drawTable(ctx, t); },
  };

  // ---------------- red ----------------
  function netPoll() {
    if (!online()) return;
    const N = OM.NET, box = N.inbox;
    while (box.length) {
      const m = box[0];
      if (m.t === 'sync') { box.shift(); T.syncBuf = m; continue; }
      if (m.t === 'cop') { box.shift(); caosRemote(m.op); continue; } // CAOS: el rival compra en mi turno
      if (m.t === 'aim') {
        box.shift();
        if (idle() && ctl() === 'remote') {
          T.angle = m.a; T.power = m.p; T.charging = !!m.c; T.spin.f = m.f; T.spin.s = m.s; T.elev = m.e;
          if (T.phase === 'place') { const c = cueBall(); c.x = m.x; c.y = m.y; }
        }
        continue;
      }
      // mandos del rival: solo cuando esta mesa ya está esperando su jugada
      if (!idle() || ctl() !== 'remote') break;
      box.shift();
      if (m.t === 'place') actPlace(m.x, m.y);
      else if (m.t === 'shoot') actShoot({ angle: m.a, power: m.p, spin: { f: m.f, s: m.s }, elev: m.e });
      else if (m.t === 'joker') actJoker(m.i);
      else if (m.t === 'timeout') actTimeout();
    }
  }
  const send = (m) => { if (online() && ctl() === 'human') OM.NET.send(m); };
  // el que tira es la autoridad: tras cada tiro manda el estado completo; el otro cliente se ajusta a él
  function sendSync() {
    if (!online() || S_().players[T.shooter].kind !== 'human') return;
    const balls = PH.snap(T.W);
    PH.restore(T.W, balls); // mismas posiciones redondeadas en los dos clientes
    OM.NET.send({ t: 'sync', s: MT.serialize(S_()), balls });
  }
  function settle() {
    const S = S_();
    if (online() && S.players[T.shooter].kind === 'remote') {
      if (!T.syncBuf) { T.phase = 'wait'; return; }
      MT.applySync(S, T.syncBuf.s); PH.restore(T.W, T.syncBuf.balls); T.syncBuf = null;
      // CAOS: mis compras que el rival aún no había recibido se vuelven a aplicar encima de su estado
      if (T.caos && S.M.caos) {
        const C = S.M.caos;
        T.caos.pending = T.caos.pending.filter((op) => op.n >= C.ops[op.pi]);
        T.caos.pending.forEach((op) => MT.caosOp(S, op, T.W));
      }
    }
    const fn = T.after; T.after = null; fn();
  }

  // ---------------- turno ----------------
  function beginTurn() {
    const S = S_(), M = S.M, W = T.W;
    const fired = T.caos ? MT.caosTurnStart(S, W) : null; // CAOS: lo que compraste para tu turno se dispara ahora
    T.mods = MT.applyTurn(S, W);
    const changed = T.turnShown !== M.turn;
    T.turnShown = M.turn; T.shooter = M.turn;
    T.spin.f = T.spin.s = 0; T.elev = 0; T.power = 0; T.charging = false; // el efecto y la elevación se reinician en cada tiro
    T.clock = clockMax(); T.guideKey = '';
    let c = cueBall();
    if (M.inHand) {
      const dead = !c.alive, kitchen = M.inHand === 'kitchen';
      if (dead) { c.alive = true; c.sinking = false; c.sink = 0; c.vx = c.vy = 0; }
      if (dead || kitchen || !PH.freeSpot(W, c.x, c.y, c.r, c)) {
        let x = MT.HEAD_X - 30, y = MID.y, k = 0;
        while (!PH.freeSpot(W, x, y, c.r, c) && k++ < 200) { x = F.x + 12 + ((k * 37) % (kitchen ? 90 : F.w - 24)); y = F.y + 12 + ((k * 53) % (F.h - 24)); }
        c.x = x; c.y = y;
      }
      T.phase = 'place';
    } else T.phase = 'aim';
    // apuntar de entrada a la bola legal más cercana
    const tg = T.W.balls.filter((b) => b.alive && b.num !== 0 && MT.legalFirst(S, W, b.num)).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    if (tg) T.angle = Math.atan2(tg.y - c.y, tg.x - c.x);
    T.aimKey = true; T.lastMouse = { x: OM.IN.mx, y: OM.IN.my };
    T.bot = ctl() === 'bot' ? { t: (S.caos ? 1.6 : 0.7) + Math.random() * 0.6, plan: null, stage: 'think' } : null; // en el CAOS piensa más: deja comprar al rival
    if (changed) {
      const P = S.players[M.turn];
      T.banner = { text: 'TURNO DE ' + P.name.toUpperCase(), color: PCOL[M.turn], t: 1.3 };
      OM.sfx('card_flip');
      // CAOS: la tienda se abre sola en el turno del rival (salvo 2 jugadores en el mismo dispositivo) y se cierra en el tuyo
    }
    if (fired) fired.forEach((r, i) => flyCard(r.id, { x: L.jokers.x + 60, y: L.jokers.y }, trayPos(), false, () => useFx(r, M.turn, null), i * 0.25));
    if (T.caos && (changed || !T.caos.started)) { T.caos.started = true; const sp = caosShopper(); T.caos.open = sp >= 0 && !caosLocal2(); if (sp >= 0) OM.sfx('pack_open', { vol: 0.5 }); }
  }

  // ---------------- acciones (las produce el jugador local, el bot o la red) ----------------
  function actPlace(x, y) {
    const c = cueBall();
    c.x = x; c.y = y;
    S_().M.inHand = null;
    T.phase = 'aim'; T.guideKey = '';
    OM.sfx('click'); OM.FX.burst(c.x, c.y, 'dust', 6);
  }
  function actShoot(p) {
    T.params = p; T.angle = p.angle; T.spin = { f: p.spin.f, s: p.spin.s }; T.elev = p.elev;
    T.charging = false; T.phase = 'strike'; T.strike = 0.08; T.strikePow = p.power; T.power = p.power;
  }
  function actJoker(idx) {
    const S = S_(), me = S.M.turn, J = S.players[me].jokers[idx];
    const pos = J && OM.HUD.jokerPos(S, J.uid, T.turnShown);
    const r = MT.useActive(S, me, idx, T.W);
    if (!r) return;
    useFx(r, me, pos);
    if (T.bot) T.bot = { t: 0.9, plan: null, stage: 'think' };
  }
  // efectos de un activo usado por `me` (en su turno o, en el CAOS, en el del rival)
  function useFx(r, me, pos) {
    const S = S_(), kind = r.kind;
    OM.sfx('pack_open');
    if (pos) OM.FX.burst(pos.x, pos.y - 30, 'gold', 16);
    OM.FX.popText(MID.x, MID.y - 30, r.name.toUpperCase() + '!', 'u', { size: 2 });
    const say = (txt, col) => OM.FX.popText(MID.x, MID.y - 8, txt, col || 'v');
    if (kind === 'hand') { if (S.M.inHand) T.phase = 'place'; }
    else if (kind === 'bomb') say('PRÓXIMO TIRO: EXPLOSIVO');
    else if (kind === 'free') say('SI FALLAS, SIGUES TIRANDO');
    else if (kind === 'xshot') say('PRÓXIMO TIRO QUE EMBOQUE: x3 COMBO', 'c');
    else if (kind === 'rewind') say('SI EL TIRO SALE MAL, SE DESHACE', 'u');
    else if (kind === 'hex') { say('EL PRÓXIMO TIRO DEL RIVAL: TEMBLOR Y SIN GUÍA', 'c'); OM.FX.flash('a', 0.2, 0.3); OM.sfx('curse'); }
    else if (kind === 'boost') { T.mods = MT.applyTurn(S, T.W); T.guideKey = ''; say('¡TRONERAS GIGANTES!', 'm'); OM.FX.flash('m', 0.15, 0.25); }
    else if (kind === 'heist') {
      const b = boxPos(1 - me), a = boxPos(me);
      OM.FX.popText(b.x, b.y, '-' + OM.fmt(r.v), 'c', { size: 2 }); OM.FX.popText(a.x, a.y, '+' + OM.fmt(r.v), PCOL[me], { size: 2 });
      say('¡ROBA ' + OM.fmt(r.v) + ' PUNTOS!', 'h'); OM.sfx('coin'); OM.FX.shake(3, 0.25);
    } else if (kind === 'quake') {
      PH.quake(T.W, 260);
      T.cur = MT.freeCur(); T.phase = 'quake';
      OM.FX.shake(6, 0.7); OM.FX.flash('v', 0.25, 0.3); OM.sfx('explosion');
    } else if (kind === 'rush') { say('PRÓXIMO TIRO DEL RIVAL: 8 SEGUNDOS', 'c'); OM.sfx('curse'); }
    else if (kind === 'shrink') { say('PRÓXIMO TIRO DEL RIVAL: TRONERAS CHICAS', 'c'); OM.sfx('curse'); OM.FX.flash('a', 0.15, 0.25); }
    else if (kind === 'pickpocket') {
      const b = boxPos(1 - me), a = boxPos(me);
      OM.FX.popText(b.x, b.y + 12, '-$' + r.v, 'c', { size: 2 }); OM.FX.popText(a.x, a.y + 12, '+$' + r.v, 'i', { size: 2 });
      say('¡LE ROBA $' + r.v + '!', 'i'); OM.sfx('coin'); OM.FX.shake(2, 0.2);
    } else if (kind === 'tornado') {
      T.W.balls.forEach((b) => { if (b.alive && b.num !== 0) OM.FX.burst(b.x, b.y, 'smoke', 8); });
      say('¡TODO POR LOS AIRES!', 'u'); OM.FX.shake(7, 0.6); OM.FX.flash('u', 0.25, 0.35); OM.sfx('explosion');
    }
    refreshMods();
  }
  // vuelve a calcular los mandos del que tira si algo cambió a mitad de su turno (CAOS: compras del rival)
  function refreshMods() {
    if (!T || !idle()) return;
    T.mods = MT.applyTurn(S_(), T.W); T.guideKey = '';
    T.clock = Math.min(T.clock, clockMax());
  }

  // ---------------- colocar blanca ----------------
  function updatePlace(dt) {
    const IN = OM.IN, c = cueBall(), S = S_(), kind = ctl();
    const maxX = S.M.inHand === 'kitchen' ? MT.HEAD_X : F.x + F.w - c.r;
    if (kind === 'bot') {
      const B = T.bot; B.t -= dt;
      if (B.t > 0) return;
      if (!B.place) { B.place = OM.AI.place(S, T.W, S.players[S.M.turn].level); B.from = { x: c.x, y: c.y }; B.k = 0; }
      B.k = Math.min(1, B.k + dt * 2.5);
      const e = B.k * B.k * (3 - 2 * B.k);
      c.x = B.from.x + (B.place.x - B.from.x) * e; c.y = B.from.y + (B.place.y - B.from.y) * e;
      if (B.k >= 1) { actPlace(B.place.x, B.place.y); T.bot = { t: 0.5, plan: null, stage: 'think' }; }
      return;
    }
    if (kind !== 'human') return;
    const x = Math.min(Math.max(IN.mx, F.x + c.r), maxX), y = Math.min(Math.max(IN.my, F.y + c.r), F.y + F.h - c.r);
    if (OM.G.inside(L.table.x, L.table.y, L.table.w, L.table.h) && !OM.CHAT.over() && !caosOver()) {
      if (PH.freeSpot(T.W, x, y, c.r, c)) { c.x = x; c.y = y; }
      OM.G.cursor = 'grab';
      if (IN.released && !IN.consumed && PH.freeSpot(T.W, c.x, c.y, c.r, c)) { IN.consumed = true; send({ t: 'place', x: c.x, y: c.y }); actPlace(c.x, c.y); return; }
    }
    if (IN.kp.Enter || IN.kp.Space) { send({ t: 'place', x: c.x, y: c.y }); actPlace(c.x, c.y); return; }
    streamAim(dt);
  }
  function streamAim(dt) {
    if (!online()) return;
    T.aimSend -= dt;
    if (T.aimSend > 0) return;
    T.aimSend = 0.1;
    const c = cueBall();
    send({ t: 'aim', a: T.angle, p: T.power, c: T.charging ? 1 : 0, f: T.spin.f, s: T.spin.s, e: T.elev, x: c.x, y: c.y });
  }

  // ---------------- mandos: efecto y elevación ----------------
  const SPIN_UI = { x: L.bottom.x + L.bottom.w - 22, y: L.bottom.y + 20, r: 15 };
  const ELEV_UI = { x: L.bottom.x + L.bottom.w - 84, y: L.bottom.y + 34, r: 28, max: 80 * Math.PI / 180 };
  function updateSpin() {
    const IN = OM.IN, U = SPIN_UI, sp = T.spin;
    const step = 0.25, clamp = () => {
      const d = Math.hypot(sp.f, sp.s); if (d > 1) { sp.f /= d; sp.s /= d; }
      sp.f = Math.round(sp.f * 100) / 100; sp.s = Math.round(sp.s * 100) / 100;
    };
    if (IN.kp.KeyW) { sp.f += step; clamp(); OM.sfx('click'); }
    if (IN.kp.KeyS) { sp.f -= step; clamp(); OM.sfx('click'); }
    if (IN.kp.KeyA) { sp.s -= step; clamp(); OM.sfx('click'); }
    if (IN.kp.KeyD) { sp.s += step; clamp(); OM.sfx('click'); }
    if (IN.kp.KeyR) { sp.f = sp.s = 0; T.elev = 0; OM.sfx('click'); }
    const dx = IN.mx - U.x, dy = IN.my - U.y, inside = dx * dx + dy * dy <= (U.r + 3) * (U.r + 3);
    if (inside) {
      OM.G.cursor = 'grab';
      OM.G.tooltip(U.x - 70, L.bottom.y - 76, 'EFECTO', 'Dónde golpeas la blanca: arriba = {m}seguimiento{/}, abajo = {c}retroceso{/}, lados = efecto lateral. Con ELEVACIÓN, el efecto lateral curva el tiro (massé). Teclas W A S D. R: centro.', 'r');
      if (IN.rpressed) { sp.f = sp.s = 0; OM.sfx('click'); }
      if (IN.down) { sp.s = dx / U.r; sp.f = -dy / U.r; clamp(); IN.consumed = true; }
      if (IN.released) { OM.sfx('click'); IN.consumed = true; }
    }
    return inside;
  }
  function updateElev() {
    const IN = OM.IN, U = ELEV_UI;
    const set = (v) => { T.elev = Math.round(Math.min(1, Math.max(0, v)) * 20) / 20; };
    if (IN.kp.KeyE || IN.kp.ArrowUp) { set(T.elev + 0.1); OM.sfx('click'); }
    if (IN.kp.KeyQ || IN.kp.ArrowDown) { set(T.elev - 0.1); OM.sfx('click'); }
    const inside = OM.G.inside(U.x - 6, U.y - U.r - 4, U.r + 12, U.r + 8);
    if (inside) {
      OM.G.cursor = 'grab';
      OM.G.tooltip(U.x - 40, L.bottom.y - 88, 'ÁNGULO DE GOLPE', 'Levanta el taco. Con efecto LATERAL la blanca hace una curva ({u}massé{/}). Golpeando al CENTRO y fuerte, la blanca {u}salta{/} por encima de las bolas. Con efecto abajo, retrocede más (piqué). Teclas Q / E o flechas arriba / abajo.', 'u');
      if (IN.rpressed) { T.elev = 0; OM.sfx('click'); }
      if (IN.down) { set(Math.atan2(U.y - IN.my, Math.max(1, IN.mx - U.x)) / U.max); IN.consumed = true; }
      if (IN.wheel) { set(T.elev - IN.wheel * 0.05); IN.wheel = 0; }
      if (IN.released) { OM.sfx('click'); IN.consumed = true; }
    }
    return inside;
  }
  function drawControls(ctx, t) {
    const P = OM.PAL, sp = T.spin;
    // elevación: vista lateral del taco
    const U = ELEV_UI, a = T.elev * U.max;
    ctx.fillStyle = P['1']; ctx.fillRect(U.x - 6, U.y - U.r - 4, U.r + 12, U.r + 8);
    ctx.fillStyle = P['3']; ctx.fillRect(U.x - 4, U.y, U.r + 8, 1);
    for (let k = 0; k <= 4; k++) { const b = (k / 4) * U.max; ctx.fillStyle = P[k === 2 ? '6' : '4']; ctx.fillRect(Math.round(U.x + Math.cos(b) * U.r), Math.round(U.y - Math.sin(b) * U.r), 1, 1); }
    ctx.fillStyle = P['7']; ctx.beginPath(); ctx.arc(U.x, U.y - 3, 3, 0, Math.PI * 2); ctx.fill();
    const col = T.elev >= PH.JUMP_MIN ? 'u' : T.elev > 0.05 ? 'v' : 'g';
    for (let d = 5; d < U.r - 1; d++) {
      ctx.fillStyle = P[d > U.r - 6 ? col : d % 7 === 0 ? 'e' : 'g'];
      ctx.fillRect(Math.round(U.x + Math.cos(a) * d), Math.round(U.y - 3 - Math.sin(a) * d), 2, 2);
    }
    OM.FONT.draw(ctx, Math.round(T.elev * 80) + '°', U.x + U.r + 4, U.y - U.r - 2, { color: col === 'g' ? '6' : col, align: 'right' });
    // efecto: punto de impacto en la blanca
    const B = SPIN_UI;
    ctx.fillStyle = P['1']; ctx.beginPath(); ctx.arc(B.x, B.y, B.r + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P['7']; ctx.beginPath(); ctx.arc(B.x, B.y, B.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P['8']; ctx.beginPath(); ctx.arc(B.x - 4, B.y - 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P['6']; ctx.fillRect(B.x - B.r + 2, B.y, B.r * 2 - 4, 1); ctx.fillRect(B.x, B.y - B.r + 2, 1, B.r * 2 - 4);
    const px = Math.round(B.x + sp.s * (B.r - 3)), py = Math.round(B.y - sp.f * (B.r - 3));
    const c2 = sp.f > 0.05 ? 'm' : sp.f < -0.05 ? 'c' : sp.s ? 'q' : 'b';
    ctx.fillStyle = P['0']; ctx.fillRect(px - 3, py - 2, 7, 5); ctx.fillRect(px - 2, py - 3, 5, 7);
    ctx.fillStyle = P[c2]; ctx.fillRect(px - 2, py - 1, 5, 3); ctx.fillRect(px - 1, py - 2, 3, 5);
  }
  function controlLabel() {
    const sp = T.spin, parts = [];
    if (sp.f > 0.05) parts.push('{m}SEGUIR{/}'); else if (sp.f < -0.05) parts.push('{c}RETRO{/}');
    if (Math.abs(sp.s) > 0.05) parts.push('{q}' + (sp.s > 0 ? 'DERECHA' : 'IZQUIERDA') + '{/}');
    const tr = PH.trickOf(sp, T.elev);
    if (tr) parts.push('{u}' + { salto: '¡SALTO!', masse: '¡MASSÉ!', pique: 'PIQUÉ' }[tr] + '{/}');
    else if (T.elev > 0.05) parts.push('{v}ELEVADO{/}');
    return parts.join(' · ');
  }

  // ---------------- apuntar ----------------
  function inPlayArea() { const IN = OM.IN; return IN.my > 66 && IN.my < L.bottom.y - 2 && IN.mx > 186 && !OM.CHAT.over() && !caosOver(); }
  const shakeOff = () => (T.mods.shake && ctl() !== 'remote' ? (Math.sin(OM.time * 7.3) * 0.03 + Math.sin(OM.time * 13.1) * 0.014) * T.mods.shake : 0);
  const aimAngle = () => T.angle + (T.phase === 'aim' ? shakeOff() : 0);

  function updateAim(dt) {
    const IN = OM.IN, c = cueBall(), S = S_(), kind = ctl();
    if (kind === 'bot') return updateBot(dt);
    if (kind !== 'human') return;
    if (!T.charging) {
      const overCtl = T.mods.noSpin ? (T.spin.f = T.spin.s = T.elev = 0, false) : updateSpin() | updateElev();
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
      if (IN.pressed && inPlayArea() && !IN.consumed && !overCtl) {
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
      if (T.charging && (IN.rpressed || IN.kp.Escape)) { T.charging = false; T.power = 0; }
    }
    if (T.phase === 'aim') streamAim(dt);
    function release() {
      T.charging = false;
      if (T.power < 0.08) { T.power = 0; return; } // un clic sin arrastrar no tira
      fire(T.power);
    }
  }
  function fire(power) {
    const p = { angle: aimAngle(), power, spin: { f: T.spin.f, s: T.spin.s }, elev: T.elev };
    send({ t: 'shoot', a: p.angle, p: p.power, f: p.spin.f, s: p.spin.s, e: p.elev });
    actShoot(p);
  }

  // ---------------- reloj de tiro ----------------
  // Cada jugador tiene OM.POINTS.clock segundos por tiro (colocar + apuntar). Si se acaban es falta.
  // Con El Reloj son 15 s y el taco dispara solo. Solo lo hace cumplir el cliente del que tira.
  const clockMax = () => T.mods.clock || OM.POINTS.clock; // El Reloj y Prisa lo bajan a 15
  function tickClock(dt) {
    if (!idle() || ctl() === 'bot') return;
    const prev = T.clock; T.clock -= dt;
    if (Math.ceil(T.clock) !== Math.ceil(prev) && T.clock < 5 && T.clock > 0) OM.sfx('click', { pitch: 1.6 });
    if (T.clock > 0 || ctl() !== 'human') return;
    OM.FX.popText(MID.x, MID.y - 20, '¡TIEMPO!', 'c', { size: 2 });
    if (MT.hasObs(S_(), 'reloj') || T.mods.clock < OM.POINTS.clock || (T.charging && T.power >= 0.08)) {
      if (T.phase === 'place') { const c = cueBall(); send({ t: 'place', x: c.x, y: c.y }); actPlace(c.x, c.y); }
      fire(T.charging && T.power >= 0.08 ? T.power : Math.max(0.35, T.power || 0.5));
    } else { send({ t: 'timeout' }); actTimeout(); }
  }
  function actTimeout() {
    T.charging = false; T.power = 0;
    T.cur = MT.timeoutCur(S_(), T.W);
    finishShot();
  }

  function updateBot(dt) {
    const S = S_(), B = T.bot;
    B.t -= dt;
    if (B.t > 0) return;
    if (B.stage === 'think') {
      const pl = OM.AI.plan(S, T.W, S.players[S.M.turn].level);
      if (pl.joker != null) { actJoker(pl.joker); return; }
      B.plan = pl; B.stage = 'turn';
    }
    if (B.stage === 'turn') {
      let d = B.plan.angle - T.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
      T.angle += d * Math.min(1, dt * 7);
      if (Math.abs(d) < 0.004) { T.angle = B.plan.angle; B.stage = 'charge'; T.charging = true; T.power = 0; }
    } else if (B.stage === 'charge') {
      T.power = Math.min(B.plan.power, T.power + dt * 1.5);
      if (T.power >= B.plan.power) actShoot(B.plan);
    }
  }

  function doShoot() {
    const S = S_(), c = cueBall(), p = T.params, pw = p.power;
    T.cur = MT.beginShot(S, T.W, p);
    OM.sfx('cue_hit', { vol: 0.4 + pw * 0.6 });
    OM.FX.burst(c.x - Math.cos(p.angle) * 6, c.y - Math.sin(p.angle) * 6, 'dust', 4 + Math.round(pw * 8));
    if (pw > 0.85) OM.FX.shake(2, 0.15);
    if (T.cur.jumped) OM.FX.popText(c.x, c.y - 16, '¡ARRIBA!', 'u');
    T.phase = 'rolling'; T.power = 0;
  }

  // ---------------- simulación ----------------
  function updateRolling(dt) {
    const W = T.W, cur = T.cur;
    PH.step(W, dt);
    for (const e of W.events) {
      MT.track(cur, e);
      const pan = (e.x - 320) / 320;
      if (e.type === 'hit') {
        const vol = Math.min(1, e.speed / 600);
        if (OM.time - T.lastHit > 0.015 || vol > 0.5) { OM.sfx('clack', { vol: 0.15 + vol * 0.85, pan }); T.lastHit = OM.time; }
        if (e.speed > 250) OM.FX.burst(e.x, e.y, 'spark', 2 + Math.round(vol * 5));
        if (e.speed > 700) OM.FX.shake(1.5, 0.1);
        if (!cur.free && !cur.warned && cur.firstHit != null) {
          cur.warned = true;
          if (!cur.isBreak && !legalNum(cur.firstHit, cur)) OM.FX.popText(e.x, e.y - 12, '¡BOLA EQUIVOCADA!', 'c');
        }
      } else if (e.type === 'cushion') {
        if (e.speed > 30) OM.sfx('cushion', { vol: Math.min(1, e.speed / 600), pan });
      } else if (e.type === 'bumper') {
        OM.sfx('clack', { vol: Math.min(1, 0.3 + e.speed / 500), pitch: 1.7, pan });
        OM.FX.burst(e.x, e.y, 'spark', 6); T.bumpFx[W.bumpers.indexOf(e.bumper)] = 1;
      } else if (e.type === 'portal') {
        OM.sfx('xmult', { vol: 0.5, pitch: 1.5 }); OM.FX.burst(e.x, e.y, 'smoke', 8, { color: 'r' }); OM.FX.burst(e.tx, e.ty, 'smoke', 8, { color: 'v' });
      } else if (e.type === 'hop') {
        if (e.ball.num === 0) { OM.FX.popText(e.x, e.y - 14, '¡SALTO!', 'u'); OM.FX.burst(e.x, e.y, 'spark', 6, { color: 'u' }); OM.sfx('mult', { pitch: 1.4, vol: 0.5 }); }
      } else if (e.type === 'land') {
        OM.FX.burst(e.x, e.y, 'dust', 8); OM.sfx('cushion', { vol: 0.5, pitch: 0.7, pan });
      } else if (e.type === 'explosion') {
        OM.FX.burst(e.x, e.y, 'explosion', 30); OM.FX.shake(5, 0.35); OM.FX.flash('v', 0.3, 0.2); OM.sfx('explosion');
      } else if (e.type === 'pocket') {
        const b = e.ball;
        OM.sfx('pocket', { vol: 0.5 + Math.min(0.5, e.speed / 800), pan });
        OM.FX.burst(e.x, e.y, 'pocket', 14);
        const fin = b.num === (S_().M.mode === '8' ? 8 : 9);
        T.glow = { p: e.pocket, t: 0.6, color: b.num === 0 ? 'c' : fin ? 'i' : 'h' };
        if (b.num === 0) { OM.sfx('scratch'); OM.FX.popText(e.x, e.y - 10, '¡BLANCA DENTRO!', 'c'); }
        else {
          const n = cur.pocketed.length;
          OM.FX.popText(e.x, e.y - 12, fin ? '¡LA ' + b.num + '!' : n > 1 ? 'x' + n + '!' : '¡DENTRO!', fin ? 'i' : n > 1 ? 'n' : '8');
          OM.FX.burst(e.x, e.y, b.kind === 'oro' || fin ? 'gold' : 'ember', fin ? 16 : 6);
          if (n > 1) OM.FX.shake(1 + n, 0.15);
        }
      } else if (e.type === 'token') {
        OM.FX.burst(e.x, e.y, 'gold', 24); OM.FX.popText(e.x, e.y - 12, '¡BOLSA DEL DIABLO!', 'i'); OM.sfx('coin', { pitch: 1.4 }); OM.FX.shake(2, 0.15);
      } else if (e.type === 'ghostBounce') {
        OM.FX.burst(e.x, e.y, 'smoke', 10); OM.sfx('curse', { vol: 0.4 });
      }
    }
    W.events.length = 0;
    if (!PH.moving(W)) { if (T.phase === 'quake') finishQuake(); else finishShot(); }
  }
  // ¿era legal tocar primero esa bola? (con el estado de antes del tiro)
  function legalNum(num, cur) {
    const M = S_().M;
    if (M.mode === '9') return num === cur.lowest;
    const g = MT.groupOf(num);
    if (M.open) return g !== 'eight';
    const mine = cur.before.some((n) => MT.groupOf(n) === M.groups[cur.me]);
    return mine ? g === M.groups[cur.me] : g === 'eight';
  }

  function finishShot() {
    const S = S_();
    T.shooter = S.M.turn;
    T.out = MT.resolve(S, T.W, T.cur); // muta S: puntos, grupos, turno
    sendSync();
    // el CAOS no va de puntos: solo se animan los avisos, el dinero y el nombre del tiro
    if (S.caos) T.out.events = T.out.events.filter((e) => e.k === 'msg' || e.k === 'cash' || e.k === 'rcash' || e.k === 'type');
    T.play = { i: 0, timer: 0.25, events: T.out.events, done: false };
    T.pts = 0; T.mult = 1; T.multStr = '1'; T.shotName = ''; T.shotColor = '7';
    T.phase = 'scoring';
  }
  function finishQuake() {
    const S = S_();
    T.shooter = S.M.turn;
    const q = MT.resolveQuake(S, T.W, T.cur);
    q.back.forEach((n, i) => OM.FX.popText(MT.FOOT.x, MT.FOOT.y - 14 - i * 10, 'VUELVE LA ' + n, '7'));
    q.own.forEach((p) => { OM.FX.popText(p.pocket.x, p.pocket.y - 10, '+' + q.each, PCOL[T.shooter]); OM.FX.burst(p.pocket.x, p.pocket.y, 'gold', 10); });
    if (q.v) OM.sfx('chips');
    sendSync();
    T.after = () => { const b = T.bot; beginTurn(); if (b && T.bot) T.bot.t = 0.8; };
    settle();
  }

  function evPos(src) {
    if (src && src.type === 'joker') { const p = OM.HUD.jokerPos(S_(), src.uid, T.turnShown); if (p) return p; }
    if (src && src.type === 'ball') return { x: Math.min(Math.max(src.x, F.x + 14), F.x + F.w - 14), y: Math.min(Math.max(src.y, F.y + 14), F.y + F.h - 12) };
    return { x: MID.x, y: F.y + 40 };
  }
  const fmtMult = (m) => (Math.abs(m - Math.round(m)) < 0.01 ? OM.fmt(m) : (Math.round(m * 100) / 100).toString());
  const boxPos = (pi) => ({ x: L.panel.x + 120, y: L.panel.y + 70 + pi * 68 });

  function updateScoring(dt) {
    const P = T.play, S = S_(), me = T.shooter, rv = 1 - me;
    P.timer -= dt;
    if (P.timer > 0) return;
    if (P.i < P.events.length) {
      const e = P.events[P.i++];
      const p = evPos(e.src);
      P.timer = Math.max(0.08, 0.24 - P.i * 0.012);
      const pitch = 1 + Math.min(1.2, P.i * 0.06);
      switch (e.k) {
        case 'type':
          T.shotName = e.v; T.shotColor = e.n >= 4 ? 'c' : e.n >= 2 ? 'i' : '8';
          T.mult = e.mult; T.multStr = fmtMult(T.mult); T.bump.m = e.n >= 2 ? 1.4 : 0.6;
          if (e.n >= 2) { OM.FX.popText(MID.x, MID.y - 22, e.v, T.shotColor, { size: 2, scale: e.n >= 3 ? 2 : 1 }); OM.FX.shake(1 + e.n, 0.25); OM.FX.flash(e.n >= 4 ? 'c' : 'h', 0.18, 0.2); OM.sfx('xmult', { pitch: 0.8 + e.n * 0.15 }); }
          else OM.sfx('card_flip');
          P.timer = e.n >= 2 ? 0.5 : 0.25;
          break;
        case 'pts': T.pts += e.v; T.bump.c = 1; OM.FX.popText(p.x, p.y, '+' + OM.fmt(e.v), 'q'); OM.sfx('chips', { pitch }); break;
        case 'mult': T.mult += e.v; T.multStr = fmtMult(T.mult); T.bump.m = 1; OM.FX.popText(p.x, p.y, '+' + e.v + ' Combo', 'c'); OM.sfx('mult', { pitch }); break;
        case 'xmult': T.mult *= e.v; T.multStr = fmtMult(T.mult); T.bump.m = 1.6; OM.FX.popText(p.x, p.y, 'x' + (Math.round(e.v * 100) / 100), 'c', { size: 2 }); OM.sfx('xmult', { pitch }); OM.FX.shake(2, 0.15); P.timer += 0.08; break;
        case 'steal': { const b = boxPos(rv); OM.FX.popText(p.x, p.y - 8, 'ROBA ' + e.v, 'h'); OM.FX.popText(b.x, b.y, '-' + e.v, 'c'); OM.sfx('coin', { pitch }); break; }
        case 'rpts': { const b = boxPos(rv); if (e.src) OM.FX.popText(p.x, p.y, '+' + e.v, PCOL[rv]); OM.FX.popText(b.x, b.y, '+' + e.v, PCOL[rv], { size: 2 }); OM.sfx('coin'); break; }
        case 'pen': OM.FX.popText(MID.x, MID.y + 22, String(e.v), 'c', { size: 2 }); break;
        case 'cash': OM.FX.popText(p.x, p.y + 10, (e.label ? e.label + ' ' : '') + '+$' + e.v, 'i', { size: e.label ? 2 : 1 }); OM.sfx('coin', { pitch: 1.3 }); break;
        case 'rcash': { const b = boxPos(rv); OM.FX.popText(b.x, b.y + 12, '+$' + e.v, 'i'); OM.sfx('coin'); break; }
        case 'msg':
          OM.FX.popText(e.src ? p.x : MID.x, e.src ? p.y - 10 : MID.y, e.v, e.color || '8', { size: e.big || !e.src ? 2 : 1 });
          if (e.bad) { OM.sfx('lose', { vol: 0.5 }); OM.FX.flash('a', 0.3, 0.35); OM.FX.shake(3, 0.3); P.timer = 0.7; }
          else { OM.sfx(e.big ? 'level_up' : 'card_flip', { pitch }); if (e.big) P.timer = 0.45; }
          break;
        case 'total': {
          const total = e.v;
          if (total > 0) {
            const big = total >= 600;
            OM.FX.popText(MID.x, MID.y + 10, '+' + OM.fmt(total), big ? 'i' : '8', { size: 2, scale: big ? 2 : 1 });
            OM.sfx('score_total', { pitch: big ? 1.2 : 1 });
            if (big) { OM.FX.shake(4, 0.35); OM.FX.burst(MID.x, MID.y, 'ember', 40); }
            if (S.players[me].kind === 'human' && total > OM.META.bestShot) { OM.META.bestShot = total; OM.saveMeta(); }
          }
          P.timer = total > 0 ? 0.8 : 0.35;
          break;
        }
      }
      return;
    }
    T.after = afterShot;
    settle();
  }

  function afterShot() {
    const S = S_(), out = T.out;
    // las bolas que el juez devolvió a la mesa
    if (out.rewound) { OM.FX.flash('u', 0.3, 0.4); OM.sfx('curse'); }
    out.respot.forEach((n) => { const b = T.W.balls.find((o) => o.num === n); if (b) { OM.FX.burst(b.x, b.y, 'smoke', 12); OM.FX.popText(b.x, b.y - 14, 'VUELVE LA ' + n, '7'); } });
    if (out.foul) OM.CHAT.event('foul', T.shooter);
    else if (out.total >= 600 || out.events.some((e) => e.k === 'type' && e.n >= 2)) OM.CHAT.event('big', T.shooter);
    if (S.M.winner != null) { endMatch(); return; }
    if (out.caos) caosTurnFx(out.caos);
    if (out.fuse) { OM.FX.burst(FUSE.x + OM.CAOS.fuse * 24 + 5, FUSE.y + 2, 'ember', 30); OM.FX.flash('c', 0.25, 0.3); OM.sfx('curse', { pitch: 0.8 }); }
    if (out.rally != null && T.caos) {
      // tacada larga: la tienda del que espera se recarga de trampas
      OM.FX.flash('a', 0.2, 0.3); OM.sfx('curse', { pitch: 1.3 });
      OM.FX.burst(CONSUM_C.x, CONSUM_C.y + 20, 'ember', 20);
      if (caosShopper() === out.rally && !caosLocal2()) { T.caos.open = true; T.caos.closeT = 0; }
    }
    if (out.foul && S.M.inHand === 'any') OM.FX.popText(MID.x, MID.y + 40, 'BOLA EN MANO PARA ' + S.players[S.M.turn].name.toUpperCase(), PCOL[S.M.turn], { size: 2 });
    else if (out.cont && S.M.streak[S.M.turn] >= 2) OM.FX.popText(MID.x, MID.y + 36, '¡SIGUE! TACADA x' + (S.M.streak[S.M.turn] + 1), 'v');
    beginTurn();
  }

  function endMatch() {
    const S = S_(), M = S.M;
    T.phase = 'end'; T.end = { t: 0 }; T.turnShown = M.winner;
    S.players.forEach((P) => P.jokers.forEach((J) => (OM.META.seen[J.id] = 1)));
    OM.saveMeta();
    const human = S.players[M.winner].kind === 'human';
    OM.sfx(human || S.players.every((p) => p.kind !== 'human') ? 'win_table' : 'lose');
    OM.FX.burst(MID.x, MID.y, 'gold', 40); OM.FX.flash(PCOL[M.winner], 0.25, 0.4);
    OM.CHAT.event('win', M.winner);
    try { OM.AUDIO.intensity(0); } catch (e) {}
  }
  function leave() {
    const S = S_();
    if (T.leaving) return;
    T.leaving = true;
    if (S.done) OM.go('final');
    else OM.go('shop', { next: true });
  }

  // ---------------- dibujo ----------------
  // Espejismo: la guía del que lo sufre sale torcida (hacia un lado distinto en cada tiro)
  const lieOff = () => (T.mods.lie ? T.mods.lie * (S_().M.shotIdx % 2 ? 1 : -1) : 0);
  function guide() {
    const S = S_(), c = cueBall(), m = T.mods, ang = aimAngle() + lieOff();
    const pw = T.phase === 'strike' ? T.strikePow : T.charging ? Math.max(0.12, T.power) : 0.6;
    const g = m.guide;
    const key = [ang.toFixed(4), pw.toFixed(2), T.spin.f, T.spin.s, T.elev, c.x.toFixed(1), c.y.toFixed(1), T.W.shots, g].join('|');
    if (key !== T.guideKey) {
      T.guideKey = key;
      const maxLen = (g >= 2 ? 900 : g === 1 ? 380 : 60) * m.guideLen;
      const tr = PH.predict(T.W, c, ang, MT.shotSpeed(pw, m), T.spin, T.elev, { maxBounces: g >= 2 ? 2 : 0, maxLen, trickMul: m.trickMul });
      if (g === 0) { tr.ghost = null; tr.target = null; }
      // tramos (los portales cortan la línea)
      tr.segs = []; let seg = [];
      tr.pts.forEach((p) => { if (p.brk) { if (seg.length > 1) tr.segs.push(seg); seg = []; } seg.push(p); });
      if (seg.length > 1) tr.segs.push(seg);
      T.guide = tr;
    }
    return T.guide;
  }

  function drawObstacles(ctx, t) {
    const W = T.W, P = OM.PAL;
    if (W.vortex) {
      const V = W.vortex;
      for (let i = 0; i < 46; i++) {
        const k = ((i * 0.137 + t * 0.12) % 1), r = V.r * (1 - k), a = i * 2.4 + k * 5 + t * 0.6;
        ctx.globalAlpha = 0.25 + k * 0.6; ctx.fillStyle = P[i % 3 === 0 ? 'u' : i % 3 === 1 ? 't' : 's'];
        ctx.fillRect(Math.round(V.x + Math.cos(a) * r), Math.round(V.y + Math.sin(a) * r), k > 0.6 ? 2 : 1, k > 0.6 ? 2 : 1);
      }
      ctx.globalAlpha = 0.6; ctx.fillStyle = P['0']; ctx.beginPath(); ctx.arc(V.x, V.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (W.portals) W.portals.forEach((p, i) => {
      const col = i ? ['v', 'h', 'd'] : ['r', 'q', '8'];
      ctx.fillStyle = P['0']; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.fillStyle = P[col[1]]; ctx.beginPath(); ctx.arc(p.x, p.y, p.r - 3 + Math.sin(t * 4 + i) * 1.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      for (let k = 0; k < 12; k++) {
        const a = t * (i ? -3 : 3) + k * Math.PI / 6;
        ctx.fillStyle = P[col[k % 3]];
        ctx.fillRect(Math.round(p.x + Math.cos(a) * p.r), Math.round(p.y + Math.sin(a) * p.r), 2, 2);
      }
    });
    W.bumpers.forEach((b, i) => {
      const fx = T.bumpFx[i] || 0, r = b.r + fx * 2;
      ctx.globalAlpha = 0.4; ctx.fillStyle = P['0']; ctx.beginPath(); ctx.arc(b.x + 2, b.y + 3, r + 1, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = P['0']; ctx.beginPath(); ctx.arc(b.x, b.y, r + 1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P[fx > 0.2 ? 'i' : '6']; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P[fx > 0.2 ? '8' : '7']; ctx.beginPath(); ctx.arc(b.x - 1, b.y - 1, r - 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P['0']; ctx.fillRect(b.x - 3, b.y - 2, 2, 2); ctx.fillRect(b.x + 1, b.y - 2, 2, 2); ctx.fillRect(b.x - 1, b.y + 1, 2, 1); // calavera
    });
  }

  function drawTable(ctx, t) {
    const S = S_(), M = S.M, W = T.W, G = OM.G;
    const theme = MT.theme(S);
    const sh = OM.FX.shakeOffset();
    ctx.save();
    OM.TABLE.drawBackdrop(ctx, theme, t);
    ctx.translate(Math.round(sh.x), Math.round(sh.y));
    OM.TABLE.drawTable(ctx, theme, t, { sealedSides: W.sealedSides, pocketScale: Math.round((W.pockets[0].r / L.pocketR) * 20) / 20 });
    if (T.glow) { T.glow.t -= 1 / 60; if (T.glow.t > 0) OM.TABLE.drawPocketGlow(ctx, T.glow.p, t, T.glow.color); else T.glow = null; }
    drawObstacles(ctx, t);
    if (W.tokens && T.phase !== 'end') W.tokens.forEach((k) => drawBag(ctx, k, t));
    // línea de cabecera cuando hay que colocar detrás
    if (T.phase === 'place' && M.inHand === 'kitchen') {
      ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.2; ctx.fillStyle = OM.PAL['7'];
      for (let y = F.y + 2; y < F.y + F.h; y += 4) ctx.fillRect(MT.HEAD_X, y, 1, 2);
      ctx.globalAlpha = 1;
    }
    // marca las bolas legales del que tira (ayuda a leer la mesa de un vistazo)
    const showAim = idle() && !T.paused;
    if (showAim && !M.breakShot) {
      const pulse = 0.35 + 0.25 * Math.sin(t * 5);
      for (const b of W.balls) if (b.alive && b.num !== 0 && MT.legalFirst(S, W, b.num)) {
        ctx.globalAlpha = pulse; ctx.strokeStyle = OM.PAL[PCOL[M.turn]]; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5, b.r + 2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // bolas
    for (const b of W.balls) if (b.alive) OM.TABLE.drawBallShadow(ctx, Math.round(b.x + b.z * 0.4), Math.round(b.y + b.z * 0.5));
    for (const b of W.balls) {
      if (!b.alive && !b.sinking) continue;
      if (b.sinking) {
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - b.sink);
        const s = 1 - b.sink * 0.5;
        ctx.translate(b.x, b.y); ctx.scale(s, s);
        OM.TABLE.drawBall(ctx, b, 0, 0, t);
        ctx.restore();
      } else if (b.z > 0.5) {
        b.scale = 1 + b.z / 36; OM.TABLE.drawBall(ctx, b, Math.round(b.x), Math.round(b.y - b.z * 0.9), t); b.scale = undefined;
      } else OM.TABLE.drawBall(ctx, b, Math.round(b.x), Math.round(b.y), t);
    }
    const c = cueBall();
    // guía + taco
    if (c && c.alive && (T.phase === 'aim' || T.phase === 'strike') && !T.paused) {
      const g = T.mods.guide, tr = guide(), ang = aimAngle();
      const opts = {};
      if (tr.ghost) {
        const ol = (g >= 2 ? 90 : 36) * Math.max(0.25, tr.objDir.k) * T.mods.guideLen, cl = (g >= 2 ? 60 : 30) * tr.cueDir.k;
        opts.objPath = [{ x: tr.target.x, y: tr.target.y }, { x: tr.target.x + tr.objDir.x * ol, y: tr.target.y + tr.objDir.y * ol }];
        if (cl > 3) opts.cuePath = [{ x: tr.ghost.x, y: tr.ghost.y }, { x: tr.ghost.x + tr.cueDir.x * cl, y: tr.ghost.y + tr.cueDir.y * cl }];
      }
      tr.segs.forEach((seg, i) => OM.TABLE.drawAim(ctx, seg, i === tr.segs.length - 1 ? tr.ghost : null, t, i === tr.segs.length - 1 ? opts : {}));
      // arco del salto
      ctx.fillStyle = OM.PAL.u;
      tr.pts.forEach((p, i) => { if (p.z > 1 && i % 2 === 0) ctx.fillRect(Math.round(p.x), Math.round(p.y - p.z * 0.9), 2, 2); });
      if (tr.scratch) OM.FONT.draw(ctx, '¡CUIDADO!', Math.round(tr.pts[tr.pts.length - 1].x), Math.round(tr.pts[tr.pts.length - 1].y) - 14, { color: 'c', align: 'center', outline: '0' });
      if (tr.target && tr.target.num && !MT.legalFirst(S, W, tr.target.num)) {
        OM.FONT.draw(ctx, '¡FALTA!', Math.round(tr.target.x), Math.round(tr.target.y) - 17, { color: 'c', align: 'center', outline: '0' });
      }
      const pow = T.phase === 'strike' ? T.strikePow : T.power;
      const pull = T.phase === 'strike' ? -2 + (T.strike / 0.08) * (4 + pow * 26) : 4 + pow * 26;
      const lift = 1 - T.elev * 0.45; // el taco elevado se ve más corto
      OM.TABLE.drawCue(ctx, S.players[M.turn].cue, c.x - Math.cos(ang) * (c.r + 1), c.y - Math.sin(ang) * (c.r + 1) - T.elev * 5, ang, pull * lift, t);
    }
    if ((MT.hasObs(S, 'niebla') || T.mods.fog) && c && T.phase !== 'end' && T.phase !== 'intro') OM.TABLE.drawFog(ctx, c.x, c.y, 66, t);
    OM.FX.draw(ctx);
    ctx.restore();

    // ---- HUD ----
    const me = T.turnShown, P = S.players[me];
    const lines = [];
    if (T.phase !== 'end' && T.phase !== 'intro') {
      lines.push({ text: (idle() || T.phase === 'strike' ? 'TIRA ' : '') + P.name.toUpperCase() + (idle() ? ': ' + MT.goal(S, W) : ''), color: PCOL[me] });
      const st = M.streak[M.turn];
      const fx = M.fx, arm = [fx.bomb && 'DINAMITA', fx.rewind && 'MARCHA ATRÁS', fx.free && 'TIRO GRATIS', fx.boost === M.turn && 'BOCA DEL INFIERNO', fx.xshot[M.turn] && 'GRAN GOLPE', fx.hex === M.turn && 'VUDÚ', fx.rush === M.turn && 'RELOJ DE ARENA', fx.shrink === M.turn && 'SABOTAJE'].filter(Boolean);
      const cursed = fx.hex === M.turn || fx.rush === M.turn || fx.shrink === M.turn;
      lines.push(arm.length ? { text: arm.join(' + '), color: cursed ? 'c' : 'v' } : st > 0 && idle() ? { text: 'TACADA x' + (st + 1) + ' · +' + Math.min(OM.POINTS.streakCap, st) + ' Combo', color: 'v' } : null);
      if (M.mode === '8') lines.push(M.inHand && idle() ? { text: 'BOLA EN MANO', color: 'm' } : null);
      if (online()) lines.push({ text: OM.NET.peer ? 'ONLINE · sala ' + OM.NET.code : 'RIVAL DESCONECTADO', color: OM.NET.peer ? '5' : 'c' });
      else if (ctl() === 'bot' && idle()) lines.push({ text: 'el bot está pensando...', color: '5' });
    }
    OM.HUD.drawPanel(ctx, S, t, {
      W, turn: T.phase === 'intro' ? -1 : me, shown: T.shown, shotName: T.shotName, shotColor: T.shotColor, pts: T.pts, multStr: T.multStr, bump: T.bump, lines,
      buttons(y) {
        if (G.button(L.panel.x + 8, y, 80, 16, 'AYUDA', 'blue')) T.help = true;
        if (G.button(L.panel.x + 92, y, 80, 16, 'MENÚ', 'dark', T.phase === 'end')) T.paused = true;
      },
    });
    const mine = ctl() === 'human' && T.phase === 'aim' && !T.charging;
    OM.HUD.drawJokers(ctx, S, me, t, {
      locked: T.paused || T.help || T.phase === 'end',
      canUse: (i) => mine && MT.canUse(S, me, i),
      onUse: (i) => { send({ t: 'joker', i }); actJoker(i); },
    });
    OM.HUD.drawRivalJokers(ctx, S, 1 - me, t);

    // barra inferior
    const B = L.bottom, hx = B.x + (B.w - 130) / 2;
    if (T.charging || T.phase === 'strike') {
      const pw = T.phase === 'strike' ? T.strikePow : T.power;
      OM.FONT.draw(ctx, 'POTENCIA', B.x + 8, B.y + 12, { color: '7' });
      OM.UI.bar(ctx, B.x + 64, B.y + 10, 210, 10, pw, pw > 0.85 ? 'c' : pw > 0.5 ? 'v' : 'h');
      OM.FONT.draw(ctx, Math.round(pw * 100) + '%', B.x + 282, B.y + 12, { color: '8' });
      const cl = controlLabel(); if (cl) OM.FONT.draw(ctx, cl, B.x + 8, B.y + 26, { color: '6' });
    } else {
      let hint = '', hint2 = '';
      const human = ctl() === 'human';
      if (T.phase === 'place') hint = human ? 'BOLA EN MANO · clic para colocar la blanca' + (M.inHand === 'kitchen' ? ' (detrás de la línea)' : '') : P.name + ' coloca la blanca...';
      else if (T.phase === 'aim') {
        hint = human ? (M.breakShot ? 'SAQUE · arrastra hacia atrás y suelta' : 'Apunta, arrastra hacia atrás y suelta') : P.name + ' está apuntando...';
        hint2 = human ? (controlLabel() || '← → ajuste · WASD efecto · Q/E ángulo de golpe · Espacio potencia') : '';
      } else if (T.phase === 'wait') hint = 'Esperando al rival...';
      if (hint) OM.FONT.draw(ctx, hint, hx, B.y + 10, { color: '7', align: 'center' });
      if (hint2) OM.FONT.draw(ctx, hint2, hx, B.y + 24, { color: hint2.includes('{') ? '6' : '4', align: 'center' });
    }
    if (idle() && ctl() !== 'bot' && (MT.hasObs(S, 'reloj') || T.clock <= 10)) {
      const s = Math.max(0, Math.ceil(T.clock));
      OM.FONT.draw(ctx, String(s), F.x + F.w / 2, F.y - 15, { color: s <= 5 ? 'c' : '8', size: 2, align: 'center', shadow: '0' });
    }
    if (T.mods.noSpin && (idle() || T.charging)) OM.FONT.draw(ctx, 'GRILLETES: sin efecto', L.bottom.x + L.bottom.w - 4, L.bottom.y + 16, { color: 'c', align: 'right' });
    else if (idle() || T.charging || T.phase === 'strike') drawControls(ctx, t);
    // cartel de turno
    if (T.banner && T.phase !== 'end') {
      const a = Math.min(1, T.banner.t * 3);
      ctx.globalAlpha = a * 0.8; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(F.x, MID.y - 62, F.w, 22); ctx.globalAlpha = a;
      OM.FONT.draw(ctx, T.banner.text, MID.x, MID.y - 58, { color: T.banner.color, size: 2, align: 'center', shadow: '0' });
      ctx.globalAlpha = 1;
    }
    if (T.caos) drawCaos(ctx, t);
    if (T.phase === 'intro') drawIntro(ctx, t);
    if (T.phase === 'end') drawEnd(ctx, t);
    OM.CHAT.draw(ctx, T.paused || T.help || (online() && !!OM.NET.error));
    if (T.help) drawHelp(ctx, t);
    if (T.paused) OM.drawPause(ctx, t, () => (T.paused = false));
    if (online() && OM.NET.error && T.phase !== 'end') drawNetError(ctx);
  }

  function drawIntro(ctx, t) {
    const S = S_(), M = S.M, obs = M.obstacles;
    if (S.caos) return drawCaosIntro(ctx, t);
    const a = Math.min(1, T.intro * 2);
    ctx.globalAlpha = a;
    const bw = 340, bh = 74 + obs.length * 26, bx = MID.x - bw / 2, by = MID.y - bh / 2;
    OM.UI.panel(ctx, bx, by, bw, bh, obs.length ? 'blood' : 'dark');
    OM.FONT.draw(ctx, 'PARTIDA ' + (S.matchIdx + 1) + ' DE ' + S.n + (S.matchIdx === S.n - 1 ? ' · LA FINAL' : ''), MID.x, by + 9, { color: '8', size: 2, align: 'center', shadow: '0', wave: 1, t });
    OM.FONT.draw(ctx, OM.MODES[M.mode].name + ' · ' + OM.MODES[M.mode].desc, MID.x, by + 32, { color: '7', align: 'center' });
    obs.forEach((id, i) => {
      const o = OM.obstacleDef(id);
      OM.CARDS.drawBossMedal(ctx, o, bx + 10, by + 40 + i * 26, { t, scale: 0.5 });
      OM.FONT.draw(ctx, o.name.toUpperCase(), bx + 40, by + 44 + i * 26, { color: 'c', shadow: '0' });
      OM.FONT.draw(ctx, o.desc, bx + 40, by + 55 + i * 26, { color: 'd' });
    });
    OM.FONT.draw(ctx, 'Saca ' + S.players[M.breaker].name + ' · Victoria: +' + OM.fmt(OM.POINTS.win[S.matchIdx]) + ' puntos', MID.x, by + bh - 28, { color: PCOL[M.breaker], align: 'center' });
    OM.FONT.draw(ctx, 'clic para empezar', MID.x, by + bh - 15, { color: '5', align: 'center' });
    ctx.globalAlpha = 1;
  }

  function drawEnd(ctx, t) {
    const S = S_(), M = S.M, G = OM.G, E = T.end, win = M.winner;
    E.t += 1 / 60;
    const lines = M.end.lines;
    // con el chat abierto el cartel se corre a la izquierda para no quedar debajo
    const dock = OM.CHAT.docked(), cx = dock ? Math.round((L.table.x + dock.x) / 2) : MID.x;
    const w = dock ? 274 : 300, h = 122 + lines.length * 13, x = cx - w / 2, y = MID.y - h / 2 - 4;
    ctx.globalAlpha = Math.min(0.6, E.t * 2); ctx.fillStyle = OM.PAL['0']; ctx.fillRect(L.table.x, L.table.y, L.table.w, L.table.h); ctx.globalAlpha = 1;
    OM.UI.panel(ctx, x, y, w, h, 'gold');
    OM.FONT.draw(ctx, '¡PARTIDA PARA ' + S.players[win].name.toUpperCase() + '!', cx, y + 10, { color: PCOL[win], size: 2, align: 'center', shadow: '0', wave: 1, t });
    if (M.end.reason) OM.FONT.draw(ctx, M.end.reason, cx, y + 31, { color: 'd', align: 'center' });
    lines.forEach((l, i) => {
      if (E.t < 0.4 + i * 0.3) return;
      if (!l.shown) { l.shown = true; OM.sfx('coin', { pitch: 1 + i * 0.1 }); }
      const yy = y + 46 + i * 13;
      OM.FONT.draw(ctx, S.players[l.pi].name + ' · ' + l.label, x + 14, yy, { color: '7' });
      OM.FONT.draw(ctx, (l.v >= 0 ? '+' : '-') + OM.fmt(Math.abs(l.v)), x + w - 14, yy, { color: l.v >= 0 ? PCOL[l.pi] : 'c', align: 'right' });
    });
    // marcador de la serie
    const yb = y + 52 + lines.length * 13;
    ctx.fillStyle = OM.PAL['3']; ctx.fillRect(x + 12, yb - 4, w - 24, 1);
    S.players.forEach((P, pi) => {
      OM.FONT.draw(ctx, P.name, x + 14, yb + pi * 16 + 2, { color: PCOL[pi], shadow: '0' });
      OM.FONT.draw(ctx, P.wins + (P.wins === 1 ? ' partida' : ' partidas'), x + w / 2 + 10, yb + pi * 16 + 2, { color: '6', align: 'center' });
      OM.FONT.draw(ctx, S.caos ? (pi === win ? '¡GANA!' : '') : OM.fmt(T.shown[pi]) + ' pts', x + w - 14, yb + pi * 16 + 2, { color: S.caos ? PCOL[pi] : '8', align: 'right' });
    });
    const ready = E.t > 0.6 + lines.length * 0.3;
    if (ready && G.button(cx - 70, y + h - 26, 140, 20, S.done ? 'VER RESULTADO' : 'SIGUIENTE PARTIDA', 'gold', false, 'Enter')) leave();
  }

  function drawHelp(ctx, t) {
    const S = S_(), G = OM.G, M = S.M;
    ctx.globalAlpha = 0.8; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 0, OM.W, OM.H); ctx.globalAlpha = 1;
    const w = 460, h = 300, x = (OM.W - w) / 2, y = 30;
    OM.UI.panel(ctx, x, y, w, h, 'dark');
    OM.FONT.draw(ctx, 'CÓMO SE JUEGA', OM.W / 2, y + 8, { color: '8', size: 2, align: 'center', shadow: '0' });
    const rules = M.mode === '8'
      ? ['{h}BOLA 8{/}: el primero que emboca tras el saque se queda ese grupo (lisas 1-7 o rayadas 9-15).', 'Toca primero una bola de tu grupo. Si embocas una tuya, sigues tirando.', 'Con tu grupo limpio, mete la 8 y ganas la partida. Meterla antes = {c}pierdes la serie entera{/} y te quedas sin puntos.']
      : ['{h}BOLA 9{/}: toca siempre primero la bola más baja de la mesa.', 'Cualquier bola que entre en un tiro legal cuenta y sigues tirando.', 'Quien mete la 9 con un tiro legal gana la partida.'];
    const txt = rules.concat([
      '{c}FALTA{/} (blanca dentro, no tocar nada, tocar primero una bola que no toca, que ninguna bola toque banda tras el contacto sin embocar nada, o agotar los ' + OM.POINTS.clock + ' segundos del tiro): -' + T.mods.foulCost + ' puntos y bola en mano para el rival.',
      ' ',
      S.caos ? '{q}SIN PUNTOS{/}: gana quien gane la partida. El dinero sirve para la tienda; cada bola que mete el rival te da $' + OM.CAOS.rivalBall + '. {c}MECHA{/}: como mucho ' + OM.CAOS.fuse + ' tiros seguidos, luego el turno pasa.' : '{q}PUNTOS x COMBO{/}: cada bola 100. Doble x2, triple x3, cuatro o más x5. Banda +50, combinación +100, de rebote +100, de lejos +50, saltar por encima de una bola o massé +150. Cada tiro seguido que emboca (tacada) suma +1 Combo.',
      S.caos ? ' ' : 'Gana la SERIE quien tenga más puntos tras las 5 partidas. Ganar una partida da un buen pellizco, y la final vale el triple.',
      ' ',
      '{u}MANDOS{/}: apunta con el ratón, arrastra hacia atrás para cargar y suelta. WASD (o la bola de abajo) = efecto. Q/E (o el taco de abajo) = ángulo de golpe: con efecto lateral hace {u}massé{/} (curva) y al centro y fuerte la blanca {u}salta{/}. El efecto y el ángulo se reinician en cada tiro.',
      S.caos
        ? '{c}MODO CAOS{/}: una partida. En el turno del RIVAL compras un hechizo y un activo (tecla B); si encadena tiros, te llegan trampas. Las {c}rojas{/} le caen encima en el acto; las {q}azules{/} se disparan al empezar tu turno. Todo dura un turno. La mesa cambia cada ' + OM.CAOS.every + ' turnos.'
        : '{h}TIENDA{/}: antes de cada partida compras con $. Hasta ' + OM.SHOP.slots + ' {q}comodines{/} (puntos y dinero, toda la serie), 1 {u}hechizo{/} (cambia la partida, dura una) y 1 {v}activo{/} (un uso: clic en la carta y USAR). Los trucos dan $.',
    ]);
    let yy = y + 32;
    txt.forEach((p) => { OM.FONT.wrap(p, w - 24, 1).forEach((ln) => { OM.FONT.draw(ctx, ln, x + 12, yy, { color: '7' }); yy += 11; }); yy += 2; });
    if (G.button(OM.W / 2 - 40, y + h - 22, 80, 16, 'CERRAR', 'dark', false, 'Enter') || OM.IN.rpressed) T.help = false;
  }

  function drawNetError(ctx) {
    const G = OM.G;
    ctx.globalAlpha = 0.8; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 0, OM.W, OM.H); ctx.globalAlpha = 1;
    OM.UI.panel(ctx, OM.W / 2 - 130, 130, 260, 80, 'blood');
    OM.FONT.draw(ctx, OM.NET.error, OM.W / 2, 144, { color: 'c', align: 'center', shadow: '0' });
    OM.FONT.draw(ctx, 'La serie online no puede continuar.', OM.W / 2, 158, { color: '6', align: 'center' });
    if (G.button(OM.W / 2 - 60, 180, 120, 18, 'SALIR AL MENÚ', 'dark')) { OM.NET.close(); OM.go('title'); }
  }

  // ---------------- MODO CAOS ----------------
  // Comprar = lanzar. Lenguaje visual: ROJO = cae sobre el que tira (trastadas y trampas), AZUL = para tu turno.
  // La tienda se despliega en el turno del rival (una carta por turno); la carta vuela a su destino;
  // la franja EN JUEGO (donde la serie tiene los huecos de hechizo y activo) muestra lo que afecta al tiro actual.
  // Cada compra es una "op" numerada (MT.caosOp): en el online se manda al rival y se reaplica tras su sync si llegó tarde.
  const DR = { x: L.bottom.x, y: 258, w: L.bottom.w, h: 96 };
  const TRAY = { x: L.jokers.x, y: L.jokers.y + 2, w: L.jokers.w }; // el CAOS no tiene comodines: toda la fila es EN JUEGO
  const CONSUM_C = { x: L.consum.x + 40, y: L.consum.y + 10 };
  const caosLocal2 = () => S_().players.every((P) => P.kind === 'human');
  // quién compra en este dispositivo ahora (-1 = nadie): el jugador humano que NO tira
  function caosShopper() {
    const S = S_(), M = S.M;
    if (!T || !T.caos || !M.caos || M.winner != null || T.phase === 'intro' || T.phase === 'end') return -1;
    const pi = 1 - M.turn;
    return S.players[pi].kind === 'human' ? pi : -1;
  }
  const caosOver = () => !!(T && T.caos && T.caos.open && caosShopper() >= 0 && OM.G.inside(DR.x, DR.y, DR.w, DR.h));
  const trayPos = () => ({ x: TRAY.x + 4, y: TRAY.y });
  const offerPos = (k) => ({ x: DR.x + 12 + k * 50, y: DR.y + 18 });
  const shopDone = (sh) => sh.got.hechizo && sh.got.activo;

  // carta que vuela de a hasta b y al llegar revienta (then: callback)
  function flyCard(id, a, b, bad, then, delay) {
    T.caos.fly.push({ id, a, b, bad, then, t: -(delay || 0), dur: 0.55 });
    OM.sfx('card_flip', { pitch: 1.3 });
  }
  function updateCaos(dt) {
    const S = S_(), M = S.M, C = T.caos;
    if (C.note) { C.note.t -= dt; if (C.note.t <= 0) C.note = null; }
    if (C.cond) { C.cond.t -= dt; if (C.cond.t <= 0) C.cond = null; }
    if (C.closeT > 0) { C.closeT -= dt; if (C.closeT <= 0) C.open = false; }
    C.fly = C.fly.filter((f) => {
      f.t += dt;
      if (f.t < f.dur) return true;
      const def = OM.jokerDef(f.id);
      OM.FX.burst(f.b.x + 20, f.b.y + 27, f.bad ? 'ember' : 'gold', 22); OM.FX.shake(f.bad ? 3 : 1.5, 0.2);
      if (f.bad) OM.FX.flash('a', 0.18, 0.25);
      OM.FX.popText(MID.x, F.y + 30, def.name.toUpperCase() + '!', f.bad ? 'c' : 'q', { size: 2 });
      OM.sfx(f.bad ? 'curse' : 'level_up', { vol: 0.7 });
      if (f.then) f.then();
      return false;
    });
    const sp = caosShopper();
    if (sp < 0) C.open = false;
    else if (OM.IN.kp.KeyB && !OM.typing && !T.paused && !T.help) { C.open = !C.open; C.closeT = 0; OM.sfx('card_flip'); }
    // el bot que espera compra su carta mientras el otro apunta
    if (!M.caos || M.winner != null || T.phase === 'intro' || T.phase === 'end' || ((T.paused || T.help) && !online())) return;
    const bi = 1 - M.turn;
    if (S.players[bi].kind !== 'bot') return;
    C.botT -= dt;
    if (C.botT > 0) return;
    C.botT = 2 + Math.random() * 3;
    const a = OM.AI.caosAct(S, bi);
    if (a) caosDo(bi, a);
  }
  // acción de tienda de un jugador de este dispositivo (humano o bot)
  function caosDo(pi, a) {
    const S = S_(), C = S.M.caos;
    if (!C) return null;
    const op = Object.assign({ pi, n: C.ops[pi] }, a);
    const r = MT.caosOp(S, op, T.W);
    if (online() && S.players[pi].kind === 'human') { OM.NET.send({ t: 'cop', op }); T.caos.pending.push(op); }
    caosFeedback(op, r);
    return r;
  }
  // acción de tienda que llega del rival online
  function caosRemote(op) { if (S_().M.caos) caosFeedback(op, MT.caosOp(S_(), op, T.W)); }
  function caosFeedback(op, r) {
    const S = S_(), C = T.caos;
    if (!r) return;
    const mine = S.players[op.pi].kind === 'human' && (!online() || op.pi === S.me);
    if (r.err) { if (mine) { C.note = { text: r.err, t: 1.6 }; OM.sfx('click', { pitch: 0.6 }); } return; }
    OM.META.seen[r.id] = 1;
    const shown = mine && C.open;
    const from = shown ? offerPos(r.k) : CONSUM_C;
    if (shown && shopDone(S.M.caos.shop[op.pi])) C.closeT = 0.9;
    OM.sfx('buy');
    if (r.mode === 'now') flyCard(r.id, from, r.used ? { x: MID.x - 20, y: MID.y - 27 } : trayPos(), true, () => { if (r.used) useFx(r.used, op.pi, null); refreshMods(); });
    else flyCard(r.id, from, CONSUM_C, false, null);
    refreshMods();
  }
  // fin de turno: los hechizos que se acaban revientan en la franja; paga de la tienda; mesa nueva
  function caosTurnFx(info) {
    const S = S_(), C = T.caos;
    info.expired.forEach((x) => { const p = C.tray[x.id]; if (p) { OM.FX.burst(p.x + 10, p.y + 14, 'smoke', 16); OM.FX.burst(p.x + 10, p.y + 14, 'spark', 8); } });
    if (info.expired.length) OM.sfx('curse', { pitch: 0.6, vol: 0.5 });
    if (info.pay) { const b = boxPos(info.payTo); OM.FX.popText(b.x, b.y + 12, '+$' + info.pay, 'i', { size: 2 }); OM.sfx('coin', { vol: 0.5 }); }
    if (info.cond) { C.cond = { t: 2.8, ids: S.M.obstacles.slice() }; OM.sfx('boss'); OM.FX.flash('a', 0.3, 0.5); OM.FX.shake(4, 0.4); }
  }

  // EN JUEGO: todo lo que afecta al tiro actual (rojo = del rival, azul = propio)
  function trayItems() {
    const S = S_(), M = S.M, me = M.turn, fx = M.fx, out = [];
    S.players.forEach((Pl, pi) => Pl.jokers.forEach((J) => { const d = OM.jokerDef(J.id); if (OM.jtype(d) === 'hechizo' && MT.spellTarget(pi, d) === me) out.push({ id: J.id, bad: pi !== me }); }));
    if (fx.bomb) out.push({ id: 'dinamita' }); if (fx.free) out.push({ id: 'tiro_gratis' }); if (fx.rewind) out.push({ id: 'marcha_atras' });
    if (fx.boost === me) out.push({ id: 'boca_infierno' }); if (fx.xshot[me]) out.push({ id: 'gran_golpe' });
    if (fx.hex === me) out.push({ id: 'vudu', bad: true }); if (fx.rush === me) out.push({ id: 'reloj_arena', bad: true }); if (fx.shrink === me) out.push({ id: 'sabotaje', bad: true });
    return out;
  }
  function drawTray(ctx, t) {
    const G = OM.G, C = T.caos, items = T.phase === 'end' ? [] : trayItems(), n = items.length;
    const sc = n <= 6 ? 1 : 0.7, sp = n <= 6 ? 48 : 30;
    C.tray = {};
    items.forEach((it, i) => {
      const def = OM.jokerDef(it.id), x = TRAY.x + 4 + i * sp, y = TRAY.y + (sc < 1 ? 6 : 0), w = Math.round(L.cardW * sc), h = Math.round(L.cardH * sc);
      C.tray[it.id] = { x, y };
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 6 + i); ctx.strokeStyle = OM.PAL[it.bad ? 'c' : 'q']; ctx.lineWidth = 2;
      ctx.strokeRect(x - 1, y - 1, w + 2, h + 2); ctx.globalAlpha = 1;
      OM.CARDS.drawJoker(ctx, def, x, y, { t, scale: sc, wobble: true, seed: i });
      if (G.inside(x, y, w, h)) G.tooltip(x + w / 2, y + h + 8, def.name, OM.HUD.defDesc(def), it.bad ? 'c' : 'q', it.bad ? 'Contra el que tira' : 'A favor del que tira');
    });
  }

  // Bolsa del Diablo sobre el paño
  function drawBag(ctx, k, t) {
    const P = OM.PAL, x = Math.round(k.x), y = Math.round(k.y + Math.sin(t * 3) * 1.5);
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 5); ctx.fillStyle = P.i; ctx.beginPath(); ctx.arc(x, y + 1, k.r + 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = P['0']; ctx.beginPath(); ctx.arc(x, y + 1, k.r + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.b; ctx.beginPath(); ctx.arc(x, y + 1, k.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.d; ctx.fillRect(x - 3, y - 2, 2, 2);
    ctx.fillStyle = P['0']; ctx.fillRect(x - 2, y - k.r - 2, 5, 3);
    ctx.fillStyle = P.h; ctx.fillRect(x - 1, y - k.r - 1, 3, 1);
    ctx.fillStyle = P.i; ctx.fillRect(x, y - 1, 1, 5); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x - 1, y + 2, 3, 1);
    if (Math.floor(t * 5) % 6 === 0) { ctx.fillStyle = P['8']; ctx.fillRect(x + k.r, y - k.r, 1, 1); }
  }
  // insignia de la carta: rojo = cae ya sobre el rival, azul = para tu turno
  function badge(ctx, x, y, bad) {
    const P = OM.PAL;
    ctx.fillStyle = P['0']; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P[bad ? 'c' : 'q']; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P['8'];
    if (bad) { ctx.fillRect(x - 1, y - 3, 2, 4); ctx.fillRect(x - 1, y + 2, 2, 1); } // !
    else { ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x, y - 3, 1, 7); }          // +
  }

  // mecha: tiros seguidos que le quedan al que tira, sobre la banda de arriba. Se quema con cada tiro; la última chisporrotea
  function drawFuse(ctx, t) {
    const S = S_(), M = S.M, n = OM.CAOS.fuse;
    if (T.phase === 'intro' || T.phase === 'end' || M.winner != null) return;
    const left = Math.max(0, n - (M.chain || 0)), sw = 20, gap = 4, x0 = FUSE.x, y = FUSE.y, col = PCOL[M.turn];
    // bomba al final de la mecha, del color del que tira
    const bx = x0 + n * (sw + gap) + 5, by = y + 2;
    ctx.fillStyle = OM.PAL['0']; ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = OM.PAL[col]; ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = OM.PAL['8']; ctx.fillRect(bx - 3, by - 3, 2, 2);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (sw + gap), lit = i >= n - left, last = left === 1 && i === n - 1;
      ctx.fillStyle = OM.PAL['0']; ctx.fillRect(x - 1, y - 1, sw + 2, 6);
      ctx.fillStyle = OM.PAL[lit ? (last ? (Math.floor(t * 8) % 2 ? 'c' : 'i') : 'h') : '2'];
      ctx.fillRect(x, y, sw, 4);
      ctx.fillStyle = OM.PAL[lit ? 'i' : '3'];
      for (let k = 1; k < sw; k += 4) ctx.fillRect(x + k, y + (k % 8 < 4 ? 0 : 3), 2, 1); // trenzado
    }
    // chispa donde arde
    if (left > 0) {
      const sx = x0 + (n - left) * (sw + gap) - 2, f = Math.floor(t * 14) % 3;
      ctx.fillStyle = OM.PAL['c']; ctx.fillRect(sx - 2, y - 2 - f, 5, 5 + f);
      ctx.fillStyle = OM.PAL['i']; ctx.fillRect(sx - 1, y - f, 3, 3);
      ctx.fillStyle = OM.PAL['8']; ctx.fillRect(sx, y + 1 - f, 1, 1);
      if (Math.random() < 0.3) OM.FX.burst(sx, y, 'ember', 1);
    }
  }

  function drawCaos(ctx, t) {
    const S = S_(), C = T.caos, G = OM.G;
    drawTray(ctx, t);
    drawFuse(ctx, t);
    // aviso de mesa nueva
    if (C.cond && T.phase !== 'end') {
      const a = Math.min(1, C.cond.t * 2), ids = C.cond.ids, h = 28 + ids.length * 22, y = MID.y - 36;
      ctx.globalAlpha = a * 0.85; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(F.x, y, F.w, h); ctx.globalAlpha = a;
      OM.FONT.draw(ctx, '¡LA MESA CAMBIA!', MID.x, y + 5, { color: 'c', size: 2, align: 'center', shadow: '0', wave: 1, t });
      ids.forEach((id, i) => {
        const o = OM.obstacleDef(id);
        OM.FONT.draw(ctx, o.name.toUpperCase(), MID.x, y + 26 + i * 22, { color: 'i', align: 'center', shadow: '0' });
        OM.FONT.draw(ctx, o.desc, MID.x, y + 36 + i * 22, { color: '7', align: 'center' });
      });
      ctx.globalAlpha = 1;
    }
    // vista previa de adónde va la carta que estás mirando
    if (C.hov) {
      const pulse = 0.45 + 0.4 * Math.sin(t * 9);
      ctx.globalAlpha = pulse; ctx.strokeStyle = OM.PAL[C.hov.bad ? 'c' : 'q']; ctx.lineWidth = 2;
      if (C.hov.bad) { ctx.strokeRect(F.x - 2, F.y - 2, F.w + 4, F.h + 4); ctx.strokeRect(TRAY.x, TRAY.y - 2, TRAY.w, L.cardH + 4); }
      else ctx.strokeRect(L.consum.x - 1, L.consum.y - 1, L.consum.w + 2, L.consum.h + 2);
      ctx.globalAlpha = 1;
    }
    C.hov = null;
    const sp = caosShopper();
    if (sp >= 0) {
      if (!C.open) {
        const done = shopDone(S.M.caos.shop[sp]), pulse = Math.floor(t * 3) % 2;
        if (G.button(L.consum.x, L.consum.y + L.consum.h - 13, L.consum.w, 13, 'TIENDA (B)', done ? 'dark' : pulse ? 'gold' : 'red', T.paused || T.help)) { C.open = true; OM.sfx('card_flip'); }
      } else drawCaosShop(ctx, t, S, sp);
    }
    // cartas en vuelo (encima de todo)
    C.fly.forEach((f) => {
      if (f.t < 0) return;
      const k = Math.min(1, f.t / f.dur), e = 1 - Math.pow(1 - k, 3), arc = Math.sin(k * Math.PI) * 30;
      const x = f.a.x + (f.b.x - f.a.x) * e, y = f.a.y + (f.b.y - f.a.y) * e - arc;
      OM.CARDS.drawJoker(ctx, OM.jokerDef(f.id), Math.round(x), Math.round(y), { t, scale: 1 + Math.sin(k * Math.PI) * 0.35 });
    });
  }
  function drawCaosShop(ctx, t, S, pi) {
    const G = OM.G, P = S.players[pi], M = S.M, C = T.caos, sh = M.caos.shop[pi], D = DR, locked = T.paused || T.help, done = shopDone(sh);
    OM.UI.panel(ctx, D.x, D.y, D.w, D.h, sh.rally ? 'blood' : 'dark');
    OM.FONT.draw(ctx, sh.rally ? '¡TRAMPAS!' : 'TIENDA', D.x + 8, D.y + 5, { color: sh.rally ? 'c' : 'h', shadow: '0', wave: sh.rally ? 1 : 0, t });
    // lo que ya compraste en este turno: un hueco por tipo
    ['hechizo', 'activo'].forEach((ty, i) => {
      const x = D.x + 70 + i * 22, on = sh.got[ty], col = OM.JTYPE[ty].color;
      ctx.fillStyle = OM.PAL[on ? '3' : col]; ctx.fillRect(x, D.y + 5, 16, 7);
      ctx.fillStyle = OM.PAL['0']; ctx.fillRect(x + 1, D.y + 6, 14, 5);
      if (!on) { ctx.fillStyle = OM.PAL[col]; ctx.fillRect(x + 2, D.y + 7, 12, 3); }
    });
    if (G.button(D.x + D.w - 20, D.y + 3, 15, 12, 'x', 'dark', locked)) { C.open = false; return; }
    sh.offers.forEach((o, k) => {
      if (o.sold) return; // la comprada ya salió volando
      const def = OM.jokerDef(o.id), p = offerPos(k), cost = MT.caosPrice(S, o.id), bad = MT.isTrap(def);
      const typeDone = !!sh.got[OM.jtype(def)], why = MT.caosCanBuy(S, pi, k), over = !locked && !typeDone && G.inside(p.x, p.y, L.cardW, L.cardH);
      OM.CARDS.drawJoker(ctx, def, p.x, p.y - (over ? 4 : 0), { t, hover: over, wobble: true, seed: k + sh.win * 7, alpha: typeDone ? 0.15 : why ? 0.5 : 1 });
      if (!typeDone) badge(ctx, p.x + L.cardW - 2, p.y + 2 - (over ? 4 : 0), bad);
      OM.FONT.draw(ctx, '$' + cost, p.x + L.cardW / 2, p.y + L.cardH + 5, { color: typeDone ? '4' : P.money >= cost ? 'i' : 'c', align: 'center', shadow: '0' });
      if (over) {
        C.hov = { bad };
        G.cursor = why ? 'normal' : 'grab';
        G.tooltip(p.x + L.cardW / 2, D.y - 100, def.name, OM.HUD.defDesc(def), bad ? 'c' : 'q', why || '$' + cost);
        if (G.clicked(p.x, p.y, L.cardW, L.cardH)) caosDo(pi, { a: 'buy', k });
      }
    });
    // dinero
    const rx = D.x + 12 + 5 * 50 + 10;
    OM.FONT.draw(ctx, '$' + P.money, rx, D.y + 24, { color: 'i', size: 2, shadow: '0' });
    if (C.note) OM.FONT.wrap(C.note.text, D.x + D.w - 8 - rx, 1).slice(0, 2).forEach((ln, i) => OM.FONT.draw(ctx, ln, rx, D.y + 50 + i * 10, { color: 'c' }));
  }
  function drawCaosIntro(ctx, t) {
    const S = S_(), M = S.M, CA = OM.CAOS, a = Math.min(1, T.intro * 2);
    ctx.globalAlpha = a;
    const bw = 380, bh = 124, bx = MID.x - bw / 2, by = MID.y - bh / 2;
    OM.UI.panel(ctx, bx, by, bw, bh, 'blood');
    OM.FONT.draw(ctx, '¡MODO CAOS!', MID.x, by + 9, { color: 'c', size: 2, align: 'center', shadow: '0', wave: 1, t });
    OM.FONT.draw(ctx, OM.MODES[M.mode].name + ' · una partida · sin puntos: gana quien la gane', MID.x, by + 30, { color: '8', align: 'center' });
    [
      '{h}TIENDA{/} en el turno del rival: un {u}hechizo{/} y un {v}activo{/} (tecla B).',
      'Las {c}rojas{/} le caen al rival en el acto. Las {q}azules{/} son para tu turno.',
      '{c}La mesa cambia cada ' + CA.every + ' turnos{/}. Pasa la blanca por la {i}Bolsa del Diablo{/}.',
    ].forEach((r, i) => OM.FONT.draw(ctx, '· ' + r, bx + 14, by + 48 + i * 13, { color: '7' }));
    OM.FONT.draw(ctx, 'Saca ' + S.players[M.breaker].name + ' · ' + CA.clock + ' s por tiro · clic para empezar', MID.x, by + bh - 15, { color: PCOL[M.breaker], align: 'center' });
    ctx.globalAlpha = 1;
  }

  // depuración / playtest automatizado
  OM.dbg = () => T && { balls: T.W.balls, phase: T.phase, T };
})();
