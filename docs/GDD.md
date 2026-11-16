# 8 — Documento de Diseño (GDD)

> *Un roguelite de billar en un bar del infierno. Mete bolas, encadena comodines malditos y desciende los seis círculos.*

## 1. Pilares
1. **Un tiro, una decisión.** Cada golpe es un pequeño puzle físico con riesgo/recompensa (¿voy a por el doblete o aseguro la simple?).
2. **Números que explotan.** Puntuación `Fichas × Mult` que crece de forma absurda gracias a sinergias. El *juice* de cada cálculo es sagrado.
3. **Cada partida es distinta.** Comodines, grabados de bola, lunas y jefes generan builds diferentes.
4. **Oscuro, retro, legible.** Pixel art de 32 colores, CRT, velas y neón enfermo — pero siempre se lee qué pasa.

## 2. Qué aprendemos de los grandes
| Juego | Lección que aplicamos |
|---|---|
| **Balatro** | Estructura de *ciegas* → **3 mesas por círculo (Menor/Mayor/Jefe)**, objetivo de puntos con tiros limitados, `Fichas × Mult` con animación paso a paso, comodines con sinergias, tienda entre rondas, interés por ahorro, lunas (≈planetas) que suben de nivel el tipo de tiro. |
| **Peglin** | La física *es* el juego: la habilidad del jugador importa, pero el build convierte buenos tiros en tiros brutales. Guía de apuntado generosa. |
| **Slay the Spire** | Jefes con reglas visibles **antes** de entrar (el jugador planifica). Rarezas claras. Elección significativa en la tienda. |
| **Luck be a Landlord** | Escalado de objetivos que obliga a construir motor, no solo a jugar bien. |
| **Hades** | Muerte = progreso: estadísticas y colección persistentes, ganas de "una más". Feedback audiovisual en cada acción. |
| **Vampire Survivors** | Escalada caótica deliciosa: los comodines épicos rompen el juego a propósito. |

## 3. Bucle de juego
```
Elegir Taco ─► Mapa del círculo ─► Mesa (tiros) ─► Cobro ─► Tienda ─► siguiente mesa
                    ▲                                                     │
                    └──────────── siguiente círculo tras el Jefe ◄────────┘
```
- **Run**: 6 círculos × 3 mesas = 18 mesas. Ganar el Jefe del círculo VI = victoria. Tras la victoria: modo **Infinito** (objetivos ×2.2 por círculo).
- **Mesa**: tus 15 bolas se colocan en triángulo; tienes N tiros (5 por defecto) para alcanzar el objetivo. Las bolas embocadas desaparecen de la mesa (no de tu set). Si la mesa se vacía, se vuelve a montar.
- **Saque libre (v1.2)**: el saque (y cada nuevo triángulo) **no gasta tiro ni puntúa**. Cada bola que entra en el saque da **+2 Mult de CARGA**, que se suma al próximo tiro que puntúe (no se pierde por fallar). La falta en el saque solo da bola en mano y la 8 en el saque vuelve al punto sin maldición. Motivo: en v1.1 el 60% de las mesas se ganaban solo con el saque, y fallarlo se sentía injusto.
- **Derrota**: acabar los tiros sin alcanzar el objetivo. Permadeath.

## 4. Puntuación
`Puntos del tiro = (Fichas del tipo de tiro + Fichas de bolas + bonos) × (Mult del tipo + bonos) × xMult...`
- **Tipo de tiro** por nº de bolas embocadas: Simple (1), Doblete (2), Triplete (3), Masacre (4+), Mesa Limpia (8 negra como última bola). Cada tipo tiene nivel (Lunas Negras).
- **Fichas por bola** = número de la bola × 5 (las rayadas valen más que las lisas).
- **Banda**: bola que tocó banda antes de entrar → +10 fichas.
- **Racha**: cada tiro seguido que emboca suma +1 Mult (máx. +8). El saque no la rompe.
- **La 8 maldita**: meterla antes de tiempo (fuera del saque) = **MALDICIÓN**: el tiro puntúa 0 y la 8 vuelve al punto. Meterla la última = Mesa Limpia.
- **Falta (blanca dentro)**: el tiro puntúa 0 y la siguiente es bola en mano.
- Orden de evaluación (visible, animado): tipo de tiro → cada bola (y sus grabados, y comodines `onBall` de izquierda a derecha) → comodines `onShot` de izquierda a derecha → total.

## 5. Economía
- Recompensa: Menor $3, Mayor $4, Jefe $5 + $1 por tiro sobrante + interés $1 por cada $5 (máx. $5).
- Tienda: 2 comodines, 2 consumibles, 1 sobre; *reroll* $5 (+$1 por uso). Vender = mitad del precio.
- Huecos: 5 comodines, 2 consumibles.

## 6. Contenido v1
- **30 comodines** (13 comunes, 10 raros, 5 épicos, 2 legendarios) — ver `src/game/data.js`.
- **6 grabados** de bola: Oro, Cristal, Plomo, Fuego, Holo, Bomba.
- **19 consumibles**: 7 Arcanos, 6 Grabados, 5 Lunas Negras... (+1).
- **4 tacos** iniciales (≈ mazos de Balatro).
- **10 jefes** con reglas malditas (9 normales + La Boca, jefe final).
- **6 círculos** con identidad visual propia.

## 7. Controles
- **Ratón/táctil**: arrastra *desde la blanca hacia atrás* (tirachinas) para apuntar y cargar potencia; suelta para tirar. Rueda/teclas ←→ para ajuste fino. Clic derecho/ESC cancela.
- Teclado: `Espacio` mantener = cargar potencia; `R` reiniciar run (en menú de pausa); `M` silencio.

## 8. Dirección de arte
Ver `docs/ART_CONTRACT.md`. Paleta "Cripta" de 32 colores, 640×360, CRT, sprites con contorno oscuro, colores semánticos fijos (Fichas azul, Mult rojo, Dinero oro).

## 9. Persistencia
`localStorage`: mejor círculo alcanzado, récord de tiro, partidas jugadas/ganadas, comodines descubiertos (colección), ajustes (CRT, volumen).
