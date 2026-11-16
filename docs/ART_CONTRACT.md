# Contrato de arte y audio — OCHO MALDITO

Este documento es la interfaz entre el motor (`src/game/*`) y los módulos de arte/audio.
**Si un nombre o una firma de aquí cambia, el juego se rompe.** Puedes añadir cosas, pero no cambiar las firmas.

## Reglas globales
- Juego en **HTML5 Canvas 2D, JS sin build**, scripts clásicos (no ES modules) colgando del global `window.OM`.
- Resolución interna **640x360**, escalada con nearest-neighbor. Píxel art **nítido**: siempre coordenadas enteras, `imageSmoothingEnabled=false`, nada de antialias, nada de `ctx.arc` suavizado sobre sprites (usa `g.circle`).
- **Paleta obligatoria**: los 32 colores de `OM.PAL` en `src/core/px.js` (claves `'0'..'9','a'..'v'`). Nada de colores fuera de paleta (excepción: `globalAlpha`/composición para luces y la capa CRT).
- Tema: **oscuro, retro, gótico-infernal, de bar maldito**. Velas, calaveras, cadenas, neón enfermo, terciopelo, latón viejo. Contraste alto, siluetas legibles, contorno oscuro (`'0'` o `'1'`) en todos los sprites de objetos. Luz principal cálida desde arriba, sombras púrpura. Inspiración de *feeling*: Balatro (claridad/juice), Inscryption (atmósfera), Dicey Dungeons/Peglin (legibilidad). **No copies arte ni personajes de juegos existentes.**
- Colores semánticos (no los cambies): **Fichas = azul `'q'`**, **Mult = rojo `'c'`**, **Dinero = oro `'h'`**, peligro/jefe = `'b'`/`'a'`.
- Usa los helpers de `OM.PX` (`make`, `sprite`, `draw`, pincel `g` con `p, rect, frame, circle, ring, line, dither, outline, rows, sprite`). Registra sprites UNA vez en la carga (`OM.ART_INIT.push(fn)`; el motor ejecuta las funciones en orden tras cargar todo).
- Cada módulo debe funcionar sin depender de otros módulos de arte salvo `px.js` y `font.js`.

## Orden de carga
```
src/core/px.js → src/art/font.js → src/art/ui_art.js → src/art/fx.js → src/art/cards_art.js
→ src/art/table_art.js → src/audio/audio.js → src/game/data.js → src/game/*.js
```
`OM.ART_INIT = OM.ART_INIT || []` — cada módulo de arte empuja su función de inicialización.

---

## Agente FUENTE+UI+FX → `src/art/font.js`, `src/art/ui_art.js`, `src/art/fx.js`

### `OM.FONT` (font.js)
- Fuente bitmap propia, mayúsculas+minúsculas, dígitos, `.,:;!?¡¿'"()[]+-x*/%$#<>=_&@` y **acentos españoles ÁÉÍÓÚÜÑáéíóúüñ**. Alto de glifo ~7px (tamaño `1`) y una variante grande "display" (~12-14px, para títulos y números de puntuación).
- `OM.FONT.draw(ctx, text, x, y, opts)` → devuelve ancho dibujado. `opts = {color:'7', align:'left'|'center'|'right', shadow:'0'|null, size:1|2 (display), scale:1, outline:'0'|null, wave:0 (amplitud px de onda animada), t:time}`.
- `OM.FONT.measure(text, size=1)` → ancho en px. `OM.FONT.lineH(size)` → alto de línea.
- `OM.FONT.wrap(text, maxW, size=1)` → array de líneas.
- Admite códigos de color en línea: `{q}texto azul{/}`, `{c}`, `{h}`, etc. (clave de paleta). Usado en descripciones ("+4 {c}Mult{/}").

### `OM.UI` (ui_art.js)
- `OM.UI.panel(ctx, x, y, w, h, style)` — panel 9-slice. styles: `'dark'` (panel por defecto, terciopelo/piedra con borde de latón), `'inset'` (hueco hundido para valores), `'blood'` (alerta/jefe), `'gold'` (recompensa/tienda), `'tooltip'`.
- `OM.UI.button(ctx, x, y, w, h, label, state, style)` — state: `'idle'|'hover'|'down'|'disabled'`; style: `'red'|'blue'|'gold'|'green'|'dark'`. Botón chunky con bisel y sombra inferior de 2px (al pulsar baja).
- `OM.UI.icon(ctx, name, x, y)` — iconos 9x9 o 12x12: `coin, shot, skull, chips, mult, xmult, reroll, lock, ball, cue, candle, eye, star, arrow_r, arrow_l, check, cross, hourglass, sell`.
- `OM.UI.valueBox(ctx, x, y, w, h, value, kind)` — caja para Fichas (`'chips'` azul) y Mult (`'mult'` rojo) con número grande, como el "chips x mult".
- `OM.UI.bar(ctx, x, y, w, h, frac, color)` — barra de progreso / potencia.
- `OM.UI.drawBackground(ctx, t, scene)` — fondo de pantalla completa para escenas sin mesa: `'title'|'shop'|'map'|'gameover'|'victory'`. Animado y atmosférico (debe verse genial: niebla, velas, polvo).
- `OM.UI.logo(ctx, x, y, t)` — logo **"OCHO MALDITO"** grande (centrado en x), con la bola 8 como "O" o elemento central, animado (brillo, goteo, parpadeo neón). Es la primera impresión del juego: que sea tremendo.
- `OM.UI.cursor(ctx, x, y, state)` — cursor propio (`'normal'|'aim'|'grab'`).

