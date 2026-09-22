import { useRouter } from '../../../app/router.jsx';
import { formatRelativeDateTime } from '../../../domain/format.js';
import { Person } from '../../../ui/Avatar.jsx';
import { Button } from '../../../ui/Button.jsx';
import { DataTable } from '../../../ui/DataTable.jsx';
import { EmptyState } from '../../../ui/EmptyState.jsx';
import { SearchIcon } from '../../../ui/icons.js';
import { SlaBadge } from './SlaBadge.jsx';
import { StageProgress } from './StageProgress.jsx';
import styles from './InteractionTable.module.css';

const COLUMNS = [
  {
    id: 'university',
    header: 'Вуз',
    primary: true,
    cell: (row) => (
      <span className={styles.university}>
        <span className={styles.universityName}>{row.university.name}</span>
        <span className={styles.secondary}>{row.university.city || 'Город не указан'}</span>
      </span>
    ),
  },
  {
    id: 'direction',
    header: 'Направление, программа и продукт',
    cell: (row) => (
      <span className={styles.stack}>
        <span>{row.direction.name}</span>
        <span className={styles.secondary}>{row.program.name}</span>
        <span className={styles.secondary}>{row.product.name}</span>
      </span>
    ),
  },
  { id: 'stage', header: 'Этап', width: '24%', cell: (row) => <StageProgress row={row} /> },
  { id: 'sla', header: 'Срок этапа', cell: (row) => <SlaBadge sla={row.sla} /> },
  { id: 'manager', header: 'Ответственный', width: 190, cell: (row) => (row.manager ? <Person name={row.manager.name} /> : '—') },
  {
    id: 'updated',
    header: 'Изменено',
    hideOnMobile: true,
    cell: (row) => <span className={styles.date}>{formatRelativeDateTime(row.updatedAt)}</span>,
  },
];

/**
 * hiddenColumns — колонки, которые на этом экране лишние. Например, менеджеру не нужен «Ответственный»
 * (в его списке всегда он сам), а на странице вуза — колонка «Вуз».
 */
export function InteractionTable({ rows, onReset, hiddenColumns = [] }) {
  const { navigate } = useRouter();
  const columns = COLUMNS.filter((column) => !hiddenColumns.includes(column.id));

  return (
    <DataTable
      caption="Список взаимодействий"
      columns={columns}
      rows={rows}
      onRowClick={(row) => navigate(`/interactions/${row.id}`)}
      getRowLabel={(row) => `Открыть: ${row.university.name}, ${row.direction.name}`}
      empty={
        <EmptyState
          icon={SearchIcon}
          title="Ничего не нашлось"
          description="Попробуйте изменить поиск или сбросить фильтры."
          action={onReset && <Button tone="warning" onClick={onReset}>Сбросить фильтры</Button>}
        />
      }
    />
  );
}
