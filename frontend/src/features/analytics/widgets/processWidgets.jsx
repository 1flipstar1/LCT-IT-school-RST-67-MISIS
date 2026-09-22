import { useMemo, useState } from 'react';
import { useRouter } from '../../../app/router.jsx';
import { countByStage, TRANSITION_FLOW } from '../../../domain/analytics.js';
import { formatDate, formatDays, formatNumber } from '../../../domain/format.js';
import { getStage, PHASES } from '../../../domain/workflow.js';
import { BarChart } from '../../../ui/charts/BarChart.jsx';
import { BoxPlotChart } from '../../../ui/charts/BoxPlotChart.jsx';
import { ChartCard } from '../../../ui/charts/ChartCard.jsx';
import { DonutChart } from '../../../ui/charts/DonutChart.jsx';
import { FlowChart } from '../../../ui/charts/FlowChart.jsx';
import { FunnelChart } from '../../../ui/charts/FunnelChart.jsx';
import { LineChart } from '../../../ui/charts/LineChart.jsx';
import { STATUS_COLORS } from '../../../ui/charts/shades.js';
import { TimelineChart } from '../../../ui/charts/TimelineChart.jsx';
import { AnalyticsIcon, HistoryIcon, PulseIcon, WorkflowIcon } from '../../../ui/icons.js';
import { SelectMenu } from '../../../ui/SelectMenu.jsx';
import { WIDGET_SIZE } from '../dashboard/layout.js';
import { CHART_SIZES, formatAverageDays, monthTable, PHASE_SERIES, phaseColor, toLinePoints, WIDGET_CATEGORY } from './common.js';

const chart = (definition) => ({ rowSpan: 2, sizes: CHART_SIZES, defaultSize: WIDGET_SIZE.m, ...definition });

/* ---------- Динамика по месяцам ---------- */

const MONTHLY = [
  { id: 'chart-applications', key: 'applications', title: 'Заявки на обучение по месяцам', valueLabel: 'Заявок', description: 'Сколько заявок пришло из LMS и с сайта за каждый месяц.' },
  { id: 'chart-students', key: 'students', title: 'Обучающиеся по месяцам', valueLabel: 'Обучающихся', description: 'Сколько человек училось в каждом месяце по данным LMS.' },
  { id: 'chart-streams', key: 'streams', title: 'Параллельные потоки по месяцам', valueLabel: 'Потоков', description: 'Сколько учебных потоков шло одновременно в каждом месяце.' },
  { id: 'chart-started', key: 'started', title: 'Новые взаимодействия по месяцам', valueLabel: 'Новых', description: 'Сколько взаимодействий с вузами начато в каждом месяце.' },
];

const monthlyWidgets = MONTHLY.map(({ id, key, title, valueLabel, description }) =>
  chart({
    id,
    title,
    description,
    category: WIDGET_CATEGORY.dynamics,
    chartType: 'Линейный график',
    icon: PulseIcon,
    Component: ({ data }) => (
      <ChartCard
        id={`analytics-${id}`}
        title={title}
        hint={description}
        description="Наведите на график, чтобы увидеть точное число."
        chart={<LineChart ariaLabel={title} valueLabel={valueLabel} points={toLinePoints(data.monthly[key])} />}
        table={monthTable(data.monthly[key], valueLabel)}
      />
    ),
  }),
);

/* ---------- Этапы процесса ---------- */

function FunnelWidget({ data }) {
  const { navigate } = useRouter();
  const steps = data.funnel.map((item) => ({ id: item.stage.id, label: item.stage.name, value: item.reached, conversion: item.conversion, muted: item.stage.optional }));
  return (
    <ChartCard
      id="analytics-chart-funnel"
      title="Воронка этапов"
      hint="Сколько взаимодействий дошло до каждого из 14 этапов и какая доля перешла дальше. Возврат на доработку не уменьшает достигнутый этап."
      description="Справа — сколько дошло и конверсия из предыдущего этапа. Нажмите на этап, чтобы открыть список."
      chart={<FunnelChart ariaLabel="Воронка прохождения этапов" steps={steps} onStepClick={(step) => navigate(`/interactions?stage=${step.id}`)} />}
      table={{
        rowKey: (item) => item.stage.id,
        rows: data.funnel,
        columns: [
          { id: 'stage', header: 'Этап', primary: true, cell: (item) => item.stage.name },
          { id: 'reached', header: 'Дошли', align: 'right', cell: (item) => item.reached },
          { id: 'share', header: 'От всех', align: 'right', cell: (item) => `${item.share}%` },
          { id: 'conversion', header: 'Конверсия', align: 'right', cell: (item) => (item.conversion === null ? '—' : `${item.conversion}%`) },
        ],
      }}
      footer="Этап «Корректировка документов» необязательный: взаимодействие может пройти мимо него, поэтому он показан светлее."
    />
  );
}

