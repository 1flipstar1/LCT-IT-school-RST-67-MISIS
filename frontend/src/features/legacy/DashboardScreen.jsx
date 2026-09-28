import { shouldReduceMotion } from '../../lib/motion.js';
import { Popover } from '@atomaro/ui-kit';
import { gsap } from 'gsap';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { createVisibilityFilter, ROLE, PERMISSION } from '../../domain/roles.js';
import { BASE_WORKFLOW } from '../../data/workflows.js';
import { formatDate, formatDays, formatRelativeDateTime } from '../../domain/format.js';
import { PHASES, SLA_STATE, getStageIndex, isFinalStage, needsAttention } from '../../domain/workflow.js';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { useCatalogIndex, useVisibleInteractionRows } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import {
  AddIcon,
  ArrowRightIcon,
  DocumentIcon,
  EducationIcon,
  FilterIcon,
  MoreIcon,
  UniversityIcon,
  UploadIcon,
} from '../../ui/icons.js';
import { NewInteractionDialog } from '../interactions/NewInteractionDialog.jsx';
import { describeEvent } from '../interactions/components/EventFeed.jsx';
import { SelectMenu } from '../../ui/SelectMenu.jsx';
import { Hint } from '../../ui/Hint.jsx';
import { Kpi, LegacyButton, LegacyScreen, PageHeader, UniversityCell } from './legacyUi.jsx';
import './DashboardScreen.css';

/**
 * Кольцо диаграммы: сегмент этапа — штрих окружности длиной ratio × длина окружности,
 * сдвинутый на сумму долей предыдущих этапов (strokeDasharray / strokeDashoffset).
 */
const DONUT_RADIUS = 89;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/**
 * Статистика и последние заявки по доступным взаимодействиям выбранного менеджера.
 */
