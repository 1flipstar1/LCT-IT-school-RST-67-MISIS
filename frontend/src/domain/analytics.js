/** Количество взаимодействий на каждом этапе процесса — основа воронки. */
export function countByStage(rows, workflow) {
  const counts = new Map(workflow.stages.map((stage) => [stage.id, 0]));
  rows.forEach((row) => {
    if (row.workflowId === workflow.id) counts.set(row.stageId, (counts.get(row.stageId) ?? 0) + 1);
  });
  return workflow.stages.map((stage) => ({ stage, count: counts.get(stage.id) }));
}

/**
 * Рейтинг ИТ-направлений по востребованности (ТЗ, раздел 2).
 * Каждый показатель нормируется к максимуму по выборке (0…1), индекс — среднее трёх долей × 100.
 * Так показатели разного масштаба (сотни заявок и единицы потоков) весят одинаково,
 * а формула прозрачна и её можно объяснить пользователю в подсказке.
 */
export function rankDirections(metrics, directions) {
  const totals = directions.map((direction) => {
    const own = metrics.filter((metric) => metric.directionId === direction.id);
    return {
      direction,
      applications: sum(own, 'applications'),
      students: sum(own, 'students'),
      streams: Math.max(0, ...own.map((metric) => metric.streams)),
    };
  });

  const max = {
    applications: Math.max(1, ...totals.map((item) => item.applications)),
    students: Math.max(1, ...totals.map((item) => item.students)),
    streams: Math.max(1, ...totals.map((item) => item.streams)),
  };

  return totals
    .map((item) => ({
      ...item,
      index: Math.round(
        ((item.applications / max.applications + item.students / max.students + item.streams / max.streams) / 3) * 100,
      ),
    }))
    .filter((item) => item.applications + item.students > 0)
    .sort((a, b) => b.index - a.index);
}

/** Сумма показателя по месяцам — для графика динамики. */
export function sumByMonth(metrics, key) {
  const byMonth = new Map();
  metrics.forEach((metric) => byMonth.set(metric.month, (byMonth.get(metric.month) ?? 0) + metric[key]));
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, value }));
}

function sum(items, key) {
  return items.reduce((total, item) => total + item[key], 0);
}
