/**
 * Быстрые команды: набираются через «/» в поле ввода.
 * template — подставляет начало фразы, prompt — сразу отправляет, action — действие окна чата.
 */
export const SLASH_COMMANDS = [
  { command: '/отчёт', description: 'Сформировать отчёт', template: 'Сформируй отчёт ' },
  { command: '/найти', description: 'Найти взаимодействия', template: 'Покажи взаимодействия ' },
  { command: '/срочные', description: 'Просроченные и срочные этапы', prompt: 'Покажи просроченные и срочные взаимодействия' },
  { command: '/статистика', description: 'Сводка по взаимодействиям', prompt: 'Статистика по всем взаимодействиям' },
  { command: '/повторить', description: 'Повторить последний отчёт', prompt: 'Повтори последний отчёт' },
  { command: '/открыть', description: 'Открыть раздел', template: 'Открой ' },
  { command: '/помощь', description: 'Что умеет помощник', prompt: 'Что ты умеешь?' },
  { command: '/экспорт', description: 'Скачать переписку файлом', action: 'export' },
  { command: '/настройки', description: 'Настройки помощника', action: 'settings' },
  { command: '/очистить', description: 'Начать новый диалог', action: 'clear' },
];

export function matchCommands(draft) {
  if (!draft.startsWith('/') || draft.includes(' ')) return [];
  const query = draft.toLocaleLowerCase('ru').replace(/ё/g, 'е');
  return SLASH_COMMANDS.filter(({ command }) => command.replace(/ё/g, 'е').startsWith(query));
}

/** Подсказки для пустого чата — под раздел, в котором сейчас пользователь. */
export const PAGE_PROMPTS = {
  dashboard: ['Что требует внимания?', 'Статистика по моим вузам', 'Как начать день?'],
  interactions: ['Покажи просроченные', 'Как сменить этап?', 'Открой доску этапов'],
  reports: ['Сформируй отчёт за последние 3 месяца в PDF', 'Повтори последний отчёт', 'Как сформировать отчёт?'],
  analytics: ['Статистика за этот год', 'Отчёт по всем вузам в Excel', 'Покажи просроченные'],
  help: ['Что ты умеешь?', 'Можно ли пропустить этап?', 'Какие этапы есть?'],
  other: ['Что ты умеешь?', 'Как сформировать отчёт?', 'Покажи просроченные'],
};

const PAGE_BY_SECTION = {
  interactions: 'interactions',
  reports: 'reports',
  analytics: 'analytics',
  help: 'help',
  catalogs: 'catalogs',
  workflows: 'workflows',
  integrations: 'integrations',
  users: 'users',
  audit: 'audit',
};

/** Раздел для контекста модели: '#/interactions/i1' → 'interactions'. */
export function pageOf(pathname) {
  const section = pathname.split('/')[1];
  if (!section) return 'dashboard';
  return PAGE_BY_SECTION[section] ?? 'other';
}
