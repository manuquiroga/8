// OCHO MALDITO — Arte de cartas: comodines, consumibles, jefes, tacos, reversos y sobres.
// Contrato: docs/ART_CONTRACT.md (Agente CARTAS). Solo paleta OM.PAL.
// Registra sprites en OM.ART_INIT: joker_<id> 32x32, item_<id> 24x24, boss_<id> 32x32, cue_<id> 24x24.
// Expone OM.CARDS.{drawJoker, drawItem, drawBack, drawPack, drawBossMedal}. Todo se cachea en canvases offscreen.
window.OM = window.OM || {};
OM.ART_INIT = OM.ART_INIT || [];

(function () {
  'use strict';
  const PX = OM.PX;

  // ======================================================================
  // Rampas de material (oscuro -> claro). Luz desde arriba-izquierda.
  // ======================================================================
  const R = {
    bone: ['5', '6', '7', '8'], boneD: ['4', '5', '6', '7'],
    gold: ['e', 'g', 'h', 'i'], brass: ['e', 'f', 'g', 'h'],
    blood: ['9', 'a', 'b', 'c'], red: ['a', 'b', 'c', 'd'],
    blue: ['o', 'p', 'q', 'r'], ice: ['p', 'q', 'r', '8'],
    green: ['j', 'k', 'l', 'm'], toxic: ['k', 'l', 'm', 'n'],
    night: ['0', '1', '2', '3'], purple: ['1', '2', '3', '4'], violet: ['2', '3', '4', '5'], lilac: ['3', '4', '5', '6'],
    wood: ['e', 'f', 'g', 'h'], woodD: ['9', 'e', 'f', 'g'],
    mag: ['s', 't', 'u', '8'], fire: ['b', 'v', 'h', 'i'], ember: ['a', 'b', 'v', 'd'],
    iron: ['2', '3', '5', '6'], steel: ['3', '5', '6', '7'], lead: ['1', '3', '4', '6'],
    flesh: ['5', '6', '7', '8'], ash: ['3', '5', '6', '7'],
  };

  // ======================================================================
  // Formas (tests sobre centro de píxel, coordenadas continuas)
  // ======================================================================
  const E = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const C = (cx, cy, r) => E(cx, cy, r, r);
  const Rc = (x0, y0, w, h) => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
  const P = (pts) => (x, y) => {
    let ins = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  const Cap = (x0, y0, x1, y1, r, r1) => (x, y) => {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
    let t = ((x - x0) * dx + (y - y0) * dy) / l2; t = Math.max(0, Math.min(1, t));
    const px = x0 + dx * t, py = y0 + dy * t, rr = r1 === undefined ? r : r + (r1 - r) * t;
    return (x - px) ** 2 + (y - py) ** 2 <= rr * rr;
  };
  const U = (...f) => (x, y) => f.some((t) => t(x, y));
  const I = (...f) => (x, y) => f.every((t) => t(x, y));
  const D = (a, ...b) => (x, y) => a(x, y) && !b.some((t) => t(x, y));
  // anillo / arco: ángulo en radianes (0 = derecha, sentido horario en pantalla)
  const Arc = (cx, cy, r0, r1, a0, a1) => (x, y) => {
    const d = Math.hypot(x - cx, y - cy); if (d < r0 || d > r1) return false;
    let a = Math.atan2(y - cy, x - cx); while (a < a0) a += Math.PI * 2;
    return a <= a1;
  };

  // mini fuente 3x5 para números en bolas/ilustraciones
  const F3 = {
    '0': ['111', '101', '101', '101', '111'], '1': ['01', '11', '01', '01', '01'], '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'], 'x': ['000', '101', '010', '101', '000'], '+': ['000', '010', '111', '010', '000'],
    '$': ['010', '111', '110', '011', '111', '010'], 'I': ['111', '010', '010', '010', '111'],
    'S$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'], 'B8': ['0110', '1001', '1001', '0110', '1001', '1001', '0110'], '?': ['111', '001', '011', '000', '010'],
  };

  // ======================================================================
  // Pincel extendido
  // ======================================================================
  function H(g) {
    const W = g.w, HH = g.h;
    let cache = null;
    const dirty = () => { cache = null; };
    const h = {
      g, W, H: HH,
      p(x, y, c) { if (c && x >= 0 && y >= 0 && x < W && y < HH) { g.p(x, y, c); dirty(); } },
      empty(x, y) {
        if (x < 0 || y < 0 || x >= W || y >= HH) return false;
        if (!cache) cache = g.ctx.getImageData(0, 0, W, HH).data;
        return cache[(y * W + x) * 4 + 3] === 0;
      },
      under(x, y, c) { if (h.empty(x, y)) h.p(x, y, c); },
      // relleno sombreado genérico (bisel redondeado por distancia a bordes)
      shade(test, ramp, o = {}) {
        const n = ramp.length;
        const ins = (x, y) => test(x + 0.5, y + 0.5);
        const pts = [];
        for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) if (ins(x, y)) pts.push([x, y]);
        if (o.ol !== false) {
          const oc = o.ol || '0';
          const ring = [];
          for (let y = -1; y <= HH; y++) for (let x = -1; x <= W; x++) {
            if (ins(x, y)) continue;
            if (ins(x - 1, y) || ins(x + 1, y) || ins(x, y - 1) || ins(x, y + 1) ||
              (o.diag && (ins(x - 1, y - 1) || ins(x + 1, y - 1) || ins(x - 1, y + 1) || ins(x + 1, y + 1)))) ring.push([x, y]);
          }
          ring.forEach(([x, y]) => h.p(x, y, oc));
        }
        const lx = o.lx === undefined ? -1 : o.lx, ly = o.ly === undefined ? -1 : o.ly;
        const M = o.reach || 14;
        pts.forEach(([x, y]) => {
          let i;
          if (o.flat !== undefined) i = o.flat;
          else {
            let a = 0; while (a < M && ins(x + lx * (a + 1), y + ly * (a + 1))) a++;
            let b = 0; while (b < M && ins(x - lx * (b + 1), y - ly * (b + 1))) b++;
            let a2 = 0; while (a2 < M && ins(x, y - a2 - 1)) a2++;
            let b2 = 0; while (b2 < M && ins(x, y + b2 + 1)) b2++;
            const s = ((b - a) / (a + b + 1)) * 0.6 + ((b2 - a2) / (a2 + b2 + 1)) * 0.4;
            let v = (s * 0.5 + 0.5) * n + (o.bias || 0);
            i = Math.floor(v); const fr = v - i;
            if (o.dither !== false && fr > 0.7 && (x + y) % 2 === 0) i++;
            if (o.rim && (!ins(x - 1, y) || !ins(x, y - 1)) && !(!ins(x + 1, y) || !ins(x, y + 1))) i = n - 1;
            if (o.dark && (!ins(x + 1, y) || !ins(x, y + 1)) && ins(x - 1, y) && ins(x, y - 1)) i = Math.min(i, 0);
          }
          h.p(x, y, ramp[Math.max(0, Math.min(n - 1, i))]);
        });
      },
      fill(test, c) { for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) if (test(x + 0.5, y + 0.5)) h.p(x, y, c); },
      // solo contorno exterior de una forma
      ol(test, c = '0') {
        const ins = (x, y) => test(x + 0.5, y + 0.5);
        for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++)
          if (!ins(x, y) && (ins(x - 1, y) || ins(x + 1, y) || ins(x, y - 1) || ins(x, y + 1))) h.p(x, y, c);
      },
      // esfera con luz real (arriba-izq) + especular
      sphere(cx, cy, r, ramp, o = {}) {
        const n = ramp.length;
        const t = C(cx, cy, r);
        if (o.ol !== false) h.ol(t, o.ol || '0');
        for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r, d2 = nx * nx + ny * ny;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          const l = -0.5 * nx - 0.6 * ny + 0.62 * nz;
          const rp = o.rampAt ? o.rampAt(nx, ny) : ramp;
          let v = Math.max(0, Math.min(1, (l + 0.3) / 1.2)) * n; let i = Math.floor(v);
          if (v - i > 0.6 && (x + y) % 2 === 0) i++;
          let c = rp[Math.max(0, Math.min(n - 1, i))];
          if (o.spec !== false && l > 0.9) c = o.spec || '8';
          if (o.rimC && d2 > 0.72 && nx + ny > 0.6) c = o.rimC; // luz de rebote púrpura
          h.p(x, y, c);
        }
      },
      // bola de billar
      ball(cx, cy, r, o = {}) {
        const col = o.col || R.red;
        const stripe = !!o.stripe;
        h.sphere(cx, cy, r, col, {
          ol: o.ol, rimC: o.rimC,
          rampAt: stripe ? (nx, ny) => (Math.abs(ny - nx * (o.tilt || 0)) < 0.46 ? col : R.bone) : null,
        });
        if (o.num !== undefined && r >= 5) {
          const dx = cx - r * 0.12, dy = cy - r * 0.16, dr = Math.max(2.4, r * 0.46);
          h.fill(C(dx, dy, dr), '7');
          h.fill(D(C(dx, dy, dr), C(dx - 0.8, dy - 0.8, dr)), '6');
          const s = String(o.num); const glyphs = s.split('').map((ch) => F3[ch]);
          const tw = glyphs.reduce((a, gl) => a + gl[0].length, 0) + (glyphs.length - 1);
          let x0 = Math.round(dx - tw / 2), y0 = Math.round(dy - 2.5);
          glyphs.forEach((gl) => { h.glyph(x0, y0, gl, o.numC || '0'); x0 += gl[0].length + 1; });
        }
      },
      glyph(x, y, gl, c) { gl.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') h.p(x + i, y + j, c); }); },
      txt(x, y, s, c, sh) {
        let xx = x;
        s.split('').forEach((ch) => { const gl = F3[ch]; if (!gl) { xx += 2; return; } if (sh) h.glyph(xx + 1, y + 1, gl, sh); h.glyph(xx, y, gl, c); xx += gl[0].length + 1; });
      },
      // texto con contorno completo (legible sobre cualquier fondo)
      txtO(x, y, s, c, oc = '0') {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) h.txt(x + dx, y + dy, s, oc);
        h.txt(x, y, s, c);
      },
      // glifo con contorno (filas de '1')
      glyphO(x, y, gl, c, oc = '0') {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) h.glyph(x + dx, y + dy, gl, oc);
        h.glyph(x, y, gl, c);
      },
      // palo diagonal en píxel limpio (abajo-izq -> arriba-der). k = x+y de la línea central.
      // segs: [{t0, t1, w, ramp:[claro..oscuro]}] con t = x - y
      diag(k, segs, oc = '0') {
        const seg = (t) => segs.find((s) => t >= s.t0 && t <= s.t1);
        const ins = (x, y) => { const s = seg(x - y); if (!s) return false; const o = x + y - k; const lo = -Math.floor((s.w - 1) / 2); return o >= lo && o < lo + s.w; };
        h.ol((x, y) => ins(Math.floor(x), Math.floor(y)), oc);
        for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) {
          if (!ins(x, y)) continue;
          const s = seg(x - y), o = x + y - k, lo = -Math.floor((s.w - 1) / 2);
          const u = (o - lo) / Math.max(1, s.w - 1);
          const rp = s.ramp; const i = Math.min(rp.length - 1, Math.round(u * (rp.length - 1)));
          h.p(x, y, s.fn ? s.fn(x, y, i) || rp[i] : rp[i]);
        }
      },
      line(x0, y0, x1, y1, c) { g.line(x0, y0, x1, y1, c); dirty(); },
      dash(x0, y0, x1, y1, c, on = 1, off = 1) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 0; i <= n; i++) if (i % (on + off) < on) h.p(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
      },
      rows(x, y, rows, map) { g.rows(x, y, rows, map); dirty(); },
      // destello en cruz
      star(x, y, c = 'i', c2 = '8', s = 1) {
        h.p(x, y, c2);
        for (let k = 1; k <= s; k++) { h.p(x - k, y, c); h.p(x + k, y, c); h.p(x, y - k, c); h.p(x, y + k, c); }
      },
      // halo tramado detrás (solo píxeles vacíos)
      halo(cx, cy, r, c, c2) {
        for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d > r) continue;
          if (d < r * 0.55 && c2) { if ((x + y) % 2 === 0) h.under(x, y, c2); }
          else if (x % 2 === 0 && y % 2 === 0 && (x / 2 + y / 2) % 2 === 0) h.under(x, y, c);
          else if (d < r * 0.75 && (x + y) % 2 === 0 && y % 2 === 0) h.under(x, y, c);
        }
      },
      // moneda de oro de lado/frontal
      coin(cx, cy, r = 3) {
        h.sphere(cx, cy, r, R.gold, { spec: 'i' });
        h.fill(D(C(cx, cy, r - 1.2), C(cx, cy, r - 2.2)), 'g');
        if (r >= 3) h.p(Math.floor(cx), Math.floor(cy), 'e');
      },
      // ficha de póker azul (FICHAS)
      chip(cx, cy, rx = 4, col = R.blue) {
        const ry = rx * 0.55;
        h.shade(U(E(cx, cy + 1, rx, ry), Rc(cx - rx, cy, rx * 2, 1)), [col[0], col[1], col[1], col[2]], { bias: 0 });
        h.fill(E(cx, cy, rx - 0.2, ry - 0.2), col[2]);
        h.fill(E(cx, cy, rx * 0.5, ry * 0.5), col[3]);
        h.p(Math.floor(cx - rx + 1), Math.floor(cy), '8'); h.p(Math.floor(cx + rx - 2), Math.floor(cy), '8');
        h.p(Math.floor(cx), Math.floor(cy - ry + 0.5), '8');
      },
      // gota
      drop(cx, cy, r, ramp) {
        h.shade(U(C(cx, cy, r), P([[cx - r * 0.85, cy - r * 0.3], [cx, cy - r * 2.6], [cx + r * 0.85, cy - r * 0.3]])), ramp);
        h.p(Math.floor(cx - r * 0.4), Math.floor(cy - r * 0.2), '8');
      },
      // calavera parametrizable
      skull(cx, cy, s, ramp, o = {}) {
        const cran = E(cx, cy - 1 * s, 7 * s, 6.4 * s);
        const cheek = E(cx, cy + 2.2 * s, 6 * s, 3.4 * s);
        const jaw = Rc(cx - 4 * s, cy + 3 * s, 8 * s, 4.2 * s);
        h.shade(U(cran, cheek, jaw), ramp, { bias: 0.2, ol: o.ol });
        // cuencas
        const eyeC = o.eye || '0';
        const ey = cy + 1.1 * s;
        h.fill(E(cx - 3 * s, ey, 2.1 * s, 2.0 * s), eyeC);
        h.fill(E(cx + 3 * s, ey, 2.1 * s, 2.0 * s), eyeC);
        if (o.glow) {
          h.p(Math.floor(cx - 3 * s), Math.floor(ey), o.glow); h.p(Math.floor(cx + 3 * s), Math.floor(ey), o.glow);
          if (s >= 1.2) { h.p(Math.floor(cx - 3 * s) - 1, Math.floor(ey), o.glow2 || o.glow); h.p(Math.floor(cx + 3 * s), Math.floor(ey) - 1, o.glow2 || o.glow); }
        }
        // ceja superior sombreada
        h.p(Math.floor(cx - 3 * s), Math.floor(ey - 2 * s) - 0, ramp[1]); h.p(Math.floor(cx + 3 * s), Math.floor(ey - 2 * s), ramp[1]);
        // nariz
        const ny = Math.floor(cy + 3.4 * s);
        h.p(Math.floor(cx) - 1, ny, '0'); h.p(Math.floor(cx), ny, '0'); h.p(Math.floor(cx) - 1, ny - 1, '1');
        // dientes
        const ty = Math.floor(cy + 5.2 * s);
        for (let x = Math.floor(cx - 3 * s); x <= cx + 3 * s - 1; x++) h.p(x, ty, (x % 2 === 0) ? '0' : ramp[1]);
        for (let x = Math.floor(cx - 3 * s) + 1; x <= cx + 3 * s - 1; x += 2) h.p(x, ty - 1, ramp[0]);
      },
      // corona de llamas / llama individual
      flame(cx, by, w, hgt, ramp = R.fire) {
        const outer = P([[cx - w, by], [cx - w * 0.9, by - hgt * 0.45], [cx - w * 0.2, by - hgt * 0.75], [cx, by - hgt], [cx + w * 0.4, by - hgt * 0.6], [cx + w, by - hgt * 0.35], [cx + w, by]]);
        h.shade(U(outer, E(cx, by - 1, w, w * 0.8)), ramp, { ly: 1, lx: 0, bias: 0.4 });
        h.fill(U(E(cx, by - hgt * 0.25, w * 0.5, hgt * 0.32)), ramp[3]);
        h.fill(E(cx, by - hgt * 0.18, w * 0.25, hgt * 0.16), '8');
      },
    };
    return h;
  }

  // registra sprite con pincel extendido
  function mk(name, w, h, fn) { return PX.make(name, w, h, (g) => fn(H(g))); }

  // ======================================================================
  // Canvases y utilidades de cartas
  // ======================================================================
  const cv = (w, h) => PX.canvas(w, h);
  const Q = (c) => OM.PAL[c];

  const RAR = {
    comun: { ramp: ['p', 'q', 'r', '8'], dark: 'o', bg: ['1', 'o', 'p'], gem: R.blue, pips: 1 },
    raro: { ramp: ['k', 'l', 'm', 'n'], dark: 'j', bg: ['1', 'j', 'k'], gem: R.toxic, pips: 2 },
    epico: { ramp: ['a', 'b', 'c', 'd'], dark: '9', bg: ['1', '9', 'a'], gem: R.red, pips: 3 },
    legendario: { ramp: ['f', 'g', 'h', 'i'], dark: 'e', bg: ['1', 's', '4'], gem: R.gold, pips: 0 },
  };
  const KIND = {
    arcano: { ramp: ['s', 't', 'u', '8'], dark: '2', bg: ['1', '2', 's'] },
    grabado: { ramp: ['e', 'f', 'g', 'h'], dark: 'e', bg: ['1', '3', 'e'] },
    luna: { ramp: ['4', '5', '6', '7'], dark: '2', bg: ['1', 'o', '3'] },
  };

  // marco biselado genérico w x h (esquinas redondeadas 1px)
  function paintFrame(g, w, h, ramp) {
    g.rect(1, 0, w - 2, 1, '0'); g.rect(1, h - 1, w - 2, 1, '0'); g.rect(0, 1, 1, h - 2, '0'); g.rect(w - 1, 1, 1, h - 2, '0');
    // banda exterior (2px) biselada
    g.rect(1, 1, w - 2, 1, ramp[3]); g.rect(1, 1, 1, h - 2, ramp[3]);
    g.rect(2, 2, w - 4, 1, ramp[2]); g.rect(2, 2, 1, h - 4, ramp[2]);
    g.rect(1, h - 2, w - 2, 1, ramp[0]); g.rect(w - 2, 1, 1, h - 2, ramp[0]);
    g.rect(2, h - 3, w - 4, 1, ramp[1]); g.rect(w - 3, 2, 1, h - 4, ramp[1]);
    g.p(w - 2, 1, ramp[2]); g.p(1, h - 2, ramp[1]);
    g.frame(3, 3, w - 6, h - 6, '0');
  }
  // fondo radial tramado de la ventana de arte
  function paintArtBg(g, x0, y0, w, h, bg) {
    const cx = x0 + w / 2, cy = y0 + h / 2 - 1;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.05) / (w / 2);
      let c = bg[0];
      if (d < 0.5) c = (x + y) % 2 === 0 ? bg[2] : bg[1];
      else if (d < 0.78) c = bg[1];
      else if (d < 1.0) c = (x + y) % 2 === 0 ? bg[1] : bg[0];
      else if (d > 1.25 && (x + y) % 2 === 0) c = '0';
      g.p(x, y, c);
    }
    // polvo/estrellas
    let seed = (x0 * 7 + y0 * 13 + w) | 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let k = 0; k < 6; k++) {
      const x = x0 + 1 + Math.floor(rnd() * (w - 2)), y = y0 + 1 + Math.floor(rnd() * (h - 2));
      g.p(x, y, bg[2]);
    }
  }

  // ----------------------------------------------------------------------
  // Construcción de la carta de comodín (40x54)
  // ----------------------------------------------------------------------
  function buildJokerCard(def) {
    const rr = RAR[def.rarity] || RAR.comun;
    const { c, ctx } = cv(40, 54);
    const g = PX.painter(ctx, 40, 54);
    paintFrame(g, 40, 54, rr.ramp);
    g.rect(4, 4, 32, 46, '1');
    paintArtBg(g, 4, 4, 32, 36, rr.bg);
    // separador con rombo central
    g.rect(4, 40, 32, 1, '0');
    g.rect(4, 41, 32, 1, rr.ramp[2]); g.p(4, 41, rr.ramp[3]); g.p(35, 41, rr.ramp[1]);
    g.rect(4, 42, 32, 1, '0');
    // placa inferior
    for (let y = 43; y < 50; y++) for (let x = 4; x < 36; x++) g.p(x, y, (y === 43) ? '3' : ((x + y) % 2 === 0 ? '2' : '1'));
    // filigrana lateral
    g.rect(7, 46, 5, 1, rr.ramp[0]); g.rect(28, 46, 5, 1, rr.ramp[0]);
    g.p(6, 46, rr.ramp[1]); g.p(33, 46, rr.ramp[1]);
    // emblema de rareza
    if (def.rarity === 'legendario') {
      g.rows(14, 43, [
        '.0..0..0..0.',
        '0h00i00h00h0',
        '0hh0hh0hh0h0',
        '0hhhhhhhhhh0',
        '0gcgggqgggg0',
        '0eeeeeeeeee0',
        '.0000000000.',
      ]);
      g.p(16, 47, 'c'); g.p(20, 47, 'q'); g.p(23, 47, 'c');
      g.rect(7, 46, 5, 1, rr.ramp[1]); g.rect(28, 46, 5, 1, rr.ramp[1]);
    } else {
      const n = rr.pips, sp = 7, x0 = 20 - ((n - 1) * sp) / 2;
      for (let k = 0; k < n; k++) {
        const cx = Math.round(x0 + k * sp);
        g.rows(cx - 3, 43, ['...0...', '..0a0..', '.0bab0.', '0cbabd0', '.0dbd0.', '..0d0..', '...0...'],
          { a: rr.gem[3], b: rr.gem[2], c: rr.gem[2], d: rr.gem[0] });
        g.p(cx - 1, 45, '8');
      }
    }
    // ilustración
    const spr = PX.get('joker_' + def.id);
    if (spr) ctx.drawImage(spr.c, 4, 6);
    // escuadras góticas en las esquinas de la ventana
    const L = rr.ramp[2], L2 = rr.ramp[3];
    [[4, 4, 1, 1], [35, 4, -1, 1], [4, 39, 1, -1], [35, 39, -1, -1]].forEach(([x, y, dx, dy]) => {
      g.p(x, y, L2); g.p(x + dx, y, L); g.p(x + 2 * dx, y, L); g.p(x, y + dy, L); g.p(x, y + 2 * dy, L);
      g.p(x + dx, y + dy, '0');
    });
    // rombo central del separador
    g.rows(18, 39, ['.00.', '0ab0', '0ba0', '.00.'], { a: rr.ramp[3], b: rr.ramp[1] });
    // remaches
    [[2, 2], [37, 2], [2, 51], [37, 51]].forEach(([x, y]) => { g.p(x, y, '8'); });
    return c;
  }

  // brillo animado del legendario: frames precalculados
  const LEG_FRAMES = 24, LEG_PERIOD = 2.6;
  function buildLegendFrames(base) {
    const frames = [];
    const data = base.getContext('2d').getImageData(0, 0, 40, 54).data;
    const isBand = (x, y) => (x <= 2 || x >= 37 || y <= 2 || y >= 51 || y === 41);
    for (let f = 0; f < LEG_FRAMES; f++) {
      const { c, ctx } = cv(40, 54);
      ctx.drawImage(base, 0, 0);
      const p = -20 + (f / LEG_FRAMES) * 150; // barrido + pausa
      for (let y = 0; y < 54; y++) for (let x = 0; x < 40; x++) {
        const a = data[(y * 40 + x) * 4 + 3]; if (!a) continue;
        const k = x + y - p;
        if (k < 0 || k > 4) continue;
        const col = data[(y * 40 + x) * 4] + data[(y * 40 + x) * 4 + 1];
        if (col < 30) continue; // no pintar contornos negros
        if (isBand(x, y)) { ctx.fillStyle = Q(k > 1 && k < 3 ? '8' : 'i'); ctx.globalAlpha = 1; }
        else { ctx.fillStyle = Q('8'); ctx.globalAlpha = 0.28; }
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;
      // destellos en esquinas (titilan)
      const tw = [[2, 2], [37, 51], [37, 2], [2, 51]][Math.floor(f / 6) % 4];
      ctx.fillStyle = Q('8'); ctx.fillRect(tw[0], tw[1], 1, 1);
      ctx.fillStyle = Q('i');
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => { const xx = tw[0] + dx, yy = tw[1] + dy; if (xx >= 0 && yy >= 0 && xx < 40 && yy < 54) ctx.fillRect(xx, yy, 1, 1); });
      frames.push(c);
    }
    return frames;
  }

  // silueta (para sombra y halo)
  function silhouette(src, color) {
    const w = src.width, h = src.height;
    const { c, ctx } = cv(w, h);
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = Q(color); ctx.fillRect(0, 0, w, h);
    return c;
  }
  // halo de borde: anillo de 1px por fuera de la silueta (w+2 x h+2)
  function haloRing(src, color) {
    const w = src.width, h = src.height;
    const d = src.getContext('2d').getImageData(0, 0, w, h).data;
    const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const { c, ctx } = cv(w + 2, h + 2);
    ctx.fillStyle = Q(color);
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (op(x, y)) continue;
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) ctx.fillRect(x + 1, y + 1, 1, 1);
    }
    return c;
  }

  // ----------------------------------------------------------------------
  // Dibujo genérico de carta pre-renderizada con juice
  // ----------------------------------------------------------------------
  const scratch = cv(48, 64);
  const cache = { joker: {}, item: {}, back: {}, pack: {}, medal: {}, shadow: {}, halo: {}, haloSel: {} };
  function shapeKey(w, h) { return w + 'x' + h; }
  function getShadow(src) {
    const k = shapeKey(src.width, src.height);
    if (!cache.shadow[k]) cache.shadow[k] = silhouette(src, '0');
    return cache.shadow[k];
  }
  function getHalo(src, col) {
    const k = shapeKey(src.width, src.height) + col;
    if (!cache.halo[k]) cache.halo[k] = haloRing(src, col);
    return cache.halo[k];
  }

  function editionOverlay(ctx, w, h, edition, t) {
    // ctx: scratch ya con la carta; pinta encima con source-atop
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    if (edition === 'foil') {
      const off = (t * 30) % 16;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = Q('r');
      for (let k = -h; k < w + h; k += 8) for (let y = 0; y < h; y++) ctx.fillRect(Math.floor(k + off + y * 0.5), y, 2, 1);
    } else if (edition === 'holo') {
      const cols = ['u', 't', 'q', 'r', 'm', 'h'];
      ctx.globalAlpha = 0.22;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 2) {
        const i = Math.floor((x + y + t * 24) / 4) % cols.length;
        ctx.fillStyle = Q(cols[(i + cols.length) % cols.length]); ctx.fillRect(x + (y % 2), y, 1, 1);
      }
    } else if (edition === 'negativo' || edition === 'negative') {
      ctx.globalCompositeOperation = 'difference';
      ctx.globalAlpha = 0.85; ctx.fillStyle = Q('7'); ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 0.25; ctx.fillStyle = Q('t'); ctx.fillRect(0, 0, w, h);
    } else if (edition === 'poli' || edition === 'poly' || edition === 'polychrome') {
      const cols = ['c', 'v', 'h', 'm', 'q', 't'];
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = Q(cols[Math.floor(t * 3) % cols.length]);
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function drawCardCanvas(ctx, src, x, y, o) {
    o = o || {};
    const w = src.width, h = src.height;
    const t = o.t || 0;
    const sc = o.scale || 1;
    const lift = o.hover ? 2 : 0;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    let ang = 0;
    if (o.wobble) {
      const amp = typeof o.wobble === 'number' ? o.wobble : 1;
      const seed = (x * 0.137 + y * 0.071);
      ang = Math.sin(t * 1.6 + seed * 6.3) * 0.035 * amp;
    }
    const cxp = Math.round(x + (w * sc) / 2), cyp = Math.round(y + (h * sc) / 2);
    ctx.translate(cxp, cyp);
    if (sc !== 1) ctx.scale(sc, sc);
    // sombra proyectada (no rota tanto: queda pegada a la mesa)
    {
      const sh = getShadow(src);
      const ga = ctx.globalAlpha;
      ctx.globalAlpha = ga * (o.hover ? 0.42 : 0.5);
      ctx.save(); if (ang) ctx.rotate(ang * 0.6);
      ctx.drawImage(sh, Math.round(-w / 2 + 2), Math.round(-h / 2 + 3 + (o.hover ? 1 : 0)));
      ctx.restore();
      ctx.globalAlpha = ga;
    }
    if (ang) ctx.rotate(ang);
    const dx = Math.round(-w / 2), dy = Math.round(-h / 2 - lift);
    let img = src;
    if (o.edition) {
      const sctx = scratch.ctx;
      sctx.clearRect(0, 0, 48, 64);
      sctx.drawImage(src, 0, 0);
      editionOverlay(sctx, w, h, o.edition, t);
      img = scratch.c;
    }
    if (img === scratch.c) ctx.drawImage(img, 0, 0, w, h, dx, dy, w, h); else ctx.drawImage(img, dx, dy);
    // halo hover / selección
    if (o.selected) {
      const on = Math.floor(t * 5) % 2 === 0;
      const hl = getHalo(src, on ? '8' : 'h');
      ctx.drawImage(hl, dx - 1, dy - 1);
      const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.45;
      ctx.drawImage(getHalo(src, 'h'), dx - 1, dy - 2);
      ctx.globalAlpha = ga;
    } else if (o.hover) {
      const ga = ctx.globalAlpha;
      ctx.globalAlpha = ga * (0.65 + 0.25 * Math.sin(t * 6));
      ctx.drawImage(getHalo(src, '8'), dx - 1, dy - 1);
      ctx.globalAlpha = ga;
    }
    if (o.sold) {
      const ga = ctx.globalAlpha;
      ctx.globalAlpha = ga * 0.6;
      ctx.drawImage(getShadow(src), dx, dy);
      ctx.globalAlpha = ga;
      // sello de vendido: aspa roja
      ctx.fillStyle = Q('b');
      for (let k = 0; k < 18; k++) {
        ctx.fillRect(dx + 11 + k, dy + 18 + k, 2, 1);
        ctx.fillRect(dx + 28 - k, dy + 18 + k, 2, 1);
      }
    }
    ctx.restore();
  }

  // ----------------------------------------------------------------------
  // Consumible (30x40)
  // ----------------------------------------------------------------------
  function buildItemCard(def) {
    const kk = KIND[def.kind] || KIND.arcano;
    const { c, ctx } = cv(30, 40);
    const g = PX.painter(ctx, 30, 40);
    paintFrame(g, 30, 40, kk.ramp);
    g.rect(4, 4, 22, 32, '1');
    if (def.kind === 'arcano') {
      // tarot: arco gótico en la ventana
      paintArtBg(g, 4, 4, 22, 26, kk.bg);
      g.p(4, 4, '0'); g.p(5, 4, '0'); g.p(4, 5, '0'); g.p(25, 4, '0'); g.p(24, 4, '0'); g.p(25, 5, '0');
      g.rect(4, 30, 22, 1, '0'); g.rect(4, 31, 22, 1, kk.ramp[2]); g.rect(4, 32, 22, 1, '0');
      for (let y = 33; y < 36; y++) for (let x = 4; x < 26; x++) g.p(x, y, (x + y) % 2 ? '2' : '1');
      // numeral romano pequeño
      g.rows(12, 33, ['0t0t0t', '.t0t0t'.replace(/0/g, '.')]);
    } else if (def.kind === 'grabado') {
      paintArtBg(g, 4, 4, 22, 26, kk.bg);
      g.rect(4, 30, 22, 1, '0'); g.rect(4, 31, 22, 1, kk.ramp[2]); g.rect(4, 32, 22, 1, '0');
      for (let y = 33; y < 36; y++) for (let x = 4; x < 26; x++) g.p(x, y, (x + y) % 2 ? 'e' : '1');
      // martillo y cincel diminutos
      g.rows(11, 33, ['.g.....g', 'ggg.6.ggg'.slice(0, 8), '.g.....g']);
    } else {
      paintArtBg(g, 4, 4, 22, 26, kk.bg);
      g.rect(4, 30, 22, 1, '0'); g.rect(4, 31, 22, 1, kk.ramp[2]); g.rect(4, 32, 22, 1, '0');
      for (let y = 33; y < 36; y++) for (let x = 4; x < 26; x++) g.p(x, y, (x + y) % 2 ? '3' : '2');
      // flecha de subir nivel
      g.rows(12, 33, ['..n..', '.nnn.', 'nnnnn'].map((r) => r));
      g.rows(17, 33, ['..n..', '.nnn.', 'nnnnn'].map((r) => r));
    }
    [[2, 2], [27, 2], [2, 37], [27, 37]].forEach(([x, y]) => g.p(x, y, '8'));
    const spr = PX.get('item_' + def.id);
    if (spr) ctx.drawImage(spr.c, 3, 5);
    return c;
  }

  // ----------------------------------------------------------------------
  // Reversos
  // ----------------------------------------------------------------------
  function buildBack(kind) {
    const W = kind === 'item' ? 30 : 40, Hh = kind === 'item' ? 40 : 54;
    const { c, ctx } = cv(W, Hh);
    const g = PX.painter(ctx, W, Hh);
    const h = H(g);
    paintFrame(g, W, Hh, kind === 'item' ? ['s', '4', '5', '6'] : ['e', 'f', 'g', 'h']);
    // celosía de rombos
    for (let y = 4; y < Hh - 4; y++) for (let x = 4; x < W - 4; x++) {
      const u = (x - 4 + y) % 6, v = (x - 4 - y + 600) % 6;
      let col = (x + y) % 2 ? '2' : '1';
      if (u === 0 || v === 0) col = kind === 'item' ? 's' : '9';
      if ((u === 0 && v === 0)) col = kind === 'item' ? 't' : 'a';
      g.p(x, y, col);
    }
    // borde interior
    g.frame(5, 5, W - 10, Hh - 10, kind === 'item' ? '4' : 'e');
    // medallón central con la bola 8 maldita
    const cx = W / 2, cy = Hh / 2;
    const r = kind === 'item' ? 7 : 10;
    h.fill(C(cx, cy, r + 3), '0');
    h.fill(D(C(cx, cy, r + 2), C(cx, cy, r + 1)), kind === 'item' ? 't' : 'g');
    // rayos
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const x1 = Math.round(cx + Math.cos(a) * (r + 6)), y1 = Math.round(cy + Math.sin(a) * (r + 6));
      h.p(x1, y1, kind === 'item' ? 'u' : 'h');
    }
    h.ball(cx, cy, r - 1, { col: ['0', '1', '2', '4'], num: kind === 'item' ? undefined : 8, numC: 'b', ol: '0' });
    if (kind === 'item') { h.fill(C(cx - 1, cy - 1, 2.3), '7'); h.p(Math.floor(cx) - 1, Math.floor(cy) - 1, 'b'); }
    // cuernos
    const hr = kind === 'item' ? 0.7 : 1;
    h.shade(U(Cap(cx - 5 * hr, cy - r + 1, cx - 8 * hr, cy - r - 4 * hr, 1.6, 0.4)), R.bone, {});
    h.shade(U(Cap(cx + 5 * hr, cy - r + 1, cx + 8 * hr, cy - r - 4 * hr, 1.6, 0.4)), R.bone, {});
    // esquinas: velitas
    [[7, 8], [W - 8, 8], [7, Hh - 9], [W - 8, Hh - 9]].forEach(([x, y]) => { h.p(x, y, 'h'); h.p(x, y + 1, 'v'); });
    return c;
  }

  // ----------------------------------------------------------------------
  // Sobres
  // ----------------------------------------------------------------------
  const PACKS = {
    arcano: { ramp: ['s', 't', 'u', '8'], body: ['2', 's', 't', 'u'], emb: 'pack_emb_arcano' },
    luna: { ramp: ['p', 'q', 'r', '8'], body: ['o', 'p', 'q', 'r'], emb: 'pack_emb_luna' },
    grabado: { ramp: ['e', 'g', 'h', 'i'], body: ['e', 'f', 'g', 'h'], emb: 'pack_emb_grabado' },
    maldito: { ramp: ['9', 'a', 'b', 'c'], body: ['0', '9', 'a', 'b'], emb: 'pack_emb_maldito' },
  };
  function buildPack(kind) {
    const pk = PACKS[kind] || PACKS.arcano;
    const { c, ctx } = cv(40, 54);
    const g = PX.painter(ctx, 40, 54);
    const h = H(g);
    const B = pk.body; // oscuro -> claro
    // silueta: cuerpo + dentado (zigzag) arriba y abajo
    const zz = (x) => (Math.floor(x) % 2 === 0 ? 1 : 0);
    const shape = (x, y) => x >= 1 && x < 39 && y >= 1 + zz(x) && y < 53 - zz(x);
    h.ol(shape, '0');
    for (let y = 0; y < 54; y++) for (let x = 0; x < 40; x++) {
      if (!shape(x + 0.5, y + 0.5)) continue;
      // gradiente metalizado por columnas + brillo diagonal
      const u = (x - 1) / 37;
      let i = u < 0.08 ? 2 : u < 0.2 ? 3 : u < 0.55 ? 2 : u < 0.85 ? 1 : 0;
      const d = (x + y * 0.5) % 40;
      if (d > 30 && d < 33) i = Math.min(3, i + 1);
      if (u > 0.2 && u < 0.26 && (x + y) % 2) i = 2;
      if (u > 0.5 && u < 0.58 && (x + y) % 2) i = 1;
      g.p(x, y, B[i]);
    }
    // franjas selladas (crimpado)
    for (let x = 1; x < 39; x++) {
      for (let y = 1; y < 6; y++) if (shape(x + 0.5, y + 0.5)) g.p(x, y, x % 2 ? pk.ramp[1] : pk.ramp[2]);
      for (let y = 48; y < 53; y++) if (shape(x + 0.5, y + 0.5)) g.p(x, y, x % 2 ? pk.ramp[0] : pk.ramp[1]);
    }
    g.rect(1, 6, 38, 1, '0'); g.rect(1, 47, 38, 1, '0');
    g.rect(1, 7, 38, 1, pk.ramp[3]);
    // muesca de apertura
    g.p(1, 9, '0'); g.p(2, 9, '0'); g.p(38, 9, '0'); g.p(37, 9, '0');
    // ventana del emblema (arco gótico)
    const win = U(Rc(6, 16, 28, 26), E(20, 16, 14, 6));
    h.ol(win, '0');
    for (let y = 0; y < 54; y++) for (let x = 0; x < 40; x++) if (win(x + 0.5, y + 0.5)) g.p(x, y, (x + y) % 2 ? '1' : '0');
    for (let y = 10; y < 43; y++) for (let x = 5; x < 35; x++) {
      if (!win(x + 0.5, y + 0.5)) continue;
      if (!win(x + 0.5, y - 0.5) || !win(x - 0.5, y + 0.5)) g.p(x, y, pk.ramp[3]);
      else if (!win(x + 0.5, y + 1.5) || !win(x + 1.5, y + 0.5)) g.p(x, y, pk.ramp[0]);
    }
    const em = PX.get(pk.emb);
    if (em) ctx.drawImage(em.c, 8, 15);
    // pips: cuántas cartas trae (3)
    for (let k = 0; k < 3; k++) { const x = 15 + k * 4; g.p(x, 44, pk.ramp[3]); g.p(x + 1, 44, pk.ramp[2]); g.p(x, 45, pk.ramp[2]); g.p(x + 1, 45, pk.ramp[1]); }
    // destellos
    h.star(5, 11, pk.ramp[2], '8'); h.star(35, 43, pk.ramp[2], '8');
    return c;
  }

  // ----------------------------------------------------------------------
  // Medallón de jefe (48x48)
  // ----------------------------------------------------------------------
  function buildMedal(def, state) {
    const { c, ctx } = cv(48, 48);
    const g = PX.painter(ctx, 48, 48);
    const h = H(g);
    const fin = !!def.final;
    const ring = fin ? R.gold : ['2', '3', '5', '6'];
    // púas (4 grandes + 4 pequeñas)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
      const big = k % 2 === 0, L = big ? 23.8 : 22, wd = big ? 0.2 : 0.16;
      const tip = [24 + Math.cos(a) * L, 24 + Math.sin(a) * L];
      const l = [24 + Math.cos(a - wd) * 18, 24 + Math.sin(a - wd) * 18];
      const r = [24 + Math.cos(a + wd) * 18, 24 + Math.sin(a + wd) * 18];
      h.shade(P([l, tip, r]), fin ? R.gold : R.steel, { bias: 0.2 });
    }
    h.shade(C(24, 24, 20), ring, { bias: 0.25 });
    h.fill(D(C(24, 24, 20), C(24.6, 24.6, 19.6)), fin ? 'e' : '2');
    h.fill(C(24, 24, 17.5), '0');
    h.fill(D(C(24, 24, 17.2), C(24, 24, 16.4)), fin ? 'v' : 'a');
    // interior radial
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const d = Math.hypot(x + 0.5 - 24, y + 0.5 - 24);
      if (d > 16.2) continue;
      let col = '1';
      if (d < 9) col = (x + y) % 2 ? (fin ? 'a' : '9') : (fin ? '9' : '2');
      else if (d < 13) col = fin ? '9' : '2';
      else if (d < 15) col = (x + y) % 2 ? '1' : (fin ? '9' : '2');
      g.p(x, y, col);
    }
    // remaches en el anillo
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8;
      const x = Math.round(24 + Math.cos(a) * 18.5 - 0.5), y = Math.round(24 + Math.sin(a) * 18.5 - 0.5);
      g.p(x, y, fin ? 'i' : '7'); g.p(x + 1, y + 1, '0');
    }
    const spr = PX.get('boss_' + def.id);
    if (spr) ctx.drawImage(spr.c, 8, 8);
    if (state === 'defeated') {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.55; ctx.fillStyle = Q('1'); ctx.fillRect(0, 0, 48, 48);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // tajo
      for (let k = 0; k < 30; k++) {
        ctx.fillStyle = Q('0'); ctx.fillRect(9 + k, 8 + k, 3, 2);
        ctx.fillStyle = Q('c'); ctx.fillRect(10 + k, 8 + k, 1, 1);
        ctx.fillStyle = Q('b'); ctx.fillRect(11 + k, 9 + k, 1, 1);
      }
    } else if (state === 'locked') {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.7; ctx.fillStyle = Q('1'); ctx.fillRect(8, 8, 32, 32);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    return c;
  }

  // ======================================================================
  // API pública
  // ======================================================================
  OM.CARDS = {
    drawJoker(ctx, def, x, y, opts) {
      if (!def) return;
      opts = opts || {};
      let ent = cache.joker[def.id];
      if (!ent) {
        const base = buildJokerCard(def);
        ent = cache.joker[def.id] = { base, frames: def.rarity === 'legendario' ? buildLegendFrames(base) : null };
      }
      let src = ent.base;
      if (ent.frames) {
        const t = opts.t || 0;
        const f = Math.floor(((t % LEG_PERIOD) / LEG_PERIOD) * LEG_FRAMES) % LEG_FRAMES;
        src = ent.frames[f];
      }
      drawCardCanvas(ctx, src, x, y, opts);
    },
    drawItem(ctx, def, x, y, opts) {
      if (!def) return;
      let src = cache.item[def.id];
      if (!src) src = cache.item[def.id] = buildItemCard(def);
      drawCardCanvas(ctx, src, x, y, opts || {});
    },
    drawBack(ctx, x, y, kind, opts) {
      kind = kind === 'item' ? 'item' : 'joker';
      let src = cache.back[kind];
      if (!src) src = cache.back[kind] = buildBack(kind);
      drawCardCanvas(ctx, src, x, y, opts || {});
    },
    drawPack(ctx, packKind, x, y, opts) {
      opts = opts || {};
      let src = cache.pack[packKind];
      if (!src) src = cache.pack[packKind] = buildPack(packKind);
      drawCardCanvas(ctx, src, x, y, opts);
      if (packKind === 'maldito') {
        // pulso de brillo infernal sobre el emblema
        const t = opts.t || 0;
        const a = 0.18 + 0.14 * Math.sin(t * 4);
        ctx.save();
        ctx.globalAlpha = (opts.alpha === undefined ? 1 : opts.alpha) * a;
        ctx.fillStyle = Q('c');
        const lift = opts.hover ? 2 : 0;
        const sc = opts.scale || 1;
        ctx.fillRect(Math.round(x + 9 * sc), Math.round(y + (16 - lift) * sc), Math.round(22 * sc), Math.round(22 * sc));
        ctx.restore();
      }
    },
    drawBossMedal(ctx, def, x, y, opts) {
      if (!def) return;
      opts = opts || {};
      const st = opts.defeated ? 'defeated' : opts.locked ? 'locked' : 'n';
      const k = def.id + ':' + st;
      let src = cache.medal[k];
      if (!src) src = cache.medal[k] = buildMedal(def, st);
      const t = opts.t || 0;
      ctx.save();
      if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
      const sc = opts.scale || 1;
      const bob = opts.hover ? -2 : 0;
      ctx.translate(Math.round(x), Math.round(y + bob));
      if (sc !== 1) ctx.scale(sc, sc);
      // sombra
      const ga = ctx.globalAlpha;
      ctx.globalAlpha = ga * 0.5; ctx.drawImage(getShadow(src), 2, 3 - bob); ctx.globalAlpha = ga;
      // aura pulsante de jefe vivo
      if (st === 'n') {
        ctx.globalAlpha = ga * (0.25 + 0.2 * Math.sin(t * 3));
        ctx.drawImage(getHalo(src, def.final ? 'h' : 'b'), -1, -1);
        ctx.globalAlpha = ga;
      }
      ctx.drawImage(src, 0, 0);
      if (opts.hover) {
        ctx.globalAlpha = ga * (0.6 + 0.3 * Math.sin(t * 6));
        ctx.drawImage(getHalo(src, '8'), -1, -1);
        ctx.globalAlpha = ga;
      }
      ctx.restore();
    },
    // utilidades extra (no contractuales)
    RARITY_RAMP: RAR,
    _cache: cache,
  };

  // ======================================================================
  // Registro de sprites
  // ======================================================================
  OM.ART_INIT.push(function initCards() {
    const ART = OM.CARDS._art;
    Object.keys(ART).forEach((name) => {
      const [w, hgt, fn] = ART[name];
      try { mk(name, w, hgt, fn); } catch (e) { console.error('cards_art: fallo en ' + name, e); }
    });
    // reconstruye cachés si ya hubiera algo
    Object.keys(cache).forEach((k) => { cache[k] = {}; });
  });

  OM.CARDS._art = {};
  OM.CARDS._lib = { R, E, C, Rc, P, Cap, U, I, D, Arc, F3, H };
})();

