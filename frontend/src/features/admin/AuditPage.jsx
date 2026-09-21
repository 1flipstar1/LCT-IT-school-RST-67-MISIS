import { useMemo, useState } from 'react';
import { Link } from '../../app/router.jsx';
import { formatRelativeDateTime } from '../../domain/format.js';
import { useCatalogIndex } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { Person } from '../../ui/Avatar.jsx';
import { Card } from '../../ui/Card.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { SearchField } from '../../ui/Field.jsx';
import { HistoryIcon } from '../../ui/icons.js';
import { MultiSelectFilter } from '../../ui/MultiSelectFilter.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { describeEvent } from '../interactions/components/EventFeed.jsx';
import styles from './AuditPage.module.css';

const PAGE_SIZE = 50;

const TARGET_LINK = {
  interaction: (id) => `/interactions/${id}`,
  user: () => '/users',
  workflow: () => '/workflows',
  integration: () => '/integrations',
  inbox: () => '/integrations',
  report: () => '/reports',
  import: () => '/catalogs',
};

/**
 * Журнал действий: история изменений по взаимодействиям и административные действия в одной ленте
 * (таблица audit_logs + interaction_status_logs из db.sql).
 */
export function AuditPage() {
  const { audit, events, interactions } = useStoreState();
  const index = useCatalogIndex();
  const [query, setQuery] = useState('');
  const [userIds, setUserIds] = useState([]);

  const entries = useMemo(() => {
    const interactionById = new Map(interactions.map((item) => [item.id, item]));
    // Действие в интерфейсе пишет и событие взаимодействия, и запись аудита с тем же временем и автором —
    // такие события не дублируем. Исторические события (без записи аудита) показываем как есть.
    const auditIds = new Set(audit.map((entry) => entry.at + entry.userId));

    const fromEvents = events
      .filter((event) => !auditIds.has(event.at + event.userId))
      .map((event) => {
        const interaction = interactionById.get(event.interactionId);
        const university = index.universities.get(interaction?.universityId);
        const direction = index.directions.get(interaction?.directionId);
        return {
          id: event.id,
          at: event.at,
          userId: event.userId,
          text: describeEvent(event, index.workflows.get(interaction?.workflowId), index.users),
          target: { type: 'interaction', id: event.interactionId, label: `${university?.shortName} · ${direction?.name}` },
        };
      });

    return [...audit, ...fromEvents].sort((a, b) => b.at.localeCompare(a.at));
  }, [audit, events, interactions, index]);

  const filtered = entries.filter((entry) => {
    const matchesUser = userIds.length === 0 || userIds.includes(entry.userId);
    const text = `${entry.text} ${entry.target?.label ?? ''} ${index.users.get(entry.userId)?.name ?? ''}`.toLowerCase();
    return matchesUser && text.includes(query.trim().toLowerCase());
  });

  return (
    <>
      <PageHeader
        title="Журнал действий"
      />
      <div className={styles.filters}>
        <SearchField className={styles.search} value={query} onChange={setQuery} placeholder="Действие или объект" />
        <MultiSelectFilter label="Сотрудники" options={[...index.users.values()].map((user) => ({ value: user.id, label: user.name }))} value={userIds} onChange={setUserIds} />
      </div>
      <Card padding="none">
        <DataTable
          caption="Журнал действий"
          rows={filtered.slice(0, PAGE_SIZE)}
          empty={<EmptyState icon={HistoryIcon} title="Записей нет" description="Измените поиск или фильтр по сотрудникам." />}
          columns={[
            { id: 'at', header: 'Когда', width: 150, cell: (entry) => <span className={styles.time}>{formatRelativeDateTime(entry.at)}</span> },
            { id: 'user', header: 'Кто', width: 220, cell: (entry) => <Person name={index.users.get(entry.userId)?.name ?? 'Система'} /> },
            { id: 'text', header: 'Действие', primary: true, cell: (entry) => entry.text },
            {
              id: 'target',
              header: 'Объект',
              cell: (entry) => {
                const link = entry.target && TARGET_LINK[entry.target.type]?.(entry.target.id);
                return link ? <Link to={link}>{entry.target.label}</Link> : entry.target?.label ?? '—';
              },
            },
          ]}
        />
      </Card>
      {filtered.length > PAGE_SIZE && <p className={styles.more}>Показаны последние {PAGE_SIZE} из {filtered.length}. Уточните фильтры, чтобы найти нужное.</p>}
    </>
  );
}
