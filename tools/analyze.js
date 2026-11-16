// Informe de un registro exportado desde el juego (REGISTRO → EXPORTAR) o generado por tools/bot.js.
//   node tools/analyze.js registro-8-2026-11-16.json [--source human|bot] [--json]
global.window = global; global.document = { createElement: () => ({ getContext: () => ({}) }) };
const path = require('path'), fs = require('fs');
['core/px.js', 'game/data.js', 'game/run.js', 'game/analytics.js'].forEach((f) => require(path.join(__dirname, '../src', f)));
const file = process.argv[2];
if (!file) { console.error('uso: node tools/analyze.js <registro.json> [--source human|bot] [--json]'); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const runs = Array.isArray(raw) ? raw : raw.runs;
const si = process.argv.indexOf('--source');
const A = OM.Analytics.aggregate(runs, { source: si > 0 ? process.argv[si + 1] : null });
if (process.argv.includes('--json')) console.log(JSON.stringify(A, null, 1));
else console.log(OM.Analytics.report(A));
