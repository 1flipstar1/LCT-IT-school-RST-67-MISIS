// Adapts the design to the 13 application-processing stages from logic/Этапы.md.
// Run: node to-13-stages.cjs  (from frontend/)
const fs = require('fs');
const path = 'src/main.jsx';
let t = fs.readFileSync(path, 'utf8');
const log = [];
const rep = (from, to, label) => {
  const n = t.split(from).length - 1;
  if (n !== 1) { console.error(`FAIL ${label}: occurrences = ${n}, aborting`); process.exit(1); }
  t = t.replace(from, to);
  log.push(label);
};

// --- 1. stages model: 6 -> 13 stages from logic/Этапы.md ---
rep(
`const stages = [
  { id: 'new', label: 'Новый контакт', color: '#8300ff' },
  { id: 'meeting', label: 'Встреча назначена', color: '#ff4f12' },
  { id: 'demo', label: 'Демонстрация', color: '#a64dff' },
  { id: 'pilot', label: 'Пилотирование', color: '#ff7a45' },
  { id: 'license', label: 'Лицензирование', color: '#5c00b5' },
  { id: 'done', label: 'Завершено', color: '#059669' }
];`,
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
'stages model');

// --- 2. initialCards: remap stage ids ---
rep(
`  { id: 1, university: 'Казанский федеральный университет', short: 'КФУ', product: 'МойОфис', direction: 'Информационные системы', owner: 'Алина Воронова', stage: 'new', days: 2, initials: 'КФ' },
  { id: 2, university: 'ИТМО', short: 'ИТМО', product: 'Р7-Офис', direction: 'Программная инженерия', owner: 'Михаил Орлов', stage: 'new', days: 4, initials: 'ИТ' },
  { id: 3, university: 'УрФУ им. Б. Н. Ельцина', short: 'УрФУ', product: 'SberJazz', direction: 'Информационные системы', owner: 'Елена Ким', stage: 'meeting', days: 1, initials: 'УФ' },
  { id: 4, university: 'Томский политехнический университет', short: 'ТПУ', product: 'МойОфис', direction: 'Кибербезопасность', owner: 'Алина Воронова', stage: 'meeting', days: 7, initials: 'ТП' },
  { id: 5, university: 'НИУ ВШЭ', short: 'ВШЭ', product: 'Контур', direction: 'Программная инженерия', owner: 'Михаил Орлов', stage: 'demo', days: 3, initials: 'ВШ' },
  { id: 6, university: 'Дальневосточный федеральный университет', short: 'ДВФУ', product: 'Р7-Офис', direction: 'Аналитика данных', owner: 'Елена Ким', stage: 'pilot', days: 12, initials: 'ДВ' },
  { id: 7, university: 'Московский политех', short: 'МПУ', product: 'МойОфис', direction: 'Кибербезопасность', owner: 'Алина Воронова', stage: 'license', days: 2, initials: 'МП' },
  { id: 8, university: 'Южный федеральный университет', short: 'ЮФУ', product: 'Контур', direction: 'Аналитика данных', owner: 'Михаил Орлов', stage: 'done', days: 1, initials: 'ЮФ' }`,
`  { id: 1, university: 'Казанский федеральный университет', short: 'КФУ', product: 'МойОфис', direction: 'Информационные системы', owner: 'Алина Воронова', stage: 's1', days: 2, initials: 'КФ' },
  { id: 2, university: 'ИТМО', short: 'ИТМО', product: 'Р7-Офис', direction: 'Программная инженерия', owner: 'Михаил Орлов', stage: 's1', days: 4, initials: 'ИТ' },
  { id: 3, university: 'УрФУ им. Б. Н. Ельцина', short: 'УрФУ', product: 'SberJazz', direction: 'Информационные системы', owner: 'Елена Ким', stage: 's2', days: 1, initials: 'УФ' },
  { id: 4, university: 'Томский политехнический университет', short: 'ТПУ', product: 'МойОфис', direction: 'Кибербезопасность', owner: 'Алина Воронова', stage: 's2', days: 7, initials: 'ТП' },
  { id: 5, university: 'НИУ ВШЭ', short: 'ВШЭ', product: 'Контур', direction: 'Программная инженерия', owner: 'Михаил Орлов', stage: 's3', days: 3, initials: 'ВШ' },
  { id: 6, university: 'Дальневосточный федеральный университет', short: 'ДВФУ', product: 'Р7-Офис', direction: 'Аналитика данных', owner: 'Елена Ким', stage: 's7', days: 12, initials: 'ДВ' },
  { id: 7, university: 'Московский политех', short: 'МПУ', product: 'МойОфис', direction: 'Кибербезопасность', owner: 'Алина Воронова', stage: 's5', days: 2, initials: 'МП' },
  { id: 8, university: 'Южный федеральный университет', short: 'ЮФУ', product: 'Контур', direction: 'Аналитика данных', owner: 'Михаил Орлов', stage: 's13', days: 1, initials: 'ЮФ' }`,
'initialCards stages');

