import { cn } from '../lib/cn.js';
import { Hint } from './Hint.jsx';
import { ArrowRightIcon } from './icons.js';
import styles from './StatTile.module.css';

/**
 * Плитка ключевого показателя: одно число, подпись и пояснение, откуда оно.
 * caption — строка под числом, hint — что это за показатель, всплывает при наведении на название.
 * Если передан href — плитка ведёт к списку, из которого посчитано число.
 */
export function StatTile({ label, value, caption, hint, icon: Icon, tone = 'brand', href }) {
  const Tag = href ? 'a' : 'div';
  return (
    <Tag className={cn(styles.tile, href && styles.link)} href={href ? `#${href}` : undefined}>
      <div className={styles.top}>
        <Hint text={hint}>
          <span className={styles.label}>{label}</span>
        </Hint>
        {Icon && (
          <span className={cn(styles.icon, styles[tone])}>
            <Icon size={20} fill="currentColor" />
          </span>
        )}
      </div>
      <strong className={styles.value}>{value}</strong>
      {caption && (
        <span className={styles.hint}>
          {caption}
          {href && <ArrowRightIcon size={16} fill="currentColor" className={styles.arrow} />}
        </span>
      )}
    </Tag>
  );
}
