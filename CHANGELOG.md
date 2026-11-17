# Changelog — 8

Cambios del juego pensados para jugadores. Los detalles técnicos y los números del bot de balance están en [docs/DEVLOG.md](docs/DEVLOG.md).

## 3.1 — Tienda y comodines nuevos · 2026-11-17 (sin publicar, en playtest)

**Adiós al draft de "1 comodín por partida". Ahora hay dinero y tienda.**

### Tres tipos de comodín
- **Comodín** (puntos o dinero): te lo quedas toda la serie. **Máximo 4.** Si no hay hueco, eliges cuál sale (te devuelven la mitad).
- **Hechizo**: cambia cómo se juega (guía, troneras, temblores, reloj, mesa...). **Solo uno a la vez y dura una partida.**
- **Activo**: se usa una vez en tu turno (clic en la carta + USAR) y desaparece. **Solo uno a la vez**; si no lo usas, se guarda para la siguiente partida.

### Tienda y dinero ($)
- Antes de cada partida cada jugador tiene su tienda: 3 comodines, 1 hechizo y 1 activo. Puedes **cambiar las cartas** ($1, luego $2, $3...) y **vender** lo tuyo por la mitad.
- Precios: comodín $4 / $6 / $8 / $11 según rareza; hechizo $3-$8; activo $2-$6.
- **Se cobra**: $10 al empezar y un sueldo de $4 tras cada partida.
- **Los trucos pagan**: doble +$1, triple +$2, masacre +$3, salto o massé +$1, de rebote +$1, tacada (3er tiro seguido embocando en adelante) +$1. **Tope: $6 por partida.**
- **Contra la bola de nieve**: quien pierde la partida cobra +$2, quien va por detrás en la serie cobra +$2, ve **una carta más** y su primer cambio de tienda es **gratis**. No hay intereses (salvo con comodines que ocupan hueco). Los hechizos caducan y los activos se gastan, así que el dinero no se acumula. En 40 series bot contra bot del mismo nivel, quien iba por detrás tras la partida 3 ganó la serie el 42% de las veces (antes 22%); el bot difícil sigue ganando siempre al medio.

### 29 cartas nuevas
- **Comodines**: La Hucha (+$3 al cobrar), El Tahúr ($1 por doble), Saltimbanqui (salto o massé: +200 y +$1), El Cobrador (faltas del rival: +100 y +$1), Pobre Diablo (+$4 si vas perdiendo), Rompedor (bolas del saque a 150 y +$1), Equilibrista (embocar sin que la blanca toque banda), Prestamista (interés con tope), El Avaro (+Combo por el dinero guardado), El Vengador (x2 tras una falta del rival), Último Suspiro (tu última bola antes de la final), La Banda (+1 Combo por cada carta tuya), El Fénix (perder una partida da +700 y +$2), El Virtuoso (x1.5 por cada truco distinto del tiro), Rey Midas (+100 y +$1 por bola, máx. $5 por partida).
- **Hechizos**: Brazo de Ogro, Prisa (el rival tiene 15 s), Amuleto (inmune a las trastadas del rival), Escarcha Negra (en el turno del rival el paño no frena), Grilletes (el rival sin efecto ni elevación), Kamikaze (la blanca dentro no es falta si embocas una tuya), La Venda (el rival sin guía), Mesa Torcida (la mesa se inclina en el turno del rival).
- **Activos**: Tiro Gratis, Boca del Infierno (troneras +60% un tiro), Muñeco Vudú (el próximo tiro del rival tiembla y sin guía), Atraco (roba el 10% de sus puntos), Gran Golpe (x3 Combo), Marcha Atrás (si el tiro sale mal, se deshace y repites).

