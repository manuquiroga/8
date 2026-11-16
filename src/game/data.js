// 8 — datos de diseño: comodines, arcanos, lunas, tacos, jefes, círculos.
// Los IDs son el contrato con el arte: cada comodín necesita el sprite `joker_<id>` (32x32),
// cada consumible `item_<id>` (24x24), cada taco `cue_<id>`, cada jefe `boss_<id>` (32x32).
// Hooks de comodín (todos opcionales):
//   mods: {extraShots, pocketMul, powerMul, guide, noScratch, extraSlots}
//   onBall(S, b, J)   — por cada bola embocada (b = {ball, pocket, banked, idx})
//   onShot(S, J)      — tras puntuar las bolas del tiro
//   onAfter(S, J)     — tras el tiro (actualizar contadores de escalado)
//   onTableStart(R,J) / onTableEnd(R,J) / onScratch(S,J)
// S.add({chips, mult, xmult, money}, J) emite eventos animados.
window.OM = window.OM || {};

OM.RARITY = {
  comun:      { name: 'Común',      color: 'q', weight: 70, price: [4, 6] },
  raro:       { name: 'Raro',       color: 'm', weight: 25, price: [6, 8] },
  epico:      { name: 'Épico',      color: 'c', weight: 5,  price: [9, 11] },
  legendario: { name: 'Legendario', color: 'h', weight: 0,  price: [14, 16] },
};

const isSolid = (b) => b.num >= 1 && b.num <= 7;
const isStripe = (b) => b.num >= 9 && b.num <= 15;

