// 8 — datos de diseño del pool arcade 1v1: comodines, tacos, obstáculos y puntos.
// El arte se reutiliza: cada comodín usa el sprite `joker_<art || id>` (32x32), cada taco `cue_<art || id>`
// y cada obstáculo la medalla `boss_<art || id>`.
//
// Hay tres TIPOS de comodín (campo `type`):
//   'comodin' (por defecto) — da puntos o dinero. Se quedan toda la serie. Máximo OM.SHOP.slots.
//   'hechizo' — cambia cómo se juega (guía, troneras, trastadas...). Solo uno a la vez y dura UNA partida.
//   'activo'  — se usa una vez (clic + USAR) y desaparece. Solo uno a la vez; se guarda entre partidas.
// Se consiguen en la TIENDA, antes de cada partida, con dinero ($). Ver OM.SHOP.
//
// Hooks de comodín (todos opcionales). S = marcador del tiro (ver OM.Match.resolve):
//   mods:  {pocketMul, pocketPull, powerMul, guide, guideLen, noScratch, trickMul, pointsMul, clock, ...} en TU turno
//   rival: {pocketMul, guide, shake, clock, noSpin, tilt, frictionMul} en el turno del RIVAL (trastadas)
//   onBall(S, b)      — por cada bola TUYA embocada en un tiro legal. b = {num, pocket, banked, combo}
//   onPot(S, b)       — por cada bola embocada en un tiro legal (también las del rival)
//   onShot(S)         — tiro legal que emboca al menos una bola tuya
//   onMiss(S)         — tiro legal que no emboca nada tuyo
//   onFoul(S)         — tu falta
//   onWinBall(S)      — metes la bola que gana la partida
//   onBreakBall(S, b) — una bola tuya entra en TU saque
//   onRivalFoul(S) / onRivalBall(S, b) / onRivalGift(S, b)  — cuando tira el rival (S.addRival te da puntos a ti)
//   onMatchStart(Ser, J)
//   onMatchEnd(Ser, J, won) -> puntos extra al terminar la partida (línea en el resumen)
//   onPayday(Ser, J, P, R) -> $ extra al cobrar antes de la tienda
// S.add({pts, mult, xmult, steal, cash}, this) emite eventos animados. `this` = la carta que se ilumina
// (this.st = estado persistente de la serie, this.inst.used = gastado en esta partida).
// S.cur = datos del tiro: {power, spun, elev, jumped (intentó saltar), hopped (nº de bolas que saltó), curved, kick, cueCushions, cueContacts, dist}
window.OM = window.OM || {};

OM.RARITY = {
  comun:      { name: 'Común',      color: 'q', weight: 60 },
  raro:       { name: 'Raro',       color: 'm', weight: 30 },
  epico:      { name: 'Épico',      color: 'c', weight: 8 },
  legendario: { name: 'Legendario', color: 'h', weight: 2 },
};

// Puntos base del arcade. El total de un tiro es Puntos × Combo.
OM.POINTS = {
  ball: 100,        // bola tuya embocada
  breakBall: 25,    // bola embocada en el saque (saque nerfeado: sin combos ni comodines)
  bank: 50,         // la bola tocó banda antes de entrar
  combo: 100,       // combinación: entra una bola que no es la que tocó la blanca
  kick: 100,        // la blanca tocó banda antes de la primera bola
  far: 50,          // tiro largo
  trick: 150,       // embocar saltando una bola o con massé
  finish: 500,      // la 8 (o la 9) que gana
  foul: 50,         // lo que resta una falta
  win: [1000, 1250, 1500, 2000, 3000], // por ganar cada partida de la serie
  leftover: 100,    // paliza: por cada bola que le quedó al rival
  clock: 30,        // segundos por tiro (El Reloj: 15)
  multi: [1, 1, 2, 3, 5], // Combo base por nº de bolas tuyas en el tiro (4+ = x5)
  streakCap: 5,
};
OM.MULTI_NAMES = ['', '¡DENTRO!', '¡DOBLE!', '¡TRIPLE!', '¡MASACRE!'];

