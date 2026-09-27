import { createContext, useCallback, useContext, useEffect, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../../auth/SessionProvider.jsx';
import { localStore } from '../../lib/storage.js';
import { useActions } from '../../store/useActions.js';
import { normalizePreferences, samePreferences } from './preferences.js';
import { syncLayoutMode } from '../../lib/layoutMode.js';

const ProfileContext = createContext(null);

/** Состояние сохранения для подписи на странице настроек. */
export const SAVE_STATUS = { saved: 'saved', saving: 'saving', local: 'local' };

export function ProfileProvider({ children }) {
  const { user } = useSession();
  return <UserPreferences key={user?.id ?? 'guest'} userId={user?.id} server={user?.preferences}>{children}</UserPreferences>;
}

/**
 * Настройки применяются сразу, копия в браузере нужна, чтобы при следующем входе они действовали
 * до ответа сервера. На сервер изменения уходят по очереди и всегда в последнем виде:
 * быстрые переключения не перезапишут друг друга ответами вразнобой.
 */
function UserPreferences({ userId, server, children }) {
  const actions = useActions();
  const key = `profile:preferences:${userId ?? 'guest'}`;
  const [preferences, setPreferences] = useState(() => normalizePreferences(server ?? localStore.read(key)));
  const [status, setStatus] = useState(SAVE_STATUS.saved);
  const latestRef = useRef(preferences);
  const queueRef = useRef(Promise.resolve());
  const pendingRef = useRef(0);

  // Выставляется до layout-эффектов потомков, в том числе GSAP-анимаций первого экрана.
  useInsertionEffect(() => {
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
    return () => { delete document.documentElement.dataset.reduceMotion; };
  }, [preferences.reduceMotion]);

  // Масштаб интерфейса: tokens.css по умолчанию задаёт 110%, профиль его переопределяет.
  useInsertionEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(preferences.uiScale / 100));
  }, [preferences.uiScale]);

  // При другом масштабе вёрстке достаётся другая ширина — режим раскладки мог смениться.
  // Отдельным layout-эффектом: смена режима обновляет подписчиков, а из insertion-эффекта
  // React запрещает вызывать обновления.
  useLayoutEffect(() => {
    syncLayoutMode();
  }, [preferences.uiScale]);

  // Настройки поменяли на другом компьютере — берём серверные, если сами сейчас ничего не отправляем.
  const serverKey = server ? JSON.stringify(normalizePreferences(server)) : null;
  useEffect(() => {
    if (!serverKey || pendingRef.current > 0) return;
    const next = JSON.parse(serverKey);
    if (samePreferences(latestRef.current, next)) return;
    latestRef.current = next;
    setPreferences(next);
    localStore.write(key, next);
  }, [serverKey, key]);

  const update = useCallback((patch) => {
    const next = normalizePreferences({ ...latestRef.current, ...patch });
    latestRef.current = next;
    document.documentElement.dataset.reduceMotion = String(next.reduceMotion);
    setPreferences(next);
    localStore.write(key, next);
    if (!userId) return;

    pendingRef.current += 1;
    setStatus(SAVE_STATUS.saving);
    queueRef.current = queueRef.current
      .then(() => actions.updatePreferences(latestRef.current))
      // Пока в очереди есть более свежие изменения, подпись остаётся «Сохраняем…».
      .then(() => { if (pendingRef.current === 1) setStatus(SAVE_STATUS.saved); })
      .catch(() => setStatus(SAVE_STATUS.local))
      .finally(() => { pendingRef.current -= 1; });
  }, [actions, key, userId]);

  const value = useMemo(() => ({ preferences, update, status }), [preferences, update, status]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => useContext(ProfileContext);
