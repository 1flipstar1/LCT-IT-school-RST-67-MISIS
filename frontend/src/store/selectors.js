import { useMemo } from 'react';
import { useSession } from '../auth/SessionProvider.jsx';
import { createVisibilityFilter, ROLE } from '../domain/roles.js';
import { getProgress, getSla, getStage } from '../domain/workflow.js';
import { useStoreState } from './StoreProvider.jsx';

const indexById = (items) => new Map(items.map((item) => [item.id, item]));

export function useCatalogIndex() {
  const { universities, directions, products, users, workflows } = useStoreState();
  return useMemo(
    () => ({
      universities: indexById(universities),
      directions: indexById(directions),
      products: indexById(products),
      users: indexById(users),
      workflows: indexById(workflows),
    }),
    [universities, directions, products, users, workflows],
  );
}

/** Взаимодействие + связанные сущности + вычисленные срок и прогресс: всё, что нужно для показа. */
export function toInteractionRow(interaction, index, now = new Date()) {
  const workflow = index.workflows.get(interaction.workflowId);
  const university = index.universities.get(interaction.universityId);
  const direction = index.directions.get(interaction.directionId);
  const product = index.products.get(interaction.productId);
  const manager = index.users.get(interaction.managerId);
  const stage = getStage(workflow, interaction.stageId);

  return {
    ...interaction,
    workflow,
    university,
    direction,
    product,
    manager,
    stage,
    sla: getSla(interaction, workflow, now),
    progress: getProgress(workflow, interaction.stageId),
    searchText: [university.name, university.shortName, direction.name, product.name, product.vendor, manager?.name, stage.name]
      .join(' ')
      .toLowerCase(),
  };
}

/** Взаимодействия, которые текущий пользователь имеет право видеть (с учётом роли и ограничений). */
export function useVisibleInteractionRows() {
  const { interactions, users } = useStoreState();
  const { user } = useSession();
  const index = useCatalogIndex();

  return useMemo(() => {
    const isVisible = createVisibilityFilter(user, users);
    const now = new Date();
    return interactions.filter(isVisible).map((interaction) => toInteractionRow(interaction, index, now));
  }, [interactions, users, user, index]);
}

/** Показатели LMS только по видимым пользователю парам «вуз + направление». */
export function useVisibleMetrics(rows) {
  const { metrics } = useStoreState();
  return useMemo(() => {
    const visiblePairs = new Set(rows.map((row) => `${row.universityId}:${row.directionId}`));
    return metrics.filter((metric) => visiblePairs.has(`${metric.universityId}:${metric.directionId}`));
  }, [metrics, rows]);
}

export function useManagers() {
  const { users } = useStoreState();
  return useMemo(() => users.filter((user) => user.role === ROLE.manager && user.active), [users]);
}
