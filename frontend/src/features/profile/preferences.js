/**
 * Личные настройки интерфейса сотрудника. Хранятся на сервере в карточке сотрудника
 * (PUT /me/preferences) и копией в браузере — чтобы применяться до ответа сервера.
 * Каждое поле описано закрытым списком значений: испорченное или устаревшее значение
 * заменяется значением по умолчанию, а не ломает интерфейс. Списки совпадают с backend/app/api/routers/me.py.
 */

export const START_PAGES = [
  { value: '/', label: 'Дашборд' },
  { value: '/interactions', label: 'Взаимодействия' },
  { value: '/analytics', label: 'Аналитика' },
  { value: '/reports', label: 'Отчёты' },
];

export const INTERACTION_VIEWS = [
  { value: 'board', label: 'Доска' },
  { value: 'table', label: 'Таблица' },
];

export const INTERACTION_SORTS = [
  { value: 'urgency', label: 'Сначала срочные' },
  { value: 'updated', label: 'Недавно изменённые' },
  { value: 'university', label: 'По вузу (А–Я)' },
  { value: 'progress', label: 'По этапу' },
];

/** Масштаб интерфейса в процентах; применяется через --ui-scale (см. styles/tokens.css). */
export const UI_SCALES = [
  { value: 100, label: '100%' },
  { value: 110, label: '110%' },
  { value: 120, label: '120%' },
  { value: 130, label: '130%' },
];

export const TOAST_DURATIONS = [
  { value: 4000, label: '4 секунды' },
  { value: 6000, label: '6 секунд' },
  { value: 10000, label: '10 секунд' },
];

export const DEFAULT_PREFERENCES = {
  avatar: null,
  uiScale: 110,
  reduceMotion: false,
  showBadges: true,
  showHints: true,
  shortcuts: true,
  startPage: '/',
  interactionView: 'board',
  interactionSort: 'urgency',
  toastDuration: 6000,
};

const oneOf = (options, value, fallback) => (options.some((option) => option.value === value) ? value : fallback);
const flag = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

export function normalizePreferences(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const defaults = DEFAULT_PREFERENCES;
  return {
    avatar: typeof source.avatar === 'string' ? source.avatar : null,
    uiScale: oneOf(UI_SCALES, source.uiScale, defaults.uiScale),
    reduceMotion: source.reduceMotion === true,
    showBadges: flag(source.showBadges, defaults.showBadges),
    showHints: flag(source.showHints, defaults.showHints),
    shortcuts: flag(source.shortcuts, defaults.shortcuts),
    startPage: oneOf(START_PAGES, source.startPage, defaults.startPage),
    interactionView: oneOf(INTERACTION_VIEWS, source.interactionView, defaults.interactionView),
    interactionSort: oneOf(INTERACTION_SORTS, source.interactionSort, defaults.interactionSort),
    toastDuration: oneOf(TOAST_DURATIONS, source.toastDuration, defaults.toastDuration),
  };
}

export const samePreferences = (a, b) => Object.keys(DEFAULT_PREFERENCES).every((key) => a[key] === b[key]);
