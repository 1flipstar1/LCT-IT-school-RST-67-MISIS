import { getStageIndex, PHASES } from '../../../domain/workflow.js';
import { cn } from '../../../lib/cn.js';
import { CheckIcon } from '../../../ui/icons.js';
import styles from './StageStepper.module.css';

const STATUS_LABEL = { done: 'пройден', current: 'текущий этап', upcoming: 'впереди', skipped: 'пропущен' };

/** Статус каждого этапа для конкретного взаимодействия с учётом пропущенных необязательных этапов. */
export function getStageStatuses(row, events) {
  const currentIndex = getStageIndex(row.workflow, row.stageId);
  const visited = new Set(events.filter((event) => event.interactionId === row.id).flatMap((event) => [event.toStageId, event.fromStageId]));

  return row.workflow.stages.map((stage, index) => {
    if (index === currentIndex) return { stage, status: row.completedAt ? 'done' : 'current' };
    if (index > currentIndex) return { stage, status: 'upcoming' };
    return { stage, status: stage.optional && !visited.has(stage.id) ? 'skipped' : 'done' };
  });
}

/** Вертикальный путь по этапам, сгруппированный по фазам. */
export function StageStepper({ row, events }) {
  const statuses = getStageStatuses(row, events);

  return (
    <div className={styles.stepper}>
      {PHASES.map((phase) => {
        const items = statuses.filter((item) => item.stage.phase === phase.id);
        if (items.length === 0) return null;
        return (
          <div key={phase.id} className={styles.phase}>
            <p className={styles.phaseLabel}>{phase.label}</p>
            <ol className={styles.list}>
              {items.map(({ stage, status }) => {
                const number = getStageIndex(row.workflow, stage.id) + 1;
                return (
                  <li key={stage.id} className={cn(styles.step, styles[status])} aria-current={status === 'current' ? 'step' : undefined}>
                    <span className={styles.marker} aria-hidden="true">
                      {status === 'done' ? <CheckIcon size={16} fill="currentColor" /> : number}
                    </span>
                    <span className={styles.text}>
                      <span className={styles.name}>{stage.name}</span>
                      <span className="visually-hidden">— {STATUS_LABEL[status]}</span>
                      {status === 'skipped' && <span className={styles.note}>Пропущен</span>}
                      {status === 'current' && <span className={styles.note}>Сейчас здесь</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
