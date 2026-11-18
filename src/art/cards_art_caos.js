// 8 — arte de contenido v3.2 (MODO CAOS): hechizos y activos nuevos.
// Igual que cards_art_v31.js: usa OM.CARDS._lib y registra en OM.CARDS._art antes de OM.ART_INIT.
(function () {
  'use strict';
  const { R, E, C, Rc, P, Cap, U, D, Arc } = OM.CARDS._lib;
  const A = OM.CARDS._art;
  const J = (id, fn) => { A['joker_' + id] = [32, 32, fn]; };

  // ======================= HECHIZOS =======================
  J('plomo', (h) => {
    h.halo(16, 16, 14, '5');
    // taco que se dobla bajo una pesa de plomo
    h.shade(Cap(3, 26, 22, 14, 1.3, 0.9), R.wood, {});
    h.fill(C(23, 13, 1.4), 'r');
    h.shade(P([[11, 6], [21, 6], [24, 18], [8, 18]]), R.lead, { bias: 0.2 });
    h.shade(Rc(13, 3, 6, 3), R.iron, {});
    h.line(12, 11, 20, 11, '6'); h.line(14, 14, 18, 14, '3');
    // flecha hacia abajo
    h.fill(P([[25, 20], [31, 20], [28, 27]]), 'c'); h.fill(Rc(27, 14, 2, 6), 'c');
  });
  J('garra_codicia', (h) => {
    h.halo(16, 16, 14, 'g', 'e');
    // garra que agarra un puñado de monedas
    h.coin(10, 22, 4); h.coin(18, 24, 4); h.coin(14, 17, 4); h.coin(23, 18, 3.4);
    h.shade(U(E(16, 10, 7, 4), Cap(9, 10, 6, 18, 1.4), Cap(14, 10, 12, 19, 1.4), Cap(19, 10, 20, 18, 1.4), Cap(23, 10, 26, 17, 1.4)), R.toxic, { bias: 0.2 });
    h.p(6, 19, '8'); h.p(12, 20, '8'); h.p(20, 19, '8'); h.p(26, 18, '8');
    h.fill(C(16, 7, 1.4), 'c'); h.p(16, 7, '8');
  });
  J('saqueo', (h) => {
    h.halo(16, 16, 14, 'c');
    // saco negro con calavera y monedas que se escapan
    h.shade(U(E(15, 20, 10, 9), P([[10, 11], [20, 11], [18, 6], [12, 6]])), R.night, { bias: 0.5 });
    h.fill(Rc(11, 10, 8, 2), 'c');
    h.skull(15, 20, 0.55, R.bone, { glow: 'c' });
    h.coin(27, 25, 2.6); h.coin(25, 29, 2.2); h.coin(28, 19, 2);
    h.line(3, 4, 9, 10, '6'); h.line(3, 5, 8, 10, '3');
  });
  J('furia', (h) => {
    h.halo(16, 16, 15, 'c', 'a');
    // llamarada con cara furiosa
    h.flame(16, 29, 9, 24, R.red);
    h.fill(P([[9, 15], [14, 18], [14, 20], [9, 18]]), '0');
    h.fill(P([[23, 15], [18, 18], [18, 20], [23, 18]]), '0');
    h.p(12, 18, 'i'); h.p(20, 18, 'i');
    h.fill(Rc(11, 24, 10, 2), '0'); h.p(12, 23, '0'); h.p(19, 23, '0');
    h.star(4, 6, 'c', 'i', 2);
  });
  J('niebla_negra', (h) => {
    h.halo(16, 16, 14, '3');
    // nube oscura con ojos
    h.shade(U(C(10, 18, 7), C(19, 14, 8), C(24, 20, 6), Rc(6, 18, 22, 7)), R.violet, { bias: 0.2 });
    h.fill(E(13, 18, 2, 1.4), 'c'); h.fill(E(21, 18, 2, 1.4), 'c'); h.p(13, 18, 'i'); h.p(21, 18, 'i');
    [[4, 28], [9, 29], [15, 28], [21, 29], [27, 28]].forEach(([x, y]) => h.p(x, y, '3'));
  });
  J('espejismo', (h) => {
    h.halo(16, 16, 14, 'u');
    // espejo ovalado con una guía torcida
    h.shade(E(16, 15, 10, 13), R.brass, { bias: 0.2 });
    h.shade(E(16, 15, 7.5, 10.5), R.ice, { bias: 0.5 });
    h.line(10, 23, 16, 11, '8'); h.line(16, 11, 22, 8, 'u'); h.line(16, 11, 21, 4, '6');
    h.fill(C(10, 23, 1.6), '8');
    h.shade(Rc(14, 28, 4, 3), R.woodD, {});
    h.star(26, 26, 'u', '8', 2);
  });
  J('cerrojo', (h) => {
    h.halo(16, 16, 14, 'b');
    // tronera tapada con un candado
    h.fill(E(16, 22, 12, 6), '0'); h.fill(E(16, 22, 10, 4.5), '1');
    h.shade(Arc(16, 13, 4.4, 7, Math.PI, Math.PI * 2), R.steel, {});
    h.shade(Rc(8, 13, 16, 12), R.brass, { bias: 0.2 });
    h.fill(C(16, 18, 1.8), '0'); h.fill(Rc(15, 18, 2, 4), '0');
  });
  J('borrachera', (h) => {
    h.halo(16, 16, 14, 'm');
    // botella verde ladeada y burbujas
    h.shade(P([[8, 27], [5, 17], [10, 11], [16, 9], [21, 14], [22, 24], [14, 30]]), R.green, { bias: 0.3 });
    h.shade(Cap(17, 10, 23, 3, 2), R.green, {});
    h.shade(Rc(21, 1, 4, 3), R.woodD, {});
    h.shade(P([[8, 20], [17, 15], [19, 22], [11, 26]]), R.bone, { bias: 0.4 });
    h.fill(C(13, 21, 1.6), 'c');
    h.p(26, 10, '8'); h.p(28, 6, '7'); h.p(25, 14, '6'); h.p(29, 13, '7');
    h.line(9, 18, 11, 14, 'n');
  });

  // ======================= ACTIVOS =======================
  J('reloj_arena', (h) => {
    h.halo(16, 16, 14, 'i');
    // reloj de arena casi vacío arriba
    h.shade(Rc(7, 3, 18, 3), R.wood, {}); h.shade(Rc(7, 26, 18, 3), R.wood, {});
    h.shade(Rc(8, 6, 2, 20), R.woodD, {}); h.shade(Rc(22, 6, 2, 20), R.woodD, {});
    h.fill(P([[11, 6], [21, 6], [16, 16]]), '2'); h.fill(P([[11, 26], [21, 26], [16, 16]]), '2');
    h.fill(P([[14, 11], [18, 11], [16, 15]]), 'i');
    h.fill(P([[11, 26], [21, 26], [19, 21], [13, 21]]), 'h');
    h.line(16, 15, 16, 21, 'i');
    h.p(12, 8, '8'); h.p(12, 23, '7');
  });
  J('carterista', (h) => {
    h.halo(16, 16, 14, 'h');
    // mano huesuda sacando una moneda de un monedero
    h.shade(U(E(12, 22, 9, 7), Rc(5, 16, 14, 4)), R.red, { bias: 0.2 });
    h.fill(Rc(5, 15, 14, 1), 'g'); h.fill(C(12, 15, 1.2), 'i');
    h.coin(21, 12, 4);
    h.shade(U(Cap(24, 4, 27, 13, 1.3), Cap(27, 4, 29, 12, 1.2), Cap(20, 6, 24, 13, 1.2), E(28, 17, 3.5, 4)), R.bone, { bias: 0.3 });
    h.star(5, 5, 'i', '8', 1);
  });
  J('sabotaje', (h) => {
    h.halo(16, 16, 14, 'c');
    // tronera que se cierra (flechas hacia dentro) y una llave inglesa
    h.fill(C(16, 16, 6), '0'); h.fill(C(16, 16, 4.6), '1');
    h.fill(P([[2, 16], [8, 12], [8, 20]]), 'c'); h.fill(P([[30, 16], [24, 12], [24, 20]]), 'c');
    h.fill(P([[16, 2], [12, 8], [20, 8]]), 'c'); h.fill(P([[16, 30], [12, 24], [20, 24]]), 'c');
    h.shade(Cap(21, 27, 29, 19, 1.3), R.steel, {});
    h.shade(D(C(29, 19, 3), Rc(29, 18, 4, 2)), R.steel, {});
  });
  J('tornado', (h) => {
    h.halo(16, 16, 15, 'u');
    // embudo de viento con bolas volando
    [[15, 4, 24], [17, 8, 19], [14, 12, 15], [17, 16, 11], [15, 20, 8], [17, 24, 5], [16, 27, 2]].forEach(([cx, y, w], i) => {
      h.shade(Cap(cx - w / 2, y + (i % 2), cx + w / 2, y - (i % 2), 1.3), i % 2 ? R.lilac : R.steel, {});
    });
    h.p(16, 30, '6');
    [[4, 9], [27, 6], [24, 28], [8, 27]].forEach(([x, y]) => h.p(x, y, '7'));
    h.ball(5, 20, 3.4, { col: R.red }); h.ball(26, 24, 3.4, { col: R.blue }); h.ball(27, 13, 3, { col: R.gold });
  });
})();
