import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Button as AtomaroButton, Popover } from '@atomaro/ui-kit';
import '@atomaro/ui-kit/styles/atomaro-default-light-all.css';
import { Dialog } from '@base-ui/react/dialog';
import { Menu } from '@base-ui/react/menu';
import { createRoot } from 'react-dom/client';
import { AddLarge, Catalog, Download, Filter, Home, Search, SecurityCheck, Settings, SettingsAdjust, Upload } from '@atomaro/icons/24/action';
import { AttentionMonochrome, HelpMonochrome } from '@atomaro/icons/24/alert';
import { StatisticsColumn } from '@atomaro/icons/24/business';
import { Calendar, Users } from '@atomaro/icons/24/communication';
import { Education, Government, Pulse } from '@atomaro/icons/24/culture';
import { Table, XLSX } from '@atomaro/icons/24/document';
import { ArrowRight, CheckLarge, CheckSmall, ChevronDown, CloseSmall, More } from '@atomaro/icons/24/navigation';
import './styles.css';
import LoginPage from './LoginPage.jsx';

const stages = [
  { id: 's1', label: 'Коммуникация с вузом', short: 'Коммуникация', color: '#ffd9c2' },
  { id: 's2', label: 'Организация встречи', short: 'Встреча', color: '#ffceb3' },
  { id: 's3', label: 'Обмен документами', short: 'Документы', color: '#ffc2a5' },
  { id: 's4', label: 'Корректировка документов', short: 'Правки', color: '#ffb796' },
  { id: 's5', label: 'Подписание документов', short: 'Подписание', color: '#ffab87' },
  { id: 's6', label: 'Передача материалов и лицензий', short: 'Передача', color: '#ffa079' },
  { id: 's7', label: 'Сопровождение внедрения', short: 'Внедрение', color: '#ff946a' },
  { id: 's8', label: 'Обучение преподавателей', short: 'Обучение', color: '#ff895b' },
  { id: 's9', label: 'Актуализация программы', short: 'Программа', color: '#ff7d4d' },
  { id: 's10', label: 'Ведение занятий', short: 'Занятия', color: '#ff723e' },
  { id: 's11', label: 'Актуализация документации', short: 'Документация', color: '#ff662f' },
  { id: 's12', label: 'Повышение квалификации', short: 'Квалификация', color: '#ff5b21' },
  { id: 's13', label: 'Контроль исполнения', short: 'Контроль', color: '#ff4f12' }
];

const initialCards = [
  { id: 1, university: 'Казанский федеральный университет', short: 'КФУ', product: 'МойОфис', direction: 'Информационные системы', owner: 'Алина Воронова', stage: 's1', days: 2, initials: 'КФ' },
  { id: 2, university: 'ИТМО', short: 'ИТМО', product: 'Р7-Офис', direction: 'Программная инженерия', owner: 'Михаил Орлов', stage: 's1', days: 4, initials: 'ИТ' },
  { id: 3, university: 'УрФУ им. Б. Н. Ельцина', short: 'УрФУ', product: 'SberJazz', direction: 'Информационные системы', owner: 'Елена Ким', stage: 's2', days: 1, initials: 'УФ' },
  { id: 4, university: 'Томский политехнический университет', short: 'ТПУ', product: 'МойОфис', direction: 'Кибербезопасность', owner: 'Алина Воронова', stage: 's2', days: 7, initials: 'ТП' },
  { id: 5, university: 'НИУ ВШЭ', short: 'ВШЭ', product: 'Контур', direction: 'Программная инженерия', owner: 'Михаил Орлов', stage: 's3', days: 3, initials: 'ВШ' },
  { id: 6, university: 'Дальневосточный федеральный университет', short: 'ДВФУ', product: 'Р7-Офис', direction: 'Аналитика данных', owner: 'Елена Ким', stage: 's7', days: 12, initials: 'ДВ' },
  { id: 7, university: 'Московский политех', short: 'МПУ', product: 'МойОфис', direction: 'Кибербезопасность', owner: 'Алина Воронова', stage: 's5', days: 2, initials: 'МП' },
  { id: 8, university: 'Южный федеральный университет', short: 'ЮФУ', product: 'Контур', direction: 'Аналитика данных', owner: 'Михаил Орлов', stage: 's13', days: 1, initials: 'ЮФ' }
];

const universities = [
  ['Казанский федеральный университет', 'МойОфис', 'Информационные системы', 'Подписание документов', 'Алина Воронова', '12.05.2026'],
  ['ИТМО', 'Р7-Офис', 'Программная инженерия', 'Организация встречи', 'Михаил Орлов', '09.05.2026'],
  ['УрФУ им. Б. Н. Ельцина', 'SberJazz', 'Информационные системы', 'Обмен документами', 'Елена Ким', '07.05.2026'],
  ['Томский политехнический университет', 'МойОфис', 'Кибербезопасность', 'Организация встречи', 'Алина Воронова', '04.05.2026'],
  ['НИУ ВШЭ', 'Контур', 'Программная инженерия', 'Обмен документами', 'Михаил Орлов', '02.05.2026'],
  ['Дальневосточный федеральный университет', 'Р7-Офис', 'Аналитика данных', 'Сопровождение внедрения', 'Елена Ким', '28.04.2026']
];

