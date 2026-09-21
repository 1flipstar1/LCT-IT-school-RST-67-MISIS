import styles from './charts.module.css';

/** Заглушка вместо пустого графика: пустые оси выглядят как ошибка, а текст объясняет, что происходит. */
export function ChartEmpty({ children = 'Нет данных для выбранных фильтров' }) {
  return <div className={styles.empty}>{children}</div>;
}
