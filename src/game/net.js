// 8 — 1v1 online por sala. Transporte mínimo sin dependencias: el servidor de tools/serve.js hace de relé
// (POST para enviar, EventSource para recibir). Solo funciona si el juego se sirve desde ese servidor
// (http://<tu-ip>:8088); abierto como archivo o como artifact no hay online, pero sí bots y 2 jugadores locales.
//
// El juego es por turnos: el que tira manda sus mandos (`shoot`) y, al terminar el tiro, el estado completo
// (`sync`). La física es de paso fijo, así que el otro cliente ve el mismo tiro y luego se ajusta al estado recibido.
window.OM = window.OM || {};

OM.NET = (function () {
  const N = {
    on: false, role: null, code: null, peer: false, error: null,
    inbox: [],          // mensajes de partida (los consume la escena de mesa, en orden)
    picks: {},          // 'partida:jugador' -> id de comodín elegido por el rival
    lobby: {},          // último `hello` del rival {name, cue, ready}
    cfg: null,          // config que manda el anfitrión {mode}
    start: null,        // orden de empezar del anfitrión
  };
  let es = null, chain = Promise.resolve();

  N.available = () => typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && typeof EventSource !== 'undefined';
  N.me = () => (N.role === 'g' ? 1 : 0);

  function reset() { N.inbox = []; N.picks = {}; N.lobby = {}; N.cfg = null; N.start = null; N.peer = false; N.error = null; }
  function handle(m) {
    if (!m || !m.t) return;
    if (m.t === 'peer') { N.peer = !!m.on; if (!m.on && N.wasPeer) N.error = 'El rival se desconectó'; if (m.on) N.wasPeer = true; return; }
    if (m.t === 'hello') { N.lobby = m; return; }
    if (m.t === 'cfg') { N.cfg = m; return; }
    if (m.t === 'start') { N.start = m; return; }
    if (m.t === 'pick') { N.picks[m.match + ':' + m.pi] = m.id; return; }
    N.inbox.push(m);
  }
  function open(code, role) {
    N.close(); reset();
    N.on = true; N.role = role; N.code = code; N.wasPeer = false;
    es = new EventSource('/net/' + code + '/' + role + '/events');
    es.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch (err) { console.error('net', err); } };
    es.onerror = () => { if (es && es.readyState === 2) N.error = N.error || 'Se perdió la conexión con la sala'; };
  }
  // crea sala (anfitrión). Devuelve una promesa con el código.
  const OLD = 'El servidor no tiene salas: reinicia node tools/serve.js';
  N.host = () => fetch('/net/create', { method: 'POST' })
    .then((r) => { if (!r.ok) throw new Error(OLD); return r.json(); })
    .then((d) => { if (!d || !/^[A-Z]{4}$/.test(d.code)) throw new Error(OLD); open(d.code, 'h'); return d.code; });
  // se une a una sala existente
  N.join = (code) => {
    code = String(code || '').toUpperCase().trim();
    return fetch('/net/' + code + '/check').then((r) => r.text().then((t) => { if (!r.ok || t !== 'ok') throw new Error(r.status === 404 && t === '404' ? OLD : 'No existe la sala ' + code); open(code, 'g'); return code; }));
  };
  // envía en orden (cada POST espera al anterior)
  N.send = (m) => {
    if (!N.on) return;
    const body = JSON.stringify(m), url = '/net/' + N.code + '/' + N.role;
    chain = chain.then(() => fetch(url, { method: 'POST', body })).catch(() => { N.error = N.error || 'No se pudo enviar al rival'; });
  };
  N.close = () => { if (es) { try { es.close(); } catch (e) {} es = null; } N.on = false; N.role = null; N.code = null; N.peer = false; };
  return N;
})();