### `OM.FX` (fx.js)
- Sistema de partículas: `OM.FX.burst(x, y, kind, n, opts)`, `OM.FX.update(dt)`, `OM.FX.draw(ctx)`, `OM.FX.clear()`. kinds: `'spark'` (impacto), `'dust'` (tiza), `'blood'`, `'gold'` (monedas), `'smoke'`, `'ember'`, `'shard'` (cristal roto), `'pocket'` (caída en tronera, remolino), `'explosion'`.
- Textos flotantes: `OM.FX.popText(x, y, text, color, opts)` — números que saltan con escala/rebote ("+40", "x2", "+$3").
- Sacudida: `OM.FX.shake(intensidad, duración)`; `OM.FX.shakeOffset()` → `{x,y}`.
- Flash: `OM.FX.flash(color, alpha, dur)`.
- Post-proceso CRT: `OM.FX.post(srcCanvas, dstCtx, dstW, dstH, t, opts)` — dibuja el canvas interno escalado al canvas de pantalla con scanlines suaves, viñeta, leve aberración cromática y bloom barato en brillos. Debe poder desactivarse (`opts.crt=false`). Rendimiento: 60fps en portátil normal.
- Transiciones: `OM.FX.transition(kind, dur)`, `OM.FX.drawTransition(ctx)` — `'iris'` y `'dither'` (fundido por tramado a negro).

---

## Agente CARTAS → `src/art/cards_art.js`

- Sprites de ilustración 32x32 para **cada comodín** de `OM.JOKERS` en `src/game/data.js`: nombre `joker_<id>`. La ilustración debe contar el efecto de un vistazo (ej. `vela_negra` = vela negra con llama, `parca` = guadaña, `espejo_roto` = espejo agrietado).
- Sprites 24x24 para cada consumible de `OM.ITEMS`: `item_<id>`. Arcanos = estilo carta de tarot macabra; Grabados = sello/runa con el material; Lunas = luna con su color.
- Iconos 32x32 de jefe: `boss_<id>` para cada `OM.BOSSES` (rostros/emblemas siniestros).
- Iconos 24x24 de taco: `cue_<id>` para `OM.CUES`.
- `OM.CARDS.drawJoker(ctx, jokerDef, x, y, opts)` — dibuja la carta completa 40x54 (marco por rareza: común azul, raro verde, épico rojo, legendario oro animado) con la ilustración. `opts = {t, hover, selected, scale, alpha, sold, edition, wobble}`. Hover = leve elevación/brillo; las cartas tienen sombra.
- `OM.CARDS.drawItem(ctx, itemDef, x, y, opts)` — carta pequeña 30x40 según `kind` (`arcano`, `grabado`, `luna`).
- `OM.CARDS.drawBack(ctx, x, y, kind, opts)` — reverso de carta (para sobres/animación de reparto). kinds `'joker'|'item'`.
- `OM.CARDS.drawPack(ctx, packKind, x, y, opts)` — sobre 40x54 para la tienda: `'arcano'|'luna'|'grabado'|'maldito'`.
- `OM.CARDS.drawBossMedal(ctx, bossDef, x, y, opts)` — medallón 48x48 del jefe (marco + icono) para el mapa.

---

## Agente MESA → `src/art/table_art.js`

