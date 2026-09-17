import { useMemo, useState } from 'react';
import { Link } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { formatDate, formatDays, formatFileSize, formatRelativeDateTime } from '../../domain/format.js';
import { PERMISSION } from '../../domain/roles.js';
import { getStage, getStageIndex, SLA_STATE } from '../../domain/workflow.js';
import { useCatalogIndex, useVisibleInteractionRows } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { Person } from '../../ui/Avatar.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { Button } from '../../ui/Button.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { AttachmentIcon, DocumentIcon, MailIcon, PhoneIcon, UsersIcon, WorkflowIcon } from '../../ui/icons.js';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import { ErrorPage } from '../errors/ErrorPage.jsx';
import { AssignManagerDialog } from './AssignManagerDialog.jsx';
import { CommentComposer } from './components/CommentComposer.jsx';
import { ContractDetails } from './components/ContractDetails.jsx';
import { EventFeed } from './components/EventFeed.jsx';
import { SlaBadge } from './components/SlaBadge.jsx';
import { StageStepper } from './components/StageStepper.jsx';
import { TransitionDialog } from './TransitionDialog.jsx';
import styles from './InteractionPage.module.css';

const SOURCE_LABEL = { manual: 'Создано вручную', site: 'Заявка с сайта', lms: 'Данные из LMS' };

export function InteractionPage({ params }) {
  const rows = useVisibleInteractionRows();
  const row = rows.find((item) => item.id === params.id);
  // Нет в видимых — либо не существует, либо нет прав: не раскрываем, какой из случаев.
  if (!row) return <ErrorPage code="NOT-FOUND-404" />;
  return <InteractionView key={row.id} row={row} />;
}

