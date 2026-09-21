import { getLicenseState, LICENSE_STATE, TRANSFER_STATUSES } from './contract.js';
import { addDays, toDate, toIsoDate } from './format.js';
import { getStageIndex, PHASES, SLA_STATE } from './workflow.js';

/**
 * Показатели аналитики (ТЗ, раздел «Отчёты»). Все функции чистые: получают строки взаимодействий
 * (см. store/selectors.js → toInteractionRow), события истории и показатели LMS, ничего не знают о React.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const daysFrom = (from, to) => (toDate(to) - toDate(from)) / DAY_MS;
const roundTo = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);
const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function average(values) {
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length;
}

function groupBy(items, getKey) {
  const groups = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

const distinctCount = (items, getKey) => new Set(items.map(getKey)).size;

/* ---------- Сводка ---------- */

/** Ключевые числа для плиток: вузы, активные и завершённые взаимодействия, просрочки. */
export function summarizeInteractions(rows) {
  const completed = rows.filter((row) => row.completedAt).length;
  return {
    total: rows.length,
    universities: distinctCount(rows, (row) => row.universityId),
    active: rows.length - completed,
    completed,
    completionRate: percent(completed, rows.length),
    overdue: rows.filter((row) => row.sla.state === SLA_STATE.overdue).length,
  };
}

/** Новые взаимодействия: начатые внутри периода. Без периода — за последние 30 дней. */
export function countNewInteractions(rows, range, now = new Date()) {
  const from = range?.from ?? addDays(now, -30);
  const to = range?.to ?? null;
  return rows.filter((row) => {
    const started = toDate(row.startedAt);
    return started >= from && (!to || started < to);
  }).length;
}

/** Количество взаимодействий на каждом этапе процесса. */
export function countByStage(rows, workflow) {
  const counts = new Map(workflow.stages.map((stage) => [stage.id, 0]));
  rows.forEach((row) => {
    if (row.workflowId === workflow.id) counts.set(row.stageId, (counts.get(row.stageId) ?? 0) + 1);
  });
  return workflow.stages.map((stage) => ({ stage, count: counts.get(stage.id) }));
}

/* ---------- Время на этапах ---------- */

/**
 * Пребывания на этапах, восстановленные по истории: вход — событие создания или перехода,
 * выход — следующий переход или завершение. Незакрытое пребывание (текущий этап) длится до now.
 * Поэтому дату каждой смены этапа важно сохранять — без неё длительность не посчитать.
 */
export function collectStageStays(rows, events, now = new Date()) {
  const eventsByInteraction = groupBy(events, (event) => event.interactionId);
  const stays = [];

  rows.forEach((row) => {
    const history = [...(eventsByInteraction.get(row.id) ?? [])].sort((a, b) => toDate(a.at) - toDate(b.at));
    let current = null;
    const close = (at) => stays.push({ ...current, to: at, days: daysFrom(current.from, at), open: false });

    history.forEach((event) => {
      if (event.type === 'created' || event.type === 'transition') {
        if (current) close(event.at);
        current = { interactionId: row.id, managerId: row.managerId, stageId: event.toStageId, from: event.at };
      } else if (event.type === 'completed' && current) {
        close(event.at);
        current = null;
      }
    });

    // Карточка без истории (например, из импорта) — известен только вход на текущий этап.
    if (!current && history.length === 0 && !row.completedAt) {
      current = { interactionId: row.id, managerId: row.managerId, stageId: row.stageId, from: row.stageEnteredAt };
    }
    if (current) stays.push({ ...current, to: null, days: daysFrom(current.from, now), open: true });
  });

  return stays;
}

/** Среднее время на каждом этапе — по завершённым пребываниям, рядом с нормативным сроком. */
export function averageStageDays(stays, workflow) {
  const closed = groupBy(stays.filter((stay) => !stay.open), (stay) => stay.stageId);
  return workflow.stages.map((stage) => {
    const values = (closed.get(stage.id) ?? []).map((stay) => stay.days);
    const value = average(values);
    return { stage, average: value === null ? null : roundTo(value), count: values.length, slaDays: stage.slaDays };
  });
}