// ---------------- TIENDA Y DINERO ----------------
// Diseño anti-bola-de-nieve:
//  - Todos cobran un sueldo fijo. El que PIERDE la partida y el que va POR DETRÁS en la serie cobran más,
//    ven una carta más y su primer cambio de tienda es gratis.
//  - Los trucos (dobles, saltos, massés, rebotes, tacadas) dan dinero, pero con TOPE por partida.
//  - Sin intereses: guardar dinero no rinde salvo con comodines concretos (que ocupan hueco).
//  - Los hechizos duran una partida y los activos se gastan: el dinero se recicla en vez de acumularse.
OM.SHOP = {
  slots: 4,                 // máximo de comodines (de puntos/dinero). Aparte: 1 hechizo + 1 activo.
  time: 20,                 // segundos para comprar; al acabarse, la tienda se cierra sola
  start: 10,                // dinero para la primera tienda
  wage: 4,                  // sueldo tras cada partida
  loser: 2,                 // extra para quien pierde la partida
  behind: 2,                // extra para quien va por detrás en la serie al abrir la tienda
  trickCap: 6,              // tope de $ por trucos en una partida
  // $ por trucos (dentro de un tiro legal que emboca bolas tuyas)
  trick: { double: 1, triple: 2, massacre: 3, hop: 1, masse: 1, kick: 1, streak: 1 },
  offers: { comodin: 3, hechizo: 1, activo: 1 }, // cartas por tienda (+1 comodín si vas por detrás)
  reroll: 1,                // cambiar la tienda cuesta 1, luego 2, 3...
  price: {
    comodin: { comun: 4, raro: 6, epico: 8, legendario: 11 },
    hechizo: { comun: 3, raro: 4, epico: 6, legendario: 8 },
    activo:  { comun: 2, raro: 4, epico: 6, legendario: 8 },
  },
};
OM.JTYPE = {
  comodin: { name: 'Comodín', short: 'COMODÍN', color: 'q', desc: 'Da puntos o dinero. Te lo quedas toda la serie.' },
  hechizo: { name: 'Hechizo', short: 'HECHIZO', color: 'u', desc: 'Cambia cómo se juega. Solo uno a la vez y dura UNA partida.' },
  activo:  { name: 'Activo',  short: 'ACTIVO',  color: 'v', desc: 'Úsalo en tu turno (clic + USAR). Se gasta al usarlo.' },
};
OM.jtype = (def) => (def && def.type) || 'comodin';

const isSolid = (n) => n >= 1 && n <= 7;
const isStripe = (n) => n >= 9;
const H = 'hechizo', A = 'activo';

