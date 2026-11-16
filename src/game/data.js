// 8 — datos de diseño del pool arcade 1v1: comodines, tacos, obstáculos y puntos.
// El arte se reutiliza: cada comodín usa el sprite `joker_<art || id>` (32x32), cada taco `cue_<art || id>`
// y cada obstáculo la medalla `boss_<art || id>`.
//
// Hooks de comodín (todos opcionales). S = marcador del tiro (ver OM.Match.resolve):
//   mods:  {pocketMul, pocketPull, powerMul, guide, guideLen, noScratch, trickMul, pointsMul, ...} en TU turno
//   rival: {pocketMul, guide, shake} en el turno del RIVAL (trastadas)
//   onBall(S, b)      — por cada bola TUYA embocada en un tiro legal. b = {num, pocket, banked, combo}
//   onPot(S, b)       — por cada bola embocada en un tiro legal (también las del rival)
//   onShot(S)         — tiro legal que emboca al menos una bola tuya
//   onMiss(S)         — tiro legal que no emboca nada tuyo
//   onFoul(S)         — tu falta
//   onWinBall(S)      — metes la bola que gana la partida
//   onRivalFoul(S) / onRivalBall(S, b) / onRivalGift(S, b)  — cuando tira el rival (S.addRival te da puntos a ti)
//   onMatchStart(Ser, J)
// S.add({pts, mult, xmult, steal}, this) emite eventos animados. `this` = la carta que se ilumina
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

const isSolid = (n) => n >= 1 && n <= 7;
const isStripe = (n) => n >= 9;

OM.JOKERS = [
  // ---------------- COMUNES: puntos ----------------
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
  { id: 'rayadas', name: 'Devoto de las Rayadas', rarity: 'comun', desc: 'Cada bola RAYADA (9-15) que emboques: +80 Puntos.',
    onBall(S, b) { if (isStripe(b.num)) S.add({ pts: 80 }, this); } },
  { id: 'tercera', name: 'A la Tercera', rarity: 'comun', desc: 'Cada TERCERA bola que emboques en la partida: +300 Puntos. (Llevas {v})',
    state: () => ({ v: 0 }),
    onMatchStart(Ser, J) { J.st.v = 0; },
    onBall(S) { this.st.v++; if (this.st.v % 3 === 0) S.add({ pts: 300 }, this); } },
  { id: 'iman', name: 'Imán Oxidado', rarity: 'comun', desc: 'En tu turno las troneras son un 15% más grandes.', mods: { pocketMul: 1.15 } },
  // ---------------- COMUNES: trastadas ----------------
  { id: 'peaje', art: 'diezmo', name: 'Peaje', rarity: 'comun', desc: 'Cada FALTA del rival te da +200 Puntos.',
    onRivalFoul(S) { S.addRival({ pts: 200 }, this); } },
  { id: 'maldicion', art: 'pares', name: 'Maldición', rarity: 'comun', desc: 'Si el rival mete una bola TUYA: +250 Puntos para ti.',
    onRivalGift(S) { S.addRival({ pts: 250 }, this); } },
  { id: 'boca_chica', art: 'codicia', name: 'Boca Chica', rarity: 'comun', desc: 'En el turno del RIVAL las troneras son un 12% más chicas.', rival: { pocketMul: 0.88 } },

  // ---------------- RAROS ----------------
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
  { id: 'ojo_cuervo', name: 'Ojo de Cuervo', rarity: 'raro', desc: 'Tu guía es larga y muestra los rebotes.', mods: { guide: 2 } },
  { id: 'fantasma', name: 'Blanca Fantasma', rarity: 'raro', desc: 'En tu turno la blanca no puede caer en las troneras.', mods: { noScratch: true } },
  { id: 'segunda', name: 'Segunda Oportunidad', rarity: 'raro', desc: 'Una vez por partida, si fallas (sin falta) sigues tirando.', once: true },
  { id: 'mano_negra', name: 'Mano Negra', rarity: 'raro', desc: 'Una vez por partida, se te perdona una falta.', once: true },
  { id: 'seguro', art: 'vela_negra', name: 'Seguro de Vida', rarity: 'raro', desc: 'Una vez por partida: si metes la 8 antes de tiempo, vuelve a la mesa y no pierdes.', once: true },
  { id: 'arbitro', art: 'curandero', name: 'Árbitro Comprado', rarity: 'raro', desc: 'Tus faltas no restan puntos ni dan bola en mano al rival.', mods: { bribed: true } },
  { id: 'matrimonio', name: 'Matrimonio Maldito', rarity: 'raro', desc: 'Meter una bola TUYA y una del RIVAL en el mismo tiro: +400 Puntos.',
    onShot(S) { if (S.gifts.length) S.add({ pts: 400 }, this); } },
  { id: 'rencor', art: 'sangria', name: 'Rencor', rarity: 'raro', desc: 'Cada bola que emboca el rival te carga +0.5 Combo para tu próximo tiro que emboque. (Cargado: +{v})',
    state: () => ({ v: 0 }),
    onRivalBall() { this.st.v = Math.min(6, this.st.v + 0.5); },
    onShot(S) { if (this.st.v) { S.add({ mult: this.st.v }, this); this.st.v = 0; } } },
  { id: 'trucos', art: 'astrologo', name: 'Trucos de Feria', rarity: 'raro', desc: 'Embocar SALTANDO por encima de una bola, o con MASSÉ: x3 Combo.',
    onShot(S) { if (S.cur.hopped || S.cur.curved) S.add({ xmult: 3 }, this); } },
  { id: 'bola_oro', art: 'calavera_dorada', name: 'Bola de Oro', rarity: 'raro', desc: 'En cada partida una bola al azar es de ORO. Si la embocas tú: +500 Puntos.', gold: true,
    onPot(S, b) { if (S.M.gold && S.M.gold[b.num] === S.me) S.add({ pts: 500 }, this); } },
  { id: 'la_mano', art: 'carronero', name: 'La Mano', rarity: 'raro', desc: 'ACTIVO, 1 por partida: coloca la blanca donde quieras.', active: 'hand' },
  // trastadas
  { id: 'mal_de_ojo', art: 'cuenta_atras', name: 'Mal de Ojo', rarity: 'raro', desc: 'La guía del RIVAL es mucho más corta.', rival: { guide: -1 } },
  { id: 'tembleque', art: 'vampiro', name: 'Tembleque', rarity: 'legendario', desc: 'El taco del RIVAL tiembla al apuntar.', rival: { shake: 1 } },

  // ---------------- ÉPICOS ----------------
  { id: 'avalancha', name: 'Avalancha', rarity: 'epico', desc: 'Cada bola tuya embocada: x1.5 Combo.',
    onBall(S) { S.add({ xmult: 1.5 }, this); } },
  { id: 'eco', name: 'Eco del Abismo', rarity: 'epico', desc: 'La primera bola de cada tiro puntúa DOS veces.', mods: { retriggerFirst: true } },
  { id: 'cadena', name: 'Cadena Infernal', rarity: 'epico', desc: 'Tu TACADA no se pierde al fallar: solo se reinicia con una falta.', mods: { keepStreak: true } },
  { id: 'espejo_roto', name: 'Espejo Roto', rarity: 'epico', desc: 'Copia el comodín de su IZQUIERDA.', copy: true },
  { id: 'terremoto', art: 'eclipse', name: 'Terremoto', rarity: 'epico', desc: 'ACTIVO, 1 por partida: sacude la mesa y mueve todas las bolas. No gasta tu turno.', active: 'quake' },
  { id: 'dinamita', art: 'parca', name: 'Dinamita', rarity: 'epico', desc: 'ACTIVO, 1 por partida: tu próximo tiro EXPLOTA al primer contacto.', active: 'bomb' },

  // ---------------- LEGENDARIOS ----------------
  { id: 'diablo', name: 'El Diablo', rarity: 'legendario', desc: 'Cada bola tuya embocada: +1 Combo y roba 50 Puntos al rival.',
    onBall(S) { S.add({ mult: 1, steal: 50 }, this); } },
  { id: 'corona', name: 'La Corona Hueca', rarity: 'legendario', desc: 'x2 Combo, +x0.5 por cada partida que hayas ganado.',
    onShot(S) { S.add({ xmult: 2 + 0.5 * S.P.wins }, this); } },
  { id: 'barquero', name: 'El Barquero', rarity: 'legendario', desc: 'En tu turno las troneras atraen las bolas con fuerza y son un 10% más grandes.',
    mods: { pocketMul: 1.1, pocketPull: 3 } },
  { id: 'ojo_abismo', name: 'Ojo del Abismo', rarity: 'legendario', desc: 'Todas tus bolas cuentan como BANDA y COMBINACIÓN.', mods: { allTrick: true } },
];