// --- 3. universities registry: status texts -> new stage labels ---
rep(
`  ['Казанский федеральный университет', 'МойОфис', 'Информационные системы', 'Лицензия согласуется', 'Алина Воронова', '12.05.2026'],
  ['ИТМО', 'Р7-Офис', 'Программная инженерия', 'Встреча назначена', 'Михаил Орлов', '09.05.2026'],
  ['УрФУ им. Б. Н. Ельцина', 'SberJazz', 'Информационные системы', 'Демонстрация', 'Елена Ким', '07.05.2026'],
  ['Томский политехнический университет', 'МойОфис', 'Кибербезопасность', 'Встреча назначена', 'Алина Воронова', '04.05.2026'],
  ['НИУ ВШЭ', 'Контур', 'Программная инженерия', 'Демонстрация', 'Михаил Орлов', '02.05.2026'],
  ['Дальневосточный федеральный университет', 'Р7-Офис', 'Аналитика данных', 'Пилотирование', 'Елена Ким', '28.04.2026']`,
`  ['Казанский федеральный университет', 'МойОфис', 'Информационные системы', 'Подписание документов', 'Алина Воронова', '12.05.2026'],
  ['ИТМО', 'Р7-Офис', 'Программная инженерия', 'Организация встречи', 'Михаил Орлов', '09.05.2026'],
  ['УрФУ им. Б. Н. Ельцина', 'SberJazz', 'Информационные системы', 'Обмен документами', 'Елена Ким', '07.05.2026'],
  ['Томский политехнический университет', 'МойОфис', 'Кибербезопасность', 'Организация встречи', 'Алина Воронова', '04.05.2026'],
  ['НИУ ВШЭ', 'Контур', 'Программная инженерия', 'Обмен документами', 'Михаил Орлов', '02.05.2026'],
  ['Дальневосточный федеральный университет', 'Р7-Офис', 'Аналитика данных', 'Сопровождение внедрения', 'Елена Ким', '28.04.2026']`,
'universities statuses');

// --- 4. activity feed: stage wording ---
rep(
`['Елена Ким', 'перевела УрФУ в «Демонстрация»', '12 минут назад', 'ec'],`,
`['Елена Ким', 'перевела УрФУ на этап «Обмен документами»', '12 минут назад', 'ec'],`,
'activity wording');

// --- 5. dashboard panel: title + stage count ---
rep(
`<div><h2>Вузы по этапам</h2><span>Всего {total} вузов в работе</span></div>`,
`<div><h2>Этапы обработки заявок</h2><span>Всего {total} вузов · {stages.length} этапов</span></div>`,
'dashboard panel head');

// --- 6. dashboard bars: short labels + tooltip ---
rep(
`<span className="stage-bar-label"><i className="stage-dot" style={{background:x.color}}/>{x.label}</span>`,
`<span className="stage-bar-label" title={x.label}><i className="stage-dot" style={{background:x.color}}/>{x.short}</span>`,
'dashboard bar labels');

// --- 7. workflow columns: tooltip with full stage name ---
rep(
`<div className="col-head"><span className="stage-dot" style={{background:stage.color}}/><b>{stage.label}</b><span className="col-count">`,
`<div className="col-head"><span className="stage-dot" style={{background:stage.color}}/><b title={stage.label}>{stage.label}</b><span className="col-count">`,
'workflow col-head');

// --- 8. university modal interactions: stage labels ---
rep(`['МойОфис','Информационные системы','Лицензирование']`, `['МойОфис','Информационные системы','Подписание документов']`, 'modal stage 1');
rep(`['Р7-Офис','Программная инженерия','Демонстрация']`, `['Р7-Офис','Программная инженерия','Обмен документами']`, 'modal stage 2');
rep(`['Контур','Аналитика данных','Завершено']`, `['Контур','Аналитика данных','Контроль исполнения']`, 'modal stage 3');

// --- 9. sanity: no leftovers of the old model ---
for (const old of ["stage: 'new'", "stage: 'meeting'", "stage: 'demo'", "stage: 'pilot'", "stage: 'license'", "stage: 'done'", "'Новый контакт'", "'Встреча назначена'", "'Пилотирование'", "'Лицензирование'", "'Завершено'"]) {
  if (t.includes(old)) { console.error(`FAIL leftover: ${old}`); process.exit(1); }
}

fs.writeFileSync(path, t);
console.log(log.join(' | '));