OM.JOKERS = [
  // ---------------- COMUNES ----------------
  { id: 'tiza_azul', name: 'Tiza Azul', rarity: 'comun', desc: '+4 Mult en cada tiro que emboque.',
    onShot(S) { if (S.balls.length) S.add({ mult: 4 }, this); } },
  { id: 'taco_fresno', name: 'Taco de Fresno', rarity: 'comun', desc: '+40 Fichas en cada tiro que emboque.',
    onShot(S) { if (S.balls.length) S.add({ chips: 40 }, this); } },
  { id: 'lisas', name: 'Lisas Malditas', rarity: 'comun', desc: 'Cada bola LISA (1-7) embocada da +3 Mult.',
    onBall(S, b) { if (isSolid(b.ball)) S.add({ mult: 3 }, this); } },
  { id: 'rayadas', name: 'Rayadas Infames', rarity: 'comun', desc: 'Cada bola RAYADA (9-15) embocada da +30 Fichas.',
    onBall(S, b) { if (isStripe(b.ball)) S.add({ chips: 30 }, this); } },
  { id: 'primera_sangre', name: 'Primera Sangre', rarity: 'comun', desc: 'El primer tiro de cada mesa: x2 Mult.',
    onShot(S) { if (S.shotIndex === 0 && S.balls.length) S.add({ xmult: 2 }, this); } },
  { id: 'ultimo_aliento', name: 'Último Aliento', rarity: 'comun', desc: 'El último tiro de la mesa: x3 Mult.',
    onShot(S) { if (S.shotsLeft === 0 && S.balls.length) S.add({ xmult: 3 }, this); } },
  { id: 'banda_sangrienta', name: 'Banda Sangrienta', rarity: 'comun', desc: 'Cada bola embocada tras tocar banda: +5 Mult.',
    onBall(S, b) { if (b.banked) S.add({ mult: 5 }, this); } },
  { id: 'carambolero', name: 'Carambolero', rarity: 'comun', desc: '+2 Mult por cada bola distinta que toque la blanca.',
    onShot(S) { if (S.balls.length && S.cueContacts > 0) S.add({ mult: 2 * S.cueContacts }, this); } },
  { id: 'usurero', name: 'Usurero', rarity: 'comun', desc: 'Gana $1 por cada tiro que emboque ($3 si son 2 o más bolas).',
    onShot(S) { const n = S.balls.length; if (n) S.add({ money: n >= 2 ? 3 : 1 }, this); } },
  { id: 'esquinero', name: 'Esquinero', rarity: 'comun', desc: 'Bolas en troneras de ESQUINA: +4 Mult.',
    onBall(S, b) { if (b.pocket.corner) S.add({ mult: 4 }, this); } },
  { id: 'murcielago', name: 'Murciélago', rarity: 'comun', desc: 'Bolas en troneras LATERALES: +60 Fichas.',
    onBall(S, b) { if (!b.pocket.corner) S.add({ chips: 60 }, this); } },
  { id: 'vela_negra', name: 'Vela Negra', rarity: 'comun', desc: '+1 Tiro en cada mesa.', mods: { extraShots: 1 } },
  { id: 'iman', name: 'Imán Oxidado', rarity: 'comun', desc: 'Las troneras son un 18% más grandes.', mods: { pocketMul: 1.18 } },
  // v1.1 — control y racha (no dependen de dobletes)
  { id: 'eslabon', name: 'Eslabón', rarity: 'comun', desc: '+25 Fichas por cada nivel de RACHA.',
    onShot(S) { if (S.balls.length && S.streak) S.add({ chips: 25 * S.streak }, this); } },
  { id: 'limosna', name: 'Limosna', rarity: 'comun', desc: 'Cada tiro que FALLA te da $1.',
    onShot(S) { if (!S.balls.length && !S.scratch) S.add({ money: 1 }, this); } },
  { id: 'maestro_efecto', name: 'Maestro del Efecto', rarity: 'comun', desc: 'Tiros con efecto (retroceso, seguimiento o lateral): +5 Mult.',
    onShot(S) { if (S.balls.length && S.spun) S.add({ mult: 5 }, this); } },

  // ---------------- RAROS ----------------
  { id: 'racha', name: 'Racha Febril', rarity: 'raro', desc: 'Gana +2 Mult por cada tiro seguido que emboca. Se reinicia al fallar. (Actual: +{v} Mult)',
    state: () => ({ v: 0 }),
    onShot(S, J) { if (S.balls.length && J.st.v) S.add({ mult: J.st.v }, J); },
    onAfter(S, J) { J.st.v = S.balls.length && !S.scratch ? J.st.v + 2 : 0; } },
  { id: 'cementerio', name: 'Cementerio', rarity: 'raro', desc: 'Gana +3 Fichas permanentes por cada bola embocada. (Actual: +{v})',
    state: () => ({ v: 0 }),
    onShot(S, J) { if (S.balls.length && J.st.v) S.add({ chips: J.st.v }, J); },
    onAfter(S, J) { J.st.v += 3 * S.balls.length; } },
  { id: 'doble_fondo', name: 'Doble Fondo', rarity: 'raro', desc: 'Tiros con 2 o más bolas: x3 Mult.',
    onShot(S) { if (S.balls.length >= 2) S.add({ xmult: 3 }, this); } },
  { id: 'ojo_cuervo', name: 'Ojo de Cuervo', rarity: 'raro', desc: 'La guía muestra el rebote de la blanca y la trayectoria completa.', mods: { guide: 2 } },
  { id: 'ricochet', name: 'Ricochet', rarity: 'raro', desc: '+12 Mult si la blanca toca 3 o más bandas.',
    onShot(S) { if (S.balls.length && S.cueCushions >= 3) S.add({ mult: 12 }, this); } },
  { id: 'carronero', name: 'Carroñero', rarity: 'raro', desc: 'Al meter la blanca: ganas $3 y el tiro SÍ puntúa.',
    mods: { scratchScores: true }, onScratch(S) { S.add({ money: 3 }, this); } },
  { id: 'martillo', name: 'Martillo de Hueso', rarity: 'raro', desc: '+35% de potencia. Saque: x3 Mult.', mods: { powerMul: 1.35 },
    onShot(S) { if (S.isBreak && S.balls.length) S.add({ xmult: 3 }, this); } },
  { id: 'cuenta_atras', name: 'Reloj de Arena', rarity: 'raro', desc: 'x0.5 Mult extra por cada tiro que te quede.',
    onShot(S) { if (S.balls.length && S.shotsLeft > 0) S.add({ xmult: 1 + 0.5 * S.shotsLeft }, this); } },
  { id: 'vampiro', name: 'Vampiro', rarity: 'raro', desc: 'Gana x0.25 Mult por cada bola GRABADA embocada. (Actual: x{v})',
    state: () => ({ v: 1 }),
    onShot(S, J) { if (S.balls.length && J.st.v > 1) S.add({ xmult: J.st.v }, J); },
    onAfter(S, J) { J.st.v += 0.25 * S.balls.filter((b) => b.ball.kind !== 'normal').length; } },
  { id: 'ocho_maldito', name: 'El 8', rarity: 'raro', desc: 'Meter la 8 antes de tiempo NO maldice: da x3 Mult.',
    mods: { eightSafe: true }, onBall(S, b) { if (b.ball.num === 8) S.add({ xmult: 3 }, this); } },
  { id: 'fantasma', name: 'Blanca Fantasma', rarity: 'raro', desc: 'La blanca no puede caer en las troneras.', mods: { noScratch: true } },
  { id: 'pulso', name: 'Pulso de Cirujano', rarity: 'raro', desc: 'x1.5 Mult si la blanca NO toca ninguna banda.',
    onShot(S) { if (S.balls.length && S.cueCushions === 0) S.add({ xmult: 1.5 }, this); } },
  { id: 'segunda', name: 'Segunda Oportunidad', rarity: 'raro', desc: 'Una vez por mesa, si un tiro no mete nada, lo recuperas.', mods: { refundMiss: true } },

  // ---------------- ÉPICOS ----------------
  { id: 'avalancha', name: 'Avalancha', rarity: 'epico', desc: 'Cada bola embocada multiplica x1.5 Mult.',
    onBall(S) { S.add({ xmult: 1.5 }, this); } },
  { id: 'eco', name: 'Eco del Abismo', rarity: 'epico', desc: 'La primera bola de cada tiro puntúa DOS veces.', mods: { retriggerFirst: true } },
  { id: 'calavera_dorada', name: 'Calavera Dorada', rarity: 'epico', desc: 'x2.5 Mult. Pierdes $1 en cada tiro que emboque.',
    onShot(S) { if (S.balls.length) S.add({ xmult: 2.5 }, this); S.add({ money: -1 }, this); } },
  { id: 'espejo_roto', name: 'Espejo Roto', rarity: 'epico', desc: 'Copia la habilidad del comodín a su DERECHA.', copy: true },
  { id: 'parca', name: 'La Parca', rarity: 'epico', desc: 'x3 Mult si quedan 5 bolas o menos en la mesa.',
    onShot(S) { if (S.balls.length && S.ballsLeft <= 5) S.add({ xmult: 3 }, this); } },
  { id: 'cadena', name: 'Cadena Infernal', rarity: 'epico', desc: 'x0.5 Mult extra por cada nivel de RACHA.', unlock: 'racha5',
    onShot(S) { if (S.balls.length && S.streak) S.add({ xmult: 1 + 0.5 * S.streak }, this); } },

  // ---------------- LEGENDARIOS (solo en Sobres Malditos) ----------------
  { id: 'diablo', name: 'El Diablo', rarity: 'legendario', desc: 'Cada bola embocada da $1 y x1.25 Mult.',
    onBall(S) { S.add({ money: 1, xmult: 1.25 }, this); } },
  { id: 'ojo_abismo', name: 'Ojo del Abismo', rarity: 'legendario', desc: 'Cada bola cuenta como si estuviera grabada en HOLO (+10 Mult).',
    onBall(S) { S.add({ mult: 10 }, this); } },
  { id: 'barquero', name: 'El Barquero', rarity: 'legendario', desc: 'Las troneras atraen las bolas con fuerza y son un 15% más grandes.', unlock: 'win',
    mods: { pocketMul: 1.15, pocketPull: 3 } },
];

