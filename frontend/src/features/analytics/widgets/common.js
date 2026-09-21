import { formatMonth, formatNumber } from '../../../domain/format.js';
import { PHASES } from '../../../domain/workflow.js';
import { getBrandShades } from '../../../ui/charts/shades.js';
import { WIDGET_SIZE } from '../dashboard/layout.js';

/** Категории каталога виджетов — в этом порядке они идут в окне «Добавить виджет». */
export const WIDGET_CATEGORY = Object.freeze({
  kpi: 'Ключевые показатели',
  process: 'Процесс и этапы',
  programs: 'Программы, продукты и вузы',
  licenses: 'Лицензии и сроки',
  managers: 'Менеджеры',
  quality: 'Полнота данных',
  dynamics: 'Динамика',
});

export const KPI_SIZES = [WIDGET_SIZE.s, WIDGET_SIZE.m];
export const CHART_SIZES = [WIDGET_SIZE.m, WIDGET_SIZE.l];

/** Цвет фазы закреплён за фазой (порядок фаз = от светлого к насыщенному), а не за её местом в выборке. */
const PHASE_COLORS = getBrandShades(PHASES.length);
export const PHASE_SERIES = PHASES.map((phase, index) => ({ id: phase.id, label: phase.label, color: PHASE_COLORS[index] }));
export const phaseColor = (phaseId) => PHASE_SERIES.find((phase) => phase.id === phaseId)?.color;

export const monthLabel = (month) => `${formatMonth(month)} ${month.slice(0, 4)}`;

/** Табличный вид для графика по месяцам. */
export const monthTable = (series, valueHeader) => ({
  rowKey: (item) => item.month,
  rows: series,
  columns: [
    { id: 'month', header: 'Месяц', primary: true, cell: (item) => monthLabel(item.month) },
    { id: 'value', header: valueHeader, align: 'right', cell: (item) => formatNumber(item.value) },
  ],
});

export const toLinePoints = (series) => series.map((item) => ({ key: item.month, label: formatMonth(item.month), value: item.value }));

export const formatAverageDays = (value) => (value === null ? '—' : formatNumber(value));
