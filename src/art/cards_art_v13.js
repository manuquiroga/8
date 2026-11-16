// 8 — arte de contenido v1.3: comodines, jefes y tacos nuevos.
// Igual que cards_art_v11.js: usa OM.CARDS._lib y registra en OM.CARDS._art antes de OM.ART_INIT.
(function () {
  'use strict';
  const { R, E, C, Rc, P, Cap, U, D, Arc } = OM.CARDS._lib;
  const A = OM.CARDS._art;
  const J = (id, fn) => { A['joker_' + id] = [32, 32, fn]; };
  const B = (id, fn) => { A['boss_' + id] = [32, 32, fn]; };
  const CU = (id, fn) => { A['cue_' + id] = [24, 24, fn]; };
  const ring = (cx, cy, rx, ry, t) => D(E(cx, cy, rx, ry), E(cx, cy, rx - t, ry - t));

  // ---------------- COMODINES ----------------
  J('paciente', (h) => {
    h.halo(16, 16, 14, '5');
    // palotes tallados en hueso: tiros ya usados
    [7, 11, 15, 19].forEach((x) => h.shade(Rc(x, 9, 2, 16), R.bone, {}));
    h.shade(Cap(5, 22, 23, 11, 1), R.blood, {});
    // vela consumida al lado
    h.shade(Rc(24, 18, 5, 9), R.bone, {});
    h.fill(Rc(24, 18, 5, 1), '8');
    h.p(25, 19, '8'); h.p(28, 21, '6');
    h.flame(26.5, 17, 1.6, 5);
    h.shade(Rc(22, 27, 9, 2), R.iron, {});
  });

  J('diezmo', (h) => {
    h.halo(16, 16, 14, 'g');
    // bandeja de colecta
    h.shade(U(E(16, 24, 13, 4), Rc(3, 22, 26, 2)), R.brass, { bias: 0.2 });
    h.fill(E(16, 22.5, 11, 2), 'e');
    // pila de monedas
    h.coin(11, 19, 3); h.coin(16, 18, 3.2); h.coin(21, 19, 3);
    h.coin(13.5, 13, 3); h.coin(18.5, 13, 3);
    h.coin(16, 7.5, 3.2);
    h.star(26, 6, 'h', 'i');
  });

  J('barrendero', (h) => {
    h.halo(16, 16, 14, 'l');
    // escoba en diagonal
    h.shade(Cap(27, 3, 12, 21, 1.1), R.woodD, {});
    h.shade(P([[10, 18], [15, 23], [9, 31], [2, 26]]), ['h', 'g', 'f', 'e'], { bias: 0.3 });
    h.line(5, 27, 11, 21, 'e'); h.line(7, 29, 13, 23, 'e');
    h.shade(Rc(11, 19, 4, 3), R.iron, {});
    // bolas barridas hacia la tronera
    h.ball(22, 26, 3.5, { col: R.blue });
    h.ball(28, 22, 3, { col: R.red });
    h.fill(E(29, 29, 3, 1.5), '0');
  });

  J('pares', (h) => {
    h.halo(16, 16, 15, 'c');
    h.ball(10, 19, 7.5, { col: R.blue, num: 2 });
    h.ball(22, 13, 7.5, { col: R.violet, num: 4 });
    h.star(25, 26, 'c', 'd'); h.star(5, 6, 'c', 'd');
  });

  J('tercera', (h) => {
    h.halo(16, 18, 14, 'v');
    // tres velas: solo la tercera arde fuerte
    const c = (x, top) => { h.shade(Rc(x, top, 5, 28 - top), R.bone, {}); h.fill(Rc(x, top, 5, 1), '8'); };
    c(3, 18); c(13, 15); c(23, 11);
    h.line(5, 17, 5, 15, '3'); h.line(15, 14, 15, 12, '3');
    h.p(5, 14, '5'); h.p(15, 11, '6');
    h.flame(25.5, 10, 2.6, 8);
    h.shade(Rc(1, 28, 30, 3), R.iron, {});
    h.p(9, 4, 'i'); h.p(19, 2, 'i');
  });

  J('sangria', (h) => {
    h.halo(16, 14, 14, 'a');
    // cáliz de latón
    h.shade(U(E(16, 9, 10, 7), Rc(6, 3, 20, 6)), R.brass, { bias: 0.3 });
    h.fill(E(16, 5, 9, 2.2), 'a'); h.fill(E(16, 5, 7, 1.4), 'b'); h.p(13, 5, 'd');
    h.shade(Rc(14, 15, 4, 9), R.brass, {});
    h.shade(U(E(16, 27, 9, 3), Rc(7, 25, 18, 2)), R.brass, {});
    // goteo por el borde
    h.drop(24, 18, 1.6, R.blood); h.drop(8, 21, 1.3, R.blood);
    h.line(25, 9, 25, 15, 'b');
  });

  J('matrimonio', (h) => {
    h.halo(16, 16, 15, 'u');
    // una lisa y una rayada unidas por un lazo de sangre
    h.ball(10, 18, 7, { col: R.red });
    h.ball(22, 14, 7, { col: R.blue, stripe: true, tilt: -0.4 });
    h.shade(Arc(16, 16, 12, 14, 3.4, 5.6), R.blood, { ol: false });
    h.fill(P([[14, 2], [16, 5], [18, 2], [16, 0]]), 'u');
    h.p(16, 2, '8');
  });

  J('codicia', (h) => {
    h.halo(16, 17, 14, 'h');
    // saco con ojos
    h.shade(U(E(16, 21, 11, 9), P([[11, 12], [21, 12], [19, 8], [13, 8]])), R.wood, { bias: 0.25 });
    h.shade(Rc(11, 10, 10, 3), R.brass, {});
    h.fill(P([[12, 6], [16, 9], [20, 6], [16, 3]]), 'f');
    h.fill(E(12, 20, 2, 2.2), '0'); h.fill(E(20, 20, 2, 2.2), '0');
    h.p(12, 20, 'h'); h.p(20, 20, 'h');
    h.line(12, 26, 20, 26, '9'); h.p(13, 25, '9'); h.p(19, 25, '9');
    // monedas que se escapan
    h.coin(4, 28, 2.5); h.coin(28, 27, 2.5); h.coin(27, 9, 2.2);
  });

  J('astrologo', (h) => {
    h.halo(16, 16, 15, 't');
    // luna creciente y telescopio
    h.shade(D(C(12, 11, 8), C(16, 8, 7)), R.ice, { bias: 0.3 });
    h.shade(Cap(9, 29, 25, 17, 2, 3), R.brass, {});
    h.fill(C(25, 17, 1.6), 'r');
    h.shade(P([[14, 31], [16, 24], [18, 31]]), R.woodD, {});
    h.star(25, 5, 'i', '8'); h.star(29, 11, 't', 'u'); h.star(4, 24, 't', 'u');
    h.p(20, 3, '8'); h.p(6, 3, '8');
  });

  J('eclipse', (h) => {
    // corona de luz alrededor del disco negro
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, l = k % 2 ? 13 : 15;
      h.line(16 + Math.round(Math.cos(a) * 10), 16 + Math.round(Math.sin(a) * 10), 16 + Math.round(Math.cos(a) * l), 16 + Math.round(Math.sin(a) * l), k % 2 ? 'v' : 'h');
    }
    h.fill(C(16, 16, 10), 'i');
    h.fill(C(16, 16, 9), '0');
    h.fill(C(15, 15, 8), '1');
    h.p(11, 11, '3'); h.p(12, 10, '2');
    // lunas (niveles) orbitando
    h.shade(C(4, 27, 2.2), R.blood, {}); h.shade(C(28, 5, 2.2), R.ice, {});
  });

  J('corona', (h) => {
    h.halo(16, 17, 15, 'h', 'g');
    // corona hueca: aros de oro con picos, vacía por dentro
    const band = U(Rc(5, 20, 22, 6), P([[5, 21], [5, 8], [10, 15], [16, 5], [22, 15], [27, 8], [27, 21]]));
    h.shade(D(band, P([[9, 19], [9, 14], [12, 18], [16, 11], [20, 18], [23, 14], [23, 19]])), R.gold, { bias: 0.3 });
    h.fill(Rc(9, 19, 14, 1), '0');
    h.shade(C(16, 23, 2), R.blood, {}); h.p(15, 22, 'd');
    h.shade(C(9, 23, 1.5), R.blue, {}); h.shade(C(23, 23, 1.5), R.toxic, {});
    h.star(5, 7, 'i', '8'); h.star(27, 7, 'i', '8'); h.star(16, 4, 'i', '8');
  });

  // ---------------- JEFES ----------------
  B('tasador', (h) => {
    // sombrero de copa
    h.shade(Rc(8, 1, 16, 9), R.night, {});
    h.shade(Rc(4, 9, 24, 3), R.night, {});
    h.fill(Rc(8, 7, 16, 1), 'b');
    // cara
    h.shade(E(16, 19, 10, 11), R.ash, { bias: 0.2 });
    // monóculo de latón y ojo entrecerrado
    h.shade(ring(21, 17, 4, 4, 1.4), R.brass, { ol: false });
    h.fill(C(21, 17, 2.4), 'r'); h.p(21, 17, '0'); h.p(20, 16, '8');
    h.line(9, 17, 13, 17, '0'); h.line(9, 16, 13, 15, '4');
    h.line(25, 20, 27, 30, 'g');
    // sonrisa fina y bigote
    h.line(11, 25, 21, 25, '1'); h.line(10, 23, 15, 24, '2'); h.line(22, 23, 17, 24, '2');
  });

  B('inquisidora', (h) => {
    // capirote alto
    h.shade(P([[16, 0], [27, 31], [5, 31]]), R.blood, { bias: 0.3 });
    h.fill(E(12.5, 18, 2.2, 1.4), '0'); h.fill(E(19.5, 18, 2.2, 1.4), '0');
    h.p(12, 18, 'i'); h.p(19, 18, 'i');
    // cruz bordada y runas tachadas
    h.line(16, 22, 16, 29, 'h'); h.line(13, 25, 19, 25, 'h');
    h.line(8, 27, 10, 29, '0'); h.line(10, 27, 8, 29, '0');
    h.line(22, 27, 24, 29, '0'); h.line(24, 27, 22, 29, '0');
    h.line(16, 4, 16, 12, '9');
  });

  B('durmiente', (h) => {
    // cabellera
    h.shade(U(E(16, 15, 13, 13), Rc(3, 15, 26, 16)), R.purple, { bias: 0.2 });
    // rostro pálido con ojos cerrados
    h.shade(E(16, 17, 8, 10), R.bone, {});
    h.line(11, 16, 14, 17, '4'); h.line(18, 17, 21, 16, '4');
    h.p(11, 18, '5'); h.p(21, 18, '5');
    h.line(14, 23, 18, 23, 'a');
    // Zzz
    h.glyphO(24, 3, ['111', '001', '010', '100', '111'], 'r');
    h.glyphO(28, 9, ['11', '01', '10', '11'], 'q');
    // flor marchita
    h.shade(C(6, 27, 2.2), R.mag, {}); h.line(6, 29, 8, 31, 'k');
  });

  B('espina', (h) => {
    // calavera con corona de espinas
    h.skull(16, 17, 1.4, R.bone, { glow: 'c' });
    const thorns = ring(16, 8, 14, 5.5, 2.6);
    h.shade(thorns, ['n', 'm', 'l', 'k'], {});
    [[3, 6], [9, 2], [16, 1], [23, 2], [29, 6], [6, 12], [26, 12]].forEach(([x, y]) => { h.p(x, y, 'm'); h.p(x, y - 1, 'n'); });
    h.p(11, 13, 'b'); h.p(22, 12, 'b'); h.p(22, 13, 'a');
  });

  // ---------------- TACOS ----------------
  CU('ebano', (h) => {
    h.diag(23, [
      { t0: -19, t1: -9, w: 4, ramp: ['3', '2', '1', '0'] },
      { t0: -8, t1: -7, w: 4, ramp: ['i', 'h', 'g', 'e'] },
      { t0: -6, t1: 13, w: 3, ramp: ['4', '2', '1'] },
      { t0: 14, t1: 16, w: 2, ramp: ['i', 'h'] },
      { t0: 17, t1: 19, w: 2, ramp: ['r', 'q'] },
    ]);
    // incrustaciones de oro (niveles)
    h.p(9, 15, 'h'); h.p(12, 12, 'h'); h.p(15, 9, 'h');
  });

  CU('vidrio', (h) => {
    h.diag(23, [
      { t0: -19, t1: -9, w: 4, ramp: ['8', 'r', 'q', 'p'] },
      { t0: -8, t1: -7, w: 4, ramp: ['8', '7', '6', '5'] },
      { t0: -6, t1: 13, w: 3, ramp: ['8', 'r', 'p'] },
      { t0: 14, t1: 16, w: 2, ramp: ['8', '7'] },
      { t0: 17, t1: 19, w: 2, ramp: ['r', 'q'] },
    ], 'p');
    // grietas
    h.p(10, 13, '0'); h.p(11, 13, '0'); h.p(11, 12, '0');
    h.p(16, 9, '0'); h.p(17, 8, '0');
  });

  CU('pacto', (h) => {
    h.diag(23, [
      { t0: -19, t1: -9, w: 4, ramp: ['b', 'a', '9', '9'] },
      { t0: -8, t1: -7, w: 4, ramp: ['7', '6', '5', '4'] },
      { t0: -6, t1: 13, w: 3, ramp: ['c', 'b', 'a'] },
      { t0: 14, t1: 16, w: 2, ramp: ['8', '7'] },
      { t0: 17, t1: 19, w: 2, ramp: ['r', 'q'] },
    ]);
    // sello de cera y gota
    h.shade(C(6, 6, 3), R.blood, {}); h.p(5, 5, 'd');
    h.drop(4, 20, 1.3, R.blood);
  });
})();
