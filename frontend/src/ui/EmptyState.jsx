import styles from './EmptyState.module.css';

/** Пустое состояние: всегда объясняет, почему пусто, и предлагает следующий шаг. */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className={styles.empty}>
      {Icon && (
        <span className={styles.icon}>
          <Icon size={24} fill="currentColor" />
        </span>
      )}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