### Cambios
- Pasan a **hechizo**: Imán Oxidado, Boca Chica, Ojo de Cuervo, Blanca Fantasma, Segunda Oportunidad, Mano Negra, Seguro de Vida, Árbitro Comprado, Mal de Ojo, Tembleque y El Barquero.
- Pasan a **activo** (un solo uso): La Mano, Dinamita y Terremoto.
- **Terremoto** rehecho y bajado a raro: tus bolas que caen con el temblor valen +150 cada una y las del rival vuelven a la mesa (antes no puntuaba nada y era épico).
- **Bola de Oro** da además +$2. **Espejo Roto** solo copia comodines.
- **Taco Espectral**: la blanca no puede caer (antes daba la Blanca Fantasma como comodín), -15% de potencia.
- **Taco de la Usura**: +$2 al cobrar y +200 por ganar una partida.
- La colección se divide en pestañas: comodines, hechizos y activos.
- **Volumen de música de 0 a 100** (título y pausa) en vez de sí/no. M silencia y recupera el volumen.
- **Tienda con reloj de 20 s** (`OM.SHOP.time`). Al acabarse se cierra sola con lo que hayas comprado; los últimos 5 s parpadea y suena.
- Online: el código de sala cambia de prefijo (las salas de 3.0 y 3.1 no se ven entre sí).

### Chat en la mesa
- **Chat a la derecha de la mesa**: tecla **T** o la pestaña del borde. Con el panel cerrado, los mensajes nuevos aparecen un momento arriba a la derecha y la pestaña cuenta los que no has leído. Enter envía, Esc deja de escribir.
- **10 emojis propios** en pixel art: la 8, ¡dentro!, taco, tiza, en racha, calavera, jaja, lloro, plata y GG. Se escriben como `:fuego:` o desde la barra; un mensaje solo de emojis se ve en grande. Los emojis normales (😂 💀 🔥 💰 🎱) y `xD` se convierten solos.
- **Frases rápidas**: ¡Buena!, Ups, Suerte, gg.
- **Antispam**: como mucho 5 mensajes cada 10 s; si te pasas, silencio de 5 s que crece (10, 20, 30) si insistes. No se puede repetir el mismo mensaje en 20 s, las letras estiradas se recortan y los mensajes en mayúsculas pasan a minúsculas. Lo que llega del rival se limpia otra vez y, si inunda, queda silenciado 30 s. Botón para silenciarlo del todo.
- Se ve cuándo el rival está escribiendo.
- **Contra el bot**: el Tahúr saluda, se burla de tus faltas, presume de sus tiros y te contesta.
- Online: nuevo prefijo de sala (`v31c`) para que una versión sin chat no se cruce con una con chat.

## 3.0 — Pool arcade 1v1 · 2026-11-16 (sin publicar, en playtest)

### Online sin servidor (3.0c)
- **Entrar por link**: el anfitrión toca COPIAR LINK y el rival abre `(sitio)/CÓDIGO` para entrar directo a la sala.
- Pantalla de inicio sin textos de relleno. Favicon de bola 8.
- El online pasa a ser de navegador a navegador (PeerJS): ya no hace falta correr `node tools/serve.js` para jugar con alguien; basta con abrir el juego publicado y compartir el código de sala.
- Si el rival se cae, se avisa a los pocos segundos.

### Ajustes tras el primer playtest (3.0b)
- **Nueva falta**: si tras el contacto ninguna bola toca banda y no entra nada, es falta.
- **Reloj de tiro**: 30 segundos por tiro (colocar + apuntar). Se ve la cuenta atrás en los últimos 10. Si se acaba es falta; si estabas cargando, el taco dispara. El Reloj sigue en 15 s y dispara solo.
- **Salto**: el bono (+150) y el x3 de Trucos de Feria solo cuentan si la blanca pasa **por encima de una bola**. Antes cualquier tiro elevado los daba.
- **Tembleque** pasa a legendario.
- **Taco del Pacto**: cada falta le pasa al rival el 10% de tus puntos (mínimo 150), antes 150 fijos.
- **Taco de Vidrio**: cada falta quita el 12% de tus puntos (mínimo 300), antes 300 fijos.
- **Taco Sangriento**: ahora tiene contra: guía un 35% más corta.

