import { cn } from '../lib/cn.js';
import styles from './Badge.module.css';

/**
 * Метка статуса. tone: brand | neutral | success | warning | danger.
 * Статусные цвета всегда идут вместе с иконкой или текстом — цвет не единственный носитель смысла.
 */
export function Badge({ tone = 'neutral', icon: Icon, children, className, title }) {
  return (
    <span className={cn(styles.badge, styles[tone], className)} title={title}>
      {Icon && <Icon size={14} fill="currentColor" />}
      <span className={styles.label}>{children}</span>
    </span>
  );
}