/** Длительность всего процесса — от создания до завершения, только по завершённым взаимодействиям. */
export function workflowDurations(rows) {
  const items = rows.filter((row) => row.completedAt).map((row) => ({ row, days: roundTo(daysFrom(row.startedAt, row.completedAt), 0) }));
  const value = average(items.map((item) => item.days));
  return { items, average: value === null ? null : Math.round(value) };
}

/** Квартили и выбросы (правило 1,5 × IQR) для диаграммы размаха. */
export function boxStats(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (q) => {
    const position = (sorted.length - 1) * q;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  };
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);
  const fence = q3 + 1.5 * (q3 - q1);
  const lowFence = q1 - 1.5 * (q3 - q1);
  const inside = sorted.filter((value) => value >= lowFence && value <= fence);
  return {
    min: inside[0],
    q1,
    median: quantile(0.5),
    q3,
    max: inside.at(-1),
    outliers: sorted.filter((value) => value < lowFence || value > fence),
    count: sorted.length,
  };
}

/** Длительность пребывания на этапах по фазам процесса — для поиска аномально долгих этапов. */
export function stageDurationByPhase(stays, workflow) {
  const phaseOf = new Map(workflow.stages.map((stage) => [stage.id, stage.phase]));
  const closed = stays.filter((stay) => !stay.open);
  return PHASES.map((phase) => {
    const own = closed.filter((stay) => phaseOf.get(stay.stageId) === phase.id);
    return { phase, stats: boxStats(own.map((stay) => roundTo(stay.days))), stays: own };
  }).filter((item) => item.stats);
}

/* ---------- Воронка и переходы ---------- */

/**
 * Воронка: сколько взаимодействий дошло до каждого этапа (хотя бы раз побывали на нём или дальше)
 * и конверсия из предыдущего этапа. Возврат назад не «откатывает» достигнутый этап.
 */
export function buildFunnel(rows, stays, workflow) {
  const own = rows.filter((row) => row.workflowId === workflow.id);
  const furthest = new Map(own.map((row) => [row.id, getStageIndex(workflow, row.stageId)]));
  stays.forEach((stay) => {
    if (furthest.has(stay.interactionId)) {
      furthest.set(stay.interactionId, Math.max(furthest.get(stay.interactionId), getStageIndex(workflow, stay.stageId)));
    }
  });

  const reachedIndexes = [...furthest.values()];
  return workflow.stages.map((stage, index) => {
    const reached = reachedIndexes.filter((value) => value >= index).length;
    const previous = index === 0 ? null : reachedIndexes.filter((value) => value >= index - 1).length;
    return { stage, reached, share: percent(reached, own.length), conversion: previous === null ? null : percent(reached, previous) };
  });
}

export const TRANSITION_FLOW = Object.freeze({ next: 'next', skip: 'skip', back: 'back' });

/** Переходы между этапами из истории: вперёд по порядку, через этап и возвраты на доработку. */
export function transitionFlows(rows, events, workflow) {
  const ids = new Set(rows.filter((row) => row.workflowId === workflow.id).map((row) => row.id));
  const flows = new Map();

  events.forEach((event) => {
    if (event.type !== 'transition' || !ids.has(event.interactionId)) return;
    const from = getStageIndex(workflow, event.fromStageId);
    const to = getStageIndex(workflow, event.toStageId);
    if (from < 0 || to < 0) return;
    const kind = to < from ? TRANSITION_FLOW.back : to === from + 1 ? TRANSITION_FLOW.next : TRANSITION_FLOW.skip;
    const key = `${event.fromStageId}>${event.toStageId}`;
    const flow = flows.get(key) ?? { id: key, fromStageId: event.fromStageId, toStageId: event.toStageId, from, to, kind, count: 0 };
    flow.count += 1;
    flows.set(key, flow);
  });

  return [...flows.values()].sort((a, b) => a.from - b.from || a.to - b.to);
}

