// Dashboard stage panel: all 13 stages become ONE chart (donut removed),
// numeric labels above bars removed (count moved into the tooltip).
// Run: node to-single-chart.cjs  (from frontend/)
const fs = require('fs');
const path = 'src/main.jsx';
let t = fs.readFileSync(path, 'utf8');
const rep = (from, to, label) => {
  const n = t.split(from).length - 1;
  if (n !== 1) { console.error(`FAIL ${label}: occurrences = ${n}, aborting`); process.exit(1); }
  t = t.replace(from, to);
  console.log('OK ' + label);
};

// --- 1. remove donut, keep single chart container ---
rep(
  '<div className="stage-stats-body"><div className="donut-wrap"><div className="donut" style={{background:donutBg}}><div><strong>{total}</strong><span>всего</span></div></div></div><div className="stage-bars">',
  '<div className="stage-stats-body"><div className="stage-bars">',
  'donut removed (single chart)'
);

// --- 2. remove numeric labels above bars; count goes to the tooltip ---
rep(
  '<div className="stage-bar" key={x.id}><b className="stage-bar-value">{x.n}</b><div className="stage-bar-area">',
  '<div className="stage-bar" key={x.id} title={`' + '${x.label}: ${x.n}' + '`}><div className="stage-bar-area">',
  'top values removed (tooltip added)'
);

fs.writeFileSync(path, t);
console.log('done');