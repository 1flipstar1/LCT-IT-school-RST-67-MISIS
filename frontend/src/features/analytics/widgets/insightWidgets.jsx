import { useMemo } from 'react';
import { useRouter } from '../../../app/router.jsx';
import { DATA_GAP_LABELS } from '../../../domain/analytics.js';
import { LICENSE_STATE, LICENSE_STATE_LABELS } from '../../../domain/contract.js';
import { formatDate, formatNumber } from '../../../domain/format.js';
import { PERMISSION } from '../../../domain/roles.js';
import { Badge } from '../../../ui/Badge.jsx';
import { BarChart } from '../../../ui/charts/BarChart.jsx';
import { BubbleChart } from '../../../ui/charts/BubbleChart.jsx';
import { CalendarChart } from '../../../ui/charts/CalendarChart.jsx';
import { ChartCard } from '../../../ui/charts/ChartCard.jsx';
import { DonutChart } from '../../../ui/charts/DonutChart.jsx';
import { HeatmapChart } from '../../../ui/charts/HeatmapChart.jsx';
import { STATUS_COLORS, getBrandShades } from '../../../ui/charts/shades.js';
import { StackedBarChart } from '../../../ui/charts/StackedBarChart.jsx';
import { AnalyticsIcon, CalendarIcon, EducationIcon, ShieldIcon, UniversityIcon, UsersIcon, WarningIcon } from '../../../ui/icons.js';
import { WIDGET_SIZE } from '../dashboard/layout.js';
import { CHART_SIZES, PHASE_SERIES, WIDGET_CATEGORY, formatAverageDays } from './common.js';

const chart = (definition) => ({ rowSpan: 2, sizes: CHART_SIZES, defaultSize: WIDGET_SIZE.m, ...definition });
const fullChart = (definition) => chart({ defaultSize: WIDGET_SIZE.l, ...definition });
const toBarItems = (items, getLabel, getValue) => items.map((item) => ({ id: item.item?.id ?? item.university?.id ?? item.manager?.id, label: getLabel(item), value: getValue(item), source: item }));

function RankingWidget({ data }) {
  return (
    <ChartCard
      id="analytics-chart-ranking"
      title="Рейтинг ИТ-программ"
      hint="Востребованность программ по заявкам, обучающимся и параллельным потокам. Все три показателя имеют одинаковый вес."
      description="Индекс от 0 до 100: чем выше, тем больше спрос на программу."
      chart={
        <BarChart
          ariaLabel="Рейтинг ИТ-программ по востребованности"
          groups={[{ id: 'ranking', items: data.ranking.map((item) => ({ id: item.direction.id, label: item.direction.name, value: item.index, source: item })) }]}
          formatTooltip={(item) => (
            <>
              <b>{item.label}</b>
              <span>Заявок: {formatNumber(item.source.applications)}</span>
              <span>Обучающихся: {formatNumber(item.source.students)}</span>
              <span>Потоков: {formatNumber(item.source.streams)}</span>
              <span>Индекс: {item.value}</span>
            </>
          )}
        />
      }
      table={{
        rowKey: (item) => item.direction.id,
        rows: data.ranking,
        columns: [
          { id: 'direction', header: 'Программа', primary: true, cell: (item) => item.direction.name },
          { id: 'applications', header: 'Заявок', align: 'right', cell: (item) => formatNumber(item.applications) },
          { id: 'students', header: 'Обучающихся', align: 'right', cell: (item) => formatNumber(item.students) },
          { id: 'streams', header: 'Потоков', align: 'right', cell: (item) => item.streams },
          { id: 'index', header: 'Индекс', align: 'right', cell: (item) => item.index },
        ],
      }}
      footer="Заявки, обучающиеся и потоки делятся на максимум по выборке; три доли усредняются и умножаются на 100."
    />
  );
}

