# Devlog — 8

## 2026-11-16 · Día 1
- Definida la visión: roguelite de billar (bola 8) en un bar infernal, estructura inspirada en Balatro + física à la Peglin.
- Núcleo de píxel (`px.js`): paleta "Cripta" de 32 colores, resolución interna 640×360, layout compartido.
- GDD y datos: 30 comodines, 19 consumibles, 4 tacos, 10 jefes, 6 círculos.
- Contrato de arte (`docs/ART_CONTRACT.md`) para trabajar en paralelo.
- Lanzados 4 agentes: UI/FX/fuente, cartas, mesa/bolas, audio. El lead escribe el motor.

## 2026-11-16 · Integración (v1.0)
- Agentes entregados: fuente/UI/FX/logo/CRT, 31 comodines + 18 consumibles + 10 jefes + 4 tacos, mesa con 6 temas y bolas rodantes, audio procedural (24 SFX, 5 pistas).
- Física ajustada: fricción 150 px/s² + amortiguación 0.12; impulso de saque arcade (≈1 bola por saque, como un saque real).
- Balance: jugador medio sin comodines ≈ 470-520 puntos/mesa → objetivos del Círculo I: 250/375/500.
- Corrección visual: rayadas legibles, logo reubicado, texto de interés, layout de sobres.
- Playtests automáticos (`tools/playtest.js`, `tools/scenetest.js`): todas las escenas sin errores de consola.
- Build único `dist/8.html` (≈437 KB) y publicación como Artifact.

### Próximos pasos (backlog)
- Guardar/continuar partida a mitad de run.
- Efecto (spin) del taco: retroceso/seguimiento.
- Ediciones de comodín (foil/holo/negativo) ya dibujadas: conectar a la economía.
- Más jefes y comodines; desbloqueos persistentes.

## 2026-11-16 · v1.1 — feedback de playtest + backlog
**Bugs del playtest**
- Al perder, la mesa llamaba a `OM.go('gameover')` en cada frame y la transición se reiniciaba sin fin: nunca se llegaba a la pantalla de derrota. Ahora aparece el panel "SIN TIROS" con el botón **VER RESULTADOS** (Enter) y el MENÚ del panel izquierdo queda deshabilitado.
- El sonido de derrota sonaba dos veces (mesa + game over). Ahora la escena de game over no lo repite si se viene de la mesa.

**Dobletes y rebotes (diseño)**
- Medido con `tools/balance.js` y una simulación de tiros apuntados tras el saque: con la física v1.0 solo el 0,9% de los tiros metía 2+ bolas, pero los objetivos asumían un 15% de dobletes. Por eso se perdía casi siempre.
- Física: fricción 150→95, amortiguación 0.12→0.09, bandas 0.72→0.80, atracción suave de las troneras sobre las bolas lentas (no sobre la blanca). Dobletes: 0,9%→3,1%. Mesas con algún doblete posible: 22%→56% (71% usando efecto).
- **Efecto del taco**: selector en la barra inferior (clic en la blanca o W/A/S/D; R o clic derecho para centrar). Retroceso/seguimiento en el primer contacto y efecto lateral en las bandas. La guía muestra la salida de la blanca con el efecto aplicado.
- **RACHA** (mecánica base): cada tiro seguido que emboca suma +1 Mult (máx. +8). Meter de a una bola con consistencia también escala.
- Saque "clavado": la blanca pierde el 95% de su velocidad al romper, así las faltas en el saque quedan como en v1.0 (~8%).
- Objetivos: Círculo I 250→200, II 700→550, III 1800→1500. Un jugador medio sin comodines supera la Mesa Menor del Círculo I el 86% de las veces.
- Doble Fondo pasa a x3 (es más raro). Usurero pasa a dar $1 por tiro que emboca ($3 con 2+ bolas).

