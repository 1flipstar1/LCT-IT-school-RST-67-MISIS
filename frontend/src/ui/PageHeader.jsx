import { Link } from '../app/router.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { ArrowLeftIcon } from './icons.js';
import styles from './PageHeader.module.css';

/** Шапка страницы: «назад», заголовок, метки и действия. */
export function PageHeader({ title, actions, back, meta }) {
  useDocumentTitle(title);

  return (
    <header className={styles.header}>
      {back && (
        <Link to={back.to} className={styles.back}>
          <ArrowLeftIcon size={16} fill="currentColor" />
          {back.label}
        </Link>
      )}
      <div className={styles.row}>
        <div className={styles.titles}>
          <h1 className={styles.title}>{title}</h1>
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}