function StagesWidget({ data }) {
  const { navigate } = useRouter();
  const counts = useMemo(() => countByStage(data.rows, data.workflow), [data.rows, data.workflow]);
  return (
    <ChartCard
      id="analytics-chart-stages"
      title="Взаимодействия по этапам"
      hint="На каком этапе сейчас работа с вузами: сколько взаимодействий на каждом из 14 этапов."
      description="Нажмите на этап, чтобы открыть список."
      chart={
        <BarChart
          ariaLabel="Количество взаимодействий на этапах работы"
          onBarClick={(item) => navigate(`/interactions?stage=${item.id}`)}
          groups={PHASES.map((phase) => ({
            id: phase.id,
            label: phase.label,
            items: counts.filter((item) => item.stage.phase === phase.id).map((item) => ({ id: item.stage.id, label: item.stage.name, value: item.count })),
          }))}
        />
      }
      table={{
        rowKey: (item) => item.stage.id,
        rows: counts,
        columns: [
          { id: 'stage', header: 'Этап', primary: true, cell: (item) => item.stage.name },
          { id: 'count', header: 'Взаимодействий', align: 'right', cell: (item) => item.count },
        ],
      }}
    />
  );
}

function PhaseShareWidget({ data }) {
  const active = data.rows.filter((row) => !row.completedAt);
  const segments = [
    ...PHASE_SERIES.map((phase) => ({ ...phase, value: active.filter((row) => row.stage.phase === phase.id).length })),
    { id: 'completed', label: 'Завершено', color: STATUS_COLORS.success, value: data.summary.completed },
  ];
  return (
    <ChartCard
      id="analytics-chart-phase-share"
      title="Доли по фазам"
      hint="14 этапов укрупнены до 4 фаз: знакомство, договор, внедрение, обучение. Завершённые показаны отдельно."
      description="Какая часть взаимодействий в какой фазе работы."
      chart={<DonutChart ariaLabel="Доли взаимодействий по фазам процесса" segments={segments} centerLabel="взаимодействий" />}
      table={{
        rowKey: (item) => item.id,
        rows: segments,
        columns: [
          { id: 'label', header: 'Фаза', primary: true, cell: (item) => item.label },
          { id: 'value', header: 'Взаимодействий', align: 'right', cell: (item) => item.value },
        ],
      }}
    />
  );
}

function StageTimeWidget({ data }) {
  const items = data.stageTimes.filter((item) => item.average !== null);
  return (
    <ChartCard
      id="analytics-chart-stage-time"
      title="Среднее время на этапе"
      hint="Сколько дней в среднем взаимодействие находится на этапе. Считается по датам смены этапа в истории."
      description="В днях, по завершённым этапам. В подсказке — нормативный срок."
      chart={
        <BarChart
          ariaLabel="Среднее время нахождения на каждом этапе, дней"
          formatValue={formatAverageDays}
          groups={PHASES.map((phase) => ({
            id: phase.id,
            label: phase.label,
            items: items.filter((item) => item.stage.phase === phase.id).map((item) => ({ id: item.stage.id, label: item.stage.name, value: item.average, source: item })),
          })).filter((group) => group.items.length > 0)}
          formatTooltip={(item) => (
            <>
              <b>{item.label}</b>
              <span>В среднем: {formatAverageDays(item.value)} дн.</span>
              <span>Норматив: {formatDays(item.source.slaDays)}</span>
              <span>Завершённых этапов: {item.source.count}</span>
            </>
          )}
        />
      }
      table={{
        rowKey: (item) => item.stage.id,
        rows: data.stageTimes,
        columns: [
          { id: 'stage', header: 'Этап', primary: true, cell: (item) => item.stage.name },
          { id: 'average', header: 'В среднем, дн.', align: 'right', cell: (item) => formatAverageDays(item.average) },
          { id: 'sla', header: 'Норматив, дн.', align: 'right', cell: (item) => item.slaDays },
          { id: 'count', header: 'Завершено этапов', align: 'right', cell: (item) => item.count },
        ],
      }}
    />
  );
}

