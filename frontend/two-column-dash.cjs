// Dashboard: rename chart title and add a 50/50 two-column layout below the chart
// (left: existing stats blocks; right: new messages panel).
// Run: node two-column-dash.cjs  (from frontend/)
const fs = require('fs');
const path = 'src/main.jsx';
let t = fs.readFileSync(path, 'utf8');
const fail = (msg) => { console.error('FAIL ' + msg); process.exit(1); };

// --- 1. chart title ---
{
  const from = '<h2>Этапы обработки заявок</h2>';
  const to = '<h2>Распределение заявок по этапам</h2>';
  const n = t.split(from).length - 1;
  if (n !== 1) fail('chart title occurrences = ' + n);
  t = t.replace(from, to);
  console.log('OK chart title');
}

// --- 2. locate the tail: filter-strip .. attention panel (before dashboard fragment close) ---
const tailStart = t.indexOf('<div className="filter-strip">');
if (tailStart < 0) fail('filter-strip not found');
const closeTag = '</section></>';
const cIdx = t.indexOf(closeTag);
if (cIdx < 0 || cIdx < tailStart) fail('dashboard close tag not found');

const leftBlocks = t.slice(tailStart, cIdx); // ends with attention panel's </section>

const messages =
  '<section className="panel messages-panel"><div className="panel-head"><div><h2>Сообщения</h2><span>3 непрочитанных</span></div><button className="dots"><More size={19} fill="currentColor"/></button></div>' +
  '<div className="messages-list">' +
  '<div className="message"><span className="avatar tiny">АК</span><div><b>Алексей Козлов</b><p>Обновите статус взаимодействия по Казанскому федеральному университету</p><span>10 минут назад</span></div></div>' +
  '<div className="message"><span className="avatar tiny ec">ЕК</span><div><b>Елена Ким</b><p>Загружен новый пакет документов для подписания</p><span>1 час назад</span></div></div>' +
  '<div className="message"><span className="avatar tiny sys">СИ</span><div><b>Система</b><p>Синхронизация с LMS завершена: обновлено 24 записи</p><span>вчера, 18:42</span></div></div>' +
  '</div></section>';

const newTail =
  '<div className="dash-bottom">' +
    '<div className="dash-left">' + leftBlocks + '</div>' +
    '<div className="dash-right">' + messages + '</div>' +
  '</div>' + '</>';

t = t.slice(0, tailStart) + newTail + t.slice(cIdx + closeTag.length);
console.log('OK two-column layout (left stats / right messages)');

fs.writeFileSync(path, t);
console.log('done');