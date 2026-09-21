import { KPI_WIDGETS } from './kpiWidgets.jsx';
import { INSIGHT_WIDGETS } from './insightWidgets.jsx';
import { PROCESS_WIDGETS } from './processWidgets.jsx';

/** Полный каталог настраиваемой панели. Порядок определяет порядок карточек в окне добавления. */
export const ANALYTICS_WIDGETS = [...KPI_WIDGETS, ...PROCESS_WIDGETS, ...INSIGHT_WIDGETS];

/** Основная панель из ТЗ: KPI, динамика, воронка, рейтинг и статусы по менеджерам. */
export const DEFAULT_ANALYTICS_LAYOUT = [
  { id: 'kpi-universities', size: 's' },
  { id: 'kpi-active', size: 's' },
  { id: 'kpi-applications', size: 's' },
  { id: 'kpi-students', size: 's' },
  { id: 'kpi-overdue', size: 's' },
  { id: 'kpi-streams', size: 's' },
  { id: 'kpi-completion', size: 's' },
  { id: 'kpi-new', size: 's' },
  { id: 'chart-applications', size: 'm' },
  { id: 'chart-ranking', size: 'm' },
  { id: 'chart-funnel', size: 'l' },
  { id: 'chart-manager-workload', size: 'm' },
  { id: 'chart-stages', size: 'm' },
];
