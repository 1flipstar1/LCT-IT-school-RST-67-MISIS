import { addDays, startOfDay, toDate } from './format.js';
import { needsAttention } from './workflow.js';

/**
 * Единая модель фильтров: одинаково работает в списке взаимодействий, аналитике и отчётах
 * Фильтрация за период по вузам, ИТ-направлениям, ИТ-программам, ИТ-продуктам и ответственным.
 */
export const PERIOD_PRESETS = [
  { id: 'all', label: 'За всё время' },
  { id: '30d', label: 'Последние 30 дней', days: 30 },
  { id: '90d', label: 'Последние 3 месяца', days: 90 },
  { id: '365d', label: 'Последний год', days: 365 },
  { id: 'custom', label: 'Свой период' },
];

export const EMPTY_FILTERS = Object.freeze({
  query: '',
  period: { preset: 'all', from: '', to: '' },
  universityIds: [],
  directionIds: [],
  programIds: [],
  productIds: [],
  managerIds: [],
  stageIds: [],
  onlyAttention: false,
});

export function resolvePeriod(period, now = new Date()) {
  if (!period || period.preset === 'all') return null;
  if (period.preset === 'custom') {
    return {
      from: period.from ? startOfDay(period.from) : null,
      to: period.to ? addDays(startOfDay(period.to), 1) : null,
    };
  }
  const preset = PERIOD_PRESETS.find((item) => item.id === period.preset);
  return { from: addDays(startOfDay(now), -preset.days), to: null };
}

/** Взаимодействие попадает в период, если оно было активно хотя бы один день внутри периода. */
function isActiveInPeriod(interaction, range) {
  if (!range) return true;
  const started = toDate(interaction.startedAt);
  const finished = interaction.completedAt ? toDate(interaction.completedAt) : null;
  if (range.to && started >= range.to) return false;
  if (range.from && finished && finished < range.from) return false;
  return true;
}

const includesOrAny = (selected, value) => selected.length === 0 || selected.includes(value);

export function countActiveFilters(filters) {
  return (
    (filters.period.preset !== 'all' ? 1 : 0) +
    filters.universityIds.length +
    filters.directionIds.length +
    filters.programIds.length +
    filters.productIds.length +
    filters.managerIds.length +
    filters.stageIds.length +
    (filters.onlyAttention ? 1 : 0)
  );
}

/** Фильтрует обогащённые строки (см. store/selectors.js → useInteractionRows). */
export function filterInteractionRows(rows, filters, now = new Date()) {
  const range = resolvePeriod(filters.period, now);
  const query = filters.query.trim().toLowerCase();

  return rows.filter(
    (row) =>
      isActiveInPeriod(row, range) &&
      includesOrAny(filters.universityIds, row.universityId) &&
      includesOrAny(filters.directionIds, row.directionId) &&
      includesOrAny(filters.programIds, row.programId) &&
      includesOrAny(filters.productIds, row.productId) &&
      includesOrAny(filters.managerIds, row.managerId) &&
      includesOrAny(filters.stageIds, row.stageId) &&
      (!filters.onlyAttention || needsAttention(row.sla)) &&
      (!query || row.searchText.includes(query)),
  );
}
