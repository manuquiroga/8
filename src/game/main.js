// 8 — bucle principal, entrada, GUI inmediata, persistencia.
window.OM = window.OM || {};

(function () {
  const W = OM.W, H = OM.H;
  const screen = document.getElementById('screen');
  const sctx = screen.getContext('2d');
  const buf = OM.PX.canvas(W, H);
  const ctx = buf.ctx;
  OM.ctx = ctx; OM.buf = buf.c;

  // ---------- persistencia ----------
  OM.META = { series: 0, wins: 0, bestPts: 0, bestShot: 0, seen: {}, crt: true, music: true, sfx: true, name: 'Jugador', cue: 'peregrino', bot: 'medio', mode: '8' };
  try { Object.assign(OM.META, JSON.parse(localStorage.getItem('om_meta') || '{}')); } catch (e) {}
  if (!OM.META.seen || typeof OM.META.seen !== 'object') OM.META.seen = {};
  // volumen de música 0..100 (antes era sí/no)
  if (typeof OM.META.musicVol !== 'number') OM.META.musicVol = OM.META.music === false ? 0 : 60;
  OM.META.musicVol = Math.max(0, Math.min(100, Math.round(OM.META.musicVol)));
  OM.saveMeta = () => { try { localStorage.setItem('om_meta', JSON.stringify(OM.META)); } catch (e) {} };

  // ---------- entrada ----------
  const IN = OM.IN = { mx: -99, my: -99, down: false, pressed: false, released: false, rpressed: false, wheel: 0, keys: {}, kp: {}, typed: '', pressX: 0, pressY: 0, touch: false, consumed: false };
  let scale = 2, offX = 0, offY = 0;
  function toLocal(cx, cy) {
    const r = screen.getBoundingClientRect();
    IN.mx = ((cx - r.left) / r.width) * W;
    IN.my = ((cy - r.top) / r.height) * H;
  }
  function unlockAudio() { try { OM.AUDIO && OM.AUDIO.unlock && OM.AUDIO.unlock(); } catch (e) {} }
  screen.addEventListener('mousemove', (e) => toLocal(e.clientX, e.clientY));
  screen.addEventListener('mousedown', (e) => {
    toLocal(e.clientX, e.clientY); unlockAudio();
    if (e.button === 2) { IN.rpressed = true; return; }
    IN.down = true; IN.pressed = true; IN.pressX = IN.mx; IN.pressY = IN.my;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 2) return; if (IN.down) IN.released = true; IN.down = false; });
  screen.addEventListener('contextmenu', (e) => e.preventDefault());
  screen.addEventListener('wheel', (e) => { IN.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  screen.addEventListener('touchstart', (e) => { const t = e.touches[0]; IN.touch = true; toLocal(t.clientX, t.clientY); unlockAudio(); IN.down = true; IN.pressed = true; IN.pressX = IN.mx; IN.pressY = IN.my; e.preventDefault(); }, { passive: false });
  screen.addEventListener('touchmove', (e) => { const t = e.touches[0]; toLocal(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
  screen.addEventListener('touchend', (e) => { IN.down = false; IN.released = true; e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    unlockAudio();
    if (!IN.keys[e.code]) IN.kp[e.code] = true;
    IN.keys[e.code] = true;
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) IN.typed += e.key;
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { IN.keys[e.code] = false; });

  // ---------- GUI inmediata ----------
  const G = OM.G = {
    hot: null, tip: null, cursor: 'normal',
    inside(x, y, w, h) { return IN.mx >= x && IN.mx < x + w && IN.my >= y && IN.my < y + h; },
    clicked(x, y, w, h) {
      if (IN.consumed) return false;
      const ok = IN.released && G.inside(x, y, w, h) && IN.pressX >= x && IN.pressX < x + w && IN.pressY >= y && IN.pressY < y + h;
      if (ok) IN.consumed = true;
      return ok;
    },
    button(x, y, w, h, label, style = 'red', disabled = false, key) {
      const hov = !disabled && G.inside(x, y, w, h);
      const st = disabled ? 'disabled' : hov && IN.down ? 'down' : hov ? 'hover' : 'idle';
      OM.UI.button(ctx, x, y, w, h, label, st, style);
      if (hov) G.cursor = 'grab';
      if (hov && !G['_h' + label]) { G['_h' + label] = true; }
      if (disabled) return false;
      const hit = G.clicked(x, y, w, h) || (key && IN.kp[key]);
      if (hit) OM.sfx('click');
      return hit;
    },
    // control deslizante 0..100: clic o arrastre. Devuelve el valor (nuevo si se tocó). id: para seguir el arrastre.
    slider(id, x, y, w, h, label, value) {
      const hov = G.inside(x, y, w, h);
      if (hov && IN.pressed && !IN.consumed) { G.drag = id; IN.consumed = true; }
      if (G.drag === id) { if (IN.down) value = Math.round(Math.max(0, Math.min(1, (IN.mx - x - 3) / (w - 6))) * 100); else { G.drag = null; OM.sfx('click'); } }
      if (hov) { G.cursor = 'grab'; if (IN.wheel) { value = Math.max(0, Math.min(100, value - Math.sign(IN.wheel) * 5)); IN.wheel = 0; } }
      OM.UI.panel(ctx, x, y, w, h, G.drag === id || hov ? 'gold' : 'inset');
      const fw = Math.round((w - 6) * value / 100);
      ctx.globalAlpha = 0.45; ctx.fillStyle = OM.PAL[value ? 'g' : '3']; ctx.fillRect(x + 3, y + 3, fw, h - 6); ctx.globalAlpha = 1;
      { const hx = x + 3 + Math.max(0, fw - 1); ctx.fillStyle = OM.PAL.i; ctx.fillRect(hx, y + 1, 2, 3); ctx.fillRect(hx, y + h - 4, 2, 3); }
      OM.FONT.draw(ctx, label + ' ' + value, x + w / 2, y + Math.round((h - 7) / 2), { color: '8', align: 'center', outline: '0' });
      return value;
    },
    tooltip(x, y, title, body, color, sub) { G.tip = { x, y, title, body, color, sub }; },
    drawTooltip() {
      const t = G.tip; if (!t) return;
      const w = 156;
      const lines = OM.FONT.wrap(t.body || '', w - 12, 1);
      const lh = OM.FONT.lineH(1);
      const h = 22 + lines.length * lh + (t.sub ? lh + 2 : 0) + 4;
      let x = Math.round(Math.min(Math.max(4, t.x - w / 2), W - w - 4));
      let y = Math.round(t.y);
      if (y + h > H - 4) y = H - 4 - h;
      OM.UI.panel(ctx, x, y, w, h, 'tooltip');
      OM.FONT.draw(ctx, t.title, x + w / 2, y + 6, { color: '8', align: 'center', shadow: '0' });
      let yy = y + 20;
      if (t.sub) { OM.FONT.draw(ctx, t.sub, x + w / 2, yy - 2, { color: t.color || '6', align: 'center' }); yy += lh + 2; }
      lines.forEach((ln, i) => OM.FONT.draw(ctx, ln, x + 6, yy + i * lh, { color: '7' }));
    },
  };

  // colorea descripciones: "+4 Mult" rojo, "Fichas" azul, "$" oro
  OM.colorize = (s) => s
    .replace(/((?:\+|x)\s?[\d.]+\s?Combo)/g, '{c}$1{/}')
    .replace(/\b(x\d[\d.]*)(?![\d.]| Combo)/g, '{c}$1{/}')
    .replace(/(\+\$\d+)/g, '{i}$1{/}')
    .replace(/(\+\d+\s?Puntos)/g, '{q}$1{/}')
    .replace(/\b(ACTIVO|LISA|LISAS|RAYADA|RAYADAS|ESQUINA|LATERALES|BANDA|COMBINACIÓN|TACADA|SALTO|SALTOS|MASSÉ|MASSÉS|ORO|RIVAL|ROBA|FALTA|FALLO|EFECTO|SAQUE|ÚLTIMA|PIERDAS|PERDIENDO)\b/g, '{h}$1{/}');

  OM.fmt = (n) => {
    n = Math.floor(n);
    if (Math.abs(n) >= 1e11) return n.toExponential(2).replace('+', '');
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  OM.sfx = (name, o) => { try { if (OM.META.sfx && OM.AUDIO) OM.AUDIO.sfx(name, o); } catch (e) {} };
  // aplica el volumen de música (0..100); a 0 la música se para
  OM.setMusicVol = (v) => {
    const prev = OM.META.musicVol;
    OM.META.musicVol = Math.max(0, Math.min(100, Math.round(v)));
    try { if (OM.AUDIO) OM.AUDIO.setVolume(null, OM.META.musicVol / 100, null); } catch (e) {}
    if (!prev !== !OM.META.musicVol) OM.music(OM._track);
  };
  OM.music = (name) => {
    try { if (OM.AUDIO) { OM.AUDIO.setVolume(null, OM.META.musicVol / 100, null); OM.AUDIO.music(OM.META.musicVol > 0 ? name : null); } } catch (e) {}
    OM._track = name;
  };

  // ---------- escenas ----------
  OM.scene = null;
  OM.go = (name, arg, trans = 'dither') => {
    const doSwitch = () => {
      const S = OM.SCENES[name];
      OM.scene = S; OM.sceneName = name;
      if (S.enter) S.enter(arg);
    };
    if (trans && OM.FX && OM.FX.transition) {
      OM.FX.transition(trans, 0.5);
      OM._pendingSwitch = { fn: doSwitch, at: 0.25 };
    } else doSwitch();
  };

  // ---------- tamaño ----------
  function resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    let s = Math.min(ww / W, wh / H);
    if (s >= 2) s = Math.floor(s);
    scale = s;
    const cw = Math.floor(W * s), ch = Math.floor(H * s);
    const dpr = window.devicePixelRatio || 1;
    screen.style.width = cw + 'px'; screen.style.height = ch + 'px';
    screen.width = Math.floor(cw * dpr); screen.height = Math.floor(ch * dpr);
    sctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- bucle ----------
  let last = performance.now(), t = 0, transT = 0;
  OM.time = 0;
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt; OM.time = t;
    if (OM._pendingSwitch) {
      OM._pendingSwitch.at -= dt;
      if (OM._pendingSwitch.at <= 0) { const f = OM._pendingSwitch.fn; OM._pendingSwitch = null; f(); }
    }
    G.tip = null; G.cursor = 'normal'; IN.consumed = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 0, W, H);
    try {
      if (OM.scene) {
        OM.scene.update && OM.scene.update(dt, t);
        OM.scene.draw && OM.scene.draw(ctx, t);
        if (!OM.scene.drawsFX) OM.FX.draw(ctx);
      }
      OM.FX.update(dt);
      G.drawTooltip();
      OM.FX.drawTransition(ctx);
      if (!IN.touch) OM.UI.cursor(ctx, Math.round(IN.mx), Math.round(IN.my), G.cursor);
    } catch (err) {
      console.error(err);
      OM.lastError = String(err && err.stack || err);
      ctx.fillStyle = '#300'; ctx.fillRect(0, 0, W, 12);
      ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.fillText(String(err).slice(0, 120), 4, 9);
    }
    // global keys
    if (IN.kp.KeyM && !OM.typing) { // M: silenciar / recuperar el volumen anterior
      if (OM.META.musicVol > 0) { OM.META.lastMusicVol = OM.META.musicVol; OM.setMusicVol(0); } else OM.setMusicVol(OM.META.lastMusicVol || 60);
      OM.saveMeta();
    }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    OM.FX.post(buf.c, sctx, screen.width, screen.height, t, { crt: OM.META.crt });
    IN.pressed = IN.released = IN.rpressed = false; IN.wheel = 0; IN.kp = {}; IN.typed = '';
    requestAnimationFrame(frame);
  }

  OM.boot = function () {
    (OM.ART_INIT || []).forEach((fn) => { try { fn(); } catch (e) { console.error('ART_INIT', e); } });
    document.fonts && document.fonts.ready;
    const room = OM.NET && OM.NET.codeFromUrl();
    if (room) { try { history.replaceState(null, '', location.protocol === 'file:' ? location.pathname : '/'); } catch (e) {} }
    OM.go(room ? 'online' : 'title', room ? { join: room } : null, null);
    requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
  };
})();
