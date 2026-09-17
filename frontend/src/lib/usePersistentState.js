import { useCallback, useEffect, useRef, useState } from 'react';
import { localStore } from './storage.js';

/**
 * useState, который переживает перезагрузку страницы: фильтры, выбранный вид, черновики.
 * Это «кэш действий пользователя» из ТЗ — человек возвращается ровно туда, где остановился.
 */
export function usePersistentState(key, initialValue, storage = localStore) {
  const [value, setValue] = useState(() => storage.read(key, initialValue));
  const initialRef = useRef(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => storage.write(key, value), 250);
    return () => clearTimeout(timer);
  }, [key, value, storage]);

  const reset = useCallback(() => setValue(initialRef.current), []);

  return [value, setValue, reset];
}
