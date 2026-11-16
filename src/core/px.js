// OCHO MALDITO — núcleo de píxeles: paleta, layout y registro de sprites.
// Todo el arte del juego debe usar ESTA paleta (32 colores). Ver docs/ART_CONTRACT.md
window.OM = window.OM || {};

OM.W = 640; // resolución interna (se escala x2/x3 con nearest-neighbor)
OM.H = 360;

// Paleta "Cripta" — 32 colores. Clave de 1 carácter -> hex.
OM.PAL = {
  '0': '#07050d', // vacío
  '1': '#120d1f', // noche profunda
  '2': '#1f1633', // púrpura oscuro
  '3': '#2e2147', // púrpura
  '4': '#45305e', // violeta
  '5': '#6b4a7d', // malva
  '6': '#9a7aa0', // lila polvo
  '7': '#d9c8d0', // hueso
  '8': '#fff4e0', // brillo
  '9': '#3a0d1a', // sangre seca
  'a': '#6e1428', // sangre
  'b': '#a8233a', // carmesí
  'c': '#e8435a', // rojo caliente (MULT)
  'd': '#ff8f6b', // brasa
  'e': '#4a2a12', // madera oscura
  'f': '#7a4a22', // madera
  'g': '#b5793a', // latón
  'h': '#f2c14e', // oro ($)
  'i': '#fff09a', // oro pálido
  'j': '#0b2620', // paño profundo
  'k': '#12402f', // paño
  'l': '#1d6b45', // paño claro
  'm': '#3fbf6a', // verde tóxico
  'n': '#a6f07a', // lima ácida
  'o': '#0d1f3a', // azul abisal
  'p': '#1f4a7a', // azul
  'q': '#3d8fd1', // azul cian (FICHAS)
  'r': '#7ee0f0', // cian hielo
  's': '#5a1f6b', // magenta oscuro
  't': '#a83fc4', // magenta
  'u': '#ff6ad5', // rosa neón
  'v': '#ff9a1f', // naranja
};
OM.col = (c) => (c && c.length === 1 ? OM.PAL[c] : c);

// Layout de pantalla compartido (640x360). Ver docs/ART_CONTRACT.md
OM.LAYOUT = {
  panel:   { x: 6,   y: 6,  w: 176, h: 348 },       // panel izquierdo (puntuación, tiros, $)
  jokers:  { x: 192, y: 6,  w: 300, h: 58 },        // fila de comodines (5 cartas 40x54)
  consum:  { x: 500, y: 6,  w: 134, h: 58 },        // consumibles (2-3 cartas)
  table:   { x: 192, y: 72, w: 436, h: 236 },       // mesa exterior (madera + bandas)
  felt:    { x: 210, y: 90, w: 400, h: 200 },       // paño jugable
  bottom:  { x: 192, y: 314, w: 442, h: 40 },       // barra inferior (potencia, info)
  ballR: 6, pocketR: 11, cardW: 40, cardH: 54, smallCardW: 30, smallCardH: 40,
};

// ---------- Helpers de píxel ----------
OM.PX = (function () {
  const store = {};
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { c, ctx };
  }
  // "g": pincel de píxel sobre un canvas pequeño.
  function painter(ctx, w, h) {
    const g = {
      w, h, ctx,
      p(x, y, c) { ctx.fillStyle = OM.col(c); ctx.fillRect(x | 0, y | 0, 1, 1); },
      rect(x, y, rw, rh, c) { ctx.fillStyle = OM.col(c); ctx.fillRect(x | 0, y | 0, rw | 0, rh | 0); },
      frame(x, y, rw, rh, c) { g.rect(x, y, rw, 1, c); g.rect(x, y + rh - 1, rw, 1, c); g.rect(x, y, 1, rh, c); g.rect(x + rw - 1, y, 1, rh, c); },
      clear(x = 0, y = 0, rw = w, rh = h) { ctx.clearRect(x, y, rw, rh); },
      circle(cx, cy, r, c) { // círculo relleno nítido
        ctx.fillStyle = OM.col(c);
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
          if (x * x + y * y <= r * r + r * 0.8) ctx.fillRect((cx + x) | 0, (cy + y) | 0, 1, 1);
      },
      ring(cx, cy, r, c) {
        ctx.fillStyle = OM.col(c);
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          const d = x * x + y * y;
          if (d <= r * r + r * 0.8 && d > (r - 1) * (r - 1) + (r - 1) * 0.8) ctx.fillRect((cx + x) | 0, (cy + y) | 0, 1, 1);
        }
      },
      line(x0, y0, x1, y1, c) { // Bresenham
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        ctx.fillStyle = OM.col(c);
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          ctx.fillRect(x0, y0, 1, 1);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      },
      dither(x, y, rw, rh, a, b, mode = 'checker') { // tramado 2 colores
        for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
          let useB;
          if (mode === 'checker') useB = (i + j) % 2 === 0;
          else if (mode === 'sparse') useB = i % 2 === 0 && j % 2 === 0;
          else if (mode === 'lines') useB = j % 2 === 0;
          else useB = false;
          const c = useB ? b : a;
          if (c) g.p(x + i, y + j, c);
        }
      },
      // contorno de 1px alrededor de los píxeles opacos actuales
      outline(c, diag = false) {
        const img = ctx.getImageData(0, 0, w, h).data;
        const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && img[(y * w + x) * 4 + 3] > 0;
        const pts = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (op(x, y)) continue;
          if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1) ||
            (diag && (op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1)))) pts.push([x, y]);
        }
        ctx.fillStyle = OM.col(c);
        pts.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
      },
      // dibuja filas de caracteres de paleta ('.' o ' ' = transparente)
      rows(x, y, rows, map) {
        rows.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            let ch = row[i];
            if (map && map[ch] !== undefined) ch = map[ch];
            if (!ch || ch === '.' || ch === ' ') continue;
            g.p(x + i, y + j, ch);
          }
        });
      },
      sprite(name, x, y) { const s = store[name]; if (s) ctx.drawImage(s.c, x | 0, y | 0); },
    };
    return g;
  }
  // Registrar sprite procedural: make('nombre', w, h, g => {...})
  function make(name, w, h, fn) {
    const { c, ctx } = canvas(w, h);
    fn(painter(ctx, w, h));
    store[name] = { c, w, h };
    return store[name];
  }
  // Registrar sprite desde filas de texto
  function sprite(name, rows, map) {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    return make(name, w, h, (g) => g.rows(0, 0, rows, map));
  }
  function get(name) { return store[name]; }
  function has(name) { return !!store[name]; }
  function draw(ctx, name, x, y, o) {
    const s = store[name];
    if (!s) return false;
    o = o || {};
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    const sc = o.scale || 1;
    if (o.flipX || o.rot || sc !== 1) {
      ctx.translate((x | 0) + (s.w * sc) / 2, (y | 0) + (s.h * sc) / 2);
      if (o.rot) ctx.rotate(o.rot);
      ctx.scale(o.flipX ? -sc : sc, sc);
      ctx.drawImage(s.c, -s.w / 2, -s.h / 2);
    } else ctx.drawImage(s.c, x | 0, y | 0);
    ctx.restore();
    return true;
  }
  function names() { return Object.keys(store); }
  return { canvas, painter, make, sprite, get, has, draw, names, store };
})();