// Ediciones de comodín (v1.1). Salen al azar en la tienda y sobres.
OM.EDITIONS = {
  foil:     { name: 'Laminado', desc: '+50 Fichas', chance: 0.08, price: 2 },
  holo:     { name: 'Holográfico', desc: '+10 Mult', chance: 0.04, price: 3 },
  poli:     { name: 'Policromo', desc: 'x1.5 Mult', chance: 0.02, price: 5 },
  negativo: { name: 'Negativo', desc: '+1 hueco de comodín', chance: 0.02, price: 5 },
};

// Desbloqueos persistentes (v1.1). test(META) → desbloqueado.
OM.UNLOCKS = {
  circulo2: { desc: 'Llega al Círculo II', test: (M) => M.best >= 1 },
  circulo3: { desc: 'Llega al Círculo III', test: (M) => M.best >= 2 },
  circulo4: { desc: 'Llega al Círculo IV', test: (M) => M.best >= 3 },
  racha5:   { desc: 'Consigue una RACHA x5 en una mesa', test: (M) => (M.maxStreak || 0) >= 4 },
  jefes3:   { desc: 'Derrota a 3 jefes (total)', test: (M) => (M.bosses || 0) >= 3 },
  win:      { desc: 'Escapa del Abismo una vez', test: (M) => M.wins >= 1 },
};
OM.isUnlocked = (key) => !key || !OM.UNLOCKS[key] || OM.UNLOCKS[key].test(OM.META || {});

