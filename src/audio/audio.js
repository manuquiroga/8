// OCHO MALDITO — Audio 100% procedural (WebAudio). Sin archivos.
// API (ver docs/ART_CONTRACT.md):
//   OM.AUDIO.unlock()                         -> llamar tras el primer gesto del usuario
//   OM.AUDIO.sfx(name, {vol, pitch, pan})     -> efectos (pitch = multiplicador, 1 = normal)
//   OM.AUDIO.music('menu'|'table'|'shop'|'boss'|'gameover'|null)  -> crossfade
//   OM.AUDIO.setVolume(master, music, sfx)    -> 0..1 (undefined/null = sin cambio)
//   OM.AUDIO.muted                            -> booleano (get/set). OM.AUDIO.toggleMute() extra.
//   OM.AUDIO.intensity(x)                     -> 0..1, sube capas de la música
//   OM.AUDIO.ctx                              -> AudioContext (null si no hay WebAudio)
// Todo falla en silencio si WebAudio no está disponible.
(function () {
  'use strict';
  var OM = (window.OM = window.OM || {});
  var AC = window.AudioContext || window.webkitAudioContext;

  var ctx = null;
  var N = {}; // nodos del grafo maestro
  var B = {}; // buffers pre-renderizados
  var W = {}; // periodic waves
  var vol = { master: 0.8, music: 0.6, sfx: 0.9 };
  var MUSIC_LEVEL = 0.34; // la música queda bajo los SFX
  var SFX_LEVEL = 0.8;
  var isMuted = false;
  var curIntensity = 0;
  var pendingTrack; // pista pedida antes de unlock
  var voices = [];
  var MAX_VOICES = 56;
  var seq = { chips: { t: -9, n: 0 }, mult: { t: -9, n: 0 } };

  // ---------------------------------------------------------------- utilidades
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hash(n) { // determinista 0..1
    n = (n | 0) * 374761393 + 668265263; n = (n ^ (n >>> 13)) * 1274126177; n = n ^ (n >>> 16);
    return ((n >>> 0) % 100000) / 100000;
  }
  function now() { return ctx.currentTime; }
  function gain(v, dest) { var g = ctx.createGain(); g.gain.value = v == null ? 1 : v; if (dest) g.connect(dest); return g; }
  function filt(type, f, q, dest) {
    var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q == null ? 0.7 : q;
    if (dest) b.connect(dest); return b;
  }
  // envolvente: ataque lineal, hold, caída exponencial
  function env(p, t, a, peak, h, d) {
    peak = Math.max(peak, 0.00011);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (h > 0) p.setValueAtTime(peak, t + a + h);
    p.exponentialRampToValueAtTime(0.0001, t + a + h + d);
  }
  function setOscType(o, type) {
    if (type && typeof type !== 'string') o.setPeriodicWave(type); else o.type = type || 'sine';
  }
  // oscilador con envolvente. o: {t,type,f,f2,glide,a,h,d,v,detune}
  function tone(dest, o) {
    var t = o.t, a = o.a == null ? 0.002 : o.a, h = o.h || 0, d = o.d == null ? 0.2 : o.d;
    var osc = ctx.createOscillator(); setOscType(osc, o.type);
    osc.frequency.setValueAtTime(Math.max(1, o.f), t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.glide || a + h + d));
    if (o.detune) osc.detune.value = o.detune;
    var g = ctx.createGain(); env(g.gain, t, a, o.v == null ? 0.5 : o.v, h, d);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + a + h + d + 0.05);
    return osc;
  }
  // ruido filtrado. o: {t,ft,f,f2,glide,q,a,h,d,v}
  function noise(dest, o) {
    var t = o.t, a = o.a == null ? 0.001 : o.a, h = o.h || 0, d = o.d == null ? 0.1 : o.d;
    var src = ctx.createBufferSource(); src.buffer = B.noise; src.loop = true;
    var f = ctx.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.Q.value = o.q == null ? 1 : o.q;
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || a + h + d));
    var g = ctx.createGain(); env(g.gain, t, a, o.v == null ? 0.5 : o.v, h, d);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5); src.stop(t + a + h + d + 0.05);
    return g;
  }
  // campana FM. o: {t,f,ratio,index,d,v}
  function bell(dest, o) {
    var t = o.t, f = o.f, d = o.d || 2, v = o.v == null ? 0.3 : o.v;
    var car = ctx.createOscillator(); car.frequency.value = f;
    var mod = ctx.createOscillator(); mod.frequency.value = f * (o.ratio || 3.5);
    var mg = ctx.createGain(); var idx = f * (o.index || 2.2);
    mg.gain.setValueAtTime(idx, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.04), t + d * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    var g = ctx.createGain(); env(g.gain, t, 0.002, v, 0, d);
    car.connect(g); g.connect(dest);
    // parcial inarmónico (campana de iglesia)
    var p2 = ctx.createOscillator(); p2.frequency.value = f * 2.76;
    var g2 = ctx.createGain(); env(g2.gain, t, 0.001, v * 0.25, 0, d * 0.35);
    p2.connect(g2); g2.connect(dest);
    var end = t + d + 0.05;
    car.start(t); mod.start(t); p2.start(t); car.stop(end); mod.stop(end); p2.stop(end);
  }
  // reproduce buffer. o: {t, rate, v, lp}
  function play(dest, buf, o) {
    var s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = o.rate || 1;
    var g = gain(o.v == null ? 1 : o.v);
    if (o.lp) { var f = filt('lowpass', o.lp, 0.7); s.connect(f); f.connect(g); } else s.connect(g);
    g.connect(dest); s.start(o.t || now());
    return s;
  }
  var DIST_CURVE = null;
  function shaper(dest, amt) {
    var ws = ctx.createWaveShaper();
    if (!DIST_CURVE) {
      DIST_CURVE = new Float32Array(1024);
      for (var i = 0; i < 1024; i++) { var x = i / 511.5 - 1; DIST_CURVE[i] = Math.tanh(x * 3) / Math.tanh(3); }
    }
    ws.curve = DIST_CURVE; ws.oversample = '2x';
    var pre = gain(amt || 1); pre.connect(ws); if (dest) ws.connect(dest);
    return pre; // conecta a pre
  }

  // ---------------------------------------------------------------- buffers
  function renderBuf(dur, ch, fn) {
    var sr = ctx.sampleRate, n = Math.max(1, Math.floor(dur * sr));
    var buf = ctx.createBuffer(ch, n, sr);
    for (var c = 0; c < ch; c++) {
      var d = buf.getChannelData(c); fn(d, sr, c);
      var pk = 0; for (var i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i]));
      if (pk > 0) for (i = 0; i < n; i++) d[i] *= 0.9 / pk;
    }
    return buf;
  }
  // modos resonantes amortiguados + transitorio
  function modal(modes, clickAmt, clickDecay, bodyF, bodyD) {
    return function (d, sr) {
      var lp = 0;
      for (var i = 0; i < d.length; i++) {
        var t = i / sr, s = 0;
        for (var m = 0; m < modes.length; m++) {
          var M = modes[m]; s += M[2] * Math.sin(2 * Math.PI * M[0] * t + M[3]) * Math.exp(-t / M[1]);
        }
        var nz = Math.random() * 2 - 1;
        lp += 0.55 * (nz - lp); // ruido algo oscurecido
        s += clickAmt * (nz - lp) * Math.exp(-t / clickDecay);
        if (bodyF) s += 0.5 * Math.sin(2 * Math.PI * bodyF * t) * Math.exp(-t / bodyD);
        // micro-ataque para evitar pop
        if (t < 0.0003) s *= t / 0.0003;
        d[i] = s;
      }
    };
  }
  function buildBuffers() {
    var sr = ctx.sampleRate;
    B.noise = renderBuf(2, 1, function (d) { for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
    // CLACK: resina. Transitorio muy corto + modos agudos 2.8–9 kHz con caída 8–35 ms
    B.clack = [];
    for (var k = 0; k < 8; k++) {
      var f0 = rnd(2700, 3900), modes = [];
      var ratios = [1, rnd(1.48, 1.62), rnd(2.2, 2.45), rnd(2.95, 3.3)];
      for (var r = 0; r < ratios.length; r++)
        modes.push([f0 * ratios[r], rnd(0.008, 0.028) / (1 + r * 0.35), [1, 0.7, 0.45, 0.3][r] * rnd(0.7, 1.1), Math.random() * 6.28]);
      B.clack.push(renderBuf(0.14, 1, modal(modes, 1.4, 0.0006, rnd(800, 1100), 0.004)));
    }
    // CUSHION: golpe sordo de goma/terciopelo
    B.cushion = [];
    for (k = 0; k < 4; k++) {
      (function (fa, fb) {
        B.cushion.push(renderBuf(0.22, 1, function (d, sr) {
          var lp = 0, lp2 = 0, ph = 0;
          for (var i = 0; i < d.length; i++) {
            var t = i / sr, f = fb + (fa - fb) * Math.exp(-t / 0.03);
            ph += 2 * Math.PI * f / sr;
            var nz = Math.random() * 2 - 1; lp += 0.08 * (nz - lp); lp2 += 0.2 * (lp - lp2);
            var s = Math.sin(ph) * Math.exp(-t / 0.055) * 0.9 + lp2 * 6 * Math.exp(-t / 0.03) +
              0.25 * Math.sin(2 * Math.PI * 420 * t) * Math.exp(-t / 0.012);
            if (t < 0.0015) s *= t / 0.0015;
            d[i] = s;
          }
        }));
      })(rnd(150, 190), rnd(55, 72));
    }
    // CHIP: ficha de arcilla
    B.chip = [];
    for (k = 0; k < 4; k++) {
      var c0 = rnd(2100, 2600);
      B.chip.push(renderBuf(0.08, 1, modal([[c0, 0.012, 1, 0], [c0 * 1.53, 0.008, 0.6, 1], [c0 * 2.3, 0.006, 0.4, 2]], 0.9, 0.0004, 0, 0)));
    }
    // IR de reverb: cripta oscura (2.6 s)
    B.ir = renderBuf(2.6, 2, function (d, sr) {
      var lp = 0;
      for (var i = 0; i < d.length; i++) {
        var t = i / sr; var nz = Math.random() * 2 - 1;
        var cut = 0.5 * Math.exp(-t / 0.9) + 0.06; lp += cut * (nz - lp);
        d[i] = lp * Math.pow(1 - t / 2.6, 2) * Math.exp(-t / 0.7) * (t < 0.012 ? 0 : 1);
      }
    });
  }
  function buildWaves() {
    function wave(fn, n) {
      var re = new Float32Array(n), im = new Float32Array(n);
      for (var k = 1; k < n; k++) { var c = fn(k); re[k] = c[0]; im[k] = c[1]; }
      return ctx.createPeriodicWave(re, im);
    }
    W.pulse25 = wave(function (k) { var d = 0.25; return [2 / (k * Math.PI) * Math.sin(2 * Math.PI * k * d), 2 / (k * Math.PI) * (1 - Math.cos(2 * Math.PI * k * d))]; }, 40);
    W.pulse12 = wave(function (k) { var d = 0.125; return [2 / (k * Math.PI) * Math.sin(2 * Math.PI * k * d), 2 / (k * Math.PI) * (1 - Math.cos(2 * Math.PI * k * d))]; }, 40);
    var org = { 1: 1, 2: 0.75, 3: 0.4, 4: 0.45, 6: 0.22, 8: 0.2, 10: 0.07, 12: 0.06, 16: 0.04 };
    W.organ = wave(function (k) { return [0, org[k] || 0]; }, 17);
    W.choir = wave(function (k) { return [0, (1 / k) * (k === 3 || k === 4 ? 1.6 : 1) * (k > 8 ? 0.4 : 1)]; }, 24);
  }

  // ---------------------------------------------------------------- grafo maestro
  function buildGraph() {
    // master -> compresor -> limitador suave (tanh) -> destino
    N.master = gain(isMuted ? 0 : vol.master);
    N.comp = ctx.createDynamicsCompressor();
    N.comp.threshold.value = -14; N.comp.knee.value = 8; N.comp.ratio.value = 6;
    N.comp.attack.value = 0.003; N.comp.release.value = 0.18;
    N.lim = ctx.createDynamicsCompressor();
    N.lim.threshold.value = -3; N.lim.knee.value = 0; N.lim.ratio.value = 20;
    N.lim.attack.value = 0.001; N.lim.release.value = 0.08;
    var clip = ctx.createWaveShaper(); var cv = new Float32Array(2048);
    for (var i = 0; i < 2048; i++) { var x = i / 1023.5 - 1, ax = Math.abs(x); cv[i] = ax < 0.85 ? x : Math.sign(x) * (0.85 + 0.15 * Math.tanh((ax - 0.85) / 0.15)); }
    clip.curve = cv;
    N.master.connect(N.comp); N.comp.connect(N.lim); N.lim.connect(clip); clip.connect(ctx.destination);

    // SFX bus
    N.sfxVol = gain(vol.sfx * SFX_LEVEL, N.master);
    N.sfxIn = gain(1, N.sfxVol);
    N.sfxRev = ctx.createConvolver(); N.sfxRev.buffer = B.ir; N.sfxRev.connect(gain(0.9, N.sfxIn));

    // MUSIC bus: pistas -> musicIn -> tono(lowpass) -> duck -> vol -> master
    N.musicVol = gain(vol.music * MUSIC_LEVEL, N.master);
    N.duck = gain(1, N.musicVol);
    N.tone = filt('lowpass', 5000, 0.5, N.duck);
    N.musicIn = gain(1, N.tone);
    N.musicRev = ctx.createConvolver(); N.musicRev.buffer = B.ir; N.musicRev.connect(gain(1, N.musicIn));
    // eco (dotted 8th por pista) con realimentación oscurecida
    N.delay = ctx.createDelay(2); N.delay.delayTime.value = 0.43;
    N.delayFb = gain(0.38); N.delayLp = filt('lowpass', 2600, 0.5);
    N.echoIn = gain(1, N.delay);
    N.delay.connect(N.delayLp); N.delayLp.connect(N.delayFb); N.delayFb.connect(N.delay);
    N.delayLp.connect(gain(0.8, N.musicIn)); N.delayLp.connect(gain(0.3, N.musicRev));
    setIntensityNodes(true);
  }

  function applyVolumes() {
    if (!ctx) return;
    var t = now();
    N.master.gain.setTargetAtTime(isMuted ? 0 : vol.master, t, 0.03);
    N.musicVol.gain.setTargetAtTime(vol.music * MUSIC_LEVEL, t, 0.05);
    N.sfxVol.gain.setTargetAtTime(vol.sfx * SFX_LEVEL, t, 0.03);
  }
  function duck(db, hold) {
    if (!ctx) return;
    var t = now(), p = N.duck.gain, lv = Math.pow(10, -db / 20);
    p.cancelScheduledValues(t);
    p.setTargetAtTime(lv, t, 0.012);
    p.setTargetAtTime(1, t + (hold || 0.15), 0.35);
  }

  // ---------------------------------------------------------------- voces SFX
  var META = { // cap = polifonía máx. por nombre, rev = envío reverb
    clack: { cap: 10, rev: 0.05 }, cushion: { cap: 6, rev: 0.05 }, pocket: { cap: 5, rev: 0.12 },
    cue_hit: { cap: 3, rev: 0.06 }, scratch: { cap: 2, rev: 0.3 }, chips: { cap: 8, rev: 0.18 },
    mult: { cap: 4, rev: 0.25 }, xmult: { cap: 2, rev: 0.45 }, coin: { cap: 6, rev: 0.15 },
    buy: { cap: 3, rev: 0.2 }, sell: { cap: 3, rev: 0.2 }, card_flip: { cap: 5, rev: 0.08 },
    card_hover: { cap: 3, rev: 0.05 }, click: { cap: 4, rev: 0.04 }, reroll: { cap: 2, rev: 0.15 },
    pack_open: { cap: 2, rev: 0.35 }, boss: { cap: 1, rev: 0.6 }, win_table: { cap: 1, rev: 0.4 },
    lose: { cap: 1, rev: 0.5 }, curse: { cap: 2, rev: 0.55 }, explosion: { cap: 3, rev: 0.3 },
    glass_break: { cap: 3, rev: 0.3 }, level_up: { cap: 2, rev: 0.35 }, score_total: { cap: 1, rev: 0.4 }
  };
  function killVoice(v, t) {
    try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.006); } catch (e) { /* */ }
    v.end = t; v.dead = true;
  }
  function newVoice(name, o) {
    var t = now(), i, v, same = [];
    for (i = voices.length - 1; i >= 0; i--) if (voices[i].end < t) voices.splice(i, 1);
    var cap = (META[name] && META[name].cap) || 4;
    for (i = 0; i < voices.length; i++) if (voices[i].name === name && !voices[i].dead) same.push(voices[i]);
    if (same.length >= cap) killVoice(same[0], t);
    if (voices.length >= MAX_VOICES) { for (i = 0; i < voices.length; i++) if (!voices[i].dead) { killVoice(voices[i], t); break; } }
    var g = gain(o.vol == null ? 1 : clamp(o.vol, 0, 1.5));
    var out = g;
    if (ctx.createStereoPanner && o.pan) {
      var p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); out = p;
    }
    out.connect(N.sfxIn);
    var rv = META[name] ? META[name].rev : 0.1;
    if (rv > 0) out.connect(gain(rv, N.sfxRev));
    v = { name: name, g: g, end: t + 5 };
    voices.push(v);
    return v;
  }

  // ---------------------------------------------------------------- SFX
  var PENT = [0, 3, 5, 7, 10]; // menor pentatónica
  var MINOR = [0, 2, 3, 5, 7, 8, 10];
  function scaleStep(sc, n) { return sc[n % sc.length] + 12 * Math.floor(n / sc.length); }
  function quantPent(m) { // a la nota más cercana de La menor pentatónica
    var r = Math.round(m), best = r, bd = 99;
    for (var k = -3; k <= 3; k++) { var pc = ((r + k) % 12 + 12) % 12; if ([9, 0, 2, 4, 7].indexOf(pc) >= 0 && Math.abs(k) < bd) { bd = Math.abs(k); best = r + k; } }
    return best;
  }
  function seqStep(key, gap) { // auto-secuencia: llamadas seguidas suben de tono
    var s = seq[key], t = now();
    s.n = (t - s.t < gap) ? Math.min(s.n + 1, 15) : 0; s.t = t; return s.n;
  }

  var S = {};
  S.clack = function (out, t, o) {
    var v = o.vol == null ? 0.7 : clamp(o.vol, 0, 1);
    out.gain.value = Math.pow(v, 1.2) * 1.0 + 0.02;
    var rate = (o.pitch || 1) * rnd(0.88, 1.14) * (0.94 + v * 0.1);
    play(out, B.clack[(Math.random() * B.clack.length) | 0], { t: t, rate: rate, lp: 2500 + v * 14000 });
    return 0.15;
  };
  S.cushion = function (out, t, o) {
    var v = o.vol == null ? 0.7 : clamp(o.vol, 0, 1);
    out.gain.value = 0.15 + v * 0.95;
    play(out, B.cushion[(Math.random() * 4) | 0], { t: t, rate: (o.pitch || 1) * rnd(0.9, 1.1), lp: 600 + v * 2500 });
    return 0.25;
  };
  S.pocket = function (out, t, o) {
    var p = o.pitch || 1;
    // golpe contra la tronera (cuero) + caída
    play(out, B.clack[(Math.random() * 8) | 0], { t: t, rate: 0.55 * p, v: 0.35, lp: 2200 });
    tone(out, { t: t + 0.01, f: 140 * p, f2: 55, d: 0.16, v: 0.75 });
    noise(out, { t: t + 0.01, ft: 'lowpass', f: 700, d: 0.07, v: 0.6 });
    // rodar por el canal: ruido banda con modulación de traqueteo que se frena
    var t1 = t + 0.09, dur = rnd(0.55, 0.75);
    var src = ctx.createBufferSource(); src.buffer = B.noise; src.loop = true;
    var bp = filt('bandpass', 520 * p, 2.5); bp.frequency.setValueAtTime(520 * p, t1); bp.frequency.exponentialRampToValueAtTime(240 * p, t1 + dur);
    var am = gain(0); var envG = ctx.createGain();
    env(envG.gain, t1, 0.03, 0.9, dur * 0.4, dur * 0.6);
    var lfo = ctx.createOscillator(); lfo.type = 'triangle';
    lfo.frequency.setValueAtTime(rnd(26, 32), t1); lfo.frequency.exponentialRampToValueAtTime(9, t1 + dur);
    var lg = gain(0.5); lfo.connect(lg); lg.connect(am.gain); am.gain.value = 0.5;
    src.connect(bp); bp.connect(am); am.connect(envG); envG.connect(out);
    // retumbe grave de madera
    var rum = ctx.createOscillator(); rum.frequency.value = 75 * p; var rg = gain(0); env(rg.gain, t1, 0.05, 0.25, dur * 0.3, dur * 0.6);
    rum.connect(rg); rg.connect(am);
    src.start(t1, Math.random()); src.stop(t1 + dur + 0.1); lfo.start(t1); lfo.stop(t1 + dur + 0.1); rum.start(t1); rum.stop(t1 + dur + 0.1);
    // choque final con otras bolas en el canal (amortiguado)
    var te = t1 + dur * rnd(0.75, 0.95);
    play(out, B.clack[(Math.random() * 8) | 0], { t: te, rate: rnd(0.65, 0.8), v: 0.45, lp: 1800 });
    if (Math.random() < 0.6) play(out, B.clack[(Math.random() * 8) | 0], { t: te + rnd(0.05, 0.1), rate: rnd(0.6, 0.75), v: 0.2, lp: 1500 });
    return 0.1 + dur + 0.3;
  };
  S.cue_hit = function (out, t, o) {
    var v = o.vol == null ? 0.7 : clamp(o.vol, 0, 1), p = (o.pitch || 1) * rnd(0.96, 1.04);
    out.gain.value = 0.3 + v * 0.8;
    tone(out, { t: t, f: 700 * p, f2: 430 * p, glide: 0.03, d: 0.04, v: 0.55 });      // "tok" de cuero
    tone(out, { t: t, f: 1350 * p, d: 0.012, v: 0.18, type: 'triangle' });
    noise(out, { t: t, ft: 'bandpass', f: 1700, q: 1.4, d: 0.02, v: 0.55 });
    noise(out, { t: t, ft: 'highpass', f: 6000, d: 0.005, v: 0.25 + v * 0.2 });         // tiza
    tone(out, { t: t, f: 170 * p, f2: 100, d: 0.08 + v * 0.05, v: 0.35 + v * 0.25 });   // cuerpo del taco
    if (v > 0.75) noise(out, { t: t + 0.005, ft: 'lowpass', f: 900, d: 0.09, v: 0.3 }); // golpe fuerte: cuerpo extra
    return 0.25;
  };
  S.scratch = function (out, t, o) {
    var p = o.pitch || 1;
    tone(out, { t: t, f: 120, f2: 45, d: 0.25, v: 0.6 });
    var lp = filt('lowpass', 1400, 6, out); lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.9);
    var pre = shaper(lp, 1.6);
    [[220, 55], [311, 73], [233, 58]].forEach(function (fr, i) {
      var os = tone(pre, { t: t + 0.04, type: 'sawtooth', f: fr[0] * p, f2: fr[1] * p, glide: 0.85, a: 0.03, h: 0.4, d: 0.45, v: 0.22, detune: i * 9 });
      var vib = ctx.createOscillator(); vib.frequency.value = 6; var vg = gain(12); vib.connect(vg); vg.connect(os.detune); vib.start(t); vib.stop(t + 1);
    });
    noise(out, { t: t, ft: 'bandpass', f: 1800, f2: 300, q: 2, a: 0.02, d: 0.5, v: 0.25 });
    duck(3, 0.4);
    return 1.1;
  };
  S.chips = function (out, t, o) {
    var n = o.pitch == null ? seqStep('chips', 0.45) : 0;
    var m = o.pitch == null ? 76 + scaleStep(PENT, n) : quantPent(76 + 12 * Math.log(o.pitch) / Math.LN2);
    m = Math.min(m, 105);
    var f = mtof(m), v = o.vol == null ? 1 : o.vol;
    out.gain.value = 0.85 * v;
    play(out, B.chip[(Math.random() * 4) | 0], { t: t, rate: rnd(0.9, 1.1) * (1 + n * 0.02), v: 0.7 });
    tone(out, { t: t, type: W.pulse25, f: f, d: 0.09, v: 0.16 });      // chiptune azul
    tone(out, { t: t, f: f * 2, d: 0.18, v: 0.14 });
    bell(out, { t: t, f: f, ratio: 4, index: 0.8, d: 0.35, v: 0.12 });
    return 0.4;
  };
  S.mult = function (out, t, o) {
    var n = o.pitch == null ? seqStep('mult', 0.6) : 0;
    var semi = o.pitch == null ? scaleStep(MINOR, n) : 12 * Math.log(o.pitch) / Math.LN2;
    var f = mtof(45 + Math.min(semi, 24)), v = o.vol == null ? 1 : o.vol;
    out.gain.value = 0.85 * v;
    tone(out, { t: t, f: 170, f2: 48, glide: 0.12, d: 0.28, v: 0.9 });               // puñetazo
    noise(out, { t: t, ft: 'bandpass', f: 2200, q: 0.8, d: 0.05, v: 0.5 });
    var lp = filt('lowpass', 4000, 7, out);
    lp.frequency.setValueAtTime(5500, t); lp.frequency.exponentialRampToValueAtTime(350, t + 0.35);
    var pre = shaper(lp, 2.2);
    [0, 7, 12].forEach(function (iv, i) {
      tone(pre, { t: t, type: 'sawtooth', f: f * Math.pow(2, iv / 12), a: 0.003, d: 0.4, v: 0.2, detune: (i - 1) * 8 });
    });
    tone(out, { t: t, type: 'square', f: f * 4, d: 0.12, v: 0.06 });
    duck(3, 0.12);
    return 0.6;
  };
  S.xmult = function (out, t, o) {
    var p = o.pitch || 1, f = 55 * p, v = o.vol == null ? 1 : o.vol;
    out.gain.value = v;
    tone(out, { t: t, f: 110, f2: 28, glide: 0.7, d: 1.0, v: 1 });                   // sub caída
    noise(out, { t: t, ft: 'lowpass', f: 6000, f2: 150, q: 1.2, d: 0.6, v: 0.6 });   // impacto
    var lp = filt('lowpass', 6000, 5, out);
    lp.frequency.setValueAtTime(7000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 1.4);
    var pre = shaper(lp, 3);
    [0, 7, 12, 19, 24].forEach(function (iv, i) {
      tone(pre, { t: t, type: 'sawtooth', f: f * Math.pow(2, iv / 12), a: 0.004, h: 0.15, d: 1.2, v: 0.16, detune: (i % 2 ? 1 : -1) * 10 });
    });
    // gong / campana épica
    bell(out, { t: t + 0.01, f: f * 8, ratio: 1.41, index: 3, d: 2.2, v: 0.22 });
    bell(out, { t: t + 0.12, f: f * 12, ratio: 3.5, index: 1.5, d: 1.6, v: 0.12 });
    tone(out, { t: t + 0.05, type: W.pulse12, f: f * 16, f2: f * 32, glide: 0.25, d: 0.3, v: 0.05 });
    duck(8, 0.6);
    return 2.4;
  };
  S.coin = function (out, t, o) {
    var p = (o.pitch || 1) * rnd(0.99, 1.01);
    out.gain.value *= 1.4;
    tone(out, { t: t, type: 'square', f: 988 * p, d: 0.06, v: 0.14 });
    tone(out, { t: t + 0.065, type: 'square', f: 1319 * p, a: 0.002, h: 0.05, d: 0.3, v: 0.14 });
    tone(out, { t: t + 0.065, f: 2637 * p, d: 0.35, v: 0.08 });
    play(out, B.chip[0], { t: t, rate: 1.8, v: 0.25 });
    return 0.5;
  };
  S.buy = function (out, t, o) {
    var p = o.pitch || 1;
    tone(out, { t: t, f: 200, f2: 80, d: 0.08, v: 0.5 });                              // "ka"
    noise(out, { t: t, ft: 'bandpass', f: 3500, q: 1, d: 0.05, v: 0.5 });
    for (var i = 0; i < 4; i++) play(out, B.chip[i], { t: t + 0.03 + i * 0.035 + rnd(0, 0.01), rate: rnd(1.4, 1.9), v: 0.3 });
    bell(out, { t: t + 0.09, f: 1568 * p, ratio: 3.01, index: 1.2, d: 0.9, v: 0.2 });   // "ching"
    bell(out, { t: t + 0.09, f: 2093 * p, ratio: 3.5, index: 0.8, d: 0.7, v: 0.12 });
    tone(out, { t: t + 0.09, type: 'square', f: 1319 * p, d: 0.15, v: 0.06 });
    return 1.0;
  };
  S.sell = function (out, t, o) {
    var p = o.pitch || 1;
    out.gain.value *= 1.5;
    tone(out, { t: t, type: 'square', f: 1319 * p, d: 0.06, v: 0.12 });
    tone(out, { t: t + 0.07, type: 'square', f: 880 * p, d: 0.25, v: 0.12 });
    noise(out, { t: t, ft: 'bandpass', f: 1500, f2: 4000, q: 1.2, a: 0.05, d: 0.12, v: 0.2 });
    for (var i = 0; i < 3; i++) play(out, B.chip[i], { t: t + 0.12 + i * 0.05, rate: rnd(1.2, 1.7), v: 0.25 });
    return 0.6;
  };
  S.card_flip = function (out, t, o) {
    var p = (o.pitch || 1) * rnd(0.9, 1.1);
    noise(out, { t: t, ft: 'bandpass', f: 1200 * p, f2: 5000 * p, q: 1.3, a: 0.01, d: 0.07, v: 0.5 });
    play(out, B.chip[(Math.random() * 4) | 0], { t: t + 0.055, rate: 1.7 * p, v: 0.18, lp: 6000 });
    tone(out, { t: t + 0.05, f: 300 * p, f2: 200, d: 0.03, v: 0.15 });
    return 0.2;
  };
  S.card_hover = function (out, t, o) {
    var p = (o.pitch || 1) * rnd(0.97, 1.03);
    out.gain.value *= 0.9;
    tone(out, { t: t, f: 2400 * p, d: 0.03, v: 0.1 });
    tone(out, { t: t, type: 'triangle', f: 1200 * p, d: 0.025, v: 0.06 });
    noise(out, { t: t, ft: 'highpass', f: 5000, d: 0.012, v: 0.06 });
    return 0.1;
  };
  S.click = function (out, t, o) {
    var p = o.pitch || 1;
    var lp = filt('lowpass', 4000, 0.7, out);
    tone(lp, { t: t, type: 'square', f: 1400 * p, d: 0.012, v: 0.12 });
    tone(out, { t: t, f: 320 * p, f2: 140, d: 0.035, v: 0.35 });
    return 0.1;
  };
  S.reroll = function (out, t, o) {
    var p = o.pitch || 1, tt = t;
    for (var i = 0; i < 8; i++) {
      play(out, B.clack[(Math.random() * 8) | 0], { t: tt, rate: rnd(0.45, 0.6), v: 0.3, lp: 3000 }); // dados de hueso
      tt += 0.06 - i * 0.004;
    }
    noise(out, { t: t, ft: 'bandpass', f: 400, f2: 3000, q: 2, a: 0.25, d: 0.12, v: 0.2 });
    tone(out, { t: tt + 0.02, type: W.pulse25, f: 880 * p, d: 0.08, v: 0.1 });
    tone(out, { t: tt + 0.09, type: W.pulse25, f: 1319 * p, d: 0.2, v: 0.1 });
    return tt - t + 0.4;
  };
  S.pack_open = function (out, t, o) {
    var p = o.pitch || 1;
    // desgarro de papel: ruido con amplitud dentada
    var src = ctx.createBufferSource(); src.buffer = B.noise; src.loop = true;
    var bp = filt('bandpass', 2600, 0.8); var g = gain(0);
    for (var k = 0; k < 30; k++) g.gain.setValueAtTime(Math.random() < 0.35 ? 0.02 : rnd(0.15, 0.6) * (1 - k / 34), t + k * 0.009);
    g.gain.setValueAtTime(0, t + 0.28);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t, Math.random()); src.stop(t + 0.3);
    // destello mágico ascendente
    var notes = [57, 60, 64, 67, 69, 72, 76, 79];
    for (var i = 0; i < notes.length; i++)
      bell(out, { t: t + 0.25 + i * 0.045, f: mtof(notes[i] + 12) * p, ratio: 3.5, index: 1, d: 0.8, v: 0.11 });
    var sw = filt('lowpass', 400, 2, out); sw.frequency.setValueAtTime(300, t + 0.2); sw.frequency.exponentialRampToValueAtTime(3000, t + 0.9);
    [57, 64, 69].forEach(function (m) { tone(sw, { t: t + 0.2, type: 'sawtooth', f: mtof(m) * p, a: 0.25, h: 0.2, d: 0.6, v: 0.06 }); });
    return 1.4;
  };
  S.boss = function (out, t, o) {
    var p = o.pitch || 1;
    tone(out, { t: t, f: 90, f2: 36, glide: 0.9, d: 1.4, v: 0.9 });                  // timbal del infierno
    noise(out, { t: t, ft: 'lowpass', f: 500, d: 0.5, v: 0.5 });
    var lp = filt('lowpass', 300, 4, out); lp.frequency.setValueAtTime(250, t); lp.frequency.exponentialRampToValueAtTime(2200, t + 0.7); lp.frequency.exponentialRampToValueAtTime(300, t + 2.8);
    var pre = shaper(lp, 1.8);
    [40, 41, 46, 52].forEach(function (m, i) { // cluster E-F-Bb-E: segunda menor + tritono
      tone(pre, { t: t, type: 'sawtooth', f: mtof(m) * p, a: 0.35, h: 0.6, d: 1.6, v: 0.16, detune: (i - 1.5) * 7 });
    });
    bell(out, { t: t + 0.02, f: mtof(52) * p, ratio: 2.76, index: 2.5, d: 3, v: 0.3 });
    bell(out, { t: t + 0.4, f: mtof(58) * p, ratio: 2.76, index: 2.5, d: 2.6, v: 0.2 });
    noise(out, { t: t, ft: 'bandpass', f: 300, f2: 2500, q: 6, a: 0.6, d: 0.6, v: 0.15 }); // aullido
    duck(9, 1.8);
    return 3.2;
  };
  S.win_table = function (out, t, o) {
    var p = o.pitch || 1;
    var arp = [57, 60, 64, 69, 72, 76]; // La menor...
    for (var i = 0; i < arp.length; i++) {
      tone(out, { t: t + i * 0.07, type: W.pulse25, f: mtof(arp[i]) * p, d: 0.15, v: 0.12 });
      bell(out, { t: t + i * 0.07, f: mtof(arp[i] + 12) * p, ratio: 3.5, index: 0.9, d: 0.6, v: 0.07 });
    }
    var tc = t + arp.length * 0.07 + 0.05; // ...que resuelve a La mayor (picarda)
    var lp = filt('lowpass', 800, 1, out); lp.frequency.setValueAtTime(800, tc); lp.frequency.exponentialRampToValueAtTime(5000, tc + 0.3);
    [69, 73, 76, 81].forEach(function (m, i) {
      tone(lp, { t: tc, type: 'sawtooth', f: mtof(m) * p, a: 0.02, h: 0.5, d: 1.2, v: 0.08, detune: i * 5 - 7 });
      bell(out, { t: tc + i * 0.02, f: mtof(m + 12) * p, ratio: 4, index: 1, d: 1.6, v: 0.09 });
    });
    tone(out, { t: tc, f: 110 * p, f2: 55, d: 0.5, v: 0.6 });
    tone(out, { t: tc, type: W.pulse25, f: mtof(81) * p, a: 0.01, h: 0.4, d: 0.5, v: 0.1 });
    duck(6, 1.2);
    return 2.6;
  };
  S.lose = function (out, t, o) {
    var p = o.pitch || 1;
    var seqN = [64, 63, 62, 61]; // descenso cromático
    var lp = filt('lowpass', 1500, 2, out);
    for (var i = 0; i < seqN.length; i++) {
      var last = i === seqN.length - 1, tt = t + i * 0.32;
      var os = tone(lp, { t: tt, type: 'square', f: mtof(seqN[i]) * p, f2: last ? mtof(seqN[i] - 1) * p : 0, glide: 1.4, a: 0.01, h: last ? 0.6 : 0.2, d: last ? 1.0 : 0.1, v: 0.12 });
      if (last) { var vib = ctx.createOscillator(); vib.frequency.value = 5; var vg = gain(25); vib.connect(vg); vg.connect(os.detune); vib.start(tt); vib.stop(tt + 2); }
    }
    [50, 53, 57].forEach(function (m) { tone(out, { t: t + 0.96, type: W.organ, f: mtof(m - 12) * p, a: 0.3, h: 0.5, d: 1.2, v: 0.09 }); });
    bell(out, { t: t + 0.96, f: mtof(38) * p, ratio: 2.76, index: 2, d: 2.5, v: 0.35 });
    noise(out, { t: t, ft: 'bandpass', f: 500, q: 3, a: 0.8, d: 1.5, v: 0.08 });
    duck(8, 2.2);
    return 3.0;
  };
  S.curse = function (out, t, o) {
    var p = o.pitch || 1;
    tone(out, { t: t, f: 100, f2: 30, glide: 0.8, d: 1.2, v: 1 });                  // boom
    noise(out, { t: t, ft: 'lowpass', f: 1200, f2: 100, d: 0.6, v: 0.5 });
    // coro maldito: sierras por dos formantes ("aah")
    var f1 = filt('bandpass', 700, 5, out), f2 = filt('bandpass', 1150, 6, out);
    var mix = gain(1); mix.connect(f1); mix.connect(f2);
    f1.frequency.setValueAtTime(700, t); f1.frequency.linearRampToValueAtTime(400, t + 2); // aah -> ooh
    [50, 51, 56, 62].forEach(function (m, i) { // D Eb Ab D: tritono y segunda
      var os = tone(mix, { t: t + 0.05, type: W.choir, f: mtof(m) * p, f2: mtof(m - 1) * p, glide: 2, a: 0.25, h: 0.6, d: 1.3, v: 0.35, detune: (i - 1.5) * 12 });
      var vib = ctx.createOscillator(); vib.frequency.value = 4.5 + i * 0.6; var vg = gain(18); vib.connect(vg); vg.connect(os.detune); vib.start(t); vib.stop(t + 2.4);
    });
    noise(out, { t: t + 0.1, ft: 'bandpass', f: 600, f2: 2400, q: 9, a: 0.5, d: 1.2, v: 0.35 }); // susurro
    bell(out, { t: t + 0.03, f: mtof(70) * p * 1.013, ratio: 2.76, index: 2, d: 2, v: 0.16 });
    // latidos
    tone(out, { t: t + 0.9, f: 70, f2: 40, d: 0.2, v: 0.6 }); tone(out, { t: t + 1.15, f: 65, f2: 38, d: 0.25, v: 0.5 });
    duck(10, 1.6);
    return 2.6;
  };
  S.explosion = function (out, t, o) {
    var v = o.vol == null ? 1 : o.vol;
    out.gain.value = v;
    var pre = shaper(out, 2);
    noise(pre, { t: t, ft: 'lowpass', f: 6000, f2: 140, glide: 0.9, q: 0.8, d: 1.1, v: 0.7 });
    tone(out, { t: t, f: 95, f2: 28, glide: 0.7, d: 0.9, v: 1 });
    noise(out, { t: t, ft: 'highpass', f: 3000, d: 0.04, v: 0.5 });
    for (var i = 0; i < 14; i++) noise(out, { t: t + 0.05 + Math.pow(Math.random(), 1.6) * 0.9, ft: 'highpass', f: rnd(2000, 6000), d: 0.006, v: rnd(0.1, 0.3) });
    duck(6, 0.5);
    return 1.5;
  };
  S.glass_break = function (out, t, o) {
    noise(out, { t: t, ft: 'highpass', f: 2500, d: 0.06, v: 0.7 });
    tone(out, { t: t, f: 400, f2: 150, d: 0.05, v: 0.3 });
    for (var i = 0; i < 20; i++) {
      var tt = t + 0.01 + Math.pow(Math.random(), 1.5) * 0.55;
      tone(out, { t: tt, f: rnd(2800, 9000), d: rnd(0.04, 0.2), v: rnd(0.03, 0.09) });
    }
    noise(out, { t: t + 0.02, ft: 'highpass', f: 7000, d: 0.5, v: 0.12 });
    return 1.0;
  };
  S.level_up = function (out, t, o) {
    var p = o.pitch || 1, notes = [69, 72, 76, 81, 84, 88];
    out.gain.value *= 1.5;
    for (var i = 0; i < notes.length; i++) tone(out, { t: t + i * 0.05, type: W.pulse25, f: mtof(notes[i]) * p, d: 0.12, v: 0.11 });
    var tc = t + notes.length * 0.05;
    [81, 84, 88, 93].forEach(function (m) { bell(out, { t: tc, f: mtof(m) * p, ratio: 3.5, index: 1, d: 1.1, v: 0.08 }); });
    noise(out, { t: t, ft: 'highpass', f: 4000, f2: 9000, a: 0.3, d: 0.5, v: 0.08 });
    return 1.5;
  };
  S.score_total = function (out, t, o) {
    var p = o.pitch || 1;
    tone(out, { t: t, f: 150, f2: 40, glide: 0.25, d: 0.5, v: 0.9 });
    noise(out, { t: t, ft: 'bandpass', f: 2500, q: 0.6, d: 0.1, v: 0.5 });
    var lp = filt('lowpass', 500, 5, out); lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(7000, t + 0.35); lp.frequency.exponentialRampToValueAtTime(1500, t + 1.8);
    var pre = shaper(lp, 1.5);
    [45, 57, 64, 71, 72].forEach(function (m, i) { tone(pre, { t: t, type: 'sawtooth', f: mtof(m) * p, a: 0.01, h: 0.3, d: 1.4, v: 0.12, detune: (i - 2) * 6 }); });
    [69, 72, 76, 81, 84, 88, 93].forEach(function (m, i) {
      bell(out, { t: t + 0.06 + i * 0.05, f: mtof(m) * p, ratio: 3.5, index: 1, d: 1.2, v: 0.09 });
      if (i % 2 === 0) play(out, B.chip[i % 4], { t: t + 0.08 + i * 0.05, rate: 1.6 + i * 0.1, v: 0.2 });
    });
    tone(out, { t: t + 0.4, type: 'square', f: 1319 * p, d: 0.3, v: 0.06 });
    duck(9, 1.2);
    return 2.4;
  };

  // ---------------------------------------------------------------- instrumentos de música
  var I = {};
  I.kick = function (L, t, v) {
    tone(L, { t: t, f: 150, f2: 42, glide: 0.11, d: 0.32, v: 0.9 * v });
    noise(L, { t: t, ft: 'lowpass', f: 3000, d: 0.008, v: 0.25 * v });
  };
  I.snare = function (L, t, v) {
    noise(L, { t: t, ft: 'bandpass', f: 1900, q: 0.7, d: 0.14, v: 0.55 * v });
    tone(L, { t: t, type: 'triangle', f: 200, f2: 150, d: 0.07, v: 0.35 * v });
  };
  I.hat = function (L, t, v, open) {
    noise(L, { t: t, ft: 'highpass', f: 7500, q: 0.5, d: open ? 0.18 : 0.035, v: 0.22 * v });
  };
  I.brush = function (L, t, v) { noise(L, { t: t, ft: 'bandpass', f: 4500, q: 0.6, a: 0.015, d: 0.12, v: 0.12 * v }); };
  I.tom = function (L, t, m, v) { tone(L, { t: t, f: mtof(m), f2: mtof(m) * 0.6, d: 0.22, v: 0.5 * v }); };
  I.bass = function (L, t, m, dur, v, bright) {
    var f = mtof(m), lp = filt('lowpass', 200, 7, L);
    lp.frequency.setValueAtTime(220 + (bright || 1) * 1400 * v, t);
    lp.frequency.exponentialRampToValueAtTime(160, t + Math.min(dur, 0.25));
    tone(lp, { t: t, type: 'sawtooth', f: f, a: 0.004, h: dur * 0.5, d: dur * 0.6, v: 0.32 * v });
    tone(lp, { t: t, type: 'square', f: f, a: 0.004, h: dur * 0.5, d: dur * 0.6, v: 0.2 * v, detune: -10 });
    tone(L, { t: t, f: f, a: 0.004, h: dur * 0.6, d: dur * 0.5, v: 0.35 * v }); // sub
  };
  I.sub = function (L, t, m, dur, v) { tone(L, { t: t, type: 'triangle', f: mtof(m), a: 0.02, h: dur * 0.7, d: dur * 0.4, v: 0.5 * v }); };
  I.pad = function (L, t, notes, dur, v, cut) {
    var lp = filt('lowpass', cut || 900, 1.2, L);
    lp.frequency.setValueAtTime((cut || 900) * 0.6, t); lp.frequency.linearRampToValueAtTime(cut || 900, t + dur * 0.5);
    notes.forEach(function (m) {
      tone(lp, { t: t, type: 'sawtooth', f: mtof(m), a: dur * 0.25, h: dur * 0.5, d: dur * 0.5, v: 0.07 * v, detune: -8 });
      tone(lp, { t: t, type: 'sawtooth', f: mtof(m), a: dur * 0.25, h: dur * 0.5, d: dur * 0.5, v: 0.07 * v, detune: 8 });
    });
  };
  I.organ = function (L, t, notes, dur, v) {
    var lp = filt('lowpass', 2400, 0.7, L);
    var trem = gain(1); trem.connect(lp);
    var lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; var lg = gain(0.15); lfo.connect(lg); lg.connect(trem.gain);
    lfo.start(t); lfo.stop(t + dur * 1.5 + 0.1);
    notes.forEach(function (m) { tone(trem, { t: t, type: W.organ, f: mtof(m), a: 0.08, h: dur * 0.85, d: dur * 0.5, v: 0.09 * v }); });
  };
  I.choir = function (L, t, notes, dur, v) {
    var f1 = filt('bandpass', 650, 4, L), f2 = filt('bandpass', 1100, 5, L), mix = gain(1); mix.connect(f1); mix.connect(f2);
    notes.forEach(function (m, i) { tone(mix, { t: t, type: W.choir, f: mtof(m), a: dur * 0.35, h: dur * 0.4, d: dur * 0.5, v: 0.25 * v, detune: (i - 1) * 9 }); });
  };
  I.bell = function (L, t, m, v, d) { bell(L, { t: t, f: mtof(m), ratio: 3.5, index: 1.6, d: d || 2.2, v: 0.22 * v }); };
  I.toll = function (L, t, m, v) { bell(L, { t: t, f: mtof(m), ratio: 2.76, index: 2.4, d: 4, v: 0.3 * v }); };
  I.vibe = function (L, t, m, v) { bell(L, { t: t, f: mtof(m), ratio: 4, index: 0.5, d: 1.4, v: 0.2 * v }); };
  I.ep = function (L, t, notes, dur, v) { // piano eléctrico FM
    notes.forEach(function (m) {
      bell(L, { t: t, f: mtof(m), ratio: 1, index: 1.2, d: dur + 0.6, v: 0.09 * v });
      tone(L, { t: t, f: mtof(m) * 2, d: 0.3, v: 0.02 * v });
    });
  };
  I.arp = function (L, t, m, dur, v, wave) {
    var lp = filt('lowpass', 3200, 1, L);
    tone(lp, { t: t, type: wave || W.pulse25, f: mtof(m), a: 0.003, d: dur * 0.9, v: 0.12 * v });
  };
  I.lead = function (L, t, m, dur, v, wave) {
    var lp = filt('lowpass', 2400, 2, L);
    var os = tone(lp, { t: t, type: wave || 'sawtooth', f: mtof(m), a: 0.02, h: dur * 0.6, d: dur * 0.5, v: 0.1 * v });
    var o2 = tone(lp, { t: t, type: 'square', f: mtof(m), a: 0.02, h: dur * 0.6, d: dur * 0.5, v: 0.05 * v, detune: 7 });
    var vib = ctx.createOscillator(); vib.frequency.value = 5.5; var vg = gain(0);
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(14, t + dur * 0.7);
    vib.connect(vg); vg.connect(os.detune); vg.connect(o2.detune); vib.start(t); vib.stop(t + dur * 1.2 + 0.1);
  };

  // acordes
  var Q = { m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], d7: [0, 4, 7, 10], m9: [0, 3, 7, 10, 14], hd: [0, 3, 6, 10], b9: [0, 4, 7, 10, 13], p5: [0, 7, 12], dim: [0, 3, 6] };
  function chord(root, q, base) { // voicing cerca de "base"
    var r = root; while (r < base) r += 12; while (r >= base + 12) r -= 12;
    return Q[q].map(function (iv) { return r + iv; });
  }

  // ---------------------------------------------------------------- pistas
  var TRACKS = {};

  // TABLE: groove hipnótico en La menor/frigio, 104 bpm. Ciclo de 32 compases con secciones y variaciones.
  (function () {
    var PA = [[0, 'm'], [-4, 'M'], [5, 'm'], [7, 'M']];   // Am F Dm E
    var PD = [[0, 'm'], [3, 'M'], [-2, 'M'], [7, 'M']];   // Am C G E
    var PB = [[0, 'm'], [1, 'M'], [0, 'm'], [-2, 'M']];   // Am Bb Am G (frigio)
    var PC = [[-4, 'M'], [-2, 'M'], [0, 'm'], [0, 'm']];  // F G Am Am
    var BLOCKS = [PA, PA, PD, PA, PB, PB, PC, PA];
    var BP = [
      [0, null, 0, null, 0, null, 0, 12, 0, null, 0, null, 0, null, 12, 0],
      [0, 0, null, 0, 12, 0, null, 0, 0, 0, null, 0, 7, 0, 12, null],
      [0, null, null, 0, null, null, 0, null, 0, null, null, 0, null, 0, null, 7]
    ];
    var AP = [
      [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 4, 3, 2, 1],
      [0, 2, 1, 3, 0, 2, 1, 4, 0, 2, 1, 3, 2, 4, 3, 1],
      [3, 2, 1, 0, 3, 2, 1, 0, 4, 2, 1, 0, 4, 3, 2, 1],
      [0, null, 2, 3, null, 2, 0, 4, null, 3, 2, null, 1, 2, 3, 4]
    ];
    var K0 = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    var K1 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1];
    TRACKS.table = {
      bpm: 104, echoSteps: 3,
      layers: { base: { rev: 0.15 }, perc: { rev: 0.05 }, pad: { rev: 0.5 }, arp: { rev: 0.25, echo: 0.35 },
        bell: { rev: 0.6, echo: 0.2 }, arp2: { rev: 0.3, echo: 0.3, minI: 0.3 }, drive: { rev: 0.1, minI: 0.5 }, lead: { rev: 0.35, echo: 0.25, minI: 0.75 } },
      step: function (p, s, t, d) {
        var bar = Math.floor(s / 16), st = s % 16, cyc = Math.floor(bar / 32), sec = Math.floor(bar / 8) % 4;
        var prog = BLOCKS[Math.floor(bar / 4) % 8], ch = prog[bar % 4], root = 45 + ch[0];
        var tones = chord(ch[0] + 57, ch[1], 57); tones.push(tones[0] + 12, tones[1] + 12);
        var L = p.L, breakdown = (sec === 2 && bar % 8 < 2 && cyc % 2 === 1);
        // bajo
        var bp = BP[sec === 2 ? 2 : (sec + cyc) % 2 === 0 ? 0 : 1], b = bp[st];
        if (b != null) I.bass(L.base, t, root + b - 12, d * 1.6, st % 4 === 0 ? 1 : 0.75, 0.6 + 0.4 * curIntensity);
        // batería
        var K = (sec === 1 || sec === 3 || curIntensity > 0.6) ? K1 : K0;
        if (K[st] && !breakdown) I.kick(L.base, t, st === 0 ? 1 : 0.8);
        if (st === (K === K0 ? 8 : 4) || (K === K1 && st === 12)) I.snare(L.base, t, 0.55);
        if (st % 2 === 0) I.hat(L.perc, t, st % 4 === 2 ? 0.9 : 0.45, (st === 14 && bar % 2 === 1));
        if (st % 2 === 1) I.hat(L.drive, t, 0.35);
        if ((st === 7 || st === 15) && hash(bar * 7 + st) < 0.5) I.snare(L.drive, t, 0.18); // ghost
        if (bar % 8 === 7 && st >= 12) I.snare(L.drive, t, 0.3 + (st - 12) * 0.15);         // redoble
        if (bar % 8 === 7 && st === 12) I.tom(L.base, t, 50, 0.6);
        if (bar % 8 === 7 && st === 14) I.tom(L.base, t, 45, 0.6);
        // pad
        if (st === 0) I.pad(L.pad, t, tones.slice(0, 3), d * 16, 1, 650 + 350 * Math.sin(bar * 0.4) + 1500 * curIntensity);
        // arpegio
        var ap = AP[(sec * 2 + cyc) % AP.length], a = ap[st];
        if (a != null && !(breakdown && st % 4 !== 0)) I.arp(L.arp, t, tones[a] + ((bar % 4 === 3 && st >= 8) ? 12 : 0), d * 0.9, st % 4 === 0 ? 1 : 0.7);
        var a2 = ap[(st + 2) % 16]; if (a2 != null && st % 2 === 0) I.arp(L.arp2, t, tones[a2] + 12, d * 0.8, 0.6, 'triangle');
        // campanas: motivo en la sección frigia y salpicado en otras
        if (sec === 2 && (st === 0 || st === 6 || st === 10)) I.bell(L.bell, t, tones[(st / 2 + bar) % 3 | 0] + 12, 0.9);
        else if (st === 0 && bar % 4 === 0) I.bell(L.bell, t, tones[0] + 24, 0.5);
        // melodía (alta intensidad): frase de 2 compases que se repite
        if (st % 2 === 0) {
          var ph = (bar % 2) * 8 + st / 2, hv = hash(ph * 13 + Math.floor(bar / 8) * 101);
          if (hv < 0.55) I.lead(L.lead, t, 69 + scaleStep(MINOR, Math.floor(hash(ph * 31 + Math.floor(bar / 8)) * 9)), d * 2, 0.8);
        }
      }
    };
  })();

  // MENU: misterioso, órgano, Re menor armónico, 66 bpm
  (function () {
    var PROG = [[0, 'm'], [-4, 'M'], [5, 'm'], [7, 'M'], [0, 'm'], [1, 'M'], [-2, 'm'], [7, 'd7']]; // Dm Bb Gm A Dm Eb Cm A7
    var HM = [0, 2, 3, 5, 7, 8, 11];
    TRACKS.menu = {
      bpm: 66, echoSteps: 3, gain: 1.1,
      layers: { organ: { rev: 0.7 }, sub: { rev: 0.1 }, bell: { rev: 0.7, echo: 0.3 }, arp: { rev: 0.4, echo: 0.4, minI: 0.25 }, heart: { rev: 0.1, minI: 0.5 }, choir: { rev: 0.7, minI: 0.7 } },
      step: function (p, s, t, d) {
        var bar = Math.floor(s / 16), st = s % 16, ci = Math.floor(bar / 2) % 8, ch = PROG[ci], L = p.L;
        var tones = chord(ch[0] + 62, ch[1], 57);
        if (st === 0 && bar % 2 === 0) { I.organ(L.organ, t, tones.slice(0, 3), d * 32, 1); I.sub(L.sub, t, 38 + ch[0] - (ch[0] > 4 ? 12 : 0), d * 32, 0.9); }
        // melodía de campanas, escasa y variable por ciclo
        var cyc = Math.floor(bar / 16);
        if (st % 4 === 0 || st === 6 || st === 10) {
          var h = hash(bar * 16 + st + cyc * 977);
          if (h < (st === 0 ? 0.8 : 0.28)) I.bell(L.bell, t, 74 + scaleStep(HM, Math.floor(hash(bar * 5 + st + cyc) * 8)), 0.8, 2.6);
        }
        if (st % 2 === 0) I.arp(L.arp, t, tones[(st / 2) % 3] + (st >= 8 ? 12 : 0), d * 1.6, 0.6, 'triangle');
        if (st === 0 || st === 3) I.kick(L.heart, t, st === 0 ? 0.5 : 0.35);
        if (st === 0 && bar % 4 === 0) I.choir(L.choir, t, tones.slice(0, 3), d * 64, 0.8);
      }
    };
  })();

  // SHOP: lounge del infierno, swing, Do menor jazzy, 86 bpm
  (function () {
    var PROG = [[0, 'm9'], [5, 'm9'], [1, 'M7'], [7, 'b9'], [8, 'M7'], [5, 'm9'], [2, 'hd'], [7, 'b9']]; // Cm9 Fm9 DbM7 G7b9 AbM7 Fm9 Dø G7b9
    var BLUES = [0, 3, 5, 6, 7, 10];
    var COMP = [[0, 6], [3, 10], [0, 7, 14], [6, 11]];
    TRACKS.shop = {
      bpm: 86, swing: 0.2, echoSteps: 3, gain: 1.15,
      layers: { ep: { rev: 0.4 }, bass: { rev: 0.1 }, drums: { rev: 0.15 }, vibe: { rev: 0.5, echo: 0.25 }, extra: { rev: 0.4, minI: 0.4 } },
      step: function (p, s, t, d) {
        var bar = Math.floor(s / 16), st = s % 16, ch = PROG[bar % 8], nx = PROG[(bar + 1) % 8], L = p.L;
        var root = 36 + ch[0], tones = chord(ch[0] + 60, ch[1], 55);
        // piano eléctrico: comping sincopado
        var cp = COMP[(bar + Math.floor(bar / 8)) % 4];
        if (cp.indexOf(st) >= 0) I.ep(L.ep, t, tones, d * (st === 0 ? 5 : 2), st === 0 ? 1 : 0.7);
        // bajo caminante en negras
        if (st % 4 === 0) {
          var beat = st / 4, nr = 36 + nx[0], m;
          if (beat === 0) m = root; else if (beat === 1) m = root + (Q[ch[1]][1]); else if (beat === 2) m = root + 7;
          else m = nr + (hash(bar) < 0.5 ? 1 : -1); // aproximación cromática
          I.bass(L.bass, t, m, d * 3.5, beat === 0 ? 0.9 : 0.7, 0.25);
        }
        // escobillas
        if (st % 4 === 0 || st % 4 === 2) I.brush(L.drums, t, st % 4 === 2 ? 0.6 : 1);
        if (st === 4 || st === 12) I.brush(L.drums, t, 1.6);
        if (st === 0 && bar % 2 === 0) I.kick(L.drums, t, 0.4);
        // vibráfono: frases de blues menor
        var cyc = Math.floor(bar / 8);
        if (st % 2 === 0 && hash(bar * 8 + st / 2 + cyc * 331) < 0.32)
          I.vibe(L.vibe, t, 72 + scaleStep(BLUES, Math.floor(hash(bar * 3 + st + cyc * 7) * 8)), 0.9);
        if (st % 4 === 2 && hash(bar * 9 + st) < 0.5) I.vibe(L.extra, t, tones[Math.floor(hash(bar + st) * tones.length)] + 12, 0.6);
        if (st === 14) I.hat(L.extra, t, 0.5, true);
      }
    };
  })();

  // BOSS: tenso y rápido, Mi frigio dominante, 148 bpm
  (function () {
    var PROG = [[0, 'p5'], [1, 'p5'], [0, 'p5'], [6, 'p5'], [0, 'p5'], [1, 'p5'], [3, 'p5'], [1, 'p5']]; // E F E Bb E F G F
    var PD = [0, 1, 4, 5, 7, 8, 10];
    var GAL = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 12, 0, 12];
    var ARP = [0, 1, 4, 7, 12, 7, 4, 1, 0, 1, 4, 8, 12, 8, 4, 1];
    TRACKS.boss = {
      bpm: 148, echoSteps: 3, gain: 0.72,
      layers: { bass: { rev: 0.05 }, drums: { rev: 0.08 }, arp: { rev: 0.2, echo: 0.3 }, toll: { rev: 0.7 }, stab: { rev: 0.3, minI: 0.3 }, lead: { rev: 0.3, echo: 0.2, minI: 0.6 }, pad: { rev: 0.6 } },
      step: function (p, s, t, d) {
        var bar = Math.floor(s / 16), st = s % 16, ch = PROG[Math.floor(bar / 2) % 8], L = p.L;
        var root = 40 + ch[0], half = Math.floor(bar / 8) % 4 === 2; // sección a medio tiempo
        I.bass(L.bass, t, root - 12 + GAL[st], d * 0.9, GAL[st] ? 0.7 : 1, 0.8 + curIntensity * 0.6);
        if (half) { if (st === 0 || st === 10) I.kick(L.drums, t, 1); if (st === 8) I.snare(L.drums, t, 0.9); }
        else {
          if (st % 4 === 0 || st === 14) I.kick(L.drums, t, st === 14 ? 0.7 : 1);
          if (st === 4 || st === 12) I.snare(L.drums, t, 0.85);
        }
        I.hat(L.drums, t, st % 4 === 2 ? 0.8 : 0.4, st === 6 && bar % 2 === 1);
        if (bar % 8 === 7 && st >= 8 && st % 2 === 0) I.tom(L.drums, t, 52 - (st - 8), 0.8);
        I.arp(L.arp, t, 64 + ch[0] + ARP[(st + (bar % 2) * 4) % 16], d * 0.8, st % 4 === 0 ? 0.9 : 0.6, 'sawtooth');
        if (st === 0 && bar % 4 === 0) I.toll(L.toll, t, 52, 1);
        if (st === 0 && bar % 2 === 0) I.pad(L.pad, t, [52 + ch[0], 58 + ch[0], 59 + ch[0]], d * 32, 0.8, 900);
        if ((st === 0 || st === 3 || st === 6) && bar % 2 === 1) I.pad(L.stab, t, [52 + ch[0], 59 + ch[0], 64 + ch[0]], d * 1.2, 2.5, 2600);
        if (st % 2 === 0) {
          var ph = (bar % 4) * 8 + st / 2;
          if (hash(ph * 17 + Math.floor(bar / 16) * 3) < 0.45) I.lead(L.lead, t, 76 + scaleStep(PD, Math.floor(hash(ph * 7 + Math.floor(bar / 16)) * 8)), d * 2, 0.9);
        }
      }
    };
  })();

  // GAMEOVER: lúgubre, Re menor, 54 bpm. Órgano, tañidos, bajo descendente
  (function () {
    var PROG = [[0, 'm'], [5, 'm'], [-2, 'M'], [7, 'M']]; // Dm Gm C A
    var BASS = [38, 36, 34, 33]; // D C Bb A
    TRACKS.gameover = {
      bpm: 54, echoSteps: 4,
      layers: { organ: { rev: 0.8 }, bass: { rev: 0.2 }, toll: { rev: 0.8 }, bell: { rev: 0.7, echo: 0.4 }, drum: { rev: 0.5 }, choir: { rev: 0.8, minI: 0.4 } },
      step: function (p, s, t, d) {
        var bar = Math.floor(s / 16), st = s % 16, ch = PROG[bar % 4], L = p.L;
        if (st === 0) {
          I.organ(L.organ, t, chord(ch[0] + 62, ch[1], 57), d * 16, 0.9);
          I.sub(L.bass, t, BASS[bar % 4], d * 16, 0.8);
          if (bar % 2 === 0) I.toll(L.toll, t, 50, 0.9);
          if (bar % 2 === 1) I.kick(L.drum, t, 0.45);
          I.choir(L.choir, t, chord(ch[0] + 62, ch[1], 60), d * 16, 0.7);
        }
        if (st === 8 && bar % 2 === 0) I.kick(L.drum, t, 0.3);
        var mel = [[0, 81], [4, 77], [8, 76], [12, 74]], cyc = Math.floor(bar / 4);
        for (var i = 0; i < mel.length; i++)
          if (st === mel[i][0] && hash(bar * 4 + i + cyc * 13) < 0.45) I.bell(L.bell, t, mel[i][1] - (bar % 4) * 2 + (ch[1] === 'M' && i === 2 ? 1 : 0), 0.6, 3);
      }
    };
  })();

  // ---------------------------------------------------------------- secuenciador (lookahead)
  var players = [], current = null, curName = null, timer = null;
  function layerLevel(cfg) { return cfg.minI ? clamp((curIntensity - cfg.minI) / 0.15 + 0.0001, 0, 1) : 1; }
  function Player(name) {
    var def = TRACKS[name], t = now();
    this.name = name; this.def = def;
    this.out = gain(0.0001, N.musicIn);
    this.out.gain.setValueAtTime(0.0001, t);
    this.out.gain.exponentialRampToValueAtTime(def.gain || 1, t + (name === 'boss' || name === 'gameover' ? 0.6 : 1.4));
    this.L = {}; this.cfg = def.layers;
    for (var k in def.layers) {
      var c = def.layers[k], g = gain(layerLevel(c), this.out);
      if (c.rev) g.connect(gain(c.rev, N.musicRev));
      if (c.echo) g.connect(gain(c.echo, N.echoIn));
      this.L[k] = g;
    }
    this.sd = 60 / def.bpm / 4;
    this.step = 0; this.next = t + 0.08; this.stopAt = Infinity;
    N.delay.delayTime.setTargetAtTime(Math.min(1.9, this.sd * (def.echoSteps || 3)), t, 0.05);
  }
  Player.prototype.stepDur = function (s) {
    var sw = this.def.swing || 0; return this.sd * (sw ? (s % 2 === 0 ? 1 + sw : 1 - sw) : 1);
  };
  Player.prototype.fadeOut = function (secs) {
    var t = now(), g = this.out.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.exponentialRampToValueAtTime(0.0001, t + secs);
    this.stopAt = t + secs + 0.1;
  };
  Player.prototype.updateLayers = function () {
    var t = now();
    for (var k in this.L) this.L[k].gain.setTargetAtTime(layerLevel(this.cfg[k]), t, 0.5);
  };
  function tick() {
    timer = null;
    if (!ctx) return;
    try {
      var t = now(), la = (document.hidden ? 1.2 : 0.14);
      for (var i = players.length - 1; i >= 0; i--) {
        var p = players[i];
        if (t > p.stopAt) { try { p.out.disconnect(); } catch (e) { /* */ } players.splice(i, 1); continue; }
        if (p.next < t - 0.2) p.next = t + 0.02; // tras pestaña congelada: realinear
        var guard = 0;
        while (p.next < t + la && p.next < p.stopAt && guard++ < 64) {
          var d = p.stepDur(p.step);
          try { p.def.step(p, p.step, p.next, p.sd); } catch (e) { /* nunca romper el bucle */ }
          p.next += d; p.step++;
        }
      }
    } catch (e) { /* */ }
    if (players.length) timer = setTimeout(tick, 25);
  }
  function startTimer() { if (!timer) timer = setTimeout(tick, 0); }
  function setIntensityNodes(instant) {
    if (!ctx || !N.tone) return;
    var f = 4200 + curIntensity * 14000;
    if (instant) N.tone.frequency.value = f; else N.tone.frequency.setTargetAtTime(f, now(), 0.4);
  }

  function startMusic(name) {
    if (name === curName && current) return;
    if (current) current.fadeOut(name ? 1.6 : 1.2);
    current = null; curName = name || null;
    if (!name || !TRACKS[name]) return;
    current = new Player(name);
    players.push(current);
    startTimer();
  }

  // ---------------------------------------------------------------- API pública
  var A = OM.AUDIO = OM.AUDIO || {};
  A.ctx = null;
  A.available = !!AC;
  A.SFX = Object.keys(META);
  A._nodes = N; // depuración / medidores
  A.TRACKS = Object.keys(TRACKS);

  A.unlock = function () {
    try {
      if (!AC) return false;
      if (!ctx) {
        ctx = new AC({ latencyHint: 'interactive' });
        A.ctx = ctx;
        buildBuffers(); buildWaves(); buildGraph();
        // buffer silencioso (iOS)
        var s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(0);
      }
      if (ctx.state === 'suspended' && ctx.resume) { var pr = ctx.resume(); if (pr && pr.catch) pr.catch(function () {}); }
      if (pendingTrack !== undefined) { var pt = pendingTrack; pendingTrack = undefined; startMusic(pt); }
      return true;
    } catch (e) { return false; }
  };

  A.sfx = function (name, opts) {
    try {
      if (!ctx || !S[name]) return;
      if (ctx.state === 'suspended') { var pr = ctx.resume(); if (pr && pr.catch) pr.catch(function () {}); }
      var o = opts || {};
      var v = newVoice(name, o);
      var t = now() + 0.005;
      var dur = S[name](v.g, t, o) || 1;
      v.end = t + dur + 0.1;
    } catch (e) { /* silencio */ }
  };

  A.music = function (track) {
    try {
      if (track !== null && track !== undefined && !TRACKS[track]) return;
      if (!ctx) { pendingTrack = track || null; return; }
      startMusic(track || null);
    } catch (e) { /* */ }
  };
  A.currentTrack = function () { return curName; };

  A.setVolume = function (master, music, sfx) {
    try {
      if (master != null) vol.master = clamp(+master || 0, 0, 1);
      if (music != null) vol.music = clamp(+music || 0, 0, 1);
      if (sfx != null) vol.sfx = clamp(+sfx || 0, 0, 1);
      applyVolumes();
    } catch (e) { /* */ }
  };
  A.getVolume = function () { return { master: vol.master, music: vol.music, sfx: vol.sfx }; };

  Object.defineProperty(A, 'muted', {
    get: function () { return isMuted; },
    set: function (v) { isMuted = !!v; try { applyVolumes(); } catch (e) { /* */ } },
    enumerable: true, configurable: true
  });
  A.toggleMute = function () { A.muted = !isMuted; return isMuted; };

  A.intensity = function (x) {
    try {
      if (x == null) return curIntensity;
      curIntensity = clamp(+x || 0, 0, 1);
      if (!ctx) return curIntensity;
      for (var i = 0; i < players.length; i++) players[i].updateLayers();
      setIntensityNodes(false);
    } catch (e) { /* */ }
    return curIntensity;
  };

  // auto-unlock en el primer gesto (inofensivo si el motor ya llama a unlock)
  try {
    var gest = function () {
      A.unlock();
      if (ctx && ctx.state === 'running') ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { window.removeEventListener(ev, gest, true); });
    };
    ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { window.addEventListener(ev, gest, true); });
  } catch (e) { /* */ }
})();
