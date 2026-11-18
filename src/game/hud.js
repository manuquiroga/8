// 8 — HUD del 1v1: panel izquierdo (marcador de los dos jugadores, dinero, tiro actual), fila de comodines
// del que tira (arriba: 4 huecos de comodín + hechizo + activo) y comodines del rival en pequeño (arriba a la derecha).
window.OM = window.OM || {};

OM.HUD = (function () {
  const L = OM.LAYOUT;
  const PCOL = ['q', 'v']; // color de cada jugador
  const H = { PCOL, sel: null, jiggle: {} };

  // huecos fijos: 0-3 comodines, 4 hechizo, 5 activo
  const NS = () => OM.SHOP.slots;
  const slotX = (k) => L.jokers.x + (k < NS() ? k * 44 : NS() * 44 + 8 + (k - NS()) * 46);
  const SLOT_TYPES = () => Array.from({ length: NS() }, () => 'comodin').concat(['hechizo', 'activo']);
  // hueco de cada carta del jugador (en el orden de P.jokers)
  function slotsOf(P) {
    let c = 0;
    return P.jokers.map((J) => { const t = OM.Match.typeOf(J.id); return t === 'hechizo' ? NS() : t === 'activo' ? NS() + 1 : Math.min(NS() - 1, c++); });
  }
  H.slotsOf = slotsOf;
  H.slotX = slotX;
  const miniX = (i) => L.consum.x + 4 + i * 21;
  H.bump = (uid) => { H.jiggle[uid] = 0.35; };

  function jokerDesc(J) {
    const def = OM.jokerDef(J.id);
    let d = def.desc;
    if (J.st && J.st.v !== undefined) d = d.replace('{v}', Math.round(J.st.v * 100) / 100);
    else d = d.replace(/ \((Actual|Llevas|Cargado)[^)]*\)/, '');
    return OM.colorize(d);
  }
  H.jokerDesc = jokerDesc;
  H.defDesc = (def) => OM.colorize(def.desc.replace(/ \((Actual|Llevas|Cargado)[^)]*\)/, ''));
  const spent = (J) => { const d = OM.jokerDef(J.id); return J.used && (d.active || d.once); };
  H.typeLabel = (def) => OM.RARITY[def.rarity].name + ' · ' + OM.JTYPE[OM.jtype(def)].name + (OM.S && OM.S.caos && OM.sceneName === 'table' && OM.jtype(def) === 'hechizo' ? ' · 1 turno' : '');

  // posición en pantalla de un comodín (para los textos flotantes). main = jugador de la fila grande.
  H.jokerPos = function (S, uid, main) {
    for (let pi = 0; pi < 2; pi++) {
      const i = S.players[pi].jokers.findIndex((J) => J.uid === uid);
      if (i < 0) continue;
      H.bump(uid);
      if (pi === main) return { x: slotX(slotsOf(S.players[pi])[i]) + 20, y: L.jokers.y + 66 };
      return { x: miniX(i) + 10, y: L.consum.y + 62 };
    }
    return null;
  };

  // ---------- fila de comodines del que tira ----------
  // opts: {locked, canUse(idx) -> bool, onUse(idx), onClick(idx) (tienda), selUid, markUid}
  H.drawJokers = function (ctx, S, pi, t, opts) {
    opts = opts || {};
    const G = OM.G, P = S.players[pi];
    const y0 = L.jokers.y + 2, slots = slotsOf(P), types = SLOT_TYPES();
    // rótulo del dueño
    ctx.fillStyle = OM.PAL[PCOL[pi]]; ctx.fillRect(L.jokers.x, L.jokers.y + L.jokers.h + 1, L.jokers.w, 1);
    // huecos vacíos
    const caos = !!S.caos; // en el CAOS los huecos de hechizo y activo son la franja EN JUEGO (scene_table)
    types.forEach((type, k) => {
      if (slots.includes(k) || caos) return; // en el CAOS esta fila es la franja EN JUEGO (scene_table)
      const x = slotX(k), T = OM.JTYPE[type];
      ctx.globalAlpha = 0.5; ctx.fillStyle = OM.PAL['1']; ctx.fillRect(x + 1, y0 + 1, L.cardW - 2, L.cardH - 2); ctx.globalAlpha = 1;
      ctx.fillStyle = OM.PAL[type === 'comodin' ? '5' : T.color];
      for (let d = 0; d < L.cardW; d += 3) { ctx.fillRect(x + d, y0, 1, 1); ctx.fillRect(x + d, y0 + L.cardH - 1, 1, 1); }
      for (let d = 0; d < L.cardH; d += 3) { ctx.fillRect(x, y0 + d, 1, 1); ctx.fillRect(x + L.cardW - 1, y0 + d, 1, 1); }
      OM.FONT.draw(ctx, type === 'comodin' ? '+' : T.short.slice(0, 4), x + L.cardW / 2, y0 + 23, { color: type === 'comodin' ? '6' : T.color, align: 'center' });
      if (G.inside(x, y0, L.cardW, L.cardH) && !opts.locked) G.tooltip(x + L.cardW / 2, y0 + L.cardH + 20, 'Hueco libre: ' + T.name.toLowerCase(), T.desc, T.color);
    });
    let hover = -1;
    P.jokers.forEach((J, i) => {
      if (caos && OM.jtype(OM.jokerDef(J.id)) !== 'comodin') return;
      const x = slotX(slots[i]), y = y0;
      const hov = G.inside(x, y, L.cardW, L.cardH) && !opts.locked;
      if (hov) hover = i;
      const sel = H.sel === J.uid || opts.selUid === J.uid;
      const jig = H.jiggle[J.uid] || 0;
      if (jig > 0) H.jiggle[J.uid] = jig - 1 / 60;
      const def = OM.jokerDef(J.id), type = OM.jtype(def);
      OM.CARDS.drawJoker(ctx, def, x, y - (sel ? 5 : 0), { t, hover: hov, selected: sel, scale: 1 + Math.max(0, jig) * 0.6, wobble: true, seed: i, alpha: spent(J) ? 0.35 : 1 });
      if (type === 'activo') {
        // los activos laten
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 5); ctx.fillStyle = OM.PAL.v; ctx.fillRect(x + 12, y + L.cardH + 1, 16, 2); ctx.globalAlpha = 1;
      } else if (type === 'hechizo') {
        if (J.live) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8); ctx.fillStyle = OM.PAL.u; ctx.fillRect(x + 6, y + L.cardH + 1, 28, 2); ctx.globalAlpha = 1; }
        else { ctx.fillStyle = OM.PAL.u; ctx.fillRect(x + 12, y + L.cardH + 1, 16, 1); }
      }
      if (opts.markUid === J.uid) {
        ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 8); ctx.strokeStyle = OM.PAL.c; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 6, L.cardW + 2, L.cardH + 2); ctx.globalAlpha = 1;
      }
      if (hov && G.clicked(x, y, L.cardW, L.cardH)) {
        if (opts.onClick) opts.onClick(i, J);
        else if (def.active) { H.sel = sel ? null : J.uid; OM.sfx('card_flip'); }
      }
    });
    if (hover >= 0) {
      const J = P.jokers[hover], def = OM.jokerDef(J.id), r = OM.RARITY[def.rarity];
      G.cursor = 'grab';
      G.tooltip(slotX(slots[hover]) + L.cardW / 2, y0 + L.cardH + 20, def.name, jokerDesc(J), r.color, H.typeLabel(def) + (spent(J) ? ' · GASTADO' : ''));
    }
    const si = P.jokers.findIndex((J) => J.uid === H.sel);
    if (si >= 0 && !opts.onClick) {
      const can = opts.canUse && opts.canUse(si);
      if (G.button(slotX(slots[si]) - 3, y0 + L.cardH - 1, 46, 14, 'USAR', 'green', !can)) { H.sel = null; opts.onUse && opts.onUse(si); }
    } else if (!opts.onClick) H.sel = null;
  };

  // ---------- comodines del rival (en pequeño) ----------
  H.drawRivalJokers = function (ctx, S, pi, t) {
    const G = OM.G, P = S.players[pi];
    OM.FONT.draw(ctx, P.name, L.consum.x + 4, L.consum.y + 2, { color: PCOL[pi], shadow: '0' });
    ctx.fillStyle = OM.PAL[PCOL[pi]]; ctx.fillRect(L.consum.x, L.consum.y + L.consum.h + 1, L.consum.w, 1);
    const y = L.consum.y + 16;
    OM.FONT.draw(ctx, '$' + P.money, L.consum.x + L.consum.w - 2, L.consum.y + 2, { color: 'h', align: 'right', shadow: '0' });
    // CAOS: las trastadas se ven en EN JUEGO; lo que espera a su turno late en azul
    const list = S.caos ? P.jokers.filter((J) => { const d = OM.jokerDef(J.id); return OM.jtype(d) === 'comodin' || OM.Match.spellTarget(pi, d) === pi; }) : P.jokers;
    list.forEach((J, i) => {
      const x = miniX(i), def = OM.jokerDef(J.id);
      if (S.caos && OM.jtype(def) !== 'comodin') { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 6); ctx.strokeStyle = OM.PAL.q; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, 22, 29); ctx.globalAlpha = 1; }
      const jig = H.jiggle[J.uid] || 0;
      if (jig > 0) H.jiggle[J.uid] = jig - 1 / 60;
      const hov = G.inside(x, y, 20, 27);
      OM.CARDS.drawJoker(ctx, def, x - (jig > 0 ? 3 : 0), y - (jig > 0 ? 4 : 0), { t, scale: jig > 0 ? 0.8 : 0.5, alpha: spent(J) ? 0.35 : 1, hover: hov });
      if (hov) { const r = OM.RARITY[def.rarity]; G.tooltip(x + 10, y + 34, def.name, jokerDesc(J), r.color, H.typeLabel(def) + ' · de ' + P.name); }
    });
  };

  // ---------- panel izquierdo ----------
  // info: {W, turn, shown:[p0,p1], shotName, shotColor, pts, multStr, bump, lines:[..], buttons(y)}
  H.drawPanel = function (ctx, S, t, info) {
    const P = L.panel, G = OM.G, M = S.M;
    OM.UI.panel(ctx, P.x, P.y, P.w, P.h, 'dark');
    const cx = P.x + P.w / 2;
    // cabecera: partida y obstáculos
    const obs = M ? M.obstacles : (S.obstacles[S.matchIdx] || []);
    const mode = OM.MODES[OM.Match.matchMode(S, S.matchIdx)];
    const C = M && M.caos;
    OM.UI.panel(ctx, P.x + 4, P.y + 4, P.w - 8, 36, obs.length || C ? 'blood' : 'inset');
    if (C) {
      // MODO CAOS: la condición de la mesa y cuándo cambia
      const left = OM.CAOS.every - (C.turns % OM.CAOS.every);
      OM.FONT.draw(ctx, 'CAOS', P.x + 10, P.y + 9, { color: 'c', shadow: '0', wave: 1, t });
      OM.FONT.draw(ctx, 'cambia en ' + left + (left === 1 ? ' turno' : ' turnos'), P.x + P.w - 10, P.y + 9, { color: left === 1 ? (Math.floor(t * 4) % 2 ? 'i' : 'h') : '6', align: 'right', shadow: '0' });
      OM.FONT.draw(ctx, obs.length ? obs.map((id) => OM.obstacleDef(id).name).join(' + ') : 'Mesa limpia', cx, P.y + 24, { color: obs.length ? 'd' : '5', align: 'center' });
      if (G.inside(P.x + 4, P.y + 4, P.w - 8, 36)) {
        const now = obs.length ? obs.map((id) => { const o = OM.obstacleDef(id); return o.name + ': ' + o.desc; }).join(' ') : 'Mesa limpia.';
        G.tooltip(cx, P.y + 44, 'MESA DEL CAOS', now + ' {h}Luego{/}: ' + C.next.map((id) => OM.obstacleDef(id).name).join(' + ') + '.', 'c', 'Cambia cada ' + OM.CAOS.every + ' turnos');
      }
    } else {
      OM.FONT.draw(ctx, 'PARTIDA ' + (S.matchIdx + 1) + '/' + S.n, P.x + 10, P.y + 9, { color: '8', shadow: '0' });
      OM.FONT.draw(ctx, mode.name, P.x + P.w - 10, P.y + 9, { color: 'i', align: 'right', shadow: '0' });
      OM.FONT.draw(ctx, obs.length ? obs.map((id) => OM.obstacleDef(id).name).join(' + ') : 'Mesa limpia', cx, P.y + 24, { color: obs.length ? 'd' : '5', align: 'center' });
      if (obs.length && G.inside(P.x + 4, P.y + 4, P.w - 8, 36)) G.tooltip(cx, P.y + 44, 'OBSTÁCULOS', obs.map((id) => { const o = OM.obstacleDef(id); return o.name + ': ' + o.desc; }).join(' '), 'b');
    }

    // jugadores
    let y = P.y + 44;
    for (let pi = 0; pi < 2; pi++) {
      const Pl = S.players[pi], turn = info.turn === pi;
      OM.UI.panel(ctx, P.x + 4, y, P.w - 8, 64, turn ? 'gold' : 'inset');
      if (turn) OM.FONT.draw(ctx, '>', P.x + 8 + Math.round(Math.sin(t * 6)), y + 6, { color: 'i' });
      OM.FONT.draw(ctx, Pl.name, P.x + 16, y + 6, { color: PCOL[pi], shadow: '0' });
      // partidas ganadas
      for (let k = 0; k < S.n; k++) {
        const px = P.x + P.w - 12 - (S.n - k) * 8;
        ctx.fillStyle = OM.PAL['0']; ctx.fillRect(px - 1, y + 6, 7, 7);
        ctx.fillStyle = OM.PAL[k < Pl.wins ? 'h' : '3']; ctx.fillRect(px, y + 7, 5, 5);
      }
      if (S.caos) OM.FONT.draw(ctx, '$' + Pl.money, P.x + P.w - 12, y + 20, { color: 'i', size: 2, align: 'right', shadow: '0' }); // el CAOS no va de puntos
      else {
        const shown = info.shown ? info.shown[pi] : Pl.points;
        OM.FONT.draw(ctx, OM.fmt(shown), P.x + P.w - 12, y + 20, { color: '8', size: 2, align: 'right', shadow: '0' });
        OM.FONT.draw(ctx, 'PTS', P.x + 10, y + 22, { color: '6' });
        OM.FONT.draw(ctx, '$' + Pl.money, P.x + 10, y + 32, { color: 'h', shadow: '0' });
      }
      // bolas que le quedan
      if (M && info.W) {
        if (M.mode === '8') {
          if (M.open) OM.FONT.draw(ctx, 'mesa abierta', P.x + 10, y + 46, { color: '5' });
          else {
            const rem = OM.Match.remaining(S, info.W, pi);
            const list = rem.length ? rem : (M.winner == null || M.winner === pi ? [8] : []);
            OM.FONT.draw(ctx, OM.Match.GROUP_NAME[M.groups[pi]].toLowerCase(), P.x + P.w - 12, y + 46, { color: '5', align: 'right' });
            list.forEach((n, k) => OM.TABLE.drawBall(ctx, { num: n, kind: M.gold[n] != null ? 'oro' : 'normal', rollX: 0, rollY: 0 }, P.x + 16 + k * 13, y + 50, t));
          }
        } else if (M.streak[pi] > 0 && turn) OM.FONT.draw(ctx, 'tacada x' + (M.streak[pi] + 1), P.x + 10, y + 46, { color: 'v' });
      }
      y += 68;
    }
    // tiro actual: Puntos x Combo
    OM.UI.panel(ctx, P.x + 4, y, P.w - 8, 54, 'inset');
    if (S.caos) {
      // sin Puntos x Combo: solo el nombre del tiro, en grande
      OM.FONT.draw(ctx, info.shotName || ' ', cx, y + 20, { color: info.shotColor || '7', align: 'center', size: 2, shadow: '0' });
      y += 58;
    } else {
    OM.FONT.draw(ctx, info.shotName || ' ', cx, y + 5, { color: info.shotColor || '7', align: 'center', shadow: '0' });
    const bump = info.bump || { c: 0, m: 0 }, bw = 66;
    OM.UI.valueBox(ctx, P.x + 10 - Math.round(bump.c * 2), y + 18 - Math.round(bump.c * 2), bw + Math.round(bump.c * 4), 28 + Math.round(bump.c * 4), OM.fmt(info.pts || 0), 'chips');
    OM.UI.valueBox(ctx, P.x + P.w - 10 - bw - Math.round(bump.m * 2), y + 18 - Math.round(bump.m * 2), bw + Math.round(bump.m * 4), 28 + Math.round(bump.m * 4), info.multStr || '1', 'mult');
    OM.FONT.draw(ctx, 'x', cx, y + 26, { color: 'c', align: 'center', size: 2, shadow: '0' });
    if (G.inside(P.x + 4, y, P.w - 8, 54)) G.tooltip(cx, y + 58, 'PUNTOS x COMBO', 'Cada bola tuya da Puntos. Meter 2, 3 o 4 en un tiro sube el Combo (x2, x3, x5). Las bandas, combinaciones, tacadas, saltos y massés suman más.', 'q');
    y += 58;
    }
    // info
    OM.UI.panel(ctx, P.x + 4, y, P.w - 8, 66, 'inset');
    (info.lines || []).forEach((ln, i) => { if (ln) OM.FONT.draw(ctx, ln.text, cx, y + 6 + i * 12, { color: ln.color || '7', align: 'center' }); });
    if (M && M.mode === '9' && info.W) OM.Match.onTable(info.W).sort((a, b) => a - b).forEach((n, k) => OM.TABLE.drawBall(ctx, { num: n, kind: M.gold[n] != null ? 'oro' : 'normal', rollX: 0, rollY: 0 }, P.x + 22 + k * 16, y + 54, t));
    y += 72;
    if (info.buttons) info.buttons(y);
    OM.FONT.draw(ctx, 'Semilla ' + S.seedStr, cx, P.y + P.h - 11, { color: '4', align: 'center' });
  };

  return H;
})();
