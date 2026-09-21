import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AtomaroToastModule from '@atomaro/ui-kit/components/Notifications/ToastNotification/ToastNotification';
import { gsap } from 'gsap';
import { interopDefault } from '../lib/interopDefault.js';
import styles from './Toast.module.css';

const AtomaroToast = interopDefault(AtomaroToastModule);
const ToastContext = createContext(null);
const DURATION_MS = 6000;

function noop() {}

function ToastItem({ toast, remove }) {
  const wrapper = useRef(null);
  const closing = useRef(false);
  const reducedMotion = useRef(false);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const node = wrapper.current;
    if (!node || reducedMotion.current) {
      remove(toast.id);
      return;
    }
    gsap.killTweensOf(node);
    gsap.to(node, {
      y: 12,
      scale: 0.96,
      opacity: 0,
      height: 0,
      marginBottom: 0,
      duration: 0.24,
      ease: 'power2.in',
      onComplete: () => remove(toast.id),
    });
  }, [remove, toast.id]);

  useLayoutEffect(() => {
    const node = wrapper.current;
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion.current) {
      gsap.fromTo(node, { y: 28, scale: 0.94, opacity: 0 }, {
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.55,
        ease: 'back.out(1.35)',
      });
    }
    const timer = setTimeout(dismiss, DURATION_MS);
    return () => {
      clearTimeout(timer);
      gsap.killTweensOf(node);
    };
  }, [dismiss]);

  const undo = toast.undo ? [{
    label: 'Отменить',
    variant: 'tertiary',
    size: 's',
    action: () => {
      toast.undo();
      dismiss();
    },
  }] : undefined;

  return (
    <div ref={wrapper} className={styles.item}>
      <AtomaroToast
        id={toast.id}
        className={styles.toast}
        colorScheme={toast.tone}
        position="bottomRight"
        title={toast.message}
        subtitle={toast.code ? `Код: ${toast.code}` : undefined}
        role={toast.tone === 'error' ? 'alert' : undefined}
        icon
        closeButton
        actionButtons={undo}
        onOpen={noop}
        onClose={dismiss}
      />
    </div>
  );
}

/** Короткие уведомления с возможностью отменить последнее действие. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const show = useCallback(({ message, tone = 'success', undo, code }) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.slice(-2), { id, message, tone, undo, code }]);
  }, []);
  const api = useMemo(() => ({
    success: (message, options) => show({ message, tone: 'success', ...options }),
    error: (message, options) => show({ message, tone: 'error', ...options }),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} remove={remove} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast нужно вызывать внутри <ToastProvider>');
  return toast;
}