/* ---------- Направления, продукты, вузы ---------- */

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

/** Сколько вузов работает с каждым элементом каталога (направлением или продуктом). */
export function countUniversitiesBy(rows, key, catalog) {
  const groups = groupBy(rows, (row) => row[key]);
  return catalog
    .map((item) => {
      const own = groups.get(item.id) ?? [];
      return { item, universities: distinctCount(own, (row) => row.universityId), interactions: own.length };
    })
    .filter((entry) => entry.interactions > 0)
    .sort((a, b) => b.universities - a.universities || b.interactions - a.interactions);
}

/** Портфель вуза: сколько ИТ-программ и продуктов он использует. */
export function universityPortfolio(rows) {
  return [...groupBy(rows, (row) => row.universityId).values()]
    .map((own) => ({
      university: own[0].university,
      directions: distinctCount(own, (row) => row.directionId),
      products: distinctCount(own, (row) => row.productId),
      interactions: own.length,
    }))
    .sort((a, b) => b.directions + b.products - (a.directions + a.products) || a.university.name.localeCompare(b.university.name));
}

/** Сколько взаимодействий на пересечении двух измерений (вуз × направление и т. п.) — для тепловой карты. */
export function crossCount(rows, getRowKey, getColumnKey) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = `${getRowKey(row)}|${getColumnKey(row)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return (rowKey, columnKey) => counts.get(`${rowKey}|${columnKey}`) ?? 0;
}

/* ---------- Лицензии и передача продукта ---------- */

export function licenseSummary(rows, now = new Date()) {
  const items = rows.map((row) => ({ row, ...getLicenseState(row.contract, now) }));
  const count = (state) => items.filter((item) => item.state === state).length;
  return {
    items,
    signed: items.filter((item) => item.state !== LICENSE_STATE.none).length,
    active: count(LICENSE_STATE.active),
    expiring: count(LICENSE_STATE.expiring),
    expired: count(LICENSE_STATE.expired),
  };
}

export function transferDistribution(rows) {
  return TRANSFER_STATUSES.map((status) => ({ status, count: rows.filter((row) => row.contract?.transferStatus === status).length }));
}

/* ---------- Менеджеры ---------- */

/** Нагрузка и результативность менеджеров: вузы, взаимодействия по фазам, завершённые, скорость этапа. */
export function managerStats(rows, stays, managers) {
  const staysByManager = groupBy(
    stays.filter((stay) => !stay.open),
    (stay) => stay.managerId,
  );
  return managers
    .map((manager) => {
      const own = rows.filter((row) => row.managerId === manager.id);
      const speed = average((staysByManager.get(manager.id) ?? []).map((stay) => stay.days));
      return {
        manager,
        universities: distinctCount(own, (row) => row.universityId),
        interactions: own.length,
        completed: own.filter((row) => row.completedAt).length,
        overdue: own.filter((row) => row.sla.state === SLA_STATE.overdue).length,
        averageStageDays: speed === null ? null : roundTo(speed),
        byPhase: Object.fromEntries(PHASES.map((phase) => [phase.id, own.filter((row) => row.stage.phase === phase.id).length])),
      };
    })
    .filter((item) => item.interactions > 0)
    .sort((a, b) => b.interactions - a.interactions);
}

/* ---------- Полнота данных и документов ---------- */

export const DATA_GAP = Object.freeze({ manager: 'manager', contract: 'contract', license: 'license', contacts: 'contacts' });

export const DATA_GAP_LABELS = {
  [DATA_GAP.manager]: 'Нет ответственного',
  [DATA_GAP.contract]: 'Нет номера договора',
  [DATA_GAP.license]: 'Нет данных лицензии',
  [DATA_GAP.contacts]: 'Нет контакта в вузе',
};

/** Индекс последнего этапа фазы «Договор»: после него у взаимодействия должны быть договор и лицензия. */
function contractStageIndex(workflow) {
  return workflow.stages.findLastIndex((stage) => stage.phase === 'contract');
}

/** Взаимодействия без ответственного, договора или других обязательных данных. */
export function findDataGaps(rows) {
  const items = rows
    .map((row) => {
      const contractDone = row.progress.step - 1 > contractStageIndex(row.workflow) || Boolean(row.completedAt);
      const gaps = [];
      if (!row.manager) gaps.push(DATA_GAP.manager);
      if (contractDone && !row.contract?.number) gaps.push(DATA_GAP.contract);
      if (contractDone && !(row.contract?.licenseSignedAt && row.contract?.licenseYears)) gaps.push(DATA_GAP.license);
      if (!row.contactIds?.length) gaps.push(DATA_GAP.contacts);
      return { row, gaps };
    })
    .filter((item) => item.gaps.length > 0);

  const counts = Object.fromEntries(Object.values(DATA_GAP).map((gap) => [gap, items.filter((item) => item.gaps.includes(gap)).length]));
  return { items, counts };
}

/**
 * Документы: сколько файлов загружено и у каких взаимодействий неполный комплект —
 * пройден этап, результат которого документ (stage.expectsFiles), но файла к нему нет.
 */
export function documentCompleteness(rows, events) {
  const ids = new Set(rows.map((row) => row.id));
  const withFiles = new Set();
  let uploaded = 0;
  events.forEach((event) => {
    if (!ids.has(event.interactionId) || !event.files?.length) return;
    uploaded += event.files.length;
    withFiles.add(`${event.interactionId}|${event.stageId}`);
  });

  const items = rows.map((row) => {
    const current = getStageIndex(row.workflow, row.stageId);
    const missing = row.workflow.stages.filter(
      (stage, index) => stage.expectsFiles && (index < current || (row.completedAt && index === current)) && !withFiles.has(`${row.id}|${stage.id}`),
    );
    return { row, missing };
  });
  const incomplete = items.filter((item) => item.missing.length > 0);
  return { uploaded, incomplete, complete: items.length - incomplete.length };
}

/* ---------- Динамика и календарь ---------- */

/** Сумма показателя LMS по месяцам — для графиков динамики. */
export function sumByMonth(metrics, key) {
  const byMonth = new Map();
  metrics.forEach((metric) => byMonth.set(metric.month, (byMonth.get(metric.month) ?? 0) + metric[key]));
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, value }));
}

/** Месяцы 'YYYY-MM' от from до to включительно. */
export function monthRange(from, to) {
  const months = [];
  const cursor = new Date(`${from}-01T00:00:00`);
  while (toIsoDate(cursor).slice(0, 7) <= to) {
    months.push(toIsoDate(cursor).slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

/** Новые взаимодействия по месяцам начала работы. */
export function countStartedByMonth(rows, months) {
  return months.map((month) => ({ month, value: rows.filter((row) => row.startedAt.slice(0, 7) === month).length }));
}

export const DEADLINE_KIND = Object.freeze({ stage: 'stage', license: 'license' });

/** Ближайшие сроки: окончание этапов и лицензий в окне [now − pastDays; now + horizonDays]. */
export function upcomingDeadlines(rows, now = new Date(), { horizonDays = 180, pastDays = 30 } = {}) {
  const from = addDays(now, -pastDays);
  const to = addDays(now, horizonDays);
  const inWindow = (date) => date && date >= from && date <= to;

  const stageDeadlines = rows
    .filter((row) => !row.completedAt && inWindow(row.sla.deadline))
    .map((row) => ({ id: `stage-${row.id}`, kind: DEADLINE_KIND.stage, date: row.sla.deadline, row, label: row.stage.name }));
  const licenseDeadlines = rows
    .map((row) => ({ row, license: getLicenseState(row.contract, now) }))
    .filter(({ license }) => inWindow(license.expiresAt))
    .map(({ row, license }) => ({ id: `license-${row.id}`, kind: DEADLINE_KIND.license, date: license.expiresAt, row, label: `Лицензия ${row.product.name}` }));

  return [...stageDeadlines, ...licenseDeadlines].sort((a, b) => a.date - b.date);
}
