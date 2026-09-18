import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { CloseIcon } from './icons.js';
import styles from './SidePanel.module.css';

/**
 * Панель, выезжающая справа, — для настроек, которые не нужны на экране постоянно (например, фильтры).
 * Устроена как модальный диалог Base UI: фокус остаётся внутри, закрывается по Esc и клику по фону.
 * На телефоне занимает всю ширину экрана.
 */
export function SidePanel({ open, onOpenChange, title, description, children, footer }) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={styles.backdrop} />
        <BaseDialog.Popup className={styles.panel}>
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
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
