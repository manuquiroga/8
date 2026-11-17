# Arquitectura — 8

JS sin build, scripts clásicos bajo el global `window.OM`. Se abre `index.html` directamente (file:// o cualquier servidor estático). `tools/build.js` genera un único HTML autocontenido en `dist/`.

```
src/core/px.js          Paleta (32 col), OM.LAYOUT, registro de sprites OM.PX + pincel g
src/art/*.js            Fuente, UI, FX, cartas, mesa. cards_art_v31.js: arte de las cartas de la tienda (3.1)
src/audio/audio.js      OM.AUDIO — SFX y música procedurales WebAudio
src/game/data.js        Datos de diseño: comodines (tipo comodín/hechizo/activo, con hooks), tienda y dinero (OM.SHOP), tacos, obstáculos, puntos, modos
src/game/physics.js     OM.Physics — paso fijo (determinista), bandas, troneras, efecto, elevación (salto/massé),
                        obstáculos (pilares, vórtice, portales), `predict` (guía) y `clone`/`run` (bots)
src/game/match.js       OM.Match — serie de 5, tienda (ofertas, comprar, vender, cambiar, cobro), juez de bola 8 y bola 9,
                        puntuación Puntos x Combo, dinero por trucos, comodines y activos.
                        Sin dibujo ni entrada. El estado de la serie (OM.S) es JSON plano.
src/game/ai.js          OM.AI — bots: bola fantasma + comprobación por simulación según nivel
src/game/net.js         OM.NET — 1v1 online por sala, de navegador a navegador (PeerJS)
src/vendor/peerjs.min.js PeerJS 1.5.4 (MIT), copia local para que el build sea un solo archivo
src/game/main.js        Bucle, entrada (ratón/táctil/teclado), GUI inmediata OM.G, persistencia META
src/game/hud.js         OM.HUD — marcador de los dos jugadores, comodines del que tira y del rival
src/game/scene_table.js Escena de mesa: turnos (humano/bot/remoto), mandos, simulación, puntuación animada
src/game/scene_menus.js Título, preparación, sala online, tienda, resultado, colección, pausa
```

## Flujo de un tiro
1. El que tira (jugador local, bot o rival online) produce una acción: `actPlace`, `actJoker` o `actShoot({angle, power, spin, elev})`.
2. `OM.Match.beginShot` lanza la blanca; la escena pasa los eventos de física (`hit`, `cushion`, `bumper`, `pocket`...) a `OM.Match.track`.
3. Cuando todo se detiene, `OM.Match.resolve` juzga (faltas, grupos, victoria), puntúa y cambia el turno. Devuelve una lista de **eventos** que la escena reproduce uno a uno.
4. `beginTurn` aplica los modificadores del siguiente jugador (troneras, imán, guía) y reinicia efecto y elevación.

## Online
PeerJS: el anfitrión se registra en el servidor público de PeerJS con el id `ocho-pool-v31-<CÓDIGO>` y el invitado se conecta a ese id. Canal de datos fiable y ordenado, con latido para detectar desconexiones. El que tira es la autoridad. Envía sus mandos (`shoot`) y, al terminar, el estado completo (`sync`: serie + posiciones). El otro cliente simula el mismo tiro (paso fijo) y luego se ajusta al estado recibido. Las ofertas de la tienda salen de la semilla; al pulsar LISTO cada jugador manda su estado tras comprar (`shop`: comodines, dinero) y el otro lo aplica tal cual. El cobro (`OM.Match.payday`) es determinista y lo calculan los dos.

## Comodines
Objetos de datos con hooks (`onBall`, `onShot`, `onMiss`, `onFoul`, `onRival*`, `onBreakBall`, `onMatchEnd`, `onPayday`, `mods`, `rival`, `active`). Ver la cabecera de `data.js`. *Espejo Roto* copia al comodín de su izquierda (solo comodines).
`P.jokers` guarda las tres clases ordenadas: comodines, hechizo, activo (`sortJ`). Los activos se quitan de la fila al usarse y dejan su efecto pendiente en `M.fx` (`bomb`, `rewind`, `free`, `boost`, `hex`, `xshot`), que `beginShot` consume. *Marcha Atrás* guarda `serialize(S)` + `Physics.snap` al tirar y `resolve` lo restaura si el tiro no sirvió. Los hechizos se borran en `payday`.

## Pruebas
- `node tools/simtest.js [series] [nivelA] [nivelB] [modo]` — series bot contra bot headless: balance y humo.
- `node tools/playtest.js <dir> [partidas]` — juega contra el bot en Chromium (compra en la tienda) y guarda capturas + errores (necesita playwright).
- `node tools/serve.js [puerto]` — servidor estático local (por defecto 8088).

## Deploy
Vercel, como sitio estático sin build (`vercel.json`, `.vercelignore`). Cada push a `main` publica.
