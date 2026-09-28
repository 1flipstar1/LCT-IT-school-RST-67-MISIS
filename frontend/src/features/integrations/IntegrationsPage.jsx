import { useEffect, useState } from 'react';
import { Link } from '../../app/router.jsx';
import { apiClient } from '../../api/client.js';
import { useSession } from '../../auth/SessionProvider.jsx';
import { ERROR_CODES } from '../../domain/errors.js';
import { formatRelativeDateTime } from '../../domain/format.js';
import { ROLE } from '../../domain/roles.js';
import { useCatalogIndex } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { Badge } from '../../ui/Badge.jsx';
import { Button } from '../../ui/Button.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { Hint } from '../../ui/Hint.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { AddIcon, ErrorIcon, LinkIcon, SuccessIcon, SyncIcon } from '../../ui/icons.js';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { TelegramBotCard } from './TelegramBotCard.jsx';
import styles from './IntegrationsPage.module.css';

const SOURCE_LABEL = { lms: 'LMS', site: 'Сайт' };

export function IntegrationsPage() {
  const { role } = useSession();
  const { integrations, inbox } = useStoreState();
  const [tab, setTab] = useState('new');
  const [sourceModes, setSourceModes] = useState(null);
  const newItems = inbox.filter((item) => item.status === 'new');
  const resolvedItems = inbox.filter((item) => item.status !== 'new');

  useEffect(() => {
    let active = true;
    apiClient.getIntegrationSources()
      .then((result) => { if (active) setSourceModes(result.sources); })
      .catch(() => { if (active) setSourceModes({}); });
    return () => { active = false; };
  }, []);

  const visibleLog = sourceModes
    ? integrations.log.filter((entry) => sourceModes[entry.sourceId] === 'demo'
      ? entry.mode === 'demo'
      : sourceModes[entry.sourceId] === 'live' && entry.mode !== 'demo')
    : [];

  return (
    <>
      <PageHeader
        title="Интеграции" hint="Здесь можно проверить обмен с LMS и сайтом ИТ Школы. Демонстрационные источники загружают тестовые записи; реальные API подключаются отдельно."
      />

      <section className={styles.sources} aria-label="Источники данных" data-tour="integration-sources">
        {integrations.sources.map((source) => (
          <SourceCard key={source.id} source={source} mode={sourceModes?.[source.id]} log={visibleLog} />
        ))}
        <TelegramBotCard canConnect={role === ROLE.lead || role === ROLE.admin} />
      </section>

      <Card className={styles.inbox} data-tour="integration-inbox">
        <CardHeader title="Входящие записи" hint="Данные из LMS и с сайта ИТ Школы, которые ещё не привязаны к работе с вузом. Добавьте запись к существующему взаимодействию или создайте новое." description="Всё, что пришло из внешних систем и ещё не привязано к работе с вузом." />
        <Tabs
          label="Входящие записи"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'new', label: 'Нужно разобрать', count: newItems.length },
            { value: 'resolved', label: 'Разобранные', count: resolvedItems.length },
          ]}
        />
        <div className={styles.inboxList}>
          {(tab === 'new' ? newItems : resolvedItems).map((item) => (
            <InboxItem key={item.id} item={item} />
          ))}
          {tab === 'new' && newItems.length === 0 && <EmptyState icon={SuccessIcon} title="Всё разобрано" description="Новые записи появятся после следующей синхронизации." />}
        </div>
      </Card>

      <Card padding="none">
        <CardHeader title="Журнал синхронизаций" hint="Показывает результаты реального обмена и демонстрационных загрузок с явной отметкой режима." description="Последние загрузки данных из источников." />
        <SyncLog log={visibleLog} sources={integrations.sources} />
      </Card>
    </>
  );
}

