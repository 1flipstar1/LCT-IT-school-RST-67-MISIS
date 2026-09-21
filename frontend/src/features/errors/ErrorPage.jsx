import { useSession } from '../../auth/SessionProvider.jsx';
import { ERROR_CODES, errorNumber, isRetryable } from '../../domain/errors.js';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { ErrorIcon, RefreshIcon } from '../../ui/icons.js';
import styles from './ErrorPage.module.css';

/**
 * Страница ошибки: крупный номер, человеческое объяснение и понятный выход.
 * Временные сбои (сервер, сеть) предлагают повторить: onRetry, а без него — перезагрузка страницы.
 * Истёкшая сессия (401) ведёт на вход, остальные ошибки — на главную.
 */
export function ErrorPage({ code, onRetry }) {
  const known = ERROR_CODES[code] ? code : 'APP-500';
  const { title, hint } = ERROR_CODES[known];
  const number = errorNumber(known);
  const { logout } = useSession();
  useDocumentTitle(title);

  const isSessionExpired = known === 'AUTH-401';
  const retry = isRetryable(known) ? (onRetry ?? (() => window.location.reload())) : null;

  return (
    <div className={styles.page}>
      {number ? (
        <p className={styles.number} aria-hidden="true">
          {number}
        </p>
      ) : (
        <span className={styles.icon}>
          <ErrorIcon size={28} fill="currentColor" />
        </span>
      )}
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.hint}>{hint}</p>
      <div className={styles.actions}>
        {isSessionExpired && (
          <Button variant="primary" onClick={logout}>
            Войти снова
          </Button>
        )}
        {retry && (
          <Button variant="primary" icon={RefreshIcon} onClick={retry}>
            Попробовать снова
          </Button>
        )}
        <ButtonLink to="/" variant={isSessionExpired || retry ? 'outline' : 'primary'}>
          На главную
        </ButtonLink>
        <ButtonLink to="/help?section=errors" variant="ghost">
          Все коды ошибок
        </ButtonLink>
      </div>
      <p className={styles.code}>Код ошибки: {known} — назовите его поддержке, так причину найдут быстрее.</p>
    </div>
  );
}