**Backlog**
- Guardar/continuar: la partida se guarda en el mapa y en la tienda (incluidas compras y rerolls). En el título aparece **CONTINUAR**. Una mesa abandonada a medias se rejuega desde el mapa. Si se recarga con un sobre abierto, la elección de ese sobre se pierde.
- Ediciones de comodín conectadas: Laminado (+50 Fichas), Holográfico (+10 Mult), Policromo (x1.5 Mult), Negativo (+1 hueco). Salen en la tienda y en los sobres y suben el precio.
- Contenido nuevo: comodines Eslabón, Limosna, Maestro del Efecto, Pulso de Cirujano, Segunda Oportunidad, Cadena Infernal (épico) y El Barquero (legendario). Jefes El Ciego, La Purista y El Reloj. Taco Espectral.
- Desbloqueos persistentes (`OM.UNLOCKS`): Taco de la Usura (Círculo II), Taco de Hueso (Círculo III), Taco Espectral (3 jefes), Cadena Infernal (racha x5), El Barquero (ganar una vez).
- `tools/serve.js`: servidor estático sin dependencias para probar en el navegador.

## 2026-11-16 · Registro de partidas + bot de balance
- `OM.LOG` registra cada tiro (con el aporte marginal de cada comodín), cada mesa, cada tienda y el dinero. Pantalla **REGISTRO** con banderas ROTO/INÚTIL/IGNORADO/DIFÍCIL/FÁCIL, exportar e importar JSON. Detalle en `docs/TELEMETRY.md`.
- Pantalla final: valoración **fácil/justa/difícil** y **repetir semilla**. Los errores de consola quedan en el registro de la partida.
- `tools/bot.js` juega miles de partidas con la lógica real (1000 en <1 s). `tools/analyze.js` hace el informe de cualquier registro.
- Primer diagnóstico del bot (1000 partidas, política "compra lo mejor"):
  - Ninguna mesa sola es injusta (cada una se supera entre el 55% y el 95%), pero **la supervivencia se compone en 18 mesas**: el bot medio gana el 0,3% de las partidas y el bueno el 0,9%. El cuello de botella está en C3-jefe y de ahí en adelante (60-70%).
  - Comodines más fuertes por avance: Calavera Dorada, Eco del Abismo, Carambolero y Tiza Azul. Ninguno queda marcado ROTO con el criterio corregido.
  - La Parca casi nunca se activa: las mesas se ganan antes de que queden ≤5 bolas. Candidata a rediseño.
  - El Verdugo es un jefe FÁCIL (91%).
  - Ojo de Cuervo e Imán salen bajos en el bot porque su valor depende de la física real: conviene confirmarlo con partidas humanas.

## 2026-11-16 · Curva de dificultad calibrada con el bot + findings de tienda
- El bot mostró que el problema era el **desgaste temprano**: las mesas del Círculo I-II se perdían un 10-15% por rachas de fallos, porque un Simple valía 25-75 puntos. Con objetivos más bajos casi no mejoraba nada.
- Escalera de tiros: Simple 30×2 (antes 20×1), Doblete 50×3, Triplete 80×4, Masacre 120×6.
- Objetivos por círculo: 150 / 500 / 1.200 / 2.600 / 5.200 / 10.000 (antes 200 / 550 / 1.500 / 4.500 / 10.000 / 22.000).
- Resultado (bot, 4000 partidas por nivel): victorias flojo 0,6%→2,1%, medio 0,3%→5,5%, bueno 0,9%→11,3%. Primera mesa: 96-99%. La dificultad ahora está en los jefes de los Círculos III-VI.
- La Parca: x0.2 Mult por bola embocada en la mesa (antes casi nunca se activaba; ahora aporta ~31%).
- El Verdugo: fallar también cuesta un tiro (antes se superaba el 92%; ahora 80-86%).
- La bandera FÁCIL ya no marca los Círculos I-II (fáciles a propósito).
- `tools/bot.js --bases`, `--kinds` y `--set ruta=valor` para experimentar con el balance sin tocar el código.
- Tienda: **USAR YA** compra y usa en un clic las lunas, grabados y arcanos que se pueden usar fuera de la mesa, aunque no quede hueco de consumible.
- Sobre Maldito con la fila llena: la fila de comodines queda por encima del sobre y se puede vender uno para hacer hueco.
- Pendiente de datos reales: los jefes "físicos" (Péndulo, Ciénaga, Escarcha, Sepulturero) salen FÁCIL en el bot porque el bot no simula la física. La Sanguijuela sí es fácil de verdad (solo cuesta dinero).

