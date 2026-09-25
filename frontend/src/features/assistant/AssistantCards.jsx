import { useState } from 'react';
import { Link, useRouter } from '../../app/router.jsx';
import { formatNumber, formatRelativeDateTime, plural } from '../../domain/format.js';
import { REPORT_FORMATS } from '../../domain/reports.js';
import { getStage, requiresComment } from '../../domain/workflow.js';
import { writePersistentState } from '../../lib/usePersistentState.js';
import { useCatalogIndex, useVisibleInteractionRows } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { Button } from '../../ui/Button.jsx';
import { TextAreaField } from '../../ui/Field.jsx';
import { ArrowRightIcon, CheckIcon, DownloadIcon, HelpIcon, MagicIcon, MailIcon, PhoneIcon, ReportIcon, UniversityIcon, UsersIcon } from '../../ui/icons.js';
import { SegmentedControl } from '../../ui/SegmentedControl.jsx';
import { SlaBadge } from '../interactions/components/SlaBadge.jsx';
import { rowLabel } from './engine/execute.js';
import styles from './Assistant.module.css';

/**
 * Карточки результатов в чате. Хранят только данные (их можно сохранить в историю),
 * а строки взаимодействий берут актуальные — после перевода этапа карточка показывает новый этап.
 */

const rowsWord = (count) => `${formatNumber(count)} ${plural(count, ['строка', 'строки', 'строк'])}`;

