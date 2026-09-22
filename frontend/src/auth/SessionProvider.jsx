import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEMO_USER_BY_ROLE } from '../data/catalogs.js';
import { can } from '../domain/roles.js';
import { sessionStore } from '../lib/storage.js';
import { useStoreState } from '../store/StoreProvider.jsx';

const SESSION_KEY = 'crm.session';
const SessionContext = createContext(null);

/**
 * Сессия пользователя. В продуктиве вход выполняется через Keycloak (OIDC):
 * login() перенаправляет на страницу Keycloak, роль приходит в токене.
 * На демо-стенде роль выбирается на экране входа.
 */
export function SessionProvider({ children }) {
  const { users } = useStoreState();
  const [session, setSession] = useState(() => sessionStore.read(SESSION_KEY));

  const login = useCallback((role) => {
    const next = { role };
    sessionStore.write(SESSION_KEY, next);
    setSession(next);
  }, []);

  const logout = useCallback(() => {ч
    sessionStore.remove(SESSION_KEY);
    setSession(null);
    window.location.hash = '/';
  }, []);

  const value = useMemo(() => {
    const role = session?.role ?? null;
    const user = role ? users.find((item) => item.id === DEMO_USER_BY_ROLE[role]) ?? null : null;
    return { user, role, login, logout, can: (permission) => can(role, permission) };
  }, [session, users, login, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession нужно вызывать внутри <SessionProvider>');
  return session;
}
