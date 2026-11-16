# Devlog — OCHO MALDITO

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
- Build único `dist/ocho-maldito.html` (≈437 KB) y publicación como Artifact.

### Próximos pasos (backlog)
- Guardar/continuar partida a mitad de run.
- Efecto (spin) del taco: retroceso/seguimiento.
- Ediciones de comodín (foil/holo/negativo) ya dibujadas: conectar a la economía.
- Más jefes y comodines; desbloqueos persistentes.
