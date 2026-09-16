// Dashboard: move the charts block (stage-stats panel) above the other blocks
// (right after the page header), so it is the first content block.
// Run: node move-charts-top.cjs  (from frontend/)
const fs = require('fs');
const path = 'src/main.jsx';
let t = fs.readFileSync(path, 'utf8');

const startTag = '<section className="panel stage-stats">';
if (t.split(startTag).length - 1 !== 1) { console.error('FAIL: stage-stats section not unique'); process.exit(1); }

const s = t.indexOf(startTag);
const e = t.indexOf('</section>', s);
if (s < 0 || e < 0) { console.error('FAIL: bounds not found'); process.exit(1); }
const block = t.slice(s, e + '</section>'.length);

// remove the block from its current position
t = t.slice(0, s) + t.slice(s + block.length);

// insert right after the dashboard page header (first occurrence in the file)
const ph = '</PageHeader>';
const p = t.indexOf(ph);
if (p < 0) { console.error('FAIL: </PageHeader> not found'); process.exit(1); }
t = t.slice(0, p + ph.length) + block + t.slice(p + ph.length);

fs.writeFileSync(path, t);
console.log('OK charts block moved above the others');