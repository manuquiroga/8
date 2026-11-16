// 8 — análisis de registros de partidas: detecta comodines rotos/inútiles, mesas difíciles/fáciles,
// economía, uso de mecánicas. Función pura: la usan la escena REGISTRO y tools/analyze.js.
window.OM = window.OM || {};

OM.Analytics = (function () {
  const TH = {
    minShots: 15,        // tiros con el comodín para opinar
    minRuns: 4,          // partidas para opinar de tacos/jefes
    minTables: 5,        // mesas para opinar de una mesa
    broken: 0.65,        // el comodín aporta ≥65% de los puntos donde está (un x2 Mult solo ya da ~50%)
    strong: 2.0,         // o quien lo consigue supera 2+ mesas más que quien llegó al mismo punto sin él
    useless: 0.03,       // <3%
    hard: 0.5, easy: 0.95, easyRatio: 2.5,
  };
  const base = (k) => k.split('+')[0];
  const pct = (a, b) => (b ? a / b : 0);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  // mesas superadas en la partida (medida de "hasta dónde llegó")
  const reachScore = (r) => r.tables.filter((t) => t.won).length;

  // 'human' incluye las partidas repetidas por semilla
  function matchSource(r, src) { return !src || r.source === src || (src === 'human' && r.source === 'replay'); }

  function aggregate(runs, opts) {
    opts = opts || {};
    runs = (runs || []).filter((r) => r && r.tables && matchSource(r, opts.source));
    const done = runs.filter((r) => r.outcome);
    const R = {
      runs: runs.length, finished: done.length,
      wins: done.filter((r) => r.victory).length,
      avgReach: avg(done.map(reachScore)),
      avgCircle: avg(done.map((r) => r.reached.circle + 1)),
      playMin: avg(done.map((r) => (r.playMs || 0) / 60000)),
      ratings: { facil: 0, justa: 0, dificil: 0 },
      errors: runs.reduce((a, r) => a + (r.errors ? r.errors.length : 0), 0),
      jokers: {}, tables: {}, bosses: {}, cues: {}, editions: {}, items: {},
      shots: { total: 0, n0: 0, n1: 0, n2: 0, n3: 0, scratch: 0, cursed: 0, spun: 0, spunHit: 0, plainHit: 0, plain: 0, maxStreak: 0, refunds: 0, bestShot: 0 },
      econ: { shopIn: {}, spent: 0, shops: 0, rerolls: 0, unspentAtDeath: [] },
      flags: [],
    };
    const baseline = avg(done.map(reachScore));
    const condBase = [];
    for (let k = 0; k <= 20; k++) { const v = done.map(reachScore).filter((x) => x >= k); condBase[k] = v.length ? avg(v) : k; }
    done.forEach((r) => { if (r.rating && R.ratings[r.rating] !== undefined) R.ratings[r.rating]++; });

    const J = (id) => (R.jokers[id] = R.jokers[id] || { id, offered: 0, bought: 0, packPicked: 0, packSeen: 0, runs: 0, wins: 0, reach: [], delta: [], shots: 0, contrib: 0, points: 0, maxShare: 0 });
    runs.forEach((run) => {
      const held = new Map(); // comodín → nº de mesas superadas cuando apareció por primera vez
      let wonSoFar = 0;
      // cue
      const C = (R.cues[run.cue] = R.cues[run.cue] || { id: run.cue, runs: 0, wins: 0, reach: [] });
      if (run.outcome) { C.runs++; if (run.victory) C.wins++; C.reach.push(reachScore(run)); }
      // mesas y tiros
      run.tables.forEach((tb) => {
        if (tb.won === null || tb.won === undefined) return;
        const key = (tb.infinite ? '∞' : '') + 'C' + (tb.circle + 1) + ' ' + tb.kind;
        const T = (R.tables[key] = R.tables[key] || { key, circle: tb.circle, kind: tb.kind, plays: 0, won: 0, ratio: [], shotsUsed: [], jokers: [] });
        T.plays++; if (tb.won) T.won++; T.ratio.push(tb.target ? tb.score / tb.target : 0); T.shotsUsed.push(tb.shotsUsed); T.jokers.push(tb.jokers.length);
        if (tb.boss) { const B = (R.bosses[tb.boss] = R.bosses[tb.boss] || { id: tb.boss, plays: 0, won: 0, ratio: [] }); B.plays++; if (tb.won) B.won++; B.ratio.push(tb.score / tb.target); }
        R.shots.refunds += tb.refunds || 0;
        (tb.itemsUsed || []).forEach((id) => { R.items[id] = (R.items[id] || 0) + 1; });
        tb.jokers.forEach((k) => { if (!held.has(base(k))) held.set(base(k), wonSoFar); const ed = k.split('+')[1]; if (ed) R.editions[ed] = (R.editions[ed] || 0) + 1; });
        if (tb.won) wonSoFar++;
        tb.shots.forEach((s) => {
          const S = R.shots; S.total++;
          if (s.scratch) S.scratch++; else if (s.cursed) S.cursed++;
          else if (!s.n) S.n0++; else if (s.n === 1) S.n1++; else if (s.n === 2) S.n2++; else S.n3++;
          if (s.spun) { S.spun++; if (s.n) S.spunHit++; } else { S.plain++; if (s.n) S.plainHit++; }
          S.maxStreak = Math.max(S.maxStreak, s.streak || 0); S.bestShot = Math.max(S.bestShot, s.total || 0);
          tb.jokers.forEach((k) => {
            const j = J(base(k)); j.shots++;
            if (s.total > 0) {
              const c = (s.contrib && s.contrib[k]) || 0;
              j.contrib += c; j.points += s.total;
              j.maxShare = Math.max(j.maxShare, c / s.total);
            }
          });
        });
      });
      // tiendas
      run.shops.forEach((sh) => {
        R.econ.shops++; R.econ.rerolls += sh.rerolls || 0;
        const k = 'C' + (sh.circle + 1);
        (R.econ.shopIn[k] = R.econ.shopIn[k] || []).push(sh.moneyIn);
        R.econ.spent += sh.bought.reduce((a, b) => a + b.price, 0) + (sh.rerollSpent || 0);
        sh.offered.forEach((o) => { if (o.t === 'joker') J(o.id).offered++; });
        sh.bought.forEach((o) => { if (o.t === 'joker') J(o.id).bought++; });
        sh.packs.forEach((p) => {
          if (p.kind !== 'maldito') return;
          p.options.forEach((o) => J(base(o)).packSeen++);
          if (p.picked) J(base(p.picked)).packPicked++;
        });
      });
      if (run.outcome && !run.victory && run.final) R.econ.unspentAtDeath.push(run.final.money);
      if (run.outcome) held.forEach((k0, id) => { const j = J(id); j.runs++; if (run.victory) j.wins++; j.reach.push(reachScore(run)); j.delta.push(reachScore(run) - condBase[Math.min(20, k0)]); });
    });

    // ---- métricas derivadas + banderas ----
    const name = (id) => (OM.jokerDef && OM.jokerDef(id) ? OM.jokerDef(id).name : id);
    R.jokerList = Object.values(R.jokers).map((j) => {
      const share = pct(j.contrib, j.points);
      const o = {
        id: j.id, name: name(j.id), offered: j.offered, bought: j.bought,
        pickRate: pct(j.bought, j.offered), runs: j.runs, winRate: pct(j.wins, j.runs),
        reachDelta: j.delta.length ? avg(j.delta) : 0,
        shots: j.shots, share, perShot: j.shots ? j.contrib / j.shots : 0, maxShare: j.maxShare, flag: null,
      };
      if (j.shots >= TH.minShots && share >= TH.broken) o.flag = 'ROTO';
      else if (j.runs >= 8 && o.reachDelta >= TH.strong) o.flag = 'ROTO';
      else if (j.shots >= TH.minShots && share < TH.useless && o.reachDelta < 0.5) o.flag = 'INÚTIL';
      else if (j.offered >= 10 && o.pickRate < 0.08) o.flag = 'IGNORADO';
      return o;
    }).sort((a, b) => b.share - a.share);
    R.tableList = Object.values(R.tables).map((t) => {
      const o = { key: t.key, circle: t.circle, kind: t.kind, plays: t.plays, pass: pct(t.won, t.plays), ratio: avg(t.ratio), shotsUsed: avg(t.shotsUsed), jokers: avg(t.jokers), flag: null };
      if (t.plays >= TH.minTables && o.pass < TH.hard) o.flag = 'DIFÍCIL';
      else if (t.plays >= TH.minTables && o.pass >= TH.easy && o.ratio >= TH.easyRatio) o.flag = 'FÁCIL';
      return o;
    }).sort((a, b) => (a.key.startsWith('∞') - b.key.startsWith('∞')) || a.circle - b.circle || ['menor', 'mayor', 'jefe'].indexOf(a.kind) - ['menor', 'mayor', 'jefe'].indexOf(b.kind));
    R.bossList = Object.values(R.bosses).map((b) => {
      const o = { id: b.id, name: OM.bossDef && OM.bossDef(b.id) ? OM.bossDef(b.id).name : b.id, plays: b.plays, pass: pct(b.won, b.plays), ratio: avg(b.ratio), flag: null };
      if (b.plays >= TH.minRuns && o.pass < 0.35) o.flag = 'DIFÍCIL'; else if (b.plays >= TH.minRuns && o.pass > 0.9) o.flag = 'FÁCIL';
      return o;
    }).sort((a, b) => a.pass - b.pass);
    R.cueList = Object.values(R.cues).map((c) => ({ id: c.id, runs: c.runs, winRate: pct(c.wins, c.runs), reach: avg(c.reach) }));
    const S = R.shots;
    R.shotRates = {
      miss: pct(S.n0, S.total), one: pct(S.n1, S.total), two: pct(S.n2, S.total), threePlus: pct(S.n3, S.total),
      scratch: pct(S.scratch, S.total), cursed: pct(S.cursed, S.total), spinUse: pct(S.spun, S.total),
      spinHit: pct(S.spunHit, S.spun), plainHit: pct(S.plainHit, S.plain),
    };
    R.econ.shopInAvg = Object.fromEntries(Object.entries(R.econ.shopIn).map(([k, v]) => [k, Math.round(avg(v))]));
    R.econ.rerollsPerShop = pct(R.econ.rerolls, R.econ.shops);
    R.econ.unspentAvg = avg(R.econ.unspentAtDeath);

    // ---- lista de banderas legible ----
    R.jokerList.filter((j) => j.flag).forEach((j) => R.flags.push({ kind: 'joker', flag: j.flag, id: j.id,
      text: j.name + ': ' + j.flag + ' · aporta ' + Math.round(j.share * 100) + '% de los puntos donde está · elegido ' + Math.round(j.pickRate * 100) + '% · avance ' + (j.reachDelta >= 0 ? '+' : '') + j.reachDelta.toFixed(1) + ' mesas vs quien llegó igual sin él' }));
    R.tableList.filter((t) => t.flag).forEach((t) => R.flags.push({ kind: 'table', flag: t.flag, id: t.key,
      text: t.key + ': ' + t.flag + ' · supera ' + Math.round(t.pass * 100) + '% · puntaje/objetivo x' + t.ratio.toFixed(2) + ' · ' + t.plays + ' jugadas' }));
    R.bossList.filter((b) => b.flag).forEach((b) => R.flags.push({ kind: 'boss', flag: b.flag, id: b.id,
      text: b.name + ': ' + b.flag + ' · supera ' + Math.round(b.pass * 100) + '% de ' + b.plays }));
    if (S.total >= 50 && R.shotRates.scratch > 0.12) R.flags.push({ kind: 'mech', flag: 'FALTAS', text: 'Faltas en ' + Math.round(R.shotRates.scratch * 100) + '% de los tiros' });
    if (S.total >= 50 && R.shotRates.two + R.shotRates.threePlus < 0.03) R.flags.push({ kind: 'mech', flag: 'DOBLETES', text: 'Solo ' + ((R.shotRates.two + R.shotRates.threePlus) * 100).toFixed(1) + '% de tiros con 2+ bolas: los comodines de dobletes casi no se activan' });
    if (R.econ.unspentAtDeath.length >= 5 && R.econ.unspentAvg > 15) R.flags.push({ kind: 'econ', flag: 'AHORRO', text: 'Se muere con $' + Math.round(R.econ.unspentAvg) + ' de media sin gastar: la tienda no tienta' });
    R.thresholds = TH;
    return R;
  }

  // Informe de texto (consola / tools/analyze.js)
  function report(A) {
    const P = (x) => Math.round(x * 100) + '%';
    const out = [];
    out.push('== 8 · informe de ' + A.runs + ' partidas (' + A.finished + ' terminadas, ' + A.wins + ' victorias) ==');
    out.push('Círculo medio alcanzado: ' + A.avgCircle.toFixed(2) + ' · minutos/partida: ' + A.playMin.toFixed(1) + ' · valoración F/J/D: ' + A.ratings.facil + '/' + A.ratings.justa + '/' + A.ratings.dificil + ' · errores: ' + A.errors);
    const s = A.shotRates;
    out.push('Tiros: ' + A.shots.total + ' · fallo ' + P(s.miss) + ' · 1 bola ' + P(s.one) + ' · 2 ' + P(s.two) + ' · 3+ ' + P(s.threePlus) + ' · faltas ' + P(s.scratch) + ' · maldición ' + P(s.cursed));
    out.push('Efecto usado en ' + P(s.spinUse) + ' de los tiros (acierto con efecto ' + P(s.spinHit) + ' vs sin ' + P(s.plainHit) + ') · racha máx x' + (A.shots.maxStreak + 1) + ' · mejor tiro ' + A.shots.bestShot);
    out.push('Economía: $ al entrar a la tienda ' + JSON.stringify(A.econ.shopInAvg) + ' · rerolls/tienda ' + A.econ.rerollsPerShop.toFixed(2) + ' · $ sin gastar al morir ' + A.econ.unspentAvg.toFixed(1));
    out.push('', '-- BANDERAS --');
    if (!A.flags.length) out.push('(ninguna con los datos actuales)');
    A.flags.forEach((f) => out.push('[' + f.flag + '] ' + f.text));
    out.push('', '-- COMODINES (por % de puntos aportados) --');
    out.push('comodín'.padEnd(22) + 'ofr  compr  elec   part.  aporte  /tiro   avance  victorias');
    A.jokerList.forEach((j) => out.push((j.name.slice(0, 21)).padEnd(22) + String(j.offered).padEnd(5) + String(j.bought).padEnd(7) + P(j.pickRate).padEnd(7) + String(j.runs).padEnd(7) + P(j.share).padEnd(8) + String(Math.round(j.perShot)).padEnd(8) + ((j.reachDelta >= 0 ? '+' : '') + j.reachDelta.toFixed(1)).padEnd(8) + P(j.winRate) + (j.flag ? '  ← ' + j.flag : '')));
    out.push('', '-- MESAS --');
    A.tableList.forEach((t) => out.push(t.key.padEnd(12) + 'jugadas ' + String(t.plays).padEnd(5) + 'supera ' + P(t.pass).padEnd(6) + 'pts/obj x' + t.ratio.toFixed(2).padEnd(6) + 'tiros ' + t.shotsUsed.toFixed(1).padEnd(5) + 'comodines ' + t.jokers.toFixed(1) + (t.flag ? '  ← ' + t.flag : '')));
    out.push('', '-- JEFES --');
    A.bossList.forEach((b) => out.push(b.name.padEnd(20) + 'jugadas ' + String(b.plays).padEnd(5) + 'supera ' + P(b.pass) + (b.flag ? '  ← ' + b.flag : '')));
    out.push('', '-- TACOS --');
    A.cueList.forEach((c) => out.push(c.id.padEnd(12) + 'partidas ' + String(c.runs).padEnd(5) + 'victorias ' + P(c.winRate).padEnd(6) + 'mesas superadas ' + c.reach.toFixed(1)));
    return out.join('\n');
  }

  return { aggregate, report, matchSource, TH };
})();
