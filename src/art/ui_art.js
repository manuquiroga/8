// OCHO MALDITO — UI: paneles 9-slice, botones, iconos, cajas de Fichas/Mult, barras,
// cursor, fondos animados de escena y el LOGO. Ver docs/ART_CONTRACT.md
// Todo procedural, paleta OM.PAL, coordenadas enteras. Lo estático se cachea en canvases.
window.OM = window.OM || {};
OM.ART_INIT = OM.ART_INIT || [];

OM.UI = (function () {
  const PAL = OM.PAL;
  const W = OM.W || 640, H = OM.H || 360;

  // ---------------------------------------------------------------- utilidades
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { c, ctx, g: OM.PX.painter(ctx, c.width, c.height) };
  }
  // caché LRU de canvases (paneles/botones de tamaños variados)
  const lru = new Map();
  function cached(key, w, h, fn) {
    let e = lru.get(key);
    if (e) { lru.delete(key); lru.set(key, e); return e; }
    e = mk(w, h);
    fn(e.g, e.ctx, w, h);
    lru.set(key, e);
    if (lru.size > 400) lru.delete(lru.keys().next().value);
    return e;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function pick(ramp, v, x, y) { // cuantiza v∈[0,1] en una rampa con tramado Bayer
    v = clamp(v, 0, 0.9999);
    const f = v * (ramp.length - 1);
    let i = Math.floor(f);
    if (f - i > bayer(x, y)) i++;
    return ramp[Math.min(i, ramp.length - 1)];
  }
  // buffer de píxeles para generar fondos estáticos una sola vez (putImageData en la carga)
  const P32 = {};
  for (const k in PAL) {
    const h = PAL[k];
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    P32[k] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  function Buf(w, h) {
    const img = new ImageData(w, h);
    const d = new Uint32Array(img.data.buffer);
    return {
      w, h, img, d,
      set(x, y, k) { x |= 0; y |= 0; if (k && x >= 0 && y >= 0 && x < w && y < h) d[y * w + x] = P32[k]; },
      rect(x, y, rw, rh, k) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) this.set(x + i, y + j, k); },
      toCanvas() { const m = mk(w, h); m.ctx.putImageData(img, 0, 0); return m; },
    };
  }
  const font = () => OM.FONT;
  function txt(ctx, s, x, y, o) { if (OM.FONT) return OM.FONT.draw(ctx, s, x, y, o); return 0; }

  // =========================================================== PANELES 9-SLICE
  // Cada estilo se dibuja proceduralmente al tamaño pedido y se cachea (w,h,estilo).
  function cutCorners(g, w, h, r) { // esquinas redondeadas a píxel (transparente)
    const ctx = g.ctx;
    for (let i = 0; i < r; i++) {
      const n = r - i;
      ctx.clearRect(0, i, n, 1); ctx.clearRect(w - n, i, n, 1);
      ctx.clearRect(0, h - 1 - i, n, 1); ctx.clearRect(w - n, h - 1 - i, n, 1);
    }
  }
  function roundFrame(g, x, y, w, h, c, r) { // marco de 1px con esquina recortada r
    g.rect(x + r, y, w - 2 * r, 1, c); g.rect(x + r, y + h - 1, w - 2 * r, 1, c);
    g.rect(x, y + r, 1, h - 2 * r, c); g.rect(x + w - 1, y + r, 1, h - 2 * r, c);
    for (let i = 1; i < r; i++) { g.p(x + i, y + r - i, c); g.p(x + w - 1 - i, y + r - i, c); g.p(x + i, y + h - 1 - r + i, c); g.p(x + w - 1 - i, y + h - 1 - r + i, c); }
  }
  function fillTex(g, x, y, w, h, ramp, top, bottom, seed) { // relleno con degradado vertical tramado + motas
    for (let j = 0; j < h; j++) {
      const v = top + (bottom - top) * (j / Math.max(1, h - 1));
      for (let i = 0; i < w; i++) {
        let vv = v + (hash(i + seed, j) < 0.035 ? 0.18 : 0);
        g.ctx.fillStyle = PAL[pick(ramp, vv, x + i, y + j)];
        g.ctx.fillRect(x + i, y + j, 1, 1);
      }
    }
  }
  function rivet(g, x, y, hi, mid, lo) { g.p(x, y, hi); g.p(x + 1, y, mid); g.p(x, y + 1, mid); g.p(x + 1, y + 1, lo); }
  function bracket(g, x, y, fx, fy, A, B, C) { // ornamento de esquina en L con remache
    const P = (i, j, c) => g.p(x + i * fx, y + j * fy, c);
    for (let i = 0; i < 6; i++) { P(i, 0, i < 5 ? A : B); P(0, i, i < 5 ? A : B); }
    for (let i = 1; i < 4; i++) { P(i, 1, B); P(1, i, B); }
    P(2, 2, C); P(3, 2, B); P(2, 3, B);
  }

  const PANEL = {
    dark(g, w, h) {
      g.clear();
      // relleno terciopelo: claro arriba (luz cálida cenital), oscuro abajo
      fillTex(g, 3, 3, w - 6, h - 6, ['1', '2', '3'], 0.62, 0.22, 7);
      // marco de latón
      roundFrame(g, 0, 0, w, h, '0', 2);
      g.rect(2, 1, w - 4, 1, 'h'); g.rect(1, 2, 1, h - 4, 'g'); g.rect(w - 2, 2, 1, h - 4, 'f'); g.rect(2, h - 2, w - 4, 1, 'e');
      g.p(1, 1, 'g'); g.p(w - 2, 1, 'g'); g.p(1, h - 2, 'f'); g.p(w - 2, h - 2, 'e');
      g.rect(2, 2, w - 4, 1, 'e'); g.rect(2, 2, 1, h - 4, 'e'); g.rect(w - 3, 2, 1, h - 4, '0'); g.rect(2, h - 3, w - 4, 1, '0');
      g.rect(3, 3, w - 6, 1, '0');
      g.rect(3, 4, w - 6, 1, '3');
      cutCorners(g, w, h, 1);
      if (w >= 24 && h >= 24) {
        bracket(g, 3, 3, 1, 1, 'g', 'f', 'h'); bracket(g, w - 4, 3, -1, 1, 'g', 'f', 'h');
        bracket(g, 3, h - 4, 1, -1, 'f', 'e', 'g'); bracket(g, w - 4, h - 4, -1, -1, 'f', 'e', 'g');
      }
      if (w >= 80) { const mx = (w >> 1) - 1; g.p(mx, 0, '0'); g.rect(mx - 1, 1, 4, 1, 'i'); g.p(mx, 2, 'h'); g.p(mx + 1, 2, 'g'); }
    },
    inset(g, w, h) {
      g.clear();
      fillTex(g, 1, 1, w - 2, h - 2, ['0', '1', '2'], 0.35, 0.55, 3);
      g.rect(1, 0, w - 2, 1, '0'); g.rect(0, 1, 1, h - 2, '0');
      g.rect(1, 1, w - 2, 1, '0'); g.rect(1, 1, 1, h - 2, '0');
      g.rect(1, h - 1, w - 2, 1, '4'); g.rect(w - 1, 1, 1, h - 2, '3');
      g.p(w - 1, h - 1, '0');
    },
    blood(g, w, h) {
      g.clear();
      fillTex(g, 3, 3, w - 6, h - 6, ['1', '9', 'a'], 0.55, 0.12, 11);
      roundFrame(g, 0, 0, w, h, '0', 2);
      g.rect(2, 1, w - 4, 1, 'c'); g.rect(1, 2, 1, h - 4, 'b'); g.rect(w - 2, 2, 1, h - 4, 'a'); g.rect(2, h - 2, w - 4, 1, '9');
      g.p(1, 1, 'b'); g.p(w - 2, 1, 'b'); g.p(1, h - 2, 'a'); g.p(w - 2, h - 2, '9');
      g.rect(2, 2, w - 4, 1, 'a'); g.rect(2, 2, 1, h - 4, 'a'); g.rect(w - 3, 2, 1, h - 4, '0'); g.rect(2, h - 3, w - 4, 1, '0');
      g.rect(3, 3, w - 6, 1, '0');
      cutCorners(g, w, h, 1);
      // goterones de sangre que cuelgan del marco superior
      for (let x = 6; x < w - 6; x++) {
        const r = hash(x * 3.1, w);
        if (r < 0.16) {
          const len = 2 + Math.floor(hash(x, h) * Math.min(14, h * 0.35));
          g.rect(x, 3, 1, len, 'a'); g.rect(x, 3, 1, Math.max(1, len - 2), 'b');
          if (len > 4) { g.rect(x - 1, 3 + len - 2, 3, 2, 'a'); g.p(x, 3 + len - 2, 'c'); }
          x += 2;
        }
      }
      g.rect(3, 3, w - 6, 1, 'b');
      if (w >= 24 && h >= 24) {
        bracket(g, 3, 3, 1, 1, 'b', 'a', 'd'); bracket(g, w - 4, 3, -1, 1, 'b', 'a', 'd');
        bracket(g, 3, h - 4, 1, -1, 'a', '9', 'b'); bracket(g, w - 4, h - 4, -1, -1, 'a', '9', 'b');
      }
    },
    gold(g, w, h) {
      g.clear();
      fillTex(g, 4, 4, w - 8, h - 8, ['1', '2', '3', 'e'], 0.6, 0.18, 5);
      roundFrame(g, 0, 0, w, h, '0', 3);
      g.rect(3, 1, w - 6, 1, 'i'); g.rect(2, 2, w - 4, 1, 'h'); g.p(2, 2, 'h');
      g.rect(1, 3, 1, h - 6, 'h'); g.rect(2, 2, 1, h - 4, 'h');
      g.rect(w - 2, 3, 1, h - 6, 'g'); g.rect(w - 3, 2, 1, h - 4, 'g');
      g.rect(3, h - 2, w - 6, 1, 'f'); g.rect(2, h - 3, w - 4, 1, 'g');
      g.p(2, 1, '0'); g.p(1, 2, '0');
      g.rect(3, 3, w - 6, 1, 'g'); g.rect(3, 3, 1, h - 6, 'g'); g.rect(w - 4, 3, 1, h - 6, 'f'); g.rect(3, h - 4, w - 6, 1, 'f');
      g.rect(4, 4, w - 8, 1, '0'); g.rect(4, 4, 1, h - 8, '0'); g.rect(w - 5, 4, 1, h - 8, 'e'); g.rect(4, h - 5, w - 8, 1, 'e');
      // filigrana de esquina
      const fil = (x, y, fx, fy) => {
        const P = (i, j, c) => g.p(x + i * fx, y + j * fy, c);
        P(0, 0, 'i'); P(1, 0, 'h'); P(0, 1, 'h'); P(1, 1, 'g'); P(2, 0, 'g'); P(0, 2, 'g'); P(3, 0, 'f'); P(0, 3, 'f'); P(2, 2, 'h'); P(3, 3, 'f');
      };
      if (w >= 24 && h >= 24) { fil(5, 5, 1, 1); fil(w - 6, 5, -1, 1); fil(5, h - 6, 1, -1); fil(w - 6, h - 6, -1, -1); }
      // gemas en el centro de los bordes
      const gem = (x, y) => { g.rect(x - 1, y, 3, 1, 'b'); g.p(x, y - 1, 'c'); g.p(x, y + 1, 'a'); g.p(x - 1, y - 1, '0'); g.p(x + 1, y - 1, '0'); g.p(x - 1, y + 1, '0'); g.p(x + 1, y + 1, '0'); g.p(x - 1, y, 'd'); };
      if (w >= 60) { gem(w >> 1, 2); gem(w >> 1, h - 3); }
      if (h >= 60) { gem(2, h >> 1); gem(w - 3, h >> 1); }
    },
    tooltip(g, w, h) {
      g.clear();
      fillTex(g, 2, 2, w - 4, h - 4, ['0', '1', '2'], 0.55, 0.42, 2);
      roundFrame(g, 0, 0, w, h, '0', 1);
      g.rect(1, 1, w - 2, 1, '6'); g.rect(1, 1, 1, h - 2, '5'); g.rect(w - 2, 2, 1, h - 3, '4'); g.rect(2, h - 2, w - 3, 1, '3');
      g.p(1, 1, '7'); g.p(w - 2, 1, '5'); g.p(1, h - 2, '4');
      g.rect(2, 2, w - 4, 1, '0');
    },
  };
  PANEL.default = PANEL.dark;

  function panel(ctx, x, y, w, h, style) {
    w |= 0; h |= 0;
    if (w < 6 || h < 6) return;
    style = PANEL[style] ? style : 'dark';
    const e = cached('p|' + style + '|' + w + '|' + h, w, h, (g) => PANEL[style](g, w, h));
    ctx.drawImage(e.c, x | 0, y | 0);
  }

  // ================================================================ BOTONES
  const BTN = { // rampa claro→oscuro: [brillo, cara-clara, cara, borde-oscuro, profundidad], color de texto, sombra texto
    red: { r: ['d', 'c', 'b', 'a', '9'], text: '8', ts: '9' },
    blue: { r: ['r', 'q', 'p', 'o', '1'], text: '8', ts: 'o' },
    gold: { r: ['i', 'h', 'g', 'f', 'e'], text: '1', ts: 'i' },
    green: { r: ['n', 'm', 'l', 'k', 'j'], text: '8', ts: 'j' },
    dark: { r: ['6', '5', '4', '3', '1'], text: '7', ts: '1' },
    disabled: { r: ['4', '3', '3', '2', '1'], text: '5', ts: '1' },
  };
  function buttonBody(g, w, h, st, state) {
    const r = st.r;
    const down = state === 'down';
    const hov = state === 'hover';
    const fy = down ? 2 : 0; // cara desplazada al pulsar
    const fh = h - 2;        // alto de la cara
    g.clear();
    // profundidad (2px) + contorno
    if (!down) {
      g.rect(1, 2, w - 2, h - 2, '0'); g.rect(0, 3, w, h - 4, '0');
      g.rect(1, fh - 1, w - 2, 2, r[4]); g.rect(2, h - 2, w - 4, 1, r[4]);
    }
    // cara
    const fx0 = 0, fy0 = fy;
    g.rect(fx0 + 1, fy0, w - 2, fh, '0'); g.rect(fx0, fy0 + 1, w, fh - 2, '0');
    const face = hov ? r[1] : r[2], light = hov ? r[0] : r[1], dark = r[3];
    g.rect(1, fy0 + 1, w - 2, fh - 2, face);
    // brillo superior (2 filas, la segunda tramada) y lateral
    g.rect(2, fy0 + 1, w - 4, 1, light);
    for (let i = 2; i < w - 2; i++) if ((i & 1) === 0) g.p(i, fy0 + 2, light);
    g.rect(1, fy0 + 2, 1, fh - 4, light);
    // sombra inferior de la cara
    g.rect(2, fy0 + fh - 2, w - 4, 1, dark); g.rect(w - 2, fy0 + 2, 1, fh - 4, dark);
    if (hov) { g.p(2, fy0 + 1, '8'); g.p(3, fy0 + 1, '8'); g.p(2, fy0 + 2, '8'); }
    // remaches de esquina para botones grandes
    if (w >= 40 && h >= 18) {
      g.p(3, fy0 + 3, light); g.p(w - 4, fy0 + 3, dark); g.p(3, fy0 + fh - 4, dark); g.p(w - 4, fy0 + fh - 4, dark);
    }
  }
  function button(ctx, x, y, w, h, label, state, style) {
    w |= 0; h |= 0; x |= 0; y |= 0;
    state = state || 'idle';
    const st = state === 'disabled' ? BTN.disabled : BTN[style] || BTN.red;
    const e = cached('b|' + (state === 'disabled' ? 'disabled' : style) + '|' + state + '|' + w + '|' + h, w, h, (g) => buttonBody(g, w, h, st, state));
    ctx.drawImage(e.c, x, y);
    if (label !== undefined && label !== null && label !== '') {
      const fy = state === 'down' ? 2 : 0;
      const fh = h - 2;
      const big = fh >= 22 && font().measure(label, 2) <= w - 10;
      const size = big ? 2 : 1;
      const cap = font().capH(size);
      const ty = y + fy + Math.round((fh - cap) / 2) + (size === 2 ? 0 : 0);
      txt(ctx, label, x + (w >> 1), ty, { align: 'center', color: st.text, shadow: st.ts, size, grad: size === 2 && st.text !== '1' });
    }
  }

  // ================================================================ ICONOS
  // 10x10 dibujados a mano + contorno '0' automático => 12x12
  const ICONS = {
    coin: [
      '..gggggg..',
      '.ghhhhhhg.',
      'ghiihhhhhg',
      'ghihhgghhf',
      'ghhhgihhhf',
      'ghhhgihhhf',
      'ghhhhgghhf',
      'ghhhhhhhhf',
      '.fghhhhgf.',
      '..ffffff..',
    ],
    shot: [ // bola blanca disparada con estela
      '.....7777.',
      '....788877',
      '5..7887777',
      '..67877776',
      '5.67777776',
      '..67777766',
      '5..7777666',
      '....76666.',
      '.....666..',
      '..........',
    ],
    skull: [
      '..777777..',
      '.78888887.',
      '7888888887',
      '7800880087',
      '7800780087',
      '.78887887.',
      '..788887..',
      '..7.77.7..',
      '..767676..',
      '..........',
    ],
    chips: [ // pila de fichas azules
      '..rrrrrr..',
      '.r8qqqq8r.',
      '.qqqqqqqq.',
      '.pqrqqrqp.',
      '.rrrrrrrr.',
      '.qqqqqqqq.',
      '.prqrrqrp.',
      '.qqqqqqqq.',
      '.pqqqqqqp.',
      '..pppppp..',
    ],
    mult: [ // llama roja con "+"
      '....d.....',
      '...dcd....',
      '..dcccd.d.',
      '..cc8ccdc.',
      '.dc888ccd.',
      '.cc88ccccd',
      '.ccc8cbccc',
      '.bccccbcbc',
      '..bbcbbbb.',
      '...aaaaa..',
    ],
    xmult: [ // sello rojo con X
      '..cccccc..',
      '.cdddddcb.',
      'cd88dd88cb',
      'cdd8888dcb',
      'cddd88ddcb',
      'cdd8888dcb',
      'cd88dd88cb',
      'cddddddccb',
      '.cbbbbbbb.',
      '..aaaaaa..',
    ],
    reroll: [
      '...hhhh...',
      '..hg..gh.h',
      '.h......hh',
      '.h.....hhh',
      '.h........',
      '........g.',
      'ggg.....g.',
      'gg......g.',
      'g.gf..fg..',
      '...gggg...',
    ],
    lock: [
      '...6666...',
      '..6....6..',
      '..6....5..',
      '..6....5..',
      '.hhhhhhhh.',
      '.hiihhhhg.',
      '.hih00hhg.',
      '.hhh00hhg.',
      '.hhhh0hhg.',
      '.ggggggff.',
    ],
    ball: [ // bola 8
      '..111111..',
      '.12233221.',
      '1223333221',
      '1237777321',
      '1237007321',
      '1227777221',
      '1227007221',
      '1122772211',
      '.11222211.',
      '..111111..',
    ],
    cue: [
      '........r8',
      '.......777',
      '......gf7.',
      '.....gf...',
      '....fe....',
      '...fe.....',
      '..fe......',
      '.ee.......',
      'ee........',
      'e.........',
    ],
    candle: [
      '....i.....',
      '...ihi....',
      '...hvh....',
      '....v.....',
      '...787....',
      '..77777...',
      '..78776...',
      '..77776...',
      '..77766...',
      '.6666655..',
    ],
    eye: [
      '..........',
      '...7777...',
      '.77888877.',
      '788cccc887',
      '78cc00cc87',
      '78cc00bc87',
      '788cbbc887',
      '.77888877.',
      '...7777...',
      '..........',
    ],
    star: [
      '....hh....',
      '....ih....',
      '...iihh...',
      'hhhiihhhhg',
      '.hhiihhhg.',
      '..hhhhgg..',
      '..hhggg...',
      '.hhg..hgg.',
      '.hg....gg.',
      '..........',
    ],
    arrow_r: [
      '..........',
      '.....7....',
      '.....87...',
      '777778887.',
      '8888888887',
      '7777788876',
      '.....876..',
      '.....76...',
      '.....6....',
      '..........',
    ],
    arrow_l: null, // espejo de arrow_r
    check: [
      '..........',
      '........mn',
      '.......mnm',
      '......mnm.',
      'nm...mnm..',
      'mnm.mnm...',
      '.mnmnm....',
      '..mnm.....',
      '...m......',
      '..........',
    ],
    cross: [
      '..........',
      '.dc....dc.',
      '.cdc..dcb.',
      '..cdcdcb..',
      '...cdcb...',
      '...dcbc...',
      '..dcb.cb..',
      '.dcb...cb.',
      '.cb.....b.',
      '..........',
    ],
    hourglass: [
      'gggggggggg',
      '.7......7.',
      '.7hhhhhh7.',
      '..7hhhh7..',
      '...7hh7...',
      '...7..7...',
      '..7..h.7..',
      '.7.hhhh.7.',
      '.7hhhhhh7.',
      'gggggggggg',
    ],
    sell: [ // etiqueta con $
      '......000.',
      '.....0770.',
      '....07707.',
      '...0777770',
      '..07h7h770',
      '.07hhh7770',
      '07h7h7770.',
      '.07hh770..',
      '..07770...',
      '...070....',
    ],
  };
  ICONS.sell = [ // moneda con flecha hacia fuera (vender)
    '..ggggg...',
    '.ghhhhhg..',
    'ghiihhhhg.',
    'ghihhh7...',
    'ghhh77777.',
    'ghhh777777',
    'ghhh77777.',
    'ghhhhh7...',
    '.fghhhgf..',
    '..fffff...',
  ];
  let iconsReady = false;
  function initIcons() {
    if (iconsReady) return;
    iconsReady = true;
    const mirror = (rows) => rows.map((r) => r.split('').reverse().join(''));
    ICONS.arrow_l = mirror(ICONS.arrow_r);
    for (const name in ICONS) {
      const rows = ICONS[name];
      OM.PX.make('ui_icon_' + name, 12, 12, (g) => { g.rows(1, 1, rows); g.outline('0'); });
    }
  }
  function icon(ctx, name, x, y, opts) {
    initIcons();
    return OM.PX.draw(ctx, 'ui_icon_' + name, x, y, opts);
  }

  // ============================================================ VALUE BOX
  const VB = {
    chips: { face: 'q', hi: 'r', lo: 'p', edge: 'o', ts: 'o' },
    mult: { face: 'c', hi: 'd', lo: 'b', edge: '9', ts: '9' },
    money: { face: 'h', hi: 'i', lo: 'g', edge: 'e', ts: 'e' },
    score: { face: '2', hi: '3', lo: '1', edge: '0', ts: '0' },
  };
  function valueBox(ctx, x, y, w, h, value, kind, opts) {
    w |= 0; h |= 0; x |= 0; y |= 0;
    const k = VB[kind] ? kind : 'chips';
    const s = VB[k];
    const e = cached('vb|' + k + '|' + w + '|' + h, w, h, (g) => {
      g.clear();
      roundFrame(g, 0, 0, w, h, '0', 2);
      g.rect(1, 2, w - 2, h - 4, s.face); g.rect(2, 1, w - 4, h - 2, s.face);
      g.rect(2, 1, w - 4, 1, s.hi); g.rect(1, 2, 1, h - 4, s.hi);
      for (let i = 2; i < w - 2; i += 2) g.p(i, 2, s.hi);
      g.rect(2, h - 2, w - 4, 1, s.edge); g.rect(w - 2, 2, 1, h - 4, s.lo); g.rect(2, h - 3, w - 4, 1, s.lo);
      g.p(1, 1, '0'); g.p(w - 2, 1, '0'); g.p(1, h - 2, '0'); g.p(w - 2, h - 2, '0');
      // brillo diagonal
      for (let j = 3; j < h - 3; j++) { const xx = 4 + (h - j); if (xx < w - 3) g.p(xx, j, s.hi); }
    });
    ctx.drawImage(e.c, x, y);
    const str = String(value);
    const o = opts || {};
    let size = 2;
    if (font().measure(str, 2) > w - 8 || h < 17) size = 1;
    const cap = font().capH(size);
    const ty = y + Math.round((h - 1 - cap) / 2);
    const tc = k === 'money' ? '1' : '8';
    txt(ctx, str, x + (w >> 1), ty, { align: o.align || 'center', color: o.color || tc, shadow: s.ts, size, grad: false, outline: null });
  }
  // extra: fila completa "FICHAS x MULT" estilo calculadora
  function scoreRow(ctx, x, y, w, h, chips, mult, t) {
    const bw = ((w - 16) >> 1);
    valueBox(ctx, x, y, bw, h, chips, 'chips');
    valueBox(ctx, x + w - bw, y, bw, h, mult, 'mult');
    txt(ctx, 'x', x + (w >> 1), y + ((h - 11) >> 1) - 1, { align: 'center', color: '7', size: 2, outline: '0' });
  }

  // ================================================================ BARRA
  const BAR = {
    q: ['r', 'q', 'p'], c: ['d', 'c', 'b'], h: ['i', 'h', 'g'], m: ['n', 'm', 'l'], b: ['c', 'b', 'a'],
    v: ['h', 'v', 'b'], t: ['u', 't', 's'], '7': ['8', '7', '6'], r: ['8', 'r', 'q'], u: ['8', 'u', 't'],
  };
  function bar(ctx, x, y, w, h, frac, color) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    if (w < 4 || h < 3) return;
    frac = clamp(+frac || 0, 0, 1);
    const tr = cached('bar|' + w + '|' + h, w, h, (g) => {
      g.clear();
      roundFrame(g, 0, 0, w, h, '0', 1);
      g.rect(1, 1, w - 2, h - 2, '1');
      g.rect(1, 1, w - 2, 1, '0');
      g.rect(1, h - 2, w - 2, 1, '2');
      for (let i = 6; i < w - 2; i += 6) g.rect(i, 2, 1, h - 4, '2');
    });
    ctx.drawImage(tr.c, x, y);
    const fw = Math.round((w - 2) * frac);
    if (fw <= 0) return;
    const fill = (fx, fwid, ramp) => {
      ctx.fillStyle = PAL[ramp[1]]; ctx.fillRect(fx, y + 1, fwid, h - 2);
      ctx.fillStyle = PAL[ramp[0]]; ctx.fillRect(fx, y + 1, fwid, 1);
      ctx.fillStyle = PAL[ramp[2]]; ctx.fillRect(fx, y + h - 2, fwid, 1);
    };
    if (color === 'power') { // verde → oro → naranja → rojo por tramos
      const seg = [['n', 'm', 'l'], ['i', 'h', 'g'], ['h', 'v', 'b'], ['d', 'c', 'b']];
      for (let i = 0; i < fw; i++) { const s = seg[Math.min(3, Math.floor((i / (w - 2)) * 4))]; fill(x + 1 + i, 1, s); }
    } else fill(x + 1, fw, BAR[color] || BAR.c);
    // muescas y punta brillante
    ctx.fillStyle = 'rgba(7,5,13,0.35)';
    for (let i = 6; i < fw; i += 6) ctx.fillRect(x + i, y + 2, 1, h - 4);
    ctx.fillStyle = PAL['8'];
    ctx.fillRect(x + fw, y + 1, 1, h - 2);
  }

  // ================================================================ CURSOR
  const CURSORS = {
    normal: { hx: 0, hy: 0, rows: [
      '0..........',
      '00.........',
      '080........',
      '0870.......',
      '08770......',
      '087770.....',
      '0877770....',
      '08777770...',
      '087777770..',
      '0877700000.',
      '08770c0....',
      '0870.0c0...',
      '000..0cc0..',
      '0.....00...',
    ] },
    aim: { hx: 6, hy: 6, rows: [
      '....000....',
      '....0c0....',
      '..00...00..',
      '.0c.....c0.',
      '.0.......0.',
      '00...8...00',
      'cc..888..cc',
      '00...8...00',
      '.0.......0.',
      '.0c.....c0.',
      '..00...00..',
      '....0c0....',
      '....000....',
    ] },
    grab: { hx: 5, hy: 4, rows: [
      '...00.00...',
      '..0770770..',
      '.0070707700',
      '0770707070.',
      '07707070770',
      '07777777770',
      '07777777770',
      '.0777777760',
      '.0777777660',
      '..07776660.',
      '...066660..',
      '...00000...',
    ] },
  };
  // grab real: mano cerrada (puño) más legible
  CURSORS.grab.rows = [
    '..0000000..',
    '.077070770.',
    '0787878770.',
    '07777777770',
    '07777777770',
    '.0777777760',
    '.0877777660',
    '..077776600',
    '..07776660.',
    '...066660..',
    '....0000...',
  ];
  function cursor(ctx, x, y, state) {
    const c = CURSORS[state] || CURSORS.normal;
    const name = 'ui_cursor_' + (CURSORS[state] ? state : 'normal');
    if (!OM.PX.has(name)) OM.PX.sprite(name, c.rows);
    OM.PX.draw(ctx, name, (x | 0) - c.hx, (y | 0) - c.hy);
  }

  // =================================================== ELEMENTOS COMPARTIDOS DE ESCENA
  // halo de luz tramado (pre-renderizado) para velas/lámparas; se pinta con globalAlpha
  const halos = {};
  function halo(r, col) {
    const key = r + col;
    if (halos[key]) return halos[key];
    const m = mk(r * 2 + 1, r * 2 + 1);
    m.ctx.fillStyle = PAL[col];
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const d = Math.sqrt(i * i + j * j) / r;
      if (d > 1) continue;
      const v = (1 - d) * (1 - d);
      // tres niveles de densidad tramada
      if (v > bayer(i + r, j + r) * 0.9) m.ctx.fillRect(i + r, j + r, 1, 1);
    }
    halos[key] = m.c;
    return m.c;
  }
  function drawHalo(ctx, x, y, r, col, a) {
    const c = halo(r, col);
    ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
    ctx.drawImage(c, (x | 0) - r, (y | 0) - r);
    ctx.restore();
  }
  // llama animada (5-9 px de alto) — se dibuja cada frame
  function flame(ctx, x, y, t, seed, big) {
    const f = Math.sin(t * 13 + seed * 7) * 0.5 + Math.sin(t * 23 + seed * 3) * 0.5;
    const h = (big ? 8 : 5) + Math.round(f * 1.5);
    const sway = Math.round(Math.sin(t * 5 + seed) * (big ? 1.2 : 0.7));
    x |= 0; y |= 0;
    const P = (px, py, c) => { ctx.fillStyle = PAL[c]; ctx.fillRect(px, py, 1, 1); };
    const R = (px, py, w, hh, c) => { ctx.fillStyle = PAL[c]; ctx.fillRect(px, py, w, hh); };
    if (big) {
      R(x - 2, y - 3, 5, 3, 'v'); R(x - 1, y - h + 2, 3, h - 2, 'v');
      R(x - 1, y - 4, 3, 3, 'h'); R(x, y - h + 3 + 0, 1, h - 4, 'i');
      P(x + sway, y - h, 'h'); P(x + sway, y - h + 1, 'v');
      P(x, y - 2, '8');
      R(x - 1, y - 1, 3, 1, 'b');
    } else {
      R(x - 1, y - 2, 3, 2, 'v'); R(x, y - h + 1, 1, h - 1, 'h');
      P(x + sway, y - h, 'v'); P(x, y - 2, 'i'); P(x, y - 1, 'b');
    }
  }
  // velas estáticas (cuerpo) en un buffer/canvas
  function candleBody(g, x, y, h, w) {
    w = w || 3;
    g.rect(x - 1, y, w + 2, h + 1, '0');
    g.rect(x, y, w, h, '7'); g.rect(x + w - 1, y, 1, h, '6'); g.rect(x, y, 1, h, '8');
    g.p(x + 1, y + 1, '8'); g.p(x + w - 1, y + 2 + (h > 6 ? 2 : 0), '7'); // goterón de cera
    g.p(x + (w >> 1), y - 1, '1'); // mecha
  }
  // cadenas colgantes
  function chain(ctx, x, y0, len, sway) {
    for (let i = 0; i < len; i += 3) {
      const k = i / Math.max(1, len);
      const xx = Math.round(x + Math.sin(k * 1.6) * sway * k);
      ctx.fillStyle = PAL['0']; ctx.fillRect(xx - 1, y0 + i, 3, 4);
      if ((i / 3) & 1) { ctx.fillStyle = PAL['4']; ctx.fillRect(xx - 1, y0 + i + 1, 1, 2); ctx.fillStyle = PAL['5']; ctx.fillRect(xx + 1, y0 + i + 1, 1, 2); ctx.fillStyle = PAL['1']; ctx.fillRect(xx, y0 + i + 1, 1, 2); }
      else { ctx.fillStyle = PAL['5']; ctx.fillRect(xx, y0 + i, 1, 4); ctx.fillStyle = PAL['6']; ctx.fillRect(xx, y0 + i, 1, 1); }
    }
  }
  // niebla: textura tileable horizontal con tramado
  const fogC = {};
  function fogTex(col, h, seed) {
    const key = col + h + seed;
    if (fogC[key]) return fogC[key];
    const w = 320;
    const m = mk(w, h);
    m.ctx.fillStyle = PAL[col];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = x / w * Math.PI * 2;
      let v = 0.5 + 0.25 * Math.sin(a * 2 + seed) + 0.17 * Math.sin(a * 5 + seed * 2 + y * 0.05) + 0.1 * Math.sin(a * 9 + y * 0.12 + seed);
      const vy = Math.sin((y / h) * Math.PI); // se desvanece arriba y abajo
      v = v * vy * vy;
      if (v > bayer(x, y) * 0.95 + 0.12) m.ctx.fillRect(x, y, 1, 1);
    }
    fogC[key] = m.c;
    return m.c;
  }
  function drawFog(ctx, y, h, col, alpha, speed, t, seed) {
    const c = fogTex(col, h, seed);
    const off = Math.floor(((t * speed) % 320 + 320) % 320);
    ctx.save(); ctx.globalAlpha = alpha;
    for (let x = -off; x < W; x += 320) ctx.drawImage(c, x, y | 0);
    ctx.restore();
  }
  // campo de partículas deterministas por tiempo (sin estado)
  function field(ctx, t, n, seed, fn) {
    for (let i = 0; i < n; i++) fn(hash(i, seed), hash(seed, i * 1.7), hash(i * 2.3, seed + 5), i);
  }
  function embers(ctx, t, n, seed, cols, y0, y1, speed) {
    field(ctx, t, n, seed, (a, b, c, i) => {
      const life = (y1 - y0) / (speed * (0.6 + c));
      const ph = ((t / life + b) % 1);
      const y = Math.round(y1 - ph * (y1 - y0));
      const x = Math.round(a * W + Math.sin(t * (1 + c) + i) * 6 + ph * 12 * (c - 0.5));
      const col = ph < 0.4 ? cols[0] : ph < 0.75 ? cols[1] : cols[2];
      ctx.fillStyle = PAL[col];
      ctx.fillRect(x, y, 1, 1);
      if (c > 0.75 && ph < 0.5) ctx.fillRect(x, y + 1, 1, 1);
    });
  }
  function dust(ctx, t, n, seed, col, x0, y0, w, h) {
    field(ctx, t, n, seed, (a, b, c, i) => {
      const x = Math.round(x0 + ((a * w + t * (3 + c * 4) + Math.sin(t * 0.7 + i) * 8) % w + w) % w);
      const y = Math.round(y0 + ((b * h + Math.sin(t * 0.5 + i * 1.3) * 10 + t * (1 + c * 2)) % h + h) % h);
      if (Math.sin(t * 2 + i) > -0.3) { ctx.fillStyle = PAL[col]; ctx.fillRect(x, y, 1, 1); }
    });
  }

  // ------------------------------------------------------------ ladrillo iluminado
  // light(x,y) -> {v: brillo 0..1, warm: 0..1, red: 0..1}
  function bricks(B, x0, y0, w, h, bw, bh, light, ramps, seed) {
    for (let y = y0; y < y0 + h; y++) {
      const row = Math.floor((y - y0) / bh);
      const ly = (y - y0) % bh;
      const off = (row & 1) ? bw >> 1 : 0;
      for (let x = x0; x < x0 + w; x++) {
        const col = Math.floor((x - x0 + off) / bw);
        const lx = (x - x0 + off) % bw;
        let tone;
        if (ly === bh - 1 || lx === bw - 1) tone = 0.12; // mortero
        else {
          tone = 0.55 + (hash(col + seed, row) - 0.5) * 0.22;
          if (ly === 0) tone += 0.16; else if (ly === bh - 2) tone -= 0.12;
          if (lx === 0) tone += 0.06;
          if (hash(x * 1.3 + seed, y * 0.7) < 0.06) tone -= 0.12; // poros
          if (hash(col * 3, row * 5 + seed) < 0.08 && lx > 2 && lx < 6) tone -= 0.25; // grieta
        }
        const L = light(x, y);
        const v = tone * L.v;
        B.set(x, y, pick(chooseRamp(ramps, L, x, y), v, x, y));
      }
    }
  }
  function chooseRamp(ramps, L, x, y) {
    const u = bayer(x + 1, y + 2);
    const wr = L.red || 0, ww = L.warm || 0;
    const s = wr + ww + 0.45;
    if (u < wr / s) return ramps.red || ramps.cold;
    if (u < (wr + ww) / s) return ramps.warm || ramps.cold;
    return ramps.cold;
  }
  const RAMP_COLD = ['0', '1', '2', '3', '4', '5'];
  const RAMP_WARM = ['0', '1', '9', 'e', 'f', 'g', 'h'];
  const RAMP_RED = ['0', '1', '9', 'a', 'b', 'c'];
  const RAMP_WOOD = ['0', '1', 'e', 'f', 'g'];

  function lightAt(lights, x, y, amb) {
    let v = amb, warm = 0, red = 0;
    for (let i = 0; i < lights.length; i++) {
      const L = lights[i];
      const dx = (x - L.x) / (L.sx || 1), dy = (y - L.y) / (L.sy || 1);
      const d = Math.sqrt(dx * dx + dy * dy) / L.r;
      if (d >= 1) continue;
      const k = (1 - d) * (1 - d) * L.s;
      v += k;
      if (L.kind === 'warm') warm += k; else if (L.kind === 'red') red += k;
    }
    return { v: Math.min(1.4, v), warm: Math.min(1, warm * 1.4), red: Math.min(1, red * 1.4) };
  }

  // arco gótico (apuntado) — test de punto dentro
  function inArch(x, y, ax, ay, aw, ah) {
    const half = aw / 2;
    const cx = ax + half;
    if (x < ax || x >= ax + aw || y >= ay + ah) return false;
    const springY = ay + half * 1.0;
    if (y >= springY) return true;
    // dos arcos de radio aw centrados en los lados opuestos
    const r = aw * 0.9;
    const dy = y - springY;
    const dl = Math.hypot(x - (ax + aw - r), dy), dr = Math.hypot(x - (ax + r), dy);
    return x < cx ? dl <= r : dr <= r;
  }

  // ================================================================ FONDOS
  const SCN = {}; // escena -> {base: canvas, draw(ctx,t)}

  // ---------- TÍTULO: sala gótica del bar con rosetón infernal, telones y velas
  function buildTitle() {
    const B = Buf(W, H);
    const lights = [
      { x: 320, y: 96, r: 230, s: 0.75, kind: 'red', sy: 0.8 },
      { x: 128, y: 168, r: 110, s: 0.75, kind: 'warm' },
      { x: 512, y: 168, r: 110, s: 0.75, kind: 'warm' },
      { x: 320, y: 360, r: 260, s: 0.25, kind: 'red', sy: 0.5 },
    ];
    const L = (x, y) => { const l = lightAt(lights, x, y, 0.32); l.v *= 0.65 + 0.35 * Math.min(1, y / 120); return l; };
    bricks(B, 0, 0, W, 262, 20, 10, L, { cold: RAMP_COLD, warm: RAMP_WARM, red: RAMP_RED }, 3);
    // zócalo de madera
    for (let y = 262; y < 276; y++) for (let x = 0; x < W; x++) {
      const l = L(x, y);
      let tone = y === 262 ? 0.9 : y === 263 ? 0.7 : y === 275 ? 0.15 : 0.45 + (hash(x >> 3, 1) - 0.5) * 0.15;
      if (x % 40 === 0) tone = 0.2;
      B.set(x, y, pick(RAMP_WOOD, tone * l.v, x, y));
    }
    // suelo de baldosas en perspectiva (ajedrez)
    for (let y = 276; y < H; y++) {
      const z = 1 / ((y - 262) / 98);
      for (let x = 0; x < W; x++) {
        const u = (x - 320) * z / 34, v = z * 3.2;
        const chk = ((Math.floor(u) + Math.floor(v)) & 1);
        const l = L(x, y);
        let tone = chk ? 0.5 : 0.22;
        const fu = u - Math.floor(u), fv = v - Math.floor(v);
        if (fu < 0.04 * z || fv < 0.05) tone = 0.08;
        const fade = Math.min(1, (y - 276) / 60 + 0.25);
        B.set(x, y, pick(chooseRamp({ cold: RAMP_COLD, red: RAMP_RED, warm: RAMP_WARM }, l, x, y), tone * l.v * fade, x, y));
      }
    }
    // rosetón
    const cx = 320, cy = 96, R = 78;
    for (let y = cy - R - 6; y <= cy + R + 6; y++) for (let x = cx - R - 6; x <= cx + R + 6; x++) {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > R + 5) continue;
      const a = Math.atan2(dy, dx);
      if (d > R) { // marco de piedra exterior
        const tone = d > R + 4 ? 0.1 : 0.45 + (dy < 0 ? 0.25 : 0) - (d > R + 3 ? 0.2 : 0);
        B.set(x, y, pick(['0', '1', '2', '3', '4', '5', '6'], tone, x, y));
        continue;
      }
      // tracería: anillos y 12 radios
      const seg = 12;
      const as = ((a / (Math.PI * 2)) * seg + seg) % 1;
      const spokeW = 1.6 / Math.max(8, d) * seg / (Math.PI * 2);
      const onSpoke = d > 24 && (as < spokeW || as > 1 - spokeW);
      const onRing = Math.abs(d - 24) < 1.6 || Math.abs(d - 52) < 1.3 || Math.abs(d - R + 1) < 1.5;
      // pétalos (arcos lobulados) en el anillo exterior
      const lobe = Math.abs(d - (52 + 13 * Math.sin(as * Math.PI))) < 1.0 && d > 52;
      if (onSpoke || onRing || lobe) {
        const tone = (dy < 0 ? 0.55 : 0.35) + (onRing ? 0.1 : 0);
        B.set(x, y, pick(['0', '1', '2', '3', '4'], tone, x, y));
        continue;
      }
      // vidrio: rojo sangre / magenta alternando, más brillante al centro
      const pane = Math.floor(((a / (Math.PI * 2)) * seg + seg) % seg);
      const glow = 1 - d / R;
      let ramp;
      if (d < 24) ramp = ['9', 'a', 'b', 'c', 'd', 'v'];
      else if (d < 52) ramp = pane & 1 ? ['1', '9', 'a', 'b', 'c'] : ['1', 's', 't', 'u'];
      else ramp = pane & 1 ? ['1', 's', 't'] : ['1', '9', 'a', 'b'];
      const flick = hash(pane * 7, Math.floor(d / 6)) * 0.18;
      B.set(x, y, pick(ramp, 0.25 + glow * 0.6 + flick, x, y));
    }
    // ojo/pentáculo central del rosetón: un "8" ardiente
    const m = B.toCanvas();
    const g = m.g, ctx = m.ctx;
    // telones de terciopelo a los lados
    const curtain = (x0, w, flip) => {
      for (let x = 0; x < w; x++) {
        const fold = Math.sin(x / 7 * Math.PI) * 0.5 + 0.5;
        for (let y = 0; y < H; y++) {
          const gx = flip ? x0 + w - 1 - x : x0 + x;
          const edgeWave = Math.round(w - 6 - Math.max(0, (y - 150)) * 0.18 + Math.sin(y * 0.09) * 2);
          if (x > edgeWave) continue;
          let v = 0.18 + fold * 0.55 - (y / H) * 0.15;
          if (x === edgeWave) v = 0.05;
          const col = pick(['0', '9', 'a', 'b', 'c'], v, gx, y);
          ctx.fillStyle = PAL[col]; ctx.fillRect(gx, y, 1, 1);
        }
      }
      // cenefa con flecos dorados
      for (let x = 0; x < w + 30; x++) {
        const gx = flip ? x0 + w - 1 - x : x0 + x;
        const hh = 14 + Math.round(Math.sin((x / (w + 30)) * Math.PI) * 10);
        for (let y = 0; y < hh; y++) { const v = 0.6 - y / hh * 0.35 + ((x % 9) < 4 ? 0.1 : 0); ctx.fillStyle = PAL[pick(['9', 'a', 'b', 'c'], v, gx, y)]; ctx.fillRect(gx, y, 1, 1); }
        ctx.fillStyle = PAL['0']; ctx.fillRect(gx, hh, 1, 1);
        if (x % 3 === 0) { ctx.fillStyle = PAL['h']; ctx.fillRect(gx, hh, 1, 3); ctx.fillStyle = PAL['g']; ctx.fillRect(gx, hh + 3, 1, 1); }
      }
    };
    curtain(0, 54, false);
    curtain(W - 54, 54, true);
    // candelabros de pared (latón) con 3 velas
    const sconce = (x, y) => {
      g.rect(x - 14, y + 6, 29, 3, '0'); g.rect(x - 13, y + 6, 27, 1, 'h'); g.rect(x - 13, y + 7, 27, 1, 'g');
      g.rect(x - 1, y + 8, 3, 14, '0'); g.rect(x, y + 8, 1, 13, 'g');
      g.rect(x - 4, y + 20, 9, 4, '0'); g.rect(x - 3, y + 20, 7, 2, 'g'); g.p(x - 2, y + 20, 'i');
      [-11, 0, 11].forEach((dx, i) => {
        g.rect(x + dx - 3, y + 4, 7, 3, '0'); g.rect(x + dx - 2, y + 4, 5, 1, 'h'); g.rect(x + dx - 2, y + 5, 5, 1, 'f');
        candleBody(g, x + dx - 1, y - (i === 1 ? 10 : 6), i === 1 ? 14 : 10);
      });
    };
    sconce(128, 160); sconce(512, 160);
    // mesa de billar en primer plano (silueta abajo)
    g.rect(150, 326, 340, 40, '0');
    g.rect(150, 324, 340, 4, 'e'); g.rect(150, 324, 340, 1, 'g');
    g.rect(156, 320, 328, 4, 'j'); g.rect(156, 320, 328, 1, 'k');
    g.rect(146, 322, 10, 10, '0'); g.rect(484, 322, 10, 10, '0');
    g.rect(147, 323, 8, 3, 'g'); g.rect(485, 323, 8, 3, 'g');
    g.p(148, 323, 'i'); g.p(486, 323, 'i');
    g.rect(160, 330, 320, 1, 'e');
    for (let i = 0; i < 4; i++) g.rect(200 + i * 80, 332, 2, 2, 'f');
    return m.c;
  }
  function drawTitle(ctx, t) {
    const base = SCN.title.base;
    ctx.drawImage(base, 0, 0);
    // pulso del rosetón (brillo rojo del infierno)
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
    drawHalo(ctx, 320, 96, 64, 'c', 0.10 + pulse * 0.08);
    drawHalo(ctx, 320, 96, 26, 'v', 0.12 + pulse * 0.12);
    // cadenas colgantes con leve balanceo
    chain(ctx, 70, 0, 110, Math.sin(t * 0.8) * 3);
    chain(ctx, 96, 0, 70, Math.sin(t * 0.9 + 1) * 2);
    chain(ctx, 570, 0, 96, Math.sin(t * 0.7 + 2) * 3);
    chain(ctx, 546, 0, 140, Math.sin(t * 0.85 + 3) * 3);
    // velas de los candelabros
    [[117, 154], [128, 150], [139, 154], [501, 154], [512, 150], [523, 154]].forEach(([x, y], i) => {
      const yy = i % 3 === 1 ? y - 0 : y;
      flame(ctx, x, (i % 3 === 1 ? 150 : 154) - 0, t, i, true);
    });
    const fl = (i) => 0.16 + 0.05 * Math.sin(t * 11 + i * 2) + 0.03 * Math.sin(t * 27 + i);
    drawHalo(ctx, 128, 146, 46, 'h', fl(0));
    drawHalo(ctx, 512, 146, 46, 'h', fl(1));
    drawHalo(ctx, 128, 146, 16, 'i', fl(0) + 0.1);
    drawHalo(ctx, 512, 146, 16, 'i', fl(1) + 0.1);
    // niebla baja y ascuas
    drawFog(ctx, 236, 70, '4', 0.35, 6, t, 1);
    drawFog(ctx, 270, 90, '5', 0.22, -10, t, 2);
    embers(ctx, t, 46, 3, ['i', 'v', 'b'], 40, 360, 22);
    dust(ctx, t, 30, 9, '6', 230, 20, 180, 170);
  }

  // ---------- TIENDA: estanterías del diablo, lámpara colgante, mostrador
  function buildShop() {
    const B = Buf(W, H);
    const lights = [
      { x: 320, y: 70, r: 300, s: 0.9, kind: 'warm', sy: 0.8 },
      { x: 560, y: 150, r: 90, s: 0.3, kind: 'red' },
    ];
    const L = (x, y) => lightAt(lights, x, y, 0.18);
    // tablones verticales
    for (let y = 0; y < 262; y++) for (let x = 0; x < W; x++) {
      const pl = Math.floor(x / 22), lx = x % 22;
      let tone = 0.5 + (hash(pl, 3) - 0.5) * 0.2;
      tone += Math.sin((y + hash(pl, 9) * 80) * 0.11 + Math.sin(x * 0.4) * 0.6) * 0.06; // veta
      if (lx === 0) tone = 0.1; else if (lx === 1) tone += 0.15; else if (lx === 21) tone -= 0.15;
      if ((y + pl * 37) % 90 === 0 && lx > 2) tone = 0.15; // junta horizontal
      if (hash(x, y) < 0.02) tone -= 0.15;
      const l = L(x, y);
      B.set(x, y, pick(chooseRamp({ cold: ['0', '1', '2', 'e', 'f'], warm: RAMP_WOOD.concat(['h']), red: RAMP_RED }, l, x, y), tone * l.v, x, y));
    }
    // mostrador
    for (let y = 262; y < H; y++) for (let x = 0; x < W; x++) {
      let tone;
      if (y < 266) tone = y === 262 ? 0.95 : 0.7;
      else if (y < 270) tone = 0.25;
      else {
        const px = x % 80, py = (y - 270);
        tone = 0.45;
        if (px < 3 || px > 76 || py < 3) tone = 0.25;
        else if (px < 5 || py < 5) tone = 0.62;
        tone += Math.sin(x * 0.3 + y * 0.05) * 0.05;
      }
      const l = L(x, y);
      B.set(x, y, pick(RAMP_WOOD.concat(['h']), tone * Math.min(1, l.v * 1.1), x, y));
    }
    const m = B.toCanvas();
    const g = m.g;
    // latón del mostrador
    g.rect(0, 266, W, 1, 'g'); g.rect(0, 267, W, 1, 'e');
    for (let x = 40; x < W; x += 80) { g.rect(x - 1, 280, 3, 3, '0'); g.p(x, 281, 'h'); }
    // puerta oscura (donde acecha el tendero)
    const dx = 520, dy = 96, dw = 70, dh = 166;
    for (let y = dy - 6; y < dy + dh; y++) for (let x = dx - 6; x < dx + dw + 6; x++) {
      if (inArch(x, y, dx, dy, dw, dh)) { m.ctx.fillStyle = PAL[pick(['0', '0', '1', '2'], 0.35 - (y - dy) / dh * 0.2, x, y)]; m.ctx.fillRect(x, y, 1, 1); }
      else if (inArch(x, y, dx - 5, dy - 5, dw + 10, dh + 5)) { m.ctx.fillStyle = PAL[pick(['0', 'e', 'f', 'g'], 0.4 + (x < dx ? 0.2 : 0), x, y)]; m.ctx.fillRect(x, y, 1, 1); }
    }
    // estanterías
    const shelves = [64, 130, 196];
    const glass = [['k', 'l', 'm', 'n'], ['s', 't', 'u', '8'], ['o', 'p', 'q', 'r'], ['9', 'a', 'b', 'c'], ['e', 'f', 'v', 'h']];
    let seed = 1;
    shelves.forEach((sy, si) => {
      const x0 = 30, x1 = 500;
      g.rect(x0, sy, x1 - x0, 5, '0'); g.rect(x0, sy, x1 - x0, 1, 'g'); g.rect(x0, sy + 1, x1 - x0, 2, 'f'); g.rect(x0, sy + 3, x1 - x0, 1, 'e');
      // ménsulas
      for (let bx = x0 + 10; bx < x1; bx += 90) { g.rect(bx, sy + 5, 3, 6, '0'); g.rect(bx, sy + 5, 1, 5, 'e'); }
      // objetos
      let x = x0 + 6;
      while (x < x1 - 16) {
        const r = hash(x * 0.37, si * 13 + seed);
        const kind = r < 0.5 ? 'bottle' : r < 0.65 ? 'jar' : r < 0.8 ? 'skull' : r < 0.9 ? 'books' : 'candle';
        if (kind === 'bottle') {
          const gl = glass[Math.floor(hash(x, si) * glass.length)];
          const bh = 14 + Math.floor(hash(x, si + 4) * 12), bw = 7 + Math.floor(hash(si, x) * 4);
          const top = sy - bh;
          g.rect(x - 1, top + 5, bw + 2, bh - 4, '0');
          g.rect(x + (bw >> 1) - 2, top - 1, 5, 7, '0');
          g.rect(x, top + 6, bw, bh - 6, gl[1]);
          g.rect(x, top + 6 + Math.floor((bh - 6) * 0.35), bw, Math.ceil((bh - 6) * 0.65), gl[2]);
          g.rect(x + (bw >> 1) - 1, top, 3, 6, gl[1]);
          g.rect(x + 1, top + 7, 1, bh - 9, gl[3]);
          g.p(x + (bw >> 1) - 1, top, 'e'); g.p(x + (bw >> 1), top, 'f'); g.p(x + (bw >> 1) + 1, top, 'e');
          if (hash(x, 7) < 0.5) { g.rect(x + 1, top + 10, bw - 2, 4, '7'); g.rect(x + 2, top + 11, bw - 4, 1, '6'); }
          x += bw + 3 + Math.floor(hash(x, 2) * 4);
        } else if (kind === 'jar') {
          const jw = 12, jh = 13, top = sy - jh;
          g.rect(x - 1, top, jw + 2, jh, '0');
          g.rect(x, top + 3, jw, jh - 3, 'k'); g.rect(x, top + 3, jw, 3, 'l'); g.rect(x + 1, top + 4, 1, jh - 6, 'n');
          g.rect(x + 1, top, jw - 2, 3, 'g'); g.rect(x + 1, top, jw - 2, 1, 'h');
          // ojo flotando
          g.rect(x + 4, top + 6, 4, 4, '7'); g.rect(x + 5, top + 7, 2, 2, 'c'); g.p(x + 6, top + 8, '0');
          x += jw + 4;
        } else if (kind === 'skull') {
          const top = sy - 9;
          g.rows(x, top, [
            '.00000.',
            '0777770',
            '7787877',
            '7007007',
            '7777777',
            '0770770',
            '.07870.',
            '.06060.',
            '..000..',
          ], { '0': '0' });
          x += 10;
        } else if (kind === 'books') {
          const cols = ['a', 'p', 'l', 's', 'f'];
          for (let b = 0; b < 4; b++) {
            const bh = 14 + Math.floor(hash(x + b, 3) * 6), c = cols[Math.floor(hash(b, x) * cols.length)];
            g.rect(x + b * 4, sy - bh, 4, bh, '0'); g.rect(x + b * 4 + 1, sy - bh + 1, 2, bh - 1, c); g.p(x + b * 4 + 1, sy - bh + 4, 'h'); g.p(x + b * 4 + 2, sy - bh + 4, 'h');
          }
          x += 20;
        } else {
          candleBody(g, x + 1, sy - 8, 8);
          SHOP_CANDLES.push([x + 2, sy - 9]);
          x += 9;
        }
        seed++;
      }
    });
    // monedas y calavera sobre el mostrador
    for (let i = 0; i < 6; i++) { const cx = 70 + i * 3, cy = 260 - i * 2; g.rect(cx - 1, cy, 9, 3, '0'); g.rect(cx, cy, 7, 1, 'i'); g.rect(cx, cy + 1, 7, 1, 'g'); }
    for (let i = 0; i < 4; i++) { const cx = 90, cy = 260 - i * 2; g.rect(cx - 1, cy, 9, 3, '0'); g.rect(cx, cy, 7, 1, 'i'); g.rect(cx, cy + 1, 7, 1, 'g'); }
    candleBody(g, 586, 238, 22, 5); SHOP_CANDLES.push([588, 237, 1]);
    candleBody(g, 600, 248, 12, 4); SHOP_CANDLES.push([601, 247, 1]);
    return m.c;
  }
  const SHOP_CANDLES = [];
  function drawShop(ctx, t) {
    ctx.drawImage(SCN.shop.base, 0, 0);
    // lámpara colgante que se balancea
    const sw = Math.sin(t * 1.1) * 4;
    const lx = Math.round(320 + sw), ly = 46;
    ctx.fillStyle = PAL['0'];
    for (let y = 0; y < ly - 6; y += 1) { const xx = Math.round(320 + sw * (y / ly)); ctx.fillRect(xx, y, 1, 1); if (y % 4 === 0) { ctx.fillStyle = PAL['5']; ctx.fillRect(xx, y, 1, 1); ctx.fillStyle = PAL['0']; } }
    drawHalo(ctx, lx, ly + 6, 120, 'h', 0.07 + 0.015 * Math.sin(t * 9));
    drawHalo(ctx, lx, ly + 6, 40, 'i', 0.16 + 0.03 * Math.sin(t * 13));
    const R = (x, y, w, h, c) => { ctx.fillStyle = PAL[c]; ctx.fillRect(x, y, w, h); };
    R(lx - 8, ly - 7, 17, 4, '0'); R(lx - 7, ly - 6, 15, 2, 'g'); R(lx - 7, ly - 6, 15, 1, 'h');
    R(lx - 6, ly - 3, 13, 12, '0'); R(lx - 5, ly - 3, 11, 11, 'v'); R(lx - 4, ly - 2, 9, 9, 'h'); R(lx - 2, ly - 1, 4, 6, 'i'); R(lx - 1, ly, 2, 3, '8');
    R(lx - 5, ly - 3, 1, 11, 'f'); R(lx + 5, ly - 3, 1, 11, 'f'); R(lx, ly - 3, 1, 11, 'f');
    R(lx - 8, ly + 9, 17, 3, '0'); R(lx - 7, ly + 9, 15, 1, 'g');
    R(lx - 1, ly + 12, 3, 2, '0'); R(lx, ly + 12, 1, 1, 'g');
    // velas
    SHOP_CANDLES.forEach(([x, y, big], i) => { flame(ctx, x, y, t, i, !!big); drawHalo(ctx, x, y - 3, big ? 22 : 12, 'h', 0.12 + 0.04 * Math.sin(t * 10 + i)); });
    // ojos del tendero en la puerta (parpadean)
    const blink = (t % 4.3) < 0.14 || ((t + 0.9) % 7.1) < 0.12;
    const look = Math.round(Math.sin(t * 0.6) * 2);
    if (!blink) {
      R(546 + look, 150, 4, 2, 'c'); R(560 + look, 150, 4, 2, 'c');
      R(547 + look, 150, 2, 1, 'i'); R(561 + look, 150, 2, 1, 'i');
      drawHalo(ctx, 555 + look, 151, 14, 'b', 0.25);
    } else { R(546 + look, 151, 4, 1, 'a'); R(560 + look, 151, 4, 1, 'a'); }
    dust(ctx, t, 50, 4, '7', 200, 40, 240, 220);
    drawFog(ctx, 300, 60, '1', 0.4, 5, t, 3);
  }

  // ---------- MAPA: el embudo de los seis círculos con lava al fondo
  function buildMap() {
    const B = Buf(W, H);
    // cielo de caverna: degradado a rojo lava hacia abajo
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - 320) / 320, dy = (y - 380) / 300;
      const d = Math.sqrt(dx * dx * 0.6 + dy * dy);
      const v = clamp(1.05 - d, 0, 1);
      const n = (hash(x >> 2, y >> 2) - 0.5) * 0.06;
      B.set(x, y, pick(['0', '1', '2', '9', 'a', 'b', 'v', 'h'], v * 0.95 + n, x, y));
    }
    // anillos (círculos del infierno) de arriba (grande) a abajo (pequeño)
    for (let i = 0; i < 6; i++) {
      const cy = 64 + i * 46, rx = 330 - i * 44, ry = 18 - i * 1.6, th = 10 - i;
      for (let y = Math.floor(cy - ry - 2); y < cy + ry + th + 2; y++) for (let x = Math.floor(320 - rx - 2); x < 320 + rx + 2; x++) {
        const nx = (x - 320) / rx;
        if (Math.abs(nx) > 1) continue;
        const ey = Math.sqrt(1 - nx * nx) * ry;
        const top = cy + ey; // borde frontal del anillo (labio inferior de la elipse)
        const back = cy - ey;
        const jag = Math.round((hash(x >> 1, i) - 0.5) * 3);
        if (y >= top + jag && y < top + th + jag) {
          // pared frontal del saliente: iluminada desde abajo por la lava
          const k = (y - top - jag) / th;
          const v = 0.25 + k * 0.45 + (1 - Math.abs(nx)) * 0.2 + (i * 0.04);
          B.set(x, y, pick(['0', '1', '9', 'a', 'b', 'd'], v + (hash(x, y) - 0.5) * 0.1, x, y));
        } else if (y >= top - 2 + jag && y < top + jag) {
          B.set(x, y, pick(['2', '3', '4', '5'], 0.4 + (1 - Math.abs(nx)) * 0.4, x, y)); // canto superior
        } else if (y >= back && y < top - 2 + jag) {
          // repisa (suelo del círculo): piedra púrpura oscura
          const v = 0.3 + (y - back) / (top - back + 1) * 0.2 + (hash(x >> 1, y >> 1) - 0.5) * 0.1;
          B.set(x, y, pick(['0', '1', '2', '3'], v, x, y));
        }
      }
    }
    // paredes rocosas laterales con estalactitas
    for (let x = 0; x < W; x++) {
      const side = Math.min(x, W - 1 - x);
      const edge = 70 - side * 0.9 + Math.sin(x * 0.11) * 8 + Math.sin(x * 0.37) * 4;
      for (let y = 0; y < H; y++) {
        const wallX = 40 + Math.sin(y * 0.05) * 10 + Math.sin(y * 0.17) * 5 + y * 0.12;
        if (side < wallX) {
          const v = 0.15 + (side / wallX) * 0.3 + (hash(x >> 2, y >> 2) - 0.5) * 0.15 + (y / H) * 0.15;
          B.set(x, y, pick(['0', '1', '2', '9', 'a'], v, x, y));
        }
      }
      // estalactitas arriba
      const st = Math.max(0, edge * 0.4 + (hash(x >> 2, 1) < 0.3 ? hash(x >> 2, 4) * 26 : 0));
      for (let y = 0; y < st; y++) B.set(x, y, pick(['0', '1', '2'], 0.4 - y / Math.max(1, st) * 0.3, x, y));
    }
    return B.toCanvas().c;
  }
  function drawMap(ctx, t) {
    ctx.drawImage(SCN.map.base, 0, 0);
    const p = 0.5 + 0.5 * Math.sin(t * 1.7);
    drawHalo(ctx, 320, 350, 120, 'v', 0.08 + p * 0.06);
    drawHalo(ctx, 320, 356, 50, 'h', 0.10 + p * 0.08);
    drawFog(ctx, 120, 60, '9', 0.22, 7, t, 4);
    drawFog(ctx, 210, 70, 'a', 0.16, -9, t, 5);
    embers(ctx, t, 60, 11, ['i', 'v', 'b'], 0, 360, 30);
    // ceniza que cae
    field(ctx, t, 40, 21, (a, b, c, i) => {
      const y = Math.round(((b * H + t * (8 + c * 10)) % H));
      const x = Math.round(a * W + Math.sin(t + i) * 5);
      ctx.fillStyle = PAL[c > 0.5 ? '5' : '4']; ctx.fillRect(x, y, 1, 1);
    });
  }

  // ---------- GAME OVER: bola 8 agrietada gigante, sangre que gotea
  const GO_DRIPS = [];
  function buildGameover() {
    const B = Buf(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - 320) / 360, dy = (y - 170) / 220;
      const v = clamp(0.7 - Math.sqrt(dx * dx + dy * dy), 0, 1);
      B.set(x, y, pick(['0', '1', '9', 'a'], v * 0.8 + (hash(x >> 1, y >> 1) - 0.5) * 0.05, x, y));
    }
    // bola 8 gigante en sombra con grieta
    const cx = 320, cy = 170, R = 100;
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > R) continue;
      const nz = Math.sqrt(1 - (d / R) * (d / R));
      const lit = clamp((-dx * 0.4 - dy * 0.6) / R * 0.5 + nz * 0.5, 0, 1);
      let col = pick(['0', '1', '2', '3'], lit * 0.75, x, y);
      if (d > R - 3 && dy > 0) col = pick(['9', 'a', 'b'], (d - R + 3) / 3 * (dy / R) + 0.2, x, y); // borde rojo
      // círculo blanco del "8"
      const wx = x - (cx - 14), wy = y - (cy - 20);
      if (wx * wx + wy * wy < 40 * 40) col = pick(['1', '2', '3', '4', '5'], 0.3 + lit * 0.5, x, y);
      B.set(x, y, col);
    }
    const m = B.toCanvas();
    const g = m.g;
    // el "8" (dos anillos) sobre el círculo
    const ring8 = (x, y, r, th) => { for (let k = 0; k < th; k++) g.ring(x, y, r - k, '1'); };
    ring8(cx - 14, cy - 40, 13, 6); ring8(cx - 14, cy - 2, 17, 7);
    // grieta brillante
    let x = cx + 40, y = cy - R + 8;
    const crack = [[x, y]];
    for (let i = 0; i < 22; i++) { x += Math.round((hash(i, 3) - 0.6) * 10); y += 8 + Math.round(hash(i, 5) * 4); crack.push([x, y]); if (Math.hypot(x - cx, y - cy) > R - 4) break; }
    for (let i = 1; i < crack.length; i++) { g.line(crack[i - 1][0] + 1, crack[i - 1][1], crack[i][0] + 1, crack[i][1], '0'); g.line(crack[i - 1][0], crack[i - 1][1], crack[i][0], crack[i][1], 'b'); }
    GO_CRACK = crack;
    // goterones desde arriba
    for (let i = 0; i < 64; i++) {
      const dx = Math.floor(hash(i, 77) * W), len = 4 + Math.floor(hash(i, 78) ** 2 * 60), w = hash(i, 79) < 0.3 ? 2 : 1;
      g.rect(dx, 0, w, len, 'a'); g.rect(dx, 0, w, Math.max(1, len - 3), 'b');
      g.rect(dx - (w === 2 ? 0 : 1), len - 2, w + (w === 2 ? 1 : 2), 3, 'a'); g.p(dx, len - 2, 'c');
      if (len > 30) GO_DRIPS.push([dx + (w === 2 ? 1 : 0), len + 1, hash(i, 80)]);
    }
    g.rect(0, 0, W, 3, 'a'); g.rect(0, 0, W, 1, '9');
    return m.c;
  }
  let GO_CRACK = [];
  function drawGameover(ctx, t) {
    ctx.drawImage(SCN.gameover.base, 0, 0);
    // latido
    const beat = Math.max(0, Math.sin(t * 2.4)) ** 8 + Math.max(0, Math.sin(t * 2.4 - 0.6)) ** 8 * 0.6;
    drawHalo(ctx, 320, 170, 170, 'b', 0.05 + beat * 0.1);
    // brillo de la grieta
    ctx.fillStyle = PAL['c'];
    GO_CRACK.forEach(([x, y], i) => { if (Math.sin(t * 3 - i * 0.6) > 0.4) ctx.fillRect(x, y, 1, 1); });
    // gotas que caen
    GO_DRIPS.forEach(([x, y0, r], i) => {
      const per = 2.2 + r * 3;
      const ph = ((t + r * 10) % per) / per;
      if (ph < 0.55) { const s = ph / 0.55; ctx.fillStyle = PAL['b']; ctx.fillRect(x, y0 - 1, 1, Math.round(s * 2)); }
      else { const yy = y0 + Math.round(((ph - 0.55) / 0.45) ** 2 * (H - y0)); ctx.fillStyle = PAL['c']; ctx.fillRect(x, yy, 1, 2); ctx.fillStyle = PAL['a']; ctx.fillRect(x, yy + 2, 1, 1); }
    });
    drawFog(ctx, 280, 80, '9', 0.35, 4, t, 6);
    // ceniza
    field(ctx, t, 50, 31, (a, b, c, i) => {
      const y = Math.round(((b * H + t * (6 + c * 9)) % H));
      const x = Math.round(a * W + Math.sin(t * 0.8 + i) * 7);
      ctx.fillStyle = PAL[c > 0.6 ? '6' : '5']; ctx.fillRect(x, y, 1, 1);
    });
  }

  // ---------- VICTORIA: amanecer dorado fuera del infierno, rayos y monedas
  let RAYS = null;
  function buildVictory() {
    const B = Buf(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - 320) / 400, dy = (y - 150) / 260;
      const d = Math.sqrt(dx * dx + dy * dy);
      const v = clamp(1 - d * 1.15, 0, 1);
      B.set(x, y, pick(['1', '2', 's', 't', 'b', 'v', 'h', 'i', '8'], v + (hash(x >> 2, y >> 3) - 0.5) * 0.04, x, y));
    }
    // nubes en capas
    for (let k = 0; k < 3; k++) {
      const base = 220 + k * 30;
      for (let x = 0; x < W; x++) {
        const top = base - (Math.sin(x * 0.03 + k * 2) * 10 + Math.sin(x * 0.081 + k) * 6 + Math.abs(Math.sin(x * 0.013 + k * 4)) * 18);
        for (let y = Math.floor(top); y < H; y++) {
          const v = 0.55 - k * 0.12 - (y - top) * 0.01 + (y - top < 2 ? 0.3 : 0);
          B.set(x, y, pick(['1', '2', '3', '4', '5', '6', '7'], v, x, y));
        }
      }
    }
    const m = B.toCanvas();
    const g = m.g;
    // puertas del infierno abiertas (silueta)
    const gate = (x0, flip) => {
      for (let y = 120; y < H; y++) for (let x = 0; x < 120; x++) {
        const gx = flip ? W - 1 - (x0 + x) : x0 + x;
        const r = (y - 120) / 240;
        if (x > 60 + r * 40 + Math.sin(y * 0.1) * 2) continue;
        let c = '1';
        if (x % 14 === 0 || y % 30 === 0) c = '0';
        if ((x % 14 === 1) && y % 6 < 3) c = '3';
        g.p(gx, y, c);
      }
      // púas
      for (let x = 0; x < 64; x += 7) { const gx = flip ? W - 1 - (x0 + x) : x0 + x; g.rect(gx - 1, 112, 3, 8, '0'); g.p(gx, 108, '0'); g.p(gx, 110, '1'); }
    };
    gate(0, false); gate(0, true);
    // rayos (rueda pre-renderizada)
    const rs = 760;
    const rm = mk(rs, rs);
    rm.ctx.fillStyle = PAL['i'];
    for (let y = 0; y < rs; y++) for (let x = 0; x < rs; x++) {
      const a = Math.atan2(y - rs / 2, x - rs / 2);
      const s = Math.sin(a * 12);
      const d = Math.hypot(x - rs / 2, y - rs / 2);
      if (s > 0.55 && d > 30 && bayer(x, y) < 0.9 - d / rs) rm.ctx.fillRect(x, y, 1, 1);
    }
    RAYS = rm.c;
    return m.c;
  }
  function drawVictory(ctx, t) {
    ctx.drawImage(SCN.victory.base, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.05 * Math.sin(t * 2);
    ctx.translate(320, 150);
    ctx.rotate(t * 0.12);
    ctx.drawImage(RAYS, -RAYS.width / 2, -RAYS.height / 2);
    ctx.restore();
    drawHalo(ctx, 320, 150, 70, '8', 0.18 + 0.05 * Math.sin(t * 3));
    // destellos
    field(ctx, t, 30, 41, (a, b, c, i) => {
      const s = Math.sin(t * (2 + c * 3) + i * 1.7);
      if (s < 0.6) return;
      const x = Math.round(a * W), y = Math.round(b * 220);
      ctx.fillStyle = PAL[s > 0.9 ? '8' : 'i'];
      ctx.fillRect(x, y, 1, 1);
      if (s > 0.85) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    });
    // monedas que caen girando
    field(ctx, t, 18, 51, (a, b, c, i) => {
      const y = Math.round(((b * (H + 20) + t * (30 + c * 30)) % (H + 20)) - 10);
      const x = Math.round(a * W + Math.sin(t * 1.5 + i) * 10);
      const ph = Math.floor((t * 8 + i) % 4);
      const w = [5, 3, 1, 3][ph];
      ctx.fillStyle = PAL['0']; ctx.fillRect(x - (w >> 1) - 1, y - 1, w + 2, 7);
      ctx.fillStyle = PAL[ph === 2 ? 'g' : 'h']; ctx.fillRect(x - (w >> 1), y, w, 5);
      if (w > 1) { ctx.fillStyle = PAL['i']; ctx.fillRect(x - (w >> 1), y, 1, 3); }
    });
    embers(ctx, t, 40, 13, ['8', 'i', 'h'], 100, 360, 20);
    drawFog(ctx, 270, 90, '7', 0.18, 8, t, 7);
  }

  SCN.title = { build: buildTitle, draw: drawTitle };
  SCN.shop = { build: buildShop, draw: drawShop };
  SCN.map = { build: buildMap, draw: drawMap };
  SCN.gameover = { build: buildGameover, draw: drawGameover };
  SCN.victory = { build: buildVictory, draw: drawVictory };

  function drawBackground(ctx, t, scene) {
    const s = SCN[scene] || SCN.title;
    if (!s.base) s.base = s.build();
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    s.draw(ctx, t || 0);
    ctx.imageSmoothingEnabled = prev;
  }

  // ================================================================== LOGO
  // "OCHO" (latón, x4) con la bola 8 cornuda como primera O, y "MALDITO" (sangre, x3) con goteo.
  // Las letras salen de la fuente display escaladas con Scale2x/Scale3x (diagonales suaves).
  function glyphMask(text, gap) {
    const GL = OM.FONT.glyphs[2];
    let w = 0;
    const parts = [];
    for (const ch of text) { const g = GL[ch]; parts.push([w, g]); w += g.w + gap; }
    w -= gap;
    const h = 11;
    const m = new Uint8Array(w * h);
    parts.forEach(([ox, g]) => g.px.forEach(([x, y]) => { if (y >= 0 && y < h) m[y * w + ox + x] = 1; }));
    return { w, h, m };
  }
  function scale2x(M) {
    const { w, h, m } = M, W2 = w * 2, o = new Uint8Array(W2 * h * 2);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      const e0 = C === A && C !== D && A !== B ? A : P;
      const e1 = A === B && A !== C && B !== D ? B : P;
      const e2 = D === C && D !== B && C !== A ? C : P;
      const e3 = B === D && B !== A && D !== C ? D : P;
      o[(y * 2) * W2 + x * 2] = e0; o[(y * 2) * W2 + x * 2 + 1] = e1; o[(y * 2 + 1) * W2 + x * 2] = e2; o[(y * 2 + 1) * W2 + x * 2 + 1] = e3;
    }
    return { w: W2, h: h * 2, m: o };
  }
  function scale3x(M) {
    const { w, h, m } = M, W3 = w * 3, o = new Uint8Array(W3 * h * 3);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), F = at(x + 1, y), G = at(x - 1, y + 1), Hh = at(x, y + 1), I = at(x + 1, y + 1);
      const r = [];
      r[0] = D === B && B !== F && D !== Hh ? D : E;
      r[1] = (D === B && B !== F && D !== Hh && E !== C) || (B === F && B !== D && F !== Hh && E !== A) ? B : E;
      r[2] = B === F && B !== D && F !== Hh ? F : E;
      r[3] = (D === B && B !== F && D !== Hh && E !== G) || (D === Hh && D !== B && Hh !== F && E !== A) ? D : E;
      r[4] = E;
      r[5] = (B === F && B !== D && F !== Hh && E !== I) || (Hh === F && D !== Hh && B !== F && E !== C) ? F : E;
      r[6] = D === Hh && D !== B && Hh !== F ? D : E;
      r[7] = (D === Hh && D !== B && Hh !== F && E !== I) || (Hh === F && D !== Hh && B !== F && E !== G) ? Hh : E;
      r[8] = Hh === F && D !== Hh && B !== F ? F : E;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) o[(y * 3 + j) * W3 + x * 3 + i] = r[j * 3 + i];
    }
    return { w: W3, h: h * 3, m: o };
  }
  function dilate(M, r, pad) {
    const W2 = M.w + pad * 2, H2 = M.h + pad * 2, o = new Uint8Array(W2 * H2);
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.m[y * M.w + x]) {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + (r > 1 ? 1 : 0)) o[(y + j + pad) * W2 + x + i + pad] = 1;
    }
    return { w: W2, h: H2, m: o };
  }
  function padMask(M, pad) {
    const W2 = M.w + pad * 2, H2 = M.h + pad * 2, o = new Uint8Array(W2 * H2);
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) o[(y + pad) * W2 + x + pad] = M.m[y * M.w + x];
    return { w: W2, h: H2, m: o };
  }
  // pinta una línea de logo: extrusión 3D + doble contorno + relleno con degradado y bisel
  function paintWord(M, o) {
    const pad = 8;
    const body = padMask(M, pad);
    const out1 = dilate(M, 1, pad), out2 = dilate(M, 2, pad);
    const { w, h } = body;
    const c = mk(w, h + o.depth + 2);
    const ctx = c.ctx;
    const at = (Mk, x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : Mk.m[y * w + x]);
    const P = (x, y, k) => { ctx.fillStyle = PAL[k]; ctx.fillRect(x, y, 1, 1); };
    // extrusión (profundidad) hacia abajo
    for (let d = o.depth; d >= 1; d--) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (out2.m[y * w + x]) P(x, y + d, d === o.depth ? '0' : o.extrude[(x + y) & 1 ? 0 : Math.min(o.extrude.length - 1, 1)]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (out2.m[y * w + x] && !out1.m[y * w + x]) P(x, y, o.outer);
      if (out1.m[y * w + x] && !body.m[y * w + x]) P(x, y, '0');
    }
    // relleno
    const top = pad, bh = M.h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!body.m[y * w + x]) continue;
      const v = 1 - (y - top) / bh;
      let k = pick(o.ramp, v * 0.9 + 0.05, x, y);
      const up = at(body, x, y - 1), up2 = at(body, x, y - 2), dn = at(body, x, y + 1), lf = at(body, x - 1, y), rt = at(body, x + 1, y);
      if (!up) k = o.hi; else if (!up2) k = o.hi2;
      else if (!dn) k = o.lo;
      else if (!lf) k = o.side;
      else if (!rt) k = o.lo;
      P(x, y, k);
    }
    // línea de brillo horizontal (metal pulido)
    if (o.band) for (let x = 0; x < w; x++) for (let y = top + Math.floor(bh * 0.42); y < top + Math.floor(bh * 0.42) + 2; y++) if (body.m[y * w + x] && at(body, x, y - 3) && at(body, x, y + 3)) P(x, y, o.band);
    return { c: c.c, w, h, pad, body };
  }
  const LOGO = {};
  function buildLogo() {
    if (LOGO.ready) return;
    // OCHO (sin la primera O)
    const m1 = scale2x(scale2x(glyphMask('CHO', 1)));
    const m2 = scale3x(glyphMask('MALDITO', 1));
    LOGO.w1 = paintWord(m1, {
      ramp: ['f', 'g', 'h', 'i'], hi: '8', hi2: 'i', lo: 'f', side: 'i', outer: 'e', extrude: ['e', 'f'], depth: 5, band: 'i',
    });
    LOGO.w2 = paintWord(m2, {
      ramp: ['9', 'a', 'b', 'c', 'd'], hi: 'd', hi2: 'c', lo: '9', side: 'c', outer: '9', extrude: ['9', 'a'], depth: 4, band: null,
    });
    // brillo/neón de MALDITO: máscara dilatada
    const glow = dilate(m2, 5, 8 + 0);
    const gm = mk(glow.w, glow.h);
    gm.ctx.fillStyle = PAL['b'];
    for (let y = 0; y < glow.h; y++) for (let x = 0; x < glow.w; x++) if (glow.m[y * glow.w + x] && ((x + y) & 1)) gm.ctx.fillRect(x, y, 1, 1);
    LOGO.glow2 = gm.c; LOGO.glowPad = 8 - 3;
    // máscara de brillo para el barrido de luz sobre OCHO
    const s1 = mk(LOGO.w1.w, LOGO.w1.h);
    s1.ctx.fillStyle = PAL['8'];
    const b1 = LOGO.w1.body;
    for (let y = 0; y < b1.h; y++) for (let x = 0; x < b1.w; x++) if (b1.m[y * b1.w + x]) s1.ctx.fillRect(x, y, 1, 1);
    LOGO.shine1 = s1.c;
    const s2 = mk(LOGO.w2.w, LOGO.w2.h);
    s2.ctx.fillStyle = PAL['d'];
    const b2 = LOGO.w2.body;
    for (let y = 0; y < b2.h; y++) for (let x = 0; x < b2.w; x++) if (b2.m[y * b2.w + x]) s2.ctx.fillRect(x, y, 1, 1);
    LOGO.shine2 = s2.c;
    // puntos de goteo: columnas del borde inferior de MALDITO
    const drips = [];
    const bm = LOGO.w2.body;
    for (let x = 0; x < bm.w; x++) {
      for (let y = bm.h - 1; y >= 0; y--) {
        if (bm.m[y * bm.w + x]) {
          if (y > bm.h - 14 && !bm.m[(y + 1) * bm.w + x] && bm.m[y * bm.w + x - 1] && bm.m[y * bm.w + x + 1] && hash(x, 9) < 0.16) {
            drips.push({ x, y: y + 1, len: 3 + Math.floor(hash(x, 10) * 9), sp: 0.4 + hash(x, 11) * 0.8, ph: hash(x, 12) });
            x += 4;
          }
          break;
        }
      }
    }
    LOGO.drips = drips;
    // bola 8 cornuda
    const R = 23, S = R * 2 + 12;
    const bc = mk(S, S + 14);
    const g = bc.g;
    const cx = S >> 1, cy = (S >> 1) + 10;
    // cuernos
    const horn = (dir) => {
      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        const x = Math.round(cx + dir * (11 + t * 9 + t * t * 2));
        const y = Math.round(cy - R + 6 - t * 15 + t * t * 2);
        const wdt = Math.max(1, Math.round((1 - t) * 4));
        for (let k = -wdt; k <= wdt; k++) g.p(x + k * dir * 0, y + k, '0');
      }
      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        const x = Math.round(cx + dir * (11 + t * 9 + t * t * 2));
        const y = Math.round(cy - R + 6 - t * 15 + t * t * 2);
        const wdt = Math.max(0, Math.round((1 - t) * 4) - 1);
        for (let k = -wdt; k <= wdt; k++) g.p(x, y + k, k < 0 ? 'c' : k === 0 ? 'b' : 'a');
        if (wdt === 0) g.p(x, y, t > 0.9 ? 'd' : 'b');
      }
    };
    // contorno de cuernos con dilatación manual: dibujar en '0' más grueso primero
    const hornShape = (dir, col, grow) => {
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        const x = cx + dir * (10 + t * 10 + t * t * 3);
        const y = cy - R + 7 - t * 16 + t * t * 3;
        const wd = (1 - t) * 3.2 + 0.6 + grow;
        for (let j = -Math.ceil(wd); j <= Math.ceil(wd); j++) for (let k = -Math.ceil(wd); k <= Math.ceil(wd); k++) if (j * j + k * k <= wd * wd) g.p(Math.round(x + k), Math.round(y + j), typeof col === 'function' ? col(j, k, t) : col);
      }
    };
    [-1, 1].forEach((dir) => hornShape(dir, '0', 1));
    [-1, 1].forEach((dir) => hornShape(dir, (j, k, t) => (t > 0.85 ? 'd' : j < -1 || k * dir < -1 ? 'c' : j > 1 ? 'a' : 'b'), 0));
    void horn;
    // esfera
    for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) {
      const d2 = x * x + y * y;
      if (d2 > (R + 1) * (R + 1) + R) continue;
      if (d2 > R * R + R * 0.8) { g.p(cx + x, cy + y, '0'); continue; }
      const nx = x / R, ny = y / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const l = clamp(-nx * 0.45 - ny * 0.6 + nz * 0.65, 0, 1);
      let k = pick(['0', '1', '2', '3', '4'], l * 0.85, cx + x, cy + y);
      // luz roja maldita de rebote abajo-derecha
      const rim = nx * 0.5 + ny * 0.7;
      if (rim > 0.62 && nz < 0.6) k = pick(['1', '9', 'a', 'b'], (rim - 0.62) * 2.2, cx + x, cy + y);
      g.p(cx + x, cy + y, k);
    }
    // círculo blanco
    const wx = cx - 3, wy = cy - 4, wr = 12;
    for (let y = -wr - 1; y <= wr + 1; y++) for (let x = -wr - 1; x <= wr + 1; x++) {
      const d2 = x * x + y * y * 1.08;
      if (d2 > (wr + 1) * (wr + 1)) continue;
      if (d2 > wr * wr + 2) { g.p(wx + x, wy + y, '1'); continue; }
      const l = clamp(0.75 - (x + y) / (wr * 4), 0, 1);
      g.p(wx + x, wy + y, pick(['6', '7', '8'], l, wx + x, wy + y));
    }
    // "8" en display
    LOGO.ball = bc.c; LOGO.ballCx = cx; LOGO.ballCy = cy; LOGO.ballR = R;
    OM.FONT.draw(bc.ctx, '8', wx - 3, wy - 5, { size: 2, color: '0', grad: false });
    // brillo especular
    g.rect(cx - 15, cy - 15, 3, 2, '6'); g.rect(cx - 16, cy - 13, 2, 3, '5'); g.p(cx - 14, cy - 16, '7'); g.p(cx - 13, cy - 15, '8');
    LOGO.ready = true;
    // métricas: línea 1 = bola + "CHO"; línea 2 = MALDITO
    LOGO.l1w = S - 6 + LOGO.w1.w - 2 * LOGO.w1.pad;
    LOGO.width = Math.max(LOGO.l1w, LOGO.w2.w - 2 * LOGO.w2.pad);
    LOGO.height = 120;
  }
  function logo(ctx, x, y, t) {
    buildLogo();
    t = t || 0;
    x |= 0; y |= 0;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    const L = LOGO;
    const w1 = L.w1, w2 = L.w2;
    // --- línea 2: MALDITO (neón rojo con parpadeo de fallo)
    const l2x = x - ((w2.w - 2 * w2.pad) >> 1) - w2.pad;
    const l2y = y + 50 - w2.pad;
    // patrón de parpadeo de neón defectuoso
    const cyc = t % 5.2;
    const flick = (cyc > 3.0 && cyc < 3.08) || (cyc > 3.16 && cyc < 3.2) || (cyc > 4.6 && cyc < 4.64);
    const glowA = flick ? 0.05 : 0.32 + 0.08 * Math.sin(t * 3.1) + 0.04 * Math.sin(t * 17);
    ctx.save(); ctx.globalAlpha = glowA;
    ctx.drawImage(L.glow2, l2x + L.glowPad, l2y + L.glowPad);
    ctx.restore();
    ctx.drawImage(w2.c, l2x, l2y);
    if (flick) { ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = PAL['0']; ctx.drawImage(L.shine2, l2x, l2y); ctx.globalCompositeOperation = 'source-atop'; ctx.restore(); }
    // goteo de sangre
    L.drips.forEach((d, i) => {
      const per = 2.6 + d.sp * 2;
      const ph = ((t * 0.9 + d.ph * per) % per) / per;
      const base = l2x + d.x, by = l2y + d.y;
      const grow = Math.min(1, ph / 0.6);
      const len = Math.round(2 + grow * d.len);
      ctx.fillStyle = PAL['0']; ctx.fillRect(base - 1, by, 3, len + 1);
      ctx.fillStyle = PAL['a']; ctx.fillRect(base, by, 1, len);
      ctx.fillStyle = PAL['b']; ctx.fillRect(base, by, 1, Math.max(1, len - 2));
      if (ph < 0.6) { ctx.fillStyle = PAL['0']; ctx.fillRect(base - 2, by + len - 2, 5, 4); ctx.fillStyle = PAL['a']; ctx.fillRect(base - 1, by + len - 2, 3, 3); ctx.fillStyle = PAL['c']; ctx.fillRect(base - 1, by + len - 2, 1, 1); }
      else { // la gota cae
        const f = (ph - 0.6) / 0.4;
        const yy = by + len + Math.round(f * f * 40);
        ctx.fillStyle = PAL['a']; ctx.fillRect(base, yy, 1, 2); ctx.fillStyle = PAL['c']; ctx.fillRect(base, yy, 1, 1);
      }
    });
    // --- línea 1: [bola] CHO
    const S = L.ball.width;
    const l1x = x - (L.l1w >> 1);
    const bob = Math.round(Math.sin(t * 2.2) * 1.5);
    const l1y = y + 4;
    // aura maldita de la bola
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.7);
    drawHalo(ctx, l1x + L.ballCx, l1y + L.ballCy - 10 + bob + 6, 34, 'b', 0.16 + pulse * 0.14);
    ctx.drawImage(w1.c, l1x + S - 6 - w1.pad, l1y - w1.pad);
    // barrido de brillo cada 4 s sobre OCHO
    const sw = (t % 4) / 1.1;
    if (sw < 1) {
      const bx = Math.round(-20 + sw * (w1.w + 40));
      ctx.save();
      ctx.beginPath();
      for (let k = 0; k < 6; k++) ctx.rect(l1x + S - 6 - w1.pad + bx + k * 0 - (k) , l1y - w1.pad + k * 8, 6, 8);
      ctx.rect(l1x + S - 6 - w1.pad + bx + 10, l1y - w1.pad, 2, w1.h);
      ctx.clip();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(L.shine1, l1x + S - 6 - w1.pad, l1y - w1.pad);
      ctx.restore();
    }
    ctx.drawImage(L.ball, l1x, l1y - 10 + bob + 0);
    // ojo: destello en la bola
    if ((t % 3.3) < 0.25) {
      const sx = l1x + L.ballCx + 10, sy = l1y + L.ballCy - 10 + bob - 12;
      ctx.fillStyle = PAL['8']; ctx.fillRect(sx, sy - 2, 1, 5); ctx.fillRect(sx - 2, sy, 5, 1);
    }
    ctx.imageSmoothingEnabled = prev;
  }
  function logoSize() { buildLogo(); return { w: LOGO.width, h: LOGO.height }; }

  // ================================================================== INIT
  function init() {
    initIcons();
    OM.PX.sprite('ui_cursor_normal', CURSORS.normal.rows);
    OM.PX.sprite('ui_cursor_aim', CURSORS.aim.rows);
    OM.PX.sprite('ui_cursor_grab', CURSORS.grab.rows);
    if (OM.FONT) buildLogo();
  }
  OM.ART_INIT.push(init);

  return {
    panel, button, icon, valueBox, scoreRow, bar, drawBackground, logo, logoSize, cursor,
    drawHalo, flame, chain, drawFog,
    iconNames: () => Object.keys(ICONS),
    prebuild(scene) { const s = SCN[scene]; if (s && !s.base) s.base = s.build(); },
  };
})();
