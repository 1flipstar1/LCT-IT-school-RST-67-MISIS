/**
 * Ролевая модель (ТЗ, п. 11 функциональных требований).
 * «Пользователь» из ТЗ в интерфейсе называется «Менеджер» — так понятнее сотрудникам ИТ Школы.
 */

export const ROLE = Object.freeze({
  manager: 'manager',
  lead: 'lead',
  admin: 'admin',
});

export const ROLE_INFO = {
  [ROLE.manager]: {
    label: 'Менеджер',
    description: 'Ведёт доступные ему взаимодействия: переводит этапы, пишет комментарии, прикладывает файлы, ищет данные и формирует отчёты. Не управляет сотрудниками, ролями и настройками системы.',
  },
  [ROLE.lead]: {
    label: 'Руководитель',
    description: 'Видит работу команды, меняет ответственных, настраивает этапы, импорт и интеграции, создаёт и блокирует менеджеров своей команды. Роли и видимость данных сотрудников меняет только администратор.',
  },
  [ROLE.admin]: {
    label: 'Администратор',
    description: 'Управляет сотрудниками, ролями, доступом к данным и интеграциями, видит журнал действий. Удаления сотрудников как функции CRM нет; доступ прекращают блокировкой.',
  },
};

export const PERMISSION = Object.freeze({
  viewAllInteractions: 'interactions.view-all',
  assignManager: 'interactions.assign',
  importCatalogs: 'catalogs.import',
  manageWorkflows: 'workflows.manage',
  manageIntegrations: 'integrations.manage',
  manageUsers: 'users.manage',
  // Руководитель заводит менеджеров своей команды, выдаёт им пароли и блокирует доступ.
  manageTeamAccounts: 'accounts.team',
  viewAudit: 'audit.view',
});

const GRANTS = {
  [ROLE.manager]: [],
  [ROLE.lead]: [
    PERMISSION.viewAllInteractions,
    PERMISSION.assignManager,
    PERMISSION.importCatalogs,
    PERMISSION.manageWorkflows,
    PERMISSION.manageIntegrations,
    PERMISSION.viewAudit,
    PERMISSION.manageTeamAccounts,
  ],
  [ROLE.admin]: Object.values(PERMISSION),
};

export function can(role, permission) {
  if (!permission) return true;
  return GRANTS[role]?.includes(permission) ?? false;
}

/** Область видимости данных пользователя. Администратор может сузить её вручную. */
export const DATA_SCOPE = Object.freeze({
  own: 'own',
  team: 'team',
  all: 'all',
});

export const DATA_SCOPE_LABEL = {
  [DATA_SCOPE.own]: 'Только свои вузы',
  [DATA_SCOPE.team]: 'Вузы своей команды',
  [DATA_SCOPE.all]: 'Все вузы',
};

/**
 * Возвращает предикат «пользователь видит это взаимодействие».
 * Учитывает область видимости и ограничение по ИТ-направлениям.
 */
export function createVisibilityFilter(user, users) {
  if (!user) return () => false;
  const { scope = DATA_SCOPE.own, directionIds = [] } = user.access ?? {};
  const byDirection = (interaction) => directionIds.length === 0 || directionIds.includes(interaction.directionId);

  if (scope === DATA_SCOPE.all) return byDirection;
  if (scope === DATA_SCOPE.team) {
    const team = new Set(users.filter((u) => u.leadId === user.id).map((u) => u.id).concat(user.id));
    return (interaction) => team.has(interaction.managerId) && byDirection(interaction);
  }
  return (interaction) => interaction.managerId === user.id && byDirection(interaction);
}
