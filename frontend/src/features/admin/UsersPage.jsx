import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
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
import { SelectMenu } from '../../ui/SelectMenu.jsx';
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
  const tableBodyRef = useRef(null);

  useLayoutEffect(() => {
    const body = tableBodyRef.current;
    if (!body || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const context = gsap.context(() => {
      gsap.fromTo(Array.from(body.rows),
        { y: 24, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity,visibility' },
      );
    }, body);

    return () => context.revert();
  }, []);

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
        <SelectMenu
          label={`Роль: ${user.name}`}
          value={user.role}
          options={ROLE_OPTIONS}
          disabled={user.id === currentUser.id}
          title={user.id === currentUser.id ? 'Свою роль изменить нельзя — попросите другого администратора' : undefined}
          onChange={(role) => update(user, { role }, `Роль изменена на «${ROLE_INFO[role].label}»`)}
        />
      ),
    },
    {
      id: 'scope',
      header: 'Видит данные',
      cell: (user) => (
        <SelectMenu
          label={`Видимость данных: ${user.name}`}
          value={user.access.scope}
          options={SCOPE_OPTIONS}
          onChange={(scope) => update(user, { access: { ...user.access, scope } }, `Видимость: ${DATA_SCOPE_LABEL[scope].toLowerCase()}`)}
        />
      ),
    },
    {
      id: 'directions',
      header: 'Направления',
      cell: (user) => (
        <MultiSelectFilter
          label={user.access.directionIds.length ? 'Только' : 'Все'}
          ariaLabel={`Направления: ${user.name}`}
          releaseFocusOnClose
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
          <SelectMenu
            label={`Руководитель: ${user.name}`}
            value={user.leadId ?? ''}
            options={[{ value: '', label: 'Не назначен' }, ...leads.map((lead) => ({ value: lead.id, label: lead.name }))]}
            onChange={(leadId) => update(user, { leadId: leadId || null }, 'Изменён руководитель')}
          />
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
      <PageHeader title="Пользователи и доступ" hint="Кто работает в системе и что ему доступно. Роль определяет, что человек может делать, видимость — какие вузы он видит. Учётные записи создаются в Keycloak, здесь настраиваются права." />

      <Card padding="none">
        <CardHeader title="Сотрудники" hint="Все сотрудники ИТ Школы в системе: роль, какие вузы видит и активна ли учётная запись." description="Изменения применяются сразу. Каждое действие можно отменить в уведомлении и найти в журнале." />
        <DataTable caption="Сотрудники и их права" columns={columns} rows={users} bodyRef={tableBodyRef} className={styles.tableWrap} />
      </Card>
    </>
  );
}