OM.JOKERS = [
  // ======================= COMODINES: puntos y dinero (toda la serie) =======================
  // ---------------- comunes ----------------
  { id: 'tiza_azul', name: 'Tiza Azul', rarity: 'comun', desc: '+1 Combo en cada tiro que emboque.',
    onShot(S) { S.add({ mult: 1 }, this); } },
  { id: 'mano_firme', art: 'taco_fresno', name: 'Mano Firme', rarity: 'comun', desc: '+40 Puntos por cada bola tuya embocada.',
    onBall(S) { S.add({ pts: 40 }, this); } },
  { id: 'bandolero', art: 'banda_sangrienta', name: 'Bandolero', rarity: 'comun', desc: 'Bola embocada DE BANDA: +150 Puntos y +1 Combo.',
    onBall(S, b) { if (b.banked) S.add({ pts: 150, mult: 1 }, this); } },
  { id: 'combinador', name: 'Combinador', rarity: 'comun', desc: 'Bola embocada por COMBINACIÓN: +150 Puntos y +1 Combo.',
    onBall(S, b) { if (b.combo) S.add({ pts: 150, mult: 1 }, this); } },
  { id: 'esquinero', name: 'Esquinero', rarity: 'comun', desc: 'Bolas en troneras de ESQUINA: +50 Puntos.',
    onBall(S, b) { if (b.pocket.corner) S.add({ pts: 50 }, this); } },
  { id: 'murcielago', name: 'Murciélago', rarity: 'comun', desc: 'Bolas en troneras LATERALES: +120 Puntos.',
    onBall(S, b) { if (!b.pocket.corner) S.add({ pts: 120 }, this); } },
  { id: 'primera_sangre', name: 'Primera Sangre', rarity: 'comun', desc: 'Tu primer tiro que emboque en cada partida: x3 Combo.',
    onShot(S) { if (!this.inst.used) { this.inst.used = true; S.add({ xmult: 3 }, this); } } },
  { id: 'maestro_efecto', name: 'Maestro del Efecto', rarity: 'comun', desc: 'Embocar con EFECTO: +100 Puntos.',
    onShot(S) { if (S.cur.spun) S.add({ pts: 100 }, this); } },
  { id: 'martillo', name: 'Martillo de Hueso', rarity: 'comun', desc: '+25% de potencia. Embocar a 85% de potencia o más: +150 Puntos.', mods: { powerMul: 1.25 },
    onShot(S) { if (S.cur.power >= 0.85) S.add({ pts: 150 }, this); } },
  { id: 'pulso', name: 'Pulso de Cirujano', rarity: 'comun', desc: 'Embocar a 35% de potencia o menos: +150 Puntos.',
    onShot(S) { if (S.cur.power <= 0.35) S.add({ pts: 150 }, this); } },
  { id: 'remontada', art: 'ultimo_aliento', name: 'Remontada', rarity: 'comun', desc: 'Mientras vayas PERDIENDO la serie en puntos: x1.5 Combo.',
    onShot(S) { if (S.P.points < S.R.points) S.add({ xmult: 1.5 }, this); } },
  { id: 'limosna', name: 'Limosna', rarity: 'comun', desc: 'Cada FALLO (sin falta) te da +60 Puntos.',
    onMiss(S) { S.add({ pts: 60 }, this); } },
  { id: 'carambolero', name: 'Carambolero', rarity: 'comun', desc: 'Al embocar: +40 Puntos por cada bola distinta que tocó la blanca.',
    onShot(S) { if (S.cur.cueContacts > 0) S.add({ pts: 40 * S.cur.cueContacts }, this); } },
  { id: 'francotirador', art: 'paciente', name: 'Francotirador', rarity: 'comun', desc: 'Embocar DE LEJOS (más de media mesa): +150 Puntos.',
    onShot(S) { if (S.cur.dist > 200) S.add({ pts: 150 }, this); } },
  { id: 'barrendero', name: 'Barrendero', rarity: 'comun', desc: 'Al embocar: +25 Puntos por cada bola tuya que ya no esté en la mesa.',
    onShot(S) { if (S.cleared > 0) S.add({ pts: 25 * S.cleared }, this); } },
  { id: 'eslabon', name: 'Eslabón', rarity: 'comun', desc: '+60 Puntos por cada nivel de TACADA.',
    onShot(S) { if (S.streak) S.add({ pts: 60 * S.streak }, this); } },
  { id: 'lisas', name: 'Devoto de las Lisas', rarity: 'comun', desc: 'Cada bola LISA (1-7) que emboques: +80 Puntos.',
    onBall(S, b) { if (isSolid(b.num)) S.add({ pts: 80 }, this); } },
  { id: 'rayadas', name: 'Devoto de las Rayadas', rarity: 'comun', only8: true, desc: 'Cada bola RAYADA (9-15) que emboques: +80 Puntos.',
    onBall(S, b) { if (isStripe(b.num)) S.add({ pts: 80 }, this); } },
  { id: 'tercera', name: 'A la Tercera', rarity: 'comun', desc: 'Cada TERCERA bola que emboques en la partida: +300 Puntos. (Llevas {v})',
    state: () => ({ v: 0 }),
    onMatchStart(Ser, J) { J.st.v = 0; },
    onBall(S) { this.st.v++; if (this.st.v % 3 === 0) S.add({ pts: 300 }, this); } },
  { id: 'peaje', art: 'diezmo', name: 'Peaje', rarity: 'comun', desc: 'Cada FALTA del rival te da +200 Puntos.',
    onRivalFoul(S) { S.addRival({ pts: 200 }, this); } },
  { id: 'maldicion', art: 'pares', name: 'Maldición', rarity: 'comun', desc: 'Si el rival mete una bola TUYA: +250 Puntos para ti.',
    onRivalGift(S) { S.addRival({ pts: 250 }, this); } },
  // nuevos (3.1)
  { id: 'hucha', name: 'La Hucha', rarity: 'comun', desc: 'Al cobrar tras cada partida: +$3.',
    onPayday() { return 3; } },
  { id: 'tahur', name: 'El Tahúr', rarity: 'comun', desc: 'Cada tiro con 2 o más bolas tuyas: +$1.',
    onShot(S) { if (S.balls.length >= 2) S.add({ cash: 1 }, this); } },
  { id: 'saltimbanqui', name: 'Saltimbanqui', rarity: 'comun', desc: 'Embocar con SALTO o MASSÉ: +200 Puntos y +$1.',
    onShot(S) { if (S.cur.hopped || S.cur.curved) S.add({ pts: 200, cash: 1 }, this); } },
  { id: 'cobrador', name: 'El Cobrador', rarity: 'comun', desc: 'Cada FALTA del rival: +100 Puntos y +$1 para ti.',
    onRivalFoul(S) { S.addRival({ pts: 100, cash: 1 }, this); } },
  { id: 'pobre_diablo', name: 'Pobre Diablo', rarity: 'comun', desc: 'Al cobrar, si vas PERDIENDO la serie: +$4.',
    onPayday(Ser, J, P, R) { return P.points < R.points ? 4 : 0; } },
  { id: 'rompedor', name: 'Rompedor', rarity: 'comun', desc: 'Tus bolas en el SAQUE valen 150 Puntos en vez de 25, y cada una da +$1.',
    onBreakBall(S) { S.add({ pts: 125, cash: 1 }, this); } },
  { id: 'equilibrista', name: 'Equilibrista', rarity: 'comun', desc: 'Embocar sin que la blanca toque ninguna BANDA: +100 Puntos.',
    onShot(S) { if (!S.cur.cueCushions) S.add({ pts: 100 }, this); } },

  // ---------------- raros ----------------
  { id: 'doble_fondo', name: 'Doble o Nada', rarity: 'raro', desc: 'Tiros con 2 o más bolas tuyas: x2 Combo.',
    onShot(S) { if (S.balls.length >= 2) S.add({ xmult: 2 }, this); } },
  { id: 'racha', name: 'Racha Febril', rarity: 'raro', desc: '+1 Combo extra por cada nivel de TACADA.',
    onShot(S) { if (S.streak) S.add({ mult: S.streak }, this); } },
  { id: 'ricochet', name: 'Ricochet', rarity: 'raro', desc: 'Embocar con la blanca tocando 2 o más bandas: +400 Puntos.',
    onShot(S) { if (S.cur.cueCushions >= 2) S.add({ pts: 400 }, this); } },
  { id: 'ladron', art: 'usurero', name: 'Ladrón', rarity: 'raro', desc: 'Cada bola tuya embocada ROBA 30 Puntos al rival.',
    onBall(S) { S.add({ steal: 30 }, this); } },
  { id: 'cementerio', name: 'Cementerio', rarity: 'raro', desc: 'Gana +10 Puntos permanentes por cada bola que emboques. (Actual: +{v} por tiro)',
    state: () => ({ v: 0 }),
    onShot(S) { if (this.st.v) S.add({ pts: this.st.v }, this); this.st.v += 10 * S.balls.length; } },
  { id: 'ocho_maldito', name: 'El 8', rarity: 'raro', desc: 'Meter la bola que GANA la partida: +500 Puntos.',
    onWinBall(S) { S.add({ pts: 500 }, this); } },
  { id: 'matrimonio', name: 'Matrimonio Maldito', rarity: 'raro', desc: 'Meter una bola TUYA y una del RIVAL en el mismo tiro: +400 Puntos.',
    onShot(S) { if (S.gifts.length) S.add({ pts: 400 }, this); } },
  { id: 'rencor', art: 'sangria', name: 'Rencor', rarity: 'raro', desc: 'Cada bola que emboca el rival te carga +0.5 Combo para tu próximo tiro que emboque. (Cargado: +{v})',
    state: () => ({ v: 0 }),
    onRivalBall() { this.st.v = Math.min(6, this.st.v + 0.5); },
    onShot(S) { if (this.st.v) { S.add({ mult: this.st.v }, this); this.st.v = 0; } } },
  { id: 'trucos', art: 'astrologo', name: 'Trucos de Feria', rarity: 'raro', desc: 'Embocar SALTANDO por encima de una bola, o con MASSÉ: x3 Combo.',
    onShot(S) { if (S.cur.hopped || S.cur.curved) S.add({ xmult: 3 }, this); } },
  { id: 'bola_oro', art: 'calavera_dorada', name: 'Bola de Oro', rarity: 'raro', desc: 'En cada partida una bola al azar es de ORO. Si la embocas tú: +500 Puntos y +$2.', gold: true,
    onPot(S, b) { if (S.M.gold && S.M.gold[b.num] === S.me) S.add({ pts: 500, cash: 2 }, this); } },
  // nuevos (3.1)
  { id: 'prestamista', name: 'Prestamista', rarity: 'raro', desc: 'Al cobrar: +$1 por cada $4 que tengas guardados (máx. +$4).',
    onPayday(Ser, J, P) { return Math.min(4, Math.floor(P.money / 4)); } },
  { id: 'avaro', name: 'El Avaro', rarity: 'raro', desc: 'Al embocar: +1 Combo por cada $3 que tengas guardados (máx. +5).',
    onShot(S) { const v = Math.min(5, Math.floor(S.P.money / 3)); if (v) S.add({ mult: v }, this); } },
  { id: 'vengador', name: 'El Vengador', rarity: 'raro', desc: 'Tras cada FALTA del rival, tu próximo tiro que emboque: x2 Combo. (Cargado: {v})',
    state: () => ({ v: 0 }),
    onRivalFoul() { this.st.v = 1; },
    onShot(S) { if (this.st.v) { this.st.v = 0; S.add({ xmult: 2 }, this); } } },
  { id: 'ultimo_suspiro', name: 'Último Suspiro', rarity: 'raro', desc: 'Embocar tu ÚLTIMA bola antes de la bola final (la 8 o la 9): +500 Puntos.',
    onShot(S) { if (S.left === 0 && !S.won) S.add({ pts: 500 }, this); } },
  { id: 'la_banda', name: 'La Banda', rarity: 'raro', desc: 'Al embocar: +1 Combo por cada OTRO comodín, hechizo o activo que tengas.',
    onShot(S) { const v = S.P.jokers.length - 1; if (v > 0) S.add({ mult: v }, this); } },

  // ---------------- épicos ----------------
  { id: 'avalancha', name: 'Avalancha', rarity: 'epico', desc: 'Cada bola tuya embocada: x1.5 Combo.',
    onBall(S) { S.add({ xmult: 1.5 }, this); } },
  { id: 'eco', name: 'Eco del Abismo', rarity: 'epico', desc: 'La primera bola de cada tiro puntúa DOS veces.', mods: { retriggerFirst: true } },
  { id: 'cadena', name: 'Cadena Infernal', rarity: 'epico', desc: 'Tu TACADA no se pierde al fallar: solo se reinicia con una falta.', mods: { keepStreak: true } },
  { id: 'espejo_roto', name: 'Espejo Roto', rarity: 'epico', desc: 'Copia el comodín de su IZQUIERDA.', copy: true },
  // nuevos (3.1)
  { id: 'fenix', name: 'El Fénix', rarity: 'epico', desc: 'Cada partida que PIERDAS: +700 Puntos. Al cobrar tras perderla: +$2.',
    onMatchEnd(Ser, J, won) { return won ? 0 : 700; },
    onPayday(Ser, J, P) { return Ser.M && Ser.M.winner != null && Ser.players[Ser.M.winner] !== P ? 2 : 0; } },
  { id: 'virtuoso', name: 'El Virtuoso', rarity: 'epico', desc: 'x1.5 Combo por cada truco distinto del tiro: BANDA, COMBINACIÓN, de rebote, de lejos, SALTO, MASSÉ.',
    onShot(S) { const n = S.tricks(); if (n) S.add({ xmult: Math.pow(1.5, n) }, this); } },

  // ---------------- legendarios ----------------
  { id: 'diablo', name: 'El Diablo', rarity: 'legendario', desc: 'Cada bola tuya embocada: +1 Combo y roba 50 Puntos al rival.',
    onBall(S) { S.add({ mult: 1, steal: 50 }, this); } },
  { id: 'corona', name: 'La Corona Hueca', rarity: 'legendario', desc: 'x2 Combo, +x0.5 por cada partida que hayas ganado.',
    onShot(S) { S.add({ xmult: 2 + 0.5 * S.P.wins }, this); } },
  { id: 'ojo_abismo', name: 'Ojo del Abismo', rarity: 'legendario', desc: 'Todas tus bolas cuentan como BANDA y COMBINACIÓN.', mods: { allTrick: true } },
  { id: 'rey_midas', name: 'Rey Midas', rarity: 'legendario', desc: 'Cada bola tuya embocada: +100 Puntos y +$1 (máx. $5 por partida). (Llevas ${v})',
    state: () => ({ v: 0 }),
    onMatchStart(Ser, J) { J.st.v = 0; },
    onBall(S) { const c = this.st.v < 5 ? 1 : 0; this.st.v += c; S.add({ pts: 100, cash: c }, this); } },

  // ======================= HECHIZOS: cambian la partida (1 a la vez, dura una partida) =======================
  { id: 'iman', type: H, name: 'Imán Oxidado', rarity: 'comun', desc: 'En tu turno las troneras son un 15% más grandes.', mods: { pocketMul: 1.15 } },
  { id: 'boca_chica', type: H, art: 'codicia', name: 'Boca Chica', rarity: 'comun', desc: 'En el turno del RIVAL las troneras son un 12% más chicas.', rival: { pocketMul: 0.88 } },
  { id: 'brazo_ogro', type: H, name: 'Brazo de Ogro', rarity: 'comun', desc: '+30% de potencia. Tus SALTOS y MASSÉS son un 40% más fuertes.', mods: { powerMul: 1.3, trickMul: 1.4 } },
  { id: 'prisa', type: H, name: 'Prisa', rarity: 'comun', desc: 'El RIVAL solo tiene 15 segundos por tiro.', rival: { clock: 15 } },
  { id: 'ojo_cuervo', type: H, name: 'Ojo de Cuervo', rarity: 'raro', desc: 'Tu guía es larga y muestra los rebotes.', mods: { guide: 2 } },
  { id: 'fantasma', type: H, name: 'Blanca Fantasma', rarity: 'raro', desc: 'En tu turno la blanca no puede caer en las troneras.', mods: { noScratch: true } },
  { id: 'segunda', type: H, name: 'Segunda Oportunidad', rarity: 'raro', desc: 'Una vez en la partida, si fallas (sin falta) sigues tirando.', once: true },
  { id: 'mano_negra', type: H, name: 'Mano Negra', rarity: 'raro', desc: 'Una vez en la partida, se te perdona una falta.', once: true },
  { id: 'seguro', type: H, art: 'vela_negra', name: 'Seguro de Vida', rarity: 'raro', only8: true, desc: 'Una vez en la partida: si metes la 8 antes de tiempo, vuelve a la mesa y no pierdes.', once: true },
  { id: 'arbitro', type: H, art: 'curandero', name: 'Árbitro Comprado', rarity: 'raro', desc: 'Tus faltas no restan puntos ni dan bola en mano al rival.', mods: { bribed: true } },
  { id: 'mal_de_ojo', type: H, art: 'cuenta_atras', name: 'Mal de Ojo', rarity: 'raro', desc: 'La guía del RIVAL es mucho más corta.', rival: { guide: -1 } },
  { id: 'amuleto', type: H, name: 'Amuleto', rarity: 'raro', desc: 'Eres inmune a los hechizos y activos del RIVAL (temblores, guía corta, troneras chicas...).', mods: { immune: true } },
  { id: 'escarcha_negra', type: H, name: 'Escarcha Negra', rarity: 'raro', desc: 'En el turno del RIVAL el paño apenas frena: todo se le pasa de largo.', rival: { frictionMul: 0.5 } },
  { id: 'grilletes', type: H, name: 'Grilletes', rarity: 'raro', desc: 'El RIVAL no puede usar EFECTO ni levantar el taco (sin SALTOS ni MASSÉS).', rival: { noSpin: true } },
  { id: 'kamikaze', type: H, name: 'Kamikaze', rarity: 'raro', desc: 'Meter la blanca NO es falta si en el mismo tiro embocas una bola tuya.', mods: { kamikaze: true } },
  { id: 'venda', type: H, name: 'La Venda', rarity: 'epico', desc: 'El RIVAL juega sin guía: solo ve su taco.', rival: { guide: -2 } },
  { id: 'mesa_torcida', type: H, name: 'Mesa Torcida', rarity: 'epico', desc: 'En el turno del RIVAL la mesa se inclina y las bolas derivan.', rival: { tilt: 60 } },
  { id: 'tembleque', type: H, art: 'vampiro', name: 'Tembleque', rarity: 'legendario', desc: 'El taco del RIVAL tiembla al apuntar.', rival: { shake: 1 } },
  { id: 'barquero', type: H, name: 'El Barquero', rarity: 'legendario', desc: 'En tu turno las troneras atraen las bolas con fuerza y son un 10% más grandes.',
    mods: { pocketMul: 1.1, pocketPull: 3 } },

  // ======================= ACTIVOS: un uso (1 a la vez) =======================
  { id: 'la_mano', type: A, art: 'carronero', name: 'La Mano', rarity: 'comun', desc: 'ACTIVO: coloca la blanca donde quieras.', active: 'hand' },
  { id: 'tiro_gratis', type: A, name: 'Tiro Gratis', rarity: 'comun', desc: 'ACTIVO: si tu próximo tiro no emboca (y no es falta), sigues tirando.', active: 'free' },
  { id: 'boca_infierno', type: A, name: 'Boca del Infierno', rarity: 'comun', desc: 'ACTIVO: en tu próximo tiro las troneras son un 60% más grandes.', active: 'boost' },
  { id: 'terremoto', type: A, art: 'eclipse', name: 'Terremoto', rarity: 'raro', desc: 'ACTIVO: sacude la mesa. Tus bolas que caigan valen +150 Puntos; las del RIVAL vuelven a la mesa. No gasta tu turno.', active: 'quake' },
  { id: 'dinamita', type: A, art: 'parca', name: 'Dinamita', rarity: 'raro', desc: 'ACTIVO: tu próximo tiro EXPLOTA al primer contacto.', active: 'bomb' },
  { id: 'vudu', type: A, name: 'Muñeco Vudú', rarity: 'raro', desc: 'ACTIVO: en el próximo tiro del RIVAL su taco tiembla mucho y no tiene guía.', active: 'hex' },
  { id: 'atraco', type: A, name: 'Atraco', rarity: 'raro', desc: 'ACTIVO: ROBA al rival el 10% de sus puntos (entre 150 y 800).', active: 'heist' },
  { id: 'gran_golpe', type: A, name: 'Gran Golpe', rarity: 'epico', desc: 'ACTIVO: tu próximo tiro que emboque en esta partida: x3 Combo.', active: 'xshot' },
  { id: 'marcha_atras', type: A, name: 'Marcha Atrás', rarity: 'epico', desc: 'ACTIVO: si tu próximo tiro no emboca una bola tuya (fallo, falta o la 8 antes de tiempo), se deshace y repites.', active: 'rewind' },
];