function PopularityBubbleWidget({ data }) {
  const points = data.ranking.map((item) => ({ id: item.direction.id, label: item.direction.name, x: item.applications, y: item.students, size: item.streams }));
  return (
    <ChartCard
      id="analytics-chart-popularity-bubble"
      title="Спрос на ИТ-программы"
      hint="Положение показывает заявки и обучающихся, площадь пузыря — число параллельных потоков."
      description="Правее — больше заявок, выше — больше обучающихся, крупнее — больше потоков."
      chart={<BubbleChart ariaLabel="Спрос на ИТ-программы" points={points} xLabel="Заявки" yLabel="Обучающиеся" sizeLabel="Потоки" />}
      table={{
        rowKey: (item) => item.id,
        rows: points,
        columns: [
          { id: 'program', header: 'Программа', primary: true, cell: (item) => item.label },
          { id: 'applications', header: 'Заявок', align: 'right', cell: (item) => formatNumber(item.x) },
          { id: 'students', header: 'Обучающихся', align: 'right', cell: (item) => formatNumber(item.y) },
          { id: 'streams', header: 'Потоков', align: 'right', cell: (item) => item.size },
        ],
      }}
    />
  );
}

function UniversitiesByWidget({ data, kind }) {
  const source = kind === 'direction' ? data.directionsByUniversity : data.productsByUniversity;
  const title = kind === 'direction' ? 'Вузы по ИТ-направлениям' : 'Вузы по продуктам и ПО';
  const items = toBarItems(source, (item) => item.item.name, (item) => item.universities);
  return (
    <ChartCard
      id={`analytics-chart-universities-${kind}`}
      title={title}
      hint="Количество уникальных вузов, где используется направление или продукт."
      description="В подсказке также показано число взаимодействий."
      chart={
        <BarChart
          ariaLabel={title}
          groups={[{ id: kind, items }]}
          formatTooltip={(item) => (
            <>
              <b>{item.label}</b>
              <span>Вузов: {item.value}</span>
              <span>Взаимодействий: {item.source.interactions}</span>
            </>
          )}
        />
      }
      table={{
        rowKey: (item) => item.item.id,
        rows: source,
        columns: [
          { id: 'name', header: kind === 'direction' ? 'Направление' : 'Продукт / ПО', primary: true, cell: (item) => item.item.name },
          { id: 'universities', header: 'Вузов', align: 'right', cell: (item) => item.universities },
          { id: 'interactions', header: 'Взаимодействий', align: 'right', cell: (item) => item.interactions },
        ],
      }}
    />
  );
}

function PortfolioWidget({ data }) {
  return (
    <ChartCard
      id="analytics-chart-portfolio"
      title="Программы и продукты по вузам"
      hint="Сколько уникальных ИТ-направлений и продуктов используется в каждом вузе."
      description="Столбец — сумма программ и продуктов; подробная разбивка доступна в таблице."
      chart={<BarChart ariaLabel="Количество программ и продуктов по вузам" groups={[{ id: 'portfolio', items: toBarItems(data.universityPortfolio, (item) => item.university.shortName ?? item.university.name, (item) => item.directions + item.products) }]} />}
      table={{
        rowKey: (item) => item.university.id,
        rows: data.universityPortfolio,
        columns: [
          { id: 'university', header: 'Вуз', primary: true, cell: (item) => item.university.name },
          { id: 'directions', header: 'Программ', align: 'right', cell: (item) => item.directions },
          { id: 'products', header: 'Продуктов', align: 'right', cell: (item) => item.products },
          { id: 'interactions', header: 'Взаимодействий', align: 'right', cell: (item) => item.interactions },
        ],
      }}
    />
  );
}

