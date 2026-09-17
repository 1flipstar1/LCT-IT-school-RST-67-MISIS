import { lazy } from 'react';
import { PERMISSION } from '../domain/roles.js';

/**
 * Таблица маршрутов. Страницы загружаются лениво: первый экран не тянет код админки и конструктора.
 * permission — право, без которого вместо страницы показывается «Недостаточно прав» (ACCESS-403).
 */
const page = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));

export const ROUTES = [
  { path: '/', component: page(() => import('../features/dashboard/DashboardPage.jsx'), 'DashboardPage') },
  { path: '/interactions', component: page(() => import('../features/interactions/InteractionsPage.jsx'), 'InteractionsPage') },
  { path: '/interactions/:id', component: page(() => import('../features/interactions/InteractionPage.jsx'), 'InteractionPage') },
  { path: '/universities', component: page(() => import('../features/universities/UniversitiesPage.jsx'), 'UniversitiesPage') },
  { path: '/universities/:id', component: page(() => import('../features/universities/UniversityPage.jsx'), 'UniversityPage') },
  { path: '/analytics', component: page(() => import('../features/analytics/AnalyticsPage.jsx'), 'AnalyticsPage') },
  { path: '/reports', component: page(() => import('../features/reports/ReportsPage.jsx'), 'ReportsPage') },
  { path: '/catalogs', component: page(() => import('../features/catalogs/CatalogsPage.jsx'), 'CatalogsPage') },
  {
    path: '/catalogs/import',
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
    permission: PERMISSION.manageUsers,
    component: page(() => import('../features/admin/UsersPage.jsx'), 'UsersPage'),
  },
  {
    path: '/audit',
    permission: PERMISSION.viewAudit,
    component: page(() => import('../features/admin/AuditPage.jsx'), 'AuditPage'),
  },
  { path: '/help', component: page(() => import('../features/help/HelpPage.jsx'), 'HelpPage') },

  // Экраны прежнего дизайна (ветка main) — перенесены целиком, см. features/legacy.
  { path: '/main/dashboard', component: page(() => import('../features/legacy/DashboardScreen.jsx'), 'DashboardScreen') },
  { path: '/main/universities', component: page(() => import('../features/legacy/UniversitiesScreen.jsx'), 'UniversitiesScreen') },
  { path: '/main/workflow', component: page(() => import('../features/legacy/WorkflowScreen.jsx'), 'WorkflowScreen') },
  { path: '/main/analytics', component: page(() => import('../features/legacy/AnalyticsScreen.jsx'), 'AnalyticsScreen') },
  { path: '/main/import', component: page(() => import('../features/legacy/ImportScreen.jsx'), 'ImportScreen') },
  { path: '/main/reports', component: page(() => import('../features/legacy/ReportsScreen.jsx'), 'ReportsScreen') },
  { path: '/main/catalogs', component: page(() => import('../features/legacy/CatalogsScreen.jsx'), 'CatalogsScreen') },
  {
    path: '/main/users',
    permission: PERMISSION.manageUsers,
    component: page(() => import('../features/legacy/UsersScreen.jsx'), 'UsersScreen'),
  },
  {
    path: '/main/settings',
    permission: PERMISSION.manageUsers,
    component: page(() => import('../features/legacy/SettingsScreen.jsx'), 'SettingsScreen'),
  },
];
