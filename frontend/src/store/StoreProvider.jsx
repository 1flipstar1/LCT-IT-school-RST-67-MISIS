import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { loadState, saveState } from './persistence.js';
import { reducer } from './reducer.js';

const StateContext = createContext(null);
const DispatchContext = createContext(null);

/**
 * Состояние и dispatch — в разных контекстах: компоненты, которые только вызывают действия,
 * не перерисовываются при каждом изменении данных.
 */
export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const stateRef = useRef(state);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const timer = setTimeout(() => saveState(state), 300);
    return () => clearTimeout(timer);
  }, [state]);

  const api = useMemo(() => ({ dispatch, getState: () => stateRef.current }), []);

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