function SourceCard({ source, mode, log }) {
  const actions = useActions();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const demo = mode === 'demo';
  const failed = mode === 'live' && source.lastStatus === 'failed';
  const lastDemoSync = demo ? log.find((entry) => entry.sourceId === source.id)?.at : null;

  const sync = async () => {
    setSyncing(true);
    try {
      const entry = await actions.syncIntegration(source.id);
      if (entry.status === 'success') toast.success(demo && entry.records === 0
        ? `${source.name}: демо-запись уже загружена`
        : `${source.name}: получено записей — ${entry.records}`);
      else toast.error('Синхронизация не удалась', { code: entry.errorCode });
    } catch (error) {
      toast.error('Синхронизация не удалась', { code: error.code });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <div className={styles.sourceHead}>
        <div>
          <Hint text="Внешняя система: передаёт данные в CRM по API в формате JSON. Здесь видно, когда был последний обмен и всё ли прошло успешно.">
            <h2 className={styles.sourceName}>{source.name}</h2>
          </Hint>
          <p className={styles.sourceDescription}>{source.description}</p>
        </div>
        {demo ? (
          <Badge tone="brand" icon={SuccessIcon}>Демо подключено</Badge>
        ) : failed ? (
          <Badge tone="warning" icon={ErrorIcon}>
            Ошибка
          </Badge>
        ) : mode === 'live' && source.lastStatus === 'success' ? (
          <Badge tone="success" icon={SuccessIcon}>
            Работает
          </Badge>
        ) : (
          <Badge tone="warning">{mode === 'unconfigured' ? 'Не настроено' : 'Проверяем'}</Badge>
        )}
      </div>
      <dl className={styles.sourceFacts}>
        <div>
          <dt>Источник</dt>
          <dd>{demo ? 'Тестовые данные внутри CRM' : mode === 'live' ? 'Внешний API' : 'Адрес API не указан'}</dd>
        </div>
        <div>
          <dt>Расписание</dt>
          <dd>{demo ? 'По нажатию' : 'Ручная синхронизация'}</dd>
        </div>
        <div>
          <dt>Последний обмен</dt>
          <dd>{demo ? (lastDemoSync ? formatRelativeDateTime(lastDemoSync) : 'Ещё не запускали') : mode === 'live' && source.lastSyncAt ? formatRelativeDateTime(source.lastSyncAt) : '—'}</dd>
        </div>
      </dl>
      {demo && <p className={styles.sourceDemo}>Демонстрационный источник: загружает тестовую запись для проверки сценария. Реальная LMS или сайт пока не подключены.</p>}
      {failed && (
        <p className={styles.sourceError}>
          {ERROR_CODES[source.lastErrorCode]?.title}. {ERROR_CODES[source.lastErrorCode]?.hint} Код: {source.lastErrorCode}
        </p>
      )}
      <Button icon={SyncIcon} onClick={sync} disabled={syncing || !mode}>
        {syncing ? 'Синхронизация…' : demo ? 'Загрузить демо-данные' : 'Синхронизировать сейчас'}
      </Button>
    </Card>
  );
}

/**
 * Ответственный за новое взаимодействие из внешней записи: менеджер, который уже ведёт этот вуз,
 * иначе сам пользователь (если он менеджер), иначе первый активный менеджер.
 */
function pickManagerId({ interactions, users }, universityId, user) {
  const existing = interactions.find((interaction) => interaction.universityId === universityId);
  if (existing) return existing.managerId;
  if (user.role === ROLE.manager) return user.id;
  return users.find((candidate) => candidate.role === ROLE.manager && candidate.active)?.id;
}

function InboxItem({ item }) {
  const state = useStoreState();
  const index = useCatalogIndex();
  const { user } = useSession();
  const actions = useActions();
  const toast = useToast();
  const [showJson, setShowJson] = useState(false);

  const { payload } = item;
  const universityName = payload.universityId ? index.universities.get(payload.universityId)?.name : payload.universityName;
  const suggested = state.interactions.find((interaction) => interaction.id === payload.suggestedInteractionId);
  const suggestedId = suggested?.id;
  const suggestedLabel = suggested ? `${index.universities.get(suggested.universityId)?.shortName} · ${index.directions.get(suggested.directionId)?.name}` : '';
  const linkedId = payload.linkedInteractionId;

  const linkToExisting = () => {
    actions.addComment({ interactionId: suggestedId, comment: `${SOURCE_LABEL[item.source]}: ${payload.message}` });
    actions.resolveInboxItem(item.id, { status: 'linked', payload: { ...payload, linkedInteractionId: suggestedId } }, 'Запись добавлена к взаимодействию');
    toast.success('Запись добавлена в историю взаимодействия');
  };

  const createNew = () => {
    const interactionId = actions.createInteraction({
      universityId: payload.universityId,
      newUniversityName: payload.universityId ? '' : payload.universityName,
      directionId: payload.directionId,
      programId: payload.programId,
      productId: payload.productId,
      workflowId: state.workflows[0].id,
      managerId: pickManagerId(state, payload.universityId, user),
      comment: payload.message,
      source: item.source,
    });
    actions.resolveInboxItem(item.id, { status: 'linked', payload: { ...payload, linkedInteractionId: interactionId } }, 'Создано взаимодействие из входящей записи');
    toast.success('Создано новое взаимодействие');
  };

  return (
    <article className={styles.item}>
      <div className={styles.itemHead}>
        <Badge tone="brand">{SOURCE_LABEL[item.source]}</Badge>
        <span className={styles.itemTime}>{formatRelativeDateTime(item.receivedAt)}</span>
      </div>
      <Hint text="Запись, пришедшая из LMS или с сайта ИТ Школы: что в ней и к какому вузу она относится.">
        <h3 className={styles.itemTitle}>{item.title}</h3>
      </Hint>
      <p className={styles.itemMessage}>{payload.message}</p>
      <dl className={styles.itemFacts}>
        <div>
          <dt>Вуз</dt>
          <dd>
            {universityName}
            {!payload.universityId && <Badge tone="warning">Нет в справочнике</Badge>}
          </dd>
        </div>
        <div>
          <dt>Направление</dt>
          <dd>{index.directions.get(payload.directionId)?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Программа</dt>
          <dd>{index.programs.get(payload.programId)?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Продукт</dt>
          <dd>{index.products.get(payload.productId)?.name ?? '—'}</dd>
        </div>
        {payload.contact && (
          <div>
            <dt>Контакт</dt>
            <dd>
              {payload.contact.name}, {payload.contact.position}
            </dd>
          </div>
        )}
      </dl>

      {showJson && <pre className={styles.json}>{JSON.stringify({ source: item.source, receivedAt: item.receivedAt, ...payload }, null, 2)}</pre>}

      <div className={styles.itemActions}>
        {item.status === 'new' ? (
          <>
            {suggestedId && (
              <Button variant="primary" icon={LinkIcon} onClick={linkToExisting}>
                Добавить к «{suggestedLabel}»
              </Button>
            )}
            <Button variant={suggestedId ? 'outline' : 'primary'} icon={AddIcon} onClick={createNew}>
              Создать новое взаимодействие
            </Button>
          </>
        ) : (
          linkedId && (
            <Link to={`/interactions/${linkedId}`} className={styles.linked}>
              <SuccessIcon size={16} fill="currentColor" /> Привязано к взаимодействию — открыть
            </Link>
          )
        )}
        <Button variant="ghost" onClick={() => setShowJson((value) => !value)}>
          {showJson ? 'Скрыть JSON' : 'Показать JSON'}
        </Button>
      </div>
    </article>
  );
}

function SyncLog({ log, sources }) {
  const sourceName = (id) => sources.find((source) => source.id === id)?.name;
  return (
    <DataTable
      caption="Журнал синхронизаций"
      rows={log.slice(0, 10)}
      columns={[
        { id: 'at', header: 'Когда', cell: (entry) => formatRelativeDateTime(entry.at) },
        { id: 'source', header: 'Источник', primary: true, cell: (entry) => sourceName(entry.sourceId) },
        {
          id: 'status',
          header: 'Результат',
          cell: (entry) =>
            entry.status === 'success' ? (
              <Badge tone="success" icon={SuccessIcon}>
                {entry.mode === 'demo' ? 'Демо · Успешно' : 'Успешно'}
              </Badge>
            ) : (
              <Badge tone="warning" icon={ErrorIcon}>
                Ошибка {entry.errorCode}
              </Badge>
            ),
        },
        { id: 'records', header: 'Записей', align: 'right', cell: (entry) => entry.records },
      ]}
    />
  );
}