const activity = [
  ['Елена Ким', 'перевела УрФУ на этап «Обмен документами»', '12 минут назад', 'ec'],
  ['Михаил Орлов', 'добавил комментарий к ИТМО', '48 минут назад', 'mo'],
  ['Алина Воронова', 'загрузила договор для Московского политеха', '2 часа назад', 'av'],
  ['Система', 'синхронизировала 24 записи из LMS', 'вчера, 18:42', 'sys']
];

function App() {
  const [page, setPage] = useState('dashboard');
  const [role, setRole] = useState('Руководитель');
  const [authed, setAuthed] = useState(false);
  const [cards, setCards] = useState(initialCards);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [importStep, setImportStep] = useState(0);

  const notify = (message) => { setToast(message); setTimeout(() => setToast(''), 2800); };
  const moveCard = (id, stage) => {
    setCards(current => current.map(card => card.id === id ? { ...card, stage } : card));
    notify('Статус взаимодействия обновлён');
  };
  const filteredCards = useMemo(() => cards.filter(c => `${c.university} ${c.product} ${c.direction} ${c.owner}`.toLowerCase().includes(search.toLowerCase())), [cards, search]);

  if (!authed) return <LoginPage onLogin={(r) => { setRole(r); setAuthed(true); }} />;
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><img className="brand-logo" src="/logo/logo.svg" alt="Ростелеком" /><button className="close-nav" onClick={() => setMobileNav(false)}><CloseSmall size={18} fill="currentColor"/></button></div>
      <div className="workspace"><span>Рабочее пространство</span><button><span className="avatar xs">РК</span>Ростелеком <ChevronDown size={14} fill="currentColor"/></button></div>
      <nav>
        <div className="nav-label">ОБЗОР</div>
        <NavItem icon={<Home fill="currentColor"/>} label="Дашборд" active={page === 'dashboard'} onClick={() => setPage('dashboard')} />
        <NavItem icon={<Government fill="currentColor"/>} label="Мои вузы" count="24" active={page === 'universities'} onClick={() => setPage('universities')} />
        <NavItem icon={<Pulse fill="currentColor"/>} label="Workflow" count="18" active={page === 'workflow'} onClick={() => setPage('workflow')} />
        <NavItem icon={<StatisticsColumn fill="currentColor"/>} label="Аналитика" active={page === 'analytics'} onClick={() => setPage('analytics')} />
        <div className="nav-label">ИНСТРУМЕНТЫ</div>
        <NavItem icon={<Upload fill="currentColor"/>} label="Импорт данных" active={page === 'import'} onClick={() => setPage('import')} />
        <NavItem icon={<Table fill="currentColor"/>} label="Отчёты" active={page === 'reports'} onClick={() => setPage('reports')} />
        <NavItem icon={<Catalog fill="currentColor"/>} label="Каталоги" active={page === 'catalogs'} onClick={() => setPage('catalogs')} />
        {role !== 'Пользователь' && <><div className="nav-label">УПРАВЛЕНИЕ</div><NavItem icon={<Users fill="currentColor"/>} label="Пользователи" active={page === 'users'} onClick={() => setPage('users')} /><NavItem icon={<Settings fill="currentColor"/>} label="Настройки" active={page === 'settings'} onClick={() => setPage('settings')} /></>}
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><HelpMonochrome size={19} fill="currentColor"/><div><b>Нужна помощь?</b><span>Открыть базу знаний</span></div><ArrowRight size={15} fill="currentColor"/></div><div className="user-mini"><span className="avatar">АК</span><div><b>Алексей Козлов</b><span>Настройки аккаунта</span></div><RoleMenu role={role} setRole={(value) => { setRole(value); notify(`Режим: ${value}`); }} /></div></div>
    </aside>
    <main className="main">
      <div className="content">{page === 'dashboard' && <Dashboard setPage={setPage} notify={notify} cards={cards}/>} {page === 'universities' && <Universities search={search} setSearch={setSearch} onSelect={setSelected} notify={notify}/>} {page === 'workflow' && <Workflow cards={filteredCards} search={search} setSearch={setSearch} moveCard={moveCard} onSelect={setSelected} />} {page === 'analytics' && <Analytics/>} {page === 'import' && <Import step={importStep} setStep={setImportStep} notify={notify}/>} {page === 'reports' && <Reports notify={notify}/>} {page === 'catalogs' && <Catalogs/>} {(page === 'users' || page === 'settings') && <Admin page={page} notify={notify}/>}</div>
    </main>
    {selected && <UniversityModal university={selected} close={() => setSelected(null)} notify={notify}/>} {toast && <div className="toast"><CheckSmall size={17} fill="currentColor"/>{toast}</div>}
  </div>;
}

