# Registro de partidas (telemetría local)

Objetivo: saber **qué pasa en cada partida** para detectar comodines rotos o inútiles, mesas demasiado difíciles o fáciles, problemas de economía y bugs. Todo es local (localStorage) y exportable a JSON. No se envía nada a ningún servidor.

## Piezas
| Archivo | Qué hace |
|---|---|
| `src/game/telemetry.js` (`OM.LOG`) | Registra la partida en `R.log`, que se guarda y continúa junto con la partida. Al terminar la archiva en `localStorage['om_logs']` (últimas 300; si se llena, se descartan primero las del bot). |
| `src/game/analytics.js` (`OM.Analytics`) | Función pura `aggregate(runs)` que calcula métricas y banderas, y `report()` que genera el informe de texto. |
| `src/game/scene_stats.js` | Pantalla **REGISTRO** (título → REGISTRO) con las pestañas Resumen, Banderas, Comodines, Mesas y Partidas, el filtro Todas/Mías/Bot y los botones Exportar, Importar y Borrar. |
| `tools/bot.js` | Bot que juega N partidas en Node con la lógica real y escribe registros en el mismo formato. |
| `tools/analyze.js` | Informe de un JSON exportado o generado por el bot. |

## Qué se registra
- **Partida**: semilla, taco, origen (`human`, `replay` o `bot`), inicio y fin, minutos de juego, resultado (`lose`, `quit` o `victory`), hasta dónde llegó, **valoración** (fácil/justa/difícil, desde la pantalla final), errores de consola y foto final (comodines, consumibles, niveles de tiro, grabados, dinero).
- **Mesa**: círculo, tipo, jefe, objetivo, puntaje, tiros iniciales, usados y sobrantes, tiros recuperados, consumibles usados, comodines en mesa, dinero antes y cobro, duración, y si se abandonó.
- **Tiro**: bolas (`10B` = tras banda, `L` = tronera lateral, `:oro` = grabado), tipo, fichas, mult, total, falta o maldición, racha, efecto (`spinF`/`spinS`), bandas y contactos de la blanca, potencia, dinero, y **`contrib`: cuánto aportó cada comodín** (total real − total recalculado sin ese comodín).
- **Tienda**: dinero al entrar y al salir, todo lo ofrecido (incluidos los rerolls), compras, ventas, rerolls, sobres (opciones y elegido o saltado).
- **Dinero**: línea de tiempo `[segundos, $, motivo, delta]`.

## Banderas
| Bandera | Criterio |
|---|---|
| ROTO (comodín) | Aporta ≥65% de los puntos donde está, **o** quien lo consigue supera 2+ mesas más que quien llegó al mismo punto sin él (corrige el sesgo de supervivencia). |
| INÚTIL | Aporta <3% y no mejora el avance. |
| IGNORADO | Se ofreció 10+ veces y casi nunca se compra. |
| DIFÍCIL / FÁCIL (mesa) | Se supera <50% de las veces / ≥95% de las veces con puntaje ≥2,5× el objetivo. |
| FALTAS, DOBLETES, AHORRO | Más de 12% de faltas, menos de 3% de tiros con 2+ bolas, o morir con >$15 sin gastar. |

Ojo: un comodín de x2 Mult siempre "aporta" alrededor del 50% por pura aritmética. Por eso el umbral de aporte es alto y conviene mirar también el **avance**.

## Uso
```
node tools/bot.js --runs 500 --skill medio --policy greedy --out dist/registro-bot.json
node tools/analyze.js registro-8-2026-11-16.json --source human
```
- `--skill flojo|medio|bueno` · `--policy greedy|interes|ahorro` · `--cue <id>|todos`.
- El bot **no simula la física tiro a tiro**: usa distribuciones medidas con la física real, ajustadas por troneras y jefes. Sirve para la economía y los comodines de puntuación; los comodines que dependen de la física (Ojo de Cuervo, Imán, efecto) se juzgan mejor con partidas reales.
- **Repetir semilla** (pantalla final) vuelve a jugar con la misma semilla y el mismo taco: tienda y jefes iguales. Sirve para comparar decisiones.
