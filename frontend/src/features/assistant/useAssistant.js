import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../api/client.js';
import { useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { describeError } from '../../domain/errors.js';
import { filterInteractionRows } from '../../domain/filters.js';
import { createId, formatDate, formatRelativeDateTime } from '../../domain/format.js';
import { PERMISSION } from '../../domain/roles.js';
import { downloadBlob, safeFileName } from '../../lib/download.js';
import { localStore, sessionStore } from '../../lib/storage.js';
import { usePersistentState, writePersistentState } from '../../lib/usePersistentState.js';
import { useCatalogIndex, useVisibleInteractionRows } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { ADMIN_GUIDE, USER_GUIDE } from '../help/guides.js';
import { exportReport } from '../reports/reportExport.js';
import { createEntityMatcher } from './engine/entities.js';
import { executeTool } from './engine/execute.js';
import { interpretLocally, resolveModelCall } from './engine/interpret.js';
import { buildKnowledge } from './engine/knowledge.js';
import { MUTATING_TOOLS, TOOL } from './engine/tools.js';
import { speak } from './speech.js';

const HISTORY_LIMIT = 60;
const MODEL_HISTORY = 8;
const MODEL_TEXT_LIMIT = 1900;
const STATUS_TTL_MS = 60_000;

/** В режиме «Подсказки» действие не выполняется сразу: показываем статью справки и кнопку «Выполнить». */
const GUIDE_FOR_TOOL = {
  [TOOL.createReport]: 'report',
  [TOOL.repeatReport]: 'report',
  [TOOL.changeStage]: 'stage',
  [TOOL.addComment]: 'comment',
};

const FALLBACK_SUGGESTIONS = ['Что ты умеешь?', 'Покажи просроченные', 'Как сформировать отчёт?'];

function articleAnswer(article, call) {
  return {
    text: article.text,
    card: {
      kind: 'guide',
      title: article.title,
      steps: article.steps,
      link: article.link,
      action: call ? { label: 'Выполнить за меня', call } : article.action,
    },
  };
}

/** Состояние локальной модели: 'checking' | 'online' | 'offline' | 'disabled'. */
function useModelStatus(enabled) {
  const [status, setStatus] = useState({ state: enabled ? 'checking' : 'disabled', model: null, checkedAt: 0 });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const result = await apiClient.getAssistantStatus();
      const state = !result.enabled ? 'disabled' : result.available ? 'online' : 'offline';
      setStatus({ state, model: result.model, checkedAt: Date.now() });
    } catch {
      setStatus({ state: 'offline', model: null, checkedAt: Date.now() });
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) setStatus({ state: 'disabled', model: null, checkedAt: 0 });
    else refresh();
  }, [enabled, refresh]);

  return { ...status, refresh, stale: Date.now() - status.checkedAt > STATUS_TTL_MS };
}