function NavItem({icon,label,count,active,onClick}) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count && <em>{count}</em>}</button> }
function pageName(page) { return ({dashboard:'Дашборд',universities:'Мои вузы',workflow:'Workflow',analytics:'Аналитика',import:'Импорт данных',reports:'Отчёты',catalogs:'Каталоги',users:'Пользователи',settings:'Настройки'})[page] }
function PageHeader({title,children}) { return <div className="page-header"><h1>{title}</h1><div className="page-actions">{children}</div></div> }

function Button({children,primary=false,onClick,icon}) { return <AtomaroButton className={`button atomaro-button ${primary?'primary':''}`} variant={primary ? 'primary' : 'outline'} iconPrefix={icon} label={children} onClick={onClick}/> }
function RoleMenu({role,setRole}) { return <Menu.Root><Menu.Trigger className="role-select"><SecurityCheck size={15} fill="currentColor"/><span>{role}</span><ChevronDown size={14} fill="currentColor"/></Menu.Trigger><Menu.Portal><Menu.Positioner className="menu-positioner" sideOffset={6} align="end"><Menu.Popup className="menu-popup">{['Руководитель','Пользователь','Администратор'].map(item=><Menu.Item key={item} className={`menu-item ${item===role?'selected':''}`} onClick={()=>setRole(item)}>{item}{item===role&&<CheckSmall size={14} fill="currentColor"/>}</Menu.Item>)}</Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root> }
function stageStats(cards){return stages.map(s=>({id:s.id,label:s.label,short:s.short,color:s.color,n:cards.filter(c=>c.stage===s.id).length}))}
function Dashboard({ setPage, notify, cards }) {
  const chartRef = useRef(null);
  const [hoveredStage, setHoveredStage] = useState(null);
  const [hoveredDonutStage, setHoveredDonutStage] = useState(null);
  const stats = stageStats(cards);
  const total = stats.reduce((a, x) => a + x.n, 0) || 1;
  const maxN = Math.max(1, ...stats.map((x) => x.n));
  const dashboardUniversities = universities
    .slice(0, 4)
    .sort((a, b) => a[5].split(".").reverse().join("").localeCompare(b[5].split(".").reverse().join("")));
  let acc = 0;
  const slices = [];
  const sliceAngles = [];
  const donutSegments = [];
  for (const x of stats) {
    if (!x.n) continue;
    const a = (acc / total) * 360;
    acc += x.n;
    const b = (acc / total) * 360;
    slices.push(x.color + " " + a + "deg " + b + "deg");
    sliceAngles.push(b);
    donutSegments.push({ stage: x, start: a / 360, ratio: x.n / total });
  }
  const donutBg = "conic-gradient(" + slices.join(",") + ")";
  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const fills = gsap.utils.toArray(".stage-bar-fill");
      const timeline = gsap.timeline();

      gsap.set(fills, { scaleY: 0, transformOrigin: "bottom" });
      gsap.set(".donut", { "--donut-progress": 0 });

      sliceAngles.forEach((angle) => {
        timeline.to(".donut", {
          "--donut-progress": angle,
          duration: 0.18,
          ease: "power2.out",
        });
      });

      timeline.to(
        fills,
        { scaleY: 1, duration: 0.55, stagger: 0.055, ease: "power3.out" },
        0.12,
      );
    }, chartRef);

    return () => context.revert();
  }, [cards]);
  return (
    <>
      <PageHeader title="Добрый день, Алексей">
        <Button
          onClick={() => setPage("import")}
          icon={<Upload size={16} fill="currentColor" />}
        >
          Импортировать
        </Button>
        <Button
          primary
          onClick={() => setPage("workflow")}
          icon={<AddLarge size={16} fill="currentColor" />}
        >
          Новое взаимодействие
        </Button>
      </PageHeader>
      <section ref={chartRef} className="panel stage-stats">
        <div className="panel-head">
          <div>
            <h2>Распределение заявок по этапам</h2>
          </div>
          <button className="dots">
            <More size={19} fill="currentColor" />
          </button>
        </div>
        <div className="stage-stats-body">
          <div className="donut-wrap">
            <div className="donut" style={{ "--donut-background": donutBg }}>
              <svg
                className="donut-segments"
                viewBox="0 0 210 210"
                onMouseLeave={() => setHoveredDonutStage(null)}
              >
                {donutSegments.map(({ stage, start, ratio }) => (
                  <circle
                    key={stage.id}
                    className="donut-segment"
                    cx="105"
                    cy="105"
                    r="89"
                    strokeDasharray={`${ratio * 559.2} 559.2`}
                    strokeDashoffset={-start * 559.2}
                    transform="rotate(-90 105 105)"
                    onMouseEnter={() => setHoveredDonutStage(stage)}
                  />
                ))}
              </svg>
              <div>
                <strong>{hoveredDonutStage ? hoveredDonutStage.n : total}</strong>
                <span className={hoveredDonutStage ? "donut-stage-label" : ""}>
                  {hoveredDonutStage ? hoveredDonutStage.short : "всего"}
                </span>
              </div>
            </div>
          </div>
          <div className="stage-bars">
            {stats.map((x, index) => (
              <div
                className="stage-bar"
                key={x.id}
                onMouseEnter={() => setHoveredStage(x.id)}
                onMouseLeave={() => setHoveredStage(null)}
              >
                <div
                  className="stage-bar-area"
                  style={{ "--stage-bar-height": (x.n / maxN) * 100 + "%" }}
                >
                  <Popover
                    trigger="click"
                    placement={index >= stats.length - 2 ? "topRight" : "top"}
                    size="m"
                    isOpened={hoveredStage === x.id}
                    usePopperProps={{ flip: false, preventOverflow: false }}
                    className="stage-bar-popover"
                    innerChildren={<div className="stage-bar-popover-content"><b>{x.label}</b><span>Заявок: {x.n}</span></div>}
                  >
                    <i
                      className="stage-bar-fill"
                      style={{
                        height: "100%",
                        background: x.color,
                      }}
                    />
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
            <Kpi
              title="Вузов в работе"
              value="24"
              change="+12%"
              note="к прошлому месяцу"
              icon={<Government fill="currentColor" />}
              tone="indigo"
            />
            <Kpi
              title="Активных взаимодействий"
              value="48"
              change="+8%"
              note="за текущий период"
              icon={<Pulse fill="currentColor" />}
              tone="teal"
            />
            <Kpi
              title="Требуют внимания"
              value="7"
              change="2 новых"
              note="просрочено по SLA"
              icon={<AttentionMonochrome fill="currentColor" />}
              tone="orange"
              warning
            />
            <Kpi
              title="Конверсия в пилот"
              value="32%"
              change="+4.6%"
              note="к прошлому месяцу"
              icon={<StatisticsColumn fill="currentColor" />}
              tone="pink"
            />
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
                <More size={19} fill="currentColor" />
              </button>
            </div>
            <div className="messages-list">
              <div className="message">
                <span className="avatar tiny">АК</span>
                <div>
                  <b>Алексей Козлов</b>
                  <p>
                    Обновите статус взаимодействия по Казанскому федеральному
                    университету
                  </p>
                  <span>10 минут назад</span>
                </div>
              </div>
              <div className="message">
                <span className="avatar tiny ec">ЕК</span>
                <div>
                  <b>Елена Ким</b>
                  <p>Загружен новый пакет документов для подписания</p>
                  <span>1 час назад</span>
                </div>
              </div>
              <div className="message">
                <span className="avatar tiny sys">СИ</span>
                <div>
                  <b>Система</b>
                  <p>Синхронизация с LMS завершена: обновлено 24 записи</p>
                  <span>вчера, 18:42</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="filter-strip">
        <div className="date-filter">
          <Calendar size={16} fill="currentColor" /> 01 мая — 15 мая 2026{" "}
          <ChevronDown size={14} fill="currentColor" />
        </div>
        <span className="live">
          <i /> Данные обновлены 5 мин назад
        </span>
        <button className="filter-link">
          <Filter size={15} fill="currentColor" /> Все менеджеры
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
            {dashboardUniversities.map((u) => (
              <tr key={u[0]}>
                <td>
                  <div className="uni-cell">
                    <span className="uni-logo">
                      {u[0].split(" ").map((x) => x[0]).join("").slice(0, 2)}
                    </span>
                    <b>{u[0]}</b>
                  </div>
                </td>
                <td>
                  <b>{u[1]}</b>
                  <span className="subtext">{u[2]}</span>
                </td>
                <td><span className="status-tag purple">{u[3]}</span></td>
                <td>{u[4]}</td>
                <td className="muted">{u[5]}</td>
              </tr>
            ))}
            <tr className="dashboard-view-all">
              <td colSpan="5">
                <button className="text-button" onClick={() => setPage("universities")}>
                  Посмотреть все <ArrowRight size={15} fill="currentColor" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      {false && <>
      <section className="panel activity-panel">
        <div className="panel-head">
          <div>
            <h2>Последние действия</h2>
            <span>За последние 24 часа</span>
          </div>
          <button className="text-button" onClick={() => setPage("workflow")}>
            Все действия <ArrowRight size={15} fill="currentColor" />
          </button>
        </div>
        <div className="activity-list">
          {activity.map((a) => (
            <div className="activity" key={a[1]}>
              <span className={`avatar small ${a[3]}`}>
                {a[3] === "sys"
                  ? "✦"
                  : a[0]
                      .split(" ")
                      .map((x) => x[0])
                      .join("")
                      .slice(0, 2)}
              </span>
              <div>
                <p>
                  <b>{a[0]}</b> {a[1]}
                </p>
                <span>{a[2]}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel attention-panel">
        <div className="panel-head">
          <div>
            <h2>
              Требуют внимания <span className="count-badge">7</span>
            </h2>
            <span>Взаимодействия с приближающимся SLA</span>
          </div>
          <button className="text-button" onClick={() => setPage("workflow")}>
            Открыть workflow <ArrowRight size={15} fill="currentColor" />
          </button>
        </div>
        <div className="attention-table">
          {universities.slice(0, 3).map((u, i) => (
            <div className="attention-row" key={u[0]}>
              <div className="uni-cell">
                <span className="uni-logo">
                  {u[0]
                    .split(" ")
                    .map((x) => x[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div>
                  <b>{u[0]}</b>
                  <span>
                    {u[1]} · {u[2]}
                  </span>
                </div>
              </div>
              <span className="status-tag orange">
                {i === 0
                  ? "Осталось 2 дня"
                  : i === 1
                    ? "Остался 1 день"
                    : "Просрочено на 3 дня"}
              </span>
              <span className="owner">{u[4]}</span>
              <button
                className="row-arrow"
                onClick={() => notify("Открыта карточка взаимодействия")}
              >
                <ArrowRight size={17} fill="currentColor" />
              </button>
            </div>
          ))}
        </div>
      </section>
      </>}
    </>
  );
}
function Kpi({ title, value, change, note, icon, tone, warning }) {
  return (
    <div className="kpi">
      <div className={`kpi-icon ${tone}`}>{icon}</div>
      <div className="kpi-body">
        <span>{title}</span>
        <strong>{value}</strong>
        <div>
          <b className={warning ? "warning" : ""}>{change}</b>
          <small>{note}</small>
        </div>
      </div>
      <More className="kpi-more" size={17} fill="currentColor" />
    </div>
  );
}
function Universities({ search, setSearch, onSelect, notify }) {
  const [statusFilter, setStatusFilter] = useState(null);
  const statuses = [...new Set(universities.map((u) => u[3]))];
  const list = universities.filter(
    (u) =>
      u.join(" ").toLowerCase().includes(search.toLowerCase()) &&
      (!statusFilter || u[3] === statusFilter),
  );
  const cycleStatus = () =>
    setStatusFilter((s) => {
      const i = s ? statuses.indexOf(s) : -1;
      return i > -1 && i < statuses.length - 1 ? statuses[i + 1] : null;
    });
  return (
    <>
      <PageHeader title="Мои вузы">
        <Button
          onClick={() => notify("Экспорт подготовлен")}
          icon={<Download size={16} fill="currentColor" />}
        >
          Экспорт
        </Button>
        <Button
          primary
          onClick={() => notify("Открыта форма нового вуза")}
          icon={<AddLarge size={16} fill="currentColor" />}
        >
          Добавить вуз
        </Button>
      </PageHeader>
      <div className="toolbar">
        <div className="search">
          <Search size={17} fill="currentColor" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по вузам, продуктам..."
          />
        </div>
        <Button icon={<SettingsAdjust size={16} fill="currentColor" />}>
          Фильтры <span className="filter-count">2</span>
        </Button>
      </div>
      <section className="panel table-panel">
        <table>
          <thead>
            <tr>
              <th>ВУЗ</th>
              <th>ПРОДУКТ / НАПРАВЛЕНИЕ</th>
              <th
                className={`sortable ${statusFilter ? "active" : ""}`}
                onClick={cycleStatus}
                title={
                  statusFilter
                    ? `Фильтр: ${statusFilter}. Нажмите, чтобы сбросить`
                    : "Фильтр по статусу. Нажмите, чтобы применить"
                }
              >
                СТАТУС WORKFLOW
                {statusFilter && <em className="th-chip">{statusFilter}</em>}
                <ChevronDown size={12} fill="currentColor" />
              </th>
              <th>МЕНЕДЖЕР</th>
              <th>ПОСЛЕДНЕЕ ИЗМЕНЕНИЕ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((u, i) => (
              <tr key={u[0]} onClick={() => onSelect(u[0])}>
                <td>
                  <div className="uni-cell">
                    <span className="uni-logo">
                      {u[0]
                        .split(" ")
                        .map((x) => x[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <b>{u[0]}</b>
                  </div>
                </td>
                <td>
                  <b>{u[1]}</b>
                  <span className="subtext">{u[2]}</span>
                </td>
                <td>
                  <span
                    className={`status-tag ${["purple", "amber", "blue", "amber", "blue", "purple"][i]}`}
                  >
                    {u[3]}
                  </span>
                </td>
                <td>
                  <span className="person">
                    <span className="avatar tiny">
                      {u[4]
                        .split(" ")
                        .map((x) => x[0])
                        .join("")}
                    </span>
                    {u[4]}
                  </span>
                </td>
                <td className="muted">{u[5]}</td>
                <td>
                  <More size={18} fill="#9ba6b5" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <span>
            Показано {list.length ? 1 : 0}–{Math.min(6, list.length)} из{" "}
            {list.length}
          </span>
          <div>
            <button>‹</button>
            <button className="selected-page">1</button>
            <button>2</button>
            <button>3</button>
            <button>4</button>
            <button>›</button>
          </div>
        </div>
      </section>
    </>
  );
}
function Workflow({cards,search,setSearch,moveCard,onSelect}) { return <><PageHeader title="Workflow"><Button icon={<SettingsAdjust size={16} fill="currentColor"/>}>Фильтры</Button><Button primary icon={<AddLarge size={16} fill="currentColor"/>}>Добавить</Button></PageHeader><div className="workflow-toolbar"><div className="search"><Search size={17} fill="currentColor"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск взаимодействий..."/></div><div className="view-switch"><button className="active">Доска</button><button>Список</button></div><span className="live"><i/> Синхронизация включена</span></div><div className="board">{stages.map(stage=><div className="board-col" key={stage.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=Number(e.dataTransfer.getData('id'));moveCard(id,stage.id)}}><div className="col-head"><span className="stage-dot" style={{background:stage.color}}/><b title={stage.label}>{stage.label}</b><span className="col-count">{cards.filter(c=>c.stage===stage.id).length}</span><More size={16} fill="currentColor"/></div><div className="card-list">{cards.filter(c=>c.stage===stage.id).map(card=><div className="work-card" key={card.id} draggable onDragStart={e=>e.dataTransfer.setData('id',card.id)} onClick={()=>onSelect(card.university)}><div className="card-top"><span className="mini-logo">{card.initials}</span><More size={16} fill="currentColor"/></div><b className="card-title">{card.university}</b><span className="card-product">{card.product} <i/> {card.direction}</span><div className="card-foot"><span className="person"><span className="avatar tiny">{card.owner.split(' ').map(x=>x[0]).join('')}</span>{card.owner}</span><span className="card-time">{card.days} дн.</span></div></div>)}</div><button className="add-card"><AddLarge size={15} fill="currentColor"/> Добавить</button></div>)}</div></> }
function Analytics() { return <><PageHeader title="Аналитика"><Button icon={<Download size={16} fill="currentColor"/>}>Скачать PNG</Button><Button primary icon={<Calendar size={16} fill="currentColor"/>}>01 янв — 15 мая 2026</Button></PageHeader><div className="analytics-grid"><section className="panel big-chart"><div className="panel-head"><div><h2>Заявки на обучение</h2><span>По всем направлениям</span></div><div className="chart-legend"><i/> 2026 <i className="gray"/> 2025</div></div><div className="line-chart"><div className="y-labels"><span>300</span><span>200</span><span>100</span><span>0</span></div><svg viewBox="0 0 700 260" preserveAspectRatio="none"><path d="M0 220 C70 190 90 210 140 170 S220 160 260 120 S330 150 370 105 S440 110 480 72 S550 80 590 42 S650 58 700 20" fill="none" stroke="#8300ff" strokeWidth="4"/><path d="M0 220 C70 215 100 220 140 195 S220 205 260 180 S330 198 370 160 S440 165 480 145 S550 155 590 122 S650 140 700 108" fill="none" stroke="#d4d4d8" strokeWidth="3" strokeDasharray="6 7"/><path d="M0 220 C70 190 90 210 140 170 S220 160 260 120 S330 150 370 105 S440 110 480 72 S550 80 590 42 S650 58 700 20 L700 260 L0 260Z" fill="url(#fade)"/><defs><linearGradient id="fade" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#8300ff" stopOpacity=".16"/><stop offset="1" stopColor="#8300ff" stopOpacity="0"/></linearGradient></defs></svg><div className="x-labels"><span>Янв</span><span>Фев</span><span>Мар</span><span>Апр</span><span>Май</span></div></div></section><section className="panel ranking"><div className="panel-head"><div><h2>Рейтинг программ</h2><span>По числу обучающихся</span></div></div>{[['Программная инженерия','1 248','#8300ff'],['Аналитика данных','986','#a64dff'],['Кибербезопасность','742','#ff4f12'],['Информационные системы','538','#ff7a45']].map((r,i)=><div className="rank" key={r[0]}><span className="rank-num">0{i+1}</span><div><b>{r[0]}</b><div className="progress"><i style={{width:`${[100,78,59,43][i]}%`,background:r[2]}}/></div></div><strong>{r[1]}</strong></div>)}</section></div><div className="kpi-grid analytics-kpis"><Kpi title="Обучающихся" value="3 514" change="+18.2%" note="к прошлому году" icon={<Education fill="currentColor"/>} tone="indigo"/><Kpi title="Параллельных потоков" value="86" change="+12" note="за текущий период" icon={<AttentionMonochrome fill="currentColor"/>} tone="teal"/><Kpi title="Средняя конверсия" value="32%" change="+4.6%" note="от заявки до пилота" icon={<StatisticsColumn fill="currentColor"/>} tone="pink"/></div></> }
function Import({step,setStep,notify}) { return <><PageHeader title="Импорт данных"><Button icon={<HelpMonochrome size={16} fill="currentColor"/>}>Инструкция</Button></PageHeader><div className="import-steps"><div className={step>=0?'current':''}><span>1</span> Загрузка файла</div><div className={step>=1?'current':''}><span>2</span> Сопоставление полей</div><div className={step>=2?'current':''}><span>3</span> Проверка</div><div className={step>=3?'current':''}><span>4</span> Результат</div></div><section className="panel import-panel">{step===0 && <><div className="upload-zone"><div className="upload-icon"><Upload size={26} fill="currentColor"/></div><h2>Перетащите файл сюда</h2><p>или выберите его на компьютере</p><Button primary onClick={()=>setStep(1)} icon={<XLSX size={16} fill="currentColor"/>}>Выбрать файл</Button><span className="file-hint">Поддерживаются XLS, XLSX · до 20 МБ</span></div><div className="import-note"><CheckSmall size={18} fill="currentColor"/><div><b>Перед началом</b><span>Убедитесь, что в первой строке файла находятся заголовки колонок.</span></div></div></>}{step===1 && <ImportMapping next={()=>setStep(2)}/>} {step===2 && <ImportCheck next={()=>setStep(3)}/>} {step===3 && <div className="result-state"><div className="success-icon"><CheckLarge size={32} fill="currentColor"/></div><h2>Импорт завершён</h2><p>Данные успешно добавлены в систему.</p><div className="result-numbers"><div><b>124</b><span>добавлено</span></div><div><b>3</b><span>пропущено</span></div><div><b>0</b><span>ошибок</span></div></div><Button primary onClick={()=>{setStep(0);notify('Импорт завершён успешно')}}>Вернуться к импортам</Button></div>}</section></> }
function ImportMapping({next}) { return <><div className="import-title"><div><h2>Сопоставление полей</h2><p>Проверьте, как колонки файла будут импортированы в систему.</p></div><span className="file-pill"><XLSX size={16} fill="currentColor"/> universities_may.xlsx</span></div><div className="mapping">{[['Название вуза','Название ВУЗа'],['ИТ-продукт','Продукт'],['ИТ-направление','Направление'],['Номер договора','Договор №'],['Ответственный менеджер','Менеджер']].map((x,i)=><div key={x[0]}><b>{x[0]}</b><ArrowRight size={16} fill="currentColor"/><select defaultValue={x[1]}><option>{x[1]}</option><option>Не импортировать</option></select><CheckSmall size={17} fill="#059669"/></div>)}</div><div className="import-footer"><span>Сопоставлено 5 из 5 полей</span><Button primary onClick={next}>Продолжить <ArrowRight size={16} fill="currentColor"/></Button></div></>}
function ImportCheck({next}) { return <div className="check-state"><div className="check-header"><div className="success-icon small"><CheckLarge size={20} fill="currentColor"/></div><div><h2>Файл готов к импорту</h2><p>Проверка завершена без критических ошибок.</p></div></div><div className="validation"><div><b>124</b><span>строки проверены</span></div><div><b className="green">121</b><span>готовы к импорту</span></div><div><b className="amber-text">3</b><span>с предупреждениями</span></div></div><Button primary onClick={next}>Импортировать данные <Upload size={16} fill="currentColor"/></Button></div>}
function Reports({notify}) { return <><PageHeader title="Отчёты"><Button primary onClick={()=>notify('Конструктор отчёта открыт')} icon={<AddLarge size={16} fill="currentColor"/>}>Создать отчёт</Button></PageHeader><div className="report-cards"><div className="report-card"><Table size={24} fill="currentColor"/><div><b>Реестр взаимодействий</b><span>Вузы, статусы, ответственные</span></div><Button onClick={()=>notify('Отчёт скачивается')} icon={<Download size={15} fill="currentColor"/>}>XLSX</Button></div><div className="report-card"><BarChart3 size={24}/><div><b>Статистика по программам</b><span>Обучающиеся и заявки за период</span></div><Button onClick={()=>notify('Отчёт скачивается')} icon={<Download size={15} fill="currentColor"/>}>PDF</Button></div></div><section className="panel table-panel"><div className="panel-head"><div><h2>История отчётов</h2><span>Последние сформированные документы</span></div></div><table><thead><tr><th>НАЗВАНИЕ</th><th>АВТОР</th><th>ДАТА СОЗДАНИЯ</th><th>ФОРМАТ</th><th>СТАТУС</th></tr></thead><tbody>{[['Реестр вузов — май 2026','Алексей Козлов','Сегодня, 10:24','XLSX'],['Отчёт по конверсии Q1','Елена Ким','14.05.2026','PDF'],['Программы обучения — регионы','Михаил Орлов','12.05.2026','XLSX']].map(r=><tr key={r[0]}><td><b>{r[0]}</b></td><td>{r[1]}</td><td className="muted">{r[2]}</td><td><span className="file-type">{r[3]}</span></td><td><span className="status-tag green">Готов</span></td></tr>)}</tbody></table></section></>}
function Catalogs() { return <><PageHeader title="Каталоги"/><div className="catalog-grid">{[['ИТ-продукты','12 записей',<Catalog fill="currentColor"/>,'МойОфис, Р7-Офис, Контур'],['ИТ-направления','8 записей',<Education fill="currentColor"/>,'Программная инженерия, Аналитика данных'],['Ответственные','16 записей',<Users fill="currentColor"/>,'Команда KAM и представители вузов']].map(x=><div className="catalog-card" key={x[0]}>{x[2]}<span>{x[1]}</span><h2>{x[0]}</h2><p>{x[3]}</p><ArrowRight size={18} fill="currentColor"/></div>)}</div></>}
function Admin({page,notify}) { return <><PageHeader title={page==='users'?'Пользователи':'Настройки системы'}><Button primary onClick={()=>notify('Форма добавления открыта')} icon={<AddLarge size={16} fill="currentColor"/>}>{page==='users'?'Добавить пользователя':'Добавить интеграцию'}</Button></PageHeader><section className="panel table-panel"><div className="table-meta"><span><b>{page==='users'?'Команда проекта':'Подключения'}</b></span><Button icon={<SettingsAdjust size={15} fill="currentColor"/>}>Фильтры</Button></div>{page==='users'?<table><thead><tr><th>ПОЛЬЗОВАТЕЛЬ</th><th>РОЛЬ</th><th>СТАТУС</th><th>ПОСЛЕДНИЙ ВХОД</th><th></th></tr></thead><tbody>{[['Алексей Козлов','alexey@rtk.ru','Администратор','Сегодня, 09:42'],['Алина Воронова','alina@rtk.ru','Пользователь','Сегодня, 09:18'],['Михаил Орлов','mikhail@rtk.ru','Пользователь','Вчера, 18:05'],['Елена Ким','elena@rtk.ru','Руководитель','Вчера, 17:44']].map(u=><tr key={u[0]}><td><span className="person"><span className="avatar tiny">{u[0].split(' ').map(x=>x[0]).join('')}</span><span><b>{u[0]}</b><small>{u[1]}</small></span></span></td><td><span className="status-tag purple">{u[2]}</span></td><td><span className="status-tag green">Активен</span></td><td className="muted">{u[3]}</td><td><More size={18} fill="currentColor"/></td></tr>)}</tbody></table>:<div className="settings-list">{[['LMS Ростелекома','Данные обучения синхронизируются каждые 4 часа','Подключено'],['Сайт ИТ Школы','Импорт заявок с публичного сайта','Подключено'],['Уведомления','Email-уведомления о смене статуса и SLA','Включены']].map(x=><div className="setting-row"><div><b>{x[0]}</b><span>{x[1]}</span></div><span className="status-tag green">{x[2]}</span><button className="icon-button"><Settings size={17} fill="currentColor"/></button></div>)}</div>}</section></>}
function UniversityModal({university,close,notify}) { return <Dialog.Root open={Boolean(university)} onOpenChange={(open)=>!open&&close()}><Dialog.Portal><Dialog.Backdrop className="modal-backdrop"/><Dialog.Viewport className="modal-viewport"><Dialog.Popup className="modal"><Dialog.Close className="modal-close" aria-label="Закрыть"><CloseSmall size={18} fill="currentColor"/></Dialog.Close><div className="modal-heading"><span className="uni-logo large">{university.split(' ').map(x=>x[0]).join('').slice(0,2)}</span><div><Dialog.Title asChild><h2>{university}</h2></Dialog.Title><Dialog.Description className="muted">Последнее обновление сегодня в 10:24</Dialog.Description></div></div><div className="modal-stats"><div><span>Активных взаимодействий</span><b>4</b></div><div><span>Текущая конверсия</span><b>42%</b></div><div><span>Менеджер</span><b>Алина Воронова</b></div></div><h3>Текущие взаимодействия</h3>{[['МойОфис','Информационные системы','Подписание документов'],['Р7-Офис','Программная инженерия','Обмен документами'],['Контур','Аналитика данных','Контроль исполнения']].map(x=><div className="modal-interaction" key={x[0]}><div><b>{x[0]}</b><span>{x[1]}</span></div><span className="status-tag blue">{x[2]}</span><ArrowRight size={17} fill="currentColor"/></div>)}<div className="modal-footer"><Dialog.Close render={<Button />}>Закрыть</Dialog.Close><Button primary onClick={()=>notify('Изменения сохранены')}>Редактировать вуз</Button></div></Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root> }

createRoot(document.getElementById('root')).render(<App />);
