import { PERMISSION } from '../domain/roles.js';
import {
  AnalyticsIcon,
  CatalogIcon,
  HistoryIcon,
  HomeIcon,
  IntegrationIcon,
  InteractionsIcon,
  ReportIcon,
  UploadIcon,
  UsersIcon,
  WorkflowIcon,
} from '../ui/icons.js';

/**
 * Структура меню. Разделы сгруппированы по задачам пользователя, а не по сущностям базы:
 * Первый блок — ежедневные дела менеджера, «Данные» — выгрузки и справочники, «Управление» — настройки.
 * badge — ключ счётчика из useNavigationBadges.
 */
export const NAVIGATION = [
  {
    id: 'work',
    items: [
      { to: '/', label: 'Дашборд', icon: HomeIcon, exact: true },
      { to: '/interactions', label: 'Взаимодействия', icon: InteractionsIcon, badge: 'attention' },
    ],
  },
  {
    id: 'data',
    label: 'Данные',
    items: [
      { to: '/analytics', label: 'Аналитика', icon: AnalyticsIcon },
      { to: '/reports', label: 'Отчёты', icon: ReportIcon },
      { to: '/catalogs', label: 'Справочники', icon: CatalogIcon },
      { to: '/import', label: 'Импорт данных', icon: UploadIcon, permission: PERMISSION.importCatalogs },
    ],
  },
  {
    id: 'admin',
    label: 'Управление',
    items: [
      { to: '/workflows', label: 'Этапы работы', icon: WorkflowIcon, permission: PERMISSION.manageWorkflows },
      { to: '/integrations', label: 'Интеграции', icon: IntegrationIcon, permission: PERMISSION.manageIntegrations, badge: 'inbox' },
      { to: '/users', label: 'Пользователи и доступ', icon: UsersIcon, permission: PERMISSION.manageTeamAccounts },
      { to: '/audit', label: 'Журнал действий', icon: HistoryIcon, permission: PERMISSION.viewAudit },
    ],
  },
];

export function isNavItemActive(item, pathname) {
  return item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}
