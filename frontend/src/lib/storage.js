/**
 * Безопасная обёртка над Web Storage: в приватном режиме или при заполненном хранилище
 * браузер бросает исключения — приложение при этом должно продолжать работать.
 */
function createStorage(getStorage) {
  return {
    read(key, fallback = null) {
      try {
        const raw = getStorage().getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        getStorage().setItem(key, JSON.stringify(value));
      } catch {
        // Кэш — удобство, а не источник истины: молча продолжаем без него.
      }
    },
    remove(key) {
      try {
        getStorage().removeItem(key);
      } catch {
        // См. write.
      }
    },
  };
}

export const localStore = createStorage(() => window.localStorage);
export const sessionStore = createStorage(() => window.sessionStorage);
