// Servidor del juego sin dependencias: node tools/serve.js [puerto]
//  - sirve los archivos estáticos
//  - hace de relé para el 1v1 online (salas con código): ver src/game/net.js
//      POST /net/create               -> {code}
//      GET  /net/<code>/check         -> 200 si la sala existe
//      GET  /net/<code>/<h|g>/events  -> EventSource con los mensajes del otro jugador
//      POST /net/<code>/<h|g>         -> reenvía el cuerpo (JSON) al otro jugador
// Para jugar con alguien fuera de tu red hay que exponer este puerto (túnel o redirección de puertos).
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.resolve(__dirname, '..'), port = +process.argv[2] || 8088;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const rooms = new Map(); // code -> {h:{res,queue}, g:{res,queue}, t}
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() { let c; do { c = ''; for (let i = 0; i < 4; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)]; } while (rooms.has(c)); return c; }
function push(side, data) {
  if (side.res) side.res.write('data: ' + data + '\n\n');
  else if (side.queue.length < 500) side.queue.push(data);
}
setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) {
    if (!r.h.res && !r.g.res && now - r.t > 10 * 60e3) rooms.delete(code);
    else ['h', 'g'].forEach((k) => { if (r[k].res) r[k].res.write(': ping\n\n'); });
  }
}, 20e3).unref();

function net(req, res, parts) {
  if (req.method === 'POST' && parts[1] === 'create') {
    const code = newCode();
    rooms.set(code, { h: { res: null, queue: [] }, g: { res: null, queue: [] }, t: Date.now() });
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ code }));
  }
  const room = rooms.get(parts[1]);
  if (!room) { res.writeHead(404); return res.end('no room'); }
  if (parts[2] === 'check') { res.writeHead(200); return res.end('ok'); }
  const role = parts[2], other = role === 'h' ? 'g' : 'h';
  if (role !== 'h' && role !== 'g') { res.writeHead(400); return res.end(); }
  room.t = Date.now();
  if (req.method === 'GET' && parts[3] === 'events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(': ok\n\n');
    const me = room[role];
    if (me.res) { try { me.res.end(); } catch (e) {} }
    me.res = res;
    me.queue.splice(0).forEach((d) => res.write('data: ' + d + '\n\n'));
    if (room[other].res) { push(me, '{"t":"peer","on":true}'); push(room[other], '{"t":"peer","on":true}'); }
    req.on('close', () => { if (me.res === res) { me.res = null; if (room[other].res) push(room[other], '{"t":"peer","on":false}'); } });
    return;
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => { try { JSON.parse(body); push(room[other], body); res.writeHead(200); res.end('ok'); } catch (e) { res.writeHead(400); res.end('bad'); } });
    return;
  }
  res.writeHead(400); res.end();
}

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  const parts = p.split('/').filter(Boolean);
  if (parts[0] === 'net') return net(req, res, parts);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
}).listen(port, () => {
  console.log('http://localhost:' + port);
  Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).forEach((n) => console.log('en tu red: http://' + n.address + ':' + port));
});
