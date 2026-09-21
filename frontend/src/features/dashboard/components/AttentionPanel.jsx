import { Link } from '../../../app/router.jsx';
import { plural } from '../../../domain/format.js';
import { SLA_STATE } from '../../../domain/workflow.js';
import { Avatar } from '../../../ui/Avatar.jsx';
import { ButtonLink } from '../../../ui/Button.jsx';
import { Card, CardHeader } from '../../../ui/Card.jsx';
import { EmptyState } from '../../../ui/EmptyState.jsx';
import { ArrowRightIcon, SuccessIcon } from '../../../ui/icons.js';
import { SlaBadge } from '../../interactions/components/SlaBadge.jsx';
import styles from './AttentionPanel.module.css';

/**
 * «Требуют внимания» — этапы, у которых вышел или скоро выйдет срок, самые срочные сверху.
 * rows — уже отфильтрованные и отсортированные взаимодействия; показываются первые limit.
 */
export function AttentionPanel({ rows, limit, showManager }) {
  const overdue = rows.filter((row) => row.sla.state === SLA_STATE.overdue).length;
  const soon = rows.length - overdue;

  return (
    <Card className={styles.panel}>
      <CardHeader
        title="Требуют внимания"
        hint="Взаимодействия, у которых срок этапа истёк или истекает в ближайшие дни. Начните с верхних — у них меньше всего времени."
        className={styles.header}
        description={
          rows.length === 0
            ? 'Все этапы идут в срок'
            : `${overdue} ${plural(overdue, ['просрочено', 'просрочено', 'просрочено'])} · ${soon} со сроком до 3 дней`
        }
        actions={
          rows.length > limit && (
            <ButtonLink to="/interactions?attention=1" variant="ghost" size="s">
              Все {rows.length}
            </ButtonLink>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={SuccessIcon} title="Всё в срок" description="Когда у этапа начнёт подходить срок, взаимодействие появится здесь." />
      ) : (
        <ul className={styles.list}>
          {rows.slice(0, limit).map((row) => (
            <li key={row.id}>
              <Link to={`/interactions/${row.id}`} className={styles.item}>
                <span className={styles.main}>
                  <span className={styles.title}>{row.university.name}</span>
                  <span className={styles.meta}>
                    {row.direction.name} · Этап {row.progress.step} из {row.progress.total}: {row.stage.name}
                  </span>
                </span>
                <SlaBadge sla={row.sla} tone="accent" />
                {showManager && row.manager && (
                  <span className={styles.manager} title={row.manager.name}>
                    <Avatar name={row.manager.name} size="s" />
                  </span>
                )}
                <ArrowRightIcon size={20} fill="currentColor" className={styles.arrow} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
