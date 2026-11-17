// 8 — chat de la partida (OM.CHAT): online con el rival o contra el bot (que contesta y pica).
// Panel plegable a la derecha de la mesa (tecla T o la pestaña del borde) y avisos flotantes con el panel cerrado.
// Emojis propios de src/art/chat_art.js: en el texto van como :id: y la barra del panel los inserta.
//
// Antispam, en los dos lados (el que recibe nunca se fía del que envía):
//  - al enviar: ráfaga máxima, separación mínima, mensajes repetidos y silencio creciente si insistes
//  - al recibir: se limpia igual, se descartan las ráfagas y quien inunda queda silenciado un rato
//  - el texto se normaliza: sin códigos de color {x}, sin caracteres que la fuente no tiene,
//    letras repetidas recortadas, gritos (todo mayúsculas) en minúsculas y tope de emojis
//
// Ciclo: main.js llama a update(dt) antes de la escena (se queda el teclado y los clics que caen en el chat)
// y la mesa llama a draw(ctx, locked) en su sitio del orden de dibujo.
window.OM = window.OM || {};

OM.CHAT = (function () {
  const MAX_LEN = 80;
  const SP = {
    burst: 5, window: 10,    // como mucho 5 mensajes cada 10 s
    gap: 0.6,                // separación mínima entre mensajes (sin castigo: solo se frena)
    dup: 20,                 // no repetir el mismo mensaje en 20 s
    cool: [5, 10, 20, 30],   // silencio al pasarse (crece con cada aviso)
    calm: 60,                // tras 60 s sin avisos se olvidan
    recvBurst: 6,            // del rival: como mucho 6 cada 8 s...
    flood: 6, floodMute: 30, // ...y si se descartan 6 en 10 s queda silenciado 30 s
  };
  const PCOL = ['q', 'v'];
  const D = { x: 476, y: 70, w: 158, h: 242 };           // panel abierto (encima de la mesa, bajo la fila del rival)
  const TAB = { x: 620, y: 98, w: 20, h: 32 };           // pestaña con el panel cerrado (borde derecho)
  const MA = { x: D.x + 6, y: D.y + 21, w: D.w - 12, h: D.h - 83 }; // zona de mensajes
  const LH = 12, JUMBO = 24, EMO = 11;
  const PHRASES = ['¡Buena!', 'Ups', 'Suerte', 'gg'];

  const EMO_IDS = new Set((OM.EMOTES || []).map((e) => e.id));
  const TOKEN = /:([a-z]+):/g;
  const NATIVE = [
    [/[\u{1F602}\u{1F923}\u{1F606}\u{1F639}\u{1F601}\u{1F604}]/gu, 'jaja'],
    [/[\u{1F62D}\u{1F622}\u{1F972}\u{1F63F}\u{1F97A}]/gu, 'llora'],
    [/[\u{1F480}☠]️?/gu, 'calavera'],
    [/\u{1F525}/gu, 'fuego'],
    [/[\u{1F4B0}\u{1F4B5}\u{1FA99}\u{1F911}\u{1F4B8}]/gu, 'plata'],
    [/\u{1F3B1}/gu, 'ocho'],
    [/\u{1F573}️?/gu, 'dentro'],
    [/[\u{1F3C6}\u{1F91D}]/gu, 'gg'],
    [/(^|\s)[xX][dD]+(?=\s|$)/g, 'jaja'],
    [/(^|\s):'?[(\[]+(?=\s|$)/g, 'llora'],
  ];

  const C = {
    log: [], toasts: [], draft: '', open: false, focus: false, unread: 0, scroll: 0,
    muted: false, muteUntil: 0, strikes: 0, lastStrike: -99, sent: [], recent: [],
    recv: [], dropped: [], autoMute: 0, typingUntil: 0, typingSent: -99, lastDraft: '',
    press: null, bs: 0, bot: { queue: [], last: -99 }, series: null, welcomed: false, locked: false,
  };
  const now = () => performance.now() / 1000;
  const S_ = () => OM.S;
  const me = () => (S_() && S_().me) || 0;
  const rival = () => 1 - me();
  const botIdx = () => { const S = S_(); return S && !OM.NET.on ? S.players.findIndex((p) => p.kind === 'bot') : -1; };
  try { C.open = !!OM.META.chatOpen; } catch (e) {}

  // hay chat en la mesa online o contra un bot (no en 2 jugadores en el mismo dispositivo)
  function available() {
    const S = S_();
    if (OM.sceneName !== 'table' || !S || !S.players) return false;
    return OM.NET.on || botIdx() >= 0;
  }

  // ---------------- texto ----------------
  let glyphs = null;
  const hasGlyph = (ch) => {
    if (!glyphs) glyphs = OM.FONT && OM.FONT.glyphs && OM.FONT.glyphs[1];
    return ch === ' ' || !!(glyphs && glyphs[ch]);
  };
  // texto crudo -> mensaje limpio ("hola :fuego:") o '' si no queda nada
  function clean(raw) {
    let s = String(raw == null ? '' : raw).slice(0, 400).normalize('NFC');
    for (const [re, id] of NATIVE) s = s.replace(re, (m, pre) => (typeof pre === 'string' ? pre : '') + ' :' + id + ': ');
    const parts = [];
    let last = 0, m, emos = 0;
    TOKEN.lastIndex = 0;
    const pushText = (t) => { if (t) parts.push({ t }); };
    while ((m = TOKEN.exec(s))) {
      if (!EMO_IDS.has(m[1])) continue;
      pushText(s.slice(last, m.index));
      parts.push({ e: m[1] });
      last = m.index + m[0].length;
    }
    pushText(s.slice(last));
    // texto: solo lo que la fuente sabe dibujar, sin códigos de color ni letras estiradas
    let text = '';
    const out = [];
    parts.forEach((p) => {
      if (p.e) { out.push(p); return; }
      let t = p.t.replace(/[{}]/g, '').replace(/[\s ]+/g, ' ');
      t = Array.from(t).filter(hasGlyph).join('');
      t = t.replace(/(.)\1{3,}/gu, '$1$1$1');
      out.push({ t });
      text += t;
    });
    // gritos: todo en mayúsculas y largo -> minúsculas
    const letters = text.match(/\p{L}/gu) || [];
    const up = letters.filter((ch) => ch !== ch.toLowerCase()).length;
    const shout = letters.length >= 8 && up / letters.length > 0.8;
    // emojis: como mucho 3 iguales seguidos y 6 en total
    let res = '', prevE = null, run = 0;
    out.forEach((p) => {
      if (p.e) {
        run = p.e === prevE ? run + 1 : 1; prevE = p.e;
        if (run > 3 || emos >= 6) return;
        emos++;
        res += ' :' + p.e + ': ';
      } else {
        if (p.t.trim()) prevE = null;
        res += shout ? p.t.toLowerCase() : p.t;
      }
    });
    res = res.replace(/ {2,}/g, ' ').trim();
    if (shout) res = res.charAt(0).toUpperCase() + res.slice(1);
    // tope de largo sin partir un emoji
    if (res.length > MAX_LEN) {
      res = res.slice(0, MAX_LEN);
      const k = res.lastIndexOf(':'), open = (res.match(/:/g) || []).length % 2;
      if (open && k >= 0) res = res.slice(0, k);
      res = res.trim();
    }
    return res;
  }
  const emoOnly = (v) => { const w = v.split(' '); return w.length <= 3 && w.every((x) => /^:[a-z]+:$/.test(x)); };
  const dupKey = (v) => v.toLowerCase().replace(/[^\p{L}\p{N}:]/gu, '');

  // ---------------- registro ----------------
  function push(e) {
    e.t = now();
    C.log.push(e);
    if (C.log.length > 60) C.log.shift();
    if (e.pi != null && e.pi !== me()) {
      if (!C.open) {
        C.unread++;
        C.toasts.push({ e, life: 7 });
        if (C.toasts.length > 3) C.toasts.shift();
      }
      OM.sfx('card_hover', { pitch: 1.5, vol: 0.7 });
    }
    if (C.scroll > 0 && C.open) C.scroll += e.jumbo ? JUMBO : LH; // si estás leyendo arriba, no te mueve
  }
  const sys = (v, color) => push({ sys: true, v, color: color || '6' });
  function name(pi) { const S = S_(); return S && S.players[pi] ? S.players[pi].name : '?'; }

  function resetSeries() {
    C.log = []; C.toasts = []; C.unread = 0; C.scroll = 0; C.draft = ''; C.focus = false;
    C.muted = false; C.autoMute = 0; C.typingUntil = 0; C.bot.queue = []; C.welcomed = false;
    C.recv = []; C.dropped = [];
  }

  // ---------------- enviar ----------------
  function trySend(raw) {
    const v = clean(raw);
    if (!v) return false;
    const t = now();
    if (t - C.lastStrike > SP.calm) C.strikes = 0;
    if (t < C.muteUntil) { notice('Calma: podrás escribir en ' + Math.ceil(C.muteUntil - t) + ' s'); return false; }
    C.sent = C.sent.filter((x) => t - x < SP.window);
    if (C.sent.length && t - C.sent[C.sent.length - 1] < SP.gap) { notice('Más despacio.'); return false; }
    if (C.sent.length >= SP.burst) {
      const cd = SP.cool[Math.min(C.strikes, SP.cool.length - 1)];
      C.strikes++; C.lastStrike = t; C.muteUntil = t + cd;
      notice('Demasiado taco. Espera ' + cd + ' s.');
      return false;
    }
    const k = dupKey(v);
    C.recent = C.recent.filter((r) => t - r.t < SP.dup);
    if (C.recent.some((r) => r.k === k)) { notice('Eso ya lo dijiste.'); return false; }
    C.sent.push(t); C.recent.push({ k, t });
    push({ pi: me(), v, jumbo: emoOnly(v) });
    OM.sfx('click', { pitch: 1.2 });
    if (OM.NET.on) OM.NET.send({ t: 'chat', v });
    else botHear(v);
    return true;
  }
  let lastNotice = -99;
  function notice(v) {
    OM.sfx('click', { pitch: 0.55 });
    const t = now();
    if (t - lastNotice < 1.2) return; // el aviso tampoco hace spam
    lastNotice = t;
    sys(v, 'c');
  }

  // ---------------- recibir (online) ----------------
  function receive(m) {
    const t = now(), pi = rival();
    if (m.k === 'typing') { if (!C.muted && t >= C.autoMute) C.typingUntil = t + 3; return; }
    if (C.muted || t < C.autoMute) return;
    const v = clean(m.v);
    if (!v) return;
    C.recv = C.recv.filter((x) => t - x < SP.window);
    if (C.recv.length >= SP.recvBurst) {
      C.dropped = C.dropped.filter((x) => t - x < 10); C.dropped.push(t);
      if (C.dropped.length >= SP.flood) {
        C.autoMute = t + SP.floodMute; C.dropped = [];
        sys(name(pi) + ' silenciado ' + SP.floodMute + ' s por spam.', 'c');
      }
      return;
    }
    C.recv.push(t);
    C.typingUntil = 0;
    push({ pi, v, jumbo: emoOnly(v) });
  }
  function sendTyping() {
    if (!OM.NET.on || !C.draft || C.draft === C.lastDraft) return;
    C.lastDraft = C.draft;
    const t = now();
    if (t - C.typingSent < 2) return;
    C.typingSent = t;
    OM.NET.send({ t: 'chat', k: 'typing' });
  }

  // ---------------- el bot (el Tahúr tiene labia) ----------------
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const BOT = {
    start: ['Que ruede la bola. :ocho:', 'Tiza y a jugar. :tiza:', 'La casa invita a la primera. :plata:'],
    foulRival: ['¡Falta! :calavera:', 'Eso se paga. :plata:', 'Tiza, amigo. Mucha tiza. :tiza:', ':jaja:', 'La blanca tiene vida propia, ¿eh?'],
    foulMine: ['Ups. :calavera:', 'Eso no ha pasado.', 'Me resbaló el taco. :taco:'],
    bigMine: ['¿Lo viste? :fuego:', ':ocho: :fuego:', 'Así se tira. :taco:', 'Dentro, dentro y dentro. :dentro:'],
    bigRival: ['Suerte de principiante. :llora:', 'Hmm. No está mal.', ':llora:', 'Esa mesa está torcida...'],
    winMine: ['La casa siempre gana. :plata:', 'gg :gg:', '¿Otra ronda?'],
    winRival: ['gg :gg:', 'Me has dejado seco. :llora:', 'La próxima es mía. :calavera:'],
    reply: [':ocho:', 'Menos charla y más taco. :taco:', 'Ajá.', 'Shh, que me concentro.', ':jaja:'],
  };
  function botSay(lines, delay, force) {
    const b = botIdx();
    if (b < 0) return;
    const t = now();
    if (!force && (t - C.bot.last < 6 || C.bot.queue.length)) return;
    C.bot.last = t + delay;
    C.bot.queue.push({ at: t + delay, v: typeof lines === 'string' ? lines : pick(lines) });
  }
  function botHear(v) {
    const s = v.toLowerCase();
    let r = null;
    if (/\bgg\b|:gg:/.test(s)) r = ['gg :gg:', ':gg:', 'gg, buena partida.'];
    else if (/\b(hola|buenas|hey|que tal|qué tal)\b/.test(s)) r = ['Buenas. Que ruede la bola. :ocho:', 'Hola. ¿Traes dinero? :plata:'];
    else if (/suerte/.test(s)) r = ['No la necesito. :plata:', 'Igualmente. Te hará falta.'];
    else if (/:jaja:|ja ?ja|jeje|lol/.test(s)) r = [':jaja:', 'Ríete, ríete...'];
    else if (/:llora:/.test(s)) r = [':jaja:', 'No llores, que mancha el paño.'];
    else if (/buena|bien|crack|wow/.test(s)) r = ['Lo sé. :fuego:', 'Gracias. Años de práctica.'];
    else if (/trampa|tramposo|hack/.test(s)) r = ['Yo solo tengo buen pulso. :taco:', '¿Trampa? Se llama talento.'];
    else if (Math.random() < 0.4) r = BOT.reply;
    if (r) botSay(r, 1.2 + Math.random() * 1.2, true);
  }
  function tickBot() {
    const q = C.bot.queue, b = botIdx();
    if (!q.length) return;
    if (b < 0) { q.length = 0; return; }
    const t = now();
    if (t < q[0].at) { C.typingUntil = Math.max(C.typingUntil, t + 0.3); return; }
    const m = q.shift();
    C.typingUntil = 0;
    push({ pi: b, v: clean(m.v), jumbo: emoOnly(clean(m.v)) });
  }
  // la mesa avisa de lo que pasa: 'start' | 'foul' | 'big' | 'win' (pi = jugador al que le pasa)
  function event(kind, pi) {
    const b = botIdx();
    if (b < 0) return;
    const mine = pi === b, d = 0.8 + Math.random() * 1.2;
    if (kind === 'start') botSay(BOT.start, 1.5, true);
    else if (kind === 'win') botSay(mine ? BOT.winMine : BOT.winRival, 1.6, true);
    else if (Math.random() < (mine ? 0.35 : 0.6)) {
      if (kind === 'foul') botSay(mine ? BOT.foulMine : BOT.foulRival, d);
      else if (kind === 'big') botSay(mine ? BOT.bigMine : BOT.bigRival, d);
    }
  }

  // ---------------- maquetación de mensajes (texto + emojis) ----------------
  let SPACE = 4;
  const tw = (s) => OM.FONT.measure(s, 1);
  // entrada -> líneas [{h, items:[{k:'t'|'e', s|id, c, x, big}]}]
  function layout(e, maxW) {
    if (e._lay && e._lay.w === maxW) return e._lay.lines;
    SPACE = tw('a a') - tw('aa');
    const lines = [];
    let cur = { h: LH, items: [] }, x = 0;
    const flush = () => { lines.push(cur); cur = { h: LH, items: [] }; x = 0; };
    const place = (it, w) => {
      if (x > 0 && x + SPACE + w > maxW) flush();
      it.x = x ? x + SPACE : 0; cur.items.push(it); x = it.x + w;
    };
    if (!e.sys) place({ k: 't', s: name(e.pi) + ':', c: PCOL[e.pi] || '7' }, tw(name(e.pi) + ':'));
    if (e.jumbo) {
      flush();
      cur.h = JUMBO;
      e.v.split(' ').forEach((w, i) => cur.items.push({ k: 'e', id: w.slice(1, -1), x: i * (EMO * 2 + 3), big: true }));
      flush();
    } else {
      e.v.split(' ').forEach((w) => {
        const em = /^:([a-z]+):$/.exec(w);
        if (em && EMO_IDS.has(em[1])) { place({ k: 'e', id: em[1] }, EMO); return; }
        const col = e.sys ? e.color : '7';
        while (tw(w) > maxW) { // palabra más larga que la línea: se parte
          let n = w.length - 1;
          while (n > 1 && tw(w.slice(0, n)) > maxW) n--;
          if (x > 0) flush();
          place({ k: 't', s: w.slice(0, n), c: col }, tw(w.slice(0, n)));
          w = w.slice(n);
        }
        if (w) place({ k: 't', s: w, c: col }, tw(w));
      });
      if (cur.items.length) flush();
    }
    e._lay = { w: maxW, lines };
    return lines;
  }
  function drawItems(ctx, items, x, y, alpha) {
    items.forEach((it) => {
      if (it.k === 'e') {
        const s = OM.PX.get('emo_' + it.id);
        if (!s) return;
        if (it.big) ctx.drawImage(s.c, x + it.x, y + 1, EMO * 2, EMO * 2);
        else ctx.drawImage(s.c, x + it.x, y);
      } else OM.FONT.draw(ctx, it.s, x + it.x, y + 2, { color: it.c });
    });
  }
  // texto suelto con emojis en una línea (borrador, avisos). Devuelve el ancho.
  function inline(ctx, v, x, y, color, draw) {
    let cx = 0;
    v.split(/(:[a-z]+:)/).forEach((part) => {
      if (!part) return;
      const em = /^:([a-z]+):$/.exec(part);
      if (em && EMO_IDS.has(em[1])) {
        if (draw) ctx.drawImage(OM.PX.get('emo_' + em[1]).c, x + cx, y - 2);
        cx += EMO + 1;
      } else {
        if (draw) OM.FONT.draw(ctx, part, x + cx, y, { color });
        cx += tw(part) + 1;
      }
    });
    return cx;
  }

  // ---------------- zonas clicables ----------------
  function regions() {
    const R = [];
    if (C.open) {
      R.push({ id: 'mute', x: D.x + D.w - 34, y: D.y + 3, w: 14, h: 13 });
      R.push({ id: 'close', x: D.x + D.w - 18, y: D.y + 3, w: 14, h: 13 });
      let px = D.x + 6;
      const pw = PHRASES.map((p) => tw(p) + 8), gap = Math.floor((D.w - 12 - pw.reduce((a, b) => a + b, 0)) / (PHRASES.length - 1));
      PHRASES.forEach((p, i) => { R.push({ id: 'say', v: p, label: p, x: px, y: D.y + D.h - 58, w: pw[i], h: 13 }); px += pw[i] + gap; });
      const n = OM.EMOTES.length, ew = Math.floor((D.w - 12) / n);
      OM.EMOTES.forEach((em, i) => R.push({ id: 'emo', emo: em, x: D.x + 6 + i * ew + Math.floor((ew - 13) / 2), y: D.y + D.h - 43, w: 13, h: 14 }));
      R.push({ id: 'input', x: D.x + 6, y: D.y + D.h - 25, w: D.w - 12, h: 19 });
      R.push({ id: 'panel', x: D.x, y: D.y, w: D.w, h: D.h });
    } else {
      R.push({ id: 'tab', x: TAB.x, y: TAB.y, w: TAB.w, h: TAB.h });
      toastRects().forEach((r) => R.push({ id: 'tab', x: r.x, y: r.y, w: r.w, h: r.h }));
    }
    return R;
  }
  const inR = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  const hit = (x, y) => regions().find((r) => inR(r, x, y)) || null;
  function toastRects() {
    let y = D.y + 4;
    return C.toasts.map((t) => {
      const w = Math.min(176, toastW(t.e) + 10);
      const r = { x: 616 - w, y, w, h: 15, t };
      y += 18;
      return r;
    });
  }
  const toastText = (e) => (e.sys ? e.v : '{' + (PCOL[e.pi] || '7') + '}' + name(e.pi) + ':{/} ' + e.v);
  function toastW(e) { return inline(null, toastText(e).replace(/\{[^}]*\}/g, ''), 0, 0, '7', false); }

  function openChat(focus) {
    if (!C.open) { C.open = true; C.scroll = 0; OM.sfx('card_flip'); }
    C.unread = 0; C.toasts = [];
    if (focus) setFocus(true);
    try { OM.META.chatOpen = true; OM.saveMeta(); } catch (e) {}
  }
  function closeChat() {
    C.open = false; setFocus(false);
    try { OM.META.chatOpen = false; OM.saveMeta(); } catch (e) {}
  }
  function setFocus(on) {
    if (on && OM.IN.touch) { // en móvil no hay teclado propio: cuadro del navegador
      const v = window.prompt('Mensaje', C.draft);
      if (v != null) { C.draft = ''; trySend(v); }
      return;
    }
    C.focus = on;
  }
  function act(r) {
    if (r.id === 'tab') openChat(false);
    else if (r.id === 'close') { closeChat(); OM.sfx('click'); }
    else if (r.id === 'mute') {
      C.muted = !C.muted; OM.sfx('click');
      sys(C.muted ? name(rival()) + ' silenciado. No verás sus mensajes.' : 'Vuelves a ver los mensajes de ' + name(rival()) + '.', '5');
    } else if (r.id === 'say') trySend(r.v);
    else if (r.id === 'emo') {
      if (C.focus || C.draft) { addDraft(' :' + r.emo.id + ': '); setFocus(true); OM.sfx('card_hover'); }
      else trySend(':' + r.emo.id + ':');
    } else if (r.id === 'input') setFocus(true);
  }
  function addDraft(s) {
    C.draft = (C.draft + s).replace(/[{}]/g, '').replace(/ {2,}/g, ' ').replace(/^ /, '').slice(0, MAX_LEN);
  }

  // ---------------- bucle ----------------
  // Devuelve true si el chat se queda el teclado este fotograma.
  function update(dt) {
    const IN = OM.IN, t = now();
    if (OM.NET.on && OM.NET.chat) while (OM.NET.chat.length) receive(OM.NET.chat.shift());
    if (S_() !== C.series) { C.series = S_(); resetSeries(); }
    C.toasts.forEach((x) => (x.life -= dt));
    C.toasts = C.toasts.filter((x) => x.life > 0);
    tickBot();
    if (!available()) { C.focus = false; C.press = null; return false; }
    if (!C.welcomed) {
      C.welcomed = true;
      sys(OM.NET.on ? 'Chat con ' + name(rival()) + '. T para escribir.' : name(botIdx()) + ' escucha. T para escribir.', '5');
      if (!OM.NET.on && S_().matchIdx === 0) event('start', botIdx());
    }
    if (C.locked) { C.focus = false; C.press = null; return false; }

    // ratón: lo que cae en el chat no llega a la mesa
    const h = hit(IN.mx, IN.my);
    if (IN.pressed) {
      C.press = h;
      if (h) IN.consumed = true;
      else if (C.focus) C.focus = false; // clic fuera: deja de escribir (y el clic sigue a la mesa)
    }
    if (IN.released && C.press) {
      const p = C.press; C.press = null; IN.consumed = true;
      if (h && h.id === p.id && h.v === p.v && h.emo === p.emo) act(h);
    } else if (!IN.down) C.press = null;
    if (C.open && IN.wheel && inR(MA, IN.mx, IN.my)) { C.scroll = Math.max(0, C.scroll - IN.wheel * LH * 2); IN.wheel = 0; }

    // teclado (T abre y en el mismo fotograma ya escribe: lo que se teclee detrás no llega a la mesa)
    if (!C.focus) {
      if (!IN.kp.KeyT || IN.down || IN.keys.Space) return false;
      openChat(true);
      IN.typed = IN.typed.replace(/[tT]/, '');
      if (!C.focus) return false;
    }
    OM.typing = true;
    if (IN.typed) addDraft(IN.typed);
    if (IN.keys.Backspace) {
      if (IN.kp.Backspace) C.bs = 0.4; else if ((C.bs -= dt) <= 0) C.bs = 0.035; else return true;
      const m = /:[a-z]+: ?$/.exec(C.draft);
      C.draft = m && EMO_IDS.has(m[0].trim().slice(1, -1)) ? C.draft.slice(0, m.index).replace(/ $/, '') : C.draft.slice(0, -1);
    }
    if (IN.kp.Enter) {
      if (C.draft.trim()) { if (trySend(C.draft)) C.draft = ''; }
      else setFocus(false);
    }
    if (IN.kp.Escape) setFocus(false);
    sendTyping();
    if (t < C.muteUntil) C.typingSent = t; // silenciado: no anuncies que escribes
    return true;
  }

  // ratón encima del chat (la mesa no apunta ni coloca la blanca ahí)
  function over() { return available() && !C.locked && !!hit(OM.IN.mx, OM.IN.my); }

  // ---------------- dibujo ----------------
  function draw(ctx, locked) {
    C.locked = !!locked;
    if (!available()) return;
    const IN = OM.IN, G = OM.G, t = now();
    const hov = C.locked ? null : hit(IN.mx, IN.my);
    if (hov && hov.id !== 'panel') G.cursor = 'grab';
    if (!C.open) { drawClosed(ctx, hov, t); return; }

    // sin usarlo, el panel deja ver un poco la mesa de debajo
    const idleA = C.focus || (hov && !C.locked) ? 1 : 0.86;
    ctx.globalAlpha = idleA; OM.UI.panel(ctx, D.x, D.y, D.w, D.h, 'dark');
    ctx.globalAlpha = 0.35 * idleA; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(D.x + 3, D.y + 3, D.w - 6, D.h - 6); ctx.globalAlpha = 1;
    // cabecera
    OM.FONT.draw(ctx, 'CHAT', D.x + 7, D.y + 6, { color: '8', shadow: '0' });
    const rv = rival(), nm = name(rv);
    const st = OM.NET.on ? (OM.NET.peer ? 'm' : 'c') : 'h';
    ctx.fillStyle = OM.PAL[st]; ctx.fillRect(D.x + 34, D.y + 8, 3, 3);
    let lbl = nm; while (lbl.length > 2 && tw(lbl) > D.w - 82) lbl = lbl.slice(0, -1);
    OM.FONT.draw(ctx, lbl + (lbl !== nm ? '…' : ''), D.x + 40, D.y + 6, { color: C.muted ? '4' : PCOL[rv] });
    regions().forEach((r) => {
      if (r.id === 'mute') iconBtn(ctx, r, hov === r || (hov && hov.id === r.id), () => speaker(ctx, r.x + 3, r.y + 3, C.muted));
      if (r.id === 'close') iconBtn(ctx, r, hov && hov.id === r.id, () => OM.FONT.draw(ctx, 'x', r.x + 5, r.y + 2, { color: '7' }));
    });
    ctx.fillStyle = OM.PAL['3']; ctx.fillRect(D.x + 5, D.y + 18, D.w - 10, 1);

    drawLog(ctx, t);

    // escribiendo...
    if (t < C.typingUntil) {
      const dots = '.'.repeat(1 + (Math.floor(t * 3) % 3));
      OM.FONT.draw(ctx, name(rv) + ' escribe' + dots, D.x + 7, D.y + D.h - 70, { color: '5' });
    }
    // frases rápidas y emojis
    regions().forEach((r) => {
      const on = hov && hov.id === r.id && hov.v === r.v && hov.emo === r.emo;
      if (r.id === 'say') OM.UI.button(ctx, r.x, r.y, r.w, r.h, r.label, on ? (IN.down ? 'down' : 'hover') : 'idle', 'dark');
      if (r.id === 'emo') {
        if (on) { ctx.fillStyle = OM.PAL['4']; ctx.fillRect(r.x, r.y, r.w, r.h); }
        ctx.drawImage(OM.PX.get('emo_' + r.emo.id).c, r.x + 1, r.y + 1 + (on && !IN.down ? -1 : 0));
      }
    });
    drawInput(ctx, hov, t);
  }

  function drawLog(ctx, t) {
    // todas las líneas, de la más nueva hacia arriba
    const rows = [];
    C.log.forEach((e) => layout(e, MA.w).forEach((ln, i) => rows.push({ ln, e, first: i === 0 })));
    const total = rows.reduce((a, r) => a + r.ln.h, 0);
    C.scroll = Math.max(0, Math.min(C.scroll, total - MA.h));
    const bottomPad = t < C.typingUntil ? 12 : 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(MA.x - 2, MA.y, MA.w + 4, MA.h - bottomPad); ctx.clip();
    let y = MA.y + MA.h - bottomPad + C.scroll;
    for (let i = rows.length - 1; i >= 0 && y > MA.y; i--) {
      const r = rows[i];
      y -= r.ln.h;
      if (y > MA.y + MA.h) continue;
      const fresh = t - r.e.t < 0.4; // el mensaje nuevo entra con un destello
      if (fresh && r.e.pi != null) { ctx.globalAlpha = 0.25 * (1 - (t - r.e.t) / 0.4); ctx.fillStyle = OM.PAL[PCOL[r.e.pi]]; ctx.fillRect(MA.x - 2, y, MA.w + 4, r.ln.h); ctx.globalAlpha = 1; }
      drawItems(ctx, r.ln.items, MA.x, y);
    }
    ctx.restore();
    if (!C.log.length) OM.FONT.draw(ctx, 'Aún no hay mensajes', MA.x + MA.w / 2, MA.y + MA.h / 2 - 4, { color: '4', align: 'center' });
    if (C.scroll > 0) { // leyendo mensajes viejos: flecha para volver abajo
      const ax = MA.x + MA.w - 8, ay = MA.y + MA.h - 10 - bottomPad;
      ctx.fillStyle = OM.PAL['0']; ctx.fillRect(ax - 2, ay - 1, 11, 9);
      OM.FONT.draw(ctx, 'v', ax, ay - 1, { color: Math.floor(t * 3) % 2 ? 'i' : '6' });
    }
  }

  function drawInput(ctx, hov, t) {
    const r = regions().find((x) => x.id === 'input');
    const cool = t < C.muteUntil;
    OM.UI.panel(ctx, r.x, r.y, r.w, r.h, C.focus ? 'gold' : 'inset');
    const ix = r.x + 5, iy = r.y + 6, iw = r.w - 10;
    if (!C.draft && !C.focus) {
      const emo = hov && hov.id === 'emo' ? hov.emo : null;
      const msg = cool ? 'Calma... ' + Math.ceil(C.muteUntil - t) + ' s' : emo ? ':' + emo.id + ': ' + emo.name : 'T o clic para escribir';
      OM.FONT.draw(ctx, msg, ix, iy, { color: cool ? 'c' : emo ? '6' : '4' });
      return;
    }
    const w = inline(null, C.draft, 0, 0, '8', false);
    const off = Math.min(0, iw - 4 - w);
    ctx.save(); ctx.beginPath(); ctx.rect(ix, r.y + 2, iw, r.h - 4); ctx.clip();
    inline(ctx, C.draft, ix + off, iy, cool ? '6' : '8', true);
    if (C.focus && Math.floor(t * 2.5) % 2 === 0) { ctx.fillStyle = OM.PAL.i; ctx.fillRect(ix + off + w + 1, iy - 1, 1, 9); }
    ctx.restore();
    // a la derecha del campo: segundos de silencio o caracteres cuando te acercas al tope
    const tag = cool ? Math.ceil(C.muteUntil - t) + ' s' : C.draft.length > MAX_LEN - 20 ? String(MAX_LEN - C.draft.length) : '';
    if (tag) {
      const tw_ = tw(tag) + 6;
      ctx.fillStyle = OM.PAL[cool ? '9' : '2']; ctx.fillRect(r.x + r.w - tw_ - 3, r.y + 3, tw_, r.h - 6);
      OM.FONT.draw(ctx, tag, r.x + r.w - 6, iy, { color: cool || C.draft.length >= MAX_LEN ? 'c' : '6', align: 'right' });
    }
  }

  function drawClosed(ctx, hov, t) {
    // avisos flotantes de mensajes nuevos
    toastRects().forEach((r) => {
      const a = Math.min(1, r.t.life / 0.6, (7 - r.t.life) * 6);
      const slide = Math.round(Math.max(0, 1 - (7 - r.t.life) * 6) * 20);
      ctx.globalAlpha = a * 0.85; ctx.fillStyle = OM.PAL['1']; ctx.fillRect(r.x + slide, r.y, r.w, r.h);
      ctx.fillStyle = OM.PAL[PCOL[r.t.e.pi] || '6']; ctx.fillRect(r.x + slide + r.w - 2, r.y, 2, r.h);
      ctx.globalAlpha = a;
      inline(ctx, toastText(r.t.e), r.x + slide + 4, r.y + 4, '7', true);
      ctx.globalAlpha = 1;
    });
    // pestaña
    const on = hov && hov.id === 'tab';
    const x = TAB.x, y = TAB.y;
    OM.UI.panel(ctx, x, y, TAB.w + 6, TAB.h, on ? 'gold' : 'dark');
    bubble(ctx, x + 5, y + 6, C.unread ? 'i' : on ? '8' : '6', t < C.typingUntil ? t : null);
    if (C.unread) {
      const pulse = Math.floor(t * 3) % 2;
      ctx.fillStyle = OM.PAL[pulse ? 'c' : 'b']; ctx.fillRect(x + 4, y + 18, 13, 10);
      OM.FONT.draw(ctx, C.unread > 9 ? '+' : String(C.unread), x + 11, y + 20, { color: '8', align: 'center' });
    } else OM.FONT.draw(ctx, 'T', x + 11, y + 20, { color: on ? '8' : '4', align: 'center' });
    if (on) OM.G.tooltip(x - 70, y + TAB.h + 4, 'CHAT', 'Abre el chat (tecla T). Con el chat cerrado, los mensajes nuevos aparecen aquí al lado.', '6');
  }

  // ---------------- iconos ----------------
  function iconBtn(ctx, r, on, fn) {
    ctx.fillStyle = OM.PAL[on ? '4' : '2']; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = OM.PAL[on ? '6' : '3']; ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    fn();
  }
  function speaker(ctx, x, y, muted) {
    const c = OM.PAL[muted ? '5' : '7'];
    ctx.fillStyle = c;
    ctx.fillRect(x, y + 2, 2, 3); ctx.fillRect(x + 2, y + 1, 1, 5); ctx.fillRect(x + 3, y, 1, 7);
    if (muted) { ctx.fillStyle = OM.PAL.c; for (let i = 0; i < 4; i++) { ctx.fillRect(x + 5 + i, y + 1 + i, 1, 1); ctx.fillRect(x + 8 - i, y + 1 + i, 1, 1); } }
    else { ctx.fillRect(x + 5, y + 2, 1, 3); ctx.fillRect(x + 7, y + 1, 1, 5); }
  }
  function bubble(ctx, x, y, col, typingT) {
    ctx.fillStyle = OM.PAL[col];
    ctx.fillRect(x + 1, y, 9, 1); ctx.fillRect(x, y + 1, 11, 5); ctx.fillRect(x + 1, y + 6, 9, 1); ctx.fillRect(x + 2, y + 7, 2, 1); ctx.fillRect(x + 2, y + 8, 1, 1);
    ctx.fillStyle = OM.PAL['2'];
    for (let i = 0; i < 3; i++) {
      const up = typingT != null && Math.floor(typingT * 6) % 3 === i ? 1 : 0;
      ctx.fillRect(x + 2 + i * 3, y + 3 - up, 1, 1);
    }
  }

  // pegar texto (Ctrl+V) y que el navegador no robe teclas mientras escribes (búsqueda rápida con ' y /)
  window.addEventListener('paste', (e) => {
    if (!C.focus) return;
    const v = (e.clipboardData || window.clipboardData).getData('text');
    if (v) { addDraft(v.replace(/[\r\n]+/g, ' ')); e.preventDefault(); }
  });
  window.addEventListener('keydown', (e) => { if (C.focus && e.key && [...e.key].length === 1 && !e.ctrlKey && !e.metaKey) e.preventDefault(); });

  return {
    update, draw, over, event, clean,
    docked: () => (available() && C.open ? D : null), // rectángulo del panel abierto (para apartar carteles)
    get open() { return C.open; }, get focus() { return C.focus; }, get log() { return C.log; },
    _state: C, // pruebas
  };
})();
