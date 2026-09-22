import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { EMPTY_FILTERS, filterInteractionRows } from '../../domain/filters.js';
import { plural } from '../../domain/format.js';
import { PERMISSION } from '../../domain/roles.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { useVisibleInteractionRows } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { Button } from '../../ui/Button.jsx';
import { Card } from '../../ui/Card.jsx';
import { SelectField } from '../../ui/Field.jsx';
import { AddIcon, ReportIcon, WorkflowIcon } from '../../ui/icons.js';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { SegmentedControl } from '../../ui/SegmentedControl.jsx';
import { FilterBar } from '../filters/FilterBar.jsx';
import { useFilters } from '../filters/useFilters.js';
import { InteractionBoard } from './components/InteractionBoard.jsx';
import { InteractionTable } from './components/InteractionTable.jsx';
import { NewInteractionDialog } from './NewInteractionDialog.jsx';
import styles from './InteractionsPage.module.css';

const VIEWS = [
  { value: 'table', label: 'Таблица', icon: ReportIcon },
  { value: 'board', label: 'Доска', icon: WorkflowIcon },
];

const SORTS = {
  urgency: { label: 'Сначала срочные', compare: (a, b) => (a.sla.daysLeft ?? Infinity) - (b.sla.daysLeft ?? Infinity) },
  updated: { label: 'Недавно изменённые', compare: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
  university: { label: 'По вузу (А–Я)', compare: (a, b) => a.university.name.localeCompare(b.university.name, 'ru') },
  progress: { label: 'По этапу', compare: (a, b) => a.progress.step - b.progress.step },
};

/** Ссылки с главной (?attention=1, ?stage=…) задают фильтр один раз, дальше пользователь управляет сам. */
function useFiltersFromQuery(setFilters) {
  const { query, pathname, navigate } = useRouter();
  const attention = query.get('attention');
  const stage = query.get('stage');

  useEffect(() => {
    if (!attention && !stage) return;
    setFilters({ ...EMPTY_FILTERS, onlyAttention: attention === '1', stageIds: stage ? [stage] : [] });
    navigate(pathname);
  }, [attention, stage, pathname, navigate, setFilters]);
}

export function InteractionsPage() {
  const { can } = useSession();
  const { workflows } = useStoreState();
  const rows = useVisibleInteractionRows();
  const [filters, setFilters] = useFilters('interactions');
  const [view, setView] = usePersistentState('interactions:view', 'table');
  const [sort, setSort] = usePersistentState('interactions:sort', 'urgency');
  const [workflowId, setWorkflowId] = usePersistentState('interactions:workflow', workflows[0].id);
  const [creating, setCreating] = useState(false);

  useFiltersFromQuery(setFilters);

  const workflow = workflows.find((item) => item.id === workflowId) ?? workflows[0];
  const filtered = useMemo(() => filterInteractionRows(rows, filters).sort(SORTS[sort]?.compare ?? SORTS.urgency.compare), [rows, filters, sort]);
  const boardRows = filtered.filter((row) => row.workflowId === workflow.id);
  const countLabel = `${filtered.length} ${plural(filtered.length, ['взаимодействие', 'взаимодействия', 'взаимодействий'])}`;

  return (
    <>
      <PageHeader
        title="Взаимодействия"
        hint="Работа с вузами по ИТ-направлениям, учебным программам и продуктам. Откройте карточку, чтобы сменить этап, оставить комментарий или приложить файлы."
        meta={<span className={styles.resultCount}>{countLabel}</span>}
        actions={
          <Button variant="primary" icon={AddIcon} onClick={() => setCreating(true)}>
            Новое взаимодействие
          </Button>
        }
      />

      <FilterBar
        variant="panel"
        filters={filters}
        onChange={setFilters}
        show={{ stages: true, attention: true }}
        stages={workflow.stages}
        resultLabel={countLabel}
      />

      <div className={styles.toolbar}>
        <div className={styles.toolbarControls}>
          {view === 'table' ? (
            <SelectField
              className={styles.sort}
              aria-label="Сортировка"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              options={Object.entries(SORTS).map(([value, { label }]) => ({ value, label }))}
            />
          ) : (
            workflows.length > 1 && (
              <SelectField
                className={styles.sort}
                aria-label="Набор этапов"
                value={workflow.id}
                onChange={(event) => setWorkflowId(event.target.value)}
                options={workflows.map((item) => ({ value: item.id, label: item.name }))}
              />
            )
          )}
          <SegmentedControl label="Вид списка" options={VIEWS} value={view} onChange={setView} />
        </div>
      </div>

      {view === 'table' ? (
        <Card padding="none">
          <InteractionTable rows={filtered} onReset={() => setFilters(EMPTY_FILTERS)} hiddenColumns={can(PERMISSION.viewAllInteractions) ? [] : ['manager']} />
        </Card>
      ) : (
        <InteractionBoard workflow={workflow} rows={boardRows} />
      )}

      <NewInteractionDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
