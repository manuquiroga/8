// Servidor estático sin dependencias para desarrollo: node tools/serve.js [puerto]
// El online no necesita servidor propio (PeerJS, ver src/game/net.js); esto solo sirve los archivos.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.resolve(__dirname, '..'), port = +process.argv[2] || +process.env.PORT || 8088;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
}).listen(port, () => {
  console.log('http://localhost:' + port);
  Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).forEach((n) => console.log('en tu red: http://' + n.address + ':' + port));
});