// ========================================================================
// ILUSTRACIONES
// ========================================================================
(function () {
  'use strict';
  const { R, E, C, Rc, P, Cap, U, I, D, Arc } = OM.CARDS._lib;
  const A = OM.CARDS._art;
  const J = (id, fn) => { A['joker_' + id] = [32, 32, fn]; };
  const IT = (id, fn) => { A['item_' + id] = [24, 24, fn]; };
  const B = (id, fn) => { A['boss_' + id] = [32, 32, fn]; };
  const CU = (id, fn) => { A['cue_' + id] = [24, 24, fn]; };
  const EM = (id, fn) => { A['pack_emb_' + id] = [24, 24, fn]; };
  const clr = (h, x, y) => { h.g.ctx.clearRect(x, y, 1, 1); h.p(-9, -9, '0'); };
  const ghostify = (h, x0, y0, w, hh) => { for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + w; x++) if ((x + y) % 2 === 0) clr(h, x, y); };

  // cuernos (reutilizable)
  function horns(h, cx, cy, spread, len, ramp) {
    ramp = ramp || R.bone;
    h.shade(U(Cap(cx - spread, cy, cx - spread - 3, cy - len * 0.55, 2.4, 1.8), Cap(cx - spread - 3, cy - len * 0.55, cx - spread - 2, cy - len, 1.8, 0.4)), ramp);
    h.shade(U(Cap(cx + spread, cy, cx + spread + 3, cy - len * 0.55, 2.4, 1.8), Cap(cx + spread + 3, cy - len * 0.55, cx + spread + 2, cy - len, 1.8, 0.4)), ramp);
  }

  // ---------------- COMUNES ----------------
  J('tiza_azul', (h) => {
    h.halo(16, 17, 15, 'p');
    const top = P([[16, 5], [28, 11], [16, 17], [4, 11]]);
    const left = P([[4, 11], [16, 17], [16, 28], [4, 22]]);
    const right = P([[16, 17], [28, 11], [28, 22], [16, 28]]);
    h.ol(U(top, left, right));
    h.fill(left, 'q'); h.fill(right, 'p'); h.fill(top, 'r');
    h.fill(I(right, (x, y) => (Math.floor(x) + Math.floor(y)) % 2 === 0 && y > 24 - (x - 16) * 0.5), 'o');
    // aristas iluminadas
    h.line(5, 11, 15, 16, '8'); h.line(4, 12, 4, 21, 'r'); h.line(16, 18, 16, 27, 'o');
    // hendidura del taco en la cara superior
    h.fill(E(16, 11, 5.5, 2.6), 'p');
    h.fill(D(E(16, 11, 5.5, 2.6), E(15.3, 10.2, 5.4, 2.4)), '8');
    h.fill(D(E(16, 11, 5.5, 2.6), E(15.6, 10.5, 5.4, 2.4), E(15.3, 10.2, 5.4, 2.4)), 'r');
    // textura de tiza
    [[6, 15], [9, 19], [12, 22], [7, 20], [11, 16], [14, 25], [13, 19]].forEach(([x, y]) => h.p(x, y, 'r'));
    [[19, 20], [24, 16], [26, 19], [21, 17]].forEach(([x, y]) => h.p(x, y, 'o'));
    // polvo azul
    [[7, 6, 'r'], [10, 3, '8'], [21, 3, 'r'], [25, 6, '8'], [4, 4, 'q'], [14, 2, 'q'], [18, 1, 'r'], [2, 9, 'q'], [30, 9, 'q']].forEach(([x, y, c]) => h.p(x, y, c));
    h.star(27, 2, 'r', '8');
    h.star(5, 27, 'c', '8');
  });
  J('taco_fresno', (h) => {
    h.halo(16, 16, 15, 'o');
    // fichas azules apiladas
    h.chip(8, 14, 5.5); h.chip(8, 10, 5.5); h.chip(8, 6, 5.5);
    h.chip(24, 26, 5); 
    // taco diagonal
    h.shade(Cap(2, 31, 12, 21, 2.8, 2.3), R.woodD, { bias: 0.3 });
    h.shade(Cap(12, 21, 22, 11, 2.1, 1.5), R.wood, { bias: 0.4 });
    h.shade(Cap(11, 22, 13, 20, 2.6), R.gold, {});
    h.shade(Cap(21, 12, 23, 10, 1.6), R.bone, { bias: 0.3 });
    h.shade(Cap(23.5, 9.5, 24.5, 8.5, 1.5), R.blue, {});
    // vetas
    h.line(4, 28, 9, 23, 'e'); h.line(15, 19, 19, 15, 'h');
    // bola blanca
    h.sphere(27.5, 4.5, 4, R.bone, {});
    h.star(25, 8, 'h', '8', 2);
    [[29, 11, 'q'], [30, 9, 'r'], [20, 4, 'r']].forEach(([x, y, c]) => h.p(x, y, c));
  });

  J('lisas', (h) => {
    h.halo(16, 18, 15, 'a', '9');
    horns(h, 16, 11, 5, 10, R.bone);
    h.ball(16, 19, 10.5, { col: R.red });
    // cara malvada
    h.rows(10, 14, [
      '00.......00',
      '.000...000.',
      '..0hh.hh0..',
      '..0hi.ih0..',
      '...........',
      '0.........0',
      '.07070707 0'.replace(' ', '0'),
      '..0000000..',
    ], {});
    h.p(11, 20, '0'); h.p(21, 20, '0');
    h.star(27, 6, 'c', '8');
    h.star(4, 22, 'd', '8');
  });

  J('rayadas', (h) => {
    h.halo(16, 18, 15, 'p', 'o');
    h.ball(16, 18, 11, { col: R.blue, stripe: true, tilt: -0.15 });
    // antifaz de bandido
    const mask = U(Rc(5, 10, 22, 5), E(16, 12.5, 11, 2.6));
    h.shade(I(mask, C(16, 18, 11.5)), ['0', '1', '2', '3'], { ol: false });
    h.fill(E(11.5, 12.5, 2, 1.2), '8'); h.fill(E(20.5, 12.5, 2, 1.2), '8');
    h.p(12, 12, '0'); h.p(21, 12, '0');
    // nudo y cintas
    h.shade(U(Cap(5, 12, 1, 16, 1.3), Cap(5, 12, 2, 8, 1.1)), ['0', '1', '2', '3'], {});
    // número
    h.fill(C(17, 21, 3.6), '7'); h.txt(14, 19, '13', '0');
    h.star(27, 27, 'q', '8'); h.star(4, 27, 'r', '8');
  });

  J('primera_sangre', (h) => {
    h.halo(16, 18, 15, '9');
    // hoja
    const blade = P([[13, 9], [19, 9], [19, 20], [16, 26], [13, 20]]);
    h.shade(blade, R.steel, { bias: 0.2 });
    h.line(15, 10, 15, 21, '8'); h.line(16, 10, 16, 23, '5');
    // sangre en la punta
    h.fill(I(blade, (x, y) => y > 17 + Math.sin(x * 2.1) * 1.5), 'b');
    h.fill(I(blade, (x, y) => y > 21), 'a');
    h.p(14, 19, 'c'); h.p(14, 20, 'c'); h.p(17, 19, 'c');
    // guarda, puño, pomo
    h.shade(Cap(7, 8, 25, 8, 1.7), R.gold, {});
    h.shade(C(6.5, 8, 2.2), R.gold, {}); h.shade(C(25.5, 8, 2.2), R.gold, {});
    h.shade(Rc(14, 2, 4, 5), R.blood, {});
    h.p(14, 3, '9'); h.p(16, 4, '9'); h.p(14, 5, '9'); h.p(16, 6, '9');
    h.shade(C(16, 1.8, 1.8), R.gold, {});
    h.p(16, 8, 'c'); h.p(15, 8, '8');
    // gota cayendo y charco
    h.drop(16, 29.5, 1.8, R.red);
    h.star(25, 16, 'c', '8');
  });

  J('ultimo_aliento', (h) => {
    h.halo(17, 14, 15, 'o');
    // aliento espectral que sale de la boca
    const pts = [[18, 25], [23, 24], [27, 19], [26, 13], [21, 11], [21, 6], [26, 3]];
    for (let i = 0; i < pts.length - 1; i++) {
      const r0 = 2.6 - i * 0.3, r1 = 2.6 - (i + 1) * 0.3;
      h.shade(Cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r0, r1), R.ice, { ol: 'o' });
    }
    h.p(27, 2, '8'); h.p(29, 4, 'r'); h.p(24, 1, 'q');
    // calavera
    h.skull(11, 19, 1.25, R.bone, { glow: 'r', glow2: 'q' });
    h.p(17, 25, 'r'); h.p(16, 24, 'q');
  });

  J('banda_sangrienta', (h) => {
    h.halo(12, 16, 14, 'k');
    // banda: madera + cojín
    h.shade(Rc(25, 0, 7, 32), R.wood, { ol: false, lx: -1, ly: 0 });
    h.fill(Rc(24, 0, 1, 32), '0');
    h.shade(Rc(20, 0, 4, 32), R.green, { ol: false, lx: -1, ly: 0, bias: 0.5 });
    h.fill(Rc(20, 0, 1, 32), 'm');
    [5, 15, 25].forEach((y) => { h.rows(26, y - 2, ['.i.', 'i8i', '.i.', '.g.'].slice(0, 3), {}); });
    // trayectoria con rebote
    h.dash(3, 29, 18, 16, '7', 2, 2);
    h.dash(18, 16, 9, 9, '7', 2, 2);
    // salpicadura de sangre en la banda
    h.fill(U(E(21, 16, 2.4, 3.2), C(19, 14, 1.2), C(19, 19, 1)), 'b');
    h.fill(E(21.5, 15, 1, 1.5), 'c');
    h.fill(Rc(21, 18, 1, 8), 'b'); h.fill(Rc(22, 18, 1, 5), 'a'); h.p(21, 26, 'c'); h.p(22, 23, 'a');
    h.fill(Rc(20, 19, 1, 3), 'a');
    h.p(17, 12, 'c'); h.p(16, 18, 'b'); h.p(15, 14, 'c');
    // bola
    h.ball(8, 8, 5.5, { col: R.red, num: 3 });
    h.star(18, 16, 'h', '8', 1);
  });

  J('carambolero', (h) => {
    h.halo(16, 17, 15, 'k');
    // estelas
    [[1, 17, 4], [0, 21, 5], [1, 25, 4]].forEach(([x, y, l]) => h.line(x, y, x + l, y, '5'));
    h.sphere(10, 21, 6, R.bone, {});
    h.ball(23, 10, 5.5, { col: R.red, num: 3 });
    h.ball(24, 25, 5.5, { col: R.toxic, stripe: true, num: 9 });
    // impactos
    h.star(16, 15, 'h', '8', 2); h.star(17, 24, 'h', '8', 2);
    h.p(19, 14, 'i'); h.p(14, 12, 'i'); h.p(20, 23, 'i'); h.p(15, 27, 'i');
    // líneas de dirección
    h.dash(27, 5, 30, 2, 'h', 1, 1); h.dash(29, 27, 31, 30, 'h', 1, 1);
  });

  J('usurero', (h) => {
    h.halo(16, 18, 15, 'e');
    // bolsa de arpillera
    const bag = U(E(15, 21, 10, 8.5), P([[10, 13], [20, 13], [24, 18], [6, 18]]));
    h.shade(bag, ['e', 'f', 'g', 'h'], { bias: 0.1 });
    // tela fruncida sobre la cuerda
    h.shade(U(E(15, 7.5, 5.5, 3.2), E(11, 9, 2.5, 2), E(19, 9, 2.5, 2)), ['9', 'e', 'f', 'g'], { bias: 0.3 });
    h.line(13, 6, 13, 10, 'e'); h.line(16, 5, 16, 10, 'e'); h.line(18, 7, 18, 10, 'e');
    // cuerda roja
    h.shade(Rc(9, 10, 12, 3), R.blood, {});
    h.p(10, 10, 'c'); h.p(13, 10, 'c'); h.p(19, 13, 'b'); h.p(20, 14, 'a'); h.p(20, 15, 'b');
    // signo $
    h.glyphO(12, 16, OM.CARDS._lib.F3['S$'], 'h', '9');
    h.p(13, 17, 'i'); h.p(12, 18, 'i');
    h.p(7, 22, 'e'); h.p(8, 25, 'e'); h.p(22, 22, 'e'); h.p(21, 26, 'e');
    // pila de monedas
    [[27, 29], [27, 27], [27, 25]].forEach(([x, y]) => {
      h.shade(U(E(x, y, 4, 1.8), Rc(x - 4, y, 8, 1.5)), R.gold, { bias: 0.4 });
    });
    h.fill(E(27, 25, 2.5, 0.8), 'i');
    h.coin(4, 27, 3);
    h.star(27, 6, 'h', '8', 2); h.star(4, 10, 'h', 'i', 1);
  });
  J('esquinero', (h) => {
    // fragmento de esquina de la mesa (cuarto de disco)
    const zone = E(0, 0, 31, 31);
    const wood = I(zone, U(Rc(0, 0, 32, 7), Rc(0, 0, 7, 32)));
    const felt = D(zone, wood);
    h.shade(wood, R.woodD, { ol: false });
    h.ol(zone);
    h.fill(I(felt, (x, y) => (Math.floor(x) + Math.floor(y)) % 2 === 0), 'k');
    h.fill(I(felt, (x, y) => (Math.floor(x) + Math.floor(y)) % 2 === 1), 'l');
    h.fill(I(felt, D(E(0, 0, 31, 31), E(0, 0, 27, 27)), (x, y) => (Math.floor(x) + Math.floor(y)) % 2), 'j');
    // cojín
    h.fill(I(zone, U(Rc(7, 7, 25, 1), Rc(7, 7, 1, 25))), 'm');
    // tronera
    h.fill(C(7, 7, 7), '0');
    h.fill(D(C(7, 7, 7), C(7.6, 7.6, 6)), 'g');
    h.fill(D(C(7, 7, 7), C(6.5, 6.5, 6.8)), 'h');
    h.fill(C(7.5, 7.5, 4.5), '1');
    h.fill(C(8, 8, 3), '0');
    // bola entrando
    h.ball(16, 16, 5, { col: ['a', 'b', 'v', 'd'], num: 5 });
    h.dash(22, 22, 29, 29, '7', 2, 1);
    h.p(23, 26, '6'); h.p(26, 23, '6');
    // diamante de banda
    h.rows(20, 2, ['.i.', 'i8i', '.i.'], {}); h.rows(2, 20, ['.i.', 'i8i', '.i.'], {});
    h.star(12, 11, 'h', '8', 1);
  });

  J('murcielago', (h) => {
    h.halo(16, 15, 15, '3', '2');
    const lw = P([[14, 12], [8, 6], [2, 5], [0, 12], [3, 14], [5, 13], [6, 17], [9, 15], [11, 19], [14, 18]]);
    const rw = P([[18, 12], [24, 6], [30, 5], [32, 12], [29, 14], [27, 13], [26, 17], [23, 15], [21, 19], [18, 18]]);
    h.shade(lw, R.violet, { bias: 0.1 });
    h.shade(rw, R.violet, { bias: -0.1 });
    // dedos del ala
    h.line(13, 13, 3, 6, '5'); h.line(10, 11, 5, 13, '2'); h.line(11, 13, 9, 15, '2');
    h.line(19, 13, 29, 6, '5'); h.line(22, 11, 27, 13, '2'); h.line(21, 13, 23, 15, '2');
    // cuerpo y cabeza
    h.shade(U(E(16, 17, 4, 6.5), C(16, 10, 4.2), P([[12, 9], [12, 3], [15, 7]]), P([[20, 9], [20, 3], [17, 7]])), R.lilac, { bias: 0.2 });
    h.p(13, 5, 'b'); h.p(19, 5, 'b');
    h.p(14, 10, 'c'); h.p(18, 10, 'c'); h.p(14, 9, '8'); h.p(18, 9, '8');
    h.p(15, 12, '0'); h.p(16, 12, '0'); h.p(17, 12, '0'); h.p(15, 13, '8'); h.p(17, 13, '8');
    h.p(15, 18, '4'); h.p(17, 20, '4'); h.p(16, 16, '6');
    // patas con ficha azul
    h.chip(16, 26, 5);
    h.p(14, 23, '6'); h.p(18, 23, '6'); h.p(14, 22, '4'); h.p(18, 22, '4');
  });

  J('vela_negra', (h) => {
    // resplandor
    h.halo(16, 8, 13, '9', 'a');
    // portavelas
    h.shade(U(E(16, 28, 12, 3), Rc(10, 25, 12, 3)), R.gold, { bias: 0.4 });
    h.fill(D(C(28, 25, 3), C(28, 25, 1.6)), 'g'); h.ol(D(C(28, 25, 3), C(28, 25, 1.6)));
    h.fill(E(16, 27, 9, 1.4), 'i');
    // vela negra con goterones
    const wax = U(Rc(11, 13, 10, 14), E(16, 13, 5, 1.5), Cap(12, 13, 12, 19, 1.2), Cap(19.5, 13, 19.5, 22, 1.1), Cap(15, 14, 15, 17, 1));
    h.shade(wax, ['1', '2', '3', '4'], { bias: 0.1 });
    h.fill(Rc(12, 14, 1, 10), '5'); h.p(11, 18, '4');
    h.fill(E(16, 13, 4, 0.9), '1');
    // mecha y llama
    h.p(16, 11, '0'); h.p(16, 12, '0');
    h.flame(16.5, 11, 4.2, 11, R.fire);
    h.p(16, 3, 'v'); h.p(15, 1, 'b');
    [[8, 3], [24, 5], [6, 12], [26, 12]].forEach(([x, y]) => h.p(x, y, 'v'));
  });

  J('iman', (h) => {
    h.halo(16, 16, 15, 'a');
    const U_ = U(I(D(C(16, 17, 11), C(16, 17, 5)), (x, y) => y >= 17), Rc(5, 8, 6, 9.5), Rc(21, 8, 6, 9.5));
    h.shade(U_, R.red, { bias: 0.2 });
    // óxido
    [[7, 20], [8, 21], [9, 25], [12, 27], [13, 26], [22, 25], [24, 22], [25, 21], [23, 14], [6, 15], [7, 13]].forEach(([x, y]) => { h.p(x, y, 'v'); h.p(x + 1, y, 'f'); });
    h.p(19, 26, 'e'); h.p(10, 24, 'e');
    // polos metálicos
    h.shade(Rc(5, 4, 6, 4), R.steel, { bias: 0.3 }); h.shade(Rc(21, 4, 6, 4), R.steel, { bias: 0.3 });
    // bola atraída
    h.ball(16, 9, 4, { col: R.blue, stripe: true });
    // líneas de campo
    h.dash(10, 2, 13, 0, 'r', 1, 1); h.dash(22, 2, 19, 0, 'r', 1, 1);
    h.p(12, 4, 'r'); h.p(20, 4, 'r'); h.p(12, 11, 'q'); h.p(20, 11, 'q'); h.p(11, 7, 'r'); h.p(21, 7, 'r');
    h.star(3, 2, 'r', '8'); h.star(29, 2, 'r', '8');
  });

  // ---------------- RAROS ----------------
  J('racha', (h) => {
    h.halo(12, 20, 13, 'a');
    // cola de fuego
    h.shade(P([[6, 18], [16, 9], [24, 1], [31, 0], [27, 6], [31, 5], [26, 13], [30, 13], [21, 22], [16, 28]]), R.fire, { bias: -0.2, ol: '9' });
    h.fill(P([[11, 17], [19, 10], [27, 3], [23, 10], [27, 10], [18, 21]]), 'h');
    h.fill(P([[13, 18], [22, 9], [19, 15], [16, 21]]), 'i');
    // bola ardiente
    h.ball(11, 21, 7.5, { col: R.ember, num: 7 });
    [[3, 10], [6, 6], [28, 20], [24, 27], [30, 25], [9, 3]].forEach(([x, y], i) => h.p(x, y, i % 2 ? 'v' : 'h'));
  });

  J('cementerio', (h) => {
    h.halo(16, 14, 15, '3');
    // almas azules
    const wisp = (x, y) => { h.shade(U(C(x, y, 2.4), P([[x - 2.2, y - 0.5], [x + 1, y - 6], [x + 2.3, y - 0.5]])), ['p', 'q', 'r', '8'], { ol: 'o', ly: 1, lx: 0, bias: 0.5 }); h.p(x - 1, y, 'o'); h.p(x + 1, y, 'o'); };
    wisp(5, 11); wisp(27, 8);
    // lápida
    const stone = U(Rc(9, 12, 14, 16), C(16, 12, 7));
    h.shade(stone, R.ash, { bias: 0.2 });
    // cruz grabada
    h.fill(U(Rc(15, 8, 2, 12), Rc(12, 11, 8, 2)), '3');
    h.fill(U(Rc(17, 8, 1, 12), Rc(12, 13, 8, 1)), '7');
    h.p(15, 8, '1'); h.p(12, 11, '1');
    // grieta y musgo
    h.line(20, 15, 22, 18, '3'); h.line(22, 18, 21, 21, '3');
    h.p(10, 24, 'l'); h.p(11, 25, 'm'); h.p(10, 26, 'l'); h.p(21, 25, 'l');
    h.p(11, 7, '8'); h.p(10, 9, '8');
    // tierra
    h.shade(E(16, 30, 15, 3.5), R.woodD, { bias: 0.3 });
    // bolas enterradas
    h.ball(5, 28, 3.5, { col: R.red }); h.ball(27, 28, 3.5, { col: R.blue, stripe: true });
    h.fill(Rc(1, 30, 30, 2), 'e'); h.fill(Rc(1, 31, 30, 1), '9');
    [[3, 29], [8, 29], [13, 29], [19, 29], [24, 29], [29, 29]].forEach(([x, y]) => { h.p(x, y, 'm'); h.p(x + 1, y - 1, 'l'); });
  });
  J('doble_fondo', (h) => {
    h.halo(16, 9, 14, 's');
    // bolas saliendo de la chistera
    h.ball(11, 8, 5.5, { col: R.red, num: 1 });
    h.ball(22, 7, 5.5, { col: R.blue, stripe: true, num: 2 });
    h.star(16, 2, 'h', '8', 2); h.p(5, 4, 'i'); h.p(28, 13, 'i');
    // chistera invertida
    h.shade(U(P([[8, 17], [24, 17], [22.5, 28], [9.5, 28]]), E(16, 28, 6.5, 2)), ['2', '3', '4', '5'], { bias: 0.2 });
    h.fill(Rc(9, 19, 14, 2), 'b'); h.fill(Rc(9, 19, 14, 1), 'c');
    h.shade(E(16, 16, 12.5, 3.4), ['1', '2', '3', '5'], { bias: 0.4 });
    h.fill(E(16, 15.8, 8, 1.9), '0');
    h.p(9, 23, '4'); h.p(10, 25, '4');
    // x2
    h.txtO(23, 24, 'x2', 'c');
  });

  J('ojo_cuervo', (h) => {
    h.halo(14, 15, 15, 'o');
    // plumaje del cuello
    h.shade(P([[5, 15], [19, 20], [20, 31], [15, 28], [12, 31], [9, 27], [5, 30], [4, 24], [1, 26], [2, 19]]), R.purple, { bias: 0.3 });
    h.shade(C(12, 13, 8.5), R.purple, { bias: 0.4 });
    // pico
    h.shade(P([[18, 9], [30, 13], [31, 15], [27, 16], [19, 18]]), R.iron, { bias: 0.4 });
    h.line(20, 14, 28, 15, '1');
    // ojo
    h.fill(C(14, 11, 3.2), 'h');
    h.fill(C(14, 11, 2.2), 'r');
    h.fill(C(14.5, 11.5, 1.2), '0');
    h.p(13, 10, '8');
    h.p(9, 8, '4'); h.p(7, 11, '4'); h.p(8, 16, '3');
    // guía de trayectoria
    h.dash(19, 23, 30, 23, 'r', 1, 1);
    h.dash(30, 23, 24, 30, 'r', 1, 1);
    h.p(30, 23, '8');
    h.fill(D(C(23, 29.5, 2.5), C(23, 29.5, 1.5)), 'r');
  });

  J('ricochet', (h) => {
    // mini mesa
    h.shade(Rc(1, 4, 30, 24), R.woodD, { bias: 0.2 });
    h.fill(Rc(4, 7, 24, 18), 'k');
    h.fill(I(Rc(4, 7, 24, 18), (x, y) => (Math.floor(x) + Math.floor(y)) % 2 === 0), 'l');
    h.fill(Rc(4, 7, 24, 1), 'j'); h.fill(Rc(4, 7, 1, 18), 'j');
    // troneras
    [[3, 6], [28, 6], [3, 25], [28, 25], [15.5, 5.5], [15.5, 25.5]].forEach(([x, y]) => h.fill(C(x + 0.5, y + 0.5, 1.6), '0'));
    // trayectoria de 3 bandas
    h.line(6, 21, 10, 8, '8'); h.line(10, 8, 18, 24, '8'); h.line(18, 24, 27, 14, '8'); h.line(27, 14, 22, 10, '7');
    h.star(10, 8, 'h', 'i'); h.star(18, 24, 'h', 'i'); h.star(27, 14, 'h', 'i');
    h.sphere(21.5, 10.5, 2.5, R.bone, {});
    h.txtO(3, 0, '3', 'c'); h.txtO(26, 27, '3', 'c');
  });

  J('carronero', (h) => {
    h.halo(16, 15, 15, '9');
    // tronera con la blanca medio hundida (scratch)
    h.fill(E(16, 28, 12, 3.6), 'g'); h.ol(E(16, 28, 12, 3.6));
    h.fill(E(16, 28.3, 10.5, 2.6), '0');
    h.sphere(16, 25, 5.5, R.bone, {});
    h.fill(I(E(16, 29.5, 12, 2.4), (x, y) => y > 28.5), 'g');
    h.fill(I(E(16, 29.5, 12, 2.4), (x, y) => y > 30), 'e');
    // rata carroñera sentada sobre la bola
    h.shade(U(Cap(9, 18, 4, 21, 1.2, 0.9), Cap(4, 21, 2, 26, 0.9, 0.6)), ['a', 'b', 'c', 'd'], { bias: 0.3 });
    h.shade(E(13, 15, 6.5, 5), R.lilac, { bias: 0.3 });
    h.shade(U(E(19.5, 11.5, 4.5, 3.6), P([[21, 9], [27, 12], [21, 14.5]])), R.lilac, { bias: 0.4 });
    // oreja
    h.shade(C(17, 7.5, 2.6), R.lilac, {}); h.fill(C(17.2, 7.8, 1.3), 'c');
    // ojo, nariz, bigotes, dientes
    h.p(20, 10, '0'); h.p(21, 10, 'c'); h.p(20, 9, '8');
    h.p(27, 12, 'u'); h.p(26, 11, 'u');
    h.line(24, 10, 29, 8, '6'); h.line(24, 13, 29, 15, '6');
    h.p(24, 14, '8');
    // patitas con moneda
    h.coin(23, 17.5, 3);
    h.shade(E(19.5, 17, 1.6, 1.2), ['b', 'c', 'd', 'd'], {});
    h.p(12, 19, 'c'); h.p(15, 19, 'c');
    // botín
    h.coin(4, 12, 2.6); h.coin(28, 24, 2.6);
    h.star(28, 4, 'h', '8', 1);
  });
  J('martillo', (h) => {
    h.halo(19, 12, 14, '4');
    // mango de hueso
    h.shade(U(Cap(5, 27, 18, 14, 1.9), C(4.5, 27.5, 2.8)), R.bone, { bias: 0.3 });
    // atadura
    h.shade(Cap(15, 17, 18, 14, 2.4), R.blood, {});
    h.p(16, 15, 'c');
    // cabeza: hueso grueso
    h.shade(U(Cap(12, 7, 25, 20, 3.8), C(10.5, 5.5, 3.8), C(13.5, 3.5, 3.0), C(26.5, 21.5, 3.8), C(28.5, 18.5, 3.0)), R.bone, { bias: 0.2 });
    h.line(15, 9, 22, 16, '6'); h.p(13, 4, '8'); h.p(9, 4, '8');
    // grietas
    h.line(19, 12, 21, 11, '5'); h.p(22, 18, '5');
    // impacto
    h.star(4, 13, 'h', '8', 2); h.line(2, 9, 4, 10, 'i'); h.line(6, 17, 7, 19, 'i'); h.p(1, 14, 'i');
    h.txtO(23, 26, 'x3', 'c');
  });

  J('cuenta_atras', (h) => {
    h.halo(16, 16, 15, '3');
    const glass = U(E(16, 10.5, 6.5, 5.5), E(16, 21.5, 6.5, 5.5), Rc(15, 14, 2, 4));
    h.shade(glass, ['1', '2', '3', '6'], { bias: 0.2 });
    // arena roja
    h.fill(I(glass, (x, y) => y > 10 && y < 15.5), 'b');
    h.fill(I(glass, (x, y) => y > 10 && y < 11.5), 'c');
    h.fill(Rc(15.5, 15, 1, 9), 'c');
    h.fill(I(glass, E(16, 27, 6.5, 4.5)), 'b');
    h.fill(I(glass, E(16, 25.5, 2.5, 1.5)), 'c');
    // brillos del cristal
    h.p(12, 8, '8'); h.p(11, 9, 'r'); h.p(11, 10, 'r'); h.p(12, 19, '8'); h.p(11, 20, 'r'); h.p(11, 21, 'r');
    // estructura de latón
    h.shade(Rc(6, 2, 20, 3), R.gold, { bias: 0.3 }); h.shade(Rc(6, 27, 20, 3), R.gold, { bias: 0.3 });
    h.shade(Rc(7, 5, 2, 22), R.brass, {}); h.shade(Rc(23, 5, 2, 22), R.brass, {});
    h.p(16, 3, 'c'); h.p(16, 28, 'c');
    h.star(28, 9, 'h', '8');
  });

  J('vampiro', (h) => {
    h.halo(16, 14, 15, 'a', '9');
    // cuello de capa
    h.shade(P([[2, 31], [5, 12], [11, 23], [21, 23], [27, 12], [30, 31]]), R.blood, { bias: 0.3 });
    h.fill(P([[9, 31], [11, 24], [21, 24], [23, 31]]), '0');
    h.fill(P([[13, 31], [14, 26], [18, 26], [19, 31]]), '7');
    // orejas
    h.shade(P([[9, 12], [4, 8], [9, 17]]), R.flesh, {}); h.shade(P([[23, 12], [28, 8], [23, 17]]), R.flesh, {});
    // cara
    h.shade(U(E(16, 15, 7, 8.5), P([[10, 18], [22, 18], [16, 25]])), ['4', '5', '6', '7'], { bias: 0.5 });
    // pelo con pico de viuda
    h.shade(D(E(16, 9, 8.5, 6.5), P([[10, 16], [16, 9], [22, 16]])), ['0', '1', '2', '3'], { bias: 0.4 });
    h.fill(D(Rc(8, 9, 2, 6), E(16, 15, 7, 8.5)), '1');
    // ojos rojos
    h.rows(11, 13, ['000..000', '.0c..c0.', '..0..0..'].map((r) => r.replace(/\./g, '.')), {});
    h.p(12, 14, 'c'); h.p(19, 14, 'c'); h.p(13, 14, 'd'); h.p(18, 14, 'd');
    // nariz y boca con colmillos
    h.p(16, 17, '4'); h.p(15, 18, '4');
    h.fill(Rc(13, 20, 7, 1), '0');
    h.p(14, 21, '8'); h.p(18, 21, '8'); h.p(14, 22, '7'); h.p(18, 22, '7');
    h.p(18, 23, 'c'); h.p(18, 25, 'b');
    h.star(27, 4, 'c', '8');
  });

  J('ocho_maldito', (h) => {
    h.halo(16, 17, 15.5, 'b', 'a');
    // brasas
    [[3, 6], [28, 4], [5, 26], [29, 24], [2, 16], [30, 14]].forEach(([x, y], i) => h.p(x, y, i % 2 ? 'v' : 'd'));
    horns(h, 16, 10, 6, 10, R.bone);
    h.sphere(16, 19, 11, ['1', '2', '3', '5'], { spec: '7', rimC: 'a' });
    h.p(9, 13, '8'); h.p(10, 12, '6');
    // disco con el 8 rojo
    h.fill(C(15, 18, 5.2), '7'); h.fill(D(C(15, 18, 5.2), C(14.3, 17.3, 5)), '6');
    h.ol(C(15, 18, 5.2), '1');
    h.glyph(13, 15, OM.CARDS._lib.F3['B8'], 'b');
    h.p(14, 15, 'c'); h.p(13, 16, 'c'); h.p(13, 19, 'c');
    h.star(26, 8, 'c', '8', 1);
  });
  J('fantasma', (h) => {
    // tronera de la que emerge
    h.fill(E(16, 28.5, 9, 2.8), 'g'); h.fill(E(16, 28.5, 7.5, 2), '0'); h.ol(E(16, 28.5, 9, 2.8));
    // estela
    h.dash(10, 26, 11, 23, 'q', 1, 1); h.dash(22, 26, 21, 23, 'q', 1, 1); h.p(16, 26, 'r');
    const body = U(C(16, 12, 9), Rc(7, 12, 18, 10), C(9, 22, 2.2), C(14.5, 23, 2.3), C(20, 22, 2.2), C(24, 21, 1.7));
    h.halo(16, 13, 15, 'p');
    h.shade(body, ['q', 'r', '7', '8'], { ol: 'o', bias: 0.4 });
    h.fill(D(body, C(13, 9, 10.5)), 'r');
    // cara
    h.fill(E(12.5, 12, 1.7, 2.6), '1'); h.fill(E(19.5, 12, 1.7, 2.6), '1');
    h.p(12, 11, 'q'); h.p(19, 11, 'q');
    h.fill(E(16, 18, 1.6, 2), '1');
    h.p(9, 6, '8'); h.p(10, 5, '8');
    // fichas espectrales
    h.p(3, 8, 'r'); h.p(28, 5, 'r'); h.p(29, 15, 'q'); h.p(2, 18, 'q');
  });

  // ---------------- ÉPICOS ----------------
  J('avalancha', (h) => {
    h.halo(16, 16, 15, '9');
    [[1, 2, 7, 8], [3, 1, 11, 9], [0, 7, 4, 13]].forEach(([a, b, c, d]) => h.line(a, b, c, d, '5'));
    h.ball(9, 6, 4.5, { col: R.toxic, stripe: true });
    h.ball(19, 5, 4, { col: R.red });
    h.ball(27, 10, 4, { col: R.mag });
    h.ball(13, 15, 5, { col: R.blue, num: 2 });
    h.ball(24, 18, 5, { col: R.ember, stripe: true, num: 5 });
    h.ball(7, 24, 5.5, { col: R.gold, num: 1 });
    h.ball(18, 26, 5.5, { col: R.red, stripe: true, num: 3 });
    h.sphere(28, 27, 3.5, ['1', '2', '3', '5'], { spec: '7' });
    h.star(4, 15, 'h', '8'); h.star(30, 3, 'h', '8');
  });

  J('eco', (h) => {
    // ondas de eco
    h.fill(D(C(13, 18, 14), C(13, 18, 13)), 'p');
    h.fill(D(C(13, 18, 11), C(13, 18, 10)), 'q');
    ghostify(h, 0, 0, 32, 32);
    // copia fantasma
    h.ball(21, 11, 6.5, { col: ['o', 'p', 'q', 'r'], num: 1, ol: 'o' });
    ghostify(h, 13, 3, 16, 16);
    h.ball(13, 19, 7.5, { col: R.mag, num: 1 });
    h.fill(D(Arc(13, 19, 9.5, 10.5, -1.4, 0.2), C(21, 11, 7.5)), 'r');
    h.star(28, 25, 'r', '8'); h.star(3, 5, 'r', '8');
    h.txtO(23, 25, 'x2', 'u');
  });

  J('calavera_dorada', (h) => {
    h.halo(16, 15, 15.5, 'g', 'e');
    h.skull(16, 15, 1.55, R.gold, { eye: '9' });
    // ojos de rubí
    h.fill(C(11.5, 17, 1.6), 'b'); h.fill(C(20.5, 17, 1.6), 'b');
    h.p(11, 16, '8'); h.p(20, 16, '8'); h.p(12, 18, 'a'); h.p(21, 18, 'a');
    // grieta
    h.line(18, 5, 20, 9, 'e'); h.line(20, 9, 19, 11, 'e');
    h.p(9, 6, '8'); h.p(8, 7, 'i'); h.p(10, 5, 'i');
    h.star(27, 4, 'i', '8', 2); h.star(4, 26, 'h', '8', 1);
    h.coin(28, 27, 3);
  });

  J('espejo_roto', (h) => {
    h.halo(16, 16, 15, 's');
    const outer = U(E(16, 17, 11, 13.5), C(16, 3, 3));
    h.shade(outer, R.gold, { bias: 0.3 });
    h.fill(C(16, 3, 1.3), 'c');
    const glass = E(16, 17, 8, 10.5);
    h.fill(D(E(16, 17, 9, 11.5), glass), 'e');
    h.shade(glass, ['o', 'p', 'q', 'r'], { ol: false, bias: 0.2 });
    // reflejo: flecha a la derecha
    h.rows(10, 15, ['....00..', '....0h0.', '0000hhh0', '0hhhhhhh0'.slice(0, 8) + '0', '0000hhh0', '....0h0.', '....00..'].map((r) => r), {});
    h.p(11, 18, 'i');
    // grietas
    const cr = [[19, 12], [23, 8], [19, 12], [24, 15], [19, 12], [15, 7], [19, 12], [12, 22], [19, 12], [22, 26], [12, 22], [9, 19]];
    for (let i = 0; i < cr.length; i += 2) h.line(cr[i][0], cr[i][1], cr[i + 1][0], cr[i + 1][1], '8');
    h.line(20, 13, 23, 25, 'o'); h.line(13, 22, 10, 26, 'o');
    h.p(19, 12, '0');
    // esquirlas
    h.shade(P([[27, 25], [30, 27], [28, 30]]), R.ice, {}); h.shade(P([[3, 27], [6, 28], [4, 31]]), R.ice, {});
    h.star(6, 6, 'r', '8');
  });

  J('parca', (h) => {
    h.halo(16, 15, 15, '9');
    // mango de guadaña
    h.shade(Cap(25, 31, 23, 3, 1.3), R.woodD, { bias: 0.4 });
    // túnica
    h.shade(P([[6, 31], [9, 15], [16, 7], [23, 15], [26, 31]]), R.purple, { bias: 0.4 });
    h.line(12, 22, 10, 30, '1'); h.line(19, 22, 21, 30, '1'); h.line(11, 16, 9, 24, '4');
    // capucha y rostro
    h.fill(E(16, 15.5, 4.6, 5.5), '0');
    h.shade(E(16, 16, 3.2, 3.8), R.bone, { ol: false, bias: 0.3 });
    h.p(15, 15, '0'); h.p(17, 15, '0'); h.p(15, 16, 'c'); h.p(17, 16, 'c');
    h.p(16, 18, '0'); h.p(15, 19, '5'); h.p(17, 19, '5');
    // mano huesuda
    h.shade(E(23.5, 19, 2, 1.8), R.bone, {});
    // hoja curva grande
    const blade = I(D(C(15, 15, 13), C(17, 18.5, 12.5)), (x, y) => x < 24 && y < 13);
    h.shade(blade, R.steel, { bias: 0.4 });
    h.fill(I(D(C(15, 15, 13), C(15.6, 15.8, 12.8)), (x, y) => x < 24 && y < 12), '8');
    h.shade(Rc(21, 2, 4, 4), R.iron, {});
    h.p(4, 11, 'b'); h.p(3, 12, 'a');
    h.txtO(1, 25, 'x3', 'c');
  });
  // ---------------- LEGENDARIOS ----------------
  J('diablo', (h) => {
    h.halo(16, 16, 15.5, 'a', '9');
    // cuernos dorados
    h.shade(U(Cap(10, 9, 5, 6, 2.8, 2.2), Cap(5, 6, 3, 0.5, 2.2, 0.5)), R.gold, { bias: 0.2 });
    h.shade(U(Cap(22, 9, 27, 6, 2.8, 2.2), Cap(27, 6, 29, 0.5, 2.2, 0.5)), R.gold, { bias: 0.2 });
    // orejas
    h.shade(P([[8, 14], [2, 12], [8, 19]]), R.red, {}); h.shade(P([[24, 14], [30, 12], [24, 19]]), R.red, {});
    // cabeza
    h.shade(U(E(16, 16, 8.5, 9), P([[8.5, 18], [23.5, 18], [16, 29]])), R.red, { bias: 0.4 });
    // cejas y ojos
    h.rows(9, 12, ['00.......000'.slice(0, 11) + '0', '.000...0000'.slice(0, 11), '..0hh.hh0..'.padEnd(12, '.'), '..0h0.0h0..'.padEnd(12, '.')].map((r) => r), {});
    h.p(9, 12, '0'); h.p(22, 12, '0'); h.p(10, 13, '0'); h.p(21, 13, '0');
    h.p(12, 14, 'i'); h.p(18, 14, 'h'); h.p(19, 14, 'i');
    // nariz
    h.p(15, 18, '9'); h.p(17, 18, '9');
    // sonrisa con colmillos
    h.rows(10, 20, ['0..........0', '.0000000000.', '.0i0000000i0'.slice(0, 12), '..0i0000i0..', '...000000...'].map((r) => r), {});
    h.fill(Rc(13, 22, 6, 1), 'a');
    // perilla
    h.shade(P([[14, 25], [18, 25], [16, 31]]), ['0', '1', '2', '3'], {});
    h.coin(4, 27, 3); h.coin(28, 26, 3);
    h.star(16, 3, 'i', '8', 2);
  });

  J('ojo_abismo', (h) => {
    // corona de púas abisales (estrella sólida)
    h.halo(16, 16, 15.5, 's', '2');
    const star = [];
    for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2 - Math.PI / 2, L = k % 2 ? 10.5 : (k % 4 ? 13.5 : 15.5); star.push([16 + Math.cos(a) * L, 16 + Math.sin(a) * L]); }
    h.shade(P(star), ['2', 's', 't', 'u'], { bias: 0.3 });
    h.shade(P(star.map(([x, y]) => [16 + (x - 16) * 0.78, 16 + (y - 16) * 0.78])), ['s', 't', 'u', '8'], { ol: false, bias: 0.4 });
    // párpados
    const lid = P([[3, 16], [8, 9.5], [16, 7.5], [24, 9.5], [29, 16], [24, 22.5], [16, 24.5], [8, 22.5]]);
    h.shade(lid, R.violet, { bias: 0.2 });
    const scl = E(16, 16, 10.5, 6.6);
    h.shade(scl, ['6', '7', '7', '8'], { ol: '0', bias: 0.3 });
    // venas
    h.line(6, 15, 9, 14, 'b'); h.line(6, 17, 8, 18, 'b'); h.line(26, 15, 23, 13, 'b'); h.line(25, 18, 23, 19, 'b'); h.p(7, 13, 'a'); h.p(25, 20, 'a');
    // iris holo concéntrico
    const cols = ['u', 't', 'q', 'r', 'm', 'h', 'v'];
    for (let y = 8; y < 25; y++) for (let x = 8; x < 25; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
      if (d > 6.2 || !scl(x + 0.5, y + 0.5)) continue;
      h.p(x, y, cols[Math.floor(d * 1.05) % cols.length]);
    }
    h.ol(I(C(16, 16, 6.2), scl), '0');
    h.fill(E(16, 16, 1.4, 4.4), '0');
    h.fill(D(I(scl, (x, y) => y < 11), C(16, 16, 6.2)), '6');
    h.p(13, 12, '8'); h.p(12, 13, '8'); h.p(14, 12, '8'); h.p(19, 20, '7');
    // pestañas
    [[10, 9, 9, 7], [13, 8, 13, 6], [19, 8, 19, 6], [22, 9, 23, 7]].forEach(([a, b, c, d]) => h.line(a, b, c, d, '0'));
  });
  // ======================================================================
  // CONSUMIBLES 24x24
  // ======================================================================
  IT('tiza', (h) => {
    const top = P([[12, 4], [21, 8], [12, 12], [3, 8]]);
    const left = P([[3, 8], [12, 12], [12, 21], [3, 17]]);
    const right = P([[12, 12], [21, 8], [21, 17], [12, 21]]);
    h.ol(U(top, left, right));
    h.fill(left, 'q'); h.fill(right, 'p'); h.fill(top, 'r');
    h.line(4, 8, 11, 11, '8'); h.line(12, 13, 12, 20, 'o');
    h.fill(E(12, 8, 4, 1.8), 'p'); h.fill(D(E(12, 8, 4, 1.8), E(12.6, 7.4, 4, 1.8)), 'r');
    [[5, 12], [8, 15], [16, 14], [18, 12]].forEach(([x, y], i) => h.p(x, y, i < 2 ? 'r' : 'o'));
    h.txtO(15, 1, '+1', '8');
    h.p(4, 3, 'r'); h.p(7, 1, 'q');
  });

  IT('mano', (h) => {
    h.sphere(12, 5, 4.5, R.bone, {});
    h.star(19, 3, 'i', '8');
    h.p(4, 3, '8');
    // dedos (falanges separadas)
    const fing = [[7, 15, 6, 10], [10, 14, 9.5, 9], [13.5, 14, 14, 9], [16.5, 15, 18, 10.5], [6.5, 18, 3, 14.5]];
    fing.forEach(([x0, y0, x1, y1]) => h.shade(Cap(x0, y0, x1, y1, 1.15, 0.9), R.bone, { bias: 0.4 }));
    // palma y muñeca
    h.shade(U(P([[6, 15], [18, 15], [16, 20], [8, 20]]), Rc(9, 20, 6, 4)), R.bone, { bias: 0.3 });
    // articulaciones
    fing.forEach(([x0, y0, x1, y1]) => h.p(Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2), '5'));
    h.p(9, 17, '5'); h.p(12, 17, '5'); h.p(15, 17, '5');
    h.line(11, 20, 11, 23, '5'); h.line(13, 20, 13, 23, '5');
    // destellos de colocar
    h.dash(3, 6, 3, 9, 'r', 1, 1); h.dash(21, 6, 21, 9, 'r', 1, 1);
  });
  IT('rueda', (h) => {
    h.shade(D(C(12, 12, 10.5), C(12, 12, 7.5)), R.gold, { bias: 0.3 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      h.line(12, 12, Math.round(12 + Math.cos(a) * 7), Math.round(12 + Math.sin(a) * 7), 'f');
    }
    // bolas en el aro
    h.ball(12, 2.5, 2.6, { col: R.red }); h.ball(20.5, 17, 2.6, { col: R.blue, stripe: true }); h.ball(3.5, 17, 2.6, { col: R.toxic });
    // buje con triángulo
    h.shade(C(12, 12, 3.2), R.blood, {});
    h.p(12, 11, 'h'); h.p(11, 12, 'h'); h.p(13, 12, 'h');
    h.dash(19, 2, 22, 5, 'i', 1, 1); h.dash(2, 5, 4, 2, 'i', 1, 1);
  });

  IT('ojo', (h) => {
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.42; h.dash(12 + Math.round(Math.cos(a) * 9), 12 + Math.round(Math.sin(a) * 9), 12 + Math.round(Math.cos(a) * 12), 12 + Math.round(Math.sin(a) * 12), 'h', 1, 1); }
    const tri = P([[12, 2], [23, 21], [1, 21]]);
    h.shade(tri, R.gold, { bias: 0.3 });
    h.fill(P([[12, 6], [19.5, 19], [4.5, 19]]), '1');
    h.fill(E(12, 14, 5, 2.8), '7'); h.fill(I(E(12, 14, 5, 2.8), (x, y) => y < 13), '6');
    h.fill(C(12, 14, 2.3), 'q'); h.fill(C(12, 14, 1.2), '0'); h.p(11, 13, '8');
    h.ol(E(12, 14, 5, 2.8), '0');
  });

  IT('ermitano', (h) => {
    h.halo(12, 14, 11, 'e', 'g');
    // asa
    h.fill(D(C(12, 4, 3.5), C(12, 4, 2.2), Rc(0, 4, 24, 20)), 'g'); h.ol(D(C(12, 4, 3.5), C(12, 4, 2.2), Rc(0, 4, 24, 20)));
    h.shade(P([[8, 8], [16, 8], [18, 10], [6, 10]]), R.brass, {});
    h.shade(Rc(6, 10, 12, 10), ['2', '3', '6', '8'], { bias: 0 });
    // moneda luminosa
    h.coin(12, 15, 3.5);
    h.star(12, 15, 'i', '8', 0);
    // barrotes
    h.fill(Rc(6, 10, 1, 10), 'f'); h.fill(Rc(17, 10, 1, 10), 'f'); h.fill(Rc(12, 10, 1, 2), 'f');
    h.shade(Rc(5, 20, 14, 3), R.brass, {});
    h.p(7, 11, '8'); h.p(7, 12, '8');
    h.txtO(17, 0, 'x2', 'h');
  });

  IT('alquimista', (h) => {
    const flask = U(C(12, 16, 7), Rc(10, 4, 4, 8));
    h.shade(flask, ['2', '3', '5', '7'], { bias: 0.2 });
    h.fill(I(C(12, 16, 7), (x, y) => y > 14), 'h');
    h.fill(I(C(12, 16, 7), (x, y) => y > 14 && y < 16), 'i');
    h.fill(I(C(12, 16, 7), (x, y) => y > 20), 'g');
    h.p(10, 18, 'i'); h.p(14, 19, '8'); h.p(12, 13, 'i'); h.p(13, 10, 'i');
    h.p(8, 12, '8'); h.p(7, 13, '7'); h.p(10, 6, '7');
    h.shade(Rc(9.5, 1, 5, 3), R.wood, {});
    h.coin(20, 6, 2.6); h.star(4, 6, 'h', '8'); h.p(19, 13, 'i');
  });

  IT('juicio', (h) => {
    // rayos de luz
    [[12, 1, 12, 0], [5, 4, 4, 3], [19, 4, 20, 3], [2, 10, 1, 10], [22, 10, 23, 10]].forEach(([a, b, c, d]) => h.line(a, b, c, d, 'i'));
    h.halo(12, 9, 8, 'g');
    // carta que resucita
    h.shade(Rc(8, 3, 8, 12), ['5', '6', '7', '8'], { bias: 0.4 });
    h.fill(Rc(9, 4, 6, 1), 'c'); h.fill(Rc(9, 13, 6, 1), 'q');
    h.glyph(10, 6, OM.CARDS._lib.F3['?'], 'b');
    // ataúd abierto
    h.shade(P([[1, 16], [4, 13], [20, 13], [23, 16], [20, 21], [4, 21]]), R.woodD, { bias: 0.2 });
    h.fill(P([[4, 15], [6, 14], [18, 14], [20, 15], [18, 17], [6, 17]]), '0');
    h.fill(Rc(8, 14, 8, 1), 'g');
    // tapa desplazada
    h.shade(P([[14, 20], [17, 18], [23, 19], [23, 23], [15, 23]]), R.wood, {});
    h.fill(U(Rc(19, 19, 1, 4), Rc(18, 20, 3, 1)), 'h');
  });
  // grabados: sello de cera + símbolo
  function seal(h, ramp, sym) {
    const base = U(C(12, 12, 9), ...Array.from({ length: 12 }, (_, k) => C(12 + Math.cos((k / 12) * Math.PI * 2) * 9, 12 + Math.sin((k / 12) * Math.PI * 2) * 9, 1.7)));
    h.shade(base, ramp, { bias: 0.2 });
    h.fill(D(C(12, 12, 7), C(12, 12, 6)), ramp[0]);
    h.fill(D(C(12.5, 12.5, 7), C(12.5, 12.5, 6.2), C(12, 12, 6)), ramp[3]);
    if (sym) sym();
  }
  IT('g_oro', (h) => seal(h, R.gold, () => {
    h.glyphO(10, 9, OM.CARDS._lib.F3['S$'], 'i', 'e');
    h.star(19, 4, 'i', '8');
  }));
  IT('g_cristal', (h) => seal(h, R.ice, () => {
    h.shade(P([[12, 6], [17, 11], [12, 18], [7, 11]]), ['p', 'q', 'r', '8'], { ol: 'o' });
    h.line(7, 11, 17, 11, 'p'); h.line(12, 6, 10, 11, '8'); h.line(12, 6, 14, 11, 'q');
    h.line(18, 15, 21, 19, '8'); h.line(4, 7, 6, 9, '8');
    h.star(5, 4, 'r', '8');
  }));
  IT('g_plomo', (h) => seal(h, R.lead, () => {
    h.shade(P([[9, 9], [15, 9], [17, 17], [7, 17]]), ['0', '1', '3', '4'], {});
    h.fill(D(C(12, 8, 2), C(12, 8, 1)), '0');
    h.txt(10, 11, '50'.slice(0, 1), '6'); h.txt(13, 11, '0', '6');
  }));
  IT('g_fuego', (h) => seal(h, R.ember, () => {
    h.flame(12, 17, 3.5, 11, ['9', 'v', 'h', 'i']);
    h.p(4, 3, 'v'); h.p(20, 2, 'h');
  }));
  IT('g_holo', (h) => {
    seal(h, R.mag, null);
    const cols = ['u', 'h', 'm', 'r', 'q', 't'];
    for (let y = 2; y < 22; y++) for (let x = 2; x < 22; x++) {
      if (Math.hypot(x + 0.5 - 12, y + 0.5 - 12) > 6.5) continue;
      h.p(x, y, cols[Math.floor((x + y) / 3) % cols.length]);
    }
    h.rows(8, 8, ['...0...', '..080..', '0008000', '.08880.', '..080..', '.0.0.0.', '0.....0'].map((r) => r), {});
    h.p(4, 5, '8'); h.p(19, 4, 'r');
  });
  IT('g_bomba', (h) => seal(h, R.blood, () => {
    h.sphere(11.5, 13.5, 4.5, ['0', '1', '2', '4'], { spec: '6' });
    h.shade(Rc(12, 7, 3, 2), R.steel, {});
    h.line(15, 7, 17, 5, 'g'); h.line(17, 5, 18, 5, 'f');
    h.star(19, 4, 'h', '8', 1); h.p(21, 2, 'v');
  }));

  // lunas
  function moon(h, ramp, opt) {
    opt = opt || {};
    const m = C(12, 12, 9.5);
    h.sphere(12, 12, 9.5, ramp, { spec: false });
    // cráteres
    [[9, 9, 1.8], [15, 15, 2.4], [8, 16, 1.4], [15, 7, 1.2]].forEach(([x, y, r]) => {
      h.fill(C(x, y, r), ramp[0]); h.fill(D(C(x, y, r), C(x - 0.7, y - 0.7, r)), ramp[2]);
    });
    // sombra creciente
    const sh = I(m, C(17.5, 9, 8.5));
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (sh(x + 0.5, y + 0.5)) {
      const edge = !C(17.5, 9, 7.6)(x + 0.5, y + 0.5);
      h.p(x, y, edge ? ((x + y) % 2 ? opt.dark || '1' : ramp[0]) : (opt.dark || '1'));
    }
    if (opt.fx) opt.fx();
  }
  IT('luna_simple', (h) => moon(h, R.ash, { fx: () => { [[3, 3], [20, 20], [21, 4], [2, 19], [6, 22]].forEach(([x, y]) => h.p(x, y, '6')); h.p(22, 12, '5'); } }));
  IT('luna_doblete', (h) => moon(h, R.red, { dark: '9', fx: () => { h.drop(9, 22.5, 1.4, R.blood); h.drop(14, 23, 1, R.blood); h.p(3, 4, 'c'); h.star(21, 3, 'c', '8'); } }));
  IT('luna_triplete', (h) => moon(h, R.blue, { dark: 'o', fx: () => {
    h.fill(Rc(1, 19, 22, 5), 'p'); h.fill(Rc(1, 21, 22, 3), 'o');
    for (let x = 1; x < 23; x++) h.p(x, 19 + (Math.floor(x / 3) % 2), 'r');
    h.p(5, 14, 'r'); h.p(19, 5, 'r'); h.p(20, 3, '8'); h.p(4, 9, 'q');
  } }));
  IT('luna_masacre', (h) => moon(h, R.toxic, { dark: 'j', fx: () => {
    [[7, 12], [12, 16], [10, 7], [6, 18]].forEach(([x, y]) => { h.p(x, y, 'e'); h.p(x + 1, y, 'f'); });
    h.fill(Rc(9, 20, 1, 3), 'm'); h.fill(Rc(13, 21, 1, 2), 'm'); h.p(9, 23, 'n');
    h.rows(17, 2, ['.77.', '7..7', '...7'], {});
  } }));
  IT('luna_limpia', (h) => {
    h.halo(12, 12, 11.5, 't', 's');
    h.fill(C(12, 12, 9.5), 't'); h.fill(C(12, 12, 8.5), '0');
    h.fill(D(C(12, 12, 9.5), C(13, 13, 9)), 'u');
    h.ol(C(12, 12, 9.5), '0');
    [[9, 9], [14, 14], [11, 15], [15, 8]].forEach(([x, y]) => h.p(x, y, '4'));
    h.p(12, 11, '8');
    h.star(3, 3, 'u', '8'); h.star(21, 20, 't', '8');
  });

  // ======================================================================
  // JEFES 32x32
  // ======================================================================
  B('sepulturero', (h) => {
    // pala
    h.shade(Cap(27, 2, 10, 22, 1.2), R.woodD, {});
    h.shade(P([[2, 25], [8, 20], [12, 24], [6, 30], [2, 30]]), R.iron, { bias: 0.3 });
    h.shade(Cap(27, 2, 30, 1, 1.4), R.woodD, {});
    // calavera
    h.skull(16, 18, 1.15, R.bone, { glow: 'm' });
    // chistera
    h.shade(Rc(9, 1, 14, 9), ['0', '1', '2', '3'], { bias: 0.3 });
    h.fill(Rc(9, 7, 14, 2), 'a'); h.fill(Rc(9, 7, 14, 1), 'b');
    h.shade(E(16, 10.5, 11, 1.8), ['0', '1', '2', '4'], {});
    h.p(10, 2, '4'); h.p(10, 3, '3');
  });

  B('niebla', (h) => {
    // figura encapuchada
    h.shade(U(E(16, 14, 9, 11), P([[7, 17], [25, 17], [28, 31], [4, 31]])), ['0', '1', '2', '3'], { bias: 0.3 });
    h.fill(E(16, 12.5, 5.5, 6), '0');
    h.p(13, 12, 'r'); h.p(14, 12, '8'); h.p(18, 12, '8'); h.p(19, 12, 'r');
    h.p(13, 13, 'q'); h.p(19, 13, 'q');
    // niebla lateral (fondo)
    const back = U(C(3, 12, 3), C(7, 13, 2.5), C(28, 9, 3), C(25, 10, 2.2), C(2, 20, 2.5), C(30, 19, 3));
    h.shade(back, ['3', '4', '4', '5'], { ol: false, bias: 0.3 });
    // niebla delantera en cúmulos
    const front = U(C(3, 26, 4), C(9, 23.5, 4.5), C(16, 25, 5), C(23, 23, 4.5), C(29, 25, 4), Rc(0, 26, 32, 6));
    h.shade(front, ['4', '5', '6', '7'], { ol: false, bias: 0.4, reach: 6 });
    // jirones
    for (let x = 0; x < 32; x++) { if ((x * 7) % 5 < 2) h.p(x, 31, '5'); }
    [[11, 19], [21, 18], [5, 17], [27, 16]].forEach(([x, y]) => { h.p(x, y, '5'); h.p(x + 1, y, '6'); h.p(x + 2, y, '5'); });
  });
  B('gloton', (h) => {
    const face = U(E(16, 17, 14, 13), E(16, 26, 11, 5));
    h.shade(face, R.toxic, { bias: 0.3 });
    // papada
    h.line(7, 27, 12, 29, 'k'); h.line(25, 27, 20, 29, 'k');
    // ojitos
    h.rows(8, 9, ['00...........00'.slice(0, 16), '.0h0.......0h0.'], {});
    h.p(9, 10, 'h'); h.p(22, 10, 'h');
    h.fill(E(16, 6, 4, 1), 'n');
    // boca enorme
    h.fill(E(16, 19, 9, 6.5), '0');
    h.fill(E(16, 21, 7.5, 4.5), '9');
    for (let x = 9; x < 24; x += 3) { h.p(x, 13, '7'); h.p(x + 1, 13, '7'); h.p(x, 14, '7'); }
    for (let x = 10; x < 23; x += 3) { h.p(x, 24, '7'); h.p(x + 1, 24, '7'); h.p(x, 23, '7'); }
    // bola devorada
    h.ball(16, 19, 3.5, { col: R.blue, stripe: true });
    // babas
    h.fill(Rc(22, 24, 1, 5), 'n'); h.p(22, 29, 'm');
  });

  B('sanguijuela', (h) => {
    const pts = [[6, 28], [9, 25], [12, 23], [14, 20], [15, 17], [17, 14], [20, 12]];
    const rs = [2.2, 3.2, 4, 4.6, 5, 5.2, 5.5];
    let body = C(pts[0][0], pts[0][1], rs[0]);
    for (let i = 0; i < pts.length - 1; i++) body = U(body, Cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rs[i], rs[i + 1]));
    h.shade(body, R.blood, { bias: 0.2 });
    for (let i = 1; i < pts.length - 1; i++) h.line(pts[i][0] - 3, pts[i][1] - 2, pts[i][0] + 2, pts[i][1] + 3, '9');
    // ventosa
    h.shade(C(22, 10, 6.5), R.red, { bias: 0.3 });
    h.fill(C(22.5, 10.5, 4.2), '0');
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; h.p(Math.round(22 + Math.cos(a) * 3.3), Math.round(10 + Math.sin(a) * 3.3), '7'); }
    h.fill(C(22.5, 10.5, 1.6), 'a');
    // moneda absorbida y gotas
    h.coin(27, 22, 3.2);
    h.drop(25, 29, 1.4, R.red);
    h.p(5, 23, 'c'); h.p(10, 20, 'c');
  });

  B('pendulo', (h) => {
    // fantasmas del vaivén
    h.fill(I(D(C(7, 16, 9), C(7, 11.5, 9)), (x, y) => y > 18), '4');
    h.fill(I(D(C(25, 16, 9), C(25, 11.5, 9)), (x, y) => y > 18), '4');
    ghostify(h, 0, 0, 32, 32);
    h.dash(4, 13, 6, 18, '5', 1, 1); h.dash(28, 13, 26, 18, '5', 1, 1);
    // eje
    h.shade(C(16, 3, 2.6), R.gold, {});
    h.shade(Rc(15, 4, 2, 15), R.brass, {});
    // cuchilla creciente
    const blade = I(D(C(16, 15, 12), C(16, 9.5, 12)), (x, y) => y > 17);
    h.shade(blade, R.steel, { bias: 0.2 });
    h.fill(I(D(C(16, 15, 12), C(16, 14, 12)), (x, y) => y > 18), '8');
    h.shade(Rc(13, 16, 6, 4), R.gold, {});
    h.p(16, 18, 'c');
    // sangre en la hoja
    h.p(7, 22, 'b'); h.p(6, 21, 'b'); h.p(8, 23, 'a'); h.p(25, 23, 'b'); h.fill(Rc(6, 22, 1, 4), 'b'); h.p(6, 26, 'c');
  });
  B('verdugo', (h) => {
    // hacha
    h.shade(Cap(27, 30, 25, 5, 1.2), R.woodD, {});
    h.shade(P([[24, 3], [31, 1], [31, 14], [24, 11]]), R.steel, { bias: 0.3 });
    h.fill(Rc(30, 2, 1, 12), '8');
    h.p(30, 10, 'b'); h.p(30, 11, 'b'); h.p(29, 12, 'a');
    // capucha
    h.shade(P([[4, 31], [6, 10], [10, 4], [16, 2], [22, 4], [25, 10], [27, 31]]), ['1', '2', '9', 'a'], { bias: 0.3 });
    h.fill(E(11.5, 14, 2.6, 1.8), '0'); h.fill(E(20.5, 14, 2.6, 1.8), '0');
    h.p(11, 14, 'c'); h.p(12, 14, 'd'); h.p(20, 14, 'c'); h.p(21, 14, 'd');
    // costuras
    h.dash(16, 3, 16, 10, '9', 1, 1);
    h.dash(11, 20, 21, 20, '0', 1, 1);
    h.line(9, 9, 13, 11, '0'); h.line(23, 9, 19, 11, '0');
  });

  B('cienaga', (h) => {
    // juncos
    [[4, 31, 3, 6], [7, 31, 8, 10], [27, 31, 28, 5]].forEach(([a, b, c, d]) => h.line(a, b, c, d, 'k'));
    h.shade(Rc(2, 5, 2, 4), R.wood, {}); h.shade(Rc(27, 4, 2, 4), R.wood, {});
    // calavera medio hundida
    h.skull(16, 15, 1.3, ['l', '5', '6', '7'], { glow: 'n' });
    // ciénaga
    const mud = (x, y) => y > 19 + Math.sin(x * 0.7) * 0.8;
    h.fill(I(Rc(0, 0, 32, 32), mud, E(16, 25, 16, 8)), 'k');
    h.fill(I(Rc(0, 0, 32, 32), (x, y) => y > 23, E(16, 25, 16, 8)), 'j');
    for (let x = 1; x < 31; x++) if (mud(x + 0.5, 20.5) && !mud(x + 0.5, 19.5)) h.p(x, 20, 'm');
    h.ol(I(Rc(0, 0, 32, 32), mud, E(16, 25, 16, 8)), '0');
    h.line(6, 23, 10, 23, 'l'); h.line(20, 25, 26, 25, 'l');
    // limo y burbujas
    h.fill(Rc(10, 12, 1, 6), 'm'); h.p(10, 18, 'n'); h.fill(Rc(21, 8, 1, 3), 'm');
    h.fill(D(C(25, 17, 1.6), C(25, 17, 0.7)), 'n'); h.p(5, 17, 'n'); h.p(28, 14, 'm');
  });

  B('escarcha', (h) => {
    h.skull(16, 14, 1.35, R.ice, { glow: '8', ol: 'o' });
    // carámbanos
    [[9, 22, 4], [12, 23, 6], [15, 23, 4], [18, 23, 7], [21, 22, 4]].forEach(([x, y, l]) => {
      h.shade(P([[x - 1, y], [x + 2, y], [x + 0.5, y + l]]), R.ice, { ol: 'o' });
    });
    // escarcha en el cráneo
    h.p(10, 4, '8'); h.p(11, 5, '8'); h.p(13, 3, '8');
    // copos
    [[3, 6], [28, 8], [4, 25], [28, 26]].forEach(([x, y]) => { h.star(x, y, 'r', '8', 1); h.p(x - 1, y - 1, 'q'); h.p(x + 1, y + 1, 'q'); h.p(x + 1, y - 1, 'q'); h.p(x - 1, y + 1, 'q'); });
  });

  B('coleccionista', (h) => {
    const jar = U(Rc(6, 8, 20, 18), E(16, 26, 10, 4));
    h.shade(jar, ['2', '3', '4', '6'], { bias: 0.1 });
    // bolas rayadas coleccionadas
    h.ball(11, 14, 4, { col: R.blue, stripe: true });
    h.ball(21, 14.5, 4, { col: R.ember, stripe: true });
    h.ball(16, 21, 4.3, { col: R.toxic, stripe: true });
    // brillo del cristal
    h.fill(Rc(7, 10, 1, 15), '6'); h.fill(Rc(8, 11, 1, 4), '8');
    h.fill(Rc(24, 10, 1, 14), '4');
    // tapa
    h.shade(Rc(5, 4, 22, 5), R.gold, { bias: 0.3 });
    h.fill(Rc(5, 6, 22, 1), 'e');
    // etiqueta con ojo
    h.shade(Rc(10, 25, 12, 5), R.bone, {});
    h.fill(E(16, 27.5, 3, 1.4), '0'); h.p(16, 27, 'c'); h.p(17, 27, 'c'); h.p(16, 28, 'b');
    // mano del coleccionista sobre la tapa
    h.shade(U(Cap(20, 3, 28, 1, 1), Cap(22, 3, 24, 6, 0.8), Cap(25, 3, 27, 6, 0.8)), R.bone, {});
  });
  B('boca', (h) => {
    h.halo(16, 16, 16, 'a', '9');
    h.shade(E(16, 16, 15, 12), R.red, { bias: 0.3 });
    h.fill(E(16, 16.5, 12, 8.5), '0');
    h.fill(E(16, 20, 9, 4.5), '9');
    // garganta con la 8
    h.sphere(16, 17, 2.6, ['1', '2', '3', '5'], { spec: '7', ol: false });
    h.p(16, 16, 'b');
    // lengua
    h.shade(E(16, 23, 7, 2.6), ['a', 'b', 'u', 'u'], { ol: false });
    h.p(16, 22, 'a');
    // colmillos
    for (let k = 0; k < 7; k++) {
      const x = 6 + k * 3.3, top = 8.5 + Math.abs(k - 3) * 0.6;
      h.shade(P([[x - 1.4, top], [x + 1.6, top], [x + 0.1, top + 4.5 - Math.abs(k - 3) * 0.4]]), R.bone, { ol: '0' });
    }
    for (let k = 0; k < 6; k++) {
      const x = 8 + k * 3.3, bot = 24.5 - Math.abs(k - 2.5) * 0.6;
      h.shade(P([[x - 1.4, bot], [x + 1.6, bot], [x + 0.1, bot - 4 + Math.abs(k - 2.5) * 0.3]]), R.bone, { ol: '0' });
    }
    h.p(6, 6, 'd'); h.p(8, 5, 'd');
    h.fill(Rc(23, 26, 1, 4), 'c'); h.p(23, 30, 'b');
  });

  // ======================================================================
  // TACOS 24x24 (diagonal)
  // ======================================================================
  CU('peregrino', (h) => {
    h.diag(23, [
      { t0: -19, t1: -9, w: 4, ramp: ['f', 'e', 'e', '9'] },
      { t0: -8, t1: -7, w: 4, ramp: ['i', 'h', 'g', 'e'] },
      { t0: -6, t1: 13, w: 3, ramp: ['h', 'g', 'f'] },
      { t0: 14, t1: 16, w: 2, ramp: ['8', '7'] },
      { t0: 17, t1: 19, w: 2, ramp: ['r', 'q'] },
    ]);
    // amuleto colgante
    h.line(8, 17, 9, 20, '6'); h.shade(C(9.5, 21.5, 1.6), R.ice, {});
  });
  CU('sangriento', (h) => {
    h.diag(23, [
      { t0: -19, t1: -8, w: 4, ramp: ['b', 'a', '9', '9'] },
      { t0: -7, t1: -6, w: 4, ramp: ['8', '7', '6', '5'] },
      { t0: -5, t1: 13, w: 3, ramp: ['d', 'c', 'b'] },
      { t0: 14, t1: 16, w: 2, ramp: ['8', '7'] },
      { t0: 17, t1: 19, w: 2, ramp: ['r', 'q'] },
    ]);
    // púas
    [[2, 17], [6, 13], [9, 22], [5, 20]].forEach(([x, y], i) => { const up = i < 2; h.p(x, y, '7'); h.p(up ? x - 1 : x + 1, up ? y - 1 : y + 1, '8'); h.p(x + (up ? 1 : -1) * 0, y, '7'); });
    h.p(3, 18, '6'); h.p(7, 14, '6'); h.p(8, 21, '6'); h.p(4, 19, '6');
    // sangre goteando
    h.fill(Rc(14, 10, 1, 4), 'b'); h.p(14, 14, 'c'); h.drop(14, 17.5, 1.2, R.red);
  });
  CU('usura', (h) => {
    h.diag(23, [
      { t0: -19, t1: -8, w: 4, ramp: ['h', 'g', 'f', 'e'] },
      { t0: -7, t1: -6, w: 4, ramp: ['8', 'c', 'b', 'a'] },
      { t0: -5, t1: 13, w: 3, ramp: ['i', 'h', 'g'], fn: (x, y, i) => ((x - y) % 6 === 0 ? (i === 0 ? '8' : 'f') : null) },
      { t0: 14, t1: 16, w: 2, ramp: ['8', '7'] },
      { t0: 17, t1: 19, w: 2, ramp: ['r', 'q'] },
    ]);
    h.coin(16, 19, 2.6); h.coin(20.5, 15.5, 2.3);
    h.star(3, 3, 'h', '8', 1);
  });
  CU('hueso', (h) => {
    // vértebras
    for (let k = 0; k < 6; k++) {
      const x = 4 + k * 3, y = 19 - k * 3;
      h.shade(U(Cap(x - 1.6, y - 1.6, x + 1.6, y + 1.6, 1.3), C(x, y, 1.9)), R.bone, { bias: 0.3 });
      h.p(x - 2, y + 2, '6'); h.p(x + 2, y - 2, '6');
    }
    h.diag(23, [{ t0: 14, t1: 16, w: 2, ramp: ['8', '7'] }, { t0: 17, t1: 19, w: 2, ramp: ['r', 'q'] }]);
    h.skull(4, 20, 0.42, R.bone, {});
  });

  // ======================================================================
  // EMBLEMAS DE SOBRE 24x24
  // ======================================================================
  EM('arcano', (h) => {
    // tres cartas de tarot en abanico
    const card = (x, y, rot) => {
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const pts = [[-4, -6], [4, -6], [4, 6], [-4, 6]].map(([a, b]) => [x + a * cs - b * sn, y + a * sn + b * cs]);
      return P(pts);
    };
    h.shade(card(7, 14, -0.4), ['s', 't', 'u', '8'], {});
    h.shade(card(17, 14, 0.4), ['s', 't', 'u', '8'], {});
    h.shade(card(12, 12, 0), ['3', '5', '6', '7'], { bias: 0.3 });
    h.fill(E(12, 12, 2.8, 1.8), '0'); h.fill(C(12, 12, 1), 't'); h.p(12, 12, '8');
    h.p(12, 8, 'h'); h.p(12, 16, 'h');
    h.star(3, 3, 'u', '8'); h.star(21, 4, 'u', '8');
  });
  EM('luna', (h) => {
    h.sphere(12, 12, 9, R.ice, { spec: false });
    h.fill(C(16, 9, 8), '0');
    h.ol(D(C(12, 12, 9), C(16, 9, 8)), '0');
    h.star(18, 15, 'r', '8', 1); h.star(5, 3, 'q', '8'); h.p(21, 21, 'r'); h.p(20, 4, 'q');
  });
  EM('grabado', (h) => {
    seal(h, R.gold, () => {
      h.rows(8, 7, ['0.....0', '00...00', '.0...0.', '.00.00.', '..000..', '...0...', '...0...', '..000..'].map((r) => r), {});
    });
    h.shade(Cap(17, 18, 22, 23, 1), R.woodD, {}); h.shade(Cap(15, 16, 17, 18, 1.4), R.steel, {});
  });
  EM('maldito', (h) => {
    h.halo(12, 14, 11.5, 'b', 'a');
    [[3, 4], [21, 3], [2, 20], [22, 19]].forEach(([x, y], i) => h.p(x, y, i % 2 ? 'v' : 'd'));
    horns(h, 12, 8, 4.5, 8, R.bone);
    h.sphere(12, 15, 8, ['1', '2', '3', '5'], { spec: '7', rimC: 'a' });
    h.fill(C(11.5, 14, 3.9), '7'); h.fill(D(C(11.5, 14, 3.9), C(10.9, 13.4, 3.7)), '6'); h.ol(C(11.5, 14, 3.9), '1');
    h.glyph(10, 12, OM.CARDS._lib.F3['8'], 'b');
    h.p(7, 10, '8');
  });
})();