function UniversityHeatmapWidget({ data, kind }) {
  const usedRows = useMemo(() => {
    const ids = new Set(data.rows.map((row) => row.universityId));
    return data.catalogs.universities.filter((item) => ids.has(item.id)).map((item) => ({ id: item.id, label: item.shortName ?? item.name }));
  }, [data]);
  const catalog = kind === 'direction' ? data.catalogs.directions : data.catalogs.products;
  const usedColumns = useMemo(() => {
    const key = kind === 'direction' ? 'directionId' : 'productId';
    const ids = new Set(data.rows.map((row) => row[key]));
    return catalog.filter((item) => ids.has(item.id)).map((item) => ({ id: item.id, label: item.name }));
  }, [catalog, data.rows, kind]);
  const getValue = kind === 'direction' ? data.universityDirectionCount : data.universityProductCount;
  const title = kind === 'direction' ? 'Вузы × ИТ-направления' : 'Вузы × продукты и ПО';
  const tableRows = usedRows.flatMap((row) => usedColumns.map((column) => ({ id: `${row.id}-${column.id}`, row, column, value: getValue(row.id, column.id) })).filter((item) => item.value > 0));
  return (
    <ChartCard
      id={`analytics-chart-heatmap-${kind}`}
      title={title}
      hint="Тепловая карта пересечений: число и насыщенность цвета показывают количество взаимодействий."
      description="Пустая ячейка означает, что взаимодействий по этой паре нет."
      chart={<HeatmapChart ariaLabel={title} rows={usedRows} columns={usedColumns} getValue={(row, column) => getValue(row.id, column.id)} />}
      table={{
        rowKey: (item) => item.id,
        rows: tableRows,
        columns: [
          { id: 'university', header: 'Вуз', primary: true, cell: (item) => item.row.label },
          { id: 'item', header: kind === 'direction' ? 'Направление' : 'Продукт / ПО', cell: (item) => item.column.label },
          { id: 'value', header: 'Взаимодействий', align: 'right', cell: (item) => item.value },
        ],
      }}
    />
  );
}

const LICENSE_COLORS = {
  [LICENSE_STATE.active]: STATUS_COLORS.success,
  [LICENSE_STATE.expiring]: STATUS_COLORS.warning,
  [LICENSE_STATE.expired]: STATUS_COLORS.danger,
  [LICENSE_STATE.none]: STATUS_COLORS.neutral,
};

function LicenseWidget({ data }) {
  const states = Object.values(LICENSE_STATE).map((state) => ({ id: state, label: LICENSE_STATE_LABELS[state], color: LICENSE_COLORS[state], value: data.licenses.items.filter((item) => item.state === state).length }));
  return (
    <ChartCard
      id="analytics-chart-licenses"
      title="Состояние лицензий"
      hint="Действующие, истекающие в ближайшие 60 дней, просроченные и ещё не подписанные лицензии."
      description="Доля взаимодействий по состоянию лицензии."
      chart={<DonutChart ariaLabel="Распределение лицензий по состоянию" segments={states} centerLabel="лицензий" />}
      table={{
        rowKey: (item) => item.id,
        rows: states,
        columns: [
          { id: 'state', header: 'Состояние', primary: true, cell: (item) => item.label },
          { id: 'value', header: 'Количество', align: 'right', cell: (item) => item.value },
        ],
      }}
    />
  );
}

function TransferWidget({ data }) {
  const colors = getBrandShades(data.transfers.length);
  const segments = data.transfers.map((item, index) => ({ id: item.status, label: item.status, value: item.count, color: colors[index] }));
  return (
    <ChartCard
      id="analytics-chart-transfers"
      title="Передача продукта"
      hint="Распределение взаимодействий по статусу передачи обучающих материалов, лицензии и документации."
      description="Статусы передачи продукта в вузы."
      chart={<DonutChart ariaLabel="Статусы передачи продукта" segments={segments} centerLabel="взаимодействий" />}
      table={{ rowKey: (item) => item.status, rows: data.transfers, columns: [{ id: 'status', header: 'Статус', primary: true, cell: (item) => item.status }, { id: 'count', header: 'Взаимодействий', align: 'right', cell: (item) => item.count }] }}
    />
  );
}

const DEADLINE_KINDS = {
  overdue: { label: 'Просрочено', color: STATUS_COLORS.danger },
  stage: { label: 'Срок этапа', color: STATUS_COLORS.warning },
  license: { label: 'Окончание лицензии', color: 'var(--color-brand)' },
};

