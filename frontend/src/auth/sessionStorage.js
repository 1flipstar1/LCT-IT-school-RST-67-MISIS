import { sessionStore } from '../lib/storage.js';

export const SESSION_KEY = 'crm.session';

export const readStoredSession = () => sessionStore.read(SESSION_KEY);
export const writeStoredSession = (session) => sessionStore.write(SESSION_KEY, session);
export const clearStoredSession = () => sessionStore.remove(SESSION_KEY);

/** Токен читается перед каждым запросом, поэтому новый вход не требует пересоздавать API-клиент. */
export function getStoredAccessToken() {
  return readStoredSession()?.accessToken ?? null;
}