function DurationBoxWidget({ data }) {
  const groups = data.durationByPhase.map((item) => ({ id: item.phase.id, label: item.phase.label, stats: item.stats }));
  return (
    <ChartCard
      id="analytics-chart-duration-box"
      title="Разброс длительности этапов"
      hint="Диаграмма размаха: коробка — где лежит половина значений, линия — медиана, оранжевые точки — аномально долгие этапы."
      description="Сколько дней занимает этап в каждой фазе. Оранжевые точки — аномально долгие."
      chart={<BoxPlotChart ariaLabel="Разброс длительности этапов по фазам, дней" groups={groups} />}
      table={{
        rowKey: (item) => item.id,
        rows: groups,
        columns: [
          { id: 'phase', header: 'Фаза', primary: true, cell: (item) => item.label },
          { id: 'median', header: 'Медиана, дн.', align: 'right', cell: (item) => formatNumber(Math.round(item.stats.median)) },
          { id: 'range', header: 'Половина значений', align: 'right', cell: (item) => `${Math.round(item.stats.q1)}–${Math.round(item.stats.q3)}` },
          { id: 'outliers', header: 'Аномальных', align: 'right', cell: (item) => item.stats.outliers.length },
          { id: 'count', header: 'Всего', align: 'right', cell: (item) => item.stats.count },
        ],
      }}
      footer="Аномальное значение — больше третьего квартиля на полтора межквартильных размаха (правило Тьюки)."
    />
  );
}

const FLOW_LABELS = {
  [TRANSITION_FLOW.next]: 'По порядку',
  [TRANSITION_FLOW.skip]: 'Через этап',
  [TRANSITION_FLOW.back]: 'Возврат на доработку',
};

const FLOW_COLORS = {
  [TRANSITION_FLOW.next]: 'var(--color-brand)',
  [TRANSITION_FLOW.skip]: 'var(--color-text-tertiary)',
  [TRANSITION_FLOW.back]: 'var(--color-accent)',
};

function FlowsWidget({ data }) {
  const nodes = data.workflow.stages.map((stage, index) => ({ id: stage.id, label: stage.name, short: String(index + 1) }));
  const stageName = (stageId) => getStage(data.workflow, stageId)?.name;
  const unusual = data.flows.filter((flow) => flow.kind !== TRANSITION_FLOW.next);
  return (
    <ChartCard
      id="analytics-chart-flows"
      title="Переходы между этапами"
      hint="Как взаимодействия переходят между этапами: по порядку, через необязательный этап или назад на доработку. Толщина линии — число переходов."
      description={`Этапы пронумерованы по порядку. Нестандартных переходов: ${unusual.reduce((sum, flow) => sum + flow.count, 0)}.`}
      chart={<FlowChart ariaLabel="Переходы между этапами процесса" nodes={nodes} flows={data.flows} colors={FLOW_COLORS} labels={FLOW_LABELS} />}
      table={{
        rowKey: (item) => item.id,
        rows: data.flows,
        columns: [
          { id: 'from', header: 'С этапа', primary: true, cell: (item) => stageName(item.fromStageId) },
          { id: 'to', header: 'На этап', cell: (item) => stageName(item.toStageId) },
          { id: 'kind', header: 'Вид', cell: (item) => FLOW_LABELS[item.kind] },
          { id: 'count', header: 'Переходов', align: 'right', cell: (item) => item.count },
        ],
      }}
    />
  );
}