function DeadlinesWidget({ data }) {
  const events = data.deadlines.map((item) => ({
    ...item,
    kind: item.date < data.now ? 'overdue' : item.kind,
    label: `${item.row.university.shortName ?? item.row.university.name}: ${item.label}`,
  }));
  return (
    <ChartCard
      id="analytics-chart-deadlines"
      title="Календарь сроков"
      hint="Сроки текущих этапов и окончания лицензий: прошедшие 30 дней и ближайшие 6 месяцев."
      description="Сегодня обведено; наведите на отмеченный день, чтобы увидеть события."
      chart={<CalendarChart ariaLabel="Календарь сроков этапов и лицензий" start={new Date(data.now.getFullYear(), data.now.getMonth() - 1, 1)} monthCount={7} events={events} kinds={DEADLINE_KINDS} now={data.now} />}
      table={{
        rowKey: (item) => item.id,
        rows: events,
        columns: [
          { id: 'date', header: 'Дата', primary: true, cell: (item) => formatDate(item.date) },
          { id: 'kind', header: 'Тип', cell: (item) => DEADLINE_KINDS[item.kind].label },
          { id: 'university', header: 'Вуз', cell: (item) => item.row.university.shortName ?? item.row.university.name },
          { id: 'event', header: 'Событие', cell: (item) => item.label.split(': ').slice(1).join(': ') },
        ],
      }}
    />
  );
}

function ManagerWorkloadWidget({ data }) {
  const rows = data.managerStats.map((item) => ({ id: item.manager.id, label: item.manager.name, values: item.byPhase }));
  return (
    <ChartCard
      id="analytics-chart-manager-workload"
      title="Статусы по менеджерам"
      hint="Нагрузка менеджеров с разбивкой активных взаимодействий по четырём фазам процесса."
      description="Итог справа — количество активных взаимодействий."
      chart={<StackedBarChart ariaLabel="Взаимодействия менеджеров по фазам" rows={rows} series={PHASE_SERIES} />}
      table={{
        rowKey: (item) => item.manager.id,
        rows: data.managerStats,
        columns: [
          { id: 'manager', header: 'Менеджер', primary: true, cell: (item) => item.manager.name },
          { id: 'universities', header: 'Вузов', align: 'right', cell: (item) => item.universities },
          { id: 'interactions', header: 'Взаимодействий', align: 'right', cell: (item) => item.interactions },
          { id: 'overdue', header: 'Просрочено', align: 'right', cell: (item) => item.overdue },
        ],
      }}
    />
  );
}

function ManagerResultsWidget({ data }) {
  return (
    <ChartCard
      id="analytics-chart-manager-results"
      title="Результаты менеджеров"
      hint="Количество завершённых процессов и средняя скорость прохождения одного этапа."
      description="Столбец — завершённые процессы; скорость показана в подсказке и таблице."
      chart={
        <BarChart
          ariaLabel="Завершённые процессы по менеджерам"
          groups={[{ id: 'completed', items: toBarItems(data.managerStats, (item) => item.manager.name, (item) => item.completed) }]}
          formatTooltip={(item) => (
            <>
              <b>{item.label}</b>
              <span>Завершено: {item.value}</span>
              <span>Среднее время этапа: {formatAverageDays(item.source.averageStageDays)} дн.</span>
              <span>Вузов: {item.source.universities}</span>
            </>
          )}
        />
      }
      table={{
        rowKey: (item) => item.manager.id,
        rows: data.managerStats,
        columns: [
          { id: 'manager', header: 'Менеджер', primary: true, cell: (item) => item.manager.name },
          { id: 'universities', header: 'Вузов', align: 'right', cell: (item) => item.universities },
          { id: 'interactions', header: 'Взаимодействий', align: 'right', cell: (item) => item.interactions },
          { id: 'completed', header: 'Завершено', align: 'right', cell: (item) => item.completed },
          { id: 'speed', header: 'На этап, дн.', align: 'right', cell: (item) => formatAverageDays(item.averageStageDays) },
        ],
      }}
    />
  );
}

