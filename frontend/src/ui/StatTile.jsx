import { cn } from '../lib/cn.js';
import { ArrowRightIcon } from './icons.js';
import styles from './StatTile.module.css';

/**
 * Плитка ключевого показателя: одно число, подпись и пояснение, откуда оно.
 * Если передан href — плитка ведёт к списку, из которого посчитано число.
 */
export function StatTile({ label, value, hint, icon: Icon, tone = 'brand', href }) {
  const Tag = href ? 'a' : 'div';
  return (
    <Tag className={cn(styles.tile, href && styles.link)} href={href ? `#${href}` : undefined}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {Icon && (
          <span className={cn(styles.icon, styles[tone])}>
            <Icon size={20} fill="currentColor" />
          </span>
        )}
      </div>
      <strong className={styles.value}>{value}</strong>
      {hint && (
        <span className={styles.hint}>
          {hint}
          {href && <ArrowRightIcon size={16} fill="currentColor" className={styles.arrow} />}
        </span>
      )}
    </Tag>
  );
}