/** Диаграмма Ганта по вузу: каждое взаимодействие вуза — дорожка, каждый этап — отрезок. */
function TimelineWidget({ data }) {
  const universities = useMemo(() => {
    const byId = new Map();
    data.rows.forEach((row) => byId.set(row.universityId, row.university));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.rows]);
  const [selectedId, setSelectedId] = useState(null);
  const universityId = universities.some((item) => item.id === selectedId) ? selectedId : universities[0]?.id;

  const own = data.rows.filter((row) => row.universityId === universityId);
  const lanes = own.map((row) => ({
    id: row.id,
    label: `${row.direction.name} · ${row.product.name}`,
    segments: data.stays
      .filter((stay) => stay.interactionId === row.id)
      .map((stay, index) => {
        const stage = getStage(row.workflow, stay.stageId);
        return { id: `${row.id}-${index}`, from: stay.from, to: stay.to, label: stage?.name ?? 'Этап удалён', color: phaseColor(stage?.phase) };
      }),
  }));
  const stays = lanes.flatMap((lane) => lane.segments.map((segment) => ({ ...segment, lane: lane.label })));

  return (
    <ChartCard
      id="analytics-chart-timeline"
      title="История этапов вуза"
      hint="Диаграмма Ганта: как каждое взаимодействие вуза шло по этапам во времени. Цвет — фаза процесса."
      description="Выберите вуз. Наведите на отрезок, чтобы увидеть этап и даты."
      toolbar={
        universities.length > 0 && (
          <SelectMenu
            label="Вуз"
            value={universityId}
            options={universities.map((item) => ({ value: item.id, label: item.shortName ?? item.name }))}
            onChange={setSelectedId}
          />
        )
      }
      chart={<TimelineChart ariaLabel="История прохождения этапов выбранным вузом" lanes={lanes} legend={PHASE_SERIES} now={data.now} />}
      table={{
        rowKey: (item) => item.id,
        rows: stays,
        columns: [
          { id: 'lane', header: 'Взаимодействие', primary: true, cell: (item) => item.lane },
          { id: 'stage', header: 'Этап', cell: (item) => item.label },
          { id: 'from', header: 'С', cell: (item) => formatDate(item.from) },
          { id: 'to', header: 'По', cell: (item) => (item.to ? formatDate(item.to) : 'сейчас') },
        ],
      }}
    />
  );
}

export const PROCESS_WIDGETS = [
  ...monthlyWidgets,
  chart({ id: 'chart-funnel', title: 'Воронка этапов', description: 'Прохождение 14 этапов и конверсия между ними.', category: WIDGET_CATEGORY.process, chartType: 'Воронка', icon: WorkflowIcon, Component: FunnelWidget }),
  chart({ id: 'chart-stages', title: 'Взаимодействия по этапам', description: 'Сколько взаимодействий сейчас на каждом этапе.', category: WIDGET_CATEGORY.process, chartType: 'Столбцы', icon: AnalyticsIcon, Component: StagesWidget }),
  chart({ id: 'chart-phase-share', title: 'Доли по фазам', description: 'Укрупнённые статусы: знакомство, договор, внедрение, обучение.', category: WIDGET_CATEGORY.process, chartType: 'Кольцевая диаграмма', icon: AnalyticsIcon, Component: PhaseShareWidget }),
  chart({ id: 'chart-stage-time', title: 'Среднее время на этапе', description: 'Сколько дней в среднем длится каждый этап.', category: WIDGET_CATEGORY.process, chartType: 'Столбцы', icon: HistoryIcon, Component: StageTimeWidget }),
  chart({ id: 'chart-duration-box', title: 'Разброс длительности этапов', description: 'Поиск аномально долгих этапов.', category: WIDGET_CATEGORY.process, chartType: 'Диаграмма размаха', icon: HistoryIcon, Component: DurationBoxWidget }),
  chart({ id: 'chart-flows', title: 'Переходы между этапами', description: 'Возвраты и нестандартные маршруты.', category: WIDGET_CATEGORY.process, chartType: 'Потоки (Sankey)', icon: WorkflowIcon, defaultSize: WIDGET_SIZE.l, Component: FlowsWidget }),
  chart({ id: 'chart-timeline', title: 'История этапов вуза', description: 'Путь по этапам во времени для выбранного вуза.', category: WIDGET_CATEGORY.process, chartType: 'Диаграмма Ганта', icon: HistoryIcon, defaultSize: WIDGET_SIZE.l, Component: TimelineWidget }),
];
