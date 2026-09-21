import { ERROR_CODES, errorCodeForStatus, errorNumber, SERVER_ERROR_PAGES } from '../../domain/errors.js';
import { ButtonLink } from '../../ui/Button.jsx';
import { Card } from '../../ui/Card.jsx';
import { Hint } from '../../ui/Hint.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { ErrorArt } from './ErrorArt.jsx';
import styles from './ErrorGalleryPage.module.css';

/** Частые ошибки работы сайта по порядку статусов; 0 — запрос не дошёл до сервера (нет связи). */
const STATUSES = [400, 401, 403, 404, 408, 429, 500, 502, 503, 504, 505, 0];

/**
 * Витрина страниц ошибок: как система объясняет пользователю каждый частый сбой.
 * «Открыть» показывает страницу внутри приложения, «Версия для сервера» — статическую
 * страницу, которую отдаёт веб-сервер, когда само приложение не загружается.
 */
export function ErrorGalleryPage() {
  return (
    <>
      <PageHeader
        title="Страницы ошибок"
        hint="Что видит пользователь при частых сбоях: не найдена страница, нет прав, сервер недоступен, пропала связь. У каждой ошибки — понятный текст, действие и код для поддержки."
      />
      <div className={styles.grid}>
        {STATUSES.map((status) => {
          const code = errorCodeForStatus(status);
          const { title, hint } = ERROR_CODES[code];
          return (
            <Card key={status} className={styles.card}>
              <ErrorArt number={errorNumber(code)} className={styles.art} />
              <Hint text={hint}>
                <h2 className={styles.title}>{title}</h2>
              </Hint>
              <p className={styles.code}>{code}</p>
              <div className={styles.actions}>
                <ButtonLink to={`/error/${status}`} size="s">
                  Открыть
                </ButtonLink>
                {SERVER_ERROR_PAGES.includes(status) && (
                  <ButtonLink href={`/errors/${status}.html`} variant="ghost" size="s">
                    Версия для сервера
                  </ButtonLink>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
