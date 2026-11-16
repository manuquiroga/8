// 8 — física de billar 2D.
// Bolas como círculos con masa; bandas = bordes del paño con aberturas en las troneras;
// "mandíbulas" de tronera = puntos de colisión donde termina cada banda.
window.OM = window.OM || {};

OM.Physics = (function () {
  const L = OM.LAYOUT;
  // v1.1: paño más rápido y bandas más vivas → dobletes y rebotes jugables
  const DECEL = 95;         // px/s² fricción de rodadura (v1.0: 150)
  const DAMP = 0.09;        // amortiguación lineal (1/s) (v1.0: 0.12)
  const STOP = 5;           // px/s → se detiene
  const E_BALL = 0.95, E_CUSH = 0.8;
  const MAXV = 1050;
  // efecto del taco
  const SPIN_FOLLOW = 0.8;  // fracción de la velocidad de llegada que el efecto vertical devuelve/añade a la blanca
  const SPIN_SIDE = 0.45;   // desvío lateral en la primera(s) banda(s)
  // las troneras "chupan" suavemente las bolas lentas que pasan por la boca
  const POCKET_PULL = 140;  // px/s²

  function create(opts) {
    const W = {
      balls: [], pockets: [], jaws: [], t: 0,
      decel: DECEL * (opts.frictionMul || 1),
      pocketMul: opts.pocketMul || 1,
      pocketPull: opts.pocketPull || 1,
      sealedSides: !!opts.sealedSides,
      noScratch: !!opts.noScratch,
      tilt: opts.tilt || 0,
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
        { x: F.x - 2, y: F.y - 2, corner: true }, { x: F.x + F.w / 2, y: F.y - 5, corner: false },
        { x: F.x + F.w + 2, y: F.y - 2, corner: true }, { x: F.x - 2, y: F.y + F.h + 2, corner: true },
        { x: F.x + F.w / 2, y: F.y + F.h + 5, corner: false }, { x: F.x + F.w + 2, y: F.y + F.h + 2, corner: true },
      ];
    }
    W.pockets = src.map((p, i) => ({ x: p.x, y: p.y, corner: !!p.corner, id: p.id || i, sealed: W.sealedSides && !p.corner }));
    // radio de captura y de "boca" (zona sin banda)
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
    const m = b.kind === 'plomo' ? 2 : 1;
    const ball = Object.assign({ vx: 0, vy: 0, r: L.ballR, m, rollX: 0, rollY: 0, alive: true, sink: 0 }, b);
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
    for (const b of W.balls) if (b.alive && (b.vx || b.vy)) return true;
    for (const b of W.balls) if (b.sinking) return true;
    return false;
  }

  function emit(W, e) { W.events.push(e); }

  function step(W, dt) {
    W.t += dt;
    // animación de caída en tronera
    for (const b of W.balls) if (b.sinking) {
      b.sink += dt * 4;
      b.x += (b.sinkTo.x - b.x) * Math.min(1, dt * 14);
      b.y += (b.sinkTo.y - b.y) * Math.min(1, dt * 14);
      if (b.sink >= 1) { b.sinking = false; }
    }
    let maxv = 0;
    for (const b of W.balls) if (b.alive) maxv = Math.max(maxv, Math.hypot(b.vx, b.vy));
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
      if (W.tilt && (b.vx || b.vy || W.tiltActive)) {
        b.vx += Math.sin(W.t * 1.3) * W.tilt * h;
        b.vy += Math.cos(W.t * 0.9) * W.tilt * 0.4 * h;
      }
      // atracción de tronera (no a la blanca: no queremos regalar faltas)
      if (b.num !== 0 && (b.vx || b.vy)) {
        for (const p of W.pockets) {
          if (p.sealed) continue;
          const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy, R = p.mouth * 1.7;
          if (d2 < R * R && d2 > 1) {
            const d = Math.sqrt(d2), k = POCKET_PULL * W.pocketPull * (1 - d / R) * h;
            b.vx += (dx / d) * k; b.vy += (dy / d) * k;
          }
        }
      }
      let sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) {
        const nsp = Math.max(0, sp - (W.decel + DAMP * sp) * h);
        if (nsp < STOP && !W.tiltActive) { b.vx = b.vy = 0; }
        else { const k = nsp / sp; b.vx *= k; b.vy *= k; }
        b.x += b.vx * h; b.y += b.vy * h;
        b.rollX += b.vx * h; b.rollY += b.vy * h;
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
        emit(W, { type: 'hit', a, b, speed: rv, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
    // bandas, mandíbulas y troneras
    for (const b of balls) {
      if (!b.alive) continue;
      const mouth = inMouth(W, b);
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
        if (hit) emit(W, { type: 'cushion', ball: b, speed: sp, x: b.x, y: b.y });
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
          b.vx = b.vy = 0;
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

  // Golpe sobre la blanca
  // spin = {f: -1 (retroceso) .. 1 (seguimiento), s: -1 (izq) .. 1 (der)}
  function shoot(W, cue, angle, power, spin) {
    const v = Math.min(MAXV * 1.45, power);
    cue.vx = Math.cos(angle) * v; cue.vy = Math.sin(angle) * v;
    cue.spinF = spin ? spin.f || 0 : 0;
    cue.spinS = spin ? spin.s || 0 : 0;
  }

  // Explosión (grabado Bomba)
  function explode(W, x, y, radius, force) {
    for (const b of W.balls) {
      if (!b.alive) continue;
      const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
      if (d < radius && d > 0.01) {
        const k = force * (1 - d / radius);
        b.vx += (dx / d) * k; b.vy += (dy / d) * k;
      }
    }
  }

  // Impulso de saque (arcade): dispersa el triángulo para que el saque sea espectacular
  function breakBoost(W, cue, power) {
    // la blanca se "clava" un poco en el saque (menos faltas con el paño rápido de v1.1)
    cue.vx *= 0.05; cue.vy *= 0.05;
    const objs = W.balls.filter((b) => b.alive && b !== cue);
    if (!objs.length) return;
    const cx = objs.reduce((a, b) => a + b.x, 0) / objs.length, cy = objs.reduce((a, b) => a + b.y, 0) / objs.length;
    for (const b of objs) {
      let dx = b.x - cx, dy = b.y - cy; const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9;
      const k = (120 + Math.random() * 260) * power * (0.4 + Math.min(1, d / 25));
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
    return true;
  }

  // Trazado de la guía: devuelve {pts, ghost, target, objDir, cueDir}
  function trace(W, cue, angle, maxBounces, maxLen, spinF) {
    const F = L.felt;
    let x = cue.x, y = cue.y, dx = Math.cos(angle), dy = Math.sin(angle);
    const pts = [{ x, y }];
    let len = 0;
    for (let bounce = 0; bounce <= maxBounces; bounce++) {
      // primer contacto con bola
      let best = Infinity, hitBall = null;
      for (const b of W.balls) {
        if (!b.alive || b === cue) continue;
        const ox = b.x - x, oy = b.y - y;
        const proj = ox * dx + oy * dy;
        if (proj <= 0) continue;
        const perp2 = ox * ox + oy * oy - proj * proj;
        const rr = (cue.r + b.r) ** 2;
        if (perp2 > rr) continue;
        const tHit = proj - Math.sqrt(rr - perp2);
        if (tHit < best) { best = tHit; hitBall = b; }
      }
      // banda
      let tw = Infinity, nx = 0, ny = 0;
      const r = cue.r;
      if (dx > 0) { const t = (F.x + F.w - r - x) / dx; if (t < tw) { tw = t; nx = -1; ny = 0; } }
      if (dx < 0) { const t = (F.x + r - x) / dx; if (t < tw) { tw = t; nx = 1; ny = 0; } }
      if (dy > 0) { const t = (F.y + F.h - r - y) / dy; if (t < tw) { tw = t; nx = 0; ny = -1; } }
      if (dy < 0) { const t = (F.y + r - y) / dy; if (t < tw) { tw = t; nx = 0; ny = 1; } }
      if (hitBall && best <= tw) {
        const gx = x + dx * best, gy = y + dy * best;
        pts.push({ x: gx, y: gy });
        const ox = hitBall.x - gx, oy = hitBall.y - gy, od = Math.hypot(ox, oy);
        const odx = ox / od, ody = oy / od;
        // la blanca sale tangente
        const dot = dx * odx + dy * ody;
        let tx = dx - dot * odx, ty = dy - dot * ody; const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        // con efecto vertical, la blanca suma (o resta) una parte de la velocidad de llegada en la dirección del tiro
        const sk = Math.sqrt(Math.max(0, 1 - dot * dot));
        const f = spinF ? spinF * SPIN_FOLLOW * dot * (1 + E_BALL) / 2 : 0;
        let cx = tx * sk + dx * f, cy = ty * sk + dy * f; const ck = Math.hypot(cx, cy);
        if (ck > 0.001) { cx /= ck; cy /= ck; } else { cx = tx; cy = ty; }
        return { pts, ghost: { x: gx, y: gy }, target: hitBall, objDir: { x: odx, y: ody, k: dot }, cueDir: { x: cx, y: cy, k: Math.min(1, ck) } };
      }
      len += tw;
      x += dx * tw; y += dy * tw;
      pts.push({ x, y });
      if (len > maxLen) break;
      if (nx) dx = -dx; if (ny) dy = -dy;
    }
    return { pts, ghost: null, target: null };
  }

  return { create, addBall, breakBoost, step, shoot, moving, explode, freeSpot, trace, setPockets, MAXV };
})();
