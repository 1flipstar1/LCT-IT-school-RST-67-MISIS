import { useCallback, useEffect, useRef, useState } from 'react';
import { localStore } from './storage.js';

const WRITE_EVENT = 'persistent-state:write';

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

  useEffect(() => {
    const handleWrite = (event) => {
      if (event.detail.key === key && event.detail.storage === storage) setValue(event.detail.value);
    };
    window.addEventListener(WRITE_EVENT, handleWrite);
    return () => window.removeEventListener(WRITE_EVENT, handleWrite);
  }, [key, storage]);

  const reset = useCallback(() => setValue(initialRef.current), []);

  return [value, setValue, reset];
}

/**
 * Записывает значение снаружи компонента: помощник так передаёт фильтры в «Отчёты» и «Взаимодействия».
 * Открытая страница получает значение сразу, закрытая — прочитает его из хранилища при открытии.
 */
export function writePersistentState(key, value, storage = localStore) {
  storage.write(key, value);
  window.dispatchEvent(new CustomEvent(WRITE_EVENT, { detail: { key, value, storage } }));
}
