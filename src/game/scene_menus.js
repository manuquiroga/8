// OCHO MALDITO — escenas: título, taco, mapa, tienda, sobres, colección, game over, victoria, pausa.
window.OM = window.OM || {};
OM.SCENES = OM.SCENES || {};

(function () {
  const L = OM.LAYOUT;
  const CX = OM.W / 2;
  const AREA = { x: 192, y: 72, w: 442, h: 282 };

  // ---------------- PAUSA ----------------
  OM.drawPause = function (ctx, t, onClose) {
    const G = OM.G;
    ctx.globalAlpha = 0.7; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 0, OM.W, OM.H); ctx.globalAlpha = 1;
    const w = 200, h = 176, x = CX - w / 2, y = 90;
    OM.UI.panel(ctx, x, y, w, h, 'dark');
    OM.FONT.draw(ctx, 'PAUSA', CX, y + 10, { color: '8', size: 2, align: 'center', shadow: '0' });
    let yy = y + 38;
    if (G.button(x + 20, yy, w - 40, 18, 'CONTINUAR', 'green', false, 'Escape')) onClose(); yy += 24;
    if (G.button(x + 20, yy, w - 40, 18, 'CRT: ' + (OM.META.crt ? 'SÍ' : 'NO'), 'dark')) { OM.META.crt = !OM.META.crt; OM.saveMeta(); } yy += 24;
    if (G.button(x + 20, yy, w - 40, 18, 'MÚSICA: ' + (OM.META.music ? 'SÍ' : 'NO'), 'dark')) { OM.META.music = !OM.META.music; OM.saveMeta(); OM.music(OM._track); } yy += 24;
    if (G.button(x + 20, yy, w - 40, 18, 'SONIDO: ' + (OM.META.sfx ? 'SÍ' : 'NO'), 'dark')) { OM.META.sfx = !OM.META.sfx; OM.saveMeta(); } yy += 24;
    if (G.button(x + 20, yy, w - 40, 18, 'ABANDONAR', 'red')) { onClose(); OM.go('gameover', { reason: 'quit' }); }
  };

  // ---------------- TÍTULO ----------------
  OM.SCENES.title = {
    enter() { OM.music('menu'); this.opts = false; },
    update() {},
    draw(ctx, t) {
      const G = OM.G, M = OM.META;
      OM.UI.drawBackground(ctx, t, 'title');
      OM.UI.logo(ctx, CX, 52, t);
      OM.FONT.draw(ctx, 'un roguelite de billar en el bar del infierno', CX, 168, { color: '6', align: 'center', shadow: '0' });
      const bw = 170, bx = CX - bw / 2;
      if (G.button(bx, 190, bw, 22, 'NUEVA PARTIDA', 'red', false, 'Enter')) OM.go('cues');
      if (G.button(bx, 214, bw, 18, 'COLECCIÓN', 'blue')) OM.go('collection');
      if (G.button(bx, 238, 82, 16, 'CRT ' + (M.crt ? 'SÍ' : 'NO'), 'dark')) { M.crt = !M.crt; OM.saveMeta(); }
      if (G.button(bx + 88, 238, 82, 16, 'MÚSICA ' + (M.music ? 'SÍ' : 'NO'), 'dark')) { M.music = !M.music; OM.saveMeta(); OM.music('menu'); }
      const seen = Object.keys(M.seen).length;
      const stats = 'Partidas ' + M.runs + '   ·   Victorias ' + M.wins + '   ·   Mejor círculo ' + (M.best ? ['I', 'II', 'III', 'IV', 'V', 'VI', 'VI+'][Math.min(6, M.best)] : '-') + '   ·   Récord de tiro ' + OM.fmt(M.bestShot) + '   ·   Comodines ' + seen + '/' + OM.JOKERS.length;
      OM.FONT.draw(ctx, stats, CX, 300, { color: '5', align: 'center' });
      OM.FONT.draw(ctx, 'v1.0 · M: silenciar música', CX, 345, { color: '3', align: 'center' });
    },
  };

  // ---------------- SELECCIÓN DE TACO ----------------
  OM.SCENES.cues = {
    enter() { this.sel = 0; },
    draw(ctx, t) {
      const G = OM.G;
      OM.UI.drawBackground(ctx, t, 'map');
      OM.FONT.draw(ctx, 'ELIGE TU TACO', CX, 24, { color: '8', size: 2, align: 'center', shadow: '0' });
      OM.FONT.draw(ctx, 'Cada taco cambia las reglas de tu descenso', CX, 46, { color: '6', align: 'center' });
      const cw = 140, gap = 10, total = OM.CUES.length * cw + (OM.CUES.length - 1) * gap;
      OM.CUES.forEach((c, i) => {
        const x = Math.round(CX - total / 2 + i * (cw + gap)), y = 72;
        const sel = this.sel === i, hov = G.inside(x, y, cw, 200);
        OM.UI.panel(ctx, x, y - (sel ? 4 : 0), cw, 200, sel ? 'gold' : 'dark');
        const yy = y - (sel ? 4 : 0);
        ctx.save(); ctx.translate(x + cw / 2 - 24, yy + 14); ctx.scale(2, 2);
        OM.PX.draw(ctx, 'cue_' + c.id, 0, 0);
        ctx.restore();
        OM.FONT.draw(ctx, c.name, x + cw / 2, yy + 70, { color: sel ? 'i' : '8', align: 'center', shadow: '0' });
        OM.FONT.wrap(OM.colorize(c.desc), cw - 16).forEach((ln, j) => OM.FONT.draw(ctx, ln, x + 8, yy + 88 + j * 11, { color: '7' }));
        if (c.joker) OM.CARDS.drawJoker(ctx, OM.jokerDef(c.joker), x + cw / 2 - 20, yy + 136, { t });
        if (hov) { G.cursor = 'grab'; if (G.clicked(x, y, cw, 200)) { this.sel = i; OM.sfx('card_flip'); } }
      });
      if (G.button(CX - 90, 296, 180, 24, 'DESCENDER', 'red', false, 'Enter')) {
        OM.R = OM.Run.create(OM.CUES[this.sel].id);
        OM.R.jokers.forEach((J) => (OM.META.seen[J.id] = 1));
        OM.META.runs++; OM.saveMeta();
        OM.go('map');
      }
      if (G.button(12, 330, 70, 18, 'VOLVER', 'dark', false, 'Escape')) OM.go('title');
    },
  };

  // ---------------- MAPA (selección de mesa) ----------------
  OM.SCENES.map = {
    enter() { OM.music('menu'); OM.HUD.sel = null; this.paused = false; this.showBalls = false; },
    update() { if (OM.IN.kp.Escape && !OM.HUD.picker) this.paused = !this.paused; },
    draw(ctx, t) {
      const R = OM.R, G = OM.G;
      const theme = OM.Run.circleDef(R).theme;
      OM.TABLE.drawBackdrop(ctx, theme, t);
      ctx.globalAlpha = 0.55; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 0, OM.W, OM.H); ctx.globalAlpha = 1;
      const self = this;
      OM.HUD.drawPanel(ctx, R, t, {
        title: 'PREPARACIÓN', target: OM.Run.target(R), score: 0, scoreShown: 0, sub: 'Próxima mesa',
        shotName: ' ', chips: 0, mult: 0, shots: R.baseShots + OM.Run.mods(R).extraShots,
        buttons(y) {
          if (G.button(L.panel.x + 8, y, 80, 16, 'BOLAS', 'blue')) self.showBalls = true;
          if (G.button(L.panel.x + 92, y, 80, 16, 'MENÚ', 'dark')) self.paused = true;
        },
      });
      OM.HUD.drawJokers(ctx, R, t, {});
      OM.HUD.drawItems(ctx, R, t, 'map', OM.SCENES.map.api);
      const cd = OM.Run.circleDef(R);
      OM.FONT.draw(ctx, R.infinite ? 'INFINITO · ' + (R.circle + 1) : 'CÍRCULO ' + cd.name, AREA.x + AREA.w / 2, AREA.y + 6, { color: 't', size: 2, align: 'center', shadow: '0' });
      const cw = 132, gap = 12;
      OM.TABLE_KINDS.forEach((k, i) => {
        const x = AREA.x + (AREA.w - (3 * cw + 2 * gap)) / 2 + i * (cw + gap), y = AREA.y + 30;
        const done = i < R.tableIdx, cur = i === R.tableIdx;
        const isBoss = i === 2, boss = isBoss ? OM.bossDef(OM.Run.bossId(R)) : null;
        ctx.globalAlpha = done ? 0.45 : cur ? 1 : 0.7;
        OM.UI.panel(ctx, x, y - (cur ? 4 + Math.round(Math.sin(t * 3)) : 0), cw, 220, isBoss ? 'blood' : cur ? 'gold' : 'dark');
        const yy = y - (cur ? 4 + Math.round(Math.sin(t * 3)) : 0);
        OM.FONT.draw(ctx, k.name.toUpperCase(), x + cw / 2, yy + 8, { color: isBoss ? 'd' : '8', align: 'center', shadow: '0' });
        if (boss) {
          OM.CARDS.drawBossMedal(ctx, boss, x + cw / 2 - 24, yy + 24, { t });
          OM.FONT.draw(ctx, boss.name, x + cw / 2, yy + 78, { color: 'c', align: 'center', shadow: '0' });
          OM.FONT.wrap(boss.desc, cw - 14).forEach((ln, j) => OM.FONT.draw(ctx, ln, x + cw / 2, yy + 92 + j * 10, { color: '7', align: 'center' }));
        } else {
          ctx.save(); ctx.translate(x + cw / 2, yy + 50); ctx.scale(3, 3);
          OM.TABLE.drawBall(ctx, { num: i === 0 ? 1 : 9, kind: 'normal', rollX: t * 4, rollY: 0 }, 0, 0, t);
          ctx.restore();
        }
        OM.FONT.draw(ctx, 'OBJETIVO', x + cw / 2, yy + 132, { color: '6', align: 'center' });
        OM.FONT.draw(ctx, OM.fmt(OM.Run.target(R, R.circle, i)), x + cw / 2, yy + 144, { color: 'c', size: 2, align: 'center', shadow: '0' });
        OM.FONT.draw(ctx, 'Recompensa {h}$' + k.reward + '{/}', x + cw / 2, yy + 166, { color: '7', align: 'center' });
        ctx.globalAlpha = 1;
        if (done) OM.FONT.draw(ctx, 'SUPERADA', x + cw / 2, yy + 196, { color: 'm', align: 'center', shadow: '0' });
        if (cur && G.button(x + 16, yy + 190, cw - 32, 20, 'JUGAR', isBoss ? 'red' : 'green', false, 'Enter')) OM.go('table');
      });
      if (this.showBalls) OM.HUD.drawBallsView(ctx, R, t, () => (this.showBalls = false));
      if (OM.HUD.picker) OM.HUD.drawPicker(ctx, R, t);
      if (this.paused) OM.drawPause(ctx, t, () => (this.paused = false));
    },
    api: { canUseItem: () => true, onEngrave() {} },
  };

  // ---------------- TIENDA ----------------
  OM.SCENES.shop = {
    enter() {
      const R = OM.R;
      this.shop = OM.Run.makeShop(R);
      R.rerollCost = 5;
      this.sel = null; this.pack = null; this.paused = false; this.showBalls = false;
      OM.HUD.sel = null;
      OM.music('shop');
      this.flip = 0;
    },
    update(dt) { this.flip += dt; if (OM.IN.kp.Escape && !OM.HUD.picker && !this.pack) this.paused = !this.paused; },
    draw(ctx, t) {
      const R = OM.R, G = OM.G, S = this.shop;
      OM.UI.drawBackground(ctx, t, 'shop');
      const self = this;
      OM.HUD.drawPanel(ctx, R, t, {
        title: 'TIENDA', target: OM.Run.target(R), sub: 'Objetivo de la próxima mesa', score: 0, scoreShown: 0, shotName: ' ', chips: 0, mult: 0,
        shots: R.baseShots + OM.Run.mods(R).extraShots,
        buttons(y) {
          if (G.button(L.panel.x + 8, y, 80, 16, 'BOLAS', 'blue')) self.showBalls = true;
          if (G.button(L.panel.x + 92, y, 80, 16, 'MENÚ', 'dark')) self.paused = true;
        },
      });
      OM.HUD.drawJokers(ctx, R, t, {});
      OM.HUD.drawItems(ctx, R, t, 'shop', OM.SCENES.map.api);
      // mostrador
      OM.UI.panel(ctx, AREA.x, AREA.y, AREA.w, AREA.h, 'dark');
      OM.FONT.draw(ctx, 'LA TIENDA DEL BARQUERO', AREA.x + AREA.w / 2, AREA.y + 8, { color: 'h', size: 2, align: 'center', shadow: '0' });
      const offers = [];
      S.slots.forEach((o, i) => offers.push({ o, x: AREA.x + 30 + i * 62, y: AREA.y + 44, w: L.cardW, h: L.cardH }));
      S.items.forEach((o, i) => offers.push({ o, x: AREA.x + 170 + i * 52, y: AREA.y + 50, w: L.smallCardW, h: L.smallCardH }));
      S.packs.forEach((o, i) => offers.push({ o, x: AREA.x + 290 + i * 62, y: AREA.y + 44, w: L.cardW, h: L.cardH }));
      OM.FONT.draw(ctx, 'COMODINES', AREA.x + 81, AREA.y + 32, { color: '6', align: 'center' });
      OM.FONT.draw(ctx, 'CONSUMIBLES', AREA.x + 211, AREA.y + 32, { color: '6', align: 'center' });
      OM.FONT.draw(ctx, 'SOBRES', AREA.x + 341, AREA.y + 32, { color: '6', align: 'center' });
      offers.forEach((of, idx) => {
        const o = of.o;
        if (o.sold) return;
        const hov = G.inside(of.x, of.y, of.w, of.h) && !this.pack && !OM.HUD.picker;
        const sel = this.sel === o;
        const yy = of.y - (sel ? 5 : 0);
        if (o.type === 'joker') OM.CARDS.drawJoker(ctx, o.J.def, of.x, yy, { t, hover: hov, selected: sel, wobble: true, seed: idx });
        else if (o.type === 'item') OM.CARDS.drawItem(ctx, OM.itemDef(o.id), of.x, yy, { t, hover: hov, selected: sel });
        else OM.CARDS.drawPack(ctx, o.kind, of.x, yy, { t, hover: hov, selected: sel });
        // etiqueta de precio
        OM.UI.panel(ctx, of.x + of.w / 2 - 14, of.y + of.h + 4, 28, 13, 'inset');
        OM.FONT.draw(ctx, '$' + o.price, of.x + of.w / 2, of.y + of.h + 7, { color: R.money >= o.price ? 'h' : 'b', align: 'center' });
        if (hov) {
          G.cursor = 'grab';
          if (o.type === 'joker') { const rl = OM.RARITY[o.J.def.rarity]; G.tooltip(of.x + of.w / 2, of.y + of.h + 36, o.J.def.name, OM.HUD.jokerDesc(o.J), rl.color, rl.name); }
          else if (o.type === 'item') { const d = OM.itemDef(o.id); G.tooltip(of.x + of.w / 2, of.y + of.h + 36, d.name, OM.colorize(d.desc), 't', d.kind === 'luna' ? 'Luna Negra' : d.kind === 'grabado' ? 'Grabado' : 'Arcano'); }
          else G.tooltip(of.x + of.w / 2, of.y + of.h + 36, PACKS[o.kind].name, PACKS[o.kind].desc, 'h', 'Sobre');
          if (G.clicked(of.x, of.y, of.w, of.h)) { this.sel = sel ? null : o; OM.sfx('card_flip'); }
        }
        if (sel) {
          const full = (o.type === 'joker' && R.jokers.length >= R.jokerSlots) || (o.type === 'item' && R.items.length >= R.itemSlots);
          const can = R.money >= o.price && !full;
          const bw = 50;
          if (G.button(of.x + of.w / 2 - bw / 2, of.y + of.h + 20, bw, 15, full ? 'LLENO' : 'COMPRAR', 'green', !can)) this.buy(o);
        }
      });
      // botones inferiores
      const by = AREA.y + AREA.h - 34;
      if (G.button(AREA.x + 20, by, 150, 24, 'SIGUIENTE MESA', 'red')) { OM.go('map'); }
      if (G.button(AREA.x + 180, by, 110, 24, 'REROLL $' + R.rerollCost, 'green', R.money < R.rerollCost)) {
        R.money -= R.rerollCost; R.rerollCost++;
        const keepPacks = S.packs;
        this.shop = OM.Run.makeShop(R); this.shop.packs = keepPacks; this.sel = null;
        OM.sfx('reroll');
      }
      OM.FONT.draw(ctx, 'Interés: {h}$1{/} por cada {h}$5{/} (máx. {h}$' + R.interestCap + '{/})', AREA.x + AREA.w - 12, by + 9, { color: '6', align: 'right' });
      // frase del barquero
      OM.FONT.draw(ctx, QUOTES[Math.floor(t / 6) % QUOTES.length], AREA.x + AREA.w / 2, AREA.y + 150, { color: '5', align: 'center' });
      // overlays
      if (this.pack) this.drawPack(ctx, t);
      if (this.showBalls) OM.HUD.drawBallsView(ctx, R, t, () => (this.showBalls = false));
      if (OM.HUD.picker) OM.HUD.drawPicker(ctx, R, t);
      if (this.paused) OM.drawPause(ctx, t, () => (this.paused = false));
    },
    buy(o) {
      const R = OM.R;
      R.money -= o.price; o.sold = true; this.sel = null;
      OM.sfx('buy');
      OM.FX.burst(OM.IN.mx, OM.IN.my, 'gold', 10);
      if (o.type === 'joker') { R.jokers.push(o.J); OM.META.seen[o.id] = 1; OM.saveMeta(); }
      else if (o.type === 'item') R.items.push(o.id);
      else { this.pack = { kind: o.kind, opts: OM.Run.openPack(R, o.kind), t: 0 }; OM.sfx('pack_open'); OM.FX.flash('h', 0.25, 0.3); }
    },
    drawPack(ctx, t) {
      const R = OM.R, G = OM.G, P = this.pack;
      P.t += 1 / 60;
      ctx.globalAlpha = 0.8; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 0, OM.W, OM.H); ctx.globalAlpha = 1;
      OM.FONT.draw(ctx, PACKS[P.kind].name.toUpperCase(), CX, 96, { color: 'h', size: 2, align: 'center', shadow: '0', wave: 1, t });
      OM.FONT.draw(ctx, 'Elige una carta', CX, 120, { color: '7', align: 'center' });
      P.opts.forEach((op, i) => {
        const big = op.type === 'joker';
        const w = big ? L.cardW : L.smallCardW, h = big ? L.cardH : L.smallCardH;
        const x = CX - 100 + i * 100 - w / 2, y = 150;
        const appear = Math.min(1, Math.max(0, (P.t - i * 0.15) * 4));
        if (appear <= 0) return;
        if (appear < 1) { OM.CARDS.drawBack(ctx, x, y, big ? 'joker' : 'item', { t }); return; }
        if (!op.flipped) { op.flipped = true; OM.sfx('card_flip', { pitch: 1 + i * 0.1 }); }
        const hov = G.inside(x, y, w, h) && !OM.HUD.picker;
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(2, 2); ctx.translate(-w / 2, -h / 2);
        if (big) OM.CARDS.drawJoker(ctx, op.J.def, 0, 0, { t, hover: hov, wobble: true, seed: i });
        else OM.CARDS.drawItem(ctx, OM.itemDef(op.id), 0, 0, { t, hover: hov });
        ctx.restore();
        let name, desc, color, sub;
        if (big) { name = op.J.def.name; desc = OM.HUD.jokerDesc(op.J); const rl = OM.RARITY[op.J.def.rarity]; color = rl.color; sub = rl.name; }
        else { const d = OM.itemDef(op.id); name = d.name; desc = OM.colorize(d.desc); color = 't'; sub = d.kind; }
        if (hov) { G.cursor = 'grab'; G.tooltip(x + w / 2, y + h * 1.5 + 30, name, desc, color, sub); }
        const full = big && R.jokers.length >= R.jokerSlots;
        if (G.button(x + w / 2 - 30, y + h + 36, 60, 16, full ? 'LLENO' : 'ELEGIR', 'green', full || !!OM.HUD.picker)) {
          this.pack = null;
          if (big) { R.jokers.push(op.J); OM.META.seen[op.id] = 1; OM.saveMeta(); OM.sfx('buy'); }
          else OM.HUD.useItem(R, -1, 'shop', OM.SCENES.map.api, op.id);
        }
      });
      if (G.button(CX - 40, 300, 80, 16, 'SALTAR', 'dark')) this.pack = null;
    },
  };

  const PACKS = {
    arcano: { name: 'Sobre Arcano', desc: 'Elige 1 de 3 Arcanos. Se usa al instante.' },
    luna: { name: 'Sobre Lunar', desc: 'Elige 1 de 3 Lunas Negras. Se usa al instante.' },
    grabado: { name: 'Sobre de Grabados', desc: 'Elige 1 de 3 Grabados para tus bolas.' },
    maldito: { name: 'Sobre Maldito', desc: 'Elige 1 de 3 comodines. Puede contener LEGENDARIOS.' },
  };
  const QUOTES = [
    '"Aquí abajo nadie juega limpio, forastero."',
    '"La 8 siempre vuelve. Siempre."',
    '"¿Dinero? Lo que cuenta es el Mult."',
    '"Cada bola que metes es un alma que te debe un favor."',
    '"Vende lo que no te sirva. Aquí todo tiene precio."',
  ];

  // ---------------- COLECCIÓN ----------------
  OM.SCENES.collection = {
    draw(ctx, t) {
      const G = OM.G;
      OM.UI.drawBackground(ctx, t, 'map');
      OM.FONT.draw(ctx, 'COLECCIÓN DE COMODINES', CX, 14, { color: '8', size: 2, align: 'center', shadow: '0' });
      const per = 10, cw = 40, ch = 54, gx = 18, gy = 20;
      const x0 = CX - (per * cw + (per - 1) * gx) / 2;
      OM.JOKERS.forEach((j, i) => {
        const x = x0 + (i % per) * (cw + gx), y = 46 + Math.floor(i / per) * (ch + gy);
        const seen = OM.META.seen[j.id];
        if (seen) OM.CARDS.drawJoker(ctx, j, x, y, { t, hover: G.inside(x, y, cw, ch) });
        else OM.CARDS.drawBack(ctx, x, y, 'joker', { t });
        if (G.inside(x, y, cw, ch)) {
          if (seen) { const rl = OM.RARITY[j.rarity]; G.tooltip(x + cw / 2, y + ch + 4, j.name, OM.colorize(j.desc), rl.color, rl.name); }
          else G.tooltip(x + cw / 2, y + ch + 4, '???', 'Aún no descubierto.', '5', OM.RARITY[j.rarity].name);
        }
      });
      if (G.button(CX - 50, 330, 100, 18, 'VOLVER', 'dark', false, 'Escape')) OM.go('title');
    },
  };

  // ---------------- GAME OVER ----------------
  OM.SCENES.gameover = {
    enter(arg) { this.arg = arg || {}; OM.music('gameover'); OM.sfx('lose'); this.t0 = OM.time; OM.saveMeta(); },
    draw(ctx, t) {
      const R = OM.R, G = OM.G;
      OM.UI.drawBackground(ctx, t, 'gameover');
      OM.FONT.draw(ctx, 'HAS CAÍDO', CX, 40, { color: 'c', size: 2, align: 'center', shadow: '0', wave: 1, t, scale: 2 });
      if (!R) { if (G.button(CX - 60, 300, 120, 22, 'MENÚ', 'dark')) OM.go('title'); return; }
      const cd = OM.Run.circleDef(R);
      const w = 300, x = CX - w / 2, y = 96;
      OM.UI.panel(ctx, x, y, w, 150, 'blood');
      const rows = [
        ['Círculo alcanzado', cd.name],
        ['Mesas superadas', String(R.stats.tables)],
        ['Mejor tiro', OM.fmt(R.stats.bestShot)],
        ['Bolas embocadas', String(R.stats.balls)],
        ['Tiros totales', String(R.stats.shots)],
        ['Semilla', R.seedStr],
      ];
      if (this.arg.reason === 'score') rows.unshift(['Puntuación', OM.fmt(this.arg.score) + ' / ' + OM.fmt(this.arg.target)]);
      rows.forEach((r, i) => {
        OM.FONT.draw(ctx, r[0], x + 14, y + 12 + i * 18, { color: '7' });
        OM.FONT.draw(ctx, r[1], x + w - 14, y + 12 + i * 18, { color: i === 0 ? 'c' : '8', align: 'right' });
      });
      R.jokers.forEach((J, i) => OM.CARDS.drawJoker(ctx, J.def, CX - (R.jokers.length * 46) / 2 + i * 46 + 3, 254, { t }));
      if (G.button(CX - 130, 322, 124, 22, 'NUEVA PARTIDA', 'red', false, 'Enter')) OM.go('cues');
      if (G.button(CX + 6, 322, 124, 22, 'MENÚ', 'dark', false, 'Escape')) OM.go('title');
    },
  };

  // ---------------- VICTORIA ----------------
  OM.SCENES.victory = {
    enter() { OM.META.wins++; OM.saveMeta(); OM.music('menu'); OM.sfx('win_table'); this.t0 = OM.time; },
    draw(ctx, t) {
      const R = OM.R, G = OM.G;
      OM.UI.drawBackground(ctx, t, 'victory');
      if ((t * 10 | 0) % 7 === 0) OM.FX.burst(100 + Math.random() * 440, 60 + Math.random() * 100, 'gold', 4);
      OM.FX.draw(ctx);
      OM.FONT.draw(ctx, '¡HAS ESCAPADO', CX, 40, { color: 'h', size: 2, align: 'center', shadow: '0', wave: 1, t, scale: 2 });
      OM.FONT.draw(ctx, 'DEL ABISMO!', CX, 76, { color: 'h', size: 2, align: 'center', shadow: '0', wave: 1, t, scale: 2 });
      OM.FONT.draw(ctx, 'La 8 maldita se rinde ante ti. Por ahora.', CX, 120, { color: '7', align: 'center' });
      const rows = [['Mejor tiro', OM.fmt(R.stats.bestShot)], ['Bolas embocadas', String(R.stats.balls)], ['Dinero ganado', '$' + R.stats.money], ['Semilla', R.seedStr]];
      rows.forEach((r, i) => {
        OM.FONT.draw(ctx, r[0], CX - 110, 150 + i * 16, { color: '6' });
        OM.FONT.draw(ctx, r[1], CX + 110, 150 + i * 16, { color: '8', align: 'right' });
      });
      R.jokers.forEach((J, i) => OM.CARDS.drawJoker(ctx, J.def, CX - (R.jokers.length * 46) / 2 + i * 46 + 3, 226, { t, wobble: true, seed: i }));
      if (G.button(CX - 150, 316, 140, 22, 'MODO INFINITO', 'gold')) { R.infinite = true; OM.go('shop'); }
      if (G.button(CX + 10, 316, 140, 22, 'MENÚ', 'dark')) OM.go('title');
    },
  };
})();