## 2026-11-16 · v1.2 — Saque libre + Carga
**Problema (playtest)**: "gano hiper fácil del saque; si fallo el saque (blanca u 8) se siente injusto".
**Medición**:
- Con la física real, un saque a fondo mete 1,9 bolas de media (10% ninguna, 37% tres o más) con 11% de faltas. El bot ahora usa esa distribución.
- Con las reglas v1.1, **el 60% de las mesas se ganaban solo con el saque**. Se superaba la mesa el 97% tras un saque bueno y el 73-81% tras uno vacío o malo.

**Cambio**: el saque no gasta tiro ni puntúa. Cada bola da +2 Mult de CARGA para el próximo tiro que puntúe. La falta en el saque es bola en mano sin castigo y la 8 vuelve sin maldición. Martillo de Hueso: la carga vale el triple. Primera Sangre: el primer tiro tras el saque.

**Resultado (bot, 4000 partidas)**:
- Mesas ganadas solo con el saque: 60% → 0%.
- Supera la mesa según el saque: bueno 92%, normal 88%, vacío 89%, malo 92%. El saque ya no decide la mesa.
- Objetivos reajustados a 140 / 460 / 1.100 / 2.400 / 4.800 / 9.200. Victorias: flojo 0,8%, medio 5%, bueno 16%.
- Nuevas métricas en el análisis: justicia del saque (pasa la mesa según cómo salió el saque) y la bandera SAQUE.
- `tools/bot.js --oldbreak` juega con las reglas v1.1 para comparar, y `--carga k` escala la carga.

## 2026-11-16 · v1.3 — Más comodines, jefes y tacos balanceados
**Comodines nuevos (11)**
- Comunes: El Paciente (+3 Mult por tiro ya usado), Diezmo (+1 Mult cada $5), Barrendero (+8 Fichas por bola fuera de la mesa), Pares Malditos (+4 Mult por bola par).
- Raros: A la Tercera (cada 3er tiro x3), Sangría (+1 Mult permanente por tiro que no puntúa), Matrimonio Maldito (lisa + rayada en el mismo tiro: x2.5), Codicia (x0.05 por cada $, máx. x3), El Astrólogo (al ganar mesa sube un tiro de nivel).
- Épico: Eclipse (x0.1 por cada nivel de tiro subido). Legendario: La Corona Hueca (x2 +x0.5 por Círculo superado).
- Los comodines reciben `S.R` (la partida) en los hooks de puntuación. Nada de RNG dentro de `onShot`: la telemetría vuelve a puntuar el tiro para medir aportes.
- Bot: Eclipse salió ROTO a x0.3 (68% de los puntos) → x0.1. Sangría a +2 aportaba 44% → +1.

**Jefes nuevos (4)** — bot medio, % de mesas superadas:
- El Tasador (Fichas /2 al final del tiro) 80% · La Inquisidora (sin grabados ni ediciones) 83% · La Espina (sin RACHA ni CARGA) 85% · La Durmiente (el comodín de más a la izquierda no tiene efecto; se ve apagado y se puede reordenar) 87%.
- La Sanguijuela pasa a -$2 por tiro (sigue FÁCIL en el bot porque su castigo es económico, no de mesa).
- `OM.Run.tableHook(R, hook)` centraliza onTableStart/onTableEnd y respeta a La Durmiente. El bot ahora también llama onTableEnd.

**Tacos balanceados** — el bot mostró que 4 tiros por mesa hundían cualquier taco (Sangriento 2%, Espectral 1%) y que Usura dominaba (10-13%). Ahora todos tienen 5 tiros salvo Vidrio y compensan con otra cosa:
- Sangriento: 5 tiros, Tiza Azul, $0 · Espectral: 5 tiros, Blanca Fantasma, $0 · Usura: $6, interés hasta $7.
- Nuevos: Ébano (tiros a nivel 2, 1 comodín menos), Vidrio (6 tiros, 3 huecos; desbloqueo Círculo IV), Pacto (épico al azar, $0, sin interés; desbloqueo racha x5).
- Victorias por taco (bot medio, 1000 c/u): Peregrino 8%, Sangriento 7%, Usura 8%, Hueso 6%, Espectral 5%, Ébano 8%, Vidrio 7%, Pacto 9%.
- Selección de taco: carrusel de 5 con flechas y ←/→.

