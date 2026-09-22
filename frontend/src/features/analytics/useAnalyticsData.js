import { useMemo } from 'react';
import {
  averageStageDays,
  buildFunnel,
  collectStageStays,
  countNewInteractions,
  countStartedByMonth,
  countUniversitiesBy,
  crossCount,
  documentCompleteness,
  findDataGaps,
  licenseSummary,
  managerStats,
  monthRange,
  rankDirections,
  stageDurationByPhase,
  sumByMonth,
  summarizeInteractions,
  transferDistribution,
  transitionFlows,
  universityPortfolio,
  upcomingDeadlines,
  workflowDurations,
} from '../../domain/analytics.js';
import { filterInteractionRows, resolvePeriod } from '../../domain/filters.js';
import { toIsoDate } from '../../domain/format.js';
import { useManagers, useVisibleInteractionRows, useVisibleMetrics } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';

const MONTHS_ON_CHART = 12;

/** Показатели LMS за период: месяц попадает в период, если он пересекается с ним. */
function filterMetricsByPeriod(metrics, range) {
  if (!range) return metrics;
  const fromMonth = range.from ? toIsoDate(range.from).slice(0, 7) : '';
  const toMonth = range.to ? toIsoDate(range.to).slice(0, 7) : '9999-12';
  return metrics.filter((metric) => metric.month >= fromMonth && metric.month <= toMonth);
}

/** Месяцы для графика новых взаимодействий: последние 12, но не раньше начала периода. */
function chartMonths(range, now) {
  const last = toIsoDate(now).slice(0, 7);
  const yearAgo = toIsoDate(new Date(now.getFullYear(), now.getMonth() - (MONTHS_ON_CHART - 1), 1)).slice(0, 7);
  const periodStart = range?.from ? toIsoDate(range.from).slice(0, 7) : '';
  return monthRange(periodStart > yearAgo ? periodStart : yearAgo, last);
}

/**
 * Все данные панели аналитики по текущим фильтрам — считаются один раз и делятся между виджетами.
 * Видимость по роли уже учтена в useVisibleInteractionRows: менеджер видит только свои взаимодействия.
 */
export function useAnalyticsData(filters) {
  const { universities, directions, programs, products, workflows, events } = useStoreState();
  const managers = useManagers();
  const allRows = useVisibleInteractionRows();
  const rows = useMemo(() => filterInteractionRows(allRows, filters), [allRows, filters]);
  const pairMetrics = useVisibleMetrics(rows);

  return useMemo(() => {
    const now = new Date();
    const workflow = workflows[0];
    const range = resolvePeriod(filters.period, now);
    const metrics = filterMetricsByPeriod(pairMetrics, range);
    const stays = collectStageStays(rows, events, now);

    const monthly = {
      applications: sumByMonth(metrics, 'applications'),
      students: sumByMonth(metrics, 'students'),
      streams: sumByMonth(metrics, 'streams'),
      started: countStartedByMonth(rows, chartMonths(range, now)),
    };
    // Обучающиеся и потоки — «снимок» на месяц, поэтому итог берём за последний месяц, а заявки суммируем.
    const lastMonth = monthly.students.at(-1)?.month ?? null;
    const latest = metrics.filter((metric) => metric.month === lastMonth);

    return {
      now,
      range,
      rows,
      workflow,
      stays,
      managers,
      catalogs: { universities, directions, programs, products },
      summary: summarizeInteractions(rows),
      newInteractions: countNewInteractions(rows, range, now),
      lms: {
        lastMonth,
        applications: metrics.reduce((sum, metric) => sum + metric.applications, 0),
        students: latest.reduce((sum, metric) => sum + metric.students, 0),
        streams: latest.reduce((sum, metric) => sum + metric.streams, 0),
      },
      monthly,
      ranking: rankDirections(metrics, directions),
      directionsByUniversity: countUniversitiesBy(rows, 'directionId', directions),
      programsByUniversity: countUniversitiesBy(rows, 'programId', programs),
      productsByUniversity: countUniversitiesBy(rows, 'productId', products),
      universityPortfolio: universityPortfolio(rows),
      universityDirectionCount: crossCount(rows, (row) => row.universityId, (row) => row.directionId),
      universityProgramCount: crossCount(rows, (row) => row.universityId, (row) => row.programId),
      universityProductCount: crossCount(rows, (row) => row.universityId, (row) => row.productId),
      funnel: buildFunnel(rows, stays, workflow),
      stageTimes: averageStageDays(stays, workflow),
      durationByPhase: stageDurationByPhase(stays, workflow),
      workflowDuration: workflowDurations(rows),
      flows: transitionFlows(rows, events, workflow),
      licenses: licenseSummary(rows, now),
      transfers: transferDistribution(rows),
      deadlines: upcomingDeadlines(rows, now),
      managerStats: managerStats(rows, stays, managers),
      dataGaps: findDataGaps(rows),
      documents: documentCompleteness(rows, events),
    };
  }, [rows, pairMetrics, events, workflows, universities, directions, programs, products, managers, filters.period]);
}
