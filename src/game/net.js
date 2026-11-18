// 8 — 1v1 online por sala, de navegador a navegador (WebRTC con PeerJS, src/vendor/peerjs.min.js).
// No necesita servidor propio: el servidor público de PeerJS solo presenta a los dos jugadores
// (y su TURN hace de puente si la conexión directa no es posible). El juego puede alojarse como sitio estático.
//
// La sala es un código de 4 letras: el anfitrión se registra como `PREFIX + código` y el invitado se conecta a ese id.
// El juego es por turnos: el que tira manda sus mandos (`shoot`) y, al terminar el tiro, el estado completo
// (`sync`). La física es de paso fijo, así que el otro cliente ve el mismo tiro y luego se ajusta al estado recibido.
window.OM = window.OM || {};

OM.NET = (function () {
  const PREFIX = 'ocho-pool-v33-'; // cambia con cada versión incompatible del protocolo (v32: modo CAOS)
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const TIMEOUT = 20; // s sin noticias del rival = desconectado
  const N = {
    on: false, role: null, code: null, peer: false, error: null,
    inbox: [],          // mensajes de partida (los consume la escena de mesa, en orden)
    shops: {},          // 'partida:jugador' -> estado del rival al salir de la tienda {jokers, money, uidN, stats}
    lobby: {},          // último `hello` del rival {name, cue, ready}
    cfg: null,          // config que manda el anfitrión {mode}
    start: null,        // orden de empezar del anfitrión
    chat: [],           // mensajes de chat del rival (los consume OM.CHAT, en cualquier escena)
  };
  let P = null, conn = null, lastSeen = 0, beat = null;

  N.available = () => typeof window.Peer === 'function' && typeof window.RTCPeerConnection === 'function';
  N.me = () => (N.role === 'g' ? 1 : 0);
  // link para invitar: (sitio)/CÓDIGO. Solo existe si el juego está publicado en una web (no como archivo suelto).
  N.link = (code) => (code && /^https?:$/.test(location.protocol) ? location.origin + '/' + code : null);
  // código de sala en la dirección con la que se abrió el juego: /ABCD o #ABCD
  N.codeFromUrl = () => {
    const m = location.pathname.match(/^\/([A-Za-z]{4})\/?$/) || location.hash.match(/^#([A-Za-z]{4})$/);
    return m ? m[1].toUpperCase() : null;
  };

  function reset() { N.inbox = []; N.chat = []; N.shops = {}; N.lobby = {}; N.cfg = null; N.start = null; N.peer = false; N.error = null; N.wasPeer = false; }
  function handle(m) {
    lastSeen = Date.now();
    if (!m || !m.t || m.t === 'ping') return;
    if (m.t === 'hello') { N.lobby = m; return; }
    if (m.t === 'cfg') { N.cfg = m; return; }
    if (m.t === 'start') { N.start = m; return; }
    if (m.t === 'shop') { N.shops[m.match + ':' + m.pi] = m.st; return; }
    if (m.t === 'chat') { if (N.chat.length < 50) N.chat.push(m); return; } // nunca a la cola de la partida
    N.inbox.push(m);
  }
  function lost(why) {
    if (!N.on) return;
    N.peer = false;
    if (N.wasPeer) N.error = N.error || why || 'El rival se desconectó';
  }
  function attach(c) {
    conn = c;
    c.on('open', () => { N.peer = true; N.wasPeer = true; lastSeen = Date.now(); });
    c.on('data', handle);
    c.on('close', () => { if (conn === c) { conn = null; lost(); } });
    c.on('error', () => { if (conn === c) lost('Se perdió la conexión con el rival'); });
  }
  function start(role, code) {
    N.on = true; N.role = role; N.code = code;
    // latido: si el canal se cae sin avisar (pasa en algunos navegadores), lo detectamos igual
    clearInterval(beat);
    beat = setInterval(() => {
      if (conn && conn.open) { try { conn.send({ t: 'ping' }); } catch (e) {} }
      if (N.peer && Date.now() - lastSeen > TIMEOUT * 1000) lost('El rival no responde');
    }, 2000);
  }
  function newPeer(id) {
    const p = id ? new window.Peer(id, { debug: 0 }) : new window.Peer({ debug: 0 });
    // si se cae la conexión con el servidor de presentación, la partida sigue (el canal es directo); reintentamos igual
    p.on('disconnected', () => { if (P === p && !p.destroyed) { try { p.reconnect(); } catch (e) {} } });
    return p;
  }
  const msgOf = (err) => ({
    'browser-incompatible': 'Tu navegador no permite el online',
    network: 'No se pudo conectar con el servidor de salas',
    'server-error': 'El servidor de salas no responde',
    'socket-error': 'No se pudo conectar con el servidor de salas',
    'socket-closed': 'Se cerró la conexión con el servidor de salas',
    'peer-unavailable': 'No existe la sala',
  }[err && err.type] || 'Error de conexión (' + ((err && err.type) || '?') + ')');

  // crea sala (anfitrión). Devuelve una promesa con el código.
  N.host = () => new Promise((resolve, reject) => {
    N.close(); reset();
    let tries = 0;
    const attempt = () => {
      let code = ''; for (let i = 0; i < 4; i++) code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
      const p = P = newPeer(PREFIX + code);
      let opened = false;
      p.on('open', () => { opened = true; start('h', code); resolve(code); });
      p.on('connection', (c) => {
        if (conn && conn.open) { c.on('open', () => c.close()); return; } // la sala ya tiene rival
        attach(c);
      });
      p.on('error', (err) => {
        if (!opened && err.type === 'unavailable-id' && tries++ < 5) { p.destroy(); attempt(); return; } // código ocupado: otro
        if (!opened) { p.destroy(); P = null; reject(new Error(msgOf(err))); return; }
        if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') return; // no corta la partida
        lost(msgOf(err));
      });
    };
    attempt();
  });

  // se une a una sala existente
  // Si la sala no aparece se reintenta un par de veces (el anfitrión puede estar recién conectándose).
  N.join = (code) => new Promise((resolve, reject) => {
    code = String(code || '').toUpperCase().trim();
    N.close(); reset();
    const p = P = newPeer(null);
    let done = false, tries = 0, timer = null;
    const fail = (msg) => { if (done) return; done = true; clearTimeout(timer); p.destroy(); P = null; N.on = false; reject(new Error(msg)); };
    const dial = () => {
      const c = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      attach(c);
      c.on('open', () => { if (done) return; done = true; clearTimeout(timer); start('g', code); resolve(code); });
    };
    p.on('open', () => { dial(); timer = setTimeout(() => fail('No se pudo conectar con la sala ' + code), 20000); });
    p.on('error', (err) => {
      if (!done && err.type === 'peer-unavailable' && tries++ < 2) { setTimeout(() => { if (!done) dial(); }, 1500); return; }
      if (!done) fail(err.type === 'peer-unavailable' ? 'La sala ' + code + ' no está abierta: el anfitrión tiene que seguir en la sala' : msgOf(err));
      else if (err.type !== 'network' && err.type !== 'server-error' && err.type !== 'socket-error' && err.type !== 'socket-closed') lost(msgOf(err));
    });
  });

  // envía al rival (el canal es fiable y ordenado). Sin rival conectado, el mensaje se pierde.
  N.send = (m) => {
    if (!N.on || !conn || !conn.open) return;
    try { conn.send(m); } catch (e) { N.error = N.error || 'No se pudo enviar al rival'; }
  };
  N.close = () => {
    clearInterval(beat); beat = null;
    if (conn) { try { conn.close(); } catch (e) {} conn = null; }
    if (P) { try { P.destroy(); } catch (e) {} P = null; }
    N.on = false; N.role = null; N.code = null; N.peer = false;
  };
  return N;
})();
