import { cn } from '../lib/cn.js';
import { Hint } from './Hint.jsx';
import styles from './Card.module.css';

/** Белая панель — основной контейнер контента. padding="none" — для таблиц во всю ширину. */
export function Card({ as: Tag = 'section', padding = 'm', className, children, ...rest }) {
  return (
    <Tag className={cn(styles.card, styles[`padding-${padding}`], className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Заголовок карточки: название, пояснение и действия справа. hint — что это за блок, всплывает при наведении на название. */
export function CardHeader({ title, description, hint, actions, className }) {
  return (
    <header className={cn(styles.header, className)}>
      <div className={styles.titles}>
        <Hint text={hint}>
          <h2 className={styles.title}>{title}</h2>
        </Hint>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
