import { useMemo, useRef, useState } from 'react';
import { useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { countByStage, rankDirections, sumByMonth } from '../../domain/analytics.js';
import { filterInteractionRows, resolvePeriod } from '../../domain/filters.js';
import { formatMonth, formatNumber, toIsoDate } from '../../domain/format.js';
import { PERMISSION } from '../../domain/roles.js';
import { PHASES, SLA_STATE } from '../../domain/workflow.js';
import { useCatalogIndex, useManagers, useVisibleInteractionRows, useVisibleMetrics } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { Button } from '../../ui/Button.jsx';
import { BarChart } from '../../ui/charts/BarChart.jsx';
import { ChartCard } from '../../ui/charts/ChartCard.jsx';
import { LineChart } from '../../ui/charts/LineChart.jsx';
import { DownloadIcon, EducationIcon, InteractionsIcon, ReportIcon, UsersIcon } from '../../ui/icons.js';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { StatTile } from '../../ui/StatTile.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { describeFilters } from '../filters/describeFilters.js';
import { FilterBar } from '../filters/FilterBar.jsx';
import { useFilters } from '../filters/useFilters.js';
import { downloadAnalyticsPdf } from './analyticsPdf.js';
import styles from './AnalyticsPage.module.css';

/** Показатели LMS за период: месяц попадает в период, если он не раньше начала периода. */
function filterMetricsByPeriod(metrics, period) {
  const range = resolvePeriod(period);
  if (!range) return metrics;
  const fromMonth = range.from ? toIsoDate(range.from).slice(0, 7) : '';
  const toMonth = range.to ? toIsoDate(range.to).slice(0, 7) : '9999-12';
  return metrics.filter((metric) => metric.month >= fromMonth && metric.month <= toMonth);
}

export function AnalyticsPage() {
  const { directions, workflows } = useStoreState();
  const { can } = useSession();
  const { navigate } = useRouter();
  const managers = useManagers();
  const allRows = useVisibleInteractionRows();
  const index = useCatalogIndex();
  const toast = useToast();
  const pageRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useFilters('analytics');

  const rows = useMemo(() => filterInteractionRows(allRows, filters), [allRows, filters]);
  const pairMetrics = useVisibleMetrics(rows);
  const metrics = useMemo(() => filterMetricsByPeriod(pairMetrics, filters.period), [pairMetrics, filters.period]);

  const monthly = useMemo(() => sumByMonth(metrics, 'applications'), [metrics]);
  const ranking = useMemo(() => rankDirections(metrics, directions), [metrics, directions]);
  const stageCounts = useMemo(() => countByStage(rows, workflows[0]), [rows, workflows]);

  const lastMonth = monthly.at(-1)?.month;
  const latest = metrics.filter((metric) => metric.month === lastMonth);
  const totals = {
    applications: metrics.reduce((sum, metric) => sum + metric.applications, 0),
    students: latest.reduce((sum, metric) => sum + metric.students, 0),
    streams: latest.reduce((sum, metric) => sum + metric.streams, 0),
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      await downloadAnalyticsPdf({
        container: pageRef.current,
        summary: describeFilters(filters, index),
        totals: { ...totals, interactions: rows.length },
        ranking,
      });
      toast.success('PDF скачан');
    } catch {
      toast.error('Не удалось сформировать PDF', { code: 'APP-500' });
    } finally {
      setExporting(false);
    }
  };

  const workload = managers
    .map((manager) => {
      const own = rows.filter((row) => row.managerId === manager.id);
      return { manager, total: own.length, overdue: own.filter((row) => row.sla.state === SLA_STATE.overdue).length };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div ref={pageRef}>
      <PageHeader
        title="Аналитика"
        actions={
          <Button icon={DownloadIcon} onClick={exportPdf} disabled={exporting}>
            {exporting ? 'Формируем PDF…' : 'Скачать PDF'}
          </Button>
        }
      />

      <FilterBar filters={filters} onChange={setFilters} show={{ search: false }} />

      <section className={styles.stats} aria-label="Итоги за период">
        <StatTile label="Заявок на обучение" value={formatNumber(totals.applications)} hint="Сумма за выбранный период" icon={ReportIcon} />
        <StatTile label="Обучающихся" value={formatNumber(totals.students)} hint={lastMonth ? `По данным LMS за ${formatMonth(lastMonth).toLowerCase()}` : 'Нет данных'} icon={EducationIcon} />
        <StatTile label="Параллельных потоков" value={formatNumber(totals.streams)} hint="Идут одновременно сейчас" icon={UsersIcon} />
        <StatTile label="Взаимодействий" value={rows.length} hint="С учётом фильтров" icon={InteractionsIcon} href="/interactions" />
      </section>

      <div className={styles.grid}>
        <ChartCard
          id="analytics-applications"
          title="Заявки на обучение по месяцам"
          description="Все выбранные вузы и направления. Наведите на график, чтобы увидеть точное число."
          chart={
            <LineChart
              ariaLabel="Динамика заявок на обучение по месяцам"
              valueLabel="Заявок"
              points={monthly.map((item) => ({ key: item.month, label: formatMonth(item.month), value: item.value }))}
            />
          }
          table={{
            rowKey: (item) => item.month,
            rows: monthly,
            columns: [
              { id: 'month', header: 'Месяц', primary: true, cell: (item) => `${formatMonth(item.month)} ${item.month.slice(0, 4)}` },
              { id: 'value', header: 'Заявок', align: 'right', cell: (item) => formatNumber(item.value) },
            ],
          }}
        />

        <ChartCard
          id="analytics-ranking"
          title="Рейтинг ИТ-направлений"
          description="Индекс востребованности от 0 до 100: чем выше, тем больше спрос на программу."
          chart={
            <BarChart
              ariaLabel="Индекс востребованности по ИТ-направлениям"
              groups={[{ id: 'ranking', items: ranking.map((item) => ({ id: item.direction.id, label: item.direction.name, value: item.index, source: item })) }]}
              formatTooltip={(item) => (
                <>
                  <b>{item.label}</b>
                  <span>Заявок: {formatNumber(item.source.applications)}</span>
                  <span>Обучающихся: {formatNumber(item.source.students)}</span>
                  <span>Потоков: {item.source.streams}</span>
                </>
              )}
            />
          }
          table={{
            rowKey: (item) => item.direction.id,
            rows: ranking,
            columns: [
              { id: 'direction', header: 'Направление', primary: true, cell: (item) => item.direction.name },
              { id: 'applications', header: 'Заявок', align: 'right', cell: (item) => formatNumber(item.applications) },
              { id: 'students', header: 'Обучающихся', align: 'right', cell: (item) => formatNumber(item.students) },
              { id: 'streams', header: 'Потоков', align: 'right', cell: (item) => item.streams },
              { id: 'index', header: 'Индекс', align: 'right', cell: (item) => item.index },
            ],
          }}
          footer="Как считается индекс: заявки, обучающиеся и параллельные потоки делятся на максимум по выборке, три доли усредняются и умножаются на 100. У всех трёх показателей одинаковый вес."
        />
      </div>

      <div className={styles.grid}>
        <ChartCard
          id="analytics-stages"
          title="Взаимодействия по этапам"
          description="Где сейчас находится работа с вузами. Нажмите на этап, чтобы открыть список."
          chart={
            <BarChart
              ariaLabel="Количество взаимодействий на этапах работы"
              onBarClick={(item) => navigate(`/interactions?stage=${item.id}`)}
              groups={PHASES.map((phase) => ({
                id: phase.id,
                label: phase.label,
                items: stageCounts.filter((item) => item.stage.phase === phase.id).map((item) => ({ id: item.stage.id, label: item.stage.name, value: item.count })),
              }))}
            />
          }
          table={{
            rowKey: (item) => item.stage.id,
            rows: stageCounts,
            columns: [
              { id: 'stage', header: 'Этап', primary: true, cell: (item) => item.stage.name },
              { id: 'count', header: 'Взаимодействий', align: 'right', cell: (item) => item.count },
            ],
          }}
        />

        {can(PERMISSION.viewAllInteractions) && (
          <ChartCard
            id="analytics-workload"
            title="Нагрузка на менеджеров"
            description="Сколько взаимодействий ведёт каждый менеджер. В подсказке — сколько из них просрочено."
            chart={
              <BarChart
                ariaLabel="Количество взаимодействий у каждого менеджера"
                groups={[{ id: 'workload', items: workload.map((item) => ({ id: item.manager.id, label: item.manager.name, value: item.total, overdue: item.overdue })) }]}
                formatTooltip={(item) => (
                  <>
                    <b>{item.label}</b>
                    <span>Взаимодействий: {item.value}</span>
                    <span>Просрочено: {item.overdue}</span>
                  </>
                )}
              />
            }
            table={{
              rowKey: (item) => item.manager.id,
              rows: workload,
              columns: [
                { id: 'manager', header: 'Менеджер', primary: true, cell: (item) => item.manager.name },
                { id: 'total', header: 'Взаимодействий', align: 'right', cell: (item) => item.total },
                { id: 'overdue', header: 'Просрочено', align: 'right', cell: (item) => item.overdue },
              ],
            }}
          />
        )}
      </div>
    </div>
  );
}
