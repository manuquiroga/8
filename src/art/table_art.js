// OCHO MALDITO — arte de MESA: temas por círculo, mesa, troneras, fondos de sala,
// bolas (con rodadura esférica y grabados), sombras, tacos, guía de tiro, niebla.
// Contrato: docs/ART_CONTRACT.md (sección "Agente MESA"). Solo paleta OM.PAL.
window.OM = window.OM || {};
OM.ART_INIT = OM.ART_INIT || [];

(function () {
  'use strict';
  const L = OM.LAYOUT;
  const TB = L.table, FE = L.felt;
  const BR = L.ballR; // 6

  // ------------------------------------------------------------------
  // Utilidades de píxel: buffer con claves de paleta → canvas
  // ------------------------------------------------------------------
  const RGB = {};
  function rgb(k) {
    let c = RGB[k];
    if (!c) {
      const h = OM.PAL[k];
      c = RGB[k] = [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
    }
    return c;
  }
  function PB(w, h) {
    this.w = w; this.h = h;
    this.k = new Array(w * h).fill(null);
    this.a = new Uint8Array(w * h).fill(255);
  }
  PB.prototype.set = function (x, y, c, a) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.k[i] = c; this.a[i] = a === undefined ? 255 : a;
  };
  PB.prototype.get = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.k[y * this.w + x];
  };
  PB.prototype.toImageData = function (ctx) {
    const id = ctx.createImageData(this.w, this.h), d = id.data;
    for (let i = 0; i < this.k.length; i++) {
      const k = this.k[i];
      if (!k) continue;
      const c = rgb(k);
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = this.a[i];
    }
    return id;
  };
  PB.prototype.toCanvas = function () {
    const { c, ctx } = OM.PX.canvas(this.w, this.h);
    ctx.putImageData(this.toImageData(ctx), 0, 0);
    return c;
  };
  // contorno 1px (4-vecinos) alrededor de lo opaco
  PB.prototype.outline = function (col) {
    const pts = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) pts.push(x, y);
    }
    for (let i = 0; i < pts.length; i += 2) this.set(pts[i], pts[i + 1], col);
  };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
  // elige color de una rampa con tramado ordenado (v en 0..1)
  // sharp > 1 estrecha la franja tramada entre tonos (menos ruido, bandas más limpias)
  function pick(ramp, v, x, y, sharp) {
    const n = ramp.length - 1;
    let f = Math.max(0, Math.min(n, v * n));
    let i = Math.floor(f);
    let fr = f - i;
    if (sharp) fr = clamp((fr - 0.5) * sharp + 0.5, 0, 1);
    if (fr > bayer(x, y)) i++;
    return ramp[Math.min(n, i)];
  }
  function hash(x, y, s) {
    const h = Math.sin(x * 127.1 + y * 311.7 + (s || 0) * 74.7) * 43758.5453;
    return h - Math.floor(h);
  }
  // relleno de círculo nítido por filas (mismo criterio que g.circle)
  function fillCircle(ctx, cx, cy, r) {
    cx |= 0; cy |= 0;
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(Math.max(0, r * r + r * 0.8 - y * y)));
      ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
  }

  // ------------------------------------------------------------------
  // TEMAS
  // ------------------------------------------------------------------
  // Rampas de 5 niveles: [más oscuro, oscuro, medio, claro, brillo]
  const THEMES = {
    limbo: {
      id: 'limbo', name: 'Limbo',
      felt: ['0', 'j', 'j', 'k', 'l'], wood: ['0', '1', '2', '3', '4'], rim: ['1', '3', '5', '6', '7'],
      sight: 'skull', sightC: ['2', '6', '7', '8'], sigil: 'eye', accent: '7', glow: '6',
      wall: ['0', '1', '1', '2', '3'], wallKind: 'stone', particles: 'dust', wax: ['5', '6', '7'], flame: ['v', 'h', 'i'],
      lightC: 'i',
    },
    lujuria: {
      id: 'lujuria', name: 'Lujuria',
      felt: ['1', '9', '9', 'a', 'b'], wood: ['0', '1', '9', 'e', 'f'], rim: ['e', 'f', 'g', 'h', 'i'],
      sight: 'diamond', sightC: ['e', 'g', 'h', 'i'], sigil: 'heart', accent: 'h', glow: 'u',
      wall: ['0', '1', '9', '9', 'a'], wallKind: 'curtain', particles: 'petals', wax: ['a', 'b', 'c'], flame: ['c', 'u', '8'],
      lightC: 'u',
    },
    gula: {
      id: 'gula', name: 'Gula',
      felt: ['j', 'k', 'k', 'l', 'm'], wood: ['1', '4', '6', '6', '7'], rim: ['2', '5', '6', '7', '8'],
      sight: 'tooth', sightC: ['3', '6', '7', '8'], sigil: 'maw', accent: 'm', glow: 'n',
      wall: ['0', '1', 'j', 'j', 'k'], wallKind: 'tiles', particles: 'spores', wax: ['l', 'm', 'n'], flame: ['m', 'n', '8'],
      lightC: 'n',
    },
    avaricia: {
      id: 'avaricia', name: 'Avaricia',
      felt: ['1', '2', '3', '3', '4'], wood: ['0', '1', '1', '2', 'e'], rim: ['e', 'g', 'h', 'i', '8'],
      sight: 'coin', sightC: ['e', 'g', 'h', 'i'], sigil: 'coin', accent: 'h', glow: 'h',
      wall: ['0', '1', '2', '2', '3'], wallKind: 'damask', particles: 'glints', wax: ['g', 'h', 'i'], flame: ['v', 'h', 'i'],
      lightC: 'h',
    },
    ira: {
      id: 'ira', name: 'Ira',
      felt: ['0', '9', '9', 'a', 'a'], wood: ['0', '1', '2', '3', '5'], rim: ['0', '2', '3', '5', '6'],
      sight: 'rivet', sightC: ['9', 'a', 'v', 'd'], sigil: 'star', accent: 'v', glow: 'd',
      wall: ['0', '1', '1', '9', '2'], wallKind: 'basalt', particles: 'embers', wax: ['1', '2', '3'], flame: ['b', 'v', 'h'],
      lightC: 'v',
    },
    abismo: {
      id: 'abismo', name: 'Abismo',
      felt: ['0', '1', '1', '2', '3'], wood: ['0', '0', '1', 'o', '2'], rim: ['0', 'o', 'p', 'q', 'r'],
      sight: 'rune', sightC: ['o', 'p', 'q', 'r'], sigil: 'runes', accent: 'r', glow: 'q',
      wall: ['0', '0', '1', '1', 'o'], wallKind: 'void', particles: 'motes', wax: ['2', '3', '4'], flame: ['p', 'q', 'r'],
      lightC: 'r',
    },
  };
  const themeOf = (t) => (typeof t === 'string' ? THEMES[t] : t && t.id ? THEMES[t.id] || t : null) || THEMES.limbo;

  // ------------------------------------------------------------------
  // TRONERAS (fuente de verdad para la física)
  // ------------------------------------------------------------------
  // Esquinas: 1px por fuera de la esquina del paño (diagonal). Laterales: 3px por fuera del borde.
  const POCKETS = [
    { id: 'tl', x: FE.x - 1, y: FE.y - 1, corner: true },
    { id: 'tm', x: FE.x + FE.w / 2, y: FE.y - 3, corner: false },
    { id: 'tr', x: FE.x + FE.w + 1, y: FE.y - 1, corner: true },
    { id: 'bl', x: FE.x - 1, y: FE.y + FE.h + 1, corner: true },
    { id: 'bm', x: FE.x + FE.w / 2, y: FE.y + FE.h + 3, corner: false },
    { id: 'br', x: FE.x + FE.w + 1, y: FE.y + FE.h + 1, corner: true },
  ];
  function pockets() {
    return POCKETS.map((p) => ({ x: p.x, y: p.y, corner: p.corner, id: p.id, r: L.pocketR }));
  }

  // ------------------------------------------------------------------
  // SIGILOS tejidos en el paño (máscaras 400x200)
  // ------------------------------------------------------------------
  function sigilMask(kind) {
    const W = FE.w, H = FE.h, m = new Uint8Array(W * H);
    const cx = W / 2, cy = H / 2;
    const P = (x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 1; };
    const ring = (r, step) => {
      const n = Math.ceil(2 * Math.PI * r * 1.2);
      for (let i = 0; i < n; i++) { if (step && (i % step) > step / 2) continue; const a = (i / n) * Math.PI * 2; P(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    };
    const line = (x0, y0, x1, y1) => {
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
      for (let i = 0; i <= n; i++) P(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n);
    };
    const polar = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    if (kind === 'eye') {
      ring(46); ring(42, 6);
      for (let x = -30; x <= 30; x++) { const h = 15 * (1 - (x / 30) * (x / 30)); P(cx + x, cy - h); P(cx + x, cy + h); }
      ring(7); ring(3);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const [x0, y0] = polar(48, a), [x1, y1] = polar(54, a); line(x0, y0, x1, y1); }
    } else if (kind === 'heart') {
      ring(48); ring(44, 4);
      for (let i = 0; i < 400; i++) {
        const a = i / 400 * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
        P(cx + x * 1.8, cy + y * 1.8 - 2);
      }
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const [x, y] = polar(51, a); P(x, y); P(x + 1, y); P(x, y + 1); }
    } else if (kind === 'maw') {
      ring(48); ring(40);
      for (let i = 0; i < 18; i++) {
        const a0 = i / 18 * Math.PI * 2, a1 = (i + 0.5) / 18 * Math.PI * 2, a2 = (i + 1) / 18 * Math.PI * 2;
        const p0 = polar(40, a0), p1 = polar(28, a1), p2 = polar(40, a2);
        line(p0[0], p0[1], p1[0], p1[1]); line(p1[0], p1[1], p2[0], p2[1]);
      }
      ring(8);
    } else if (kind === 'coin') {
      ring(48); ring(44); ring(30);
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const p0 = polar(44, a), p1 = polar(48, a); line(p0[0], p0[1], p1[0], p1[1]); }
      line(cx, cy - 22, cx + 14, cy); line(cx + 14, cy, cx, cy + 22); line(cx, cy + 22, cx - 14, cy); line(cx - 14, cy, cx, cy - 22);
      line(cx, cy - 12, cx, cy + 12);
    } else if (kind === 'star') {
      ring(48); ring(44, 5);
      const pts = []; for (let i = 0; i < 5; i++) pts.push(polar(44, -Math.PI / 2 + Math.PI + i * Math.PI * 2 / 5));
      for (let i = 0; i < 5; i++) { const a = pts[i], b = pts[(i + 2) % 5]; line(a[0], a[1], b[0], b[1]); }
    } else if (kind === 'runes') {
      ring(50); ring(46); ring(22); ring(18, 4);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + 0.2;
        const [x, y] = polar(34, a);
        const v = i % 4;
        // runitas 5x7
        if (v === 0) { line(x, y - 3, x, y + 3); line(x, y - 3, x + 2, y - 1); line(x, y, x + 2, y + 2); }
        if (v === 1) { line(x - 2, y - 3, x + 2, y + 3); line(x + 2, y - 3, x - 2, y + 3); }
        if (v === 2) { line(x, y - 3, x, y + 3); line(x - 2, y - 1, x + 2, y - 1); line(x - 2, y + 2, x, y); }
        if (v === 3) { line(x - 2, y + 3, x, y - 3); line(x, y - 3, x + 2, y + 3); line(x - 1, y + 1, x + 1, y + 1); }
      }
      for (let x = -12; x <= 12; x++) { const h = 6 * (1 - (x / 12) * (x / 12)); P(cx + x, cy - h); P(cx + x, cy + h); }
      ring(2);
    }
    return m;
  }

  // ------------------------------------------------------------------
  // MESA (cacheada por tema + opciones)
  // ------------------------------------------------------------------
  const tableCache = {};
  // posiciones (locales a la mesa) de las miras de banda
  function sightPos() {
    const fx0 = FE.x - TB.x, fy0 = FE.y - TB.y, W = TB.w, H = TB.h, m = (fy0 - 6) / 2, mx = (fx0 - 6) / 2;
    const out = [];
    for (const fx of [50, 100, 150, 250, 300, 350]) { out.push([fx0 + fx, m]); out.push([fx0 + fx, H - 1 - m]); }
    for (const fy of [50, 100, 150]) { out.push([mx, fy0 + fy, fy === 100]); out.push([W - 1 - mx, fy0 + fy, fy === 100]); }
    return out;
  }
  let runeGlowC = null;
  function runeGlow() {
    if (runeGlowC) return runeGlowC;
    const R = ['.3.3.', '.333.', '..3..', '.3.3.', '3...3'];
    const pb = new PB(9, 9);
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (R[j][i] === '3') {
      for (const [a, b] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (!pb.get(i + 2 + a, j + 2 + b)) pb.set(i + 2 + a, j + 2 + b, 'q', 110);
    }
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (R[j][i] === '3') pb.set(i + 2, j + 2, '8');
    return (runeGlowC = pb.toCanvas());
  }
  const PAD = 8; // margen extra del canvas (sombra y faldón)
  function buildTable(th, sealed, ps) {
    const W = TB.w, H = TB.h;
    const pb = new PB(W + PAD * 2, H + PAD * 2);
    const fx0 = FE.x - TB.x, fy0 = FE.y - TB.y, fx1 = fx0 + FE.w, fy1 = fy0 + FE.h; // paño local [fx0,fx1)
    const CUSH = 6; // ancho del cojín
    const rh = Math.max(3, Math.round(L.pocketR * ps) - 1); // radio visible del agujero
    const cutR = rh + 3; // corte de los cojines
    const pk = POCKETS.map((p) => ({ x: p.x - TB.x, y: p.y - TB.y, corner: p.corner }));
    const sig = sigilMask(th.sigil);
    const R = 9; // esquina redondeada exterior
    const insideRR = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const cx = x < R ? R : x > W - 1 - R ? W - 1 - R : x, cy = y < R ? R : y > H - 1 - R ? H - 1 - R : y;
      const dx = x - cx, dy = y - cy;
      return dx * dx + dy * dy <= R * R + R * 0.6;
    };
    const S = (x, y, c, a) => pb.set(x + PAD, y + PAD, c, a);

    // sombra de la mesa sobre el suelo + faldón frontal
    for (let y = 0; y < H + PAD; y++) for (let x = -3; x < W + 5; x++) {
      if (insideRR(x, y)) continue;
      if (insideRR(x - 3, y - 6)) S(x, y, '0', 150);
      else if (insideRR(x - 2, y - 4) || insideRR(x - 4, y - 7)) S(x, y, '0', 70);
    }
    for (let x = 0; x < W; x++) for (let y = H - 1; y < H + 4; y++) {
      if (!insideRR(x, Math.min(y, H - 1)) || insideRR(x, y)) continue;
      if (!insideRR(x, H - 1 - (y - H + 1) * 0) ) continue;
      const v = y === H + 3 ? 0 : 0.35 - (y - H) * 0.08 + hash(x, 3) * 0.1;
      S(x, y, y === H + 3 ? '0' : pick(th.wood.slice(0, 3), v, x, y));
    }

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!insideRR(x, y)) continue;
      // tronera más cercana
      let dp = 1e9, P = null;
      for (const p of pk) { const d = Math.hypot(x + 0.5 - p.x - 0.5, y + 0.5 - p.y - 0.5); if (d < dp) { dp = d; P = p; } }
      const inFelt = x >= fx0 && x < fx1 && y >= fy0 && y < fy1;
      // distancia (fuera) al paño
      const ox = x < fx0 ? fx0 - x : x >= fx1 ? x - fx1 + 1 : 0;
      const oy = y < fy0 ? fy0 - y : y >= fy1 ? y - fy1 + 1 : 0;
      const dOut = Math.max(ox, oy);
      const sealedP = sealed && P && !P.corner;
      // --- agujero ---
      // las laterales solo muerden 4px del paño (boca recta, como en una mesa real)
      const sideClip = P && !P.corner && (P.y < fy0 ? y >= fy0 + 4 : y < fy1 - 4);
      if (dp <= rh && !sealedP && !sideClip) {
        const ang = Math.atan2(y - P.y, x - P.x);
        const edge = dp > rh - 2.2;
        let c = '0';
        const lipRow = P && !P.corner && (P.y < fy0 ? y === fy0 + 3 : y === fy1 - 4);
        if (lipRow) c = '0';
        else if (edge && Math.sin(ang) > 0.25) c = dp > rh - 1.2 ? th.felt[0] === '0' ? '2' : th.felt[1] : '1'; // pared lejana iluminada
        else if (dp > rh - 1.2) c = '0';
        else if (dp < rh * 0.55 && hash(x, y, 4) < 0.18) c = '1'; // red/bolsa
        S(x, y, c);
        continue;
      }
      if (inFelt) {
        // --- PAÑO ---
        const lx = x - fx0, ly = y - fy0;
        const dx = (lx - FE.w / 2) / (FE.w * 0.62), dy = (ly - FE.h / 2) / (FE.h * 0.7);
        let v = 0.82 - (dx * dx + dy * dy) * 0.62;
        // sombra de cojines (luz cenital ligeramente hacia el jugador)
        if (ly < 2) v -= (2 - ly) * 0.09;
        if (lx < 2) v -= (2 - lx) * 0.1;
        if (lx > FE.w - 3) v -= (lx - FE.w + 3) * 0.08;
        if (ly > FE.h - 2) v -= 0.05;
        // labio de la tronera
        if (!sealedP && !sideClip && dp <= rh + 2.5) v -= dp <= rh + 1.2 ? 0.5 : 0.22;
        if (sideClip && !sealedP && dp <= rh + 0.5 && (P.y < fy0 ? y === fy0 + 4 : y === fy1 - 5)) v -= 0.3;
        // pelusa del paño
        const hn = hash(lx, ly, 1);
        if (hn < 0.03) v += 0.1; else if (hn > 0.965) v -= 0.12;
        // vetas muy sutiles del tejido
        if (((lx + ly * 3) % 23) === 0 && hash(lx, ly, 2) < 0.5) v -= 0.06;
        let c = pick(th.felt, v, x, y, 2.6);
        // sigilo tejido
        if (sig[ly * FE.w + lx] && ((lx + ly) & 1) === 0) {
          const i = th.felt.indexOf(c);
          c = th.felt[Math.max(0, i - 1)];
          if (c === th.felt[Math.max(0, i)] && i > 0) c = th.felt[i - 1];
        }
        // puntos de salida / pie
        if ((lx === 100 || lx === 300) && ly === 100) c = th.felt[4];
        if (((lx === 99 || lx === 101) && ly === 100) || (lx === 100 && (ly === 99 || ly === 101))) c = th.felt[3];
        S(x, y, c);
        continue;
      }
      // --- fuera del paño ---
      const inCushBand = dOut >= 1 && dOut <= CUSH;
      if (inCushBand) {
        // ¿está cortado el cojín por la tronera? (mandíbulas en ángulo hacia la boca)
        let cut = false, along = 0, js = 0;
        if (ox > 0 && oy > 0) cut = true;
        else if (!sealedP && P) {
          along = oy > 0 ? Math.abs(x + 0.5 - P.x) : Math.abs(y + 0.5 - P.y);
          if (P.corner) js = rh + 2 + (CUSH - dOut) * 0.9;
          else js = rh + 0.5 + (CUSH - dOut) * 0.6;
          cut = along < js;
        }
        if (sealedP && dp <= cutR + 8) cut = false;
        if (cut) {
          // embudo/delantal de la tronera
          const v = 0.3 - (cutR - Math.min(dp, cutR)) * 0.05 + (hash(x, y, 7) - 0.5) * 0.08;
          S(x, y, pick(th.felt.slice(0, 3), v, x, y, 2));
          continue;
        }
        const jaw = js > 0 && along < js + 1;
        // cojín: d=1 sombra del morro, d=2 brillo del morro, cara superior, d=CUSH junta oscura
        const d = dOut;
        const top = y < fy0, left = x < fx0;
        const prof = top || left ? [0, 1, 4, 4, 3, 3, 1] : [0, 2, 4, 4, 3, 3, 1];
        let c = th.felt[prof[d]];
        if (d >= 3 && d <= 4 && hash(x, y, 13) < 0.12) c = th.felt[2];
        // cara de la mandíbula
        if (jaw) c = dOut <= 2 ? th.felt[4] : th.felt[3];
        S(x, y, c);
        continue;
      }
      // --- MADERA / aro metálico ---
      if (!sealedP && dp <= rh + 4.2) {
        // aro metálico
        const ang = Math.atan2(y - P.y, x - P.x);
        const lit = -Math.cos(ang + Math.PI * 0.25 + Math.PI); // luz arriba-izq
        let c;
        if (dp > rh + 3.3) c = '0';
        else c = pick(th.rim, 0.5 + lit * 0.42 + (dp < rh + 1 ? -0.25 : dp > rh + 2.4 ? 0.12 : 0), x, y, 2.5);
        if (hash(x, y, 9) < 0.06) c = th.rim[4];
        S(x, y, c);
        continue;
      }
      // madera
      const eo = Math.min(x, y, W - 1 - x, H - 1 - y); // distancia al borde exterior
      const rail = dOut; // 7..18
      const horiz = (y < fy0 - CUSH || y >= fy1 + CUSH) && x >= fx0 - CUSH && x < fx1 + CUSH;
      let c;
      if (!insideRR(x - 1, y) || !insideRR(x + 1, y) || !insideRR(x, y - 1) || !insideRR(x, y + 1)) c = '0';
      else if (rail === CUSH + 1) c = th.wood[0]; // junta con cojín
      else {
        const u = horiz ? x : y, w = horiz ? y : x;
        const grain = Math.sin(u * 0.045 + Math.sin(u * 0.011 + w * 0.9) * 2.2 + w * 1.7) * 0.5 + 0.5;
        let v = 0.42 + grain * 0.22 + (hash(u >> 2, w, 3) - 0.5) * 0.12;
        if (eo === 1) v = (y < H / 2 && horiz) || (x < W / 2 && !horiz) ? 0.95 : 0.6;
        else if (eo === 2) v += 0.12;
        if (rail === CUSH + 2) v -= 0.18;
        c = pick(th.wood, v, x, y, 2);
      }
      S(x, y, c);
    }

    // --- miras (diamantes) temáticas ---
    const sights = sightPos();
    const SIGHT = {
      skull: ['.111.', '13331', '12121', '.131.', '.1.1.'],
      diamond: ['..3..', '.323.', '32223', '.313.', '..1..'],
      tooth: ['.333.', '32223', '.323.', '.32.', '..1..'],
      coin: ['.111.', '13321', '13221', '12221', '.111.'],
      rivet: ['.000.', '01120', '01210', '02220', '.000.'],
      rune: ['.3.3.', '.333.', '..3..', '.3.3.', '3...3'],
    }[th.sight];
    for (const [sx, sy] of sights) {
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
        const ch = SIGHT[j][i];
        if (!ch || ch === '.') continue;
        if (th.sight === 'rune' && ch === '3') { S(sx - 2 + i, sy - 2 + j, th.sightC[2]); continue; }
        S(sx - 2 + i, sy - 2 + j, th.sightC[+ch]);
      }
    }
    // remaches de esquina / decoración por tema
    const rivet = (x, y) => { S(x, y, th.rim[3]); S(x + 1, y, th.rim[1]); S(x, y + 1, th.rim[1]); S(x + 1, y + 1, th.rim[0]); };
    if (th.id === 'ira' || th.id === 'lujuria' || th.id === 'avaricia') {
      for (let x = 30; x < W - 30; x += th.id === 'ira' ? 25 : 50) {
        if (Math.abs(x - W / 2) < 18) continue;
        if (sights.some((s) => Math.abs(s[0] - x) < 6)) continue;
        rivet(x, 3); rivet(x, H - 5);
      }
    }
    // placas en los centros de las bandas cortas (calavera / emblema)
    const PLATE = {
      limbo: ['..1111..', '.177771.', '17077071', '17777771', '.170071.', '..1771..', '..1..1..'],
      lujuria: ['.11.11..', '1hh1hh1.', '1hhhhh1.', '.1hhh1..', '..1h1...', '...1....'],
      gula: ['.111111.', '17777771', '1070070.', '17777771', '.1m11m1.', '..m..m..', '..m.....'],
      avaricia: ['..1111..', '.1hhhh1.', '1hh1hhh1', '1h1hhhh1', '1hh11hh1', '1hhhh1h1', '.1hhhh1.', '..1111..'],
      ira: ['1......1', '11....11', '.1aaaa1.', '1avvvva1', '1a0aa0a1', '.1aaaa1.', '..1111..'],
      abismo: ['...11...', '..1rr1..', '.1r00r1.', '1rr00rr1', '.1r00r1.', '..1rr1..', '...11...'],
    }[th.id];
    if (PLATE) {
      for (const px of [Math.round((fx0 - CUSH) / 2) - 4, W - 1 - Math.round((fx0 - CUSH) / 2) - 3]) {
        // ocultar la mira central (y=100) bajo la placa
        const py = fy0 + 100 - Math.floor(PLATE.length / 2);
        for (let j = -1; j <= PLATE.length; j++) for (let i = -1; i <= 8; i++) {
          const ch = PLATE[j] && PLATE[j][i];
          if (ch && ch !== '.') S(px + i, py + j, ch);
          else if (j >= 0 && j < PLATE.length && i >= 0 && i < 8) { /* deja la madera */ }
        }
      }
    }
    return pb.toCanvas();
  }

  function tableCanvas(th, sealed, ps) {
    const key = th.id + '|' + (sealed ? 1 : 0) + '|' + Math.round(ps * 100);
    let c = tableCache[key];
    if (!c) c = tableCache[key] = buildTable(th, !!sealed, ps);
    return c;
  }

  // tablón sellador con cadena para troneras laterales
  let sealSprite = null;
  function getSeal() {
    if (sealSprite) return sealSprite;
    const pb = new PB(38, 18);
    // dos tablones clavados
    for (const [y0, x0, x1] of [[2, 1, 36], [9, 2, 35]]) {
      for (let y = y0; y < y0 + 6; y++) for (let x = x0; x <= x1; x++) {
        const r = y - y0;
        let c = r === 0 ? 'g' : r === 5 ? 'e' : 'f';
        if ((r === 2 || r === 3) && hash(x >> 2, y0 + r, 5) < 0.3) c = 'e';
        if (x === x0 || x === x1) c = 'e';
        pb.set(x, y, c);
      }
      for (const nx of [x0 + 2, x1 - 2]) { pb.set(nx, y0 + 2, '7'); pb.set(nx, y0 + 3, '3'); }
    }
    // cadena horizontal
    for (let x = 0; x < 38; x += 5) {
      pb.set(x, 7, '5'); pb.set(x + 1, 6, '6'); pb.set(x + 2, 6, '6'); pb.set(x + 3, 7, '5');
      pb.set(x + 1, 8, '3'); pb.set(x + 2, 8, '3'); pb.set(x + 4, 7, '6');
    }
    // candado
    pb.set(17, 4, '6'); pb.set(18, 3, '7'); pb.set(19, 3, '7'); pb.set(20, 4, '6'); pb.set(17, 5, '5'); pb.set(20, 5, '5');
    for (let y = 6; y < 12; y++) for (let x = 16; x < 22; x++) pb.set(x, y, y === 6 ? 'i' : y === 11 ? 'g' : x === 16 ? 'i' : 'h');
    pb.set(18, 8, '0'); pb.set(18, 9, '0'); pb.set(19, 8, '0');
    pb.outline('0');
    return (sealSprite = pb.toCanvas());
  }

  function drawTable(ctx, theme, t, opts) {
    const th = themeOf(theme);
    opts = opts || {};
    t = t || 0;
    const ps = opts.pocketScale || 1;
    ctx.drawImage(tableCanvas(th, opts.sealedSides, ps), TB.x - PAD, TB.y - PAD);
    if (opts.sealedSides) {
      const s = getSeal();
      for (const p of POCKETS) if (!p.corner) ctx.drawImage(s, p.x - 19, (p.y < FE.y ? FE.y - 14 : FE.y + FE.h - 4));
    }
    // animados por tema
    ctx.save();
    if (th.id === 'abismo') {
      // el sigilo respira en cian
      const a = 0.08 + 0.06 * Math.sin(t * 1.3);
      ctx.globalAlpha = a;
      ctx.drawImage(sigilGlow(th), FE.x, FE.y);
      // runas de banda que se encienden en ola
      const rg = runeGlow();
      sightPos().forEach((sp, i) => {
        if (sp[2]) return;
        const k = Math.max(0, Math.sin(t * 1.6 - (sp[0] + sp[1]) * 0.02));
        ctx.globalAlpha = k * k * 0.85;
        ctx.drawImage(rg, TB.x + sp[0] - 4, TB.y + sp[1] - 4);
      });
    } else if (th.id === 'ira') {
      // grietas incandescentes en los raíles
      ctx.fillStyle = OM.PAL.v;
      for (let i = 0; i < 14; i++) {
        const k = Math.max(0, Math.sin(t * 1.7 + i * 2.3));
        ctx.globalAlpha = k * 0.55;
        const x = TB.x + 24 + ((i * 97) % (TB.w - 48)), top = i % 2 === 0;
        const y = top ? TB.y + 2 : TB.y + TB.h - 4;
        ctx.fillRect(x, y, 3, 1); ctx.fillRect(x + 2, y + 1, 2, 1); ctx.fillRect(x - 1, y + (top ? 1 : -1), 1, 1);
      }
    } else if (th.id === 'gula') {
      // gotas de baba resbalando por el canto
      ctx.fillStyle = OM.PAL.m;
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.25 + i * 0.37) % 1;
        const x = TB.x + 40 + i * 83;
        ctx.globalAlpha = 0.8 * (1 - ph);
        ctx.fillRect(x, TB.y + TB.h, 1, 1 + Math.floor(ph * 5));
        ctx.fillRect(x, TB.y + TB.h + 1 + Math.floor(ph * 5), 2, 1);
      }
    } else {
      // destello lento sobre los aros de tronera
      const p = POCKETS[Math.floor(t / 2.5) % 6], ph = (t % 2.5) / 2.5;
      if (ph < 0.35) {
        ctx.globalAlpha = Math.sin(ph / 0.35 * Math.PI) * 0.9;
        ctx.fillStyle = OM.PAL[th.rim[4]];
        const ang = -2.2 + ph * 2;
        const x = Math.round(p.x + Math.cos(ang) * (L.pocketR * ps + 1)), y = Math.round(p.y + Math.sin(ang) * (L.pocketR * ps + 1));
        ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
      }
    }
    ctx.restore();
  }

  const sigilGlowCache = {};
  function sigilGlow(th) {
    if (sigilGlowCache[th.id]) return sigilGlowCache[th.id];
    const m = sigilMask(th.sigil), pb = new PB(FE.w, FE.h);
    for (let i = 0; i < m.length; i++) if (m[i]) pb.k[i] = th.accent;
    return (sigilGlowCache[th.id] = pb.toCanvas());
  }

  // ------------------------------------------------------------------
  // FONDOS DE SALA
  // ------------------------------------------------------------------
  const backCache = {};
  const SCONCES = [[186, 118], [186, 262], [634, 118], [634, 262]];
  function inUI(x, y) { return (x >= 4 && x <= 184 && y >= 4 && y <= 356) || (y >= 4 && y <= 66 && x >= 186 && x <= 636); }
  function buildBackdrop(th) {
    const W = OM.W, H = OM.H, pb = new PB(W, H);
    const tcx = TB.x + TB.w / 2, tcy = TB.y + TB.h / 2;
    const floorY = 318;
    const w = th.wall;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // luz: charco alrededor de la mesa + viñeta
      const lx = (x - tcx) / 330, ly = (y - tcy) / 230;
      let light = 0.74 - (lx * lx + ly * ly) * 0.62;
      const vx = (x - W / 2) / (W / 2), vy = (y - H / 2) / (H / 2);
      light -= Math.max(0, vx * vx + vy * vy - 0.7) * 0.35;
      let v = light, c = null;
      if (y >= floorY) {
        // suelo de tablones en ligera perspectiva
        const fy = y - floorY;
        const plank = Math.floor((x - tcx) / (22 + fy * 0.8) + 100);
        const edge = Math.abs(((x - tcx) / (22 + fy * 0.8)) % 1) < 0.06;
        v = light * 0.8 + (hash(plank, 1, 3) - 0.5) * 0.12 - 0.05;
        if (edge || fy === 0) v -= 0.25;
        if (fy === 1) v += 0.1;
        c = pick(['0', '1', '2', 'e', 'f'], v * 0.85, x, y, 2);
      } else {
        let k = 0;
        switch (th.wallKind) {
          case 'stone': {
            const row = Math.floor(y / 14), off = (row % 2) * 13;
            const bx = (x + off) % 26, by = y % 14;
            const id = Math.floor((x + off) / 26) + row * 31;
            if (bx === 0 || by === 0) k = -0.3; else if (by === 1 || bx === 1) k = 0.06;
            k += (hash(id, row, 1) - 0.5) * 0.18 + (hash(x, y, 2) < 0.05 ? -0.12 : 0);
            if (hash(x >> 1, y >> 1, 8) < 0.02 && by > 9) c = 'j'; // musgo
            break;
          }
          case 'curtain': {
            const f = Math.sin(x * 0.19 + Math.sin(x * 0.031) * 3);
            k = f * 0.22 - (y < 30 ? 0 : 0) + (y > 280 ? -0.1 : 0);
            if (y === 22 || y === 23) c = y === 22 ? 'h' : 'g'; // barra de latón
            if (y < 22) k -= 0.15;
            break;
          }
          case 'tiles': {
            const tx = x % 14, ty = y % 14;
            if (tx === 0 || ty === 0) k = -0.3;
            else if (tx === 1 || ty === 1) k = 0.12;
            k += (hash(Math.floor(x / 14), Math.floor(y / 14), 5) - 0.5) * 0.2;
            // chorretones de baba
            const col = Math.floor(x / 9);
            const len = hash(col, 0, 6) < 0.3 ? 10 + hash(col, 1, 6) * 70 : 0;
            const xo = x % 9;
            const bulb = y > len - 4 && y < len && xo >= 2 && xo <= 5;
            if ((y < len && xo >= 3 && xo <= 4) || bulb) { c = pick(['j', 'k', 'l', 'm'], light * 0.9 + (xo === 3 ? 0.15 : 0) - y / 400, x, y, 2); }
            break;
          }
          case 'damask': {
            const px = (x % 24) - 12, py = (y % 30) - 15;
            const dm = Math.abs(px) / 12 + Math.abs(py) / 15;
            if (Math.abs(dm - 0.75) < 0.07 || (Math.abs(px) < 2 && Math.abs(py) < 2)) k = 0.18;
            if (y > 230 && y < 236) { c = y === 230 ? 'h' : y === 235 ? 'e' : 'g'; }
            if (y >= 236) { k = (x % 40 === 0 || x % 40 === 1) ? -0.2 : 0.05; }
            break;
          }
          case 'basalt': {
            // placas de basalto (voronoi) con grietas de lava
            const gx = Math.floor(x / 30), gy = Math.floor(y / 26);
            let d1 = 1e9, d2 = 1e9, id = 0;
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
              const cx = (gx + i) * 30 + hash(gx + i, gy + j, 1) * 30, cy = (gy + j) * 26 + hash(gx + i, gy + j, 2) * 26;
              const d = Math.hypot(x - cx, y - cy);
              if (d < d1) { d2 = d1; d1 = d; id = (gx + i) * 57 + gy + j; } else if (d < d2) d2 = d;
            }
            const e = d2 - d1;
            k = (hash(id, 0, 3) - 0.5) * 0.3 + (e > 3 && e < 5 ? 0.08 : 0) + (hash(x, y, 1) < 0.06 ? -0.12 : 0);
            const hot = hash(id, 1, 4) < 0.45;
            if (e < 1.1) c = hot && light > 0.3 ? (e < 0.5 && light > 0.45 ? 'v' : 'b') : '9';
            else if (e < 2.2 && hot && light > 0.35) c = (x + y) & 1 ? '9' : null;
            break;
          }
          case 'void': {
            k = -0.1 + Math.sin(x * 0.01 + y * 0.02) * 0.08;
            if (hash(x, y, 11) < 0.004) c = hash(x, y, 12) < 0.5 ? '4' : 'p';
            break;
          }
        }
        v = light + k;
        if (!c) c = pick(w, v, x, y, 2);
      }
      pb.set(x, y, c || '0');
    }
    // apliques de vela: soporte de latón
    for (const [sx, sy] of SCONCES) {
      for (let j = 0; j < 4; j++) pb.set(sx - 2 + j, sy + 10, 'g');
      pb.set(sx - 2, sy + 11, 'f'); pb.set(sx + 1, sy + 11, 'f'); pb.set(sx - 1, sy + 12, 'e'); pb.set(sx, sy + 12, 'e');
      pb.set(sx - 1, sy + 13, 'e'); pb.set(sx - 2, sy + 9, '0'); pb.set(sx + 1, sy + 9, '0');
      for (let j = 0; j < 9; j++) { pb.set(sx - 1, sy + 1 + j, th.wax[j < 2 ? 2 : 1]); pb.set(sx, sy + 1 + j, th.wax[j < 1 ? 2 : 0]); }
      pb.set(sx - 1, sy + 3, th.wax[2]); pb.set(sx - 1, sy + 4, th.wax[2]); // goterón
      pb.set(sx - 2, sy + 1, '0'); pb.set(sx + 1, sy + 1, '0');
    }
    return pb.toCanvas();
  }

  let glowSprites = {};
  function glowSprite(col, r) {
    const key = col + r;
    if (glowSprites[key]) return glowSprites[key];
    const pb = new PB(r * 2 + 1, r * 2 + 1);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y) / r;
      if (d > 1) continue;
      const a = (1 - d) * (1 - d);
      if (a > bayer(x + r, y + r) * 0.9) pb.set(x + r, y + r, col, Math.round(40 + a * 120));
    }
    return (glowSprites[key] = pb.toCanvas());
  }

  function drawBackdrop(ctx, theme, t) {
    const th = themeOf(theme);
    t = t || 0;
    let c = backCache[th.id];
    if (!c) c = backCache[th.id] = buildBackdrop(th);
    ctx.drawImage(c, 0, 0);
    ctx.save();
    // velas
    for (let i = 0; i < SCONCES.length; i++) {
      const [sx, sy] = SCONCES[i];
      const fl = Math.sin(t * 9 + i * 2.1) * 0.5 + Math.sin(t * 23 + i) * 0.3;
      ctx.globalAlpha = 0.55 + fl * 0.15;
      const gs = glowSprite(th.flame[1], 16);
      ctx.drawImage(gs, sx - 16, sy - 18);
      ctx.globalAlpha = 1;
      const h = 4 + (fl > 0.3 ? 1 : 0), lean = Math.round(Math.sin(t * 3.1 + i) * 0.7);
      ctx.fillStyle = OM.PAL[th.flame[0]]; ctx.fillRect(sx - 1, sy - h + 1, 2, h - 1);
      ctx.fillRect(sx - 1 + lean, sy - h, 1, 1);
      ctx.fillStyle = OM.PAL[th.flame[1]]; ctx.fillRect(sx - 1, sy - h + 2, 2, h - 3);
      ctx.fillStyle = OM.PAL[th.flame[2]]; ctx.fillRect(sx - 1, sy - 1, 1, 1);
      ctx.fillStyle = OM.PAL['0']; ctx.fillRect(sx, sy, 1, 1);
    }
    // partículas ambientales deterministas
    const P = th.particles;
    const N = 46;
    for (let i = 0; i < N; i++) {
      const r1 = hash(i, 1, 21), r2 = hash(i, 2, 21), r3 = hash(i, 3, 21);
      let x, y, col, a;
      if (P === 'dust') {
        x = (r1 * 640 + t * (3 + r3 * 4) + Math.sin(t * 0.5 + i) * 6) % 640;
        y = (r2 * 360 + t * (1 + r3 * 2)) % 360; col = '6'; a = 0.25 + 0.25 * Math.sin(t * 1.3 + i);
      } else if (P === 'petals') {
        x = (r1 * 640 + Math.sin(t * 0.8 + i) * 10) % 640; y = (r2 * 360 + t * (6 + r3 * 6)) % 360; col = i % 3 ? 'b' : 'u'; a = 0.5;
      } else if (P === 'spores') {
        x = (r1 * 640 + Math.sin(t * 0.6 + i * 3) * 8) % 640; y = 360 - (r2 * 360 + t * (4 + r3 * 5)) % 360; col = i % 4 ? 'm' : 'n'; a = 0.25 + 0.3 * Math.sin(t * 2 + i);
      } else if (P === 'glints') {
        x = r1 * 640; y = r2 * 360; col = 'i';
        a = Math.max(0, Math.sin(t * (0.7 + r3) + i * 5)) ** 8;
      } else if (P === 'embers') {
        x = (r1 * 640 + Math.sin(t * 1.5 + i) * 7) % 640; y = 360 - (r2 * 360 + t * (14 + r3 * 18)) % 360;
        col = i % 3 ? 'v' : 'd'; a = 0.4 + 0.4 * Math.sin(t * 6 + i);
      } else {
        x = (r1 * 640 + Math.sin(t * 0.3 + i) * 14) % 640; y = (r2 * 360 + Math.cos(t * 0.4 + i) * 10) % 360;
        col = i % 3 ? 'q' : 'r'; a = 0.2 + 0.3 * Math.sin(t * 1.1 + i * 2);
      }
      x = Math.floor(x < 0 ? x + 640 : x); y = Math.floor(y < 0 ? y + 360 : y);
      if (a <= 0.02) continue;
      ctx.globalAlpha = Math.min(1, a) * (inUI(x, y) ? 0.45 : 1);
      ctx.fillStyle = OM.PAL[col];
      ctx.fillRect(x, y, 1, 1);
      if (P === 'glints' && a > 0.5) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
      if (P === 'petals') ctx.fillRect(x + 1, y + (i % 2), 1, 1);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // BOLAS: sprites 13x13 generados por orientación (atlas perezoso)
  // ------------------------------------------------------------------
  const BALL_RAMP = {
    0: ['4', '6', '7', '8'],
    1: ['f', 'g', 'h', 'i'], 2: ['o', 'p', 'q', 'r'], 3: ['9', 'b', 'c', 'd'], 4: ['2', 's', 't', 'u'],
    5: ['e', 'g', 'v', 'd'], 6: ['j', 'l', 'm', 'n'], 7: ['1', '9', 'a', 'b'], 8: ['0', '1', '2', '4'],
  };
  const WHITE = ['5', '6', '7', '8'];
  const GOLD = ['f', 'g', 'h', 'i'];
  const CRYS = ['p', 'q', 'r', '8'];
  const LEAD = ['1', '2', '3', '5'];
  const EMBER = ['9', 'b', 'v', 'd'];
  const IRON = ['0', '1', '2', '3'];
  const HOLO = ['c', 'v', 'h', 'n', 'm', 'r', 'q', 't', 'u'];
  const DIG = {
    0: ['010', '101', '101', '101', '010'], 1: ['010', '110', '010', '010', '111'], 2: ['110', '001', '010', '100', '111'],
    3: ['110', '001', '010', '001', '110'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '110', '001', '110'],
    6: ['011', '100', '110', '101', '010'], 7: ['111', '001', '010', '010', '010'], 8: ['010', '101', '010', '101', '010'],
    9: ['010', '101', '011', '001', '110'],
  };
  function numGlyph(n) {
    if (n < 10) return DIG[n];
    const d = DIG[n % 10];
    return d.map((r) => '1.' + r); // "1" de 1px + hueco + dígito
  }
  const STEPS = 24, CELL = 13;
  const LV = (() => { const l = [-0.45, -0.65, 0.62], m = Math.hypot(...l); return l.map((v) => v / m); })();
  const HV = (() => { const h = [LV[0], LV[1], LV[2] + 1], m = Math.hypot(...h); return h.map((v) => v / m); })();
  const atlases = {};

  // world -> local (inversa de la rotación por rodadura)
  function toLocal(x, y, z, ax, ay) {
    // rotación de rodadura: R = Rx(ay) * Ry(ax) ; local = R^T * world
    // R^T = Ry(-ax) * Rx(-ay)
    let c = Math.cos(-ay), s = Math.sin(-ay);
    // Rx: y' = c*y + s*z ; z' = -s*y + c*z  (rodar hacia +y lleva el polo frontal hacia +y)
    let y1 = c * y + s * z, z1 = -s * y + c * z, x1 = x;
    c = Math.cos(-ax); s = Math.sin(-ax);
    // Ry: x' = c*x + s*z ; z' = -s*x + c*z
    const x2 = c * x1 + s * z1, z2 = -s * x1 + c * z1;
    return [x2, y1, z2];
  }
  function toWorld(x, y, z, ax, ay) {
    let c = Math.cos(ax), s = Math.sin(ax);
    const x1 = c * x + s * z, z1 = -s * x + c * z, y1 = y;
    c = Math.cos(ay); s = Math.sin(ay);
    return [x1, c * y1 + s * z1, -s * y1 + c * z1];
  }

  function genBall(ctx, num, kind, holoF, ix, iy, ox, oy) {
    const ax = (ix / STEPS) * Math.PI * 2, ay = (iy / STEPS) * Math.PI * 2;
    const pb = new PB(CELL, CELL);
    const flag = new Uint8Array(CELL * CELL); // 1 = círculo de número
    const base = BALL_RAMP[num <= 8 ? num : num - 8];
    const stripe = num >= 9;
    const r = BR + 0.5;
    for (let py = 0; py < CELL; py++) for (let px = 0; px < CELL; px++) {
      const dx = px - 6, dy = py - 6;
      const d2 = dx * dx + dy * dy;
      if (d2 > BR * BR + BR * 0.8) continue;
      const nx = dx / r, ny = dy / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const [lx, ly, lz] = toLocal(nx, ny, nz, ax, ay);
      let ramp = base, isW = false, isN = false;
      if (num === 0) {
        ramp = WHITE; isW = true;
        if (Math.abs(lz) > 0.93 || Math.abs(lx) > 0.95) { ramp = ['9', 'a', 'b', 'c']; isW = false; } // puntos rojos
      } else {
        if (Math.abs(lz) > 0.78) { ramp = num === 8 ? ['9', 'a', 'b', 'c'] : WHITE; isN = true; }
        else if (stripe && Math.abs(ly) > 0.5) { ramp = WHITE; isW = true; }
      }
      // grabados que cambian materiales
      if (kind === 'oro' && (isW || isN)) ramp = isN ? ['g', 'h', 'i', '8'] : GOLD;
      if (kind === 'plomo') ramp = isW || isN ? LEAD : [ramp[0], ramp[0], ramp[1], ramp[2]];
      if (kind === 'fuego' && isW) ramp = EMBER;
      if (kind === 'bomba' && isW) ramp = IRON;
      if (kind === 'holo' && isW) {
        const hi = Math.floor((lx * 2 + ly * 3 + lz + holoF * 0.75) * 1.5) % HOLO.length;
        const hc = HOLO[(hi + HOLO.length) % HOLO.length];
        ramp = [hc, hc, hc, '8'];
      }
      if (kind === 'cristal') ramp = isW ? CRYS : isN ? ['q', 'r', '8', '8'] : [ramp[1], ramp[2], ramp[3], '8'];
      // sombreado
      const dif = Math.max(0, nx * LV[0] + ny * LV[1] + nz * LV[2]);
      const spec = Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]);
      let v = 0.04 + dif * 1.0;
      if (kind === 'plomo') v = 0.15 + dif * 0.6;
      let col = pick(ramp, v, px, py, 3);
      if (kind === 'holo' && isW) col = dif < 0.3 ? '3' : ramp[0];
      const rr2 = (BR - 0.7) * (BR - 0.7) + (BR - 0.7) * 0.8;
      const edge = d2 > rr2;
      if (edge) {
        col = dx + dy >= 0 ? '0' : (num === 8 ? '0' : '1');
        if (kind === 'oro') col = dx + dy >= 0 ? 'e' : (dx + dy < -5 ? 'i' : 'g');
      } else if (d2 > (BR - 1.7) * (BR - 1.7) + 1 && dx + dy > 2) col = ramp[0]; // sombra propia
      if (!edge && kind !== 'plomo' && spec > 0.985) col = '8';
      else if (!edge && kind !== 'plomo' && spec > 0.955) col = ramp[3];
      let a = 255;
      if (kind === 'cristal' && !edge && spec < 0.95) a = isN ? 235 : 170;
      pb.set(px, py, col, a);
      if (isN) flag[py * CELL + px] = 1;
    }
    // número sobre el polo visible
    if (num > 0) {
      for (const sgn of [1, -1]) {
        const [wx, wy, wz] = toWorld(0, 0, sgn, ax, ay);
        if (wz < 0.5) continue;
        const g = numGlyph(num);
        const gw = g[0].length;
        const cx = Math.round(6 + wx * r * 0.98), cy = Math.round(6 + wy * r * 0.98);
        const x0 = cx - Math.floor(gw / 2), y0 = cy - 2;
        const dcol = num === 8 ? '0' : kind === 'cristal' ? 'p' : kind === 'oro' ? 'e' : '1';
        for (let j = 0; j < 5; j++) for (let i = 0; i < gw; i++) {
          if (g[j][i] !== '1') continue;
          const X = x0 + i, Y = y0 + j;
          if (X < 0 || Y < 0 || X >= CELL || Y >= CELL) continue;
          if (!flag[Y * CELL + X]) continue;
          pb.set(X, Y, dcol, 255);
        }
      }
    }
    // cristal: reflejo secundario
    if (kind === 'cristal') { pb.set(8, 9, 'r', 255); pb.set(9, 8, 'r', 255); pb.set(3, 3, '8', 255); }
    ctx.putImageData(pb.toImageData(ctx), ox, oy);
  }

  function ballCell(num, kind, holoF, ix, iy) {
    const key = num + '|' + kind + (kind === 'holo' ? holoF : '');
    let A = atlases[key];
    if (!A) {
      const { c, ctx } = OM.PX.canvas(STEPS * CELL, STEPS * CELL);
      A = atlases[key] = { c, ctx, done: new Uint8Array(STEPS * STEPS) };
    }
    const i = iy * STEPS + ix;
    if (!A.done[i]) { genBall(A.ctx, num, kind, holoF, ix, iy, ix * CELL, iy * CELL); A.done[i] = 1; }
    return A.c;
  }
  const rollIdx = (v) => { const k = Math.round((v || 0) / BR / (Math.PI * 2) * STEPS) % STEPS; return k < 0 ? k + STEPS : k; };

  // sprites auxiliares de bola
  let shadowC = null, auraC = null;
  function initBallSprites() {
    let pb = new PB(15, 9);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 15; x++) {
      const dx = (x - 7) / 7.2, dy = (y - 4) / 4.2, d = dx * dx + dy * dy;
      if (d <= 1) pb.set(x, y, '0', d < 0.45 ? 140 : 80);
    }
    shadowC = pb.toCanvas();
    pb = new PB(25, 25);
    for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
      const d = Math.hypot(x - 12, y - 12);
      if (d < 6.5 || d > 11.5) continue;
      const a = 1 - (d - 6.5) / 5;
      if (a * a > bayer(x, y) * 0.8) pb.set(x, y, d < 8.5 ? 'b' : 'a', Math.round(90 + a * 120));
    }
    auraC = pb.toCanvas();
  }

  function drawBallShadow(ctx, x, y) {
    if (!shadowC) initBallSprites();
    ctx.drawImage(shadowC, Math.round(x) - 7 + 2, Math.round(y) - 4 + 4);
  }

  function drawBall(ctx, ball, x, y, t) {
    if (!shadowC) initBallSprites();
    t = t || 0;
    const num = ball.num | 0, kind = ball.kind && ball.kind !== 'normal' ? ball.kind : 'normal';
    const X = Math.round(x), Y = Math.round(y);
    const sc = ball.scale === undefined ? 1 : ball.scale;
    const al = ball.alpha === undefined ? 1 : ball.alpha;
    if (sc <= 0 || al <= 0) return;
    ctx.save();
    if (al < 1) ctx.globalAlpha *= al;
    const ga = ctx.globalAlpha;
    // aura de la 8 maldita
    if (num === 8) {
      ctx.globalAlpha = ga * (0.35 + 0.2 * Math.sin(t * 2.6) + 0.08 * Math.sin(t * 11));
      ctx.drawImage(auraC, X - 12, Y - 12);
      ctx.globalAlpha = ga;
    }
    if (kind === 'holo') {
      ctx.globalAlpha = ga * 0.35;
      ctx.fillStyle = OM.PAL[HOLO[Math.floor(t * 6) % HOLO.length]];
      fillCircle(ctx, X, Y, 8);
      ctx.globalAlpha = ga;
    }
    const hf = Math.floor(t * 8) % 8;
    const atlas = ballCell(num, kind, hf, rollIdx(ball.rollX), rollIdx(ball.rollY));
    const sx = rollIdx(ball.rollX) * CELL, sy = rollIdx(ball.rollY) * CELL;
    if (sc !== 1) {
      const s = Math.max(1, Math.round(CELL * sc));
      ctx.drawImage(atlas, sx, sy, CELL, CELL, X - (s >> 1), Y - (s >> 1), s, s);
      ctx.restore();
      return;
    }
    ctx.drawImage(atlas, sx, sy, CELL, CELL, X - 6, Y - 6, CELL, CELL);
    // overlays animados
    if (kind === 'fuego') {
      const F = ['b', 'v', 'h', 'd'];
      for (let i = 0; i < 7; i++) {
        const ph = (t * 2.2 + i / 7) % 1;
        const ang = -Math.PI / 2 + (i - 3) * 0.42 + Math.sin(t * 5 + i) * 0.1;
        const rr = 6 + ph * 4;
        const fx = Math.round(X + Math.cos(ang) * rr), fy = Math.round(Y + Math.sin(ang) * rr - ph * 2);
        ctx.globalAlpha = ga * (1 - ph);
        ctx.fillStyle = OM.PAL[F[Math.min(3, Math.floor(ph * 4))]];
        ctx.fillRect(fx, fy, 1, ph < 0.4 ? 2 : 1);
      }
      ctx.globalAlpha = ga;
    } else if (kind === 'bomba') {
      // mecha
      const P = OM.PAL;
      ctx.fillStyle = P['0']; ctx.fillRect(X - 1, Y - 8, 3, 2);
      ctx.fillStyle = P['3']; ctx.fillRect(X, Y - 8, 1, 1);
      ctx.fillStyle = P.g; ctx.fillRect(X + 1, Y - 10, 1, 2); ctx.fillRect(X + 2, Y - 11, 1, 1);
      ctx.fillStyle = P.e; ctx.fillRect(X + 1, Y - 9, 1, 1);
      const k = Math.floor(t * 14) % 3;
      ctx.fillStyle = P[['h', '8', 'v'][k]]; ctx.fillRect(X + 3, Y - 12, 1, 1);
      ctx.fillStyle = P[['v', 'h', 'd'][k]];
      if (k === 0) { ctx.fillRect(X + 4, Y - 13, 1, 1); ctx.fillRect(X + 2, Y - 13, 1, 1); }
      if (k === 1) { ctx.fillRect(X + 4, Y - 12, 1, 1); ctx.fillRect(X + 3, Y - 14, 1, 1); }
      if (k === 2) { ctx.fillRect(X + 4, Y - 11, 1, 1); ctx.fillRect(X + 2, Y - 12, 1, 1); }
    } else if (kind === 'oro' || kind === 'cristal' || kind === 'holo') {
      // destello en cruz periódico
      const ph = (t * 0.7 + num * 0.13) % 1;
      if (ph < 0.18) {
        const k = Math.sin(ph / 0.18 * Math.PI);
        ctx.fillStyle = OM.PAL[kind === 'oro' ? 'i' : kind === 'cristal' ? 'r' : '8'];
        ctx.globalAlpha = ga;
        const gx = X - 3, gy = Y - 4;
        ctx.fillRect(gx, gy, 1, 1);
        if (k > 0.4) { ctx.fillRect(gx - 1, gy, 3, 1); ctx.fillRect(gx, gy - 1, 1, 3); }
        if (k > 0.8) { ctx.fillRect(gx - 2, gy, 1, 1); ctx.fillRect(gx + 2, gy, 1, 1); ctx.fillRect(gx, gy - 2, 1, 1); ctx.fillRect(gx, gy + 2, 1, 1); }
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // TACOS (pre-renderizados, rotados al dibujar)
  // ------------------------------------------------------------------
  const CUE_L = 180, CUE_H = 17, CUE_CY = 8;
  const cueCache = {};
  function cueSpec(id) {
    // secciones: [x0, x1, rampa(3: oscuro, medio, claro), patrón opcional]; x=0 culata, x=L-1 punta
    const S = {
      peregrino: [
        [0, 3, ['0', '1', '2']], [4, 5, ['f', 'g', 'h']], [6, 34, ['9', 'e', 'f'], 'grain'],
        [35, 36, ['6', '7', '8']], [37, 62, ['1', '2', '3'], 'wrap'], [63, 64, ['6', '7', '8']],
        [65, 102, ['f', 'g', 'i'], 'points'], [103, 106, ['g', 'h', 'i']], [107, 171, ['g', 'i', '8'], 'grain'],
        [172, 176, ['6', '7', '8']], [177, 179, ['p', 'q', 'r']],
      ],
      sangriento: [
        [0, 3, ['0', '1', '9']], [4, 40, ['0', '9', 'a'], 'spikes'], [41, 42, ['5', '6', '7']],
        [43, 66, ['0', '1', '2'], 'wrap'], [67, 68, ['5', '6', '7']], [69, 104, ['9', 'a', 'b'], 'drips'],
        [105, 108, ['3', '5', '6']], [109, 171, ['e', 'f', 'g'], 'bloodfade'], [172, 176, ['6', '7', '8']], [177, 179, ['a', 'b', 'c']],
      ],
      usura: [
        [0, 4, ['g', 'h', 'i']], [5, 44, ['0', '1', '2'], 'coins'], [45, 46, ['h', 'i', '8']],
        [47, 70, ['e', 'g', 'h'], 'stripes'], [71, 72, ['h', 'i', '8']], [73, 104, ['1', '2', '3'], 'coins'],
        [105, 109, ['g', 'h', 'i']], [110, 171, ['f', 'g', 'h'], 'grain'], [172, 176, ['h', 'i', '8']], [177, 179, ['p', 'q', 'r']],
      ],
      hueso: [
        [0, 11, ['5', '6', '7'], 'skull'], [12, 104, ['5', '6', '7'], 'spine'], [105, 108, ['4', '5', '6']],
        [109, 171, ['6', '7', '8'], 'bone'], [172, 176, ['7', '8', '8']], [177, 179, ['p', 'q', 'r']],
      ],
    };
    return S[id] || S.peregrino;
  }
  function buildCue(id) {
    const pb = new PB(CUE_L + 2, CUE_H);
    const spec = cueSpec(id);
    for (let x = 0; x < CUE_L; x++) {
      const sec = spec.find((s) => x >= s[0] && x <= s[1]) || spec[spec.length - 1];
      const [x0, x1, ramp, pat] = sec;
      let th = 4.2 - 2.8 * (x / (CUE_L - 1));
      if (pat === 'spine' && (x - x0) % 9 === 8) th -= 1;
      if (pat === 'skull' && x < 9) th = 5.2;
      const hT = Math.round(th);
      for (let dy = -hT; dy <= hT; dy++) {
        const yr = dy / Math.max(1, hT);
        let lv = yr < -0.5 ? 2 : yr > 0.45 ? 0 : 1;
        if (hT <= 1) lv = dy < 0 ? 2 : dy > 0 ? 0 : 1;
        let c = ramp[lv];
        const u = x - x0;
        if (pat === 'grain' && hash(x >> 3, dy, 4) < 0.25 && lv === 1) c = ramp[0];
        if (pat === 'wrap' && ((u + dy) % 3 === 0) && lv !== 2) c = ramp[0];
        if (pat === 'wrap' && ((u - dy) % 3 === 0) && lv === 1) c = ramp[2];
        if (pat === 'points') { // 2 puntas oscuras incrustadas hacia la punta
          const lim = (1 - u / (x1 - x0)) * (hT + 0.5);
          if (Math.abs(dy) <= lim) c = lv === 2 ? '2' : lv === 1 ? '1' : '0';
        }
        if (pat === 'stripes' && (u % 4 < 2)) c = lv === 2 ? 'i' : 'h';
        if (pat === 'coins') {
          const cx = x0 + 6 + Math.floor((u) / 12) * 12;
          const d = Math.hypot(x - cx, dy * 1.2);
          if (d < 2.6) c = d < 1.2 ? (lv === 2 ? 'i' : 'h') : lv === 0 ? 'g' : 'h';
        }
        if (pat === 'drips' && hash(x, 0, 8) < 0.3 && dy > 0) c = '9';
        if (pat === 'bloodfade') { const k = 1 - u / (x1 - x0); if (hash(x, dy, 6) < k * k * 0.9) c = lv === 2 ? 'b' : 'a'; }
        if (pat === 'spine' && (u % 9) === 0) c = '4';
        if (pat === 'spine' && (u % 9) === 4 && dy === 0) c = '4';
        if (pat === 'bone' && hash(x >> 2, dy, 2) < 0.12) c = '6';
        pb.set(x, CUE_CY + dy, c);
      }
      if (pat === 'spikes' && (x - x0) % 9 === 4) {
        for (const s of [-1, 1]) { pb.set(x - 1, CUE_CY + s * (hT + 1), '5'); pb.set(x, CUE_CY + s * (hT + 1), '6'); pb.set(x + 1, CUE_CY + s * (hT + 1), '5'); pb.set(x, CUE_CY + s * (hT + 2), '7'); pb.set(x, CUE_CY + s * (hT + 3), '8'); }
      }
      if (pat === 'spine' && (x - x0) % 9 === 4) { pb.set(x, CUE_CY - hT - 1, '6'); pb.set(x + 1, CUE_CY - hT - 1, '5'); pb.set(x, CUE_CY + hT + 1, '5'); }
      if (pat === 'skull' && x >= 1 && x <= 8) {
        // cuencas y dientes de la calavera de la culata
        if (x === 3 || x === 4) { pb.set(x, CUE_CY - 2, '1'); pb.set(x, CUE_CY + 1, '1'); }
        if (x === 6) pb.set(x, CUE_CY - 0, '2');
        if (x === 8) for (let d = -2; d <= 2; d += 2) pb.set(x, CUE_CY + d, '3');
      }
    }
    // tiza en la punta
    pb.set(CUE_L - 1, CUE_CY, id === 'sangriento' ? 'c' : 'r');
    pb.outline('0');
    const c = pb.toCanvas();
    // silueta para sombra
    const sh = new PB(pb.w, pb.h);
    for (let i = 0; i < pb.k.length; i++) if (pb.k[i]) sh.k[i] = '0';
    return { c, s: sh.toCanvas() };
  }
  function drawCue(ctx, cueId, tipX, tipY, angle, pull, t) {
    let C = cueCache[cueId];
    if (!C) C = cueCache[cueId] = buildCue(cueId);
    pull = pull || 0;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const gap = 2 + pull;
    const bx = tipX - ca * gap, by = tipY - sa * gap;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // sombra
    ctx.globalAlpha *= 0.35;
    ctx.translate(Math.round(bx + 3), Math.round(by + 5));
    ctx.rotate(angle);
    ctx.drawImage(C.s, -(CUE_L + 1), -CUE_CY);
    ctx.restore();
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(bx), Math.round(by));
    ctx.rotate(angle);
    ctx.drawImage(C.c, -(CUE_L + 1), -CUE_CY);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // GUÍA DE TIRO
  // ------------------------------------------------------------------
  function dotsAlong(ctx, pts, spacing, phase, col, a0, a1) {
    if (!pts || pts.length < 2) return;
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (total <= 0) return;
    let acc = 0, next = phase % spacing;
    for (let i = 1; i < pts.length; i++) {
      const A = pts[i - 1], B = pts[i];
      const seg = Math.hypot(B.x - A.x, B.y - A.y);
      while (next <= acc + seg) {
        const k = (next - acc) / seg;
        const x = Math.round(A.x + (B.x - A.x) * k), y = Math.round(A.y + (B.y - A.y) * k);
        const f = next / total;
        const a = a0 + (a1 - a0) * f;
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = OM.PAL['0'];
        ctx.fillRect(x + 1, y + 1, 1, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = OM.PAL[col];
        ctx.fillRect(x, y, 1, 1);
        if (f < 0.35) ctx.fillRect(x + 1, y, 1, 1);
        next += spacing;
      }
      acc += seg;
    }
  }
  function drawAim(ctx, pts, ghost, t, opts) {
    t = t || 0;
    opts = opts || {};
    ctx.save();
    dotsAlong(ctx, pts, 5, t * 22, '8', 0.95, 0.35);
    if (opts.objPath) dotsAlong(ctx, opts.objPath, 4, t * 18, 'h', 0.9, 0.2);
    if (opts.cuePath) dotsAlong(ctx, opts.cuePath, 4, t * 18, '6', 0.7, 0.15);
    if (ghost) {
      const gx = Math.round(ghost.x), gy = Math.round(ghost.y);
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = OM.PAL['7'];
      fillCircle(ctx, gx, gy, BR - 1);
      const n = 28, rot = t * 1.5;
      for (let i = 0; i < n; i++) {
        if (i % 4 === 3) continue;
        const a = rot + (i / n) * Math.PI * 2;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = OM.PAL[i % 4 === 0 ? '8' : '7'];
        ctx.fillRect(Math.round(gx + Math.cos(a) * BR), Math.round(gy + Math.sin(a) * BR), 1, 1);
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // RESPLANDOR DE TRONERA, NIEBLA, RACK
  // ------------------------------------------------------------------
  function drawPocketGlow(ctx, pocket, t, color) {
    const col = color || 'h';
    t = t || 0;
    const X = Math.round(pocket.x), Y = Math.round(pocket.y);
    const pr = pocket.r || L.pocketR;
    ctx.save();
    ctx.fillStyle = OM.PAL[col];
    const pulse = 0.5 + 0.5 * Math.sin(t * 8);
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.08 + pulse * 0.05;
      fillCircle(ctx, X, Y, pr + 2 + i * 3);
    }
    // remolino de chispas
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 8; i++) {
      const a = t * 4 + i * Math.PI / 4, rr = pr + 1 + ((t * 10 + i * 3) % 6);
      ctx.fillStyle = OM.PAL[i % 2 ? col : '8'];
      ctx.fillRect(Math.round(X + Math.cos(a) * rr), Math.round(Y + Math.sin(a) * rr), 1, 1);
    }
    ctx.restore();
  }

  let fogC = null;
  function drawFog(ctx, cx, cy, radius, t) {
    t = t || 0;
    if (!fogC) fogC = OM.PX.canvas(OM.W, OM.H);
    const f = fogC.ctx;
    f.globalCompositeOperation = 'source-over';
    f.globalAlpha = 1;
    f.clearRect(0, 0, OM.W, OM.H);
    f.fillStyle = OM.PAL['0'];
    f.fillRect(0, 0, OM.W, OM.H);
    // jirones de niebla: vetas horizontales tramadas que derivan
    for (let i = 0; i < 42; i++) {
      const len = 40 + hash(i, 3, 30) * 140, sp = 4 + (i % 5) * 2;
      const x = ((hash(i, 1, 30) * (OM.W + len) + t * sp) % (OM.W + len)) - len;
      const y = Math.round(hash(i, 2, 30) * OM.H + Math.sin(t * 0.5 + i) * 3);
      f.fillStyle = OM.PAL[i % 3 ? '2' : '3'];
      f.globalAlpha = 0.35;
      f.fillRect(Math.round(x), y, Math.round(len), 1);
      f.globalAlpha = 0.18;
      f.fillRect(Math.round(x + len * 0.15), y - 1, Math.round(len * 0.6), 1);
      f.fillRect(Math.round(x + len * 0.25), y + 1, Math.round(len * 0.5), 1);
    }
    f.globalCompositeOperation = 'destination-out';
    const wob = Math.sin(t * 2) * 2;
    const steps = [[radius + 16, 0.25], [radius + 10, 0.3], [radius + 5, 0.4], [radius + wob, 1]];
    for (const [r, a] of steps) { f.globalAlpha = a; fillCircle(f, cx, cy, Math.max(1, Math.round(r))); }
    f.globalCompositeOperation = 'source-over';
    f.globalAlpha = 1;
    ctx.save();
    ctx.globalAlpha *= 0.94;
    ctx.drawImage(fogC.c, 0, 0);
    ctx.restore();
  }

  // Devuelve [{x,y,r,i}] (centros) para hacer clic en las bolas.
  function drawRackPreview(ctx, balls, x, y, t) {
    const out = [];
    const n = balls.length;
    const sp = 14;
    let i = 0;
    if (n === 15) {
      for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) {
        const bx = x + 35 - row * sp / 2 + k * sp, by = y + 7 + row * 12;
        out.push({ x: bx, y: by, r: 7, i });
        i++;
      }
    } else {
      for (; i < n; i++) out.push({ x: x + 7 + i * sp, y: y + 7, r: 7, i });
    }
    for (const o of out) {
      const b = balls[o.i];
      if (!b) continue;
      drawBallShadow(ctx, o.x, o.y);
      drawBall(ctx, { num: b.num, kind: b.kind, rollX: 0, rollY: 0 }, o.x, o.y, t || 0);
    }
    return out;
  }

  // ------------------------------------------------------------------
  OM.TABLE = {
    themes: THEMES,
    pockets, drawTable, drawBackdrop, drawBall, drawBallShadow, drawCue, drawAim,
    drawPocketGlow, drawFog, drawRackPreview,
    // extras (no contractuales)
    theme: themeOf,
    warm(theme) { const th = themeOf(theme); tableCanvas(th, false, 1); if (!backCache[th.id]) backCache[th.id] = buildBackdrop(th); },
  };

  OM.ART_INIT.push(function () {
    initBallSprites();
    for (const c of OM.CUES || [{ id: 'peregrino' }]) cueCache[c.id] = buildCue(c.id);
  });
})();