Cambio de dirección: de roguelite en solitario a **1 contra 1**.
- **Serie de 5 partidas** por puntos. Bola 8 como juego principal; bola 9 y modo mixto disponibles.
- **Rivales**: bot fácil / medio / difícil, 2 jugadores en el mismo dispositivo, y online por sala (`node tools/serve.js`).
- **Puntos x Combo**: dobles x2, triples x3, 4+ x5; banda, combinación, rebote, tacada, salto y massé suman. Ganar partida: 1.000 a 3.000.
- **Ángulo de golpe**: elevar el taco permite massé (curva) y salto. La guía muestra la trayectoria real. Efecto y ángulo se reinician en cada tiro.
- **Saque nerfeado**: impulso mucho menor, triángulo con variación, bolas del saque a 25 puntos sin combo.
- **Draft**: 1 comodín de 3 antes de cada partida (4 si vas por detrás). 52 comodines rehechos para el 1v1, con trastadas y activos.
- **8 tacos** rediseñados y **12 obstáculos** (antiguos jefes + pilares, vórtice y portales) en las partidas 3, 4 y 5.
- Física de paso fijo (determinista) para el online.
- Eliminado: tienda, dinero, consumibles, grabados, vida, círculos, REGISTRO/telemetría y el bot de balance antiguo. El estado anterior está en la rama `backup/v2.0-bola9`.

## [2.0] — Bola 9 · 2026-11-16 (sin publicar, en playtest)

### Ajustes tras el primer playtest (2.0b)
- **Cantidad de bolas gradual**: Círculo I 5 bolas, II 6, III 7, IV 8, V y VI 9 (siempre las más bajas de tu set + la 9). La primera mesa pasa de unos 10 tiros a 6-7.
- **Faltas con bolas metidas**: las bolas que metes en una falta **vuelven a la mesa** (antes solo volvía la 9), y la falta quita **1 vida por bola metida** (mínimo 1).
- Un clic sin arrastrar (menos de 8% de potencia) ya no tira: en el playtest un toque accidental al 5% contó como falta.
- Con el juego servido en localhost, las partidas se copian a `registros/` para poder analizarlas.

**El juego pasa de "meter bolas para sumar puntos" a jugar bola 9 de verdad.** En v1.x se ganaba sacando siempre igual y metiendo la bola más fácil; no hacía falta jugar posición.

### Reglas nuevas
- **De 5 a 9 bolas** según el círculo, repartidas **al azar** por la mesa. **No hay saque**: se empieza con bola en mano en cualquier parte.
- Hay que **tocar primero la bola más baja**. Cualquier bola que entre en un tiro legal cuenta, incluidas las **combinaciones** (tocas la 2 y entra la 6), que dan +3 Mult.
- **Meter la 9 en un tiro legal gana la mesa**, aunque queden bolas.
- **Vida** (7 con el taco base, se reinicia en cada mesa):
  - Fallo (tiro legal sin meter nada): **-1 vida**.
  - **Falta** (blanca dentro, no tocar nada o tocar primero otra bola): **-1 vida por bola metida (mín. 1)**, una marca de falta y bola en mano. Las bolas metidas en falta vuelven a la mesa.
  - **3 faltas en la mesa = derrota.** 0 vidas = derrota.
  - Se cura: meter **2 o más bolas** en un tiro (+1), un **tiro brillante** (+1) y cada **3 tiros seguidos embocando** (tacada, +1).
- **Los puntos (Fichas × Mult) ya no ganan la mesa: dan dinero.** Cada mesa tiene una **cuota**: un tiro que la supera es *brillante* y cura 1 vida, y cada cuota de puntos acumulada en la mesa da $1 de **botín** (máx. $5).
- La dificultad sube por círculo: **troneras más chicas** (100% → 90%), bolas **agrupadas** en las mesas Mayor y Jefe, y jefes que cambian las reglas.
- La guía avisa con **¡FALTA!** cuando la blanca va a tocar primero una bola equivocada.
- Las partidas guardadas de v1.x no se cargan (son otro juego).

### Jefes (todos rehechos para que afecten al pool, no al puntaje)
| Jefe | Antes | Ahora |
|---|---|---|
| El Glotón | La primera bola de cada tiro no da Fichas | No puedes recuperar vida en esta mesa |
| La Sanguijuela | -$2 por tiro | Cada tiro cuesta $1; si no puedes pagar, -1 vida |
| El Verdugo | Fallar cuesta 1 tiro extra | Cada fallo quita 2 vidas |
| El Coleccionista | Solo puntúan las rayadas | Orden estricto: meter una bola que no sea la más baja es falta |
| La Purista | Solo puntúan las lisas | Si la blanca no toca ninguna banda, -1 vida |
| El Reloj | 1 tiro menos | -1 vida cada 4 tiros |
| El Tasador | Fichas a la mitad | Pierdes con 2 faltas en vez de 3 |
| La Inquisidora | Sin grabados ni ediciones | Cada falta quita 2 vidas |
| La Espina | Sin racha ni carga | Las bolas aparecen en racimos apretados |
| La Boca (final) | Troneras a la mitad | Troneras un 25% más chicas |
| Sepulturero, Niebla, Péndulo, Ciénaga, Escarcha, Ciego, Durmiente | — | Sin cambios |

