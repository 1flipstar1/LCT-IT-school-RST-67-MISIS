import { useMemo } from 'react';
import { EMPTY_FILTERS } from '../../domain/filters.js';
import { usePersistentState } from '../../lib/usePersistentState.js';

/**
 * Фильтры страницы, сохранённые между визитами. Сохранённое значение накладывается на пустые фильтры:
 * если структура фильтров изменится в новой версии, старый кэш не сломает страницу.
 */
export function useFilters(storageKey) {
  const [stored, setFilters] = usePersistentState(`filters:${storageKey}`, EMPTY_FILTERS);
  const filters = useMemo(
    () => ({ ...EMPTY_FILTERS, ...stored, period: { ...EMPTY_FILTERS.period, ...stored?.period } }),
    [stored],
  );
  return [filters, setFilters];
}
