import { useMemo } from 'react';
import { useSession } from '../auth/SessionProvider.jsx';
import { toAttachmentMeta } from '../domain/attachments.js';
import { AppError } from '../domain/errors.js';
import { createId } from '../domain/format.js';
import { PERMISSION } from '../domain/roles.js';
import { getStage, isFinalStage, requiresComment, validateWorkflow } from '../domain/workflow.js';
import { ACTION } from './reducer.js';
import { useStoreApi } from './StoreProvider.jsx';

/**
 * Прикладные действия. Здесь — бизнес-правила и проверки прав; reducer только применяет изменения.
 * В продуктиве каждое действие — вызов REST API, а проверки дублируются на бэкенде.
 *
 * Действия, которые можно отменить, возвращают { undo } — его вызывает кнопка «Отменить» в уведомлении.
 */
export function useActions() {
  const { dispatch, getState } = useStoreApi();
  const session = useSession();

  return useMemo(() => {
    const actorId = session.user?.id;
    const now = () => new Date().toISOString();

    const requirePermission = (permission) => {
      if (!session.can(permission)) throw new AppError('ACCESS-403');
    };

    const findInteraction = (state, interactionId) => {
      const interaction = state.interactions.find((item) => item.id === interactionId);
      if (!interaction) throw new AppError('NOT-FOUND-404');
      return interaction;
    };

    const labelOf = (state, interaction) => {
      const university = state.universities.find((item) => item.id === interaction.universityId);
      const direction = state.directions.find((item) => item.id === interaction.directionId);
      return `${university?.shortName ?? university?.name} · ${direction?.name}`;
    };

    const interactionTarget = (state, interaction) => ({ type: 'interaction', id: interaction.id, label: labelOf(state, interaction) });

    /** Выполняет dispatch и возвращает функцию отмены, восстанавливающую снимок до изменения. */
    const undoable = (action) => {
      const snapshot = getState();
      dispatch(action);
      return { undo: () => dispatch({ type: ACTION.stateRestored, payload: snapshot }) };
    };

    return {
      transitionInteraction({ interactionId, expectedStageId, toStageId, kind, comment = '', files = [] }) {
        const state = getState();
        const interaction = findInteraction(state, interactionId);
        // Защита от гонки: пока пользователь писал комментарий, карточку мог перевести коллега.
        if (interaction.stageId !== expectedStageId) throw new AppError('WORKFLOW-409');
        if (requiresComment(kind) && !comment.trim()) throw new AppError('WORKFLOW-422');

        const workflow = state.workflows.find((item) => item.id === interaction.workflowId);
        const toStage = getStage(workflow, toStageId);
        const at = now();

        return undoable({
          type: ACTION.interactionTransitioned,
          payload: {
            event: {
              id: createId('ev'),
              interactionId,
              type: 'transition',
              userId: actorId,
              at,
              fromStageId: interaction.stageId,
              toStageId,
              stageId: interaction.stageId,
              comment: comment.trim(),
              files: files.map(toAttachmentMeta),
            },
            audit: { at, actorId, text: `Перевод на этап «${toStage.name}»`, target: interactionTarget(state, interaction) },
          },
        });
      },

      completeInteraction({ interactionId, comment = '', files = [] }) {
        const state = getState();
        const interaction = findInteraction(state, interactionId);
        const workflow = state.workflows.find((item) => item.id === interaction.workflowId);
        if (!isFinalStage(workflow, interaction.stageId)) throw new AppError('WORKFLOW-409');
        const at = now();

        return undoable({
          type: ACTION.interactionTransitioned,
          payload: {
            completed: true,
            event: {
              id: createId('ev'),
              interactionId,
              type: 'completed',
              userId: actorId,
              at,
              fromStageId: interaction.stageId,
              toStageId: interaction.stageId,
              stageId: interaction.stageId,
              comment: comment.trim(),
              files: files.map(toAttachmentMeta),
            },
            audit: { at, actorId, text: 'Взаимодействие завершено', target: interactionTarget(state, interaction) },
          },
        });
      },

      addComment({ interactionId, comment = '', files = [] }) {
        const state = getState();
        const interaction = findInteraction(state, interactionId);
        const at = now();

        return undoable({
          type: ACTION.interactionCommented,
          payload: {
            event: {
              id: createId('ev'),
              interactionId,
              type: 'comment',
              userId: actorId,
              at,
              stageId: interaction.stageId,
              comment: comment.trim(),
              files: files.map(toAttachmentMeta),
            },
            audit: {
              at,
              actorId,
              text: files.length ? `Добавлены файлы (${files.length})` : 'Добавлен комментарий',
              target: interactionTarget(state, interaction),
            },
          },
        });
      },

      assignManager({ interactionId, managerId }) {
        requirePermission(PERMISSION.assignManager);
        const state = getState();
        const interaction = findInteraction(state, interactionId);
        const manager = state.users.find((item) => item.id === managerId);
        const at = now();

        return undoable({
          type: ACTION.interactionAssigned,
          payload: {
            interactionId,
            patch: { managerId },
            event: {
              id: createId('ev'),
              interactionId,
              type: 'assign',
              userId: actorId,
              at,
              fromUserId: interaction.managerId,
              toUserId: managerId,
            },
            audit: { at, actorId, text: `Назначен ответственный: ${manager.name}`, target: interactionTarget(state, interaction) },
          },
        });
      },

      updateInteraction({ interactionId, universityId, directionId, programId, productId, managerId, contactIds = [] }) {
        const state = getState();
        const interaction = findInteraction(state, interactionId);
        const university = state.universities.find((item) => item.id === universityId);
        const direction = state.directions.find((item) => item.id === directionId);
        const program = state.programs.find((item) => item.id === programId && item.directionId === directionId);
        const product = state.products.find((item) => item.id === productId);
        const manager = state.users.find((item) => item.id === managerId);
        if (!university || !direction || !program || !product || !manager || !program.productIds.includes(productId)) throw new AppError('NOT-FOUND-404');
        if (managerId !== interaction.managerId) requirePermission(PERMISSION.assignManager);

        const requestedContactIds = new Set(contactIds);
        const normalizedContactIds = university.contacts.filter((contact) => requestedContactIds.has(contact.id)).map((contact) => contact.id);
        const patch = { universityId, directionId, programId, productId, managerId, contactIds: normalizedContactIds };
        const labels = [];
        if (universityId !== interaction.universityId) labels.push('вуз');
        if (directionId !== interaction.directionId) labels.push('ИТ-направление');
        if (programId !== interaction.programId) labels.push('ИТ-программа');
        if (productId !== interaction.productId) labels.push('ИТ-продукт');
        if (managerId !== interaction.managerId) labels.push('ответственный');
        const previousContactIds = interaction.contactIds ?? [];
        if (normalizedContactIds.length !== previousContactIds.length || normalizedContactIds.some((id) => !previousContactIds.includes(id))) labels.push('контактные лица');
        if (labels.length === 0) return { undo: null };

        const at = now();
        const text = `Изменены параметры: ${labels.join(', ')}`;
        return undoable({
          type: ACTION.interactionUpdated,
          payload: {
            interactionId,
            patch,
            event: { id: createId('ev'), interactionId, type: 'updated', userId: actorId, at, comment: text },
            audit: { at, actorId, text, target: interactionTarget(state, interaction) },
          },
        });
      },

      createInteraction({ universityId, newUniversityName, directionId, programId, productId, workflowId, managerId, comment = '', source = 'manual' }) {
        const state = getState();
        const at = now();
        const workflow = state.workflows.find((item) => item.id === workflowId);
        const program = state.programs.find((item) => item.id === programId && item.directionId === directionId);
        if (!program || !program.productIds.includes(productId)) throw new AppError('NOT-FOUND-404');

        const universityToAdd = newUniversityName
          ? { id: createId('u'), name: newUniversityName.trim(), shortName: newUniversityName.trim(), city: '', contacts: [] }
          : null;

        const interaction = {
          id: createId('i'),
          universityId: universityToAdd?.id ?? universityId,
          directionId,
          programId,
          productId,
          managerId,
          workflowId,
          stageId: workflow.stages[0].id,
          contactIds: [],
          contract: { number: '', licenseSignedAt: '', licenseYears: null, transferStatus: 'Не передано' },
          comment,
          source,
          startedAt: at,
          stageEnteredAt: at,
          updatedAt: at,
          completedAt: null,
        };

        dispatch({
          type: ACTION.interactionCreated,
          payload: {
            interaction,
            universityToAdd,
            event: { id: createId('ev'), interactionId: interaction.id, type: 'created', userId: actorId, at, toStageId: interaction.stageId, comment },
            audit: {
              at,
              actorId,
              text: 'Создано взаимодействие',
              target: { type: 'interaction', id: interaction.id, label: labelOf({ ...state, universities: universityToAdd ? [...state.universities, universityToAdd] : state.universities }, interaction) },
            },
          },
        });
        return interaction.id;
      },

      /** Возвращает список проблем; пустой список — процесс сохранён. */
      saveWorkflow(draft) {
        requirePermission(PERMISSION.manageWorkflows);
        const state = getState();
        const problems = validateWorkflow(draft);

        const stageIds = new Set(draft.stages.map((stage) => stage.id));
        const previous = state.workflows.find((item) => item.id === draft.id);
        previous?.stages
          .filter((stage) => !stageIds.has(stage.id))
          .forEach((stage) => {
            const count = state.interactions.filter((item) => item.workflowId === draft.id && item.stageId === stage.id).length;
            if (count > 0) problems.push(`На этапе «${stage.name}» сейчас ${count} взаимод. — сначала переведите их на другой этап.`);
          });
        if (problems.length > 0) return problems;

        const at = now();
        const workflow = { ...draft, version: (previous?.version ?? 0) + 1, updatedAt: at };
        dispatch({
          type: ACTION.workflowSaved,
          payload: {
            workflow,
            audit: {
              at,
              actorId,
              text: previous ? `Этапы работы обновлены до версии ${workflow.version}` : 'Создан набор этапов',
              target: { type: 'workflow', id: workflow.id, label: workflow.name },
            },
          },
        });
        return [];
      },

      updateUser(userId, patch, description) {
        requirePermission(PERMISSION.manageUsers);
        const state = getState();
        const target = state.users.find((item) => item.id === userId);
        const at = now();
        return undoable({
          type: ACTION.userUpdated,
          payload: { userId, patch, audit: { at, actorId, text: description, target: { type: 'user', id: userId, label: target.name } } },
        });
      },

      resolveInboxItem(itemId, patch, description) {
        requirePermission(PERMISSION.manageIntegrations);
        const state = getState();
        const item = state.inbox.find((entry) => entry.id === itemId);
        const at = now();
        dispatch({
          type: ACTION.inboxResolved,
          payload: { itemId, patch, audit: { at, actorId, text: description, target: { type: 'inbox', id: itemId, label: item.title } } },
        });
      },

      /** Имитация запроса к внешней системе: сетевой вызов занимает время и может завершиться ошибкой. */
      async syncIntegration(sourceId) {
        requirePermission(PERMISSION.manageIntegrations);
        await new Promise((resolve) => setTimeout(resolve, 900));
        const at = now();
        const records = 5 + Math.floor(Math.random() * 20);
        const logEntry = { id: createId('sl'), sourceId, at, status: 'success', records };
        const source = getState().integrations.sources.find((item) => item.id === sourceId);
        dispatch({
          type: ACTION.integrationSynced,
          payload: { logEntry, audit: { at, actorId, text: `Синхронизация: получено записей — ${records}`, target: { type: 'integration', id: sourceId, label: source.name } } },
        });
        return logEntry;
      },

      recordReport(report) {
        const at = now();
        dispatch({
          type: ACTION.reportCreated,
          payload: {
            report: { ...report, id: createId('r'), createdAt: at, userId: actorId },
            audit: { at, actorId, text: `Сформирован отчёт (${report.format.toUpperCase()})`, target: { type: 'report', label: report.name } },
          },
        });
      },

      applyImport({ universities, programs, products, interactions, summary }) {
        requirePermission(PERMISSION.importCatalogs);
        const at = now();
        dispatch({
          type: ACTION.catalogImported,
          payload: { universities, programs, products, interactions, audit: { at, actorId, text: summary, target: { type: 'import', label: 'Импорт каталога' } } },
        });
      },
    };
  }, [dispatch, getState, session]);
}