### Comodines
- **Nuevos**: **Combinador** (común: bolas por combinación +40 Fichas y +4 Mult), **Mano Negra** (raro: una vez por mesa, tocar primero la bola equivocada no es falta), **El Curandero** (raro: los dobletes curan 2).
- **Cambiados porque ya no tenían sentido**:
  - Lisas Malditas → **Bajas Malditas** (bolas 1-4: +4 Mult). Rayadas Infames → **Altas Infames** (bolas 5-9: +30 Fichas).
  - Matrimonio Maldito: una baja y una alta en el mismo tiro (antes lisa y rayada).
  - Primera Sangre: primer tiro de la mesa x3 (antes: tras el saque, x2).
  - Último Aliento: x3 con 2 vidas o menos (antes: último tiro).
  - Vela Negra: +1 vida (antes +1 tiro).
  - Reloj de Arena: x0.2 Mult por cada vida que te quede (antes por cada tiro).
  - Carroñero: meter la blanca no quita vida y da $3 (antes: la falta puntuaba).
  - Martillo de Hueso: +35% de potencia y +12 Mult en tiros al 85% o más (antes: carga del saque x3).
  - El 8: meter la 8 da x3 Mult y cura 1 vida (antes: la 8 no maldecía).
  - Segunda Oportunidad: una vez por mesa, un fallo no quita vida.
  - Pares Malditos: ahora incluye la 8.
- **Rebalanceados**: Vampiro (x0.25 por bola grabada de tu set, ya no escala sin límite), Codicia (x0.03 por $, máx. x2), Racha Febril (+3 por tiro seguido).

### Tacos
Todos pasan de *tiros* a *vidas*: Peregrino, Sangriento, Usura, Hueso, Ébano y Pacto tienen 7 vidas; Espectral tiene 6 (la Blanca Fantasma evita las faltas por blanca dentro) y Vidrio 5 (+$10 y 1 hueco más).

### Consumibles
- **La Tiza**: recupera 2 vidas (antes +1 tiro).
- **La Rueda**: reparte al azar las bolas que quedan (antes rearmaba el triángulo).
- **Luna Vacía**: sube la **Bola 9** (el tiro que gana la mesa; antes Mesa Limpia).
- Los grabados no se pueden poner en la 9, y el cristal nunca rompe la 9.

### Pendiente (para ajustar jugando)
- **El balance es provisional.** El bot no simula física, así que mide la economía y los comodines, no lo difícil que es el pool. Bot "bueno": gana el 17% de las partidas; "medio": 0,2%.
- La regla de 3 faltas: en el bola 9 real son **3 faltas seguidas**. Con esa regla el bot medio llega casi un círculo más lejos. Se activa con `OM.Run.RULES.foulsSeguidas = true`.
- Sobra dinero en los círculos altos: hay que darle más usos a la tienda.
- El saque/rack se resolverá más adelante (hoy es reparto al azar sin saque).

## [1.3] — 2026-11-16
- 11 comodines nuevos, 4 jefes nuevos (Tasador, Inquisidora, Durmiente, Espina) y 3 tacos nuevos (Ébano, Vidrio, Pacto).
- Tacos balanceados (todos con 5 tiros salvo Vidrio). Selección de taco en carrusel.

## [1.2] — 2026-11-16
- Saque libre: el saque no gasta tiro ni puntúa y da *carga* de Mult para el siguiente tiro.

## [1.1] — 2026-11-16
- Fixes de derrota, efecto del taco, racha, guardado de partida, ediciones de comodín y contenido nuevo.
- Registro de partidas, pantalla REGISTRO y bot de balance. Curva de dificultad calibrada.

## [1.0] — 2026-11-16
- Primera versión jugable: bola 8 roguelite con Fichas × Mult, comodines, tienda, 6 círculos y jefes.
