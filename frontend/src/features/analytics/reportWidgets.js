import { usePersistentState } from '../../lib/usePersistentState.js';

/**
 * Показатели и графики, отмеченные для отчёта. Выбор общий для «Аналитики» и «Отчётов»:
 * на панели его меняет кнопка «В отчёт», в конструкторе отчёта — список с порядком.
 */
export const REPORT_WIDGETS_KEY = 'reports:widgets';

export function useReportWidgets() {
  const [ids, setIds] = usePersistentState(REPORT_WIDGETS_KEY, []);
  const safeIds = Array.isArray(ids) ? ids : [];

  return {
    ids: safeIds,
    has: (id) => safeIds.includes(id),
    toggle: (id) => setIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id])),
    remove: (id) => setIds((current) => current.filter((item) => item !== id)),
    move: (id, offset) => setIds((current) => {
      const from = current.indexOf(id);
      const to = from + offset;
      if (from === -1 || to < 0 || to >= current.length) return current;
      const next = [...current];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    }),
    clear: () => setIds([]),
  };
}
