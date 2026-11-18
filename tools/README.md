# Herramientas
- `node tools/shot.js tools/preview_X.html /ruta/salida.png 2` — captura de una página de preview (file://). Revisa la imagen con la herramienta Read.
- Páginas de preview: `tools/preview_*.html`. Cada una carga `src/core/px.js`, el módulo a revisar, ejecuta `OM.ART_INIT` y pinta una hoja de contacto en un canvas 640x360 (CSS escalado x1, la captura usa deviceScaleFactor).
- `tools/preview_caos.html`: arte de las cartas del modo CAOS.