function CardShell({ icon: Icon, title, meta, children }) {
  return (
    <div className={styles.card}>
      {(title || meta) && (
        <div className={styles.cardHeader}>
          {Icon && <span className={styles.cardIcon}><Icon size={20} fill="currentColor" /></span>}
          <div className={styles.cardHeading}>
            {title && <p className={styles.cardTitle}>{title}</p>}
            {meta && <p className={styles.cardMeta}>{meta}</p>}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

const Status = ({ tone = 'success', children }) => (
  <p className={tone === 'error' ? styles.cardError : styles.cardSuccess} role={tone === 'error' ? 'alert' : 'status'}>
    {tone !== 'error' && <CheckIcon size={16} fill="currentColor" />}
    {children}
  </p>
);

function ReportCard({ id, card, actions }) {
  const { navigate } = useRouter();
  const [format, setFormat] = useState(card.spec.format);
  const [busy, setBusy] = useState(false);
  const formatLabel = REPORT_FORMATS.find((item) => item.id === format).label;

  const download = async () => {
    setBusy(true);
    await actions.downloadReport(id, card, format);
    setBusy(false);
  };

  const openInBuilder = () => {
    writePersistentState('filters:reports', card.spec.filters);
    writePersistentState('reports:columns', card.spec.columns);
    writePersistentState('reports:format', format);
    navigate('/reports');
  };

  return (
    <CardShell icon={ReportIcon} title={card.spec.name} meta={`${card.spec.summary} · ${rowsWord(card.rowCount)} · колонок: ${card.spec.columns.length}`}>
      <SegmentedControl label="Формат файла" value={format} onChange={setFormat} options={REPORT_FORMATS.map((item) => ({ value: item.id, label: item.label }))} className={styles.formats} />
      <div className={styles.cardActionsStacked}>
        <Button variant="primary" size="l" icon={DownloadIcon} onClick={download} disabled={busy} className={styles.mainAction}>
          {busy ? 'Формируем файл…' : `Скачать ${formatLabel}`}
        </Button>
        <Button variant="ghost" size="s" onClick={openInBuilder}>Открыть в конструкторе</Button>
      </div>
      {card.downloadedAt && <Status>Скачано {formatRelativeDateTime(card.downloadedAt)}. Отчёт добавлен в историю.</Status>}
      {card.error && <Status tone="error">{card.error}</Status>}
    </CardShell>
  );
}

function InteractionsCard({ card }) {
  const { navigate } = useRouter();
  const rows = useVisibleInteractionRows();
  const shown = card.ids.map((rowId) => rows.find((row) => row.id === rowId)).filter(Boolean);

  const showAll = () => {
    writePersistentState('filters:interactions', card.filters);
    navigate('/interactions');
  };

  return (
    <CardShell>
      <ul className={styles.rows}>
        {shown.map((row) => (
          <li key={row.id}>
            <Link to={`/interactions/${row.id}`} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{rowLabel(row)}</span>
                <span className={styles.rowMeta}>{row.stage.name} · {row.manager?.name ?? 'без ответственного'}</span>
              </span>
              <SlaBadge sla={row.sla} compact />
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.cardActions}>
        <Button variant="ghost" size="s" iconAfter={ArrowRightIcon} onClick={showAll}>
          {card.total > shown.length ? `Все ${card.total} в разделе «Взаимодействия»` : 'Открыть в разделе «Взаимодействия»'}
        </Button>
      </div>
    </CardShell>
  );
}

function StatsCard({ card }) {
  const { navigate } = useRouter();
  const { stats } = card;
  const maxPhase = Math.max(1, ...stats.phases.map((phase) => phase.count));
  const tiles = [
    { label: 'Всего', value: stats.total },
    { label: 'В работе', value: stats.active },
    { label: 'Просрочено', value: stats.overdue, tone: stats.overdue ? 'warning' : undefined },
    { label: 'Скоро срок', value: stats.soon },
  ];

  const openAnalytics = () => {
    writePersistentState('filters:analytics', card.filters);
    navigate('/analytics');
  };

  return (
    <CardShell meta={card.summary}>
      <dl className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} className={tile.tone === 'warning' ? styles.tileWarning : styles.tile}>
            <dt>{tile.label}</dt>
            <dd>{formatNumber(tile.value)}</dd>
          </div>
        ))}
      </dl>
      <ul className={styles.bars} aria-label="В работе по фазам">
        {stats.phases.map((phase) => (
          <li key={phase.label} className={styles.bar}>
            <span className={styles.barLabel}>{phase.label}</span>
            <span className={styles.barTrack} aria-hidden="true"><span className={styles.barFill} style={{ width: `${(phase.count / maxPhase) * 100}%` }} /></span>
            <span className={styles.barValue}>{phase.count}</span>
          </li>
        ))}
      </ul>
      {stats.topStages.length > 0 && (
        <p className={styles.cardMeta}>Больше всего на этапах: {stats.topStages.map((stage) => `${stage.label} (${stage.count})`).join(', ')}.</p>
      )}
      <div className={styles.cardActions}>
        <Button variant="ghost" size="s" iconAfter={ArrowRightIcon} onClick={openAnalytics}>Открыть аналитику</Button>
      </div>
    </CardShell>
  );
}

/** Подтверждение изменения данных: перевод этапа или комментарий. После выполнения — «Отменить». */
function ChangeCard({ id, card, actions }) {
  const rows = useVisibleInteractionRows();
  const row = rows.find((item) => item.id === card.interactionId);
  const isComment = card.kind === 'comment';
  const [text, setText] = useState(isComment ? card.text : card.comment);

  if (!row) return <CardShell><Status tone="error">Взаимодействие больше недоступно.</Status></CardShell>;

  const fromStage = getStage(row.workflow, card.expectedStageId ?? row.stageId);
  const toStage = card.toStageId ? getStage(row.workflow, card.toStageId) : null;
  const commentRequired = !isComment && !card.complete && requiresComment(card.transitionKind);
  const canSubmit = isComment ? text.trim().length > 0 : !commentRequired || text.trim().length > 0;
  const pending = card.status === 'pending' || card.status === 'working';

  const title = isComment ? 'Новый комментарий' : card.complete ? 'Завершение взаимодействия' : 'Смена этапа';
  const confirmLabel = isComment ? 'Добавить' : card.complete ? 'Завершить' : 'Перевести';
  const submit = () => actions.commitCard(id, isComment ? { ...card, text: text.trim() } : { ...card, comment: text.trim() });

  return (
    <CardShell title={title} meta={rowLabel(row)}>
      {!isComment && (
        <p className={styles.transition}>
          <span>{fromStage?.name}</span>
          <ArrowRightIcon size={16} fill="currentColor" aria-hidden="true" />
          <strong>{card.complete ? 'Завершено' : toStage?.name}</strong>
        </p>
      )}
      {pending ? (
        <>
          <TextAreaField
            label={isComment ? 'Текст комментария' : commentRequired ? 'Комментарий (обязательно)' : 'Комментарий (по желанию)'}
            rows={2}
            value={text}
            maxLength={2000}
            onChange={(event) => setText(event.target.value)}
            disabled={card.status === 'working'}
          />
          <div className={styles.cardActions}>
            <Button variant="primary" size="s" onClick={submit} disabled={!canSubmit || card.status === 'working'}>
              {card.status === 'working' ? 'Сохраняем…' : confirmLabel}
            </Button>
            <Button variant="ghost" size="s" onClick={() => actions.cancelCard(id)} disabled={card.status === 'working'}>Отмена</Button>
          </div>
        </>
      ) : (
        <>
          {card.status === 'done' && <Status>{isComment ? 'Комментарий добавлен.' : card.complete ? 'Взаимодействие завершено.' : 'Этап изменён.'}</Status>}
          {card.status === 'cancelled' && <p className={styles.cardMeta}>Отменено — ничего не изменилось.</p>}
          {card.status === 'undone' && <p className={styles.cardMeta}>Изменение отменено.</p>}
          <div className={styles.cardActions}>
            {card.status === 'done' && actions.canUndo(id) && <Button variant="outline" size="s" onClick={() => actions.undoCard(id)}>Отменить</Button>}
            <Link to={`/interactions/${row.id}`} className={styles.cardLink}>Открыть карточку</Link>
          </div>
        </>
      )}
      {card.error && <Status tone="error">{card.error}</Status>}
    </CardShell>
  );
}

function GuideCard({ card, onRun, onSend }) {
  const { action } = card;
  return (
    <CardShell icon={HelpIcon} title={card.title}>
      {card.steps.length > 0 && (
        <ol className={styles.steps}>
          {card.steps.map((step) => <li key={step}>{step.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part))}</li>)}
        </ol>
      )}
      <div className={styles.cardActionsStacked}>
        {action && (
          <Button variant="primary" size="l" icon={MagicIcon} className={styles.mainAction} onClick={() => (action.call ? onRun(action.call, `Выполни: ${action.request ?? action.label}`) : onSend(action.prompt))}>
            {action.label}
          </Button>
        )}
        {card.link && <Link to={card.link} className={styles.cardLink}>Подробнее в справке</Link>}
      </div>
    </CardShell>
  );
}

