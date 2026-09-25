import { PERMISSION } from '../../../domain/roles.js';

/**
 * Действия помощника. Имена совпадают с инструментами, которые backend описывает локальной модели
 * (backend/app/services/assistant.py): модель выбирает действие, выполняет его браузер с правами пользователя.
 */
export const TOOL = Object.freeze({
  createReport: 'create_report',
  repeatReport: 'repeat_last_report',
  findInteractions: 'find_interactions',
  showStats: 'show_stats',
  openPage: 'open_page',
  openInteraction: 'open_interaction',
  changeStage: 'change_stage',
  addComment: 'add_comment',
  interactionDetails: 'interaction_details',
  universityContacts: 'university_contacts',
  managerWorkload: 'manager_workload',
  dailyPlan: 'daily_plan',
});

/** Действия, которые меняют данные: по умолчанию выполняются только после подтверждения. */
export const MUTATING_TOOLS = new Set([TOOL.changeStage, TOOL.addComment]);

export const STAGE_MOVE = Object.freeze({ next: 'next', back: 'back', skip: 'skip' });

/** Разделы, которые можно открыть командой. stems — основы слов, по которым раздел узнаётся в тексте. */
export const PAGES = [
  { id: 'board', path: '/interactions', view: 'board', label: 'Доска этапов', stems: ['доск', 'канбан'] },
  { id: 'dashboard', path: '/', label: 'Дашборд', stems: ['дашборд', 'главн'] },
  { id: 'analytics', path: '/analytics', label: 'Аналитика', stems: ['аналитик', 'график'] },
  { id: 'reports', path: '/reports', label: 'Отчёты', stems: ['отчет', 'конструктор отчет'] },
  { id: 'import', path: '/import', label: 'Импорт данных', stems: ['импорт', 'загрузк excel', 'загрузи файл'], permission: PERMISSION.importCatalogs },
  { id: 'catalogs', path: '/catalogs', label: 'Справочники', stems: ['справочник'] },
  { id: 'workflows', path: '/workflows', label: 'Этапы работы', stems: ['этапы работы', 'конструктор этап', 'настройк этап'], permission: PERMISSION.manageWorkflows },
  { id: 'integrations', path: '/integrations', label: 'Интеграции', stems: ['интеграц', 'lms'], permission: PERMISSION.manageIntegrations },
  { id: 'users', path: '/users', label: 'Пользователи и доступ', stems: ['пользовател', 'доступ'], permission: PERMISSION.manageUsers },
  { id: 'audit', path: '/audit', label: 'Журнал действий', stems: ['журнал', 'аудит'], permission: PERMISSION.viewAudit },
  { id: 'help', path: '/help', label: 'Справка', stems: ['справк', 'инструкц', 'руководств'] },
  { id: 'interactions', path: '/interactions', view: 'table', label: 'Взаимодействия', stems: ['взаимодейств', 'список'] },
];

export const pageById = (id) => PAGES.find((page) => page.id === id);
