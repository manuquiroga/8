// 8 — arte de contenido v3.1: comodines, hechizos y activos de la tienda.
// Igual que cards_art_v13.js: usa OM.CARDS._lib y registra en OM.CARDS._art antes de OM.ART_INIT.
(function () {
  'use strict';
  const { R, E, C, Rc, P, Cap, U, D, Arc, F3 } = OM.CARDS._lib;
  const A = OM.CARDS._art;
  const J = (id, fn) => { A['joker_' + id] = [32, 32, fn]; };
  const ring = (cx, cy, r, t) => D(C(cx, cy, r), C(cx, cy, r - t));

  // ======================= COMODINES =======================
  J('hucha', (h) => {
    h.halo(16, 17, 14, 'g');
    // cerdito de barro con ranura
    h.shade(U(E(16, 19, 11, 8), C(26, 17, 4)), R.red, { bias: 0.2 });
    h.shade(U(Rc(9, 25, 3, 4), Rc(20, 25, 3, 4)), R.blood, {});
    h.fill(E(28.5, 17, 1.6, 2), 'a'); h.p(28, 17, '0'); h.p(29, 17, '0');
    h.p(23, 14, '0');
    h.shade(P([[20, 10], [23, 6], [24, 11]]), R.red, {});
    h.fill(Rc(13, 11, 6, 1), '0');
    h.coin(16, 6, 3.4);
    h.star(6, 6, 'h', 'i');
  });
  J('tahur', (h) => {
    h.halo(16, 16, 14, 'q');
    // dos cartas en abanico y fichas
    h.shade(P([[5, 6], [16, 3], [20, 22], [9, 25]]), R.bone, { bias: 0.4 });
    h.shade(P([[13, 5], [25, 6], [24, 26], [12, 25]]), R.bone, { bias: 0.4 });
    h.fill(C(18.5, 15, 3), 'c'); h.fill(P([[15.5, 16], [21.5, 16], [18.5, 21]]), 'c');
    h.chip(8, 26, 4.5, R.blue); h.chip(8, 23, 4.5, R.red); h.chip(25, 28, 4, R.green);
  });
  J('saltimbanqui', (h) => {
    h.halo(16, 16, 14, 'u');
    // bola saltando en arco sobre otra
    for (let k = 0; k <= 10; k++) { const a = Math.PI * (k / 10); h.p(Math.round(5 + k * 2.2), Math.round(24 - Math.sin(a) * 16), k % 2 ? 'u' : 't'); }
    h.ball(16, 24, 5, { col: R.blue, num: 2 });
    h.ball(25, 10, 4.5, { col: R.bone });
    h.star(27, 4, 'u', '8'); h.star(5, 8, 't', '8');
  });
  J('cobrador', (h) => {
    h.halo(16, 16, 14, 'g');
    // libreta de deudas y moneda
    h.shade(Rc(6, 5, 17, 23), R.boneD, { bias: 0.3 });
    h.fill(Rc(6, 5, 2, 23), 'a');
    [10, 14, 18, 22].forEach((y) => { h.line(10, y, 20, y, '4'); });
    h.line(10, 14, 20, 22, 'c'); h.line(20, 14, 10, 22, 'c');
    h.coin(24, 23, 4.5);
    h.shade(Cap(24, 4, 27, 16, 1), R.woodD, {}); h.p(24, 3, '0');
  });
  J('pobre_diablo', (h) => {
    h.halo(16, 16, 14, '5');
    // diablillo con cuernos y el bolsillo vacío
    h.shade(E(16, 15, 8, 8), R.red, { bias: 0.2 });
    h.shade(P([[9, 10], [7, 2], [12, 8]]), R.bone, {}); h.shade(P([[23, 10], [25, 2], [20, 8]]), R.bone, {});
    h.fill(C(13, 14, 1.4), '0'); h.fill(C(19, 14, 1.4), '0'); h.p(13, 13, '8'); h.p(19, 13, '8');
    h.line(13, 19, 19, 19, '0'); h.p(12, 20, '0'); h.p(20, 20, '0');
    h.shade(U(E(16, 27, 7, 4)), R.boneD, {}); h.fill(E(16, 26, 4, 1.5), '1');
    h.drop(25, 21, 1.4, R.ice);
  });
  J('rompedor', (h) => {
    h.halo(16, 16, 14, 'v');
    // triángulo de bolas reventando
    [[16, 10], [12, 17], [20, 17], [8, 24], [16, 24], [24, 24]].forEach(([x, y], i) => h.ball(x, y, 3.6, { col: [R.red, R.blue, R.violet, R.green, R.bone, R.fire][i] }));
    h.star(4, 8, 'i', '8', 2); h.star(28, 9, 'v', '8', 2); h.star(27, 29, 'i', '8');
    h.coin(5, 28, 2.5);
  });
  J('equilibrista', (h) => {
    h.halo(16, 16, 14, 'r');
    // bola sobre la cuerda floja
    h.line(1, 22, 31, 22, '6'); h.line(1, 23, 31, 23, '4');
    h.ball(16, 16, 5.5, { col: R.bone });
    h.shade(Cap(4, 12, 28, 12, 0.9), R.woodD, {});
    h.fill(C(4, 12, 1.6), 'c'); h.fill(C(28, 12, 1.6), 'c');
    h.p(10, 27, '5'); h.p(22, 28, '5');
  });
  J('prestamista', (h) => {
    h.halo(16, 16, 14, 'g');
    // balanza con monedas
    h.shade(Rc(15, 6, 2, 21), R.brass, {});
    h.shade(Rc(5, 8, 22, 2), R.brass, {});
    h.shade(U(E(8, 18, 6, 2.2)), R.brass, {}); h.shade(U(E(24, 15, 6, 2.2)), R.brass, {});
    h.line(4, 10, 6, 17, 'f'); h.line(12, 10, 10, 17, 'f'); h.line(20, 10, 22, 14, 'f'); h.line(28, 10, 26, 14, 'f');
    h.coin(8, 15, 2.6); h.coin(22, 12, 2.4); h.coin(26, 12, 2.4); h.coin(24, 9, 2.4);
    h.shade(E(16, 28, 7, 2), R.iron, {});
  });
  J('avaro', (h) => {
    h.halo(16, 16, 14, 'h');
    // saco de oro atado
    h.shade(U(E(16, 21, 10, 9), P([[11, 12], [21, 12], [19, 8], [13, 8]])), R.brass, { bias: 0.25 });
    h.fill(Rc(12, 11, 8, 2), 'a');
    h.glyphO(13, 17, F3['S$'], 'i', 'e');
    h.coin(5, 27, 2.5); h.coin(27, 26, 2.5); h.coin(26, 6, 2);
  });
  J('vengador', (h) => {
    h.halo(16, 16, 14, 'c');
    // daga goteando
    h.shade(P([[16, 2], [19, 6], [17.5, 21], [14.5, 21], [13, 6]]), R.steel, { bias: 0.4 });
    h.line(16, 4, 16, 20, '8');
    h.shade(Rc(9, 21, 14, 3), R.brass, {});
    h.shade(Rc(14, 24, 4, 6), R.woodD, {}); h.fill(C(16, 30, 1.8), 'g');
    h.drop(16, 10, 1.4, R.blood); h.drop(22, 27, 1.6, R.blood);
  });
  J('ultimo_suspiro', (h) => {
    h.halo(16, 16, 14, '6');
    // última bola y vela que se apaga
    h.ball(12, 20, 7, { col: R.red, num: 7 });
    h.shade(Rc(24, 14, 4, 14), R.bone, {}); h.fill(Rc(24, 14, 4, 1), '8');
    h.line(26, 13, 26, 11, '3');
    [[25, 9], [27, 7], [26, 4], [28, 2]].forEach(([x, y]) => h.p(x, y, '5'));
  });
  J('la_banda', (h) => {
    h.halo(16, 16, 15, 'm');
    // cuatro calaveras en fila
    h.skull(9, 11, 0.7, R.bone, {}); h.skull(23, 11, 0.7, R.bone, {});
    h.skull(9, 24, 0.7, R.bone, {}); h.skull(23, 24, 0.7, R.bone, { glow: 'c' });
    h.star(16, 17, 'm', '8', 2);
  });
  J('fenix', (h) => {
    h.halo(16, 15, 15, 'v');
    // ave de fuego con las alas abiertas
    h.flame(16, 31, 5, 11, R.fire);
    h.shade(P([[15, 17], [1, 3], [4, 10], [2, 13], [7, 15], [5, 19], [11, 21]]), R.ember, { bias: 0.3 });
    h.shade(P([[17, 17], [31, 3], [28, 10], [30, 13], [25, 15], [27, 19], [21, 21]]), R.ember, { bias: 0.3 });
    h.shade(E(16, 17, 4, 7), R.fire, {});
    h.shade(C(16, 8, 3), R.fire, {}); h.p(17, 7, '0');
    h.shade(P([[18, 8], [22, 9], [18, 10]]), R.gold, {});
    h.shade(P([[15, 5], [13, 1], [17, 4]]), R.fire, {});
  });
  J('virtuoso', (h) => {
    h.halo(16, 16, 14, 'u');
    // taco con estela de estrellas y curva de massé
    h.shade(Cap(4, 28, 24, 6, 1.2, 0.8), R.wood, {});
    h.fill(C(25, 5, 1.6), 'r');
    h.fill(Arc(16, 16, 9, 10, Math.PI * 1.1, Math.PI * 1.9), 'u');
    h.star(7, 8, 'u', '8', 2); h.star(27, 18, 'i', '8', 2); h.star(20, 27, 't', '8');
  });
  J('rey_midas', (h) => {
    h.halo(16, 17, 15, 'h', 'g');
    // corona sobre una bola de oro
    h.ball(16, 21, 8, { col: R.gold, num: 8 });
    h.shade(P([[7, 13], [9, 4], [12.5, 9], [16, 2], [19.5, 9], [23, 4], [25, 13]]), R.gold, { bias: 0.3 });
    h.p(16, 5, 'c'); h.p(9, 7, 'q'); h.p(23, 7, 'm');
  });

  // ======================= HECHIZOS =======================
  J('brazo_ogro', (h) => {
    h.halo(16, 16, 14, 'l');
    // puño verde enorme agarrando el taco
    h.shade(Cap(2, 30, 30, 2, 1), R.woodD, {});
    h.shade(Cap(5, 29, 13, 19, 5), R.green, { bias: 0.2 });
    h.shade(Rc(9, 18, 8, 3), R.brass, {});
    h.shade(E(18, 12, 8, 7), R.green, { bias: 0.25 });
    [13, 17, 21].forEach((x) => h.line(x, 7, x, 10, 'j'));
    h.line(12, 14, 22, 14, 'j');
    h.p(5, 6, 'm'); h.p(27, 22, 'm');
  });
  J('prisa', (h) => {
    h.halo(16, 16, 14, 'c');
    // reloj de arena que se vacía
    h.shade(U(P([[8, 5], [24, 5], [17, 16], [24, 27], [8, 27], [15, 16]])), R.ice, { bias: 0.3 });
    h.fill(P([[11, 8], [21, 8], [16, 14]]), 'h'); h.fill(P([[10, 26], [22, 26], [16, 21]]), 'h');
    h.line(16, 15, 16, 21, 'i');
    h.shade(Rc(6, 3, 20, 2), R.woodD, {}); h.shade(Rc(6, 27, 20, 2), R.woodD, {});
    h.p(28, 8, 'c'); h.p(29, 12, 'c'); h.p(3, 20, 'c');
  });
  J('amuleto', (h) => {
    h.halo(16, 17, 14, 'q');
    // ojo turco colgante
    h.line(16, 1, 16, 7, '5'); h.line(9, 2, 16, 7, '4'); h.line(23, 2, 16, 7, '4');
    h.shade(C(16, 18, 10), R.blue, { bias: 0.3 });
    h.fill(C(16, 18, 6.5), '8'); h.fill(C(16, 18, 4), 'q'); h.fill(C(16, 18, 2), '0'); h.p(14, 16, '8');
    h.fill(ring(16, 18, 10.5, 1), 'h');
  });
  J('escarcha_negra', (h) => {
    h.halo(16, 16, 14, 'r');
    // copo oscuro
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3, x = 16 + Math.cos(a) * 12, y = 16 + Math.sin(a) * 12;
      h.shade(Cap(16, 16, x, y, 1.1), R.ice, {});
      h.shade(Cap(16 + Math.cos(a) * 7, 16 + Math.sin(a) * 7, 16 + Math.cos(a + 0.6) * 10, 16 + Math.sin(a + 0.6) * 10, 0.7), R.ice, {});
    }
    h.fill(C(16, 16, 3), '2'); h.fill(C(16, 16, 1.5), 'u');
  });
  J('grilletes', (h) => {
    h.halo(16, 16, 14, '5');
    // dos argollas de hierro unidas por cadena
    h.shade(ring(9, 18, 7, 2.4), R.iron, {}); h.shade(ring(23, 18, 7, 2.4), R.iron, {});
    [14, 16, 18].forEach((x, i) => h.shade(E(x, 8 - (i === 1 ? 2 : 0), 1.8, 1.2), R.steel, {}));
    h.line(9, 11, 13, 8, '5'); h.line(23, 11, 19, 8, '5');
    h.p(5, 14, '8'); h.p(19, 14, '8');
  });
  J('kamikaze', (h) => {
    h.halo(16, 16, 14, 'v');
    // blanca con cinta en la cabeza cayendo a la tronera
    h.fill(E(16, 27, 11, 4), '0'); h.fill(E(16, 27, 9, 2.6), '1');
    h.ball(16, 15, 7.5, { col: R.bone });
    h.fill(Rc(9, 11, 15, 3), '8'); h.fill(C(16, 12.5, 1.3), 'c');
    h.shade(P([[23, 11], [30, 8], [28, 14]]), R.red, {});
    h.p(4, 6, 'v'); h.p(28, 22, 'v');
  });
  J('venda', (h) => {
    h.halo(16, 16, 14, 'c');
    // calavera con los ojos vendados
    h.skull(16, 15, 1.2, R.bone, {});
    h.shade(Rc(4, 14, 24, 5), R.blood, { bias: 0.3 });
    h.shade(P([[26, 15], [31, 21], [28, 22], [24, 17]]), R.blood, {});
  });
  J('mesa_torcida', (h) => {
    h.halo(16, 16, 14, 'l');
    // mesa inclinada con bolas rodando
    h.shade(P([[2, 22], [30, 12], [30, 16], [2, 26]]), R.woodD, {});
    h.fill(P([[3, 22], [29, 13], [29, 14], [3, 23]]), 'k');
    h.shade(Rc(5, 25, 3, 6), R.woodD, {}); h.shade(Rc(25, 15, 3, 13), R.woodD, {});
    h.ball(22, 10, 3.5, { col: R.red }); h.ball(10, 15, 3.5, { col: R.blue });
    h.line(13, 9, 17, 8, '6'); h.line(4, 12, 7, 11, '6');
  });

  // ======================= ACTIVOS =======================
  J('tiro_gratis', (h) => {
    h.halo(16, 16, 14, 'm');
    // flecha circular de "otra vez"
    h.shade(Arc(16, 16, 7, 11, Math.PI * 0.2, Math.PI * 1.75), R.green, {});
    h.shade(P([[22, 1], [30, 9], [20, 11]]), R.green, {});
    h.ball(16, 16, 4.5, { col: R.bone });
  });
  J('boca_infierno', (h) => {
    h.halo(16, 16, 15, 'c');
    // tronera enorme con colmillos
    h.fill(E(16, 17, 13, 10), '9'); h.fill(E(16, 17, 10, 7.5), '0');
    for (let x = 7; x <= 25; x += 4) { h.shade(P([[x - 1.5, 9], [x + 1.5, 9], [x, 13]]), R.bone, {}); h.shade(P([[x - 1.5, 25], [x + 1.5, 25], [x, 21]]), R.bone, {}); }
    h.ball(16, 17, 3, { col: R.violet });
  });
  J('vudu', (h) => {
    h.halo(16, 16, 14, 'u');
    // muñeco de trapo con alfileres
    h.shade(U(C(16, 8, 5), E(16, 19, 6, 8), Cap(7, 15, 25, 15, 2)), ['e', 'f', 'g', 'h'], { bias: 0.2 });
    h.line(13, 7, 15, 9, '0'); h.line(15, 7, 13, 9, '0'); h.p(18, 8, '0');
    h.line(12, 22, 20, 22, 'e'); h.line(16, 13, 16, 26, 'e');
    h.line(21, 17, 28, 11, '6'); h.fill(C(28, 11, 1.4), 'c');
    h.line(11, 20, 4, 25, '6'); h.fill(C(4, 25, 1.4), 'u');
  });
  J('atraco', (h) => {
    h.halo(16, 16, 14, '5');
    // antifaz y saca con $
    h.shade(U(E(10, 10, 6, 4), E(22, 10, 6, 4)), R.night, { bias: 0.3 });
    h.fill(E(10, 10, 2.2, 1.6), '8'); h.fill(E(22, 10, 2.2, 1.6), '8');
    h.shade(E(16, 24, 8, 6), R.ash, {}); h.fill(Rc(13, 17, 6, 2), '4');
    h.glyphO(14, 21, F3['$'], 'h', '0');
  });
  J('gran_golpe', (h) => {
    h.halo(16, 16, 15, 'c', 'b');
    // estallido con x3
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; h.shade(Cap(16, 16, 16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, 1.6, 0.4), R.fire, {}); }
    h.fill(C(16, 16, 7), 'c'); h.fill(C(16, 16, 5.5), 'b');
    h.glyphO(11, 14, F3.x, '8', '0'); h.glyphO(17, 14, F3['3'], '8', '0');
  });
  J('marcha_atras', (h) => {
    h.halo(16, 16, 14, 'u');
    // reloj con agujas hacia atrás
    h.shade(C(16, 16, 11), R.bone, { bias: 0.3 });
    h.fill(ring(16, 16, 11.5, 1.5), 'g');
    h.line(16, 16, 16, 8, '0'); h.line(16, 16, 11, 19, '0');
    h.shade(Arc(16, 16, 12.5, 14.5, Math.PI * 0.9, Math.PI * 1.6), R.mag, {});
    h.shade(P([[2, 10], [8, 8], [5, 15]]), R.mag, {});
  });
})();
