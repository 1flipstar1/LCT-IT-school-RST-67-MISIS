/**
 * Демо-данные экранов прежнего дизайна (ветка main). Перенесены из frontend/src/main.jsx
 * той ветки как есть: 13 этапов обработки заявок, карточки взаимодействий и список вузов.
 * Новые экраны берут данные из store/ — здесь оставлен демонстрационный набор main.
 */

export const LEGACY_STAGES = [
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
  { id: 's13', label: 'Контроль исполнения', short: 'Контроль', color: '#ff4f12' },
];

export const LEGACY_CARDS = [
  { id: 1, university: 'Казанский федеральный университет', short: 'КФУ', product: 'МойОфис', direction: 'Информационные системы', owner: 'Алина Воронова', stage: 's1', days: 2, initials: 'КФ' },
  { id: 2, university: 'ИТМО', short: 'ИТМО', product: 'Р7-Офис', direction: 'Программная инженерия', owner: 'Михаил Орлов', stage: 's1', days: 4, initials: 'ИТ' },
  { id: 3, university: 'УрФУ им. Б. Н. Ельцина', short: 'УрФУ', product: 'SberJazz', direction: 'Информационные системы', owner: 'Елена Ким', stage: 's2', days: 1, initials: 'УФ' },
  { id: 4, university: 'Томский политехнический университет', short: 'ТПУ', product: 'МойОфис', direction: 'Кибербезопасность', owner: 'Алина Воронова', stage: 's2', days: 7, initials: 'ТП' },
  { id: 5, university: 'НИУ ВШЭ', short: 'ВШЭ', product: 'Контур', direction: 'Программная инженерия', owner: 'Михаил Орлов', stage: 's3', days: 3, initials: 'ВШ' },
  { id: 6, university: 'Дальневосточный федеральный университет', short: 'ДВФУ', product: 'Р7-Офис', direction: 'Аналитика данных', owner: 'Елена Ким', stage: 's7', days: 12, initials: 'ДВ' },
  { id: 7, university: 'Московский политех', short: 'МПУ', product: 'МойОфис', direction: 'Кибербезопасность', owner: 'Алина Воронова', stage: 's5', days: 2, initials: 'МП' },
  { id: 8, university: 'Южный федеральный университет', short: 'ЮФУ', product: 'Контур', direction: 'Аналитика данных', owner: 'Михаил Орлов', stage: 's13', days: 1, initials: 'ЮФ' },
];

export const LEGACY_UNIVERSITIES = [
  { name: 'Казанский федеральный университет', product: 'МойОфис', direction: 'Информационные системы', status: 'Подписание документов', manager: 'Алина Воронова', updatedAt: '12.05.2026' },
  { name: 'ИТМО', product: 'Р7-Офис', direction: 'Программная инженерия', status: 'Организация встречи', manager: 'Михаил Орлов', updatedAt: '09.05.2026' },
  { name: 'УрФУ им. Б. Н. Ельцина', product: 'SberJazz', direction: 'Информационные системы', status: 'Обмен документами', manager: 'Елена Ким', updatedAt: '07.05.2026' },
  { name: 'Томский политехнический университет', product: 'МойОфис', direction: 'Кибербезопасность', status: 'Организация встречи', manager: 'Алина Воронова', updatedAt: '04.05.2026' },
  { name: 'НИУ ВШЭ', product: 'Контур', direction: 'Программная инженерия', status: 'Обмен документами', manager: 'Михаил Орлов', updatedAt: '02.05.2026' },
  { name: 'Дальневосточный федеральный университет', product: 'Р7-Офис', direction: 'Аналитика данных', status: 'Сопровождение внедрения', manager: 'Елена Ким', updatedAt: '28.04.2026' },
];

/** Логотип вуза — первые буквы слов названия, как в прежнем дизайне: «Уи», «КФ», «И». */
export const universityLogo = (name) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2);

/** Дата вида «12.05.2026» → «20260512»: сортируемая строка для таблиц прежнего дизайна. */
export const sortableDate = (value) => value.split('.').reverse().join('');

/** Сколько карточек на каждом этапе — основа кольца и столбцов на прежней главной. */
export const countCardsByStage = (cards) =>
  LEGACY_STAGES.map((stage) => ({ ...stage, n: cards.filter((card) => card.stage === stage.id).length }));
