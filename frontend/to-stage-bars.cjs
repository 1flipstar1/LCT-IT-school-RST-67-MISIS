const fs = require('fs');
const path = 'src/main.jsx';
let t = fs.readFileSync(path, 'utf8');

const from = `<div className="stage-list">{stats.map(x=><div className="stage-row" key={x.id}><span className="stage-dot" style={{background:x.color}}/><span className="stage-row-label">{x.label}</span><div className="stage-row-track"><i style={{width:(x.n/maxN*100)+'%',background:x.color}}/></div><b className="stage-row-count">{x.n}</b></div>)}</div>`;

const to = `<div className="stage-bars">{stats.map(x=><div className="stage-bar" key={x.id}><b className="stage-bar-value">{x.n}</b><div className="stage-bar-area"><i className="stage-bar-fill" style={{height:(x.n/maxN*100)+'%',background:x.color}}/></div><span className="stage-bar-label"><i className="stage-dot" style={{background:x.color}}/>{x.label}</span></div>)}</div>`;

const n = t.split(from).length - 1;
if (n !== 1) { console.error('stage-list occurrences: ' + n + ' — aborting'); process.exit(1); }
t = t.replace(from, to);
fs.writeFileSync(path, t);
console.log('stage-list replaced with vertical stage-bars');