export function DashboardScreen() {
  useDocumentTitle('Дашборд');
  const { navigate } = useRouter();
  const { user, can } = useSession();
  const { events } = useStoreState();
  const { users, workflows } = useCatalogIndex();
  const [managerId, setManagerId] = useState('all');
  const allRows = useVisibleInteractionRows();
  const isVisible = createVisibilityFilter(user, [...users.values()]);
  const managers = [...users.values()]
    .filter((manager) => manager.role === ROLE.manager && isVisible({
      managerId: manager.id,
      directionId: user.access?.directionIds?.[0],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const interactions = allRows.filter((row) => row.workflowId === BASE_WORKFLOW.id
    && (managerId === 'all' || row.managerId === managerId));
  const workflow = workflows.get(BASE_WORKFLOW.id) ?? BASE_WORKFLOW;
  const interactionLink = managerId === 'all' ? '/interactions' : `/interactions?manager=${encodeURIComponent(managerId)}`;
  const chartRef = useRef(null);
  const [creating, setCreating] = useState(false);
  const [hoveredStage, setHoveredStage] = useState(null);
  const openInteraction = (event, row) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(`/interactions/${row.id}`);
  };
  const currentMonth = new Date();
  const monthPrefix = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const universitiesInProgress = new Set(
    interactions.filter((row) => !row.completedAt && !isFinalStage(row.workflow, row.stageId)).map((row) => row.universityId),
  ).size;
  const contractsSignedThisMonth = interactions.filter(
    (row) => row.contract.number && row.contract.licenseSignedAt?.startsWith(monthPrefix),
  ).length;
  const updatedPrograms = new Set(
    interactions
      .filter((row) => {
        const curriculumIndex = getStageIndex(row.workflow, 'st-curriculum');
        return curriculumIndex >= 0 && getStageIndex(row.workflow, row.stageId) > curriculumIndex;
      })
      .map((row) => `${row.universityId}:${row.directionId}`),
  ).size;
  const attentionRows = interactions
    .filter((row) => needsAttention(row.sla))
    .sort((a, b) => a.sla.daysLeft - b.sla.daysLeft);
  const visibleRows = new Map(interactions.map((row) => [row.id, row]));
  const recentEvents = events
    .filter((event) => visibleRows.has(event.interactionId))
    .sort((a, b) => b.at.localeCompare(a.at));

  const stats = workflow.stages.map((stage, index) => ({
    ...stage,
    label: stage.name,
    short: stage.name,
    color: `color-mix(in srgb, var(--color-accent) ${25 + (index / Math.max(1, workflow.stages.length - 1)) * 75}%, var(--color-surface))`,
    n: interactions.filter((row) => row.stageId === stage.id).length,
  }));
  const total = interactions.length;
  const chartKey = stats.map((stage) => `${stage.id}:${stage.n}`).join(',');
  const maxN = Math.max(1, ...stats.map((stage) => stage.n));
  const activeStage = stats.find((stage) => stage.id === hoveredStage);
  const phaseRanges = PHASES.map((phase) => {
    const indexes = stats.map((stage, index) => (stage.phase === phase.id ? index : -1)).filter((index) => index !== -1);
    return indexes.length ? { ...phase, from: indexes[0], to: indexes.at(-1) } : null;
  }).filter(Boolean);
  const dashboardUniversities = [...interactions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  const donutSegments = [];
  let acc = 0;
  for (const stage of stats) {
    if (!stage.n) continue;
    const from = (acc / total) * 360;
    acc += stage.n;
    const to = (acc / total) * 360;
    donutSegments.push({ stage, start: from / 360, ratio: stage.n / total });
  }

  useLayoutEffect(() => {
    if (shouldReduceMotion()) {
      const context = gsap.context(() => {
        gsap.set('.donut', { '--donut-progress': 360 });
        gsap.set('.stage-bar-fill', { scaleY: 1 });
      }, chartRef);
      return () => context.revert();
    }
    const context = gsap.context(() => {
      const fills = gsap.utils.toArray('.stage-bar-fill', chartRef.current);
      const timeline = gsap.timeline();
      const duration = 0.9;
      const barDuration = 0.55;

      gsap.set(fills, { scaleY: 0, transformOrigin: 'bottom' });
      gsap.set('.donut', { '--donut-progress': 0 });

      timeline.to('.donut', { '--donut-progress': 360, duration, ease: 'none' }, 0);
      timeline.to(fills, {
        scaleY: 1,
        duration: barDuration,
        stagger: fills.length > 1 ? (duration - barDuration) / (fills.length - 1) : 0,
        ease: 'power3.out',
      }, 0);
    }, chartRef);

    return () => context.revert();
    // Повторяем анимацию при изменении распределения.
  }, [chartKey]);

  return (
    <LegacyScreen className="legacy-dashboard">
      <PageHeader title={`Добрый день, ${user.name.split(' ')[0]}`}>
        <span className="dash-header-actions" data-tour="dashboard-actions">
          <SelectMenu
            className="dashboard-manager-filter"
            label="Статистика по менеджеру"
            icon={FilterIcon}
            value={managerId}
            options={[{ value: 'all', label: 'Все менеджеры' }, ...managers.map((manager) => ({ value: manager.id, label: manager.name }))]}
            onChange={(value) => { setManagerId(value ?? 'all'); setHoveredStage(null); }}
          />
          {can(PERMISSION.importCatalogs) && (
            <LegacyButton onClick={() => navigate('/import')} icon={<UploadIcon size={16} fill="currentColor" />}>
              Импортировать
            </LegacyButton>
          )}
          <LegacyButton primary onClick={() => setCreating(true)} icon={<AddIcon size={16} fill="currentColor" />}>
            Новое взаимодействие
          </LegacyButton>
        </span>
      </PageHeader>

      <section ref={chartRef} className="panel stage-stats" data-tour="stage-stats">
        <div className="panel-head">
          <div>
            <Hint text="Сколько заявок на каждом из этапов обработки. Наведите на столбец или сектор, чтобы увидеть этап и число заявок.">
              <h2>Распределение заявок по этапам</h2>
            </Hint>
          </div>
          <button className="dots">
            <MoreIcon size={19} fill="currentColor" />
          </button>
        </div>
        <div className="stage-stats-body" onMouseLeave={() => setHoveredStage(null)}>
          <div className="donut-wrap">
            <div className="donut">
              <svg className="donut-segments" viewBox="0 0 210 210">
                {donutSegments.map(({ stage, start, ratio }) => (
                  <circle
                    key={stage.id}
                    className={`donut-segment${hoveredStage && hoveredStage !== stage.id ? ' is-dimmed' : ''}`}
                    cx="105"
                    cy="105"
                    r={DONUT_RADIUS}
                    stroke={stage.color}
                    strokeDasharray={`${ratio * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`}
                    strokeDashoffset={-start * DONUT_CIRCUMFERENCE}
                    transform="rotate(-90 105 105)"
                    onMouseEnter={() => setHoveredStage(stage.id)}
                  />
                ))}
              </svg>
              <div>
                <strong>{activeStage ? activeStage.n : total}</strong>
                <span className={activeStage ? 'donut-stage-label' : ''}>
                  {activeStage ? activeStage.short : 'всего'}
                </span>
              </div>
            </div>
          </div>
          <div className="stage-bars" style={{ '--stage-count': stats.length }}>
            {stats.map((stage, index) => (
              <div
                className={`stage-bar${hoveredStage && hoveredStage !== stage.id ? ' is-dimmed' : ''}`}
                key={stage.id}
                style={{ '--stage-column': index + 1 }}
                onMouseEnter={() => setHoveredStage(stage.id)}
              >
                <div className="stage-bar-area" style={{ '--stage-bar-height': `${(stage.n / maxN) * 100}%` }}>
                  <Popover
                    trigger="click"
                    placement={index >= stats.length - 2 ? 'topRight' : 'top'}
                    size="m"
                    isOpened={hoveredStage === stage.id}
                    usePopperProps={{ flip: false, preventOverflow: false }}
                    className="stage-bar-popover"
                    innerChildren={
                      // Подсказка рисуется вне .legacy (портал), поэтому класс-обёртка нужен и здесь.
                      <div className="legacy">
                        <div className="stage-bar-popover-content">
                          <b>{index + 1}. {stage.label}</b>
                          <span>Заявок: {stage.n}</span>
                        </div>
                      </div>
                    }
                  >
                    <i className="stage-bar-fill" style={{ height: '100%', background: stage.color }} />
                  </Popover>
                </div>
              </div>
            ))}
            {phaseRanges.map((phase) => (
              <div
                className="stage-bars-phase"
                key={phase.id}
                style={{ '--phase-from': phase.from + 1, '--phase-to': phase.to + 2 }}
              >
                {phase.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="dash-bottom">
        <div className="dash-left">
          <section className="kpi-grid" data-tour="kpi">
            <Kpi title="Вузов в работе" hint="Сколько вузов сейчас в работе: у каждого есть незавершённое взаимодействие." value={universitiesInProgress} icon={<UniversityIcon fill="currentColor" />} tone="indigo" />
            <Kpi title="Контрактов подписано за этот месяц" hint="Сколько договоров с вузами подписано в текущем месяце — по дате подписания лицензии." value={contractsSignedThisMonth} icon={<DocumentIcon fill="currentColor" />} tone="orange" />
            <Kpi title="Учебных программ актуализировано" hint="Сколько программ (вуз + направление) уже прошли этап актуализации учебной программы." value={updatedPrograms} icon={<EducationIcon fill="currentColor" />} tone="indigo" />
          </section>
        </div>
        <div className="dash-right">
          <section className="panel dash-feed-panel dash-attention-panel" aria-labelledby="dash-attention-title" data-tour="attention">
            <div className="panel-head dash-feed-head">
              <div>
                <Hint text="Взаимодействия, у которых срок этапа истёк или истекает в ближайшие дни. Начните с верхних — у них меньше всего времени.">
                  <h2 id="dash-attention-title">Требуют внимания <span className="dash-feed-count">{attentionRows.length}</span></h2>
                </Hint>
              </div>
            </div>
            <div className="dash-feed-list">
              {attentionRows.length ? attentionRows.slice(0, 4).map((row) => (
                <Link className="dash-feed-item" to={`/interactions/${row.id}`} key={row.id}>
                  <span className="dash-feed-main">
                    <b>{row.university.name}</b>
                    <small>{row.stage.name}</small>
                  </span>
                  <span className={`dash-feed-status ${row.sla.state === SLA_STATE.overdue ? 'is-overdue' : ''}`}>
                    {row.sla.state === SLA_STATE.overdue
                      ? `Просрочено на ${formatDays(-row.sla.daysLeft)}`
                      : row.sla.daysLeft === 0 ? 'Сегодня' : `Осталось ${formatDays(row.sla.daysLeft)}`}
                  </span>
                </Link>
              )) : <p className="dash-feed-empty">Все этапы идут в срок</p>}
            </div>
            <Link className="dash-feed-more" to={`${interactionLink}${managerId === 'all' ? '?' : '&'}attention=1`}>
              Все срочные взаимодействия <ArrowRightIcon size={16} fill="currentColor" />
            </Link>
          </section>
          <section className="panel dash-feed-panel dash-activity-panel" aria-labelledby="dash-activity-title" data-tour="activity">
            <div className="panel-head dash-feed-head">
              <div>
                <Hint text="Что происходило во взаимодействиях: смена этапа, комментарии и файлы. Сначала самые свежие.">
                  <h2 id="dash-activity-title">Последние действия</h2>
                </Hint>
              </div>
            </div>
            <div className="dash-feed-list">
              {recentEvents.length ? recentEvents.slice(0, 4).map((event) => (
                <Link className="dash-feed-item" to={`/interactions/${event.interactionId}`} key={event.id}>
                  <span className="dash-feed-main">
                    <b>{visibleRows.get(event.interactionId).university.name}</b>
                    <small>{describeEvent(event, visibleRows.get(event.interactionId).workflow, users)}</small>
                    <span className="dash-feed-author">{users.get(event.userId)?.name ?? 'Система'}</span>
                  </span>
                  <time className="dash-feed-date" dateTime={event.at}>{formatRelativeDateTime(event.at)}</time>
                </Link>
              )) : <p className="dash-feed-empty">Действий пока нет</p>}
            </div>
            <Link className="dash-feed-more" to={interactionLink}>
              Все взаимодействия <ArrowRightIcon size={16} fill="currentColor" />
            </Link>
          </section>
        </div>
      </div>

      <section className="panel table-panel dashboard-universities" data-tour="dashboard-table">
        <div className="panel-head dashboard-universities-head">
          <Hint text="Последние заявки вузов: продукт и направление, текущий статус и ответственный менеджер.">
            <h2>Заявки</h2>
          </Hint>
        </div>
        <div className="dashboard-universities-table">
          {/* Узкий экран: таблица прокручивается вбок внутри карточки, затемнение «Все заявки» остаётся на месте. */}
          <div className="dashboard-universities-scroll">
          <table>
            <thead>
              <tr>
                <th>ВУЗ</th>
                <th>ПРОДУКТ / НАПРАВЛЕНИЕ</th>
                <th>СТАТУС WORKFLOW</th>
                <th>МЕНЕДЖЕР</th>
                <th>ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ</th>
              </tr>
            </thead>
            <tbody>
              {dashboardUniversities.map((university) => (
                <tr
                  key={university.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Открыть заявку ${university.university.name}`}
                  onClick={(event) => openInteraction(event, university)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      openInteraction(event, university);
                    }
                  }}
                >
                  <td>
                    <Link to={`/interactions/${university.id}`}><UniversityCell name={university.university.name} /></Link>
                  </td>
                  <td>
                    <b>{university.product.name}</b>
                    <span className="subtext">{university.direction.name}</span>
                  </td>
                  <td>
                    <span className="status-tag purple">{university.stage.name}</span>
                  </td>
                  <td>{university.manager?.name ?? 'Не назначен'}</td>
                  <td className="muted">{formatDate(university.updatedAt)}</td>
                </tr>
              ))}
              {!dashboardUniversities.length && <tr><td colSpan={5}>Нет заявок для выбранного менеджера</td></tr>}
            </tbody>
          </table>
          </div>
          <div className={`dashboard-universities-fade${dashboardUniversities.length ? '' : ' is-empty'}`}>
            <Link className="dashboard-universities-all" to={interactionLink}>
              Все заявки <ArrowRightIcon size={16} fill="currentColor" />
            </Link>
          </div>
        </div>
      </section>

      <NewInteractionDialog open={creating} onOpenChange={setCreating} />
    </LegacyScreen>
  );
}
