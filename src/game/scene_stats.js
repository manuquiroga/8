// 8 — escena REGISTRO: análisis de las partidas guardadas (OM.LOG + OM.Analytics).
window.OM = window.OM || {};
OM.SCENES = OM.SCENES || {};

(function () {
  const W = OM.W, CX = W / 2;
  const TABS = [['resumen', 'RESUMEN'], ['banderas', 'BANDERAS'], ['comodines', 'COMODINES'], ['mesas', 'MESAS'], ['partidas', 'PARTIDAS']];
  const SOURCES = [[null, 'TODAS'], ['human', 'MÍAS'], ['bot', 'BOT']];
  const P = (x) => Math.round(x * 100) + '%';
  const FLAGC = { 'SAQUE': 'v', 'ROTO': 'c', 'INÚTIL': '6', 'IGNORADO': '6', 'DIFÍCIL': 'b', 'FÁCIL': 'm', 'FALTAS': 'v', 'DOBLETES': 'v', 'AHORRO': 'h' };
  const LIST = { x: 16, y: 74, w: 608, h: 240, lh: 12 };

  OM.SCENES.stats = {
    enter() { this.tab = 'resumen'; this.src = null; this.scroll = 0; this.confirm = 0; this.msg = null; this.refresh(); },
    refresh() {
      this.runs = OM.LOG.store.all();
      this.A = OM.Analytics.aggregate(this.runs, { source: this.src });
      this.scroll = 0;
    },
    update() {
      const IN = OM.IN;
      if (IN.wheel) this.scroll = Math.max(0, this.scroll + IN.wheel * 3);
      if (IN.kp.ArrowDown) this.scroll++; if (IN.kp.ArrowUp) this.scroll = Math.max(0, this.scroll - 1);
      if (this.msg) { this.msg.t -= 1 / 60; if (this.msg.t <= 0) this.msg = null; }
    },
    draw(ctx, t) {
      const G = OM.G, A = this.A;
      OM.UI.drawBackground(ctx, t, 'map');
      ctx.globalAlpha = 0.75; ctx.fillStyle = OM.PAL['0']; ctx.fillRect(0, 0, W, OM.H); ctx.globalAlpha = 1;
      OM.FONT.draw(ctx, 'REGISTRO DE PARTIDAS', CX, 8, { color: '8', size: 2, align: 'center', shadow: '0' });
      // pestañas
      TABS.forEach(([k, lbl], i) => {
        if (G.button(16 + i * 92, 32, 88, 16, lbl, this.tab === k ? 'gold' : 'dark')) { this.tab = k; this.scroll = 0; }
      });
      SOURCES.forEach(([k, lbl], i) => {
        if (G.button(488 + i * 46, 32, 44, 16, lbl, this.src === k ? 'blue' : 'dark')) { this.src = k; this.refresh(); }
      });
      OM.FONT.draw(ctx, A.runs + ' partidas · ' + A.finished + ' terminadas · ' + A.wins + ' victorias' + (A.runs < 10 ? ' · juega más para que las banderas sean fiables' : ''), 16, 56, { color: '6' });
      OM.UI.panel(ctx, LIST.x - 6, LIST.y - 6, LIST.w + 12, LIST.h + 10, 'inset');
      const rows = this.rows(A);
      const max = Math.floor(LIST.h / LIST.lh);
      this.scroll = Math.min(this.scroll, Math.max(0, rows.length - max));
      rows.slice(this.scroll, this.scroll + max).forEach((r, i) => {
        const y = LIST.y + i * LIST.lh;
        if (typeof r === 'string') { OM.FONT.draw(ctx, r, LIST.x, y, { color: '7' }); return; }
        (r.cols || []).forEach((c) => OM.FONT.draw(ctx, String(c.v), LIST.x + c.x, y, { color: c.c || r.c || '7', align: c.a || 'left' }));
        if (r.text) OM.FONT.draw(ctx, r.text, LIST.x + (r.x || 0), y, { color: r.c || '7' });
      });
      if (rows.length > max) OM.FONT.draw(ctx, (this.scroll + 1) + '-' + Math.min(rows.length, this.scroll + max) + ' de ' + rows.length + ' · rueda o flechas', LIST.x + LIST.w, LIST.y + LIST.h + 6, { color: '5', align: 'right' });
      // acciones
      const by = 334;
      if (G.button(16, by, 96, 18, 'EXPORTAR', 'green')) this.exportJSON();
      if (G.button(118, by, 96, 18, 'IMPORTAR', 'blue')) this.importJSON();
      if (G.button(220, by, 120, 18, this.confirm ? '¿SEGURO? BORRAR' : 'BORRAR TODO', 'red')) {
        if (this.confirm) { OM.LOG.store.clear(); this.confirm = 0; this.refresh(); this.toast('Registro borrado'); } else this.confirm = 1;
      }
      if (G.button(W - 116, by, 100, 18, 'VOLVER', 'dark', false, 'Escape')) OM.go('title');
      if (this.msg) OM.FONT.draw(ctx, this.msg.text, CX + 40, by + 5, { color: 'm', align: 'center' });
    },
    toast(text) { this.msg = { text, t: 3 }; },

    rows(A) {
      const out = [];
      const H = (txt) => ({ text: txt, c: 'h' });
      if (this.tab === 'resumen') {
        const s = A.shotRates, e = A.econ;
        out.push(H('PARTIDAS'));
        out.push('  Círculo medio alcanzado ' + A.avgCircle.toFixed(2) + ' · ' + A.playMin.toFixed(1) + ' min de juego por partida · errores registrados ' + A.errors);
        out.push('  Valoración: fácil ' + A.ratings.facil + ' · justa ' + A.ratings.justa + ' · difícil ' + A.ratings.dificil);
        out.push(''); out.push(H('TIROS (' + A.shots.total + ')'));
        out.push('  Fallo ' + P(s.miss) + ' · 1 bola ' + P(s.one) + ' · 2 bolas ' + P(s.two) + ' · 3+ ' + P(s.threePlus));
        out.push('  Faltas ' + P(s.scratch) + ' · maldición de la 8 ' + P(s.cursed) + ' · tiros recuperados ' + A.shots.refunds);
        out.push('  Efecto en ' + P(s.spinUse) + ' de los tiros · acierta ' + P(s.spinHit) + ' con efecto vs ' + P(s.plainHit) + ' sin efecto');
        out.push('  Racha máxima x' + (A.shots.maxStreak + 1) + ' · mejor tiro ' + OM.fmt(A.shots.bestShot));
        out.push(''); out.push(H('ECONOMÍA'));
        out.push('  $ medio al entrar a la tienda: ' + Object.entries(e.shopInAvg).map(([k, v]) => k + ' $' + v).join(' · '));
        out.push('  Rerolls por tienda ' + e.rerollsPerShop.toFixed(2) + ' · $ sin gastar al morir ' + e.unspentAvg.toFixed(1) + ' · gastado total $' + e.spent);
        out.push('  Ediciones vistas en mesa: ' + (Object.entries(A.editions).map(([k, v]) => k + ' ' + v).join(' · ') || '-'));
        out.push('  Consumibles usados: ' + (Object.entries(A.items).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + v).join(' · ') || '-'));
        out.push(''); out.push(H('TACOS'));
        A.cueList.forEach((c) => out.push({ cols: [{ x: 8, v: c.id }, { x: 120, v: c.runs + ' partidas' }, { x: 220, v: P(c.winRate) + ' victorias' }, { x: 330, v: 'mesas superadas ' + c.reach.toFixed(1) + ' mesas' }] }));
        out.push(''); out.push(H('JEFES'));
        A.bossList.forEach((b) => out.push({ cols: [{ x: 8, v: b.name }, { x: 160, v: b.plays + ' jugadas' }, { x: 250, v: 'supera ' + P(b.pass) }, { x: 340, v: 'pts/obj x' + b.ratio.toFixed(2) }, { x: 450, v: b.flag || '', c: FLAGC[b.flag] }] }));
      } else if (this.tab === 'banderas') {
        out.push(H('Lo que el registro considera sospechoso (umbral: ' + A.thresholds.minShots + ' tiros / ' + A.thresholds.minTables + ' mesas)'));
        if (!A.flags.length) out.push('  Nada por ahora. Hacen falta más partidas, o el balance está sano.');
        A.flags.forEach((f) => out.push({ cols: [{ x: 4, v: '[' + f.flag + ']', c: FLAGC[f.flag] || '7' }, { x: 74, v: f.text.replace(/^[^:]+: [^·]+· /, (m) => m.split(':')[0] + ': ') }] }));
        out.push(''); out.push(H('Cómo leerlo'));
        out.push('  ROTO: aporta ≥65% de los puntos, o quien lo consigue supera 2+ mesas más que quien llegó al mismo punto.');
        out.push('  INÚTIL: aporta <3% · IGNORADO: casi nadie lo compra · DIFÍCIL/FÁCIL: % de mesas superadas.');
      } else if (this.tab === 'comodines') {
        out.push({ c: '6', cols: [{ x: 0, v: 'COMODÍN' }, { x: 150, v: 'OFR' }, { x: 182, v: 'COMP' }, { x: 220, v: 'ELIGE' }, { x: 262, v: 'PART' }, { x: 300, v: '% PTS' }, { x: 346, v: 'PTS/TIRO' }, { x: 410, v: 'AVANCE' }, { x: 462, v: 'VICT' }, { x: 506, v: 'BANDERA' }] });
        A.jokerList.forEach((j) => out.push({ cols: [
          { x: 0, v: j.name.slice(0, 22), c: '8' }, { x: 150, v: j.offered }, { x: 182, v: j.bought }, { x: 220, v: P(j.pickRate) }, { x: 262, v: j.runs },
          { x: 300, v: P(j.share), c: j.share >= 0.45 ? 'c' : j.share < 0.03 && j.shots >= 15 ? '5' : 'q' },
          { x: 346, v: Math.round(j.perShot) }, { x: 410, v: (j.reachDelta >= 0 ? '+' : '') + j.reachDelta.toFixed(1), c: j.reachDelta >= 1.5 ? 'm' : j.reachDelta <= -1.5 ? 'b' : '7' },
          { x: 462, v: P(j.winRate) }, { x: 506, v: j.flag || '', c: FLAGC[j.flag] },
        ] }));
        out.push(''); out.push({ text: '% PTS = parte del puntaje que se pierde al quitar ese comodín · AVANCE = mesas de más vs la media', c: '5' });
      } else if (this.tab === 'mesas') {
        out.push({ c: '6', cols: [{ x: 0, v: 'MESA' }, { x: 110, v: 'JUGADAS' }, { x: 180, v: 'SUPERA' }, { x: 240, v: 'PTS/OBJ' }, { x: 310, v: 'TIROS' }, { x: 370, v: 'COMODINES' }, { x: 450, v: 'BANDERA' }] });
        A.tableList.forEach((tb) => out.push({ cols: [
          { x: 0, v: tb.key, c: tb.kind === 'jefe' ? 'd' : '8' }, { x: 110, v: tb.plays }, { x: 180, v: P(tb.pass), c: tb.pass < 0.5 ? 'b' : tb.pass > 0.9 ? 'm' : '7' },
          { x: 240, v: 'x' + tb.ratio.toFixed(2) }, { x: 310, v: tb.shotsUsed.toFixed(1) }, { x: 370, v: tb.jokers.toFixed(1) }, { x: 450, v: tb.flag || '', c: FLAGC[tb.flag] },
        ] }));
      } else if (this.tab === 'partidas') {
        out.push({ c: '6', cols: [{ x: 0, v: 'FECHA' }, { x: 84, v: 'TACO' }, { x: 160, v: 'FIN' }, { x: 220, v: 'LLEGÓ' }, { x: 280, v: 'MIN' }, { x: 320, v: 'VALOR.' }, { x: 380, v: 'COMODINES FINALES' }] });
        this.runs.filter((r) => OM.Analytics.matchSource(r, this.src)).slice().reverse().forEach((r) => {
          const d = new Date(r.startedAt);
          const date = (d.getDate() + '').padStart(2, '0') + '/' + (d.getMonth() + 1 + '').padStart(2, '0') + ' ' + (d.getHours() + '').padStart(2, '0') + ':' + (d.getMinutes() + '').padStart(2, '0');
          const fin = r.victory ? (r.outcome === 'victory' ? 'VICTORIA' : 'VICT+∞') : r.outcome === 'quit' ? 'abandonó' : r.outcome === 'lose' ? 'perdió' : 'en curso';
          out.push({ cols: [
            { x: 0, v: date + (r.source === 'bot' ? ' b' : '') }, { x: 84, v: r.cue }, { x: 160, v: fin, c: r.victory ? 'h' : r.outcome ? 'b' : '6' },
            { x: 220, v: 'C' + (r.reached.circle + 1) + '·' + ['m', 'M', 'J'][r.reached.table] }, { x: 280, v: ((r.playMs || 0) / 60000).toFixed(0) },
            { x: 320, v: r.rating || '-' }, { x: 380, v: ((r.final && r.final.jokers) || []).map((k) => k.split('+')[0]).join(', ').slice(0, 44) },
          ] });
        });
      }
      return out;
    },

    exportJSON() {
      try {
        const data = JSON.stringify({ game: '8', exportedAt: new Date().toISOString(), runs: OM.LOG.store.all() }, null, 1);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        a.download = 'registro-8-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        this.toast('Exportado: ' + a.download);
      } catch (e) { this.toast('No se pudo exportar'); }
    },
    importJSON() {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        f.text().then((txt) => {
          const o = JSON.parse(txt);
          const runs = Array.isArray(o) ? o : o.runs;
          OM.LOG.store.import(runs);
          this.refresh(); this.toast('Importadas ' + (runs || []).length + ' partidas');
        }).catch(() => this.toast('Archivo no válido'));
      };
      inp.click();
    },
  };
})();
