import { PERIOD_PRESETS } from '../../domain/filters.js';
import { formatDate } from '../../domain/format.js';

/** Человекочитаемое описание фильтров для отчётов и PDF: «Последние 3 месяца · КФУ, ИТМО · DevOps · требуют внимания». */
export function describeFilters(filters, index) {
  const { period } = filters;
  const periodText =
    period.preset === 'custom'
      ? `${period.from ? formatDate(period.from) : '…'} — ${period.to ? formatDate(period.to) : '…'}`
      : PERIOD_PRESETS.find((preset) => preset.id === period.preset)?.label;

  const names = (ids, map, key = 'name') => ids.map((id) => map.get(id)?.[key]).filter(Boolean).join(', ');
  const stages = [...(index.workflows?.values() ?? [])].flatMap((workflow) => workflow.stages);
  const stageNames = [...new Set((filters.stageIds ?? []).map((id) => stages.find((stage) => stage.id === id)?.name).filter(Boolean))].join(', ');
  return [
    periodText,
    names(filters.universityIds, index.universities, 'shortName'),
    names(filters.directionIds, index.directions),
    names(filters.programIds, index.programs),
    names(filters.productIds, index.products),
    names(filters.managerIds, index.users),
    stageNames,
    filters.onlyAttention ? 'требуют внимания' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
