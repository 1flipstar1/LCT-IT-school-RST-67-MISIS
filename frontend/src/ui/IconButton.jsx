import { cn } from '../lib/cn.js';
import styles from './IconButton.module.css';

/** Кнопка-иконка. label обязателен: он читается экранными дикторами и показывается во всплывающей подсказке. */
export function IconButton({ icon: Icon, label, size = 'm', className, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} className={cn(styles.iconButton, styles[size], className)} {...rest}>
      <Icon size={size === 's' ? 16 : 20} fill="currentColor" />
    </button>
  );
}
