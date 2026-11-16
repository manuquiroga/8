// Genera dist/ocho-maldito.html: un único HTML autocontenido (todos los scripts en línea).
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>/* ' + src + ' */\n' + code + '\n</script>';
});
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/ocho-maldito.html'), html);
console.log('dist/ocho-maldito.html', (html.length / 1024).toFixed(0) + ' KB');
// Versión para Artifact (sin doctype/html/head/body: la plataforma añade el esqueleto)
const art = html.replace(/<!doctype html>\s*/i, '').replace(/<\/?html[^>]*>/gi, '').replace(/<\/?head>/gi, '').replace(/<\/?body>/gi, '')
  .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
fs.writeFileSync(path.join(root, 'dist/ocho-maldito-artifact.html'), art.trim() + '\n');
console.log('dist/ocho-maldito-artifact.html');
