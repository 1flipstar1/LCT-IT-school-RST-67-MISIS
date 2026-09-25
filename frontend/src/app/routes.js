import { lazy } from 'react';
import { PERMISSION } from '../domain/roles.js';
import { AssistantPage } from '../features/assistant/AssistantPage.jsx';
import { ASSISTANT_PATH } from '../features/assistant/launch.js';

/**
 * Таблица маршрутов. Страницы загружаются лениво: первый экран не тянет код админки и конструктора.
 * permission — право, без которого вместо страницы показывается «Недостаточно прав» (ACCESS-403).
 */
const page = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));

export const ROUTES = [
  { path: '/', component: page(() => import('../features/legacy/DashboardScreen.jsx'), 'DashboardScreen') },
  { path: '/interactions', component: page(() => import('../features/interactions/InteractionsPage.jsx'), 'InteractionsPage') },
  { path: '/interactions/:id', component: page(() => import('../features/interactions/InteractionPage.jsx'), 'InteractionPage') },
  { path: '/analytics', component: page(() => import('../features/analytics/AnalyticsPage.jsx'), 'AnalyticsPage') },
  { path: '/reports', component: page(() => import('../features/reports/ReportsPage.jsx'), 'ReportsPage') },
  { path: '/catalogs', component: page(() => import('../features/catalogs/CatalogsPage.jsx'), 'CatalogsPage') },
  {
    path: '/import',
    permission: PERMISSION.importCatalogs,
    component: page(() => import('../features/catalogs/ImportPage.jsx'), 'ImportPage'),
  },
  // Прежние адреса импорта ведут на тот же мастер: на них есть ссылки в справке и закладках.
  {
    path: '/catalogs/import',
    permission: PERMISSION.importCatalogs,
    component: page(() => import('../features/catalogs/ImportPage.jsx'), 'ImportPage'),
  },
  {
    path: '/main/import',
    permission: PERMISSION.importCatalogs,
    component: page(() => import('../features/catalogs/ImportPage.jsx'), 'ImportPage'),
  },
  {
    path: '/workflows',
    permission: PERMISSION.manageWorkflows,
    component: page(() => import('../features/workflows/WorkflowsPage.jsx'), 'WorkflowsPage'),
  },
  {
    path: '/integrations',
    permission: PERMISSION.manageIntegrations,
    component: page(() => import('../features/integrations/IntegrationsPage.jsx'), 'IntegrationsPage'),
  },
  {
    path: '/users',
    permission: PERMISSION.manageTeamAccounts,
    component: page(() => import('../features/admin/UsersPage.jsx'), 'UsersPage'),
  },
  {
    path: '/audit',
    permission: PERMISSION.viewAudit,
    component: page(() => import('../features/admin/AuditPage.jsx'), 'AuditPage'),
  },
  // Чат с помощником грузится сразу: переход из строки поиска анимирован и не должен ждать загрузки кода.
  { path: ASSISTANT_PATH, component: AssistantPage },
  { path: '/help', component: page(() => import('../features/help/HelpPage.jsx'), 'HelpPage') },
  // Страницы ошибок по HTTP-статусу: «#/error/404», «#/error/503». Сюда переводит приложение при ответе сервера с ошибкой.
  { path: '/errors', component: page(() => import('../features/errors/ErrorGalleryPage.jsx'), 'ErrorGalleryPage') },
  { path: '/error/:status', component: page(() => import('../features/errors/ErrorStatusPage.jsx'), 'ErrorStatusPage') },

  // Экран прежнего дизайна (ветка main), см. features/legacy.
  { path: '/main/dashboard', component: page(() => import('../features/legacy/DashboardScreen.jsx'), 'DashboardScreen') },
];