// Grabados de bola (mejoras permanentes del "mazo" de 15 bolas)
OM.ENGRAVINGS = {
  normal: { name: 'Normal', desc: '' },
  oro:     { name: 'Oro',     desc: '+$3 al embocarla.' },
  cristal: { name: 'Cristal', desc: 'x2 Mult. 1 de 4 se rompe para siempre.' },
  plomo:   { name: 'Plomo',   desc: '+50 Fichas. Pesa el doble.' },
  fuego:   { name: 'Fuego',   desc: '+3 Mult por cada bola embocada en el tiro.' },
  holo:    { name: 'Holo',    desc: '+10 Mult.' },
  bomba:   { name: 'Bomba',   desc: 'Explota al primer golpe y dispersa las bolas. +30 Fichas.' },
};

// Tipos de tiro (como las "manos" de póker). Mejorables con Lunas Negras.
OM.SHOT_TYPES = {
  simple:   { name: 'Simple',   chips: 20,  mult: 1, lvlChips: 10, lvlMult: 1 },
  doblete:  { name: 'Doblete',  chips: 40,  mult: 2, lvlChips: 15, lvlMult: 1 },
  triplete: { name: 'Triplete', chips: 70,  mult: 3, lvlChips: 20, lvlMult: 2 },
  masacre:  { name: 'Masacre',  chips: 120, mult: 5, lvlChips: 30, lvlMult: 3 },
  limpia:   { name: 'Mesa Limpia', chips: 200, mult: 8, lvlChips: 40, lvlMult: 4 },
};

// Consumibles: Arcanos (efectos), Grabados (mejoran bolas) y Lunas (suben nivel de tiro)
OM.ITEMS = [
  // Arcanos — se usan durante la mesa o en la tienda
  { id: 'tiza', name: 'La Tiza', kind: 'arcano', desc: '+1 Tiro en esta mesa.', when: 'table' },
  { id: 'mano', name: 'La Mano', kind: 'arcano', desc: 'Coloca la blanca donde quieras.', when: 'table' },
  { id: 'rueda', name: 'La Rueda', kind: 'arcano', desc: 'Vuelve a colocar las bolas que quedan en triángulo.', when: 'table' },
  { id: 'ojo', name: 'El Ojo', kind: 'arcano', desc: 'Guía completa durante esta mesa.', when: 'table' },
  { id: 'ermitano', name: 'El Ermitaño', kind: 'arcano', desc: 'Duplica tu dinero (máx. +$20).', when: 'any' },
  { id: 'alquimista', name: 'El Alquimista', kind: 'arcano', desc: 'Convierte 2 bolas al azar en Oro.', when: 'any' },
  { id: 'juicio', name: 'El Juicio', kind: 'arcano', desc: 'Crea un comodín aleatorio (si hay hueco).', when: 'any' },
  // Grabados — se aplican a una bola elegida de tu set
  { id: 'g_oro', name: 'Grabado de Oro', kind: 'grabado', eng: 'oro', desc: 'Graba ORO en una bola: +$3 al embocarla.', when: 'any' },
  { id: 'g_cristal', name: 'Grabado de Cristal', kind: 'grabado', eng: 'cristal', desc: 'Graba CRISTAL: x2 Mult, puede romperse.', when: 'any' },
  { id: 'g_plomo', name: 'Grabado de Plomo', kind: 'grabado', eng: 'plomo', desc: 'Graba PLOMO: +50 Fichas, pesa el doble.', when: 'any' },
  { id: 'g_fuego', name: 'Grabado de Fuego', kind: 'grabado', eng: 'fuego', desc: 'Graba FUEGO: +3 Mult por bola del tiro.', when: 'any' },
  { id: 'g_holo', name: 'Grabado Holo', kind: 'grabado', eng: 'holo', desc: 'Graba HOLO: +10 Mult.', when: 'any' },
  { id: 'g_bomba', name: 'Grabado Bomba', kind: 'grabado', eng: 'bomba', desc: 'Graba BOMBA: explota al primer golpe.', when: 'any' },
  // Lunas Negras — suben de nivel un tipo de tiro
  { id: 'luna_simple', name: 'Luna de Ceniza', kind: 'luna', shot: 'simple', desc: 'Sube de nivel el tiro SIMPLE.', when: 'any' },
  { id: 'luna_doblete', name: 'Luna de Sangre', kind: 'luna', shot: 'doblete', desc: 'Sube de nivel el DOBLETE.', when: 'any' },
  { id: 'luna_triplete', name: 'Luna Ahogada', kind: 'luna', shot: 'triplete', desc: 'Sube de nivel el TRIPLETE.', when: 'any' },
  { id: 'luna_masacre', name: 'Luna Podrida', kind: 'luna', shot: 'masacre', desc: 'Sube de nivel la MASACRE.', when: 'any' },
  { id: 'luna_limpia', name: 'Luna Vacía', kind: 'luna', shot: 'limpia', desc: 'Sube de nivel la MESA LIMPIA.', when: 'any' },
];