// Tacos: el estilo de cada jugador durante toda la serie.
OM.CUES = [
  { id: 'peregrino', name: 'Taco del Peregrino', desc: 'Equilibrado. Tu guía es un 30% más larga.', mods: { guideLen: 1.3 } },
  { id: 'sangriento', name: 'Taco Sangriento', desc: '+20% de potencia. Empieza con Tiza Azul. Tu guía es un 35% más corta.', mods: { powerMul: 1.2, guideLen: 0.65 }, joker: 'tiza_azul' },
  { id: 'usura', name: 'Taco de la Usura', desc: 'Al cobrar tras cada partida: +$2 extra. Ganar una partida: +200 Puntos.', winBonus: 200, wage: 2 },
  { id: 'hueso', name: 'Taco de Hueso', desc: 'Tus SALTOS y MASSÉS son un 50% más fuertes. Empieza con Trucos de Feria.', mods: { trickMul: 1.5 }, joker: 'trucos' },
  { id: 'espectral', name: 'Taco Espectral', desc: 'Tu blanca no puede caer en las troneras. -15% de potencia.', mods: { powerMul: 0.85, noScratch: true } },
  { id: 'ebano', name: 'Taco de Ébano', desc: 'Guía larga con rebotes. -15% de potencia.', mods: { guide: 2, powerMul: 0.85 } },
  { id: 'vidrio', name: 'Taco de Vidrio', desc: 'Todos tus puntos x1.3. Cada falta te quita el 12% de tus puntos (mínimo 300).', mods: { pointsMul: 1.3, foulCost: 300, foulPct: 0.12 } },
  { id: 'pacto', name: 'Taco del Pacto', desc: 'Empieza con un comodín ÉPICO al azar (de puntos). Cada falta tuya le pasa al rival el 10% de tus puntos (mínimo 150).', randomJoker: 'epico', mods: { foulGift: 150, foulGiftPct: 0.1 } },
];

