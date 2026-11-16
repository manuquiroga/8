// OCHO MALDITO — HUD compartido: comodines, consumibles, panel izquierdo, selector de bolas.
window.OM = window.OM || {};

OM.HUD = (function () {
  const L = OM.LAYOUT;
  const H = {
    sel: null,        // {type:'joker'|'item', idx}
    drag: null,       // {idx, ox, x}
    jiggle: {},       // uid -> tiempo restante de rebote
    picker: null,     // {title, onPick(ball), filter}
    itemMode: 'map',
  };

  function jokerX(R, i) {
    const n = Math.max(R.jokerSlots, 1);
    const sp = n > 1 ? Math.min(65, (L.jokers.w - L.cardW) / (n - 1)) : 0;
    return Math.round(L.jokers.x + i * sp);
  }
  function itemX(i) { return L.consum.x + 22 + i * 46; }
  H.jokerX = jokerX; H.itemX = itemX;
  H.bump = (uid) => { H.jiggle[uid] = 0.35; };

  function rarityLabel(def) { const r = OM.RARITY[def.rarity]; return { text: r.name, color: r.color }; }
  function jokerDesc(J) {
    let d = J.def.desc;
    if (J.st && J.st.v !== undefined) d = d.replace('{v}', Math.round(J.st.v * 100) / 100);
    return OM.colorize(d);
  }
  H.jokerDesc = jokerDesc;

  // ---------- fila de comodines ----------
  H.drawJokers = function (ctx, R, t, opts = {}) {
    const IN = OM.IN, G = OM.G;
    const y0 = L.jokers.y + 2;
    // ranuras vacías
    for (let i = 0; i < R.jokerSlots; i++) {
      const x = jokerX(R, i);
      ctx.globalAlpha = 0.35; OM.UI.panel(ctx, x, y0, L.cardW, L.cardH, 'inset'); ctx.globalAlpha = 1;
    }
    OM.FONT.draw(ctx, R.jokers.length + '/' + R.jokerSlots, L.jokers.x + L.jokers.w - 2, L.jokers.y + L.jokers.h + 1, { color: '6', align: 'right' });
    // arrastre
    if (H.drag) {
      if (!IN.down) {
        const d = H.drag; H.drag = null;
        if (d.moved) {
          let ni = 0; for (let i = 0; i < R.jokers.length; i++) if (IN.mx > jokerX(R, i) + L.cardW / 2) ni = i;
          const [J] = R.jokers.splice(d.idx, 1); R.jokers.splice(ni, 0, J);
          H.sel = null; OM.sfx('card_flip');
        }
      } else if (Math.abs(IN.mx - H.drag.sx) > 3) H.drag.moved = true;
    }
    let hoverIdx = -1;
    R.jokers.forEach((J, i) => {
      let x = jokerX(R, i), y = y0;
      const dragging = H.drag && H.drag.idx === i && H.drag.moved;
      if (dragging) { x = Math.round(IN.mx - H.drag.ox); y = y0 + 4; }
      const hov = !H.drag && G.inside(x, y, L.cardW, L.cardH) && !H.picker;
      if (hov) hoverIdx = i;
      const sel = H.sel && H.sel.type === 'joker' && H.sel.idx === i;
      const jig = H.jiggle[J.uid] || 0;
      if (jig > 0) H.jiggle[J.uid] = jig - 1 / 60;
      const sc = 1 + Math.max(0, jig) * 0.6;
      OM.CARDS.drawJoker(ctx, J.def, x, y - (sel ? 6 : 0), { t, hover: hov || dragging, selected: sel, scale: sc, wobble: !dragging, seed: i });
      if (hov && IN.pressed && opts.interactive !== false) { H.drag = { idx: i, ox: IN.mx - x, sx: IN.mx, moved: false }; }
      if (hov && IN.released && H.drag === null && opts.interactive !== false && !IN.consumed) {
        H.sel = sel ? null : { type: 'joker', idx: i }; IN.consumed = true; OM.sfx('card_flip');
      }
    });
    // los clics de arrastre sin mover = seleccionar
    if (H.drag && !IN.down) H.drag = null;
    if (hoverIdx >= 0) {
      const J = R.jokers[hoverIdx];
      const rl = rarityLabel(J.def);
      G.cursor = 'grab';
      G.tooltip(jokerX(R, hoverIdx) + L.cardW / 2, y0 + L.cardH + 6, J.def.name, jokerDesc(J), rl.color, rl.text);
    }
    // botón vender
    if (H.sel && H.sel.type === 'joker' && R.jokers[H.sel.idx] && opts.interactive !== false) {
      const J = R.jokers[H.sel.idx];
      const x = jokerX(R, H.sel.idx);
      const p = OM.Run.sellPrice(J);
      if (G.button(x - 2, y0 + L.cardH - 2, 44, 14, 'VENDER $' + p, 'gold')) {
        R.money += p; R.jokers.splice(H.sel.idx, 1); H.sel = null;
        OM.sfx('sell'); OM.FX.burst(x + 20, y0 + 30, 'gold', 14); OM.FX.popText(x + 20, y0 + 20, '+$' + p, 'h');
        opts.onChange && opts.onChange();
      }
    }
  };

  // ---------- consumibles ----------
  H.drawItems = function (ctx, R, t, mode, api) {
    const G = OM.G, IN = OM.IN;
    const y0 = L.consum.y + 8;
    for (let i = 0; i < R.itemSlots; i++) {
      ctx.globalAlpha = 0.35; OM.UI.panel(ctx, itemX(i), y0, L.smallCardW, L.smallCardH, 'inset'); ctx.globalAlpha = 1;
    }
    OM.FONT.draw(ctx, R.items.length + '/' + R.itemSlots, L.consum.x + L.consum.w - 2, L.consum.y + L.consum.h + 1, { color: '6', align: 'right' });
    R.items.forEach((id, i) => {
      const def = OM.itemDef(id);
      const x = itemX(i), y = y0;
      const hov = G.inside(x, y, L.smallCardW, L.smallCardH) && !H.picker;
      const sel = H.sel && H.sel.type === 'item' && H.sel.idx === i;
      OM.CARDS.drawItem(ctx, def, x, y - (sel ? 5 : 0), { t, hover: hov, selected: sel });
      if (hov) {
        G.cursor = 'grab';
        G.tooltip(x + 15, y + L.smallCardH + 6, def.name, OM.colorize(def.desc), def.kind === 'luna' ? 'r' : def.kind === 'grabado' ? 'g' : 't', def.kind === 'luna' ? 'Luna Negra' : def.kind === 'grabado' ? 'Grabado' : 'Arcano');
        if (G.clicked(x, y, L.smallCardW, L.smallCardH)) { H.sel = sel ? null : { type: 'item', idx: i }; OM.sfx('card_flip'); }
      }
    });
    if (H.sel && H.sel.type === 'item' && R.items[H.sel.idx]) {
      const idx = H.sel.idx, id = R.items[idx], def = OM.itemDef(id);
      const x = itemX(idx) - 8, y = y0 + L.smallCardH - 3;
      const can = canUse(R, def, mode, api);
      if (G.button(x, y, 46, 13, 'USAR', 'green', !can)) { H.sel = null; useItem(R, idx, mode, api); }
      const sp = 1;
      if (G.button(x, y + 14, 46, 13, 'VENDER $' + sp, 'gold')) { R.items.splice(idx, 1); R.money += sp; H.sel = null; OM.sfx('sell'); }
    }
  };

  function canUse(R, def, mode, api) {
    if (def.when === 'table' && mode !== 'table') return false;
    if (mode === 'table' && api && !api.canUseItem()) return false;
    if (def.id === 'juicio' && R.jokers.length >= R.jokerSlots) return false;
    return true;
  }
  H.canUse = canUse;

  // Aplica un consumible. fromPack: no está en R.items.
  function useItem(R, idx, mode, api, fromPackId) {
    const id = fromPackId || R.items[idx];
    const def = OM.itemDef(id);
    const consume = () => { if (!fromPackId) R.items.splice(R.items.indexOf(id), 1); };
    const cx = 320, cy = 180;
    if (def.kind === 'luna') {
      consume();
      R.levels[def.shot]++;
      OM.sfx('level_up');
      OM.FX.flash('r', 0.25, 0.3);
      OM.FX.popText(cx, cy, OM.SHOT_TYPES[def.shot].name.toUpperCase() + ' NV.' + R.levels[def.shot], 'r', { size: 2 });
      return;
    }
    if (def.kind === 'grabado') {
      H.picker = {
        title: 'Elige una bola para ' + def.name.toUpperCase(),
        eng: def.eng,
        onPick(ball) {
          consume(); ball.kind = def.eng; OM.sfx('level_up'); H.picker = null;
          OM.FX.popText(cx, cy, OM.ENGRAVINGS[def.eng].name.toUpperCase() + '!', 'h', { size: 2 });
          api && api.onEngrave && api.onEngrave(ball);
        },
        onCancel() { H.picker = null; },
      };
      return;
    }
    consume();
    OM.sfx('card_flip');
    switch (id) {
      case 'tiza': api.addShot(1); OM.FX.popText(cx, cy, '+1 TIRO', 'q', { size: 2 }); break;
      case 'mano': api.ballInHand(); break;
      case 'rueda': api.rerack(); break;
      case 'ojo': api.fullGuide(); OM.FX.popText(cx, cy, 'GUÍA COMPLETA', 'r', { size: 2 }); break;
      case 'ermitano': { const g = Math.min(20, Math.max(0, R.money)); R.money += g; OM.sfx('coin'); OM.FX.popText(cx, cy, '+$' + g, 'h', { size: 2 }); break; }
      case 'alquimista': {
        const pool = R.balls.filter((b) => b.kind === 'normal');
        R.rng.shuffle(pool).slice(0, 2).forEach((b) => (b.kind = 'oro'));
        OM.sfx('coin'); OM.FX.popText(cx, cy, '¡ORO!', 'h', { size: 2 }); api && api.onEngrave && api.onEngrave(); break;
      }
      case 'juicio': {
        const jid = OM.Run.randomJoker(R, false);
        if (jid) { R.jokers.push(OM.Run.newJoker(jid)); OM.META.seen[jid] = 1; OM.saveMeta(); OM.sfx('pack_open'); }
        break;
      }
    }
  }
  H.useItem = useItem;

  // ---------- selector de bola (grabados) ----------
  H.drawPicker = function (ctx, R, t) {
    const P = H.picker; if (!P) return false;
    const G = OM.G;
    ctx.globalAlpha = 0.75; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 0, OM.W, OM.H); ctx.globalAlpha = 1;
    const w = 360, h = 150, x = (OM.W - w) / 2, y = 100;
    OM.UI.panel(ctx, x, y, w, h, 'gold');
    OM.FONT.draw(ctx, P.title, OM.W / 2, y + 10, { color: 'i', align: 'center', shadow: '0' });
    const balls = R.balls;
    let hov = null;
    balls.forEach((b, i) => {
      const col = i % 8, row = Math.floor(i / 8);
      const bx = x + 40 + col * 40, by = y + 48 + row * 40;
      const isH = G.inside(bx - 14, by - 14, 28, 28);
      if (isH) { hov = b; OM.UI.panel(ctx, bx - 15, by - 15, 30, 30, 'inset'); }
      ctx.save(); ctx.translate(bx, by); ctx.scale(2, 2);
      OM.TABLE.drawBall(ctx, { num: b.num, kind: b.kind, rollX: 0, rollY: 0 }, 0, 0, t);
      ctx.restore();
      if (isH && G.clicked(bx - 14, by - 14, 28, 28)) { P.onPick(b); }
    });
    if (hov) {
      const e = OM.ENGRAVINGS[hov.kind];
      OM.FONT.draw(ctx, 'Bola ' + hov.num + (hov.kind !== 'normal' ? ' · ' + e.name + ': ' + e.desc : ''), OM.W / 2, y + h - 34, { color: '7', align: 'center' });
    }
    if (P.onCancel && G.button(OM.W / 2 - 40, y + h - 20, 80, 14, 'CANCELAR', 'dark', false, 'Escape')) P.onCancel();
    return true;
  };

  // ---------- visor de bolas (solo lectura) ----------
  H.drawBallsView = function (ctx, R, t, onClose) {
    const G = OM.G;
    ctx.globalAlpha = 0.75; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 0, OM.W, OM.H); ctx.globalAlpha = 1;
    const w = 380, h = 200, x = (OM.W - w) / 2, y = 80;
    OM.UI.panel(ctx, x, y, w, h, 'dark');
    OM.FONT.draw(ctx, 'TU SET DE BOLAS', OM.W / 2, y + 8, { color: '8', align: 'center', shadow: '0', size: 2 });
    let hov = null;
    R.balls.forEach((b, i) => {
      const col = i % 8, row = Math.floor(i / 8);
      const bx = x + 50 + col * 40, by = y + 50 + row * 40;
      if (G.inside(bx - 14, by - 14, 28, 28)) hov = b;
      ctx.save(); ctx.translate(bx, by); ctx.scale(2, 2);
      OM.TABLE.drawBall(ctx, { num: b.num, kind: b.kind, rollX: t * 6, rollY: 0 }, 0, 0, t);
      ctx.restore();
    });
    // niveles de tiro
    const types = Object.keys(OM.SHOT_TYPES);
    types.forEach((k, i) => {
      const T = OM.SHOT_TYPES[k], lv = R.levels[k];
      const tx = x + 14 + i * 72, ty = y + 128;
      OM.FONT.draw(ctx, T.name, tx, ty, { color: '7' });
      OM.FONT.draw(ctx, 'nv.' + lv, tx, ty + 10, { color: 'r' });
      OM.FONT.draw(ctx, '{q}' + (T.chips + T.lvlChips * (lv - 1)) + '{/} x {c}' + (T.mult + T.lvlMult * (lv - 1)) + '{/}', tx, ty + 20, { color: '7' });
    });
    if (hov) {
      const e = OM.ENGRAVINGS[hov.kind];
      OM.FONT.draw(ctx, 'Bola ' + hov.num + ' · ' + (hov.num === 8 ? 40 : hov.num * 5) + ' Fichas' + (hov.kind !== 'normal' ? ' · ' + e.name + ': ' + e.desc : ''), OM.W / 2, y + 112, { color: 'i', align: 'center' });
    }
    if (G.button(OM.W / 2 - 40, y + h - 22, 80, 15, 'CERRAR', 'dark', false, 'Escape') || OM.IN.rpressed) onClose();
  };

  // ---------- panel izquierdo ----------
  H.drawPanel = function (ctx, R, t, info) {
    const P = L.panel, G = OM.G;
    OM.UI.panel(ctx, P.x, P.y, P.w, P.h, 'dark');
    const cx = P.x + P.w / 2;
    // bloque mesa/objetivo
    const boss = info.bossId ? OM.bossDef(info.bossId) : null;
    OM.UI.panel(ctx, P.x + 4, P.y + 4, P.w - 8, 62, boss ? 'blood' : 'inset');
    OM.FONT.draw(ctx, info.title, cx, P.y + 9, { color: boss ? 'd' : '7', align: 'center', shadow: '0' });
    if (boss) {
      if (OM.PX.has('boss_' + boss.id)) OM.PX.draw(ctx, 'boss_' + boss.id, P.x + 10, P.y + 22);
      OM.FONT.draw(ctx, 'OBJETIVO', P.x + 48, P.y + 24, { color: '6' });
      OM.FONT.draw(ctx, OM.fmt(info.target), P.x + 48, P.y + 36, { color: 'c', size: 2, shadow: '0' });
      if (G.inside(P.x + 4, P.y + 4, P.w - 8, 62)) G.tooltip(cx, P.y + 70, boss.name, boss.desc, 'b', 'Jefe');
    } else if (info.target) {
      OM.FONT.draw(ctx, 'OBJETIVO', cx, P.y + 24, { color: '6', align: 'center' });
      OM.FONT.draw(ctx, OM.fmt(info.target), cx, P.y + 36, { color: 'c', size: 2, align: 'center', shadow: '0' });
    }
    if (info.sub) OM.FONT.draw(ctx, info.sub, cx, P.y + 55, { color: '5', align: 'center' });
    // puntos
    let y = P.y + 72;
    OM.UI.panel(ctx, P.x + 4, y, P.w - 8, 36, 'inset');
    OM.FONT.draw(ctx, 'PUNTOS', P.x + 10, y + 5, { color: '6' });
    const sc = info.score || 0;
    const reached = info.target && sc >= info.target;
    OM.FONT.draw(ctx, OM.fmt(info.scoreShown != null ? info.scoreShown : sc), P.x + P.w - 10, y + 16, { color: reached ? 'n' : '8', size: 2, align: 'right', shadow: '0' });
    if (info.target) OM.UI.bar(ctx, P.x + 10, y + 30, P.w - 20, 3, Math.min(1, (info.scoreShown || 0) / info.target), reached ? 'm' : 'c');
    // tipo de tiro + fichas x mult
    y += 42;
    OM.UI.panel(ctx, P.x + 4, y, P.w - 8, 54, 'inset');
    OM.FONT.draw(ctx, info.shotName || ' ', cx, y + 5, { color: info.shotColor || '7', align: 'center', shadow: '0' });
    const bump = info.bump || { c: 0, m: 0 };
    const bw = 66;
    ctx.save();
    OM.UI.valueBox(ctx, P.x + 10 - Math.round(bump.c * 2), y + 18 - Math.round(bump.c * 2), bw + Math.round(bump.c * 4), 28 + Math.round(bump.c * 4), OM.fmt(info.chips || 0), 'chips');
    OM.UI.valueBox(ctx, P.x + P.w - 10 - bw - Math.round(bump.m * 2), y + 18 - Math.round(bump.m * 2), bw + Math.round(bump.m * 4), 28 + Math.round(bump.m * 4), info.multStr || OM.fmt(info.mult || 0), 'mult');
    ctx.restore();
    OM.FONT.draw(ctx, 'x', cx, y + 26, { color: 'c', align: 'center', size: 2, shadow: '0' });
    // tiros y dinero
    y += 60;
    OM.UI.panel(ctx, P.x + 4, y, 82, 40, 'inset');
    OM.FONT.draw(ctx, 'TIROS', P.x + 45, y + 4, { color: 'q', align: 'center' });
    OM.FONT.draw(ctx, info.shots != null ? String(info.shots) : '-', P.x + 45, y + 16, { color: 'q', size: 2, align: 'center', shadow: '0' });
    OM.UI.panel(ctx, P.x + 90, y, 82, 40, 'inset');
    OM.FONT.draw(ctx, 'DINERO', P.x + 131, y + 4, { color: 'h', align: 'center' });
    OM.FONT.draw(ctx, '$' + R.money, P.x + 131, y + 16, { color: 'h', size: 2, align: 'center', shadow: '0' });
    // círculo
    y += 46;
    OM.UI.panel(ctx, P.x + 4, y, P.w - 8, 34, 'inset');
    const cd = OM.Run.circleDef(R);
    OM.FONT.draw(ctx, R.infinite ? 'INFINITO ' + (R.circle + 1) : 'CÍRCULO ' + cd.name.split(' · ')[0] + ' / VI', P.x + 10, y + 5, { color: 't' });
    OM.FONT.draw(ctx, cd.name.split(' · ')[1] || '', P.x + 10, y + 18, { color: '6' });
    for (let i = 0; i < 3; i++) {
      const done = i < R.tableIdx, cur = i === R.tableIdx;
      const px = P.x + P.w - 50 + i * 14;
      if (OM.PX.has('ui_dot')) {}
      ctx.fillStyle = OM.PAL[done ? 'm' : cur ? (i === 2 ? 'c' : 'h') : '3'];
      ctx.fillRect(px, y + 13, 8, 8);
      ctx.fillStyle = OM.PAL['0']; ctx.fillRect(px, y + 21, 8, 1);
    }
    // botones
    y += 40;
    if (info.buttons) info.buttons(y);
    OM.FONT.draw(ctx, 'Semilla ' + R.seedStr, cx, P.y + P.h - 11, { color: '4', align: 'center' });
  };

  return H;
})();
