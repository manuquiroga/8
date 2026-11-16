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
