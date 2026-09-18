import { initials } from '../domain/format.js';
import { cn } from '../lib/cn.js';
import styles from './Avatar.module.css';

/**
 * variant="brand" — фирменный градиент для аватара текущего пользователя.
 * src — готовая картинка (см. ui/avatarImages.js); без неё рисуются инициалы.
 */
export function Avatar({ name, src, size = 'm', variant = 'soft', className }) {
  return (
    <span className={cn(styles.avatar, styles[size], styles[variant], src && styles.picture, className)} aria-hidden="true">
      {src ? <img src={src} alt="" className={styles.image} /> : initials(name)}
    </span>
  );
}

/** Аватар + имя (+ подпись) — так в интерфейсе показывается любой человек. */
export function Person({ name, caption, size = 's' }) {
  return (
    <span className={styles.person}>
      <Avatar name={name} size={size} />
      <span className={styles.personText}>
        <span className={styles.name}>{name}</span>
        {caption && <span className={styles.caption}>{caption}</span>}
      </span>
    </span>
  );
}
