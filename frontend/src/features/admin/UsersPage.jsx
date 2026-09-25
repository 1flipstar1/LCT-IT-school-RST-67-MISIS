import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { apiClient } from '../../api/client.js';
import { useSession } from '../../auth/SessionProvider.jsx';
import { describeError } from '../../domain/errors.js';
import { DATA_SCOPE, DATA_SCOPE_LABEL, PERMISSION, ROLE, ROLE_INFO } from '../../domain/roles.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { Person } from '../../ui/Avatar.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { Button } from '../../ui/Button.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { DropdownMenu } from '../../ui/DropdownMenu.jsx';
import { Switch } from '../../ui/Field.jsx';
import { AddIcon, LinkIcon, RefreshIcon } from '../../ui/icons.js';
import { InlineAlert } from '../../ui/InlineAlert.jsx';
import { MultiSelectFilter } from '../../ui/MultiSelectFilter.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { SelectMenu } from '../../ui/SelectMenu.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { CreateAccountDialog, PasswordDialog } from './AccountDialogs.jsx';
import styles from './UsersPage.module.css';

const ROLE_OPTIONS = Object.values(ROLE).map((role) => ({ value: role, label: ROLE_INFO[role].label }));
const SCOPE_OPTIONS = Object.values(DATA_SCOPE).map((scope) => ({ value: scope, label: DATA_SCOPE_LABEL[scope] }));
const ROLE_TONE = { [ROLE.manager]: 'neutral', [ROLE.lead]: 'brand', [ROLE.admin]: 'accent' };

/**
 * Сотрудники и их доступ (ТЗ, п. 11). Администратор создаёт учётные записи любой роли, меняет роль,
 * видимость данных и блокирует доступ; руководитель заводит менеджеров своей команды и выдаёт им пароли.
 * Учётная запись живёт в Keycloak (логин, пароль, роль), карточка — в CRM; сервер меняет обе сразу.
 */
