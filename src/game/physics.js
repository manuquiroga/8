// 8 — física de billar 2D (arcade).
// Bolas como círculos con masa; bandas = bordes del paño con aberturas en las troneras;
// "mandíbulas" de tronera = puntos de colisión donde termina cada banda.
// v3.0: paso fijo (determinista, para el 1v1 online), elevación del taco (salto y massé),
// obstáculos (pilares, vórtice, portales) y predicción del tiro simulando la blanca.
window.OM = window.OM || {};

OM.Physics = (function () {
  const L = OM.LAYOUT;
  const TICK = 1 / 120;     // paso fijo de simulación
  const DECEL = 95;         // px/s² fricción de rodadura
  const DAMP = 0.09;        // amortiguación lineal (1/s)
  const STOP = 5;           // px/s → se detiene
  const E_BALL = 0.95, E_CUSH = 0.8;
  const MAXV = 1050;
  // efecto del taco
  const SPIN_FOLLOW = 0.8;  // fracción de la velocidad de llegada que el efecto vertical devuelve/añade a la blanca
  const SPIN_SIDE = 0.45;   // desvío lateral en la primera(s) banda(s)
  const POCKET_PULL = 140;  // px/s² las troneras "chupan" suavemente las bolas lentas
  // elevación del taco
  const GRAV = 900;         // px/s² (altura z, solo visual + colisiones)
  const JUMP_MIN = 0.4;     // elevación mínima para saltar
  const JUMP_K = 0.3, JUMP_VZ_MAX = 210;
  const CLEAR_Z = 5;        // por encima de esta altura la bola pasa sobre las demás
  const MASSE_K = 4.2;      // rad/s de giro de la trayectoria con efecto lateral y elevación al máximo
  const MASSE_TAU = 0.5;    // s que tarda en apagarse la curva

  function create(opts) {
    opts = opts || {};
    const W = {
      balls: [], pockets: [], jaws: [], t: 0, acc: 0, shots: 0,
      seed: opts.seed || 1,
      decel: DECEL * (opts.frictionMul || 1),
      pocketMul: opts.pocketMul || 1,
      pocketPull: opts.pocketPull || 1,
      sealedSides: !!opts.sealedSides,
      noScratch: !!opts.noScratch,
      tilt: opts.tilt || 0,
      bumpers: opts.bumpers || [],     // [{x,y,r}]
      vortex: opts.vortex || null,     // {x,y,r,k}
      portals: opts.portals || null,   // [{x,y,r},{x,y,r}]
      breakPending: 0, bomb: false,
      events: [],
    };
    setPockets(W);
    return W;
  }

  function setPockets(W) {
    const F = L.felt;
    let src = OM.TABLE && OM.TABLE.pockets ? OM.TABLE.pockets() : null;
    if (!src || src.length !== 6) {
      src = [
        { x: F.x - 1, y: F.y - 1, corner: true }, { x: F.x + F.w / 2, y: F.y - 3, corner: false },
        { x: F.x + F.w + 1, y: F.y - 1, corner: true }, { x: F.x - 1, y: F.y + F.h + 1, corner: true },
        { x: F.x + F.w / 2, y: F.y + F.h + 3, corner: false }, { x: F.x + F.w + 1, y: F.y + F.h + 1, corner: true },
      ];
    }
    W.pockets = src.map((p, i) => ({ x: p.x, y: p.y, corner: !!p.corner, id: p.id || i, sealed: W.sealedSides && !p.corner }));
    W.pockets.forEach((p) => {
      p.r = L.pocketR * W.pocketMul;
      p.mouth = p.r * (p.corner ? 1.55 : 1.3);
    });
    // mandíbulas: intersección del círculo de boca con las líneas de banda
    W.jaws = [];
    const lines = [
      { axis: 'y', v: F.y, min: F.x, max: F.x + F.w }, { axis: 'y', v: F.y + F.h, min: F.x, max: F.x + F.w },
      { axis: 'x', v: F.x, min: F.y, max: F.y + F.h }, { axis: 'x', v: F.x + F.w, min: F.y, max: F.y + F.h },
    ];
    W.pockets.forEach((p) => {
      if (p.sealed) return;
      lines.forEach((ln) => {
        const d = ln.axis === 'y' ? ln.v - p.y : ln.v - p.x;
        if (Math.abs(d) >= p.mouth) return;
        const h = Math.sqrt(p.mouth * p.mouth - d * d);
        const c = ln.axis === 'y' ? p.x : p.y;
        [c - h, c + h].forEach((u) => {
          if (u < ln.min - 1 || u > ln.max + 1) return;
          W.jaws.push(ln.axis === 'y' ? { x: u, y: ln.v } : { x: ln.v, y: u });
        });
      });
    });
  }

  function addBall(W, b) {
    const ball = Object.assign({ vx: 0, vy: 0, z: 0, vz: 0, r: L.ballR, m: 1, rollX: 0, rollY: 0, alive: true, sink: 0, curve: 0, tp: 0 }, b);
    W.balls.push(ball);
    return ball;
  }

  function inMouth(W, b) {
    for (const p of W.pockets) {
      if (p.sealed) continue;
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < p.mouth * p.mouth) return p;
    }
    return null;
  }

  function moving(W) {
    for (const b of W.balls) if (b.alive && (b.vx || b.vy || b.z > 0)) return true;
    for (const b of W.balls) if (b.sinking) return true;
    return false;
  }

  function emit(W, e) { W.events.push(e); }

  // Avanza el tiempo real `dt` en pasos fijos (el resultado no depende de los FPS).
  function step(W, dt) {
    W.acc += dt;
    let n = 0;
    while (W.acc >= TICK && n < 12) { tick(W); W.acc -= TICK; n++; }
    if (n >= 12) W.acc = 0;
  }

  function tick(W) {
    const dt = TICK;
    W.t += dt;
    for (const b of W.balls) if (b.sinking) {
      b.sink += dt * 4;
      b.x += (b.sinkTo.x - b.x) * Math.min(1, dt * 14);
      b.y += (b.sinkTo.y - b.y) * Math.min(1, dt * 14);
      if (b.sink >= 1) { b.sinking = false; }
    }
    let maxv = 0;
    for (const b of W.balls) if (b.alive) { const v = Math.hypot(b.vx, b.vy); if (v > maxv) maxv = v; }
    if (maxv === 0) { let air = false; for (const b of W.balls) if (b.alive && b.z > 0) air = true; if (!air) return; }
    const n = Math.max(1, Math.ceil((maxv * dt) / 1.5));
    const h = dt / n;
    for (let s = 0; s < n; s++) substep(W, h);
  }

  function substep(W, h) {
    const F = L.felt;
    const balls = W.balls;
    // integrar
    for (const b of balls) {
      if (!b.alive) continue;
      if (b.tp > 0) b.tp -= h;
      const air = b.z > 0;
      if (air) {
        b.vz -= GRAV * h; b.z += b.vz * h;
        if (b.z <= 0) {
          const hard = b.vz < -110;
          emit(W, { type: 'land', ball: b, x: b.x, y: b.y, speed: -b.vz });
          if (hard) { b.vz = -b.vz * 0.3; b.z = 0.01; } else { b.vz = 0; b.z = 0; }
        }
      }
      const mv = b.vx || b.vy;
      if (!air && mv) {
        if (W.tilt) {
          b.vx += Math.sin(W.t * 1.3) * W.tilt * h;
          b.vy += Math.cos(W.t * 0.9) * W.tilt * 0.4 * h;
        }
        // massé: el efecto lateral con el taco elevado va girando la trayectoria
        if (b.curve) {
          const a = b.curve * h, c = Math.cos(a), s = Math.sin(a);
          const vx = b.vx * c - b.vy * s, vy = b.vx * s + b.vy * c;
          b.vx = vx; b.vy = vy;
          b.curve *= 1 - h / MASSE_TAU;
          if (Math.abs(b.curve) < 0.05) b.curve = 0;
        }
        // vórtice: desvía (gira la velocidad, no añade energía) y tira un poco hacia dentro
        const V = W.vortex;
        if (V) {
          const dx = V.x - b.x, dy = V.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < V.r * V.r && d2 > 4) {
            const d = Math.sqrt(d2), k = 1 - d / V.r;
            const a = V.k * k * h, c = Math.cos(a), s = Math.sin(a);
            const vx = b.vx * c - b.vy * s, vy = b.vx * s + b.vy * c;
            b.vx = vx + (dx / d) * 60 * k * h; b.vy = vy + (dy / d) * 60 * k * h;
          }
        }
        // atracción de tronera (no a la blanca: no queremos regalar faltas)
        if (b.num !== 0) {
          for (const p of W.pockets) {
            if (p.sealed) continue;
            const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy, R = p.mouth * 1.7;
            if (d2 < R * R && d2 > 1) {
              const d = Math.sqrt(d2), k = POCKET_PULL * W.pocketPull * (1 - d / R) * h;
              b.vx += (dx / d) * k; b.vy += (dy / d) * k;
            }
          }
        }
      }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) {
        if (!air) {
          const nsp = Math.max(0, sp - (W.decel + DAMP * sp) * h);
          if (nsp < STOP) { b.vx = b.vy = 0; b.curve = 0; }
          else { const k = nsp / sp; b.vx *= k; b.vy *= k; }
        }
        b.x += b.vx * h; b.y += b.vy * h;
        b.rollX += b.vx * h; b.rollY += b.vy * h;
      }
      // portales
      if (W.portals && !air && sp > 0 && b.tp <= 0) {
        for (let i = 0; i < 2; i++) {
          const A = W.portals[i], B = W.portals[1 - i];
          const dx = b.x - A.x, dy = b.y - A.y;
          if (dx * dx + dy * dy < A.r * A.r) {
            emit(W, { type: 'portal', ball: b, x: A.x, y: A.y, tx: B.x, ty: B.y });
            b.x = B.x; b.y = B.y; b.tp = 0.35;
            break;
          }
        }
      }
    }
    // bola-bola
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (!a.alive) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]; if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        if (a.z > CLEAR_Z || b.z > CLEAR_Z) {
          // una bola en el aire pasa por encima: se registra el salto sobre esa bola (una vez por bola)
          const h = a.z > CLEAR_Z ? a : b, o = h === a ? b : a;
          if (h.hops && !h.hops[o.num]) { h.hops[o.num] = 1; emit(W, { type: 'hop', ball: h, over: o, x: o.x, y: o.y }); }
          continue;
        }
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        // separar
        const overlap = rr - d, tm = a.m + b.m;
        a.x -= nx * overlap * (b.m / tm); a.y -= ny * overlap * (b.m / tm);
        b.x += nx * overlap * (a.m / tm); b.y += ny * overlap * (a.m / tm);
        const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rv <= 0) continue;
        // efecto vertical: se aplica en el primer contacto de la blanca
        const cue = a.num === 0 && a.spinF ? a : b.num === 0 && b.spinF ? b : null;
        let dirx = 0, diry = 0, cueSp = 0;
        if (cue) { cueSp = Math.hypot(cue.vx, cue.vy); if (cueSp) { dirx = cue.vx / cueSp; diry = cue.vy / cueSp; } }
        const jimp = ((1 + E_BALL) * rv) / (1 / a.m + 1 / b.m);
        a.vx -= (jimp / a.m) * nx; a.vy -= (jimp / a.m) * ny;
        b.vx += (jimp / b.m) * nx; b.vy += (jimp / b.m) * ny;
        if (cue && cueSp) {
          const k = cue.spinF * SPIN_FOLLOW * rv;
          cue.vx += dirx * k; cue.vy += diry * k;
          cue.spinF = 0;
        }
        if (a.num === 0) a.curve *= 0.3; if (b.num === 0) b.curve *= 0.3;
        emit(W, { type: 'hit', a, b, speed: rv, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ax: a.x, ay: a.y, bx: b.x, by: b.y, avx: a.vx, avy: a.vy, bvx: b.vx, bvy: b.vy });
        if (a.num === 0 || b.num === 0) {
          // saque: dispersa el triángulo (determinista por semilla) · dinamita: explota en el primer contacto
          if (W.breakPending) { const p = W.breakPending; W.breakPending = 0; breakBoost(W, a.num === 0 ? a : b, p); }
          if (W.bomb) { W.bomb = false; const c = a.num === 0 ? a : b; explode(W, c.x, c.y, 85, 620, c); emit(W, { type: 'explosion', x: c.x, y: c.y }); }
        }
      }
    }
    // pilares
    for (const P of W.bumpers) {
      for (const b of balls) {
        if (!b.alive) continue;
        const dx = b.x - P.x, dy = b.y - P.y, rr = P.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        b.x = P.x + nx * rr; b.y = P.y + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          // rebote vivo estilo pinball si llega con fuerza
          const out = -vn > 40 ? -vn * 1.05 + 50 : -vn * 0.8;
          b.vx += (out - vn) * nx; b.vy += (out - vn) * ny;
          b.curve *= 0.5;
          emit(W, { type: 'bumper', ball: b, speed: -vn, x: P.x + nx * P.r, y: P.y + ny * P.r, bumper: P });
        }
      }
    }
    // bandas, mandíbulas y troneras
    for (const b of balls) {
      if (!b.alive) continue;
      const high = b.z > CLEAR_Z;
      const mouth = high ? null : inMouth(W, b);
      if (!mouth) {
        let hit = false, sp = 0;
        const pvx = b.vx, pvy = b.vy;
        if (b.x < F.x + b.r) { b.x = F.x + b.r; if (b.vx < 0) { sp = -b.vx; b.vx = -b.vx * E_CUSH; b.vy *= 0.94; hit = true; } }
        if (b.x > F.x + F.w - b.r) { b.x = F.x + F.w - b.r; if (b.vx > 0) { sp = b.vx; b.vx = -b.vx * E_CUSH; b.vy *= 0.94; hit = true; } }
        if (b.y < F.y + b.r) { b.y = F.y + b.r; if (b.vy < 0) { sp = -b.vy; b.vy = -b.vy * E_CUSH; b.vx *= 0.94; hit = true; } }
        if (b.y > F.y + F.h - b.r) { b.y = F.y + F.h - b.r; if (b.vy > 0) { sp = b.vy; b.vy = -b.vy * E_CUSH; b.vx *= 0.94; hit = true; } }
        if (hit && b.spinS) {
          // efecto lateral: abre/cierra el ángulo de salida de la banda (a la derecha del avance si spinS>0)
          const ps = Math.hypot(pvx, pvy) || 1, px = -pvy / ps, py = pvx / ps;
          const k = b.spinS * SPIN_SIDE * sp;
          b.vx += px * k; b.vy += py * k;
          b.spinS *= 0.4; if (Math.abs(b.spinS) < 0.05) b.spinS = 0;
        }
        if (hit) { b.curve *= 0.5; emit(W, { type: 'cushion', ball: b, speed: sp, x: b.x, y: b.y }); }
      } else {
        // mandíbulas
        for (const j of W.jaws) {
          const dx = b.x - j.x, dy = b.y - j.y, d2 = dx * dx + dy * dy;
          if (d2 < b.r * b.r && d2 > 0) {
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
            b.x = j.x + nx * b.r; b.y = j.y + ny * b.r;
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) {
              b.vx -= (1 + E_CUSH * 0.8) * vn * nx; b.vy -= (1 + E_CUSH * 0.8) * vn * ny;
              emit(W, { type: 'cushion', ball: b, speed: -vn, x: b.x, y: b.y, jaw: true });
            }
          }
        }
        // captura: dentro del radio o habiendo cruzado la línea de banda en la boca
        const dx = b.x - mouth.x, dy = b.y - mouth.y;
        const outside = b.x < F.x - 1 || b.x > F.x + F.w + 1 || b.y < F.y - 1 || b.y > F.y + F.h + 1;
        if (dx * dx + dy * dy < mouth.r * mouth.r || outside) {
          if (b.num === 0 && W.noScratch) {
            // la blanca fantasma rebota hacia el centro
            const cx = F.x + F.w / 2, cy = F.y + F.h / 2;
            const ang = Math.atan2(cy - b.y, cx - b.x), sp = Math.max(120, Math.hypot(b.vx, b.vy) * 0.6);
            b.x = mouth.x + Math.cos(ang) * (mouth.mouth + b.r); b.y = mouth.y + Math.sin(ang) * (mouth.mouth + b.r);
            b.x = Math.min(Math.max(b.x, F.x + b.r), F.x + F.w - b.r); b.y = Math.min(Math.max(b.y, F.y + b.r), F.y + F.h - b.r);
            b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
            emit(W, { type: 'ghostBounce', ball: b, x: b.x, y: b.y });
            continue;
          }
          b.alive = false; b.sinking = true; b.sink = 0; b.sinkTo = { x: mouth.x, y: mouth.y };
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = b.vy = 0; b.z = 0; b.vz = 0; b.curve = 0;
          emit(W, { type: 'pocket', ball: b, pocket: mouth, speed: sp, x: mouth.x, y: mouth.y });
        }
      }
      // red de seguridad
      if (b.alive && (b.x < F.x - 30 || b.x > F.x + F.w + 30 || b.y < F.y - 30 || b.y > F.y + F.h + 30)) {
        b.x = Math.min(Math.max(b.x, F.x + b.r), F.x + F.w - b.r);
        b.y = Math.min(Math.max(b.y, F.y + b.r), F.y + F.h - b.r);
        b.vx = b.vy = 0;
      }
    }
  }

  // Golpe sobre la blanca.
  // spin = {f: -1 (retroceso) .. 1 (seguimiento), s: -1 (izq) .. 1 (der)}
  // elev = 0..1 (taco horizontal .. casi vertical). Con efecto lateral curva la trayectoria (massé);
  // al centro y con fuerza hace saltar la blanca. trickMul escala ambos (Taco de Hueso).
  // Devuelve {jump, curve} para que el juego sepa qué truco se intentó.
  function shoot(W, cue, angle, power, spin, elev, trickMul) {
    const v = Math.min(MAXV * 1.45, power);
    const E = Math.min(1, Math.max(0, elev || 0)), tm = trickMul || 1;
    const f = spin ? spin.f || 0 : 0, s = spin ? spin.s || 0 : 0;
    const vh = v * (1 - 0.45 * E);
    cue.vx = Math.cos(angle) * vh; cue.vy = Math.sin(angle) * vh;
    cue.spinF = Math.max(-1.6, Math.min(1.6, f * (1 + 0.6 * E)));
    cue.spinS = s;
    cue.curve = E > 0.05 && Math.abs(s) >= 0.15 ? s * E * MASSE_K * tm : 0;
    const jump = E >= JUMP_MIN && Math.abs(s) < 0.35;
    cue.vz = jump ? Math.min(JUMP_VZ_MAX, 70 + v * E * JUMP_K) * tm : 0;
    cue.z = jump ? 0.01 : 0;
    cue.hops = {};
    W.t = 0; W.acc = 0; W.shots++;
    return { jump, curve: cue.curve };
  }
  // ¿qué truco saldría con estos mandos? (para la interfaz)
  function trickOf(spin, elev) {
    const E = elev || 0, s = Math.abs(spin ? spin.s || 0 : 0);
    if (E >= JUMP_MIN && s < 0.35) return 'salto';
    if (E > 0.05 && s >= 0.15) return 'masse';
    if (E > 0.05 && spin && spin.f < -0.1) return 'pique';
    return null;
  }

  // Explosión (dinamita, terremoto)
  function explode(W, x, y, radius, force, skip) {
    for (const b of W.balls) {
      if (!b.alive || b === skip) continue;
      const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
      if (d < radius && d > 0.01) {
        const k = force * (1 - d / radius);
        b.vx += (dx / d) * k; b.vy += (dy / d) * k;
      }
    }
  }
  // Terremoto: empujón al azar (por semilla) a todas las bolas menos la blanca
  function quake(W, force) {
    const rng = OM.RNG((W.seed + 104729 * (W.shots + 1)) >>> 0);
    W.shots++; W.t = 0; W.acc = 0;
    for (const b of W.balls) {
      if (!b.alive || b.num === 0) continue;
      const a = rng() * Math.PI * 2, k = force * (0.5 + rng() * 0.5);
      b.vx += Math.cos(a) * k; b.vy += Math.sin(a) * k;
    }
  }

  // Impulso de saque (arcade): ayuda a abrir el triángulo. v3.0: mucho más suave que antes y
  // determinista (semilla de la mesa + nº de tiro), así el saque ya no decide la partida ni sale siempre igual.
  function breakBoost(W, cue, power) {
    const rng = OM.RNG((W.seed + 7919 * W.shots) >>> 0);
    cue.vx *= 0.35; cue.vy *= 0.35;
    const objs = W.balls.filter((b) => b.alive && b !== cue);
    if (!objs.length) return;
    const cx = objs.reduce((a, b) => a + b.x, 0) / objs.length, cy = objs.reduce((a, b) => a + b.y, 0) / objs.length;
    for (const b of objs) {
      let dx = b.x - cx, dy = b.y - cy; const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const a = Math.atan2(dy, dx) + (rng() - 0.5) * 1.1;
      const k = (40 + rng() * 150) * power * (0.4 + Math.min(1, d / 25));
      b.vx += Math.cos(a) * k; b.vy += Math.sin(a) * k;
    }
  }

  // ¿Posición libre para colocar una bola?
  function freeSpot(W, x, y, r, ignore) {
    const F = L.felt;
    if (x < F.x + r || x > F.x + F.w - r || y < F.y + r || y > F.y + F.h - r) return false;
    for (const b of W.balls) {
      if (!b.alive || b === ignore) continue;
      if (Math.hypot(b.x - x, b.y - y) < b.r + r + 0.5) return false;
    }
    for (const P of W.bumpers) if (Math.hypot(P.x - x, P.y - y) < P.r + r + 0.5) return false;
    if (W.portals) for (const P of W.portals) if (Math.hypot(P.x - x, P.y - y) < P.r + r + 1) return false;
    return true;
  }

  // Copia independiente del mundo (para predecir tiros y para los bots). No comparte bolas ni eventos.
  function clone(W) {
    return Object.assign({}, W, { balls: W.balls.map((b) => Object.assign({}, b, { sinking: false })), events: [], acc: 0 });
  }
  // Simula hasta que todo se detiene (o maxT segundos). onEvent(e) recibe cada evento.
  function run(W, maxT, onEvent) {
    const n = Math.ceil((maxT || 12) / TICK);
    for (let i = 0; i < n; i++) {
      tick(W);
      if (W.events.length) { if (onEvent) for (const e of W.events) onEvent(e); W.events.length = 0; }
      if (!moving(W)) break;
    }
  }

  // Predicción de la guía: simula la blanca con los mandos actuales hasta su primer contacto.
  // Devuelve {pts:[{x,y,z,brk}], ghost, target, objDir:{x,y,k}, cueDir:{x,y,k}, scratch}
  // opts: {maxBounces, maxLen, trickMul}
  function predict(W, cue, angle, power, spin, elev, opts) {
    opts = opts || {};
    const P = clone(W);
    P.breakPending = 0; P.bomb = false;
    const ci = W.balls.indexOf(cue), c = P.balls[ci];
    shoot(P, c, angle, power, spin, elev, opts.trickMul);
    const maxB = opts.maxBounces || 0, maxLen = opts.maxLen || 380;
    const pts = [{ x: c.x, y: c.y, z: 0 }];
    const out = { pts, ghost: null, target: null, scratch: false };
    let len = 0, bounces = 0, lx = c.x, ly = c.y;
    for (let i = 0; i < 420; i++) {
      tick(P);
      let stop = false, brk = false;
      for (const e of P.events) {
        if (e.type === 'hit' && (e.a === c || e.b === c)) {
          const isA = e.a === c, o = isA ? e.b : e.a;
          const gx = isA ? e.ax : e.bx, gy = isA ? e.ay : e.by;
          const ovx = isA ? e.bvx : e.avx, ovy = isA ? e.bvy : e.avy, cvx = isA ? e.avx : e.bvx, cvy = isA ? e.avy : e.bvy;
          const os = Math.hypot(ovx, ovy) || 1, cs = Math.hypot(cvx, cvy), tot = os + cs || 1;
          out.ghost = { x: gx, y: gy };
          out.target = W.balls[P.balls.indexOf(o)];
          out.objDir = { x: ovx / os, y: ovy / os, k: os / tot };
          out.cueDir = cs > 1 ? { x: cvx / cs, y: cvy / cs, k: cs / tot } : { x: 0, y: 0, k: 0 };
          pts.push({ x: gx, y: gy, z: 0 });
          return out;
        }
        if (e.ball === c) {
          if (e.type === 'cushion' && !e.jaw) { bounces++; pts.push({ x: e.x, y: e.y, z: c.z }); if (bounces > maxB) stop = true; }
          else if (e.type === 'bumper') { bounces++; pts.push({ x: c.x, y: c.y, z: 0 }); if (bounces > maxB + 1) stop = true; }
          else if (e.type === 'pocket') { out.scratch = true; pts.push({ x: e.x, y: e.y, z: 0 }); stop = true; }
          else if (e.type === 'ghostBounce') stop = true;
          else if (e.type === 'portal') { pts.push({ x: e.x, y: e.y, z: 0 }); brk = true; }
        }
      }
      P.events.length = 0;
      if (stop) break;
      if (brk) { pts.push({ x: c.x, y: c.y, z: 0, brk: true }); lx = c.x; ly = c.y; continue; }
      len += Math.hypot(c.x - lx, c.y - ly); lx = c.x; ly = c.y;
      if (i % 2 === 1 || c.z > 0) pts.push({ x: c.x, y: c.y, z: c.z });
      if (len > maxLen || !(c.vx || c.vy)) { pts.push({ x: c.x, y: c.y, z: c.z }); break; }
    }
    return out;
  }

  // estado mínimo de las bolas (para sincronizar el online)
  function snap(W) {
    return W.balls.map((b) => ({ num: b.num, x: Math.round(b.x * 1000) / 1000, y: Math.round(b.y * 1000) / 1000, alive: b.alive, kind: b.kind || 'normal' }));
  }
  function restore(W, arr) {
    arr.forEach((s) => {
      const b = W.balls.find((o) => o.num === s.num); if (!b) return;
      if (b.alive !== s.alive) { b.alive = s.alive; b.sinking = false; b.sink = s.alive ? 0 : 1; }
      if (s.alive) { b.x = s.x; b.y = s.y; }
      b.vx = b.vy = 0; b.z = 0; b.vz = 0; b.curve = 0; b.kind = s.kind;
    });
  }

  return { TICK, MAXV, JUMP_MIN, CLEAR_Z, create, addBall, step, tick, shoot, trickOf, moving, explode, quake, freeSpot, clone, run, predict, setPockets, snap, restore };
})();
