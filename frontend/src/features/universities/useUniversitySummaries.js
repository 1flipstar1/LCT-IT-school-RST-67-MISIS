import { useMemo } from 'react';
import { useSession } from '../../auth/SessionProvider.jsx';
import { PERMISSION } from '../../domain/roles.js';
import { needsAttention } from '../../domain/workflow.js';
import { useVisibleInteractionRows } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';

/**
 * Сводка по каждому вузу из видимых пользователю взаимодействий.
 * Менеджер видит только вузы, где он ответственный; руководитель и администратор — весь каталог.
 */
export function useUniversitySummaries() {
  const { universities } = useStoreState();
  const rows = useVisibleInteractionRows();
  const { can } = useSession();
  const showWholeCatalog = can(PERMISSION.viewAllInteractions);

  return useMemo(() => {
    const byUniversity = new Map();
    rows.forEach((row) => {
      const list = byUniversity.get(row.universityId) ?? [];
      list.push(row);
      byUniversity.set(row.universityId, list);
    });

    return universities
      .filter((university) => showWholeCatalog || byUniversity.has(university.id))
      .map((university) => {
        const own = byUniversity.get(university.id) ?? [];
        return {
          id: university.id,
          university,
          rows: own,
          attentionCount: own.filter((row) => needsAttention(row.sla)).length,
          directions: [...new Map(own.map((row) => [row.direction.id, row.direction])).values()],
          managers: [...new Map(own.filter((row) => row.manager).map((row) => [row.manager.id, row.manager])).values()],
        };
      })
      .sort((a, b) => b.attentionCount - a.attentionCount || b.rows.length - a.rows.length || a.university.name.localeCompare(b.university.name, 'ru'));
  }, [universities, rows, showWholeCatalog]);
}
