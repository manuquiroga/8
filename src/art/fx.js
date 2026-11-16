// OCHO MALDITO — FX: partículas, textos flotantes, sacudida, flash, post-proceso CRT y transiciones.
// Ver docs/ART_CONTRACT.md. Sin getImageData por frame: todo es composición de canvases.
window.OM = window.OM || {};
OM.ART_INIT = OM.ART_INIT || [];

OM.FX = (function () {
  const PAL = OM.PAL;
  const W = () => OM.W || 640, H = () => OM.H || 360;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const MAXP = 1600;

  // ============================================================ PARTÍCULAS
  const parts = [];
  // rampa de color por defecto (de joven a vieja) para cada tipo
  const RAMPS = {
    spark: ['8', 'i', 'h', 'v', 'b'],
    dust: ['8', 'r', 'q', '6', '5'],
    blood: ['c', 'b', 'b', 'a', '9'],
    gold: ['i', 'h', 'g'],
    smoke: ['5', '4', '3', '2'],
    ember: ['i', 'h', 'v', 'd', 'b', 'a'],
    shard: ['8', 'r', '7', 'q', '6'],
    pocket: ['8', 'i', 'h', 'v'],
    ring: ['8', 'i', 'v', 'b', 'a'],
  };
  function ramp(kind, opts) {
    const c = opts && opts.color;
    if (Array.isArray(c)) return c;
    if (typeof c === 'string' && PAL[c]) {
      const R = { q: ['8', 'r', 'q', 'p'], c: ['8', 'd', 'c', 'b', 'a'], h: ['8', 'i', 'h', 'g'], m: ['8', 'n', 'm', 'l'], t: ['8', 'u', 't', 's'], u: ['8', 'u', 't', 's'], b: ['d', 'c', 'b', 'a'], r: ['8', 'r', 'q', 'p'] };
      return R[c] || [c];
    }
    return RAMPS[kind] || RAMPS.spark;
  }
  function add(p) { if (parts.length >= MAXP) parts.shift(); parts.push(p); }

  function burst(x, y, kind, n, opts) {
    opts = opts || {};
    kind = kind || 'spark';
    if (kind === 'explosion') return explosion(x, y, n, opts);
    n = n == null ? ({ spark: 14, dust: 10, blood: 16, gold: 10, smoke: 8, ember: 12, shard: 12, pocket: 18 }[kind] || 10) : n;
    const R = ramp(kind, opts);
    const sp = opts.speed || 1;
    const ang = opts.angle, spread = opts.spread != null ? opts.spread : Math.PI * 2;
    const ivx = opts.vx || 0, ivy = opts.vy || 0;
    for (let i = 0; i < n; i++) {
      const a = ang != null ? ang + (Math.random() - 0.5) * spread : Math.random() * Math.PI * 2;
      const p = { kind, x, y, vx: 0, vy: 0, t: 0, life: 1, R, g: 0, drag: 0, size: 1, spin: 0, rot: 0, floor: opts.floor, cx: x, cy: y };
      let s;
      switch (kind) {
        case 'spark':
          s = rnd(70, 200) * sp; p.life = rnd(0.15, 0.42); p.drag = 5; p.g = 60;
          break;
        case 'dust':
          s = rnd(8, 40) * sp; p.life = rnd(0.5, 1.1); p.drag = 3; p.g = -12; p.size = Math.random() < 0.4 ? 2 : 1;
          break;
        case 'blood':
          s = rnd(40, 150) * sp; p.life = rnd(0.5, 1.1); p.drag = 0.6; p.g = 320; p.size = Math.random() < 0.35 ? 2 : 1;
          if (ang == null) { p.vy0 = -rnd(30, 90); }
          break;
        case 'gold':
          s = rnd(50, 140) * sp; p.life = rnd(0.8, 1.5); p.drag = 0.4; p.g = 380; p.spin = rnd(8, 16); p.rot = Math.random() * 4;
          if (ang == null) p.vy0 = -rnd(80, 170);
          break;
        case 'smoke':
          s = rnd(5, 26) * sp; p.life = rnd(0.8, 1.7); p.drag = 1.5; p.g = -22; p.size = rnd(2, 3.5); p.grow = rnd(2, 4);
          break;
        case 'ember':
          s = rnd(15, 60) * sp; p.life = rnd(0.6, 1.6); p.drag = 1.2; p.g = -45; p.wig = rnd(2, 5); p.ph = Math.random() * 6;
          break;
        case 'shard':
          s = rnd(60, 170) * sp; p.life = rnd(0.5, 1.0); p.drag = 0.8; p.g = 300; p.spin = rnd(-14, 14); p.rot = Math.random() * 6; p.size = Math.random() < 0.5 ? 3 : 2;
          if (ang == null) p.vy0 = -rnd(40, 110);
          break;
        case 'pocket':
          s = 0; p.life = rnd(0.45, 0.85); p.ang = Math.random() * Math.PI * 2; p.rad = rnd(8, 18) * (opts.radius ? opts.radius / 12 : 1); p.av = rnd(8, 14) * (Math.random() < 0.5 ? 1 : 1);
          break;
        default:
          s = rnd(30, 100) * sp; p.life = rnd(0.3, 0.8);
      }
      if (opts.life) p.life *= opts.life;
      p.vx = Math.cos(a) * s + ivx;
      p.vy = Math.sin(a) * s + ivy + (p.vy0 || 0);
      if (opts.gravity != null) p.g = opts.gravity;
      if (opts.size) p.size = opts.size;
      add(p);
    }
  }
  function explosion(x, y, n, opts) {
    n = n || 1;
    const k = clamp(n > 3 ? n / 24 : n, 0.4, 3);
    add({ kind: 'ring', x, y, t: 0, life: 0.35, R: RAMPS.ring, r0: 3, r1: 20 * k, vx: 0, vy: 0, g: 0, drag: 0 });
    add({ kind: 'ring', x, y, t: -0.06, life: 0.4, R: ['i', 'v', 'b', 'a'], r0: 2, r1: 30 * k, vx: 0, vy: 0, g: 0, drag: 0 });
    add({ kind: 'core', x, y, t: 0, life: 0.18, R: ['8', 'i', 'h'], r0: 9 * k, vx: 0, vy: 0, g: 0, drag: 0 });
    burst(x, y, 'spark', Math.round(22 * k), { speed: 1.4 });
    burst(x, y, 'ember', Math.round(14 * k), { speed: 1.6 });
    burst(x, y, 'smoke', Math.round(9 * k), { speed: 1.5, color: ['4', '3', '2', '1'] });
    if (opts.shards !== false) burst(x, y, 'shard', Math.round(6 * k), { color: ['i', 'h', 'v', 'b'] });
  }

  function update(dt) {
    dt = Math.min(0.05, Math.max(0, dt || 0));
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      if (p.t < 0) continue;
      if (p.kind === 'pocket') {
        const k = p.t / p.life;
        p.ang += p.av * dt * (1 + k * 2);
        const r = p.rad * (1 - k) * (1 - k);
        p.x = p.cx + Math.cos(p.ang) * r; p.y = p.cy + Math.sin(p.ang) * r * 0.85;
        continue;
      }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy *= dr;
      p.vy += p.g * dt;
      if (p.wig) p.vx += Math.sin(p.t * 8 + p.ph) * p.wig;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.spin) p.rot += p.spin * dt;
      if (p.grow) p.size += p.grow * dt;
      if (p.floor != null && p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vy *= -0.45; p.vx *= 0.7; if (Math.abs(p.vy) < 20) { p.vy = 0; p.g = 0; p.drag = 6; } }
    }
    // textos
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; if (p.t >= p.life + p.delay) pops.splice(i, 1); }
    // sacudida
    if (shk.t < shk.dur) {
      shk.t += dt;
      const k = 1 - shk.t / shk.dur;
      const a = shk.i * k * k;
      shk.x = Math.round((Math.random() * 2 - 1) * a);
      shk.y = Math.round((Math.random() * 2 - 1) * a);
    } else { shk.x = 0; shk.y = 0; }
    // flash
    if (fl.t < fl.dur) fl.t += dt;
    // transición
    if (tr) {
      tr.t += dt;
      if (!tr.mid && tr.t >= tr.dur * (tr.mode === 'both' ? 0.5 : 1)) { tr.mid = true; if (tr.onMid) try { tr.onMid(); } catch (e) { console.error(e); } }
      if (tr.t >= tr.dur) {
        const done = tr.onDone;
        if (tr.mode === 'out') { tr.hold = true; tr.t = tr.dur; } else tr = null;
        if (done) try { done(); } catch (e) { console.error(e); }
      }
    }
  }

  // círculos de píxel precalculados (anillos) por radio
  const ringPts = {};
  function ring(r) {
    r = Math.max(1, Math.round(r));
    if (ringPts[r]) return ringPts[r];
    const pts = [];
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= r * r + r * 0.8 && d > (r - 1) * (r - 1) + (r - 1) * 0.8) pts.push(x, y);
    }
    return (ringPts[r] = pts);
  }
  function disc(ctx, x, y, r, dith) {
    r = Math.max(1, Math.round(r));
    for (let j = -r; j <= r; j++) {
      const hw = Math.floor(Math.sqrt(r * r + r * 0.8 - j * j));
      if (!dith) ctx.fillRect(x - hw, y + j, hw * 2 + 1, 1);
      else for (let i = -hw; i <= hw; i++) if (((x + i + y + j) & 1) === 0) ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
  function colAt(p) {
    const k = clamp(p.t / p.life, 0, 0.999);
    return PAL[p.R[Math.floor(k * p.R.length)]];
  }

  function draw(ctx) {
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.t < 0) continue;
      const k = p.t / p.life;
      const x = Math.round(p.x), y = Math.round(p.y);
      ctx.fillStyle = colAt(p);
      switch (p.kind) {
        case 'spark': {
          const len = Math.min(6, Math.hypot(p.vx, p.vy) * 0.03);
          const nx = p.vx / (Math.hypot(p.vx, p.vy) || 1), ny = p.vy / (Math.hypot(p.vx, p.vy) || 1);
          for (let s = 0; s <= len; s++) ctx.fillRect(Math.round(p.x - nx * s), Math.round(p.y - ny * s), 1, 1);
          if (k < 0.3) { ctx.fillStyle = PAL['8']; ctx.fillRect(x, y, 1, 1); }
          break;
        }
        case 'dust':
          if (k > 0.7 && ((i + Math.floor(p.t * 30)) & 1)) break;
          ctx.fillRect(x, y, p.size, p.size);
          break;
        case 'blood':
          ctx.fillRect(x, y, p.size, p.size + (Math.abs(p.vy) > 60 ? 1 : 0));
          break;
        case 'gold': {
          const ph = Math.floor(Math.abs(p.rot) * 2) % 4;
          const w = [4, 3, 1, 3][ph];
          ctx.fillStyle = PAL['0']; ctx.fillRect(x - (w >> 1) - 1, y - 1, w + 2, 6);
          ctx.fillStyle = PAL[ph === 2 ? 'g' : 'h']; ctx.fillRect(x - (w >> 1), y, w, 4);
          if (w > 1) { ctx.fillStyle = PAL['i']; ctx.fillRect(x - (w >> 1), y, 1, 2); }
          if (w === 4) { ctx.fillStyle = PAL['g']; ctx.fillRect(x + 1, y + 1, 1, 2); }
          break;
        }
        case 'smoke':
          disc(ctx, x, y, p.size, k > 0.45);
          break;
        case 'ember':
          if (k > 0.8 && (Math.floor(p.t * 20) & 1)) break;
          ctx.fillRect(x, y, 1, 1);
          if (k < 0.3) ctx.fillRect(x, y + 1, 1, 1);
          break;
        case 'shard': {
          const c = Math.cos(p.rot), s = Math.sin(p.rot);
          for (let q = -1; q < p.size - 1; q++) ctx.fillRect(Math.round(p.x + c * q), Math.round(p.y + s * q), 1, 1);
          ctx.fillStyle = PAL['8']; if (Math.sin(p.rot * 3) > 0.6) ctx.fillRect(x, y, 1, 1);
          break;
        }
        case 'pocket':
          ctx.fillRect(x, y, 1, 1);
          if (k < 0.5) ctx.fillRect(x + 1, y, 1, 1);
          break;
        case 'ring': {
          const r = p.r0 + (p.r1 - p.r0) * (1 - (1 - k) * (1 - k));
          const pts = ring(r);
          for (let q = 0; q < pts.length; q += 2) ctx.fillRect(x + pts[q], y + pts[q + 1], 1, 1);
          if (k < 0.5) { const pts2 = ring(r - 1); for (let q = 0; q < pts2.length; q += 2) ctx.fillRect(x + pts2[q], y + pts2[q + 1], 1, 1); }
          break;
        }
        case 'core':
          disc(ctx, x, y, p.r0 * (1 - k * 0.5), k > 0.5);
          break;
        default:
          ctx.fillRect(x, y, 1, 1);
      }
    }
    drawPops(ctx);
    drawFlash(ctx);
    ctx.imageSmoothingEnabled = prev;
  }
  function clear() { parts.length = 0; pops.length = 0; shk.t = shk.dur = 0; shk.x = shk.y = 0; fl.t = fl.dur = 0; }

  // ============================================================ TEXTOS FLOTANTES
  const pops = [];
  const bakeCache = new Map();
  function bakeText(text, color, size, outline, shadow) {
    const key = text + '|' + color + '|' + size + '|' + outline + '|' + shadow;
    let b = bakeCache.get(key);
    if (b) return b;
    b = OM.FONT.bake(text, { color, size, outline, shadow, grad: size === 2 });
    if (bakeCache.size > 300) bakeCache.delete(bakeCache.keys().next().value);
    bakeCache.set(key, b);
    return b;
  }
  function popText(x, y, text, color, opts) {
    opts = opts || {};
    const size = opts.size === 1 ? 1 : 2;
    const p = {
      x, y, text: String(text), color: color || '8', size,
      b: bakeText(String(text), color || '8', size, opts.outline === undefined ? '0' : opts.outline, opts.shadow === undefined ? '0' : opts.shadow),
      t: 0, life: opts.life || 0.95, delay: opts.delay || 0, rise: opts.rise != null ? opts.rise : 22,
      scale: Math.max(1, Math.round(opts.scale || 1)), pop: opts.pop != null ? opts.pop : 1.6, vx: opts.vx || 0,
    };
    pops.push(p);
    return p;
  }
  function popScale(t, life, pop) {
    // salto elástico: 0.3 → pop → 0.9 → 1 ... y encoge al final
    if (t < 0.09) return 0.3 + (pop - 0.3) * (t / 0.09);
    if (t < 0.2) return pop + (0.88 - pop) * ((t - 0.09) / 0.11);
    if (t < 0.28) return 0.88 + 0.12 * ((t - 0.2) / 0.08);
    const end = life - 0.18;
    if (t > end) return Math.max(0, 1 - (t - end) / 0.18);
    return 1;
  }
  function drawPops(ctx) {
    for (let i = 0; i < pops.length; i++) {
      const p = pops[i];
      const t = p.t - p.delay;
      if (t < 0) continue;
      const s = popScale(t, p.life, p.pop) * p.scale;
      if (s <= 0.05) continue;
      const k = t / p.life;
      const rise = p.rise * (1 - Math.pow(1 - Math.min(1, k * 1.4), 3));
      const cx = Math.round(p.x + p.vx * t), cy = Math.round(p.y - rise);
      const b = p.b;
      // escalas "casi enteras" se redondean para mantener el píxel limpio
      const ss = Math.abs(s - Math.round(s)) < 0.07 ? Math.round(s) : s;
      const dw = Math.max(1, Math.round(b.c.width * ss)), dh = Math.max(1, Math.round(b.c.height * ss));
      const cxo = Math.round((b.ox + b.w / 2) * ss), cyo = Math.round((b.oy + b.h / 2) * ss);
      ctx.drawImage(b.c, cx - cxo, cy - cyo, dw, dh);
    }
  }

  // ============================================================ SACUDIDA / FLASH
  const shk = { i: 0, dur: 0, t: 0, x: 0, y: 0 };
  function shake(intensity, duration) {
    intensity = intensity == null ? 3 : intensity;
    duration = duration == null ? 0.25 : duration;
    const rem = shk.dur > shk.t ? shk.i * (1 - shk.t / shk.dur) : 0;
    if (intensity >= rem) { shk.i = intensity; shk.dur = duration; shk.t = 0; }
  }
  function shakeOffset() { return { x: shk.x, y: shk.y }; }
  const fl = { c: '8', a: 0, dur: 0, t: 0 };
  function flash(color, alpha, dur) { fl.c = color || '8'; fl.a = alpha == null ? 0.6 : alpha; fl.dur = dur || 0.15; fl.t = 0; }
  function drawFlash(ctx) {
    if (fl.t >= fl.dur || !fl.dur) return;
    const k = 1 - fl.t / fl.dur;
    ctx.save();
    ctx.globalAlpha = clamp(fl.a * k * k, 0, 1);
    ctx.fillStyle = OM.col(fl.c);
    ctx.fillRect(0, 0, W(), H());
    ctx.restore();
  }

  // ============================================================ TRANSICIONES
  let tr = null;
  // transition(kind, dur, {mode:'both'|'out'|'in', onMid, onDone, x, y, color})
  //  'both' (por defecto): cierra, llama onMid (cambia de escena aquí) y abre.
  function transition(kind, dur, opts) {
    opts = opts || {};
    tr = { kind: kind || 'iris', dur: dur || 0.8, t: 0, mode: opts.mode || 'both', onMid: opts.onMid, onDone: opts.onDone, x: opts.x, y: opts.y, color: opts.color || '0', mid: false };
    return tr;
  }
  function coverage() {
    if (!tr) return 0;
    const k = clamp(tr.t / tr.dur, 0, 1);
    let c = tr.mode === 'out' ? k : tr.mode === 'in' ? 1 - k : k < 0.5 ? k * 2 : 2 - k * 2;
    if (tr.hold) c = 1;
    return c * c * (3 - 2 * c);
  }
  const ditherPats = new WeakMap();
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function ditherPattern(ctx, level, color) {
    let m = ditherPats.get(ctx);
    if (!m) { m = {}; ditherPats.set(ctx, m); }
    const key = level + color;
    if (m[key]) return m[key];
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const x = c.getContext('2d');
    x.fillStyle = OM.col(color);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (BAYER[j * 4 + i] < level) x.fillRect(i * 2, j * 2, 2, 2);
    m[key] = ctx.createPattern(c, 'repeat');
    return m[key];
  }
  function drawTransition(ctx) {
    if (!tr) return;
    const c = coverage();
    if (c <= 0.001) return;
    const w = W(), h = H();
    const col = OM.col(tr.color);
    ctx.save();
    if (tr.kind === 'dither' || tr.kind === 'fade') {
      const lvl = Math.round(c * 16);
      if (lvl >= 16) { ctx.fillStyle = col; ctx.fillRect(0, 0, w, h); }
      else if (lvl > 0) { ctx.fillStyle = ditherPattern(ctx, lvl, tr.color); ctx.fillRect(0, 0, w, h); }
    } else { // iris (por defecto)
      const cx = Math.round(tr.x != null ? tr.x : w / 2), cy = Math.round(tr.y != null ? tr.y : h / 2);
      const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 4;
      const r = (1 - c) * maxR;
      ctx.fillStyle = col;
      if (r < 1) ctx.fillRect(0, 0, w, h);
      else {
        for (let y = 0; y < h; y += 2) {
          const dy = y + 1 - cy;
          if (Math.abs(dy) >= r) { ctx.fillRect(0, y, w, 2); continue; }
          const hw = Math.floor(Math.sqrt(r * r - dy * dy) / 2) * 2;
          ctx.fillRect(0, y, cx - hw, 2);
          ctx.fillRect(cx + hw, y, w - cx - hw, 2);
        }
        // aro carmesí en el borde del iris
        ctx.fillStyle = PAL['b'];
        for (let y = 0; y < h; y += 2) {
          const dy = y + 1 - cy;
          if (Math.abs(dy) >= r) continue;
          const hw = Math.floor(Math.sqrt(r * r - dy * dy) / 2) * 2;
          ctx.fillRect(cx - hw, y, 2, 2); ctx.fillRect(cx + hw - 2, y, 2, 2);
        }
        for (let x = 0; x < w; x += 2) {
          const dx = x + 1 - cx;
          if (Math.abs(dx) >= r) continue;
          const hh = Math.floor(Math.sqrt(r * r - dx * dx) / 2) * 2;
          ctx.fillRect(x, cy - hh, 2, 2); ctx.fillRect(x, cy + hh - 2, 2, 2);
        }
      }
    }
    ctx.restore();
  }
  function transitionActive() { return !!tr && !tr.hold; }
  function transitionCovered() { return coverage() >= 0.999; }

  // ============================================================ POST CRT
  const PP = { key: '', r: null, gb: null, b1: null, b2: null, b3: null, scan: null, vig: null, band: null };
  function cv(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  function prepPost(sw, sh, ow, oh, s, o) {
    const key = sw + 'x' + sh + '|' + ow + 'x' + oh + '|' + o.scan + '|' + o.vignette;
    if (PP.key === key) return;
    PP.key = key;
    PP.r = cv(sw, sh); PP.gb = cv(sw, sh);
    PP.b1 = cv(sw >> 2, sh >> 2); PP.b2 = cv(sw >> 2, sh >> 2); PP.b3 = cv(sw >> 3, sh >> 3);
    // scanlines: una fila oscura por cada píxel interno
    PP.scan = cv(ow, oh);
    const sx = PP.scan.getContext('2d');
    if (s >= 2) {
      for (let i = 0; i < sh; i++) {
        const y0 = Math.round(i * s), y1 = Math.round((i + 1) * s);
        const dark = Math.max(1, Math.round((y1 - y0) * 0.38));
        sx.fillStyle = 'rgba(0,0,0,' + o.scan + ')';
        sx.fillRect(0, y1 - dark, ow, dark);
        if (y1 - y0 >= 4) { sx.fillStyle = 'rgba(0,0,0,' + (o.scan * 0.35) + ')'; sx.fillRect(0, y0, ow, 1); }
      }
      // máscara de apertura muy sutil (columnas)
      if (s >= 3) {
        sx.fillStyle = 'rgba(0,0,0,' + (o.scan * 0.25) + ')';
        for (let i = 0; i < sw; i++) sx.fillRect(Math.round((i + 1) * s) - 1, 0, 1, oh);
      }
    } else {
      sx.fillStyle = 'rgba(0,0,0,' + (o.scan * 0.6) + ')';
      for (let y = 1; y < oh; y += 2) sx.fillRect(0, y, ow, 1);
    }
    // viñeta + esquinas redondeadas de tubo
    PP.vig = cv(ow, oh);
    const vx = PP.vig.getContext('2d');
    const gr = vx.createRadialGradient(ow / 2, oh / 2, Math.min(ow, oh) * 0.35, ow / 2, oh / 2, Math.hypot(ow, oh) * 0.56);
    gr.addColorStop(0, 'rgba(7,5,13,0)');
    gr.addColorStop(0.6, 'rgba(7,5,13,' + (o.vignette * 0.45) + ')');
    gr.addColorStop(1, 'rgba(7,5,13,' + o.vignette + ')');
    vx.fillStyle = gr; vx.fillRect(0, 0, ow, oh);
    if (o.corners) {
      const rr = Math.round(Math.min(ow, oh) * 0.035);
      vx.fillStyle = '#000';
      vx.beginPath();
      vx.rect(0, 0, ow, oh);
      vx.moveTo(rr, 0); vx.arcTo(0, 0, 0, rr, rr); vx.lineTo(0, oh - rr); vx.arcTo(0, oh, rr, oh, rr); vx.lineTo(ow - rr, oh); vx.arcTo(ow, oh, ow, oh - rr, rr); vx.lineTo(ow, rr); vx.arcTo(ow, 0, ow - rr, 0, rr); vx.closePath();
      vx.fill('evenodd');
    }
    // banda de refresco que baja lentamente
    PP.band = cv(4, 64);
    const bx = PP.band.getContext('2d');
    const bg = bx.createLinearGradient(0, 0, 0, 64);
    bg.addColorStop(0, 'rgba(255,244,224,0)'); bg.addColorStop(0.5, 'rgba(255,244,224,0.035)'); bg.addColorStop(1, 'rgba(255,244,224,0)');
    bx.fillStyle = bg; bx.fillRect(0, 0, 4, 64);
  }
  const POST_DEF = { crt: true, scan: 0.26, vignette: 0.55, aberration: 1, bloom: 0.45, flicker: 0.012, pixelPerfect: false, corners: true, band: true };
  function post(src, dst, dw, dh, t, opts) {
    const o = Object.assign({}, POST_DEF, opts || {});
    const sw = src.width, sh = src.height;
    let s = Math.min(dw / sw, dh / sh);
    if (o.pixelPerfect && s >= 1) s = Math.floor(s);
    const ow = Math.round(sw * s), oh = Math.round(sh * s);
    const ox = (dw - ow) >> 1, oy = (dh - oh) >> 1;
    dst.save();
    dst.setTransform(1, 0, 0, 1, 0, 0);
    dst.globalAlpha = 1; dst.globalCompositeOperation = 'source-over';
    dst.imageSmoothingEnabled = false;
    dst.fillStyle = '#000';
    dst.fillRect(0, 0, dw, dh);
    if (!o.crt) { dst.drawImage(src, ox, oy, ow, oh); dst.restore(); return; }
    prepPost(sw, sh, ow, oh, s, o);
    // 1) aberración cromática: canal rojo desplazado
    const ab = o.aberration ? Math.max(1, Math.round(s * 0.5 * o.aberration)) : 0;
    if (ab) {
      const r = PP.r.getContext('2d'), gb = PP.gb.getContext('2d');
      r.globalCompositeOperation = 'copy'; r.drawImage(src, 0, 0);
      r.globalCompositeOperation = 'multiply'; r.fillStyle = '#ff0000'; r.fillRect(0, 0, sw, sh);
      r.globalCompositeOperation = 'destination-in'; r.drawImage(src, 0, 0);
      gb.globalCompositeOperation = 'copy'; gb.drawImage(src, 0, 0);
      gb.globalCompositeOperation = 'multiply'; gb.fillStyle = '#00ffff'; gb.fillRect(0, 0, sw, sh);
      gb.globalCompositeOperation = 'destination-in'; gb.drawImage(src, 0, 0);
      dst.drawImage(PP.gb, ox, oy, ow, oh);
      dst.globalCompositeOperation = 'lighter';
      dst.drawImage(PP.r, ox + ab, oy, ow, oh);
      dst.globalCompositeOperation = 'source-over';
    } else dst.drawImage(src, ox, oy, ow, oh);
    // 2) bloom barato: reducción + realce de brillos (multiply consigo misma) + desenfoque por escalado
    if (o.bloom > 0) {
      const b1 = PP.b1.getContext('2d'), b2 = PP.b2.getContext('2d'), b3 = PP.b3.getContext('2d');
      const w1 = PP.b1.width, h1 = PP.b1.height;
      b1.imageSmoothingEnabled = true; b1.globalCompositeOperation = 'copy'; b1.drawImage(src, 0, 0, w1, h1);
      b2.globalCompositeOperation = 'copy'; b2.drawImage(PP.b1, 0, 0);
      b2.globalCompositeOperation = 'multiply'; b2.drawImage(PP.b1, 0, 0); b2.drawImage(PP.b1, 0, 0); // ~x^3: solo sobreviven los brillos
      b3.imageSmoothingEnabled = true; b3.globalCompositeOperation = 'copy'; b3.drawImage(PP.b2, 0, 0, PP.b3.width, PP.b3.height);
      dst.imageSmoothingEnabled = true;
      dst.globalCompositeOperation = 'lighter';
      dst.globalAlpha = o.bloom * 0.6; dst.drawImage(PP.b2, ox, oy, ow, oh);
      dst.globalAlpha = o.bloom; dst.drawImage(PP.b3, ox, oy, ow, oh);
      dst.globalAlpha = 1; dst.globalCompositeOperation = 'source-over';
      dst.imageSmoothingEnabled = false;
    }
    // 3) scanlines, banda y viñeta
    if (o.scan > 0) dst.drawImage(PP.scan, ox, oy);
    if (o.band) {
      const by = oy + Math.round(((t || 0) * 0.08 % 1.3) * oh) - Math.round(oh * 0.15);
      dst.drawImage(PP.band, ox, by, ow, Math.round(oh * 0.3));
    }
    if (o.vignette > 0 || o.corners) dst.drawImage(PP.vig, ox, oy);
    if (o.flicker) { dst.globalAlpha = o.flicker * (0.5 + 0.5 * Math.sin((t || 0) * 60)); dst.fillStyle = '#000'; dst.fillRect(ox, oy, ow, oh); dst.globalAlpha = 1; }
    dst.restore();
  }

  return {
    burst, update, draw, clear, popText, shake, shakeOffset, flash, drawFlash,
    post, transition, drawTransition, transitionActive, transitionCovered, coverage,
    count: () => parts.length, particles: parts, pops,
  };
})();