**Curva**: con más contenido el juego era más fácil (medio 7%). Objetivos IV-VI a 2.500 / 5.100 / 9.800 → victorias flojo 0,9%, medio 6,2%, bueno 17,7%.
- Arte en `src/art/cards_art_v13.js`; hoja de contacto en `tools/preview_v13.html`.

## 2026-11-16 · v2.0 — Bola 9 (cambio de mecánica)
**Problema (playtest)**: "no estoy jugando pool: saco siempre igual y fuerte, meto una bola y gané". Las reglas de v1.x no premiaban la posición: siempre se podía tirar a la bola más fácil.
**Cambio**: bola 9 con vida. Reglas completas en el CHANGELOG. Decisiones de diseño:
- Se gana metiendo la 9 legal. Los puntos dan dinero (botín) y curan con los tiros *brillantes* (los que superan la cuota). Así los comodines de puntaje siguen ayudando a sobrevivir.
- La vida se reinicia en cada mesa: con vida persistente y unos 10 tiros por mesa, el bot medio no pasaba del Círculo II.
- El juez de reglas vive en `OM.Run.judge` / `OM.Run.vitals` y lo comparten el juego y el bot.
- Cuota (`OM.CIRCLES[].base`) calibrada al percentil 70 de los tiros que embocan en cada círculo (bot bueno): 300 / 3.000 / 6.500 / 13.000 / 22.000 / 45.000, con x1.4 en Mayor y x1.8 en Jefe. La potencia de los comodines crece mucho más rápido que en v1 porque hay unos 10 tiros por mesa.
- Bot (`tools/bot.js`): modelo de tiro nuevo (falta, fallo y nº de bolas por skill, layout, troneras y jefe), con las reglas reales. Flags `--seguidas` (3 faltas seguidas) y `--tacada N`.

**Medido con el bot (6000 partidas)**:
- Base de vida: con 5, el bot bueno gana el 0,6%; con 7, el 3%. Elegida: 7.
- Pérdidas de mesa: 61% por quedarse sin vida y 39% por las 3 faltas (con un 9% de faltas por tiro).
- Comodines rotos encontrados: Vampiro (aportaba 92% de los puntos), Codicia (68%) y Reloj de Arena con 7 vidas. Corregidos.
- La Boca: 8% → 54% (troneras 0,62 → 0,75; el bot además contaba el castigo dos veces).
- Resultado: bot bueno gana el 17%, medio el 0,2%, flojo el 0%. Los comodines que más avance dan son los de pool: el Barquero, Imán, Ojo de Cuervo, Mano Negra, Segunda Oportunidad y Fantasma.
- Pendiente: el bot no mide física. Hay que validar con partidas humanas la tasa real de fallo en bola 9 y si las 3 faltas deben contarse seguidas.

## 2026-11-16 · v3.0 — Pool arcade 1v1 (cambio de dirección)
**Por qué**: el playtest pedía jugar pool de verdad contra alguien. Se conserva el arte, la mesa, el audio y la idea de comodines.
**Decisiones**
- La serie se gana por puntos, no al mejor de 5: así cada tiro vistoso cuenta y siempre se puede remontar. La victoria de partida vale entre 1.000 y 3.000 para que ganar siga importando.
- Draft gratis en vez de tienda: nada de dinero ni menús largos entre partidas de un 1v1.
- Las reglas (`OM.Match`) no dibujan ni leen entrada: las usan la escena, los bots y `tools/simtest.js`.
- Online: el que tira manda mandos + estado final. Física de paso fijo para que los dos vean lo mismo.
**Medido con `tools/simtest.js`** (series bot contra bot)
- Acierto por tiro: fácil ~25%, medio ~40%, difícil ~55%. Difícil gana 12/12 series a fácil; medio gana 12/12 a fácil.
- Saque: 0,7-0,9 bolas por saque, blanca dentro 0-7%. Unas 22-30 tiros por partida.
- El primer reparto de puntos dejaba la victoria de partida (400-1.000) en nada frente a los combos; se subió a 1.000-3.000.
**Pendiente**: los bots no usan efecto ni elevación; el balance de comodines está sin validar con humanos; el online no reconecta.
