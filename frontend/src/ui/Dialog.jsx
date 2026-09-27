import { useRef } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from '../lib/cn.js';
import { CloseIcon } from './icons.js';
import styles from './Dialog.module.css';

/**
 * Модальное окно на Base UI: фокус-ловушка, закрытие по Esc и клику по фону, aria-разметка.
 * На телефоне превращается в нижний лист на всю ширину.
 *
 * Фокус после закрытия возвращается туда, откуда окно открыли. Если того элемента уже нет
 * (карточка переехала в другую колонку доски, кнопка «Сменить этап» пропала у завершённого
 * взаимодействия), Base UI отдал бы фокус последнему живому элементу из своей истории — часто
 * это строка поиска, и она открывала бы выпадающий список. Поэтому запасной вариант — сама страница.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'm' }) {
  const openerRef = useRef(null);
  const wasOpenRef = useRef(false);
  // Запоминаем источник в момент открытия, до того как Base UI переведёт фокус внутрь окна.
  if (open && !wasOpenRef.current) openerRef.current = document.activeElement;
  wasOpenRef.current = open;

  const returnFocus = () => {
    const opener = openerRef.current;
    const target = opener?.isConnected && opener !== document.body ? opener : document.getElementById('main');
    target?.focus({ preventScroll: true });
    return false;
  };

  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={styles.backdrop} />
        <BaseDialog.Viewport className={styles.viewport}>
          <BaseDialog.Popup className={cn(styles.popup, styles[size])} finalFocus={returnFocus}>
            <header className={styles.header}>
              <div className={styles.titles}>
                <BaseDialog.Title className={styles.title}>{title}</BaseDialog.Title>
                {description && <BaseDialog.Description className={styles.description}>{description}</BaseDialog.Description>}
              </div>
              <BaseDialog.Close className={styles.close} aria-label="Закрыть">
                <CloseIcon size={20} fill="currentColor" />
              </BaseDialog.Close>
            </header>
            <div className={styles.body}>{children}</div>
            {footer && <footer className={styles.footer}>{footer}</footer>}
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/** Форма внутри диалога: кнопка отправки может жить в footer и ссылаться на форму через атрибут form. */
export function DialogForm({ id, onSubmit, children }) {
  return (
    <form id={id} onSubmit={onSubmit} noValidate className={styles.form}>
      {children}
    </form>
  );
}
