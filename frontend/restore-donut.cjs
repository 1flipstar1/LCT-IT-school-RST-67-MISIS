// Dashboard stage panel: restore the donut to the LEFT of the bars,
// remove the textual (letter) labels under the columns.
// Run: node restore-donut.cjs  (from frontend/)
const fs = require('fs');
const path = 'src/main.jsx';
let t = fs.readFileSync(path, 'utf8');
const rep = (from, to, label) => {
  const n = t.split(from).length - 1;
  if (n !== 1) { console.error(`FAIL ${label}: occurrences = ${n}, aborting`); process.exit(1); }
  t = t.replace(from, to);
  console.log('OK ' + label);
};

// --- 1. restore donut-wrap before the bars container ---
rep(
  '<div className="stage-stats-body"><div className="stage-bars">',
  '<div className="stage-stats-body"><div className="donut-wrap"><div className="donut" style={{background:donutBg}}><div><strong>{total}</strong><span>всего</span></div></div></div><div className="stage-bars">',
  'donut restored on the left'
);

// --- 2. drop the letter labels under each column ---
rep(
  '<div className="stage-bar-area"><i className="stage-bar-fill" style={{height:(x.n/maxN*100)+\'%\',background:x.color}}/></div><span className="stage-bar-label" title={x.label}><i className="stage-dot" style={{background:x.color}}/>{x.short}</span></div>',
  '<div className="stage-bar-area"><i className="stage-bar-fill" style={{height:(x.n/maxN*100)+\'%\',background:x.color}}/></div></div>',
  'column letter labels removed'
);

fs.writeFileSync(path, t);
console.log('done');