export function useAssistant({ settings, page }) {
  const { user, can } = useSession();
  const store = useStoreState();
  const rows = useVisibleInteractionRows();
  const index = useCatalogIndex();
  const actions = useActions();
  const { navigate } = useRouter();
  const model = useModelStatus(settings.engine !== 'local');

  const storage = settings.keepHistory ? localStore : sessionStore;
  const [messages, setMessages] = usePersistentState(`assistant:chat:${user?.id ?? 'guest'}`, [], storage);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const undoRef = useRef(new Map());

  const { universities, users, directions, products, programs, workflows, reports } = store;
  const matcher = useMemo(
    () => createEntityMatcher({ universities, users, directions, products, programs, workflows }),
    [universities, users, directions, products, programs, workflows],
  );
  const canManage = can(PERMISSION.manageWorkflows);
  const knowledge = useMemo(
    () => buildKnowledge({ userGuide: USER_GUIDE, adminGuide: canManage ? ADMIN_GUIDE : [], workflows }),
    [canManage, workflows],
  );

  // Асинхронные ответы должны видеть свежие данные, а не данные момента отправки.
  const contextRef = useRef(null);
  contextRef.current = { rows, index, reports, settings, can, userId: user?.id, matcher, knowledge, messages };

  useEffect(() => {
    if (!settings.keepHistory) localStore.remove(`assistant:chat:${user?.id ?? 'guest'}`);
  }, [settings.keepHistory, user?.id]);

  // Если страницу перезагрузили во время сохранения, карточка снова ждёт подтверждения.
  useEffect(() => {
    setMessages((current) => current.map((message) => (message.card?.status === 'working' ? { ...message, card: { ...message.card, status: 'pending' } } : message)));
  }, [setMessages]);

  const append = useCallback((message) => {
    setMessages((current) => [...current, { id: createId('m'), at: new Date().toISOString(), ...message }].slice(-HISTORY_LIMIT));
  }, [setMessages]);

  const updateMessage = useCallback((id, patch) => {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch(message) } : message)));
  }, [setMessages]);

  const updateCard = useCallback((id, cardPatch) => updateMessage(id, (message) => ({ card: { ...message.card, ...cardPatch } })), [updateMessage]);

  // ---------- Действия карточек ----------

  const downloadReport = useCallback(async (id, card, format) => {
    const spec = { ...card.spec, format: format ?? card.spec.format };
    try {
      const reportRows = filterInteractionRows(contextRef.current.rows, spec.filters);
      const rowCount = await exportReport({ ...spec, rows: reportRows });
      actions.recordReport({ name: spec.name, format: spec.format, rowCount, summary: spec.summary, filters: spec.filters, columns: spec.columns });
      updateCard(id, { spec, rowCount, downloadedAt: new Date().toISOString(), error: null });
    } catch (error) {
      updateCard(id, { error: describeError(error).title });
    }
  }, [actions, updateCard]);

  /** card — данные карточки вместе с правками пользователя (например, дописанным комментарием). */
  const commitCard = useCallback(async (id, card) => {
    if (card.status !== 'pending') return;
    updateCard(id, { ...card, status: 'working', error: null });
    try {
      let result;
      if (card.kind === 'comment') {
        result = await actions.addComment({ interactionId: card.interactionId, comment: card.text });
      } else if (card.complete) {
        result = await actions.completeInteraction({ interactionId: card.interactionId, comment: card.comment });
      } else {
        result = await actions.transitionInteraction({
          interactionId: card.interactionId,
          expectedStageId: card.expectedStageId,
          toStageId: card.toStageId,
          kind: card.transitionKind,
          comment: card.comment,
        });
      }
      if (result?.undo) undoRef.current.set(id, result.undo);
      updateCard(id, { status: 'done' });
    } catch (error) {
      const { title, hint } = describeError(error);
      updateCard(id, { status: 'pending', error: `${title}. ${hint}` });
    }
  }, [actions, updateCard]);

  const undoCard = useCallback((id) => {
    undoRef.current.get(id)?.();
    undoRef.current.delete(id);
    updateCard(id, { status: 'undone' });
  }, [updateCard]);

  const cancelCard = useCallback((id) => updateCard(id, { status: 'cancelled' }), [updateCard]);
  const canUndo = useCallback((id) => undoRef.current.has(id), []);

  // ---------- Ответы ----------

  const applyEffect = useCallback((id, result) => {
    const { effect } = result;
    if (!effect) return;
    if (effect.type === 'navigate') {
      if (effect.view) writePersistentState('interactions:view', effect.view);
      navigate(effect.path);
    }
    if (effect.type === 'download') downloadReport(id, result.card);
    if (effect.type === 'commit') commitCard(id, result.card);
  }, [navigate, downloadReport, commitCard]);

  const reply = useCallback((result, source) => {
    const id = createId('m');
    setMessages((current) => [
      ...current,
      { id, role: 'assistant', at: new Date().toISOString(), source, text: result.text ?? '', card: result.card, suggestions: result.suggestions, filters: result.filters },
    ].slice(-HISTORY_LIMIT));
    applyEffect(id, result);
    if (contextRef.current.settings.speak) speak(result.text);
  }, [setMessages, applyEffect]);

  const executionContext = () => {
    const context = contextRef.current;
    return { ...context, now: new Date(), previousFilters: [...context.messages].reverse().find((message) => message.filters)?.filters };
  };

  const runCall = useCallback((call, label) => {
    if (label) append({ role: 'user', text: label });
    reply(executeTool(call, executionContext()), 'local');
  }, [append, reply]);

  /** Решение локального разбора с учётом режима «Подсказки». */
  const answerLocally = (local, context) => {
    if (local.kind === 'answer') return local.article ? articleAnswer(local.article) : local;
    const guideId = GUIDE_FOR_TOOL[local.name];
    if (context.settings.mode === 'guide' && guideId) {
      const article = context.knowledge.find((item) => item.id === guideId);
      if (article) return articleAnswer(article, { name: local.name, args: local.args });
    }
    return executeTool(local, context);
  };

  const askModel = async (message, context, signal) => {
    const history = context.messages
      .filter((item) => item.text && !item.error)
      .slice(-MODEL_HISTORY)
      .map((item) => ({ role: item.role, content: item.text.slice(0, MODEL_TEXT_LIMIT) }));
    const response = await apiClient.chatWithAssistant(
      { message: message.slice(0, MODEL_TEXT_LIMIT), history, page, mode: context.settings.mode, detail: context.settings.detail },
      { signal },
    );
    if (response.type !== 'action' || !response.action) return { text: response.message };

    const call = resolveModelCall(response.action, message, context);
    if (context.settings.mode === 'guide' && (MUTATING_TOOLS.has(call.name) || GUIDE_FOR_TOOL[call.name])) {
      return answerLocally({ kind: 'tool', ...call }, context);
    }
    const result = executeTool(call, context);
    return response.message ? { ...result, text: `${response.message}\n\n${result.text}` } : result;
  };

  const send = useCallback(async (input) => {
    const message = input.trim();
    if (!message || busy) return;
    append({ role: 'user', text: message });

    const context = executionContext();
    const { engine } = context.settings;
    const local = engine === 'ai' ? null : interpretLocally(message, context);
    if (local) {
      reply(answerLocally(local, context), 'local');
      return;
    }

    const modelReady = engine !== 'local' && model.state !== 'disabled' && (model.state !== 'offline' || model.stale);
    if (modelReady) {
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      try {
        reply(await askModel(message, context, controller.signal), 'ai');
        return;
      } catch (error) {
        if (controller.signal.aborted) {
          reply({ text: 'Остановлено.' }, 'local');
          return;
        }
        model.refresh();
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    }

    const fallback = engine === 'ai' ? interpretLocally(message, context) : null;
    if (fallback) {
      reply(answerLocally(fallback, context), 'local');
      return;
    }
    reply({
      text: engine === 'local'
        ? 'Не понял запрос. Попробуйте сформулировать командой — например, «Отчёт по КФУ за март в PDF» — или выберите подсказку.'
        : 'Не понял запрос, а ИИ-модель сейчас недоступна, поэтому я понимаю только команды и вопросы из справки. Попробуйте так:',
      suggestions: FALLBACK_SUGGESTIONS,
    }, 'local');
  }, [append, reply, busy, model, page]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    undoRef.current.clear();
    setMessages([]);
  }, [setMessages]);

  /** Переписка — настоящим файлом .txt, чтобы переслать коллеге или приложить к задаче. */
  const exportChat = useCallback(() => {
    const lines = contextRef.current.messages.map((message) => {
      const author = message.role === 'user' ? 'Вы' : 'Помощник';
      const report = message.card?.kind === 'report' ? `\n  [Отчёт: ${message.card.spec.name}, строк: ${message.card.rowCount}]` : '';
      return `${author} (${formatRelativeDateTime(message.at)}):\n${message.text}${report}`;
    });
    const content = [`Переписка с помощником — ${user?.name ?? ''}, ${formatDate(new Date())}`, '', ...lines].join('\n\n');
    downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), safeFileName(`Переписка с помощником ${formatDate(new Date())}`, 'txt'));
  }, [user?.name]);

  return {
    messages,
    busy,
    model,
    send,
    stop,
    clear,
    exportChat,
    runCall,
    cards: { downloadReport, commitCard, undoCard, cancelCard, canUndo, updateCard },
  };
}