// Tacos = "mazos" iniciales
OM.CUES = [
  { id: 'peregrino', name: 'Taco del Peregrino', desc: 'Equilibrado. 5 tiros por mesa, $4.', shots: 5, money: 4 },
  { id: 'sangriento', name: 'Taco Sangriento', desc: 'Empieza con Tiza Azul. 4 tiros por mesa.', shots: 4, money: 4, joker: 'tiza_azul' },
  { id: 'usura', name: 'Taco de la Usura', desc: 'Empieza con $12. Interés hasta $8.', shots: 5, money: 12, interestCap: 8, unlock: 'circulo2' },
  { id: 'hueso', name: 'Taco de Hueso', desc: '3 bolas grabadas al azar. 1 comodín menos.', shots: 5, money: 4, randomEng: 3, slots: -1, unlock: 'circulo3' },
  { id: 'espectral', name: 'Taco Espectral', desc: 'Empieza con Blanca Fantasma. 4 tiros por mesa.', shots: 4, money: 4, joker: 'fantasma', unlock: 'jefes3' },
];

// Jefes (mesas de jefe con reglas malditas)
OM.BOSSES = [
  { id: 'sepulturero', name: 'El Sepulturero', desc: 'Las troneras laterales están selladas.' },
  { id: 'niebla', name: 'La Niebla', desc: 'Solo ves cerca de la bola blanca.' },
  { id: 'gloton', name: 'El Glotón', desc: 'La primera bola de cada tiro no da Fichas.' },
  { id: 'sanguijuela', name: 'La Sanguijuela', desc: 'Pierdes $1 por cada tiro.' },
  { id: 'pendulo', name: 'El Péndulo', desc: 'La mesa se inclina y oscila.' },
  { id: 'verdugo', name: 'El Verdugo', desc: 'Meter la blanca te cuesta 2 tiros.' },
  { id: 'cienaga', name: 'La Ciénaga', desc: 'El paño frena el doble.' },
  { id: 'escarcha', name: 'La Escarcha', desc: 'El paño apenas frena. Todo resbala.' },
  { id: 'coleccionista', name: 'El Coleccionista', desc: 'Solo puntúan las bolas RAYADAS.' },
  { id: 'ciego', name: 'El Ciego', desc: 'No hay guía de apuntado: solo el taco.' },
  { id: 'purista', name: 'La Purista', desc: 'Solo puntúan las bolas LISAS.' },
  { id: 'reloj', name: 'El Reloj', desc: 'Tienes 1 tiro menos en esta mesa.' },
  { id: 'boca', name: 'La Boca', desc: 'Las troneras se encogen a la mitad.', final: true },
];

// Círculos (actos). 3 mesas cada uno: Menor, Mayor, Jefe.
OM.CIRCLES = [
  { id: 'limbo',    name: 'I · Limbo',     base: 200,   theme: 'limbo' },
  { id: 'lujuria',  name: 'II · Lujuria',  base: 550,   theme: 'lujuria' },
  { id: 'gula',     name: 'III · Gula',    base: 1500,  theme: 'gula' },
  { id: 'avaricia', name: 'IV · Avaricia', base: 4500,  theme: 'avaricia' },
  { id: 'ira',      name: 'V · Ira',       base: 10000, theme: 'ira' },
  { id: 'abismo',   name: 'VI · Abismo',   base: 22000, theme: 'abismo' },
];
OM.TABLE_KINDS = [
  { id: 'menor', name: 'Mesa Menor', mul: 1, reward: 3 },
  { id: 'mayor', name: 'Mesa Mayor', mul: 1.5, reward: 4 },
  { id: 'jefe',  name: 'Mesa Jefe',  mul: 2, reward: 5 },
];
