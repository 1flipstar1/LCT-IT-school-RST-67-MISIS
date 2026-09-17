import styles from './PageLoader.module.css';

export function PageLoader({ label = 'Загружаем страницу' }) {
  return (
    <div className={styles.loader} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
