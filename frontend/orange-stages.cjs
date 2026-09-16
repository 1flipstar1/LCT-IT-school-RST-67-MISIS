// Dashboard stage panel: remove the "Всего ... этапов" subtitle and switch
// all 13 stages to shades of the base orange (#ff4f12) for donut + bars.
// Run: node orange-stages.cjs  (from frontend/)
const fs = require('fs');
const path = 'src/main.jsx';
let t = fs.readFileSync(path, 'utf8');
const rep = (from, to, label) => {
  const n = t.split(from).length - 1;
  if (n !== 1) { console.error(`FAIL ${label}: occurrences = ${n}, aborting`); process.exit(1); }
  t = t.replace(from, to);
  console.log('OK ' + label);
};

// --- 1. stages -> 13 shades of base orange #ff4f12 ---
rep(
`const stages = [
  { id: 's1', label: 'Коммуникация с вузом', short: 'Коммуникация', color: '#8300ff' },
  { id: 's2', label: 'Организация встречи', short: 'Встреча', color: '#ff4f12' },
  { id: 's3', label: 'Обмен документами', short: 'Документы', color: '#a64dff' },
  { id: 's4', label: 'Корректировка документов', short: 'Правки', color: '#ff7a45' },
  { id: 's5', label: 'Подписание документов', short: 'Подписание', color: '#5c00b5' },
  { id: 's6', label: 'Передача материалов и лицензий', short: 'Передача', color: '#059669' },
  { id: 's7', label: 'Сопровождение внедрения', short: 'Внедрение', color: '#2f6fed' },
  { id: 's8', label: 'Обучение преподавателей', short: 'Обучение', color: '#f59e0b' },
  { id: 's9', label: 'Актуализация программы', short: 'Программа', color: '#0891b2' },
  { id: 's10', label: 'Ведение занятий', short: 'Занятия', color: '#db2777' },
  { id: 's11', label: 'Актуализация документации', short: 'Документация', color: '#0d9488' },
  { id: 's12', label: 'Повышение квалификации', short: 'Квалификация', color: '#7c3aed' },
  { id: 's13', label: 'Контроль исполнения', short: 'Контроль', color: '#475569' }
];`,
`const stages = [
  { id: 's1', label: 'Коммуникация с вузом', short: 'Коммуникация', color: '#ffd9c2' },
  { id: 's2', label: 'Организация встречи', short: 'Встреча', color: '#ffceb3' },
  { id: 's3', label: 'Обмен документами', short: 'Документы', color: '#ffc2a5' },
  { id: 's4', label: 'Корректировка документов', short: 'Правки', color: '#ffb796' },
  { id: 's5', label: 'Подписание документов', short: 'Подписание', color: '#ffab87' },
  { id: 's6', label: 'Передача материалов и лицензий', short: 'Передача', color: '#ffa079' },
  { id: 's7', label: 'Сопровождение внедрения', short: 'Внедрение', color: '#ff946a' },
  { id: 's8', label: 'Обучение преподавателей', short: 'Обучение', color: '#ff895b' },
  { id: 's9', label: 'Актуализация программы', short: 'Программа', color: '#ff7d4d' },
  { id: 's10', label: 'Ведение занятий', short: 'Занятия', color: '#ff723e' },
  { id: 's11', label: 'Актуализация документации', short: 'Документация', color: '#ff662f' },
  { id: 's12', label: 'Повышение квалификации', short: 'Квалификация', color: '#ff5b21' },
  { id: 's13', label: 'Контроль исполнения', short: 'Контроль', color: '#ff4f12' }
];`,
'stages -> orange shades');

// --- 2. remove the "Всего ... этапов" subtitle from the panel head ---
rep(
  '<div><h2>Этапы обработки заявок</h2><span>Всего {total} вузов · {stages.length} этапов</span></div>',
  '<div><h2>Этапы обработки заявок</h2></div>',
  'panel subtitle removed'
);

fs.writeFileSync(path, t);
console.log('done');