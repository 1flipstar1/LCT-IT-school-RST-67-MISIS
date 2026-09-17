import { useSession } from '../../auth/SessionProvider.jsx';
import { DATA_SCOPE, DATA_SCOPE_LABEL, ROLE, ROLE_INFO } from '../../domain/roles.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { Person } from '../../ui/Avatar.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Switch } from '../../ui/Field.jsx';
import { MultiSelectFilter } from '../../ui/MultiSelectFilter.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { useToast } from '../../ui/Toast.jsx';
import styles from './UsersPage.module.css';

const ROLE_OPTIONS = Object.values(ROLE).map((role) => ({ value: role, label: ROLE_INFO[role].label }));
const SCOPE_OPTIONS = Object.values(DATA_SCOPE).map((scope) => ({ value: scope, label: DATA_SCOPE_LABEL[scope] }));

/** Управление правами (ТЗ: администратор управляет правами и ограничивает видимость данных). */
export function UsersPage() {
  const { users, directions } = useStoreState();
  const { user: currentUser } = useSession();
  const actions = useActions();
  const toast = useToast();

  const leads = users.filter((user) => user.role === ROLE.lead);

  const update = (user, patch, description) => {
    const { undo } = actions.updateUser(user.id, patch, description);
    // «Ольга Лебедева: роль изменена на «Руководитель»» — строчная только первая буква описания.
    toast.success(`${user.name}: ${description.charAt(0).toLowerCase()}${description.slice(1)}`, { undo });
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
      cell: (user) => (
        <select
          className={styles.select}
          aria-label={`Роль: ${user.name}`}
          value={user.role}
          disabled={user.id === currentUser.id}
          title={user.id === currentUser.id ? 'Свою роль изменить нельзя — попросите другого администратора' : undefined}
          onChange={(event) => update(user, { role: event.target.value }, `Роль изменена на «${ROLE_INFO[event.target.value].label}»`)}
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      id: 'scope',
      header: 'Видит данные',
      cell: (user) => (
        <select
          className={styles.select}
          aria-label={`Видимость данных: ${user.name}`}
          value={user.access.scope}
          onChange={(event) => update(user, { access: { ...user.access, scope: event.target.value } }, `Видимость: ${DATA_SCOPE_LABEL[event.target.value].toLowerCase()}`)}
        >
          {SCOPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      id: 'directions',
      header: 'Направления',
      cell: (user) => (
        <MultiSelectFilter
          label={user.access.directionIds.length ? 'Только' : 'Все'}
          options={directions.map((direction) => ({ value: direction.id, label: direction.name }))}
          value={user.access.directionIds}
          onChange={(directionIds) => update(user, { access: { ...user.access, directionIds } }, directionIds.length ? `Ограничение по направлениям: ${directionIds.length}` : 'Ограничение по направлениям снято')}
        />
      ),
    },
    {
      id: 'lead',
      header: 'Руководитель',
      cell: (user) =>
        user.role === ROLE.manager ? (
          <select
            className={styles.select}
            aria-label={`Руководитель: ${user.name}`}
            value={user.leadId ?? ''}
            onChange={(event) => update(user, { leadId: event.target.value || null }, 'Изменён руководитель')}
          >
            <option value="">Не назначен</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </select>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    {
      id: 'active',
      header: 'Доступ',
      cell: (user) => (
        <Switch
          label={user.active ? 'Активен' : 'Заблокирован'}
          checked={user.active}
          disabled={user.id === currentUser.id}
          onChange={(active) => update(user, { active }, active ? 'Доступ восстановлен' : 'Доступ заблокирован')}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Пользователи и доступ"
        description="Роль определяет, что человек может делать. Видимость — какие вузы он видит. Учётные записи создаются в Keycloak, здесь настраиваются права."
      />

      <section className={styles.roles} aria-label="Описание ролей">
        {Object.values(ROLE).map((role) => (
          <div key={role} className={styles.role}>
            <p className={styles.roleName}>{ROLE_INFO[role].label}</p>
            <p className={styles.roleDescription}>{ROLE_INFO[role].description}</p>
          </div>
        ))}
      </section>

      <Card padding="none">
        <CardHeader title="Сотрудники" description="Изменения применяются сразу. Каждое действие можно отменить в уведомлении и найти в журнале." />
        <DataTable caption="Сотрудники и их права" columns={columns} rows={users} />
      </Card>
    </>
  );
}
