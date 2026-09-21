import { Link } from '../app/router.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { Hint } from './Hint.jsx';
import { ArrowLeftIcon } from './icons.js';
import styles from './PageHeader.module.css';

/** Шапка страницы: «назад», заголовок, метки и действия. hint — что это за раздел, всплывает при наведении на заголовок. */
export function PageHeader({ title, hint, actions, back, meta }) {
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
          <Hint text={hint} placement="bottomRight">
            <h1 className={styles.title}>{title}</h1>
          </Hint>
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}