export function UsersPage() {
  const { users, directions } = useStoreState();
  const { user: currentUser, can } = useSession();
  const actions = useActions();
  const toast = useToast();
  const tableBodyRef = useRef(null);
  const isAdmin = can(PERMISSION.manageUsers);

  const [status, setStatus] = useState(null);
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState(null); // { user, password, created }
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    apiClient.getAccountsStatus().then(setStatus).catch(() => setStatus({ keycloak: false }));
  }, []);

  useLayoutEffect(() => {
    const body = tableBodyRef.current;
    if (!body || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(Array.from(body.rows), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
    }, body);
    return () => context.revert();
  }, []);

  const leads = users.filter((user) => user.role === ROLE.lead);
  // Руководитель видит себя и свою команду (так же сервер отдаёт ему данные).
  const rows = isAdmin ? users : users.filter((user) => user.id === currentUser.id || user.leadId === currentUser.id);
  const canManage = (user) => user.id !== currentUser.id && (isAdmin || (user.role === ROLE.manager && user.leadId === currentUser.id));

  /** Настройки только CRM (видимость, направления, руководитель) — через обычное сохранение состояния. */
  const updateCard = (user, patch, description) => {
    const { undo } = actions.updateUser(user.id, patch, description);
    toast.success(`${user.name}: ${description.charAt(0).toLowerCase()}${description.slice(1)}`, { undo });
  };

  /** Роль, блокировка и пароль — через сервер: меняются и в Keycloak, и в CRM. */
  const runAccount = async (user, operation, success) => {
    setPendingId(user.id);
    try {
      const result = await actions.manageAccount(operation);
      if (result.temporaryPassword) setIssued({ user, password: result.temporaryPassword, created: false });
      else toast.success(`${user.name}: ${success}`);
    } catch (error) {
      toast.error(error?.message || describeError(error).title);
    } finally {
      setPendingId(null);
    }
  };

  const columns = [
    {
      id: 'user',
      header: 'Сотрудник',
      primary: true,
      cell: (user) => <Person name={user.name} caption={user.email} size="m" />,
    },
    {
      id: 'role',
      header: 'Роль',
      cell: (user) => (isAdmin ? (
        <SelectMenu
          label={`Роль: ${user.name}`}
          value={user.role}
          options={ROLE_OPTIONS}
          disabled={user.id === currentUser.id || pendingId === user.id}
          title={user.id === currentUser.id ? 'Свою роль изменить нельзя — попросите другого администратора' : undefined}
          onChange={(role) => runAccount(user, (api) => api.setAccountRole(user.id, role), `роль изменена на «${ROLE_INFO[role].label}»`)}
        />
      ) : <Badge tone={ROLE_TONE[user.role]}>{ROLE_INFO[user.role].label}</Badge>),
    },
    {
      id: 'scope',
      header: 'Видит данные',
      cell: (user) => (isAdmin ? (
        <SelectMenu
          label={`Видимость данных: ${user.name}`}
          value={user.access.scope}
          options={SCOPE_OPTIONS}
          onChange={(scope) => updateCard(user, { access: { ...user.access, scope } }, `Видимость: ${DATA_SCOPE_LABEL[scope].toLowerCase()}`)}
        />
      ) : <span className={styles.muted}>{DATA_SCOPE_LABEL[user.access.scope]}</span>),
    },
    ...(isAdmin ? [{
      id: 'directions',
      header: 'Направления',
      cell: (user) => (
        <MultiSelectFilter
          label={user.access.directionIds.length ? 'Только' : 'Все'}
          ariaLabel={`Направления: ${user.name}`}
          releaseFocusOnClose
          options={directions.map((direction) => ({ value: direction.id, label: direction.name }))}
          value={user.access.directionIds}
          onChange={(directionIds) => updateCard(user, { access: { ...user.access, directionIds } }, directionIds.length ? `Ограничение по направлениям: ${directionIds.length}` : 'Ограничение по направлениям снято')}
        />
      ),
    }, {
      id: 'lead',
      header: 'Руководитель',
      cell: (user) => (user.role === ROLE.manager ? (
        <SelectMenu
          label={`Руководитель: ${user.name}`}
          value={user.leadId ?? ''}
          options={[{ value: '', label: 'Не назначен' }, ...leads.map((lead) => ({ value: lead.id, label: lead.name }))]}
          onChange={(leadId) => updateCard(user, { leadId: leadId || null }, 'Изменён руководитель')}
        />
      ) : <span className={styles.muted}>—</span>),
    }] : []),
    {
      id: 'active',
      header: 'Доступ',
      cell: (user) => (
        <Switch
          label={user.active ? 'Активен' : 'Заблокирован'}
          checked={user.active}
          disabled={!canManage(user) || pendingId === user.id}
          onChange={(active) => runAccount(user, (api) => api.setAccountStatus(user.id, active), active ? 'доступ восстановлен' : 'доступ заблокирован, активные сессии завершены')}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (user) => (canManage(user) && status?.keycloak ? (
        <DropdownMenu
          label={`Действия: ${user.name}`}
          items={[
            { label: 'Выдать временный пароль', icon: RefreshIcon, onSelect: () => runAccount(user, (api) => api.resetAccountPassword(user.id), 'выдан временный пароль') },
            ...(isAdmin && status.adminConsoleUrl ? [{ label: 'Открыть в Keycloak', icon: LinkIcon, onSelect: () => window.open(`${status.adminConsoleUrl}/${encodeURIComponent(user.id)}/settings`, '_blank', 'noopener') }] : []),
          ]}
        />
      ) : null),
    },
  ];

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Пользователи и доступ' : 'Моя команда'}
        hint={isAdmin
          ? 'Кто работает в системе и что ему доступно. Роль определяет, что человек может делать, видимость — какие вузы он видит.'
          : 'Менеджеры вашей команды: заведите нового сотрудника, выдайте временный пароль или заблокируйте доступ.'}
        actions={<Button variant="primary" icon={AddIcon} onClick={() => setCreating(true)}>Добавить сотрудника</Button>}
      />

      {status && (status.keycloak ? (
        <InlineAlert
          tone="info"
          title="Учётные записи — в Keycloak"
          className={styles.status}
          action={isAdmin && status.adminConsoleUrl ? <a href={status.adminConsoleUrl} target="_blank" rel="noreferrer" className={styles.consoleLink}>Консоль Keycloak</a> : null}
        >
          Логин, пароль и роль сотрудника хранятся в Keycloak (realm «{status.realm}»); всё меняется отсюда — Keycloak обновится сам.
        </InlineAlert>
      ) : (
        <InlineAlert tone="warning" title="Keycloak не подключён к CRM" className={styles.status}>
          Сотрудники создаются только в CRM и войти пока не смогут. Настройте служебный клиент — см. backend/deploy/keycloak/README.md.
        </InlineAlert>
      ))}

      <Card padding="none">
        <CardHeader
          title="Сотрудники"
          hint="Роль, какие вузы видит сотрудник и активна ли учётная запись."
          description={isAdmin ? 'Роль и доступ меняются сразу в CRM и Keycloak. Каждое действие попадает в журнал.' : 'Вы видите себя и менеджеров своей команды.'}
        />
        <DataTable caption="Сотрудники и их права" columns={columns} rows={rows} bodyRef={tableBodyRef} className={styles.tableWrap} />
      </Card>

      <CreateAccountDialog
        open={creating}
        onOpenChange={setCreating}
        isAdmin={isAdmin}
        currentUser={currentUser}
        leads={leads}
        directions={directions}
        keycloak={Boolean(status?.keycloak)}
        onCreate={async (payload) => {
          const result = await actions.manageAccount((api) => api.createAccount(payload));
          setCreating(false);
          if (result.temporaryPassword) setIssued({ user: { name: payload.name, email: payload.email, username: payload.username || payload.email.split('@')[0] }, password: result.temporaryPassword, created: true });
          else toast.success(`${payload.name}: карточка создана`);
        }}
      />

      <PasswordDialog issued={issued} onClose={() => setIssued(null)} />
    </>
  );
}
