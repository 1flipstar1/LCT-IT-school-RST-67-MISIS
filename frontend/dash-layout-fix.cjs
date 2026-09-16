// Dashboard layout: in the 50/50 row under the chart keep ONLY the KPI cards on
// the left (small blocks with numbers); the other blocks (filter strip,
// activity, attention) move BELOW the row, full width.
// Run: node dash-layout-fix.cjs  (from frontend/)
const fs = require('fs');
const path = 'src/main.jsx';
let t = fs.readFileSync(path, 'utf8');
const fail = (msg) => { console.error('FAIL ' + msg); process.exit(1); };

// --- locate the dash-bottom region ---
const a = t.indexOf('<div className="dash-bottom">');
if (a < 0 || t.split('<div className="dash-bottom">').length - 1 !== 1) fail('dash-bottom not unique');

const L0 = a + '<div className="dash-bottom"><div className="dash-left">'.length;
const L1 = t.indexOf('<div className="dash-right">', L0);
if (L1 < 0) fail('dash-right not found');
const LEFT = t.slice(L0, L1); // filter-strip + kpi-grid + activity + attention

const closeTail = '</div></div>';
const e = t.indexOf(closeTail + '</>', L1);
if (e < 0) fail('closing sequence not found');
const MSG = t.slice(L1, e); // '<div className="dash-right">...messages...</section>'
const suffix = t.slice(e + closeTail.length); // starts with '</>'

// --- extract only the KPI grid from the left column ---
const kStart = LEFT.indexOf('<section className="kpi-grid">');
if (kStart < 0) fail('kpi-grid not found');
const kEnd = LEFT.indexOf('</section>', kStart);
if (kEnd < 0) fail('kpi end not found');
const KPI = LEFT.slice(kStart, kEnd + '</section>'.length);
const REST = LEFT.slice(0, kStart) + LEFT.slice(kEnd + '</section>'.length);

// --- rebuild: row = [KPI | messages]; REST goes below ---
const newRegion =
  '<div className="dash-bottom"><div className="dash-left">' + KPI + '</div>' +
  MSG + '</div></div>' + REST;

t = t.slice(0, a) + newRegion + suffix;
fs.writeFileSync(path, t);
console.log('OK left column = KPI only; other blocks below');