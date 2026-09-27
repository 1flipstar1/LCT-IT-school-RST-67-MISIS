import { createContext, useContext, useInsertionEffect, useState } from 'react';
import { useSession } from '../../auth/SessionProvider.jsx';
import { localStore } from '../../lib/storage.js';
import { normalizePreferences } from './preferences.js';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { user } = useSession();
  return <UserPreferences key={user?.id ?? 'guest'} userId={user?.id}>{children}</UserPreferences>;
}

function UserPreferences({ userId, children }) {
  const key = `profile:preferences:${userId ?? 'guest'}`;
  const [preferences, setPreferences] = useState(() => normalizePreferences(localStore.read(key)));
  const [error, setError] = useState('');
  // Set before descendant layout effects run on first mount, including GSAP effects.
  useInsertionEffect(() => {
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
    return () => { delete document.documentElement.dataset.reduceMotion; };
  }, [preferences.reduceMotion]);

  function update(patch) {
    const next = normalizePreferences({ ...preferences, ...patch });
    document.documentElement.dataset.reduceMotion = String(next.reduceMotion);
    setPreferences(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      setError('');
    } catch {
      setError('Настройки применены, но браузер не смог сохранить их. После перезагрузки они могут сброситься.');
    }
  }
  return <ProfileContext.Provider value={{ preferences, update, error }}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => useContext(ProfileContext);
