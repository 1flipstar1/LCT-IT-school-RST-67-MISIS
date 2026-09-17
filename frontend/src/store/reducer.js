import { createId } from '../domain/format.js';

/**
 * Чистый reducer приложения. Каждое действие, меняющее данные, оставляет запись в журнале
 * (таблица audit_logs в db.sql) — поэтому руководитель и администратор видят, кто и что менял.
 */
export const ACTION = Object.freeze({
  interactionCreated: 'interaction/created',
  interactionTransitioned: 'interaction/transitioned',
  interactionCommented: 'interaction/commented',
  interactionAssigned: 'interaction/assigned',
  interactionUpdated: 'interaction/updated',
  workflowSaved: 'workflow/saved',
  userUpdated: 'user/updated',
  inboxResolved: 'inbox/resolved',
  integrationSynced: 'integration/synced',
  reportCreated: 'report/created',
  catalogImported: 'catalog/imported',
  stateRestored: 'state/restored',
});

const replaceById = (items, id, update) => items.map((item) => (item.id === id ? update(item) : item));

function withAudit(state, { at, actorId, text, target }) {
  const entry = { id: createId('audit'), at, userId: actorId, text, target };
  return { ...state, audit: [entry, ...state.audit].slice(0, 500) };
}

export function reducer(state, action) {
  const { type, payload } = action;

  switch (type) {
    case ACTION.interactionCreated: {
      const { interaction, event, universityToAdd, audit } = payload;
      const universities = universityToAdd ? [...state.universities, universityToAdd] : state.universities;
      return withAudit(
        { ...state, universities, interactions: [interaction, ...state.interactions], events: [...state.events, event] },
        audit,
      );
    }

    case ACTION.interactionTransitioned: {
      const { event, audit } = payload;
      const interactions = replaceById(state.interactions, event.interactionId, (item) => ({
        ...item,
        stageId: event.toStageId,
        stageEnteredAt: event.at,
        updatedAt: event.at,
        completedAt: payload.completed ? event.at : null,
      }));
      return withAudit({ ...state, interactions, events: [...state.events, event] }, audit);
    }

    case ACTION.interactionCommented: {
      const { event, audit } = payload;
      const interactions = replaceById(state.interactions, event.interactionId, (item) => ({ ...item, updatedAt: event.at }));
      return withAudit({ ...state, interactions, events: [...state.events, event] }, audit);
    }

    case ACTION.interactionAssigned:
    case ACTION.interactionUpdated: {
      const { interactionId, patch, event, audit } = payload;
      const interactions = replaceById(state.interactions, interactionId, (item) => ({ ...item, ...patch, updatedAt: audit.at }));
      const events = event ? [...state.events, event] : state.events;
      return withAudit({ ...state, interactions, events }, audit);
    }

    case ACTION.workflowSaved: {
      const { workflow, audit } = payload;
      const exists = state.workflows.some((item) => item.id === workflow.id);
      const workflows = exists ? replaceById(state.workflows, workflow.id, () => workflow) : [...state.workflows, workflow];
      return withAudit({ ...state, workflows }, audit);
    }

    case ACTION.userUpdated: {
      const { userId, patch, audit } = payload;
      return withAudit({ ...state, users: replaceById(state.users, userId, (item) => ({ ...item, ...patch })) }, audit);
    }

    case ACTION.inboxResolved: {
      const { itemId, patch, audit } = payload;
      return withAudit({ ...state, inbox: replaceById(state.inbox, itemId, (item) => ({ ...item, ...patch })) }, audit);
    }

    case ACTION.integrationSynced: {
      const { logEntry, audit } = payload;
      const sources = replaceById(state.integrations.sources, logEntry.sourceId, (source) => ({
        ...source,
        lastSyncAt: logEntry.at,
        lastStatus: logEntry.status,
        lastErrorCode: logEntry.errorCode,
      }));
      return withAudit({ ...state, integrations: { sources, log: [logEntry, ...state.integrations.log] } }, audit);
    }

    case ACTION.reportCreated: {
      const { report, audit } = payload;
      return withAudit({ ...state, reports: [report, ...state.reports] }, audit);
    }

    case ACTION.catalogImported: {
      const { universities, products, interactions, audit } = payload;
      return withAudit({ ...state, universities, products, interactions }, audit);
    }

    case ACTION.stateRestored:
      return payload;

    default:
      throw new Error(`Неизвестное действие: ${type}`);
  }
}