- `OM.TABLE.themes` — 6 temas por círculo (`limbo, lujuria, gula, avaricia, ira, abismo`), cada uno con colores de paño/madera/acento distintos (limbo: paño verde musgo y madera negra; lujuria: terciopelo carmesí y latón; gula: verde tóxico y hueso; avaricia: paño púrpura y oro; ira: paño sangre y hierro con brasas; abismo: paño negro-violeta con runas cian).
- `OM.TABLE.drawTable(ctx, theme, t, opts)` — dibuja la mesa completa dentro de `OM.LAYOUT.table` con paño en `OM.LAYOUT.felt`: madera, bandas (cojines), diamantes de banda, **6 troneras** (centros = `OM.TABLE.pockets()`), sombras internas, textura de paño con tramado sutil y decoración temática (calaveras talladas, remaches, etc). `opts = {sealedSides:bool (troneras laterales selladas con cadenas/tablas), pocketScale:1}`. Puede cachear en un canvas offscreen por tema (lo animado — velas, brillo de runas — encima).
- `OM.TABLE.pockets()` → array de 6 `{x, y, corner:bool, id}` en coordenadas de pantalla (centros de tronera, alineados con el borde del paño). **Fuente de verdad para la física.**
- `OM.TABLE.drawBackdrop(ctx, theme, t)` — fondo de pantalla completa detrás de la mesa (sala del bar del círculo: ladrillo, velas, cadenas, ventana con luna, etc.), animado sutilmente. Debe dejar legible la UI.
- `OM.TABLE.drawBall(ctx, ball, x, y, t)` — bola de radio 6 (diámetro 12-13px) centrada en (x,y). `ball = {num:0..15 (0 = blanca), kind:'normal'|'oro'|'cristal'|'plomo'|'fuego'|'holo'|'bomba', rollX, rollY (fase de rodadura acumulada en px), spin}`. Colores clásicos reinterpretados en la paleta (1 amarillo-oro, 2 azul, 3 rojo, 4 magenta, 5 naranja, 6 verde, 7 granate, 8 negra con "8" — la **8 es maldita**: brillo/aura rojo sutil; 9-15 rayadas con franja blanca hueso). Simula rodadura desplazando la franja/número según `rollX/rollY`. Sombreado esférico pixelado (luz arriba-izq, brillo especular). Cada grabado tiene overlay visual claro (oro brillante, cristal translúcido con reflejos, plomo gris mate, fuego con llamitas animadas, holo arcoíris ciclando, bomba con mecha).
- `OM.TABLE.drawBallShadow(ctx, x, y)` — sombra elíptica bajo la bola.
- `OM.TABLE.drawCue(ctx, cueId, tipX, tipY, angle, pull, t)` — taco de billar en pixel art (largo ~180px) apuntando con la punta en (tipX,tipY) hacia `angle` (radianes, dirección del tiro) retrocedido `pull` px. Un diseño por taco de `OM.CUES` (`peregrino` madera simple, `sangriento` rojo con púas, `usura` dorado con monedas, `hueso` vértebras). Puede pre-renderizarse y rotarse con `drawImage` (aquí se permite rotación del sprite).
- `OM.TABLE.drawAim(ctx, pts, ghost, t)` — línea de guía: puntos/tramos discontinuos animados (`pts` = array de `{x,y}`), y `ghost` = `{x,y}` bola fantasma de contacto (círculo hueco), más `opts` opcional `{objPath:[{x,y}...], cuePath:[...]}`.
- `OM.TABLE.drawPocketGlow(ctx, pocket, t, color)` — resplandor al embocar.
- `OM.TABLE.drawFog(ctx, cx, cy, radius, t)` — niebla del jefe La Niebla (oscurece todo salvo un círculo).
- `OM.TABLE.drawRackPreview(ctx, balls, x, y)` — vista de las 15 bolas del jugador en fila/triángulo (para elegir bola al grabar), cada una ~14px.

---

## Agente AUDIO → `src/audio/audio.js`

Todo **procedural con WebAudio** (sin archivos). Debe iniciarse tras primer gesto del usuario (`OM.AUDIO.unlock()`).
- `OM.AUDIO.sfx(name, opts)` — `opts = {vol, pitch, pan}`. Nombres: `clack` (bola-bola; opts.vol según velocidad), `cushion`, `pocket` (bola cae y rueda por el canal), `cue_hit` (golpe del taco; vol según potencia), `scratch`, `chips` (tic de fichas, pitch sube en secuencia), `mult` (golpe de mult), `xmult` (golpe más grave y épico), `coin`, `buy`, `sell`, `card_flip`, `card_hover`, `click`, `reroll`, `pack_open`, `boss` (sting siniestro), `win_table`, `lose`, `curse` (al meter la 8 maldita), `explosion`, `glass_break`, `level_up`, `score_total` (cuando el total supera el objetivo).
- `OM.AUDIO.music(track)` — `'menu'|'table'|'shop'|'boss'|'gameover'|null`. Música procedural oscura retro (synthwave gótico / chiptune lúgubre: bajo pulsante, pads, campanas, arpegios menores), loop sin cortes, crossfade entre pistas. Que enganche y no canse.
- `OM.AUDIO.setVolume(master, music, sfx)`, `OM.AUDIO.muted` toggle.
- `OM.AUDIO.intensity(x)` — 0..1, sube capas de la música (p.ej. cerca del objetivo / último tiro).