function ManagerHeatmapWidget({ data }) {
  const rows = data.managerStats.map((item) => ({ id: item.manager.id, label: item.manager.name, source: item }));
  return (
    <ChartCard
      id="analytics-chart-manager-heatmap"
      title="Загрузка менеджеров"
      hint="Тепловая карта нагрузки: менеджеры по строкам, фазы процесса по столбцам."
      description="Число и насыщенность ячейки показывают количество взаимодействий."
      chart={<HeatmapChart ariaLabel="Загрузка менеджеров по фазам" rows={rows} columns={PHASE_SERIES} getValue={(row, column) => row.source.byPhase[column.id] ?? 0} />}
      table={{
        rowKey: (item) => item.manager.id,
        rows: data.managerStats,
        columns: [{ id: 'manager', header: 'Менеджер', primary: true, cell: (item) => item.manager.name }, ...PHASE_SERIES.map((phase) => ({ id: phase.id, header: phase.label, align: 'right', cell: (item) => item.byPhase[phase.id] }))],
      }}
    />
  );
}

function DataGapsWidget({ data }) {
  const items = Object.entries(data.dataGaps.counts).map(([id, value]) => ({ id, label: DATA_GAP_LABELS[id], value }));
  return (
    <ChartCard
      id="analytics-chart-data-gaps"
      title="Неполные данные"
      hint="Взаимодействия без ответственного, контакта в вузе или обязательных реквизитов договора и лицензии."
      description="Одна карточка может попасть сразу в несколько категорий."
      chart={<BarChart ariaLabel="Пробелы в обязательных данных" groups={[{ id: 'gaps', items }]} />}
      table={{ rowKey: (item) => item.id, rows: items, columns: [{ id: 'gap', header: 'Не заполнено', primary: true, cell: (item) => item.label }, { id: 'count', header: 'Взаимодействий', align: 'right', cell: (item) => item.value }] }}
    />
  );
}

function QualityTableWidget({ data }) {
  const byId = new Map(data.dataGaps.items.map((item) => [item.row.id, item.gaps]));
  const missingFiles = new Map(data.documents.incomplete.map((item) => [item.row.id, item.missing]));
  const rows = data.rows
    .filter((row) => byId.has(row.id) || missingFiles.has(row.id))
    .map((row) => ({ row, gaps: byId.get(row.id) ?? [], missing: missingFiles.get(row.id) ?? [] }));
  const { navigate } = useRouter();
  return (
    <ChartCard
      id="analytics-chart-quality-table"
      title="Карточки, требующие заполнения"
      hint="Детальный отчёт по взаимодействиям с неполными данными или комплектом документов."
      description="Откройте табличный вид и нажмите на строку в общем списке взаимодействий для исправления."
      chart={
        <BarChart
          ariaLabel="Количество проблем по взаимодействиям"
          onBarClick={(item) => navigate(`/interactions/${item.id}`)}
          groups={[{ id: 'quality', items: rows.slice(0, 12).map((item) => ({ id: item.row.id, label: item.row.university.shortName ?? item.row.university.name, value: item.gaps.length + item.missing.length })) }]}
        />
      }
      table={{
        rowKey: (item) => item.row.id,
        rows,
        columns: [
          { id: 'university', header: 'Вуз', primary: true, cell: (item) => item.row.university.name },
          { id: 'manager', header: 'Ответственный', cell: (item) => item.row.manager?.name ?? <Badge tone="warning">Не назначен</Badge> },
          { id: 'data', header: 'Данные', cell: (item) => item.gaps.length ? <Badge tone="warning">{item.gaps.map((gap) => DATA_GAP_LABELS[gap]).join(', ')}</Badge> : <Badge tone="success">Заполнены</Badge> },
          { id: 'files', header: 'Документы', cell: (item) => item.missing.length ? <Badge tone="danger">Не хватает: {item.missing.length}</Badge> : <Badge tone="success">Комплект</Badge> },
        ],
      }}
    />
  );
}

