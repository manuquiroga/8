// 8 — registro de partidas (telemetría local). Formato documentado en docs/TELEMETRY.md.
// El registro vive en R.log (se guarda/continúa junto con la partida) y al terminar
// la partida se archiva en OM.LOG.store (localStorage en el navegador, array en Node).
// Todo es JSON plano: se puede exportar, analizar con tools/analyze.js y comparar con el bot.
window.OM = window.OM || {};

OM.LOG = (function () {
  const VERSION = 2;          // formato del registro
  const MAX_RUNS = 300;       // historial máximo guardado (para más, exportar y usar tools/analyze.js)
  const KEY = 'om_logs';
  const now = () => Date.now();
  const jid = (J) => J.id + (J.edition ? '+' + J.edition : '');

  // ---------- almacenamiento ----------
  const mem = [];
  const store = {
    all() {
      if (typeof localStorage === 'undefined') return mem;
      try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
    },
    put(log) {
      if (typeof localStorage === 'undefined') { const i = mem.findIndex((r) => r.id === log.id); if (i >= 0) mem[i] = log; else mem.push(log); return; }
      const arr = store.all();
      const i = arr.findIndex((r) => r.id === log.id);
      if (i >= 0) arr[i] = log; else arr.push(log);
      while (arr.length > MAX_RUNS) arr.shift();
      store.write(arr);
    },
    // escribe; si localStorage se llena (~5 MB), descarta primero partidas de bot y luego las más viejas
    write(arr) {
      for (let tries = 0; tries < 8; tries++) {
        try { localStorage.setItem(KEY, JSON.stringify(arr)); return true; } catch (e) {
          const drop = Math.max(1, Math.ceil(arr.length * 0.15));
          const bots = arr.filter((r) => r.source === 'bot');
          if (bots.length) bots.slice(0, drop).forEach((b) => arr.splice(arr.indexOf(b), 1));
          else arr.splice(0, drop);
        }
      }
      console.warn('LOG: sin espacio para el registro'); return false;
    },
    clear() { mem.length = 0; try { localStorage.removeItem(KEY); } catch (e) {} },
    import(list) {
      if (typeof localStorage === 'undefined') { (list || []).forEach((r) => r && r.id && store.put(r)); return; }
      const arr = store.all(), ids = new Map(arr.map((r, i) => [r.id, i]));
      (list || []).forEach((r) => { if (!r || !r.id) return; if (ids.has(r.id)) arr[ids.get(r.id)] = r; else { ids.set(r.id, arr.length); arr.push(r); } });
      while (arr.length > MAX_RUNS) arr.shift();
      store.write(arr);
    },
  };

  function L(R) { return R && R.log; }
  function money(R, reason, delta) {
    const lg = L(R); if (!lg) return;
    lg.money.push([Math.round((now() - lg.startedAt) / 1000), R.money, reason, delta || 0]);
    if (lg.money.length > 600) lg.money.splice(1, 1);
  }

  // ---------- partida ----------
  function startRun(R, source) {
    R.log = {
      v: VERSION, game: 'v1.1', id: R.seedStr + '-' + now().toString(36),
      source: source || 'human', seed: R.seed, seedStr: R.seedStr, cue: R.cue,
      startedAt: now(), endedAt: null, playMs: 0,
      outcome: null, reached: { circle: 0, table: 0 }, rating: null, victory: false,
      tables: [], shops: [], money: [], errors: [], items: [],
      final: null,
    };
    money(R, 'inicio');
    return R.log;
  }

  function snapshot(R) {
    return {
      jokers: R.jokers.map(jid), items: R.items.slice(), money: R.money,
      levels: Object.assign({}, R.levels),
      balls: R.balls.reduce((a, b) => { a[b.kind] = (a[b.kind] || 0) + 1; return a; }, { total: R.balls.length }),
    };
  }

  function endRun(R, outcome) {
    const lg = L(R); if (!lg) return;
    if (lg.outcome && lg.outcome !== 'victory') return; // ya cerrado (salvo victoria → infinito)
    lg.outcome = outcome; if (outcome === 'victory') lg.victory = true;
    lg.endedAt = now();
    lg.reached = { circle: R.circle, table: R.tableIdx };
    lg.final = snapshot(R);
    lg.stats = Object.assign({}, R.stats);
    store.put(lg);
  }

  function rate(R, rating) { const lg = L(R); if (!lg) return; lg.rating = rating; store.put(lg); }

  // ---------- mesas ----------
  function tableStart(R, T) {
    const lg = L(R); if (!lg) return;
    lg.tables.push({
      circle: R.circle, kind: ['menor', 'mayor', 'jefe'][R.tableIdx], boss: T.boss || null, infinite: !!R.infinite,
      target: T.target, shotsStart: T.shots, score: 0, shotsUsed: 0, won: null,
      moneyStart: R.money, moneyEnd: null, cashout: null, t0: now(), ms: 0,
      jokers: R.jokers.map(jid), engraved: R.balls.filter((b) => b.kind !== 'normal').length,
      shots: [], refunds: 0, itemsUsed: [],
    });
  }
  function curTable(R) { const lg = L(R); return lg && lg.tables[lg.tables.length - 1]; }

  // aporte marginal de cada comodín: total real − total sin ese comodín
  function contributions(R, shot, total) {
    const out = {};
    if (!total || !R.jokers.length) return out;
    R.jokers.forEach((J, i) => {
      const saved = R.jokers;
      R.jokers = saved.slice(0, i).concat(saved.slice(i + 1));
      let t = 0;
      try { t = OM.Run.score(R, shot).total; } catch (e) { t = total; }
      R.jokers = saved;
      out[jid(J)] = total - t;
    });
    return out;
  }

  function shot(R, shotIn, S, extra) {
    const tb = curTable(R); if (!tb) return;
    const money = S.events.filter((e) => e.k === 'money').reduce((a, e) => a + e.v, 0);
    const rec = {
      i: tb.shots.length,
      n: shotIn.balls.length, counted: S.balls ? S.balls.length : 0,
      balls: shotIn.balls.map((b) => b.ball.num + (b.ball.kind !== 'normal' ? ':' + b.ball.kind : '') + (b.banked ? 'B' : '') + (b.pocket && !b.pocket.corner ? 'L' : '')),
      type: S.typeId || null, chips: Math.round(S.chips || 0), mult: Math.round((S.mult || 0) * 100) / 100, total: S.total,
      scratch: !!shotIn.scratch, cursed: !!shotIn.cursed, clear: !!shotIn.clear, isBreak: !!shotIn.isBreak,
      streak: shotIn.streak || 0, cargaIn: shotIn.carga || 0, spun: !!shotIn.spun, cushions: shotIn.cueCushions, contacts: shotIn.cueContacts,
      money, contrib: contributions(R, shotIn, S.total),
    };
    if (extra) Object.assign(rec, extra);
    tb.shots.push(rec);
    if (S.isFreeBreak) { rec.freeBreak = true; rec.carga = S.carga; } else tb.shotsUsed++;
    tb.score += S.total;
  }

  function tableEnd(R, won, T, cashout) {
    const tb = curTable(R); if (!tb || tb.won !== null) return;
    tb.won = won; tb.score = T.score; tb.ms = now() - tb.t0;
    tb.shotsLeft = T.shots; tb.refunds = T.refunded ? 1 : 0;
    tb.cashout = cashout || null; tb.moneyEnd = R.money + (cashout || 0);
    const lg = L(R); lg.playMs += tb.ms;
    lg.reached = { circle: R.circle, table: R.tableIdx };
    money(R, won ? 'mesa ganada' : 'mesa perdida', cashout || 0);
  }

  // ---------- tienda ----------
  function shopStart(R, shop, restored) {
    const lg = L(R); if (!lg) return;
    if (restored && lg.shops.length) return;
    lg.shops.push({
      circle: R.circle, table: R.tableIdx, moneyIn: R.money, moneyOut: null, rerolls: 0, rerollSpent: 0,
      offered: offers(shop), bought: [], sold: [], packs: [], itemsUsed: [],
    });
  }
  function offers(shop) {
    return [].concat(
      shop.slots.map((o) => ({ t: 'joker', id: o.id, ed: o.J.edition || null, price: o.price })),
      shop.items.map((o) => ({ t: 'item', id: o.id, price: o.price })),
      shop.packs.map((o) => ({ t: 'pack', id: o.kind, price: o.price })),
    );
  }
  function curShop(R) { const lg = L(R); return lg && lg.shops[lg.shops.length - 1]; }
  function buy(R, o) {
    const sh = curShop(R); if (!sh) return;
    sh.bought.push({ t: o.type, id: o.type === 'pack' ? o.kind : o.id, ed: o.J ? o.J.edition || null : null, price: o.price });
    money(R, 'compra ' + (o.id || o.kind), -o.price);
  }
  function reroll(R, shop, cost) {
    const sh = curShop(R); if (!sh) return;
    sh.rerolls++; sh.rerollSpent += cost;
    sh.offered = sh.offered.concat(offers(shop).filter((o) => o.t !== 'pack'));
    money(R, 'reroll', -cost);
  }
  function packPick(R, kind, opts, picked) {
    const sh = curShop(R); if (!sh) return;
    sh.packs.push({ kind, options: opts.map((o) => o.id + (o.J && o.J.edition ? '+' + o.J.edition : '')), picked: picked == null ? null : picked });
  }
  function shopEnd(R) { const sh = curShop(R); if (sh && sh.moneyOut === null) sh.moneyOut = R.money; }

  // ---------- genéricos ----------
  function sell(R, what, id, price) {
    const lg = L(R); if (!lg) return;
    const sh = curShop(R);
    const rec = { t: what, id, price, circle: R.circle, table: R.tableIdx };
    if (sh && sh.moneyOut === null) sh.sold.push(rec); else (lg.soldOutside = lg.soldOutside || []).push(rec);
    money(R, 'venta ' + id, price);
  }
  function item(R, id, where) {
    const lg = L(R); if (!lg) return;
    lg.items.push({ id, where, circle: R.circle, table: R.tableIdx });
    const tb = where === 'table' ? curTable(R) : null;
    if (tb) tb.itemsUsed.push(id);
  }
  function error(R, msg) {
    const lg = L(R); if (!lg) return;
    if (lg.errors.length < 30) lg.errors.push({ t: Math.round((now() - lg.startedAt) / 1000), msg: String(msg).slice(0, 300) });
  }

  return { VERSION, store, startRun, endRun, rate, tableStart, shot, tableEnd, shopStart, buy, reroll, packPick, shopEnd, sell, item, error, money, contributions };
})();
