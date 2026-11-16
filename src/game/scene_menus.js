// 8 — menús del 1v1: título, preparación (bot / 2 jugadores), sala online, draft de comodines,
// resultado de la serie, colección y pausa.
window.OM = window.OM || {};
OM.SCENES = OM.SCENES || {};

(function () {
  const L = OM.LAYOUT, MT = OM.Match;
  const CX = OM.W / 2;
  const PCOL = ['q', 'v'];
  const AREA = { x: 192, y: 72, w: 442, h: 282 };

  // ---------------- PAUSA ----------------
  OM.drawPause = function (ctx, t, onClose) {
    const G = OM.G;
    ctx.globalAlpha = 0.7; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 0, OM.W, OM.H); ctx.globalAlpha = 1;
    const w = 200, h = 176, x = CX - w / 2, y = 90;
    OM.UI.panel(ctx, x, y, w, h, 'dark');
    OM.FONT.draw(ctx, OM.NET.on ? 'MENÚ' : 'PAUSA', CX, y + 10, { color: '8', size: 2, align: 'center', shadow: '0' });
    let yy = y + 38;
    if (G.button(x + 20, yy, w - 40, 18, 'CONTINUAR', 'green', false, 'Escape')) onClose(); yy += 24;
    if (G.button(x + 20, yy, w - 40, 18, 'CRT: ' + (OM.META.crt ? 'SÍ' : 'NO'), 'dark')) { OM.META.crt = !OM.META.crt; OM.saveMeta(); } yy += 24;
    if (G.button(x + 20, yy, w - 40, 18, 'MÚSICA: ' + (OM.META.music ? 'SÍ' : 'NO'), 'dark')) { OM.META.music = !OM.META.music; OM.saveMeta(); OM.music(OM._track); } yy += 24;
    if (G.button(x + 20, yy, w - 40, 18, 'SONIDO: ' + (OM.META.sfx ? 'SÍ' : 'NO'), 'dark')) { OM.META.sfx = !OM.META.sfx; OM.saveMeta(); } yy += 24;
    if (G.button(x + 20, yy, w - 40, 18, 'ABANDONAR SERIE', 'red')) { onClose(); OM.NET.close(); OM.go('title'); }
  };

  // campo de texto simple (nombre, código de sala). Devuelve el nuevo valor.
  let field = null; // id del campo activo
  function textField(ctx, id, x, y, w, value, max, upper) {
    const G = OM.G, IN = OM.IN, on = field === id;
    OM.UI.panel(ctx, x, y, w, 18, on ? 'gold' : 'inset');
    OM.FONT.draw(ctx, value + (on && Math.floor(OM.time * 2) % 2 ? '_' : ''), x + w / 2, y + 5, { color: on ? '8' : '7', align: 'center' });
    if (G.inside(x, y, w, 18)) {
      G.cursor = 'grab';
      if (G.clicked(x, y, w, 18)) {
        if (IN.touch) { const v = window.prompt('', value); if (v != null) value = v.slice(0, max); }
        else { field = on ? null : id; OM.sfx('click'); }
      }
    } else if (on && IN.released) field = null;
    if (field === id) {
      OM.typing = true;
      if (IN.typed) value = (value + IN.typed).replace(/[{}]/g, '').slice(0, max);
      if (IN.kp.Backspace) value = value.slice(0, -1);
      if (IN.kp.Enter || IN.kp.Escape) { field = null; IN.kp.Enter = IN.kp.Escape = false; }
    }
    return upper ? value.toUpperCase() : value;
  }
  function optionRow(ctx, label, x, y, opts, cur, bw) {
    const G = OM.G; let out = cur;
    OM.FONT.draw(ctx, label, x - 6, y + 5, { color: '6', align: 'right' });
    opts.forEach((o, i) => { if (G.button(x + i * (bw + 4), y, bw, 16, o.name, o.id === cur ? 'gold' : 'dark')) out = o.id; });
    return out;
  }
  const MODE_OPTS = Object.keys(OM.MODES).map((id) => ({ id, name: OM.MODES[id].name }));

  function startSeries(cfg, me) {
    OM.S = MT.newSeries(cfg);
    OM.S.me = me == null ? 0 : me;
    OM.S.cfg = cfg;
    OM.S.players.forEach((P) => P.jokers.forEach((J) => (OM.META.seen[J.id] = 1)));
    OM.META.series++; OM.saveMeta();
    OM.go('draft');
  }

  // ---------------- TÍTULO ----------------
  OM.SCENES.title = {
    enter() { OM.music('menu'); OM.typing = false; field = null; },
    draw(ctx, t) {
      const G = OM.G, M = OM.META;
      OM.UI.drawBackground(ctx, t, 'title');
      OM.UI.logo(ctx, CX, 20, t);
      OM.FONT.draw(ctx, 'pool arcade 1 contra 1 en el bar del infierno', CX, 184, { color: '6', align: 'center', shadow: '0' });
      const bw = 170, bx = CX - bw / 2;
      let y = 200;
      if (G.button(bx, y, bw, 22, 'JUGAR CONTRA BOT', 'red', false, 'Enter')) OM.go('setup', { vs: 'bot' });
      y += 26;
      if (G.button(bx, y, 82, 18, '2 JUGADORES', 'green')) OM.go('setup', { vs: 'local' });
      if (G.button(bx + 88, y, 82, 18, 'ONLINE', 'blue')) OM.go('online');
      y += 22;
      if (G.button(bx, y, bw, 16, 'COLECCIÓN', 'dark')) OM.go('collection');
      y += 20;
      if (G.button(bx, y, 82, 16, 'CRT ' + (M.crt ? 'SÍ' : 'NO'), 'dark')) { M.crt = !M.crt; OM.saveMeta(); }
      if (G.button(bx + 88, y, 82, 16, 'MÚSICA ' + (M.music ? 'SÍ' : 'NO'), 'dark')) { M.music = !M.music; OM.saveMeta(); OM.music('menu'); }
      const seen = OM.JOKERS.filter((j) => M.seen[j.id]).length;
      const stats = 'Series ' + (M.series || 0) + '   ·   Ganadas ' + (M.wins || 0) + '   ·   Mejor serie ' + OM.fmt(M.bestPts || 0) + '   ·   Mejor tiro ' + OM.fmt(M.bestShot || 0) + '   ·   Comodines ' + seen + '/' + OM.JOKERS.length;
      ctx.globalAlpha = 0.7; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 303, OM.W, 14); ctx.fillRect(0, 342, OM.W, 14); ctx.globalAlpha = 1;
      OM.FONT.draw(ctx, stats, CX, 306, { color: '6', align: 'center' });
      OM.FONT.draw(ctx, 'v3.0 · 5 partidas, gana quien sume más puntos · M: silenciar música', CX, 345, { color: '5', align: 'center' });
    },
  };

  // carrusel de tacos. st = {sel, off}. Devuelve nada; modifica st.sel.
  function cuePicker(ctx, t, st, y, h) {
    const G = OM.G, N = OM.CUES.length, VIS = Math.min(5, N), kp = OM.IN.kp || {};
    if (!field) {
      if (kp.ArrowRight) { st.sel = (st.sel + 1) % N; OM.sfx('card_flip'); }
      if (kp.ArrowLeft) { st.sel = (st.sel + N - 1) % N; OM.sfx('card_flip'); }
    }
    if (st.sel < st.off) st.off = st.sel;
    if (st.sel >= st.off + VIS) st.off = st.sel - VIS + 1;
    st.off = Math.max(0, Math.min(N - VIS, st.off));
    const cw = 114, gap = 8, total = VIS * cw + (VIS - 1) * gap;
    if (st.off > 0 && G.button(4, y + h / 2 - 12, 14, 24, '<', 'dark')) { st.off--; st.sel = Math.min(st.sel, st.off + VIS - 1); }
    if (st.off + VIS < N && G.button(OM.W - 18, y + h / 2 - 12, 14, 24, '>', 'dark')) { st.off++; st.sel = Math.max(st.sel, st.off); }
    OM.CUES.forEach((c, i) => {
      if (i < st.off || i >= st.off + VIS) return;
      const x = Math.round(CX - total / 2 + (i - st.off) * (cw + gap));
      const sel = st.sel === i, hov = G.inside(x, y, cw, h), yy = y - (sel ? 4 : 0);
      OM.UI.panel(ctx, x, yy, cw, h, sel ? 'gold' : 'dark');
      ctx.save(); ctx.translate(x + cw / 2 - 24, yy + 10); ctx.scale(2, 2);
      OM.PX.draw(ctx, 'cue_' + (c.art || c.id), 0, 0);
      ctx.restore();
      OM.FONT.draw(ctx, c.name, x + cw / 2, yy + 64, { color: sel ? 'i' : '8', align: 'center', shadow: '0' });
      OM.FONT.wrap(OM.colorize(c.desc), cw - 14).forEach((ln, j) => OM.FONT.draw(ctx, ln, x + 7, yy + 80 + j * 11, { color: '7' }));
      if (hov) { G.cursor = 'grab'; if (G.clicked(x, y, cw, h)) { st.sel = i; OM.sfx('card_flip'); } }
    });
  }

  // ---------------- PREPARACIÓN (contra bot o 2 jugadores en el mismo dispositivo) ----------------
  OM.SCENES.setup = {
    enter(arg) {
      const M = OM.META;
      this.vs = (arg && arg.vs) || 'bot';
      this.step = 0; // jugador que está eligiendo taco
      this.names = [M.name || 'Jugador', this.vs === 'local' ? (M.name2 || 'Jugador 2') : ''];
      this.cues = [Math.max(0, OM.CUES.findIndex((c) => c.id === M.cue)), 0];
      this.st = { sel: this.cues[0], off: 0 };
      this.mode = OM.MODES[M.mode] ? M.mode : '8'; this.bot = M.bot || 'medio';
      field = null;
    },
    draw(ctx, t) {
      const G = OM.G, M = OM.META, local = this.vs === 'local', p = this.step;
      OM.typing = false;
      OM.UI.drawBackground(ctx, t, 'map');
      OM.FONT.draw(ctx, local ? 'SERIE DE 2 JUGADORES' : 'SERIE CONTRA BOT', CX, 8, { color: '8', size: 2, align: 'center', shadow: '0' });
      this.mode = optionRow(ctx, 'JUEGO', 250, 32, MODE_OPTS, this.mode, 70);
      if (!local) this.bot = optionRow(ctx, 'RIVAL', 250, 51, OM.BOT_LEVELS, this.bot, 70);
      else OM.FONT.draw(ctx, 'os turnáis en este mismo dispositivo', 250, 56, { color: '5' });
      OM.FONT.draw(ctx, OM.MODES[this.mode].desc, 480, 37, { color: '5' });
      OM.FONT.draw(ctx, 'TACO DE', CX - 64, 78, { color: PCOL[p], align: 'right', shadow: '0' });
      this.names[p] = textField(ctx, 'name' + p, CX - 58, 72, 116, this.names[p], 10);
      OM.FONT.draw(ctx, '(clic para cambiar el nombre)', CX + 64, 78, { color: '4' });
      cuePicker(ctx, t, this.st, 100, 162);
      this.cues[p] = this.st.sel;
      const last = !local || p === 1;
      if (G.button(CX - 90, 280, 180, 24, last ? '¡A JUGAR!' : 'SIGUIENTE JUGADOR', 'red', false, field ? null : 'Enter')) {
        if (!this.names[p].trim()) this.names[p] = 'Jugador ' + (p + 1);
        if (!last) { this.step = 1; this.st = { sel: this.cues[1], off: 0 }; field = null; return; }
        M.name = this.names[0]; M.cue = OM.CUES[this.cues[0]].id; M.mode = this.mode; M.bot = this.bot;
        if (local) M.name2 = this.names[1];
        const bot = OM.BOT_LEVELS.find((b) => b.id === this.bot);
        const players = [{ name: this.names[0].trim(), kind: 'human', cue: OM.CUES[this.cues[0]].id }];
        if (local) players.push({ name: this.names[1].trim() === players[0].name ? this.names[1].trim() + ' 2' : this.names[1].trim(), kind: 'human', cue: OM.CUES[this.cues[1]].id });
        else players.push({ name: bot.botName, kind: 'bot', level: bot.id, cue: OM.CUES[Math.floor(Math.random() * OM.CUES.length)].id });
        startSeries({ mode: this.mode, players });
      }
      OM.FONT.draw(ctx, '5 partidas · antes de cada una eliges un comodín · las partidas 3, 4 y 5 traen obstáculos', CX, 314, { color: '5', align: 'center' });
      if (G.button(12, 334, 70, 18, 'VOLVER', 'dark', false, field ? null : 'Escape')) { if (p === 1) { this.step = 0; this.st = { sel: this.cues[0], off: 0 }; } else OM.go('title'); }
    },
  };

  // ---------------- ONLINE: crear sala / unirse / sala de espera ----------------
  OM.SCENES.online = {
    enter() {
      const M = OM.META;
      this.state = 'menu'; this.code = ''; this.err = null; this.ready = false; this.busy = false;
      this.name = M.name || 'Jugador'; this.cue = Math.max(0, OM.CUES.findIndex((c) => c.id === M.cue));
      this.mode = OM.MODES[M.mode] ? M.mode : '8'; this.hello = 0; this.started = false;
      field = null;
      OM.NET.close();
    },
    sendHello() { OM.NET.send({ t: 'hello', name: this.name.trim() || 'Jugador', cue: OM.CUES[this.cue].id, ready: this.ready }); if (OM.NET.role === 'h') OM.NET.send({ t: 'cfg', mode: this.mode }); },
    begin(st) {
      if (this.started) return;
      this.started = true;
      const me = OM.NET.me();
      OM.META.name = this.name; OM.META.cue = OM.CUES[this.cue].id;
      startSeries({ seed: st.seed, mode: st.mode, players: st.players.map((p, i) => ({ name: p.name, cue: p.cue, kind: i === me ? 'human' : 'remote' })) }, me);
    },
    draw(ctx, t) {
      const G = OM.G, N = OM.NET;
      OM.typing = false;
      OM.UI.drawBackground(ctx, t, 'map');
      OM.FONT.draw(ctx, '1 CONTRA 1 ONLINE', CX, 14, { color: '8', size: 2, align: 'center', shadow: '0' });
      const back = () => { N.close(); OM.go('title'); };
      if (!N.available()) {
        OM.UI.panel(ctx, CX - 210, 80, 420, 90, 'dark');
        ['Tu navegador no permite el online (hace falta WebRTC).', ' ', 'Prueba con Chrome, Firefox, Edge o Safari actualizados.', ' ', 'Mientras tanto: 2 JUGADORES en este dispositivo, o contra un bot.']
          .forEach((ln, i) => OM.FONT.draw(ctx, ln, CX, 92 + i * 14, { color: '7', align: 'center' }));
        if (G.button(CX - 50, 220, 100, 20, 'VOLVER', 'dark', false, 'Escape')) back();
        return;
      }
      if (this.err) OM.FONT.draw(ctx, this.err, CX, 46, { color: 'c', align: 'center', shadow: '0' });
      if (this.state === 'menu') {
        OM.FONT.draw(ctx, 'TU NOMBRE', CX - 64, 86, { color: '6', align: 'right' });
        this.name = textField(ctx, 'oname', CX - 58, 80, 116, this.name, 10);
        if (G.button(CX - 90, 120, 180, 24, 'CREAR SALA', 'red', this.busy)) {
          this.busy = true; this.err = null;
          N.host().then(() => { this.state = 'lobby'; this.busy = false; }).catch((e) => { this.err = (e && e.message) || 'No se pudo crear la sala'; this.busy = false; });
        }
        OM.FONT.draw(ctx, 'o únete con el código de 4 letras de tu rival:', CX, 166, { color: '6', align: 'center' });
        this.code = textField(ctx, 'code', CX - 58, 182, 116, this.code, 4, true);
        if (G.button(CX - 90, 208, 180, 24, 'UNIRSE', 'green', this.busy || this.code.length < 4)) {
          this.busy = true; this.err = null;
          N.join(this.code).then(() => { this.state = 'lobby'; this.busy = false; }).catch((e) => { this.err = e.message || 'No se pudo entrar'; this.busy = false; });
        }
        if (G.button(12, 334, 70, 18, 'VOLVER', 'dark', false, field ? null : 'Escape')) back();
        return;
      }
      // ----- sala -----
      const host = N.role === 'h', rv = N.lobby || {};
      this.hello -= 1 / 60;
      if (this.hello <= 0) { this.hello = 1; this.sendHello(); }
      if (!host && N.cfg) this.mode = N.cfg.mode;
      if (N.start) { this.begin(N.start); return; }
      if (N.error) this.err = N.error;
      OM.FONT.draw(ctx, 'SALA', CX - 40, 44, { color: '6', align: 'right' });
      OM.FONT.draw(ctx, N.code, CX, 36, { color: 'i', size: 2, align: 'center', shadow: '0', wave: 1, t });
      OM.FONT.draw(ctx, N.peer ? 'rival conectado' : 'esperando al rival: pásale este código', CX, 60, { color: N.peer ? 'm' : '6', align: 'center' });
      // mi lado
      const colMe = PCOL[N.me()], colRv = PCOL[1 - N.me()];
      const draw = (x, title, col, name, cueId, ready, mine) => {
        OM.UI.panel(ctx, x, 78, 200, 190, mine ? 'gold' : 'dark');
        OM.FONT.draw(ctx, title, x + 100, 84, { color: col, align: 'center', shadow: '0' });
        const c = OM.cueDef(cueId);
        if (!mine) OM.FONT.draw(ctx, name || '...', x + 100, 104, { color: '8', align: 'center' });
        if (c) {
          ctx.save(); ctx.translate(x + 76, 122); ctx.scale(2, 2); OM.PX.draw(ctx, 'cue_' + (c.art || c.id), 0, 0); ctx.restore();
          OM.FONT.draw(ctx, c.name, x + 100, 176, { color: 'i', align: 'center', shadow: '0' });
          OM.FONT.wrap(OM.colorize(c.desc), 180).forEach((ln, j) => OM.FONT.draw(ctx, ln, x + 10, 192 + j * 11, { color: '7' }));
        }
        OM.FONT.draw(ctx, ready ? '¡LISTO!' : 'eligiendo...', x + 100, 250, { color: ready ? 'm' : '5', align: 'center', shadow: '0' });
      };
      draw(CX - 210, 'TÚ', colMe, this.name, OM.CUES[this.cue].id, this.ready, true);
      draw(CX + 10, 'RIVAL', colRv, rv.name, rv.cue, rv.ready, false);
      const n0 = this.name; this.name = textField(ctx, 'oname', CX - 168, 98, 116, this.name, 10);
      if (!this.ready) {
        const N_ = OM.CUES.length;
        if (G.button(CX - 204, 136, 16, 24, '<', 'dark') || (!field && OM.IN.kp.ArrowLeft)) { this.cue = (this.cue + N_ - 1) % N_; this.hello = 0; OM.sfx('card_flip'); }
        if (G.button(CX - 32, 136, 16, 24, '>', 'dark') || (!field && OM.IN.kp.ArrowRight)) { this.cue = (this.cue + 1) % N_; this.hello = 0; OM.sfx('card_flip'); }
      }
      if (n0 !== this.name) this.hello = Math.min(this.hello, 0.3);
      // modo (lo elige el anfitrión)
      if (host) { const m = optionRow(ctx, 'JUEGO', CX - 108, 276, MODE_OPTS, this.mode, 70); if (m !== this.mode) { this.mode = m; this.hello = 0; } }
      else OM.FONT.draw(ctx, 'JUEGO: ' + OM.MODES[this.mode].name + ' (lo elige el anfitrión)', CX, 281, { color: '6', align: 'center' });
      if (G.button(CX - 90, 300, 180, 24, this.ready ? 'ESPERANDO AL RIVAL...' : '¡LISTO!', this.ready ? 'dark' : 'red', !N.peer && !this.ready)) { this.ready = !this.ready; this.hello = 0; }
      // el anfitrión arranca cuando los dos están listos
      if (host && this.ready && rv.ready && N.peer && !this.started) {
        const st = { t: 'start', seed: Math.floor(Math.random() * 1e9), mode: this.mode, players: [{ name: this.name.trim() || 'Anfitrión', cue: OM.CUES[this.cue].id }, { name: (rv.name || 'Invitado') === this.name.trim() ? rv.name + ' 2' : rv.name || 'Invitado', cue: rv.cue || 'peregrino' }] };
        N.send(st); this.begin(st);
      }
      if (G.button(12, 334, 70, 18, 'SALIR', 'dark', false, field ? null : 'Escape')) back();
    },
  };

  // ---------------- DRAFT: cada jugador elige 1 comodín antes de cada partida ----------------
  OM.SCENES.draft = {
    enter(arg) {
      const S = OM.S;
      if (arg && arg.next) { S.matchIdx++; S.M = null; } // venimos de la mesa: pasa a la siguiente partida
      this.offers = [MT.draftOffers(S, 0), MT.draftOffers(S, 1)];
      this.picked = [undefined, undefined];
      this.t0 = OM.time; this.doneT = null; this.paused = false; this.botT = 0.9; this.left = false; this.flipped = {};
      OM.HUD.sel = null; OM.typing = false;
      OM.music('shop');
    },
    choose(pi, id) {
      const S = OM.S;
      this.picked[pi] = id;
      if (OM.NET.on && S.players[pi].kind === 'human') OM.NET.send({ t: 'pick', match: S.matchIdx, pi, id });
      OM.sfx('buy'); OM.FX.flash(PCOL[pi], 0.2, 0.25);
    },
    update(dt) {
      const S = OM.S;
      if (OM.IN.kp.Escape) this.paused = !this.paused;
      this.botT -= dt;
      S.players.forEach((P, pi) => {
        if (this.picked[pi] !== undefined) return;
        if (P.kind === 'bot' && this.botT <= 0) this.choose(pi, OM.AI.draft(this.offers[pi]));
        if (P.kind === 'remote') { const id = OM.NET.picks[S.matchIdx + ':' + pi]; if (id !== undefined) { this.picked[pi] = id; OM.sfx('buy'); } }
      });
      if (this.doneT == null && this.picked.every((p) => p !== undefined)) this.doneT = 1.6;
      if (this.doneT != null) {
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.left) {
          this.left = true;
          this.picked.forEach((id, pi) => { MT.pick(S, pi, id); OM.META.seen[id] = 1; });
          OM.saveMeta();
          OM.go('table');
        }
      }
    },
    draw(ctx, t) {
      const S = OM.S, G = OM.G;
      OM.UI.drawBackground(ctx, t, 'shop');
      // quién elige ahora en este dispositivo
      const cur = S.players.findIndex((P, pi) => P.kind === 'human' && this.picked[pi] === undefined);
      const view = cur >= 0 ? cur : S.players[S.me] && S.players[S.me].kind === 'human' ? S.me : 0;
      const obs = S.obstacles[S.matchIdx] || [];
      const lines = [
        { text: 'PRÓXIMA: ' + OM.MODES[MT.matchMode(S, S.matchIdx)].name, color: 'i' },
        { text: 'Victoria +' + OM.fmt(OM.POINTS.win[S.matchIdx]) + ' pts', color: '7' },
        { text: 'Saca ' + S.players[S.lastLoser].name, color: PCOL[S.lastLoser] },
      ];
      const self = this;
      OM.HUD.drawPanel(ctx, S, t, { turn: view, lines, buttons(y) { if (G.button(L.panel.x + 8, y, 164, 16, 'MENÚ', 'dark')) self.paused = true; } });
      OM.HUD.drawJokers(ctx, S, view, t, { locked: true });
      OM.HUD.drawRivalJokers(ctx, S, 1 - view, t);
      OM.UI.panel(ctx, AREA.x, AREA.y, AREA.w, AREA.h, 'dark');
      const ax = AREA.x + AREA.w / 2;
      if (cur >= 0) {
        const P = S.players[cur], offers = this.offers[cur];
        OM.FONT.draw(ctx, 'ELIGE UN COMODÍN', ax, AREA.y + 8, { color: 'h', size: 2, align: 'center', shadow: '0' });
        OM.FONT.draw(ctx, P.name + (offers.length > 3 ? ' · vas por detrás: eliges entre ' + offers.length : ' · te lo quedas toda la serie'), ax, AREA.y + 30, { color: PCOL[cur], align: 'center', shadow: '0' });
        const n = offers.length, sp = n > 3 ? 106 : 132, appearT = OM.time - this.t0;
        offers.forEach((id, i) => {
          const def = OM.jokerDef(id), rar = OM.RARITY[def.rarity];
          const x = Math.round(ax + (i - (n - 1) / 2) * sp - 40), y = AREA.y + 50;
          if (appearT < 0.25 + i * 0.15) { ctx.save(); ctx.translate(x, y); ctx.scale(2, 2); OM.CARDS.drawBack(ctx, 0, 0, 'joker', { t }); ctx.restore(); return; }
          if (!this.flipped[cur + ':' + i]) { this.flipped[cur + ':' + i] = true; OM.sfx('card_flip', { pitch: 1 + i * 0.1 }); }
          const hov = G.inside(x, y, 80, 108);
          OM.CARDS.drawJoker(ctx, def, x, y - (hov ? 4 : 0), { t, hover: hov, wobble: true, seed: i, scale: 2 });
          OM.FONT.draw(ctx, def.name, x + 40, y + 116, { color: '8', align: 'center', shadow: '0' });
          OM.FONT.draw(ctx, rar.name + (def.active ? ' · ACTIVO' : def.rival ? ' · TRASTADA' : ''), x + 40, y + 128, { color: rar.color, align: 'center' });
          OM.FONT.wrap(OM.HUD.defDesc(def), sp - 8).slice(0, 6).forEach((ln, j) => OM.FONT.draw(ctx, ln, x + 40 - (sp - 8) / 2, y + 142 + j * 10, { color: '7' }));
          if (hov) G.cursor = 'grab';
          if ((hov && G.clicked(x, y, 80, 108)) || G.button(x + 8, AREA.y + AREA.h - 24, 64, 18, 'ELEGIR', 'green', false, 'Digit' + (i + 1))) { this.choose(cur, id); this.t0 = OM.time; }
        });
      } else {
        // todos eligieron (o falta el rival online / el bot)
        OM.FONT.draw(ctx, this.doneT != null ? '¡A LA MESA!' : 'ESPERANDO AL RIVAL...', ax, AREA.y + 8, { color: 'h', size: 2, align: 'center', shadow: '0', wave: 1, t });
        S.players.forEach((P, pi) => {
          const id = this.picked[pi], x = ax + (pi ? 40 : -120), y = AREA.y + 60;
          OM.FONT.draw(ctx, P.name, x + 40, y - 16, { color: PCOL[pi], align: 'center', shadow: '0' });
          if (id === undefined) { ctx.save(); ctx.translate(x, y); ctx.scale(2, 2); OM.CARDS.drawBack(ctx, 0, 0, 'joker', { t }); ctx.restore(); OM.FONT.draw(ctx, 'eligiendo...', x + 40, y + 118, { color: '5', align: 'center' }); return; }
          const def = OM.jokerDef(id);
          OM.CARDS.drawJoker(ctx, def, x, y, { t, wobble: true, seed: pi, scale: 2 });
          OM.FONT.draw(ctx, def.name, x + 40, y + 116, { color: '8', align: 'center', shadow: '0' });
          OM.FONT.wrap(OM.HUD.defDesc(def), 150).slice(0, 5).forEach((ln, j) => OM.FONT.draw(ctx, ln, x + 40 - 75, y + 130 + j * 10, { color: '7' }));
        });
      }
      // obstáculos de la partida que viene
      if (obs.length) {
        const oy = L.panel.y + 258;
        obs.forEach((id, i) => { const o = OM.obstacleDef(id); OM.CARDS.drawBossMedal(ctx, o, L.panel.x + 14 + i * 28, oy + 22, { t, scale: 0.5 }); if (G.inside(L.panel.x + 14 + i * 28, oy + 22, 24, 24)) G.tooltip(L.panel.x + 88, oy - 30, o.name, o.desc, 'b', 'Obstáculo'); });
      }
      if (this.paused) OM.drawPause(ctx, t, () => (this.paused = false));
      if (OM.NET.on && OM.NET.error) {
        OM.UI.panel(ctx, CX - 130, 140, 260, 60, 'blood');
        OM.FONT.draw(ctx, OM.NET.error, CX, 152, { color: 'c', align: 'center', shadow: '0' });
        if (G.button(CX - 60, 172, 120, 18, 'SALIR AL MENÚ', 'dark')) { OM.NET.close(); OM.go('title'); }
      }
    },
  };

  // ---------------- RESULTADO DE LA SERIE ----------------
  OM.SCENES.final = {
    drawsFX: true,
    enter() {
      const S = OM.S, M = OM.META;
      this.win = MT.seriesWinner(S);
      const meP = S.players[S.me], human = S.players[this.win].kind === 'human';
      this.happy = human;
      if (meP && meP.kind === 'human') {
        M.bestPts = Math.max(M.bestPts || 0, ...S.players.filter((p) => p.kind === 'human').map((p) => p.points));
        if (S.players[this.win].kind === 'human' && S.players.some((p) => p.kind !== 'human')) M.wins = (M.wins || 0) + 1;
      }
      OM.saveMeta();
      OM.music(human ? 'menu' : 'gameover'); OM.sfx(human ? 'win_table' : 'lose');
      OM.FX.clear();
    },
    draw(ctx, t) {
      const S = OM.S, G = OM.G, w = this.win;
      OM.UI.drawBackground(ctx, t, this.happy ? 'victory' : 'gameover');
      if (this.happy && (t * 10 | 0) % 7 === 0) OM.FX.burst(100 + Math.random() * 440, 60 + Math.random() * 100, 'gold', 4);
      OM.FX.draw(ctx);
      OM.FONT.draw(ctx, '¡' + S.players[w].name.toUpperCase() + ' GANA LA SERIE!', CX, 24, { color: PCOL[w], size: 2, align: 'center', shadow: '0', wave: 1, t, scale: 2 });
      S.players.forEach((P, pi) => {
        const x = CX + (pi ? 8 : -248), y = 84, pw = 240;
        OM.UI.panel(ctx, x, y, pw, 196, pi === w ? 'gold' : 'dark');
        OM.FONT.draw(ctx, P.name, x + 12, y + 10, { color: PCOL[pi], size: 2, shadow: '0' });
        OM.FONT.draw(ctx, OM.fmt(P.points), x + pw - 12, y + 10, { color: '8', size: 2, align: 'right', shadow: '0' });
        const rows = [['Partidas ganadas', P.wins + ' de ' + S.n], ['Mejor tiro', OM.fmt(P.stats.best)], ['Bolas embocadas', String(P.stats.balls)], ['Tiros', String(P.stats.shots)], ['Faltas', String(P.stats.fouls)], ['Taco', OM.cueDef(P.cue).name.replace('Taco ', '')]];
        rows.forEach((r, i) => { OM.FONT.draw(ctx, r[0], x + 12, y + 38 + i * 13, { color: '6' }); OM.FONT.draw(ctx, r[1], x + pw - 12, y + 38 + i * 13, { color: '8', align: 'right' }); });
        const n = P.jokers.length, sp = Math.min(38, (pw - 24 - 30) / Math.max(1, n - 1));
        P.jokers.forEach((J, i) => {
          const jx = x + 12 + i * sp, jy = y + 122, def = OM.jokerDef(J.id);
          OM.CARDS.drawJoker(ctx, def, jx, jy, { t, scale: 0.75, wobble: true, seed: i });
          if (G.inside(jx, jy, 30, 40)) G.tooltip(jx + 15, jy + 46, def.name, OM.HUD.jokerDesc(J), OM.RARITY[def.rarity].color, OM.RARITY[def.rarity].name);
        });
      });
      const off = OM.NET.on;
      if (!off && G.button(CX - 150, 300, 140, 24, 'REVANCHA', 'red', false, 'Enter')) startSeries(Object.assign({}, S.cfg, { seed: null }), S.me);
      if (G.button(off ? CX - 70 : CX + 10, 300, 140, 24, 'MENÚ', 'dark', false, 'Escape')) { OM.NET.close(); OM.go('title'); }
      OM.FONT.draw(ctx, 'Semilla ' + S.seedStr, CX, 340, { color: '4', align: 'center' });
    },
  };

  // ---------------- COLECCIÓN ----------------
  OM.SCENES.collection = {
    draw(ctx, t) {
      const G = OM.G;
      OM.UI.drawBackground(ctx, t, 'map');
      OM.FONT.draw(ctx, 'COLECCIÓN DE COMODINES', CX, 12, { color: '8', size: 2, align: 'center', shadow: '0' });
      const per = 13, cw = 40, ch = 54, gx = 6, gy = 12;
      const x0 = CX - (per * cw + (per - 1) * gx) / 2;
      OM.JOKERS.forEach((j, i) => {
        const x = x0 + (i % per) * (cw + gx), y = 40 + Math.floor(i / per) * (ch + gy);
        const seen = OM.META.seen[j.id];
        if (seen) OM.CARDS.drawJoker(ctx, j, x, y, { t, hover: G.inside(x, y, cw, ch) });
        else OM.CARDS.drawBack(ctx, x, y, 'joker', { t });
        if (G.inside(x, y, cw, ch)) {
          const rl = OM.RARITY[j.rarity];
          if (seen) G.tooltip(x + cw / 2, y + ch + 4, j.name, OM.HUD.defDesc(j), rl.color, rl.name);
          else G.tooltip(x + cw / 2, y + ch + 4, '???', 'Aún no ha salido en ninguna de tus series.', '5', rl.name);
        }
      });
      if (G.button(CX - 50, 334, 100, 18, 'VOLVER', 'dark', false, 'Escape')) OM.go('title');
    },
  };
})();
