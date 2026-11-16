# Arquitectura — OCHO MALDITO

JS sin build, scripts clásicos bajo el global `window.OM`. Se abre `index.html` directamente (file:// o cualquier servidor estático). `tools/build.js` genera un único HTML autocontenido en `dist/`.

```
src/core/px.js          Paleta (32 col), OM.LAYOUT, registro de sprites OM.PX + pincel g
src/art/font.js         OM.FONT  — fuente bitmap (agente UI)
src/art/ui_art.js       OM.UI    — paneles, botones, iconos, fondos, logo (agente UI)
src/art/fx.js           OM.FX    — partículas, textos flotantes, shake, CRT, transiciones (agente UI)
src/art/cards_art.js    OM.CARDS — comodines, consumibles, jefes, tacos, sobres (agente cartas)
src/art/table_art.js    OM.TABLE — mesa, troneras, bolas, taco, guía, fondos de círculo (agente mesa)
src/audio/audio.js      OM.AUDIO — SFX y música procedurales WebAudio (agente audio)
src/game/data.js        Datos de diseño: comodines (con hooks), objetos, tacos, jefes, círculos
src/game/physics.js     OM.Physics — bolas, bandas, mandíbulas, troneras, trazado de guía, saque
src/game/run.js         OM.Run — RNG con semilla, estado de partida, puntuación Fichas×Mult, tienda
src/game/main.js        Bucle, entrada (ratón/táctil/teclado), GUI inmediata OM.G, persistencia META
src/game/hud.js         OM.HUD — panel izquierdo, fila de comodines (arrastrar/vender), consumibles, selector de bolas
src/game/scene_table.js Escena de mesa (colocar → apuntar → tiro → simulación → puntuación animada → cobro)
src/game/scene_menus.js Título, taco, mapa, tienda + sobres, colección, game over, victoria, pausa
```

## Flujo de una mesa
1. `enter`: mundo físico con modificadores (comodines + jefe), triángulo con las bolas del set.
2. `place` → `aim` → `strike` (animación del taco) → `rolling`: se procesan eventos de física (`hit`, `cushion`, `pocket`) → sonido, FX y registro del tiro.
3. `finishShot`: `OM.Run.score()` produce una lista de **eventos** (`type`, `chips`, `mult`, `xmult`, `money`, `msg`) que `updateScoring` reproduce uno a uno con *juice* (estilo Balatro).
4. `afterShot`: escalado de comodines, rotura de cristal, 8 maldita vuelve, victoria/derrota, nuevo triángulo.

## Comodines
Cada comodín es un objeto de datos con hooks (`onBall`, `onShot`, `onAfter`, `onScratch`, `mods`). El orden de la fila importa (izquierda→derecha) y se puede reordenar arrastrando. *Espejo Roto* resuelve el comodín de su derecha.

## Pruebas
- `node tools/simtest.js` — física headless (saque, tiro a tronera) y puntuación.
- `node tools/balance.js` — puntos medios por mesa para calibrar objetivos.
- `node tools/playtest.js <dir>` — recorre el juego en Chromium y guarda capturas + errores.
