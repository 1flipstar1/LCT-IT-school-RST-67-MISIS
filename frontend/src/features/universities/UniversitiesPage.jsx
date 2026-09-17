import { useMemo, useState } from 'react';
import { useRouter } from '../../app/router.jsx';
import { plural } from '../../domain/format.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { Card } from '../../ui/Card.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { SearchField } from '../../ui/Field.jsx';
import { SearchIcon, WarningIcon } from '../../ui/icons.js';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { useUniversitySummaries } from './useUniversitySummaries.js';
import styles from './UniversitiesPage.module.css';

const MAX_DIRECTION_BADGES = 2;

const COLUMNS = [
  {
    id: 'name',
    header: 'Вуз',
    primary: true,
    cell: ({ university }) => (
      <span className={styles.name}>
        <span className={styles.title}>{university.name}</span>
        <span className={styles.secondary}>{university.city || 'Город не указан'}</span>
      </span>
    ),
  },
  {
    id: 'interactions',
    header: 'Взаимодействий',
    align: 'right',
    cell: ({ rows }) => rows.length,
  },
  {
    id: 'directions',
    header: 'ИТ-направления',
    cell: ({ directions }) =>
      directions.length === 0 ? (
        <span className={styles.secondary}>Нет активной работы</span>
      ) : (
        <span className={styles.badges}>
          {directions.slice(0, MAX_DIRECTION_BADGES).map((direction) => (
            <Badge key={direction.id} tone="brand">
              {direction.name}
            </Badge>
          ))}
          {directions.length > MAX_DIRECTION_BADGES && <Badge>+{directions.length - MAX_DIRECTION_BADGES}</Badge>}
        </span>
      ),
  },
  {
    id: 'attention',
    header: 'Требуют внимания',
    cell: ({ attentionCount }) =>
      attentionCount > 0 ? (
        <Badge tone="warning" icon={WarningIcon}>
          {attentionCount}
        </Badge>
      ) : (
        <span className={styles.secondary}>—</span>
      ),
  },
  {
    id: 'managers',
    header: 'Ответственные',
    hideOnMobile: true,
    cell: ({ managers }) => (
      <span className={styles.avatars}>
        {managers.map((manager) => (
          <span key={manager.id} title={manager.name}>
            <Avatar name={manager.name} size="s" />
          </span>
        ))}
      </span>
    ),
  },
];

export function UniversitiesPage() {
  const { navigate } = useRouter();
  const summaries = useUniversitySummaries();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return summaries;
    return summaries.filter(({ university }) => `${university.name} ${university.shortName} ${university.city}`.toLowerCase().includes(normalized));
  }, [summaries, query]);

  const attentionTotal = summaries.reduce((sum, item) => sum + item.attentionCount, 0);

  return (
    <>
      <PageHeader
        title="Вузы"
        description={`${summaries.length} ${plural(summaries.length, ['вуз', 'вуза', 'вузов'])}. Откройте вуз, чтобы увидеть контакты и всю работу с ним.${attentionTotal ? ` Требуют внимания: ${attentionTotal}.` : ''}`}
      />
      <SearchField className={styles.search} value={query} onChange={setQuery} placeholder="Название вуза или город" />
      <Card padding="none">
        <DataTable
          caption="Список вузов"
          columns={COLUMNS}
          rows={filtered}
          onRowClick={({ university }) => navigate(`/universities/${university.id}`)}
          getRowLabel={({ university }) => `Открыть вуз: ${university.name}`}
          empty={<EmptyState icon={SearchIcon} title="Вуз не найден" description="Проверьте написание или добавьте вуз через справочники." />}
        />
      </Card>
    </>
  );
}