// Obstáculos (los antiguos jefes): aparecen en las partidas 3, 4 y 5 y afectan a los dos jugadores.
// grp: no salen juntos dos del mismo grupo.
OM.OBSTACLES = [
  { id: 'sepulturero', name: 'El Sepulturero', desc: 'Las troneras laterales están selladas.' },
  { id: 'pendulo', name: 'El Péndulo', desc: 'La mesa se inclina: las bolas derivan.' },
  { id: 'cienaga', name: 'La Ciénaga', desc: 'El paño frena el doble.', grp: 'fr' },
  { id: 'escarcha', name: 'La Escarcha', desc: 'El paño apenas frena. Todo resbala.', grp: 'fr' },
  { id: 'niebla', name: 'La Niebla', desc: 'Solo se ve cerca de la bola blanca.', grp: 'vis' },
  { id: 'ciego', name: 'El Ciego', desc: 'Sin guía de tiro: solo el taco.', grp: 'vis' },
  { id: 'boca', name: 'La Boca', desc: 'Las troneras se encogen un 22%.' },
  { id: 'pilares', art: 'espina', name: 'Los Pilares', desc: 'Tres pilares de hueso rebotan las bolas como un pinball.', grp: 'obj' },
  { id: 'vortice', art: 'gloton', name: 'El Vórtice', desc: 'Un remolino en el centro tuerce las trayectorias.', grp: 'obj' },
  { id: 'portales', art: 'coleccionista', name: 'Los Portales', desc: 'Lo que entra por un portal sale por el otro.', grp: 'obj' },
  { id: 'reloj', name: 'El Reloj', desc: '15 segundos por tiro. Si se acaban, el taco dispara solo.' },
  { id: 'verdugo', name: 'El Verdugo', desc: 'Cada falta cuesta 300 Puntos.' },
];

// Temas de mesa por partida (reutiliza los círculos)
OM.MATCH_THEMES = ['limbo', 'lujuria', 'gula', 'ira', 'abismo'];
OM.MODES = {
  '8': { name: 'BOLA 8', desc: 'Lisas contra rayadas. Mete tu grupo y luego la 8.' },
  '9': { name: 'BOLA 9', desc: 'Toca siempre la bola más baja. Quien mete la 9 gana.' },
  mix: { name: 'MIXTA', desc: 'Partidas 1, 3 y 5 a bola 8; la 2 y la 4 a bola 9.' },
};
OM.BOT_LEVELS = [
  { id: 'facil', name: 'FÁCIL', botName: 'Bot Novato' },
  { id: 'medio', name: 'MEDIO', botName: 'Bot Tahúr' },
  { id: 'dificil', name: 'DIFÍCIL', botName: 'Bot Diablo' },
];
