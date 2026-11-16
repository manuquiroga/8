// 8 — arte de contenido v1.1: comodines, jefes y taco nuevos.
// Usa las mismas primitivas que cards_art.js (OM.CARDS._lib) y registra en OM.CARDS._art
// antes de que OM.ART_INIT construya los sprites.
(function () {
  'use strict';
  const { R, E, C, Rc, P, Cap, U, D, Arc } = OM.CARDS._lib;
  const A = OM.CARDS._art;
  const J = (id, fn) => { A['joker_' + id] = [32, 32, fn]; };
  const B = (id, fn) => { A['boss_' + id] = [32, 32, fn]; };
  const CU = (id, fn) => { A['cue_' + id] = [24, 24, fn]; };
  const ring = (cx, cy, rx, ry, t) => D(E(cx, cy, rx, ry), E(cx, cy, rx - t, ry - t));

  // ---------------- COMODINES ----------------
  J('eslabon', (h) => {
    h.halo(16, 16, 14, 'v');
    // tres eslabones de hierro en diagonal
    h.shade(ring(9, 22, 6, 4.5, 2.2), R.steel, { diag: true });
    h.shade(ring(16, 16, 4.5, 6, 2.2), R.iron, { diag: true });
    h.shade(ring(23, 10, 6, 4.5, 2.2), R.steel, { diag: true });
    // brillo de racha
    h.p(14, 11, '8'); h.p(7, 19, '8'); h.p(21, 7, '8');
    h.star(27, 24, 'v', 'i'); h.star(5, 6, 'h', '8');
  });

  J('limosna', (h) => {
    h.halo(16, 18, 14, 'g');
    // cuenco de hojalata
    const bowl = U(E(16, 21, 11, 6), Rc(5, 17, 22, 4));
    h.shade(D(bowl, Rc(0, 0, 32, 17)), R.steel, {});
    h.fill(E(16, 17, 11, 2.5), '1');
    h.line(5, 17, 27, 17, '6');
    // moneda cayendo
    h.shade(C(17, 8, 4), R.gold, {});
    h.p(16, 7, 'i'); h.p(17, 8, 'e'); h.p(17, 7, 'e');
    h.line(12, 3, 12, 5, '6'); h.line(22, 4, 22, 6, '6');
    // monedita dentro
    h.p(14, 17, 'h'); h.p(15, 17, 'h'); h.p(19, 17, 'g');
  });

  J('maestro_efecto', (h) => {
    h.halo(16, 16, 14, 'q');
    h.ball(16, 17, 9, { col: R.bone });
    // punto de impacto abajo (retroceso)
    h.fill(C(16, 22, 1.6), 'c'); h.p(16, 22, 'd');
    // flechas de giro alrededor
    h.shade(Arc(16, 17, 11, 13, -2.6, -0.5), R.ice, { ol: false });
    h.shade(Arc(16, 17, 11, 13, 0.6, 2.6), R.blue, { ol: false });
    h.fill(P([[27, 9], [30, 13], [25, 13]]), 'r');
    h.fill(P([[5, 25], [2, 21], [7, 21]]), 'q');
  });

  J('pulso', (h) => {
    h.halo(16, 16, 14, 'm');
    // línea de pulso plana con un único latido (= blanca sin bandas)
    h.fill(Rc(2, 15, 28, 3), '1');
    h.line(2, 16, 11, 16, 'm'); h.line(11, 16, 13, 10, 'n'); h.line(13, 10, 15, 22, 'n'); h.line(15, 22, 17, 16, 'm'); h.line(17, 16, 29, 16, 'm');
    // bisturí
    h.shade(Cap(6, 28, 18, 24, 1.4, 1.2), R.steel, {});
    h.shade(P([[18, 22], [26, 21], [19, 26]]), R.ice, {});
    h.p(24, 21, '8');
  });

  J('segunda', (h) => {
    h.halo(16, 16, 14, 't');
    // reloj de arena girado con flecha de "volver"
    const top = P([[9, 6], [23, 6], [16, 16]]), bot = P([[16, 16], [23, 26], [9, 26]]);
    h.ol(U(top, bot));
    h.fill(top, '3'); h.fill(bot, '3');
    h.fill(P([[12, 9], [20, 9], [16, 14]]), 'h');
    h.fill(P([[16, 19], [21, 25], [11, 25]]), 'g');
    h.shade(Rc(7, 4, 18, 2), R.wood, {}); h.shade(Rc(7, 26, 18, 2), R.wood, {});
    h.shade(Arc(16, 16, 12, 14, 2.2, 4.0), R.mag, { ol: false });
    h.fill(P([[2, 11], [7, 8], [7, 14]]), 'u');
  });

  J('cadena', (h) => {
    h.halo(16, 16, 15, 'b');
    // llamas detrás
    h.shade(U(E(10, 20, 5, 9), E(17, 16, 6, 12), E(24, 21, 5, 8)), R.fire, { ol: false, bias: 0.4 });
    // cadena candente
    h.shade(ring(9, 18, 5, 4, 2), R.ember, { diag: true });
    h.shade(ring(16, 18, 4, 5, 2), R.blood, { diag: true });
    h.shade(ring(23, 18, 5, 4, 2), R.ember, { diag: true });
    [[6, 4], [12, 2], [21, 3], [27, 6]].forEach(([x, y]) => h.p(x, y, 'i'));
  });

  J('barquero', (h) => {
    h.halo(16, 15, 15, 'r');
    // figura encapuchada con remo y farol
    h.shade(U(E(14, 13, 7, 8), P([[7, 14], [21, 14], [24, 31], [4, 31]])), R.night, { bias: 0.3 });
    h.fill(E(14, 12, 4, 4.5), '0');
    h.p(12, 12, 'r'); h.p(16, 12, 'r');
    h.shade(Cap(25, 3, 22, 30, 1, 1), R.wood, {});
    h.shade(E(25, 31, 3, 1.5), R.wood, {});
    // farol
    h.line(7, 20, 7, 22, '6');
    h.shade(Rc(5, 22, 5, 6), R.brass, {});
    h.fill(Rc(6, 23, 3, 4), 'r'); h.p(7, 24, '8');
    // río
    for (let x = 0; x < 32; x += 3) h.p(x, 30, 'q');
  });

  // ---------------- JEFES ----------------
  B('ciego', (h) => {
    const face = E(16, 17, 11, 13);
    h.shade(face, R.ash, { bias: 0.2 });
    // venda
    h.shade(U(Rc(4, 12, 24, 6), Cap(26, 15, 30, 24, 1.5, 1)), R.blood, {});
    h.line(5, 13, 27, 13, 'c');
    // boca cosida
    h.line(11, 25, 21, 25, '9');
    for (let x = 12; x <= 20; x += 2) h.line(x, 24, x, 26, '5');
    // grietas
    h.p(9, 8, '4'); h.p(10, 7, '4'); h.p(22, 21, '4');
  });

  B('purista', (h) => {
    // velo
    h.shade(U(E(16, 13, 13, 12), P([[3, 13], [29, 13], [31, 31], [1, 31]])), R.violet, { bias: 0.2 });
    h.shade(E(16, 15, 7, 8), R.flesh, {});
    h.fill(Rc(9, 7, 14, 3), '7');
    h.p(13, 14, '1'); h.p(19, 14, '1'); h.line(14, 19, 18, 19, 'a');
    // bola lisa sostenida
    h.ball(16, 27, 4.5, { col: R.blue });
  });

  B('reloj', (h) => {
    h.shade(C(16, 16, 14), R.brass, {});
    h.shade(C(16, 16, 11), R.bone, { ol: false });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      h.p(Math.round(16 + Math.cos(a) * 9), Math.round(16 + Math.sin(a) * 9), k % 3 ? '5' : '1');
    }
    // manecillas: casi medianoche
    h.line(16, 16, 16, 8, '0'); h.line(16, 16, 13, 10, 'a');
    h.p(16, 16, 'c');
    // ojos rojos en el cristal
    h.p(11, 19, 'c'); h.p(21, 19, 'c');
    h.shade(Rc(14, 0, 4, 3), R.brass, {});
  });

  // ---------------- TACO ----------------
  CU('espectral', (h) => {
    h.diag(23, [
      { t0: -19, t1: -9, w: 4, ramp: ['2', '3', '4', '5'] },
      { t0: -8, t1: -7, w: 4, ramp: ['8', 'r', 'q', 'p'] },
      { t0: -6, t1: 13, w: 3, ramp: ['6', '5', '4'] },
      { t0: 14, t1: 16, w: 2, ramp: ['8', '7'] },
      { t0: 17, t1: 19, w: 2, ramp: ['r', 'q'] },
    ]);
    // jirones fantasmales
    [[5, 9], [8, 6], [14, 15], [17, 12], [4, 14]].forEach(([x, y]) => h.p(x, y, 'r'));
  });
})();