function InteractionView({ row }) {
  const { events } = useStoreState();
  const index = useCatalogIndex();
  const session = useSession();
  const [tab, setTab] = useState('history');
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const ownEvents = useMemo(
    () => events.filter((event) => event.interactionId === row.id).sort((a, b) => b.at.localeCompare(a.at)),
    [events, row.id],
  );
  const filesByStage = useMemo(() => groupFilesByStage(ownEvents, row.workflow), [ownEvents, row.workflow]);
  const fileCount = filesByStage.reduce((sum, group) => sum + group.files.length, 0);

  const { university, stage, sla, progress } = row;
  const contacts = university.contacts.filter((contact) => row.contactIds.includes(contact.id));
  const shownContacts = contacts.length > 0 ? contacts : university.contacts;

  return (
    <>
      <PageHeader
        back={{ to: '/interactions', label: 'Все взаимодействия' }}
        title={university.name}
        meta={
          <>
            <Badge tone="brand">{row.direction.name}</Badge>
            <Badge>{row.product.name}</Badge>
            <SlaBadge sla={sla} />
          </>
        }
        actions={
          !row.completedAt && (
            <Button variant="primary" icon={WorkflowIcon} onClick={() => setTransitionOpen(true)}>
              Сменить этап
            </Button>
          )
        }
      />

      <div className={styles.layout}>
        <div className={styles.main}>
          <Card className={styles.current}>
            <p className={styles.eyebrow}>
              {row.completedAt ? 'Взаимодействие завершено' : `Текущий этап · ${progress.step} из ${progress.total}`}
            </p>
            <h2 className={styles.stageName}>{stage.name}</h2>
            {!row.completedAt && stage.hint && <p className={styles.stageHint}>{stage.hint}</p>}
            <div className={styles.progressTrack} aria-hidden="true">
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            <dl className={styles.facts}>
              <div>
                <dt>На этапе с</dt>
                <dd>{formatDate(row.stageEnteredAt)}</dd>
              </div>
              <div>
                <dt>Срок этапа</dt>
                <dd>
                  {sla.deadline ? formatDate(sla.deadline) : '—'}
                  <span className={styles.factNote}> · норматив {formatDays(stage.slaDays)}</span>
                </dd>
              </div>
              <div>
                <dt>Осталось</dt>
                <dd className={sla.state === SLA_STATE.overdue ? styles.overdue : undefined}>
                  {sla.daysLeft === null ? '—' : sla.daysLeft < 0 ? `Просрочено на ${formatDays(-sla.daysLeft)}` : formatDays(sla.daysLeft)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <Tabs
              label="Разделы взаимодействия"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'history', label: 'История', count: ownEvents.length },
                { value: 'files', label: 'Файлы', count: fileCount },
                { value: 'contract', label: 'Данные договора' },
              ]}
            />
            <div className={styles.tabPanel} role="tabpanel">
              {tab === 'history' && (
                <div className={styles.history}>
                  {!row.completedAt && <CommentComposer row={row} />}
                  <EventFeed items={ownEvents.map((event) => ({ event, row }))} users={index.users} />
                </div>
              )}
              {tab === 'files' && <FilesByStage groups={filesByStage} users={index.users} />}
              {tab === 'contract' && <ContractDetails row={row} />}
            </div>
          </Card>
        </div>

        <aside className={styles.aside}>
          <Card>
            <CardHeader
              title="Ответственные"
              actions={
                session.can(PERMISSION.assignManager) && (
                  <Button variant="ghost" size="s" onClick={() => setAssignOpen(true)}>
                    Сменить
                  </Button>
                )
              }
            />
            <div className={styles.people}>
              <div className={styles.personBlock}>
                <p className={styles.personRole}>От ИТ Школы</p>
                {row.manager ? <Person name={row.manager.name} caption={row.manager.email} size="m" /> : <p>Не назначен</p>}
              </div>
              <div className={styles.personBlock}>
                <p className={styles.personRole}>От вуза</p>
                {shownContacts.length === 0 ? (
                  <p className={styles.muted}>
                    Контакты не добавлены. <Link to={`/universities/${university.id}`}>Открыть карточку вуза</Link>
                  </p>
                ) : (
                  shownContacts.map((contact) => (
                    <div key={contact.id} className={styles.contact}>
                      <Person name={contact.name} caption={contact.position} size="m" />
                      <div className={styles.contactLinks}>
                        <a href={`mailto:${contact.email}`}>
                          <MailIcon size={16} fill="currentColor" />
                          {contact.email}
                        </a>
                        <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>
                          <PhoneIcon size={16} fill="currentColor" />
                          {contact.phone}
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Путь взаимодействия" description={row.workflow.name} />
            <StageStepper row={row} events={events} />
          </Card>

          <Card padding="s" className={styles.meta}>
            <p>
              <span className={styles.muted}>Источник:</span> {SOURCE_LABEL[row.source]}
            </p>
            <p>
              <span className={styles.muted}>Начато:</span> {formatDate(row.startedAt)}
            </p>
            <p>
              <Link to={`/universities/${university.id}`}>
                <UsersIcon size={16} fill="currentColor" /> Все взаимодействия с вузом
              </Link>
            </p>
          </Card>
        </aside>
      </div>

      {transitionOpen && <TransitionDialog key={`${row.id}:${row.stageId}`} row={row} open onOpenChange={setTransitionOpen} />}
      {assignOpen && <AssignManagerDialog row={row} open onOpenChange={setAssignOpen} />}
    </>
  );
}

function groupFilesByStage(events, workflow) {
  const groups = new Map();
  events
    .filter((event) => event.files?.length)
    .forEach((event) => {
      const list = groups.get(event.stageId) ?? [];
      event.files.forEach((file) => list.push({ ...file, at: event.at, userId: event.userId }));
      groups.set(event.stageId, list);
    });
  return [...groups.entries()]
    .map(([stageId, files]) => ({ stage: getStage(workflow, stageId), files }))
    .filter((group) => group.stage)
    .sort((a, b) => getStageIndex(workflow, a.stage.id) - getStageIndex(workflow, b.stage.id));
}

function FilesByStage({ groups, users }) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={AttachmentIcon}
        title="Файлов пока нет"
        description="Прикладывайте договоры, протоколы и материалы при смене этапа или в комментарии."
      />
    );
  }
  return (
    <div className={styles.fileGroups}>
      {groups.map(({ stage, files }) => (
        <section key={stage.id}>
          <h3 className={styles.fileGroupTitle}>{stage.name}</h3>
          <ul className={styles.fileList}>
            {files.map((file) => (
              <li key={`${file.name}-${file.at}`} className={styles.fileRow}>
                <DocumentIcon size={24} fill="currentColor" className={styles.fileIcon} />
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.muted}>{formatFileSize(file.size)}</span>
                <span className={styles.muted}>
                  {users.get(file.userId)?.name} · {formatRelativeDateTime(file.at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
