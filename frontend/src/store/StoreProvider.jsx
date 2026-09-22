import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { PageLoader } from '../ui/PageLoader.jsx';
import { hydrateState, isUsableState, loadState, persistState, saveState, stateCache } from './persistence.js';
import { ACTION, reducer } from './reducer.js';

const StateContext = createContext(null);
const DispatchContext = createContext(null);
const SAVE_DEBOUNCE_MS = 300;
const RETRY_DELAY_MS = 5_000;

/**
 * Состояние и dispatch — в разных контекстах: компоненты, которые только вызывают действия,
 * не перерисовываются при каждом изменении данных.
 */
export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  const revisionRef = useRef(null);
  const updatedAtRef = useRef(null);
  const pendingStateRef = useRef(null);
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(false);
  const hydrationIdRef = useRef(0);
  const syncGenerationRef = useRef(0);
  const skipPersistRef = useRef(false);
  const syncHydratedStateRef = useRef(false);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const flushPendingState = useCallback(async () => {
    if (savingRef.current || !pendingStateRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;

    const snapshot = pendingStateRef.current;
    const syncGeneration = syncGenerationRef.current;
    pendingStateRef.current = null;
    savingRef.current = true;
    let failed = false;
    saveState(snapshot, {
      revision: revisionRef.current,
      updatedAt: updatedAtRef.current,
      dirty: true,
    });

    try {
      const saved = await persistState(snapshot, revisionRef.current);
      if (syncGeneration !== syncGenerationRef.current) return;
      if (Number.isInteger(saved?.revision)) revisionRef.current = saved.revision;
      updatedAtRef.current = saved?.updatedAt ?? updatedAtRef.current;
      if (!pendingStateRef.current) {
        saveState(snapshot, {
          revision: revisionRef.current,
          updatedAt: updatedAtRef.current,
          dirty: false,
        });
      }
    } catch {
      if (syncGeneration !== syncGenerationRef.current) return;
      failed = true;
      // UI продолжает работать; последний снимок остаётся помеченным для повтора после восстановления связи.
      if (!pendingStateRef.current) pendingStateRef.current = snapshot;
      saveState(pendingStateRef.current, {
        revision: revisionRef.current,
        updatedAt: updatedAtRef.current,
        dirty: true,
      });
    } finally {
      savingRef.current = false;
      if (mountedRef.current && pendingStateRef.current) {
        saveTimerRef.current = setTimeout(flushPendingState, failed ? RETRY_DELAY_MS : SAVE_DEBOUNCE_MS);
      }
    }
  }, []);

  const queueStateSave = useCallback((nextState, delay = SAVE_DEBOUNCE_MS) => {
    pendingStateRef.current = nextState;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushPendingState, delay);
  }, [flushPendingState]);

  const rehydrate = useCallback(async (options = {}) => {
    syncGenerationRef.current += 1;
    pendingStateRef.current = null;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const hydrationId = ++hydrationIdRef.current;
    const snapshot = await hydrateState(undefined, stateCache, options);
    if (!mountedRef.current || hydrationId !== hydrationIdRef.current) return snapshot;

    revisionRef.current = snapshot.revision;
    updatedAtRef.current = snapshot.updatedAt;
    syncHydratedStateRef.current = snapshot.needsSync;
    skipPersistRef.current = true;
    stateRef.current = snapshot.state;
    dispatch({ type: ACTION.stateRestored, payload: snapshot.state });
    setReady(true);
    return snapshot;
  }, []);

  const applyServerSnapshot = useCallback((snapshot) => {
    if (!isUsableState(snapshot?.state) || !Number.isInteger(snapshot?.revision)) {
      throw new Error('Сервер вернул неполное состояние приложения.');
    }
    syncGenerationRef.current += 1;
    pendingStateRef.current = null;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    revisionRef.current = snapshot.revision;
    updatedAtRef.current = snapshot.updatedAt ?? null;
    skipPersistRef.current = true;
    stateRef.current = snapshot.state;
    saveState(snapshot.state, {
      revision: snapshot.revision,
      updatedAt: snapshot.updatedAt ?? null,
      dirty: false,
    });
    dispatch({ type: ACTION.stateRestored, payload: snapshot.state });
    setReady(true);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    rehydrate({ signal: controller.signal });

    return () => {
      mountedRef.current = false;
      controller.abort();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingStateRef.current) {
        saveState(pendingStateRef.current, {
          revision: revisionRef.current,
          updatedAt: updatedAtRef.current,
          dirty: true,
        });
      }
    };
  }, [rehydrate]);

  useEffect(() => {
    if (!ready) return undefined;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      if (syncHydratedStateRef.current) queueStateSave(state);
      syncHydratedStateRef.current = false;
      return undefined;
    }

    queueStateSave(state);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state, ready, queueStateSave]);

  useEffect(() => {
    const handleOnline = () => {
      if (pendingStateRef.current) queueStateSave(pendingStateRef.current, 0);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queueStateSave]);

  const api = useMemo(
    () => ({ dispatch, getState: () => stateRef.current, rehydrate, applyServerSnapshot, flush: flushPendingState }),
    [rehydrate, applyServerSnapshot, flushPendingState],
  );

  if (!ready) return <PageLoader label="Загружаем данные" />;

  return (
    <DispatchContext.Provider value={api}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </DispatchContext.Provider>
  );
}

export function useStoreState() {
  const state = useContext(StateContext);
  if (!state) throw new Error('useStoreState нужно вызывать внутри <StoreProvider>');
  return state;
}

export function useStoreApi() {
  const api = useContext(DispatchContext);
  if (!api) throw new Error('useStoreApi нужно вызывать внутри <StoreProvider>');
  return api;
}