// Tacos: el estilo de cada jugador durante toda la serie.
OM.CUES = [
  { id: 'peregrino', name: 'Taco del Peregrino', desc: 'Equilibrado. Tu guía es un 30% más larga.', mods: { guideLen: 1.3 } },
  { id: 'sangriento', name: 'Taco Sangriento', desc: '+20% de potencia. Empieza con Tiza Azul. Tu guía es un 35% más corta.', mods: { powerMul: 1.2, guideLen: 0.65 }, joker: 'tiza_azul' },
  { id: 'usura', name: 'Taco de la Usura', desc: 'Ganar una partida: +300 Puntos extra. Perderla: +100.', winBonus: 300, loseBonus: 100 },
  { id: 'hueso', name: 'Taco de Hueso', desc: 'Tus SALTOS y MASSÉS son un 50% más fuertes. Empieza con Trucos de Feria.', mods: { trickMul: 1.5 }, joker: 'trucos' },
  { id: 'espectral', name: 'Taco Espectral', desc: 'Empieza con Blanca Fantasma. -10% de potencia.', mods: { powerMul: 0.9 }, joker: 'fantasma' },
  { id: 'ebano', name: 'Taco de Ébano', desc: 'Guía larga con rebotes. -15% de potencia.', mods: { guide: 2, powerMul: 0.85 } },
  { id: 'vidrio', name: 'Taco de Vidrio', desc: 'Todos tus puntos x1.3. Cada falta te quita el 12% de tus puntos (mínimo 300).', mods: { pointsMul: 1.3, foulCost: 300, foulPct: 0.12 } },
  { id: 'pacto', name: 'Taco del Pacto', desc: 'Empieza con un comodín ÉPICO al azar. Cada falta tuya le pasa al rival el 10% de tus puntos (mínimo 150).', randomJoker: 'epico', mods: { foulGift: 150, foulGiftPct: 0.1 } },
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
