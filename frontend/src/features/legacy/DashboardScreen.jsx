import { Popover } from '@atomaro/ui-kit';
import { gsap } from 'gsap';
import { useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import {
  AddIcon,
  ArrowRightIcon,
  CalendarIcon,
  ChevronDownIcon,
  FilterIcon,
  MoreIcon,
  PulseIcon,
  AnalyticsIcon,
  UniversityIcon,
  UploadIcon,
  WarningIcon,
} from '../../ui/icons.js';
import { countCardsByStage, LEGACY_UNIVERSITIES, sortableDate } from './legacyData.js';
import { Kpi, LegacyButton, LegacyScreen, PageHeader, UniversityCell } from './legacyUi.jsx';
import { useLegacyCards } from './useLegacyCards.js';

/** Кольцо диаграммы прежнего дизайна: радиус 89 при размере 210 → длина окружности. */
const DONUT_CIRCUMFERENCE = 559.2;

const MESSAGES = [
  { author: 'Алексей Козлов', initials: 'АК', tone: '', text: 'Обновите статус взаимодействия по Казанскому федеральному университету', time: '10 минут назад' },
  { author: 'Елена Ким', initials: 'ЕК', tone: 'ec', text: 'Загружен новый пакет документов для подписания', time: '1 час назад' },
  { author: 'Система', initials: 'СИ', tone: 'sys', text: 'Синхронизация с LMS завершена: обновлено 24 записи', time: 'вчера, 18:42' },
];

/**
 * Дашборд прежнего дизайна (ветка main): распределение заявок по 13 этапам, KPI, сообщения
 * и первые заявки списком. Данные — демонстрационные, как в main.
 */
export function DashboardScreen() {
  useDocumentTitle('Дашборд — дизайн main');
  const { navigate } = useRouter();
  const { user } = useSession();
  const { cards } = useLegacyCards();
  const chartRef = useRef(null);
  const [hoveredStage, setHoveredStage] = useState(null);
  const [hoveredDonutStage, setHoveredDonutStage] = useState(null);

  const stats = countCardsByStage(cards);
  const total = stats.reduce((sum, stage) => sum + stage.n, 0) || 1;
  const maxN = Math.max(1, ...stats.map((stage) => stage.n));
  const dashboardUniversities = LEGACY_UNIVERSITIES.slice(0, 4).sort((a, b) =>
    sortableDate(a.updatedAt).localeCompare(sortableDate(b.updatedAt)),
  );

  const slices = [];
  const sliceAngles = [];
  const donutSegments = [];
  let acc = 0;
  for (const stage of stats) {
    if (!stage.n) continue;
    const from = (acc / total) * 360;
    acc += stage.n;
    const to = (acc / total) * 360;
    slices.push(`${stage.color} ${from}deg ${to}deg`);
    sliceAngles.push(to);
    donutSegments.push({ stage, start: from / 360, ratio: stage.n / total });
  }
  const donutBg = `conic-gradient(${slices.join(',')})`;

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
    // Перезапуск при смене карточек: этапы и высоты столбцов пересчитаны.
  }, [cards]);

  return (
    <LegacyScreen>
      <PageHeader title={`Добрый день, ${user.name.split(' ')[0]}`}>
        <LegacyButton onClick={() => navigate('/main/import')} icon={<UploadIcon size={16} fill="currentColor" />}>
          Импортировать
        </LegacyButton>
        <LegacyButton primary onClick={() => navigate('/main/workflow')} icon={<AddIcon size={16} fill="currentColor" />}>
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
        <div className="stage-stats-body">
          <div className="donut-wrap">
            <div className="donut" style={{ '--donut-background': donutBg }}>
              <svg className="donut-segments" viewBox="0 0 210 210" onMouseLeave={() => setHoveredDonutStage(null)}>
                {donutSegments.map(({ stage, start, ratio }) => (
                  <circle
                    key={stage.id}
                    className="donut-segment"
                    cx="105"
                    cy="105"
                    r="89"
                    strokeDasharray={`${ratio * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`}
                    strokeDashoffset={-start * DONUT_CIRCUMFERENCE}
                    transform="rotate(-90 105 105)"
                    onMouseEnter={() => setHoveredDonutStage(stage)}
                  />
                ))}
              </svg>
              <div>
                <strong>{hoveredDonutStage ? hoveredDonutStage.n : total}</strong>
                <span className={hoveredDonutStage ? 'donut-stage-label' : ''}>
                  {hoveredDonutStage ? hoveredDonutStage.short : 'всего'}
                </span>
              </div>
            </div>
          </div>
          <div className="stage-bars">
            {stats.map((stage, index) => (
              <div
                className="stage-bar"
                key={stage.id}
                onMouseEnter={() => setHoveredStage(stage.id)}
                onMouseLeave={() => setHoveredStage(null)}
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
                          <b>{stage.label}</b>
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
          </div>
        </div>
      </section>

      <div className="dash-bottom">
        <div className="dash-left">
          <section className="kpi-grid">
            <Kpi title="Вузов в работе" value="24" change="+12%" note="к прошлому месяцу" icon={<UniversityIcon fill="currentColor" />} tone="indigo" />
            <Kpi title="Активных взаимодействий" value="48" change="+8%" note="за текущий период" icon={<PulseIcon fill="currentColor" />} tone="teal" />
            <Kpi title="Требуют внимания" value="7" change="2 новых" note="просрочено по SLA" icon={<WarningIcon fill="currentColor" />} tone="orange" warning />
            <Kpi title="Конверсия в пилот" value="32%" change="+4.6%" note="к прошлому месяцу" icon={<AnalyticsIcon fill="currentColor" />} tone="pink" />
          </section>
        </div>
        <div className="dash-right">
          <section className="panel messages-panel">
            <div className="panel-head">
              <div>
                <h2>Сообщения</h2>
                <span>3 непрочитанных</span>
              </div>
              <button className="dots">
                <MoreIcon size={19} fill="currentColor" />
              </button>
            </div>
            <div className="messages-list">
              {MESSAGES.map((message) => (
                <div className="message" key={message.author}>
                  <span className={`avatar tiny ${message.tone}`.trim()}>{message.initials}</span>
                  <div>
                    <b>{message.author}</b>
                    <p>{message.text}</p>
                    <span>{message.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="filter-strip">
        <div className="date-filter">
          <CalendarIcon size={16} fill="currentColor" /> 01 мая — 15 мая 2026 <ChevronDownIcon size={14} fill="currentColor" />
        </div>
        <span className="live">
          <i /> Данные обновлены 5 мин назад
        </span>
        <button className="filter-link">
          <FilterIcon size={15} fill="currentColor" /> Все менеджеры
        </button>
      </div>

      <section className="panel table-panel dashboard-universities">
        <div className="table-meta">
          <span>
            <b>Заявки</b> · Первые 4 в списке
          </span>
          <span>По времени последнего обновления</span>
        </div>
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
            <tr className="dashboard-view-all">
              <td colSpan="5">
                <button className="text-button" onClick={() => navigate('/main/universities')}>
                  Посмотреть все <ArrowRightIcon size={15} fill="currentColor" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </LegacyScreen>
  );
}
