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
 * «Работа» — ежедневные дела менеджера, «Данные» — выгрузки и справочники, «Управление» — настройки.
 * Последний раздел — экраны прежнего дизайна из ветки main: они сохранены целиком
 * и живут на адресах /main/*, см. features/legacy.
 * badge — ключ счётчика из useNavigationBadges.
 */
export const NAVIGATION = [
  {
    id: 'work',
    label: 'Работа',
    items: [
      { to: '/', label: 'Главная', icon: HomeIcon, exact: true },
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
    ],
  },
  {
    id: 'admin',
    label: 'Управление',
    items: [
      { to: '/workflows', label: 'Этапы работы', icon: WorkflowIcon, permission: PERMISSION.manageWorkflows },
      { to: '/integrations', label: 'Интеграции', icon: IntegrationIcon, permission: PERMISSION.manageIntegrations, badge: 'inbox' },
      { to: '/users', label: 'Пользователи и доступ', icon: UsersIcon, permission: PERMISSION.manageUsers },
      { to: '/audit', label: 'Журнал действий', icon: HistoryIcon, permission: PERMISSION.viewAudit },
    ],
  },
  {
    id: 'legacy',
    label: 'Экраны main',
    items: [
      { to: '/main/dashboard', label: 'Дашборд', icon: HomeIcon },
      { to: '/main/import', label: 'Импорт данных', icon: UploadIcon },
    ],
  },
];

export function isNavItemActive(item, pathname) {
  return item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}
