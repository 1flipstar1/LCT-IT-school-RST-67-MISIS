const fs = require('fs');
const path = 'src/main.jsx';
let t = fs.readFileSync(path, 'utf8');
const log = [];
const fail = (msg) => { console.error(msg); process.exit(1); };

// --- 0. verify anchors ---
const anchors = [
  'function Dashboard({setPage,notify,cards}) { return <>',
  '<section className="panel stage-chart">',
  '<div className="dashboard-grid">',
  '<section className="panel activity-panel">',
  '</div><section className="panel attention-panel">'
];
for (const a of anchors) {
  const n = t.split(a).length - 1;
  if (n !== 1) fail('anchor not unique: "' + a.slice(0, 40) + '" -> ' + n);
}

// --- 1. helper before Dashboard ---
const helper = 'function stageStats(cards){return stages.map(s=>({id:s.id,label:s.label,color:s.color,n:cards.filter(c=>c.stage===s.id).length}))}\n';
t = t.replace('function Dashboard({setPage,notify,cards})', helper + 'function Dashboard({setPage,notify,cards})');
log.push('helper inserted');

// --- 2. Dashboard signature: computed values ---
const sigSearch = 'function Dashboard({setPage,notify,cards}) { return <>';
const sigReplace = 'function Dashboard({setPage,notify,cards}) { const stats=stageStats(cards);const total=stats.reduce((a,x)=>a+x.n,0)||1;const maxN=Math.max(1,...stats.map(x=>x.n));let acc=0;const slices=[];for(const x of stats){if(!x.n)continue;const a=(acc/total*360);acc+=x.n;const b=(acc/total*360);slices.push(x.color+\' \'+a+\'deg \'+b+\'deg\')}const donutBg=\'conic-gradient(\'+slices.join(\',\')+\')\'; return <>';
t = t.replace(sigSearch, sigReplace);
log.push('signature computed block');

// --- 3. remove old stage-chart section (vertical bars) ---
const sA = t.indexOf('<section className="panel stage-chart">');
const eA = t.indexOf('<div className="dashboard-grid">');
if (sA < 0 || eA < 0 || eA < sA) fail('stage-chart bounds bad');
t = t.slice(0, sA) + t.slice(eA);
log.push('old bar-chart panel removed');

// --- 4. remove dashboard-grid wrapper + old chart-panel (donut) ---
const sB = t.indexOf('<div className="dashboard-grid">');
const eB = t.indexOf('<section className="panel activity-panel">');
if (sB < 0 || eB < 0 || eB < sB) fail('dashboard-grid bounds bad');
t = t.slice(0, sB) + t.slice(eB);
log.push('dashboard-grid wrapper + old donut panel removed');

// --- 5. remove dashboard-grid closing div ---
t = t.replace('</div><section className="panel attention-panel">', '<section className="panel attention-panel">');
log.push('dashboard-grid closing tag removed');

// --- 6. insert combined modern panel before activity-panel ---
const combined = '<section className="panel stage-stats"><div className="panel-head"><div><h2>Вузы по этапам</h2><span>Всего {total} вузов в работе</span></div><button className="dots"><More size={19} fill="currentColor"/></button></div><div className="stage-stats-body"><div className="donut-wrap"><div className="donut" style={{background:donutBg}}><div><strong>{total}</strong><span>всего</span></div></div></div><div className="stage-list">{stats.map(x=><div className="stage-row" key={x.id}><span className="stage-dot" style={{background:x.color}}/><span className="stage-row-label">{x.label}</span><div className="stage-row-track"><i style={{width:(x.n/maxN*100)+\'%\',background:x.color}}/></div><b className="stage-row-count">{x.n}</b></div>)}</div></div></section>';
t = t.replace('<section className="panel activity-panel">', combined + '<section className="panel activity-panel">');
log.push('combined panel inserted');

fs.writeFileSync(path, t);
console.log(log.join(' | '));