export const INSIGHT_WIDGETS = [
  chart({ id: 'chart-ranking', title: 'Рейтинг ИТ-программ', description: 'Востребованность по заявкам, обучающимся и потокам.', category: WIDGET_CATEGORY.programs, chartType: 'Столбцы', icon: EducationIcon, Component: RankingWidget }),
  chart({ id: 'chart-popularity-bubble', title: 'Спрос на ИТ-программы', description: 'Сравнение заявок, обучающихся и потоков.', category: WIDGET_CATEGORY.programs, chartType: 'Пузырьковая диаграмма', icon: EducationIcon, Component: PopularityBubbleWidget }),
  chart({ id: 'chart-universities-directions', title: 'Вузы по ИТ-направлениям', description: 'Количество вузов по каждому направлению.', category: WIDGET_CATEGORY.programs, chartType: 'Столбцы', icon: UniversityIcon, Component: (props) => <UniversitiesByWidget {...props} kind="direction" /> }),
  chart({ id: 'chart-universities-products', title: 'Вузы по продуктам и ПО', description: 'Количество вузов по каждому продукту.', category: WIDGET_CATEGORY.programs, chartType: 'Столбцы', icon: UniversityIcon, Component: (props) => <UniversitiesByWidget {...props} kind="product" /> }),
  chart({ id: 'chart-portfolio', title: 'Программы и продукты по вузам', description: 'Портфель каждого вуза.', category: WIDGET_CATEGORY.programs, chartType: 'Столбцы и таблица', icon: UniversityIcon, Component: PortfolioWidget }),
  fullChart({ id: 'chart-heatmap-directions', title: 'Вузы × ИТ-направления', description: 'Матрица взаимодействий по направлениям.', category: WIDGET_CATEGORY.programs, chartType: 'Тепловая карта', icon: AnalyticsIcon, Component: (props) => <UniversityHeatmapWidget {...props} kind="direction" /> }),
  fullChart({ id: 'chart-heatmap-products', title: 'Вузы × продукты и ПО', description: 'Матрица взаимодействий по продуктам.', category: WIDGET_CATEGORY.programs, chartType: 'Тепловая карта', icon: AnalyticsIcon, Component: (props) => <UniversityHeatmapWidget {...props} kind="product" /> }),
  chart({ id: 'chart-licenses', title: 'Состояние лицензий', description: 'Действующие, истекающие и просроченные лицензии.', category: WIDGET_CATEGORY.licenses, chartType: 'Кольцевая диаграмма', icon: ShieldIcon, Component: LicenseWidget }),
  chart({ id: 'chart-transfers', title: 'Передача продукта', description: 'Статусы передачи материалов и лицензий.', category: WIDGET_CATEGORY.licenses, chartType: 'Кольцевая диаграмма', icon: ShieldIcon, Component: TransferWidget }),
  fullChart({ id: 'chart-deadlines', title: 'Календарь сроков', description: 'Сроки этапов и окончания лицензий.', category: WIDGET_CATEGORY.licenses, chartType: 'Календарь', icon: CalendarIcon, Component: DeadlinesWidget }),
  chart({ id: 'chart-manager-workload', title: 'Статусы по менеджерам', description: 'Нагрузка менеджеров по фазам процесса.', category: WIDGET_CATEGORY.managers, chartType: 'Столбцы с накоплением', icon: UsersIcon, permission: PERMISSION.viewAllInteractions, Component: ManagerWorkloadWidget }),
  chart({ id: 'chart-manager-results', title: 'Результаты менеджеров', description: 'Завершённые процессы и скорость работы.', category: WIDGET_CATEGORY.managers, chartType: 'Столбцы', icon: UsersIcon, permission: PERMISSION.viewAllInteractions, Component: ManagerResultsWidget }),
  fullChart({ id: 'chart-manager-heatmap', title: 'Загрузка менеджеров', description: 'Матрица «менеджер × фаза».', category: WIDGET_CATEGORY.managers, chartType: 'Тепловая карта', icon: UsersIcon, permission: PERMISSION.viewAllInteractions, Component: ManagerHeatmapWidget }),
  chart({ id: 'chart-data-gaps', title: 'Неполные данные', description: 'Пробелы в обязательных полях карточек.', category: WIDGET_CATEGORY.quality, chartType: 'Столбцы', icon: WarningIcon, Component: DataGapsWidget }),
  fullChart({ id: 'chart-quality-table', title: 'Карточки, требующие заполнения', description: 'Детальный отчёт по данным и документам.', category: WIDGET_CATEGORY.quality, chartType: 'Таблица с индикацией', icon: WarningIcon, Component: QualityTableWidget }),
];
