import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { AnalyticsIcon, CalendarIcon, DownloadIcon, EducationIcon, WarningIcon } from '../../ui/icons.js';
import { Kpi, LegacyButton, LegacyScreen, PageHeader } from './legacyUi.jsx';

/** Рейтинг программ: название, число обучающихся, цвет и длина полосы. */
const PROGRAMS = [
  { name: 'Программная инженерия', students: '1 248', color: '#8300ff', share: 100 },
  { name: 'Аналитика данных', students: '986', color: '#a64dff', share: 78 },
  { name: 'Кибербезопасность', students: '742', color: '#ff4f12', share: 59 },
  { name: 'Информационные системы', students: '538', color: '#ff7a45', share: 43 },
];

/** Аналитика прежнего дизайна (ветка main): динамика заявок, рейтинг программ и три показателя. */
export function AnalyticsScreen() {
  useDocumentTitle('Аналитика — дизайн main');

  return (
    <LegacyScreen>
      <PageHeader title="Аналитика">
        <LegacyButton icon={<DownloadIcon size={16} fill="currentColor" />}>Скачать PNG</LegacyButton>
        <LegacyButton primary icon={<CalendarIcon size={16} fill="currentColor" />}>
          01 янв — 15 мая 2026
        </LegacyButton>
      </PageHeader>

      <div className="analytics-grid">
        <section className="panel big-chart">
          <div className="panel-head">
            <div>
              <h2>Заявки на обучение</h2>
              <span>По всем направлениям</span>
            </div>
            <div className="chart-legend">
              <i /> 2026 <i className="gray" /> 2025
            </div>
          </div>
          <div className="line-chart">
            <div className="y-labels">
              <span>300</span>
              <span>200</span>
              <span>100</span>
              <span>0</span>
            </div>
            <svg viewBox="0 0 700 260" preserveAspectRatio="none">
              <path
                d="M0 220 C70 190 90 210 140 170 S220 160 260 120 S330 150 370 105 S440 110 480 72 S550 80 590 42 S650 58 700 20"
                fill="none"
                stroke="#8300ff"
                strokeWidth="4"
              />
              <path
                d="M0 220 C70 215 100 220 140 195 S220 205 260 180 S330 198 370 160 S440 165 480 145 S550 155 590 122 S650 140 700 108"
                fill="none"
                stroke="#d4d4d8"
                strokeWidth="3"
                strokeDasharray="6 7"
              />
              <path
                d="M0 220 C70 190 90 210 140 170 S220 160 260 120 S330 150 370 105 S440 110 480 72 S550 80 590 42 S650 58 700 20 L700 260 L0 260Z"
                fill="url(#fade)"
              />
              <defs>
                <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="#8300ff" stopOpacity=".16" />
                  <stop offset="1" stopColor="#8300ff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <div className="x-labels">
              <span>Янв</span>
              <span>Фев</span>
              <span>Мар</span>
              <span>Апр</span>
              <span>Май</span>
            </div>
          </div>
        </section>

        <section className="panel ranking">
          <div className="panel-head">
            <div>
              <h2>Рейтинг программ</h2>
              <span>По числу обучающихся</span>
            </div>
          </div>
          {PROGRAMS.map((program, index) => (
            <div className="rank" key={program.name}>
              <span className="rank-num">0{index + 1}</span>
              <div>
                <b>{program.name}</b>
                <div className="progress">
                  <i style={{ width: `${program.share}%`, background: program.color }} />
                </div>
              </div>
              <strong>{program.students}</strong>
            </div>
          ))}
        </section>
      </div>

      <div className="kpi-grid analytics-kpis">
        <Kpi title="Обучающихся" value="3 514" change="+18.2%" note="к прошлому году" icon={<EducationIcon fill="currentColor" />} tone="indigo" />
        <Kpi title="Параллельных потоков" value="86" change="+12" note="за текущий период" icon={<WarningIcon fill="currentColor" />} tone="teal" />
        <Kpi title="Средняя конверсия" value="32%" change="+4.6%" note="от заявки до пилота" icon={<AnalyticsIcon fill="currentColor" />} tone="pink" />
      </div>
    </LegacyScreen>
  );
}
