import { REPORT_FORMATS } from '../../domain/reports.js';

/** Настройки помощника: хранятся у каждого пользователя в браузере. */
export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'agent',
  engine: 'auto',
  detail: 'short',
  reportFormat: 'xlsx',
  autoDownload: false,
  confirmChanges: true,
  speak: false,
  enterToSend: true,
  keepHistory: true,
  showSuggestions: true,
});

export const SETTING_OPTIONS = {
  mode: [
    { value: 'agent', label: 'Агент', description: 'Выполняет команды: отчёты, поиск, смена этапов.' },
    { value: 'guide', label: 'Подсказки', description: 'Только объясняет, как сделать; выполнить можно кнопкой.' },
  ],
  engine: [
    { value: 'auto', label: 'Авто', description: 'Команды — мгновенно без ИИ, свободные вопросы — локальной модели.' },
    { value: 'ai', label: 'ИИ', description: 'Каждый запрос сначала разбирает локальная модель.' },
    { value: 'local', label: 'Без ИИ', description: 'Только встроенные команды и справка. Работает без сервера модели.' },
  ],
  detail: [
    { value: 'short', label: 'Кратко' },
    { value: 'detailed', label: 'Подробно' },
  ],
  reportFormat: REPORT_FORMATS.map((format) => ({ value: format.id, label: format.label })),
};

/** Сохранённые настройки поверх значений по умолчанию: новая настройка не ломает старый кэш. */
export const withDefaults = (stored) => ({ ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) });