function ChoiceCard({ card, onRun }) {
  return (
    <div className={styles.choices}>
      {card.options.map((option) => (
        <button key={option.label} type="button" className={styles.choice} onClick={() => onRun(option.call, option.label)}>
          <span className={styles.rowTitle}>{option.label}</span>
          {option.description && <span className={styles.rowMeta}>{option.description}</span>}
        </button>
      ))}
    </div>
  );
}

const EVENT_LABEL = { created: 'Создано', transition: 'Смена этапа', comment: 'Комментарий', completed: 'Завершено' };

/** Сводка по взаимодействию: этап и прогресс, срок, ответственный, последние события и следующий шаг. */
function DetailsCard({ card }) {
  const rows = useVisibleInteractionRows();
  const { events } = useStoreState();
  const index = useCatalogIndex();
  const row = rows.find((item) => item.id === card.interactionId);
  if (!row) return <CardShell><Status tone="error">Взаимодействие больше недоступно.</Status></CardShell>;

  const next = row.workflow.stages[row.progress.step];
  const recent = events.filter((event) => event.interactionId === row.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  return (
    <CardShell icon={UniversityIcon} title={rowLabel(row)} meta={`${row.program?.name ?? '—'} · ${row.product.name}`}>
      <div className={styles.detailsStage}>
        <div className={styles.detailsStageHead}>
          <span>Этап {row.progress.step} из {row.progress.total}: <strong>{row.stage.name}</strong></span>
          <SlaBadge sla={row.sla} compact />
        </div>
        <span className={styles.barTrack} aria-hidden="true"><span className={styles.barFill} style={{ width: `${row.progress.percent}%` }} /></span>
      </div>
      <dl className={styles.facts}>
        <div><dt>Ответственный</dt><dd>{row.manager?.name ?? 'не назначен'}</dd></div>
        <div><dt>Договор</dt><dd>{row.contract.number || 'нет номера'}</dd></div>
        {next && <div><dt>Следующий этап</dt><dd>{next.name}</dd></div>}
      </dl>
      {row.stage.hint && <p className={styles.cardMeta}>Что сделать сейчас: {row.stage.hint}</p>}
      {recent.length > 0 && (
        <ul className={styles.timeline} aria-label="Последние события">
          {recent.map((event) => (
            <li key={event.id}>
              <span className={styles.rowTitle}>{EVENT_LABEL[event.type] ?? 'Событие'}</span>
              <span className={styles.rowMeta}> · {formatRelativeDateTime(event.at)} · {index.users.get(event.userId)?.name ?? '—'}</span>
              {event.comment && <p className={styles.timelineText}>{event.comment}</p>}
            </li>
          ))}
        </ul>
      )}
      <Link to={`/interactions/${row.id}`} className={styles.cardLink}>Открыть карточку взаимодействия</Link>
    </CardShell>
  );
}

function ContactsCard({ card }) {
  const index = useCatalogIndex();
  const universities = card.universityIds.map((id) => index.universities.get(id)).filter(Boolean);
  return (
    <CardShell icon={UsersIcon} title="Контакты в вузе">
      {universities.map((university) => (
        <section key={university.id} className={styles.contacts}>
          <p className={styles.rowTitle}>{university.name}</p>
          {(university.contacts ?? []).map((contact) => (
            <div key={contact.id} className={styles.contact}>
              <span className={styles.rowTitle}>{contact.name}</span>
              {contact.position && <span className={styles.rowMeta}>{contact.position}</span>}
              <span className={styles.contactLinks}>
                {contact.email && <a href={`mailto:${contact.email}`} className={styles.cardLink}><MailIcon size={16} fill="currentColor" aria-hidden="true" /> {contact.email}</a>}
                {contact.phone && <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className={styles.cardLink}><PhoneIcon size={16} fill="currentColor" aria-hidden="true" /> {contact.phone}</a>}
              </span>
            </div>
          ))}
        </section>
      ))}
    </CardShell>
  );
}

function WorkloadCard({ card }) {
  const max = Math.max(1, ...card.items.map((item) => item.active));
  return (
    <CardShell icon={UsersIcon} title="Нагрузка по ответственным" meta="Активные взаимодействия; оранжевым — просроченные">
      <ul className={styles.bars}>
        {card.items.map((item) => (
          <li key={item.name} className={styles.workloadBar}>
            <span className={styles.barLabel}>{item.name}</span>
            <span className={styles.barTrack} aria-hidden="true">
              <span className={styles.barFill} style={{ width: `${(item.active / max) * 100}%` }} />
              {item.overdue > 0 && <span className={styles.barOverdue} style={{ width: `${(item.overdue / max) * 100}%` }} />}
            </span>
            <span className={styles.barValue}>{item.active}{item.overdue > 0 && <span className={styles.overdueCount}> · {item.overdue}</span>}</span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

export function AssistantCard({ message, actions, onRun, onSend }) {
  const { card, id } = message;
  switch (card.kind) {
    case 'report': return <ReportCard id={id} card={card} actions={actions} />;
    case 'interactions': return <InteractionsCard card={card} />;
    case 'stats': return <StatsCard card={card} />;
    case 'transition':
    case 'comment': return <ChangeCard id={id} card={card} actions={actions} />;
    case 'guide': return <GuideCard card={card} onRun={onRun} onSend={onSend} />;
    case 'choice': return <ChoiceCard card={card} onRun={onRun} />;
    case 'details': return <DetailsCard card={card} />;
    case 'contacts': return <ContactsCard card={card} />;
    case 'workload': return <WorkloadCard card={card} />;
    default: return null;
  }
}
