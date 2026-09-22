import { formatMonth, formatNumber, plural } from '../../../domain/format.js';
import {
  AddIcon,
  AnalyticsIcon,
  DocumentIcon,
  EducationIcon,
  HistoryIcon,
  InteractionsIcon,
  ReportIcon,
  ShieldIcon,
  SuccessIcon,
  UniversityIcon,
  UsersIcon,
  WarningIcon,
} from '../../../ui/icons.js';
import { StatTile } from '../../../ui/StatTile.jsx';
import { WIDGET_SIZE } from '../dashboard/layout.js';
import { KPI_SIZES, WIDGET_CATEGORY } from './common.js';

const periodCaption = (data, fallback) => (data.range ? 'За выбранный период' : fallback);

/**
 * Плитки ключевых показателей. value(data) — число, caption(data) — откуда оно;
 * href — список, из которого посчитано число.
 */
const KPI = [
  {
    id: 'kpi-universities',
    title: 'Вузов в работе',
    description: 'Сколько вузов попало под фильтры.',
    icon: UniversityIcon,
    value: (data) => formatNumber(data.summary.universities),
    caption: (data) => `Из ${data.catalogs.universities.length} в справочнике`,
    href: '/catalogs',
  },
  {
    id: 'kpi-active',
    title: 'Активных взаимодействий',
    description: 'Взаимодействия, которые ещё не завершены.',
    icon: InteractionsIcon,
    value: (data) => formatNumber(data.summary.active),
    caption: (data) => `Всего с учётом фильтров: ${data.summary.total}`,
    href: '/interactions',
  },
  {
    id: 'kpi-new',
    title: 'Новых взаимодействий',
    description: 'Начатые за выбранный период; без периода — за последние 30 дней.',
    icon: AddIcon,
    value: (data) => formatNumber(data.newInteractions),
    caption: (data) => periodCaption(data, 'За последние 30 дней'),
  },
  {
    id: 'kpi-completion',
    title: 'Завершено',
    description: 'Доля взаимодействий, прошедших все этапы.',
    icon: SuccessIcon,
    tone: 'success',
    value: (data) => `${data.summary.completionRate}%`,
    caption: (data) => `${data.summary.completed} из ${data.summary.total} взаимодействий`,
  },
  {
    id: 'kpi-workflow-days',
    title: 'Среднее время процесса',
    description: 'Сколько в среднем длится весь путь от первого этапа до завершения.',
    icon: HistoryIcon,
    value: (data) => (data.workflowDuration.average === null ? '—' : formatNumber(data.workflowDuration.average)),
    caption: (data) => {
      const { average, items } = data.workflowDuration;
      if (average === null) return 'Нет завершённых взаимодействий';
      return `${plural(average, ['день', 'дня', 'дней'])} · по ${items.length} ${plural(items.length, ['завершённому', 'завершённым', 'завершённым'])}`;
    },
  },
  {
    id: 'kpi-overdue',
    title: 'Просроченных этапов',
    description: 'Взаимодействия, у которых вышел нормативный срок текущего этапа.',
    icon: WarningIcon,
    tone: 'warning',
    value: (data) => formatNumber(data.summary.overdue),
    caption: () => 'Откройте, чтобы разобрать',
    href: '/interactions',
  },
  {
    id: 'kpi-applications',
    title: 'Заявок на обучение',
    description: 'Сумма заявок из LMS и с сайта.',
    icon: ReportIcon,
    value: (data) => formatNumber(data.lms.applications),
    caption: (data) => periodCaption(data, 'За всё время'),
  },
  {
    id: 'kpi-students',
    title: 'Обучающихся',
    description: 'Сколько человек учится сейчас — по последним данным LMS.',
    icon: EducationIcon,
    value: (data) => formatNumber(data.lms.students),
    caption: (data) => (data.lms.lastMonth ? `По данным LMS за ${formatMonth(data.lms.lastMonth).toLowerCase()}` : 'Нет данных LMS'),
  },
  {
    id: 'kpi-streams',
    title: 'Параллельных потоков',
    description: 'Сколько учебных потоков идёт одновременно.',
    icon: UsersIcon,
    value: (data) => formatNumber(data.lms.streams),
    caption: () => 'Идут одновременно сейчас',
  },
  {
    id: 'kpi-licenses',
    title: 'Подписанных лицензий',
    description: 'Лицензии ИТ-продуктов, подписанные с вузами.',
    icon: ShieldIcon,
    value: (data) => formatNumber(data.licenses.signed),
    caption: ({ licenses }) => `Действуют ${licenses.active} · истекают ${licenses.expiring} · истекли ${licenses.expired}`,
  },
  {
    id: 'kpi-data-gaps',
    title: 'Без обязательных данных',
    description: 'Взаимодействия без ответственного, договора, лицензии или контакта в вузе.',
    icon: AnalyticsIcon,
    tone: 'warning',
    value: (data) => formatNumber(data.dataGaps.items.length),
    caption: () => 'Нужно заполнить карточки',
  },
  {
    id: 'kpi-documents',
    title: 'Загружено документов',
    description: 'Файлы, приложенные к этапам взаимодействий.',
    icon: DocumentIcon,
    value: (data) => formatNumber(data.documents.uploaded),
    caption: ({ documents }) => `Неполный комплект — ${documents.incomplete.length}`,
  },
];

export const KPI_WIDGETS = KPI.map(({ id, title, description, icon, tone, value, caption, href }) => ({
  id,
  title,
  description,
  icon,
  category: WIDGET_CATEGORY.kpi,
  chartType: 'Плитка',
  rowSpan: 1,
  sizes: KPI_SIZES,
  defaultSize: WIDGET_SIZE.s,
  Component: ({ data }) => (
    <StatTile label={title} hint={description} value={value(data)} caption={caption(data)} icon={icon} tone={tone} href={href} />
  ),
}));
