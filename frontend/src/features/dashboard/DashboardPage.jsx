import { useMemo, useState } from 'react';
import { useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { filterInteractionRows } from '../../domain/filters.js';
import { formatRelativeDateTime, plural } from '../../domain/format.js';
import { PERMISSION } from '../../domain/roles.js';
import { needsAttention, SLA_STATE } from '../../domain/workflow.js';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { useManagers, useVisibleInteractionRows } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { AddIcon, ReportIcon, UploadIcon } from '../../ui/icons.js';
import { MultiSelectFilter } from '../../ui/MultiSelectFilter.jsx';
import { PeriodFilter } from '../filters/FilterBar.jsx';
import { useFilters } from '../filters/useFilters.js';
import { NewInteractionDialog } from '../interactions/NewInteractionDialog.jsx';
import { AttentionPanel } from './components/AttentionPanel.jsx';
import { RecentInteractions } from './components/RecentInteractions.jsx';
import { StageDistribution } from './components/StageDistribution.jsx';
import styles from './DashboardPage.module.css';

const ATTENTION_LIMIT = 5;
const RECENT_LIMIT = 5;

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

/**
 * Главная: полоса фильтров, распределение по этапам, «Требуют внимания» и последние изменения.
 * Фильтры периода и менеджеров применяются ко всем блокам страницы.
 */
export function DashboardPage() {
  useDocumentTitle('Главная');
  const { user, can } = useSession();
  const { navigate } = useRouter();
  const { workflows, integrations } = useStoreState();
  const managers = useManagers();
  const allRows = useVisibleInteractionRows();
  const [filters, setFilters] = useFilters('dashboard');
  const [creating, setCreating] = useState(false);

  const canSeeTeam = can(PERMISSION.viewAllInteractions);
  const rows = useMemo(() => filterInteractionRows(allRows, filters), [allRows, filters]);

  const attentionRows = useMemo(
    () => rows.filter((row) => needsAttention(row.sla)).sort((a, b) => a.sla.daysLeft - b.sla.daysLeft),
    [rows],
  );
  const overdue = attentionRows.filter((row) => row.sla.state === SLA_STATE.overdue).length;

  const recentRows = useMemo(() => [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT_LIMIT), [rows]);
  const lms = integrations.sources.find((source) => source.id === 'lms');

  const openStage = (stageId) => navigate(stageId ? `/interactions?stage=${stageId}` : '/interactions');

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className={styles.lead}>
            {overdue > 0
              ? `${overdue} ${plural(overdue, ['взаимодействие просрочено', 'взаимодействия просрочены', 'взаимодействий просрочено'])} — начните с них.`
              : 'Просроченных этапов нет — всё идёт по плану.'}
          </p>
        </div>
        <div className={styles.actions}>
          {can(PERMISSION.importCatalogs) ? (
            <ButtonLink to="/catalogs/import" icon={UploadIcon}>
              Импортировать
            </ButtonLink>
          ) : (
            <ButtonLink to="/reports" icon={ReportIcon}>
              Сформировать отчёт
            </ButtonLink>
          )}
          <Button variant="primary" icon={AddIcon} onClick={() => setCreating(true)}>
            Новое взаимодействие
          </Button>
        </div>
      </header>

      <div className={styles.strip}>
        <PeriodFilter period={filters.period} onChange={(period) => setFilters({ ...filters, period })} />
        {lms && (
          <span className={styles.live}>
            <i aria-hidden="true" /> Данные LMS обновлены {formatRelativeDateTime(lms.lastSyncAt)}
          </span>
        )}
        {canSeeTeam && (
          <div className={styles.stripEnd}>
            <MultiSelectFilter
              label="Менеджеры"
              options={managers.map((manager) => ({ value: manager.id, label: manager.name }))}
              value={filters.managerIds}
              onChange={(managerIds) => setFilters({ ...filters, managerIds })}
            />
          </div>
        )}
      </div>

      <StageDistribution workflow={workflows[0]} rows={rows} onStageSelect={openStage} />

      <AttentionPanel rows={attentionRows} limit={ATTENTION_LIMIT} showManager={canSeeTeam} />

      <RecentInteractions rows={recentRows} total={rows.length} showManager={canSeeTeam} />

      <NewInteractionDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
