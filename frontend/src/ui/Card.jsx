import { cn } from '../lib/cn.js';
import styles from './Card.module.css';

/** Белая панель — основной контейнер контента. padding="none" — для таблиц во всю ширину. */
export function Card({ as: Tag = 'section', padding = 'm', className, children, ...rest }) {
  return (
    <Tag className={cn(styles.card, styles[`padding-${padding}`], className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Заголовок карточки: название, пояснение и действия справа. */
export function CardHeader({ title, description, actions, className }) {
  return (
    <header className={cn(styles.header, className)}>
      <div className={styles.titles}>
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
