import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { apiClient } from '../api/client.js';
import { DEMO_USER_BY_ROLE } from '../data/catalogs.js';
import { can } from '../domain/roles.js';
import { useStoreApi, useStoreState } from '../store/StoreProvider.jsx';
import { clearStoredSession, readStoredSession, writeStoredSession } from './sessionStorage.js';

const SessionContext = createContext(null);

/**
 * Сессия пользователя. В продуктиве вход выполняется через Keycloak (OIDC):
 * login() перенаправляет на страницу Keycloak, роль приходит в токене.
 * На демо-стенде роль выбирается на экране входа.
 */
export function SessionProvider({ children }) {
  const { users } = useStoreState();
  const { rehydrate } = useStoreApi();
  const [session, setSession] = useState(readStoredSession);

  const login = useCallback(async (role) => {
    const authenticated = await apiClient.demoLogin(role);
    const next = {
      role: authenticated.user?.role ?? role,
      user: authenticated.user ?? null,
      accessToken: authenticated.accessToken,
      tokenType: authenticated.tokenType ?? 'Bearer',
      expiresAt: authenticated.expiresIn ? Date.now() + authenticated.expiresIn * 1_000 : null,
    };
    writeStoredSession(next);
    // Первый запрос state мог пройти до входа и получить 401 в production — повторяем уже с токеном.
    await rehydrate();
    setSession(next);
    return next.user;
  }, [rehydrate]);

  const logout = useCallback(() => {
    clearStoredSession();
    setSession(null);
    window.location.hash = '/';
  }, []);

  const value = useMemo(() => {
    const role = session?.role ?? session?.user?.role ?? null;
    const userId = session?.user?.id ?? DEMO_USER_BY_ROLE[role];
    const user = role ? users.find((item) => item.id === userId) ?? session?.user ?? null : null;
    return {
      user,
      role,
      accessToken: session?.accessToken ?? null,
      login,
      logout,
      can: (permission) => can(role, permission),
    };
  }, [session, users, login, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession нужно вызывать внутри <SessionProvider>');
  return session;
}
