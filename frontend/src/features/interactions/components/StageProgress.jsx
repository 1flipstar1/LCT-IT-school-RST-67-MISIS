import styles from './StageProgress.module.css';

/** «Этап 6 из 14» + название + тонкая полоса прогресса: видно и где сейчас, и сколько осталось. */
export function StageProgress({ row }) {
  const { step, total, percent } = row.progress;
  return (
    <span className={styles.progress}>
      <span className={styles.label}>
        <span className={styles.step}>
          {step} из {total}
        </span>
        <span className={styles.name}>{row.stage.name}</span>
      </span>
      <span className={styles.track} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Этап ${step} из ${total}`}>
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}
