# 8 — Documento de Diseño (GDD)

> **v3.0: el juego es un pool arcade 1 contra 1.** El roguelite (v1.x) y la bola 9 con vida (v2.0) quedan en el historial de git (rama `backup/v2.0-bola9`).

> *Pool arcade 1v1 en un bar del infierno. Cinco partidas, comodines tramposos y trucos de taco: gana quien sume más puntos.*

## 1. Pilares
1. **1 contra 1 de verdad.** Contra un bot (fácil, medio, difícil), dos jugadores en el mismo dispositivo u online por sala.
2. **Los tiros vistosos pagan.** Dobles, triples, bandas, combinaciones, tacadas, saltos y massés multiplican los puntos. Meter una bola sin más vale poco.
3. **Trastadas.** Los comodines no solo suman: roban puntos, encogen las troneras del rival, le hacen temblar el taco o sacuden la mesa.
4. **Siempre hay partido.** El que va por detrás elige entre más comodines, saca la siguiente partida y las últimas partidas valen más.

## 2. Estructura
```
Preparación (modo, tacos) -> [ Draft de comodín -> Partida ] x5 -> Resultado de la serie
```
- **Serie de 5 partidas.** Gana quien tenga **más puntos** al final (desempate: partidas ganadas).
- Ganar una partida da 1.000 / 1.250 / 1.500 / 2.000 / 3.000 puntos. Además, 100 por cada bola que le quede al rival.
- **Draft**: antes de cada partida cada jugador elige 1 comodín de 3 (4 si va por detrás). Se queda toda la serie.
- **Obstáculos** (los antiguos jefes): la partida 3 y la 4 traen uno, la final trae dos.
- **Modos**: Bola 8 (principal), Bola 9, o Mixta (1, 3 y 5 a bola 8; 2 y 4 a bola 9).

## 3. Reglas
**Bola 8.** Mesa abierta hasta que alguien emboca después del saque: ese jugador se queda el grupo de esa bola. Hay que tocar primero una bola propia. Si embocas una tuya, sigues. Con el grupo limpio, la 8 gana. Meter la 8 antes de tiempo (o con falta) pierde la partida. La 8 en el saque vuelve a la mesa.

**Bola 9.** Hay que tocar primero la bola más baja. Todo lo que entre en un tiro legal cuenta. La 9 legal gana; en el saque o con falta, vuelve.

**Falta** (blanca dentro, no tocar nada, tocar primero una bola que no toca, que tras el contacto ninguna bola toque banda sin embocar nada, o agotar los 30 s del tiro): -50 puntos y bola en mano para el rival.

**Saque nerfeado.** El triángulo se coloca con una pequeña variación por semilla y el impulso de saque es mucho menor que en v1/v2. Las bolas del saque valen 25 puntos fijos, sin combo ni comodines, y no asignan grupo. Saca el que perdió la partida anterior.

## 4. Puntuación: Puntos x Combo
| Cosa | Valor |
|---|---|
| Bola propia | +100 |
| 2 / 3 / 4+ bolas en un tiro | Combo x2 / x3 / x5 |
| Tacada (tiros seguidos embocando) | +1 Combo por nivel (máx. +5) |
| Banda (la bola tocó banda antes de entrar) | +50 |
| Combinación (entra una bola que no tocó la blanca) | +100 |
| De rebote (la blanca tocó banda antes) | +100 |
| De lejos | +50 |
| Embocar saltando por encima de una bola (por bola saltada) o con massé | +150 |
| La 8 / la 9 ganadora | +500 |

Los valores viven en `OM.POINTS` (`src/game/data.js`).

## 5. Ángulo de golpe (mecánica nueva)
Además del efecto (punto de impacto en la blanca) se puede **elevar el taco** (0 a 80 grados):
- **Massé**: elevación + efecto lateral. La blanca hace una curva, más cerrada cuanta más elevación.
- **Salto**: elevación de 32 grados o más golpeando al centro. La blanca vuela por encima de las bolas.
- **Piqué**: elevación + efecto abajo. Retrocede más.

La guía simula la blanca con los mandos actuales, así que la curva y el arco del salto se ven antes de tirar. **El efecto y la elevación se reinician después de cada tiro.**

## 6. Contenido
- **52 comodines**: de puntos (Bandolero, Doble o Nada, Trucos de Feria...), de mesa (Imán, Blanca Fantasma, El Barquero...), trastadas contra el rival (Tembleque, Mal de Ojo, Boca Chica, Ladrón, Peaje...) y activos de un uso por partida (La Mano, Terremoto, Dinamita).
- **8 tacos** con estilo propio (potencia, guía, trucos, puntos de victoria...).
- **12 obstáculos**: troneras selladas, péndulo, ciénaga, escarcha, niebla, sin guía, troneras pequeñas, pilares tipo pinball, vórtice, portales, reloj de 15 s y verdugo.

## 7. Controles
- Ratón/táctil: apunta, arrastra hacia atrás para cargar, suelta para tirar.
- `WASD` efecto, `Q/E` (o flechas arriba/abajo) ángulo de golpe, `R` centrar, flechas izquierda/derecha y rueda: ajuste fino, `Espacio`: potencia, `M`: música.

## 8. Online
Sala con código de 4 letras, de navegador a navegador (WebRTC con PeerJS). No hace falta servidor propio: el servidor público de PeerJS solo presenta a los jugadores, y su TURN hace de puente si la conexión directa falla. El juego se publica como sitio estático en Vercel. Ver `src/game/net.js`.

## 9. Pendiente / ideas
- Balance fino de comodines con partidas humanas (el bot no usa efecto ni elevación).
- Reconexión online y revancha en la misma sala.
- Buscar rival al azar o ranking: necesitaría un servicio aparte (por ejemplo Supabase); solo cambiaría `net.js`.
- Bots que usen massé y salto.
