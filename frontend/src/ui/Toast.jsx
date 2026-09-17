import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/cn.js';
import { CloseIcon, ErrorIcon, SuccessIcon } from './icons.js';
import styles from './Toast.module.css';

const ToastContext = createContext(null);
const DURATION_MS = 6000;

/**
 * Короткие уведомления о результате действия. Если передать undo — появится «Отменить»:
 * случайный перевод этапа исправляется в один клик, без обращения к руководителю.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    ({ message, tone = 'success', undo, code }) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current.slice(-2), { id, message, tone, undo, code }]);
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS));
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (message, options) => show({ message, tone: 'success', ...options }),
      error: (message, options) => show({ message, tone: 'error', ...options }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'error' ? ErrorIcon : SuccessIcon;
          return (
            <div key={toast.id} className={cn(styles.toast, styles[toast.tone])}>
              <Icon size={20} fill="currentColor" className={styles.icon} />
              <p className={styles.message}>
                {toast.message}
                {toast.code && <span className={styles.code}>Код: {toast.code}</span>}
              </p>
              {toast.undo && (
                <button
                  type="button"
                  className={styles.undo}
                  onClick={() => {
                    toast.undo();
                    dismiss(toast.id);
                  }}
                >
                  Отменить
                </button>
              )}
              <button type="button" className={styles.close} aria-label="Закрыть уведомление" onClick={() => dismiss(toast.id)}>
                <CloseIcon size={18} fill="currentColor" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast нужно вызывать внутри <ToastProvider>');
  return toast;
}
