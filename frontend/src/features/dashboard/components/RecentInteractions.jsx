import { useRouter } from '../../../app/router.jsx';
import { formatRelativeDateTime, initials } from '../../../domain/format.js';
import { Person } from '../../../ui/Avatar.jsx';
import { Badge } from '../../../ui/Badge.jsx';
import { ButtonLink } from '../../../ui/Button.jsx';
import { Card, CardHeader } from '../../../ui/Card.jsx';
import { DataTable } from '../../../ui/DataTable.jsx';
import { EmptyState } from '../../../ui/EmptyState.jsx';
import { ArrowRightIcon, SearchIcon } from '../../../ui/icons.js';
import { SlaBadge } from '../../interactions/components/SlaBadge.jsx';
import styles from './RecentInteractions.module.css';

const COLUMNS = [
  {
    id: 'university',
    header: 'Вуз',
    primary: true,
    cell: (row) => (
      <span className={styles.university}>
        <span className={styles.logo} aria-hidden="true">
          {initials(row.university.shortName)}
        </span>
        <span className={styles.universityName}>{row.university.name}</span>
      </span>
    ),
  },
  {
    id: 'product',
    header: 'Продукт и направление',
    cell: (row) => (
      <span className={styles.stack}>
        <span className={styles.strong}>{row.product.name}</span>
        <span className={styles.secondary}>{row.direction.name}</span>
      </span>
    ),
  },
  { id: 'stage', header: 'Этап', cell: (row) => <Badge tone="brand">{row.stage.name}</Badge> },
  { id: 'sla', header: 'Срок', cell: (row) => <SlaBadge sla={row.sla} compact /> },
  { id: 'manager', header: 'Менеджер', width: 190, cell: (row) => (row.manager ? <Person name={row.manager.name} /> : '—') },
  { id: 'updated', header: 'Изменено', hideOnMobile: true, cell: (row) => <span className={styles.date}>{formatRelativeDateTime(row.updatedAt)}</span> },
];

/** Таблица «Последние изменения» — как блок «Заявки» на прежней главной. */
export function RecentInteractions({ rows, total, showManager }) {
  const { navigate } = useRouter();
  const columns = showManager ? COLUMNS : COLUMNS.filter((column) => column.id !== 'manager');

  return (
    <Card padding="none">
      <CardHeader
        title="Последние изменения"
        hint="Взаимодействия, в которых недавно что-то менялось: этап, комментарии или файлы. Сначала самые свежие."
        description={`Показаны ${rows.length} из ${total} · сначала недавно изменённые`}
        actions={
          <ButtonLink to="/interactions" variant="ghost" size="s">
            Все взаимодействия
          </ButtonLink>
        }
      />
      <DataTable
        caption="Последние изменения во взаимодействиях"
        columns={columns}
        rows={rows}
        onRowClick={(row) => navigate(`/interactions/${row.id}`)}
        getRowLabel={(row) => `Открыть: ${row.university.name}, ${row.direction.name}`}
        empty={<EmptyState icon={SearchIcon} title="Нет взаимодействий" description="За выбранный период и менеджеров ничего не найдено." />}
      />
      {rows.length > 0 && (
        <div className={styles.footer}>
          <ButtonLink to="/interactions" variant="ghost" icon={ArrowRightIcon}>
            Посмотреть все
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}
