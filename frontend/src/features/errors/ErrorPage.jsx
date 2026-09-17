import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { ERROR_CODES } from '../../domain/errors.js';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { ErrorIcon } from '../../ui/icons.js';
import styles from './ErrorPage.module.css';

/** Полноэкранная ошибка: код, человеческое объяснение и понятный выход. */
export function ErrorPage({ code, onRetry }) {
  const { title, hint } = ERROR_CODES[code] ?? ERROR_CODES['APP-500'];
  useDocumentTitle(title);

  return (
    <div className={styles.page}>
      <span className={styles.icon}>
        <ErrorIcon size={28} fill="currentColor" />
      </span>
      <p className={styles.code}>Код ошибки: {code}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.hint}>{hint}</p>
      <div className={styles.actions}>
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Обновить страницу
          </Button>
        )}
        <ButtonLink to="/" variant={onRetry ? 'outline' : 'primary'}>
          На главную
        </ButtonLink>
        <ButtonLink to="/help?section=errors" variant="ghost">
          Все коды ошибок
        </ButtonLink>
      </div>
    </div>
  );
}
