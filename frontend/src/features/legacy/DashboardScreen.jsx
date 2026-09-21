import { Popover } from '@atomaro/ui-kit';
import { gsap } from 'gsap';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { BASE_WORKFLOW } from '../../data/workflows.js';
import { formatDays, formatRelativeDateTime } from '../../domain/format.js';
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
import { countCardsByStage, LEGACY_CARDS, LEGACY_UNIVERSITIES, sortableDate } from './legacyData.js';
import { Kpi, LegacyButton, LegacyScreen, PageHeader, UniversityCell } from './legacyUi.jsx';
import './DashboardScreen.css';

/** Кольцо диаграммы прежнего дизайна: радиус 89 при размере 210 → длина окружности. */
const DONUT_CIRCUMFERENCE = 559.2;

/**
 * Дашборд прежнего дизайна (ветка main): распределение заявок по 13 этапам, KPI, события
 * и первые заявки списком. Данные — демонстрационные, как в main.
 */
export function DashboardScreen() {
  useDocumentTitle('Дашборд');
  const { navigate } = useRouter();
  const { user } = useSession();
  const { events } = useStoreState();
  const { users } = useCatalogIndex();
  const interactions = useVisibleInteractionRows().filter((row) => row.workflowId === BASE_WORKFLOW.id);
  const chartRef = useRef(null);
  const [creating, setCreating] = useState(false);
  const [hoveredStage, setHoveredStage] = useState(null);
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

  const stats = countCardsByStage(LEGACY_CARDS);
  const total = stats.reduce((sum, stage) => sum + stage.n, 0) || 1;
  const maxN = Math.max(1, ...stats.map((stage) => stage.n));
  const activeStage = stats.find((stage) => stage.id === hoveredStage);
  const phaseRanges = PHASES.map((phase) => {
    const indexes = stats.map((stage, index) => (stage.phase === phase.id ? index : -1)).filter((index) => index !== -1);
    return indexes.length ? { ...phase, from: indexes[0], to: indexes.at(-1) } : null;
  }).filter(Boolean);
  const dashboardUniversities = LEGACY_UNIVERSITIES.slice(0, 5).sort((a, b) =>
    sortableDate(a.updatedAt).localeCompare(sortableDate(b.updatedAt)),
  );

  const sliceAngles = [];
  const donutSegments = [];
  let acc = 0;
  for (const stage of stats) {
    if (!stage.n) continue;
    const from = (acc / total) * 360;
    acc += stage.n;
    const to = (acc / total) * 360;
    sliceAngles.push(to);
    donutSegments.push({ stage, start: from / 360, ratio: stage.n / total });
  }

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const fills = gsap.utils.toArray('.stage-bar-fill');
      const timeline = gsap.timeline();

      gsap.set(fills, { scaleY: 0, transformOrigin: 'bottom' });
      gsap.set('.donut', { '--donut-progress': 0 });

      sliceAngles.forEach((angle) => {
        timeline.to('.donut', { '--donut-progress': angle, duration: 0.18, ease: 'power2.out' });
      });

      timeline.to(fills, { scaleY: 1, duration: 0.55, stagger: 0.055, ease: 'power3.out' }, 0.12);
    }, chartRef);

    return () => context.revert();
    // Данные статичные — анимация проигрывается один раз при открытии экрана.
  }, []);

  return (
    <LegacyScreen className="legacy-dashboard">
      <PageHeader title={`Добрый день, ${user.name.split(' ')[0]}`}>
        <LegacyButton icon={<FilterIcon size={16} fill="currentColor" />}>
          Все менеджеры
        </LegacyButton>
        <LegacyButton onClick={() => navigate('/main/import')} icon={<UploadIcon size={16} fill="currentColor" />}>
          Импортировать
        </LegacyButton>
        <LegacyButton primary onClick={() => setCreating(true)} icon={<AddIcon size={16} fill="currentColor" />}>
          Новое взаимодействие
        </LegacyButton>
      </PageHeader>

      <section ref={chartRef} className="panel stage-stats">
        <div className="panel-head">
          <div>
            <h2>Распределение заявок по этапам</h2>
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
                    r="89"
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
          <div className="stage-bars">
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
          <section className="kpi-grid">
            <Kpi title="Вузов в работе" value={universitiesInProgress} icon={<UniversityIcon fill="currentColor" />} tone="indigo" />
            <Kpi title="Контрактов подписано за этот месяц" value={contractsSignedThisMonth} icon={<DocumentIcon fill="currentColor" />} tone="orange" />
            <Kpi title="Учебных программ актуализировано" value={updatedPrograms} icon={<EducationIcon fill="currentColor" />} tone="indigo" />
          </section>
        </div>
        <div className="dash-right">
          <section className="panel dash-feed-panel dash-attention-panel" aria-labelledby="dash-attention-title">
            <div className="panel-head dash-feed-head">
              <div>
                <h2 id="dash-attention-title">Требуют внимания <span className="dash-feed-count">{attentionRows.length}</span></h2>
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
            <Link className="dash-feed-more" to="/interactions?attention=1">
              Все срочные взаимодействия <ArrowRightIcon size={16} fill="currentColor" />
            </Link>
          </section>
          <section className="panel dash-feed-panel dash-activity-panel" aria-labelledby="dash-activity-title">
            <div className="panel-head dash-feed-head">
              <div>
                <h2 id="dash-activity-title">Последние действия</h2>
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
            <Link className="dash-feed-more" to="/interactions">
              Все взаимодействия <ArrowRightIcon size={16} fill="currentColor" />
            </Link>
          </section>
        </div>
      </div>

      <section className="panel table-panel dashboard-universities">
        <div className="panel-head dashboard-universities-head">
          <h2>Заявки</h2>
        </div>
        <div className="dashboard-universities-table">
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
                <tr key={university.name}>
                  <td>
                    <UniversityCell name={university.name} />
                  </td>
                  <td>
                    <b>{university.product}</b>
                    <span className="subtext">{university.direction}</span>
                  </td>
                  <td>
                    <span className="status-tag purple">{university.status}</span>
                  </td>
                  <td>{university.manager}</td>
                  <td className="muted">{university.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dashboard-universities-fade">
            <Link className="dashboard-universities-all" to="/interactions">
              Все заявки <ArrowRightIcon size={16} fill="currentColor" />
            </Link>
          </div>
        </div>
      </section>

      <NewInteractionDialog open={creating} onOpenChange={setCreating} />
    </LegacyScreen>
  );
}
