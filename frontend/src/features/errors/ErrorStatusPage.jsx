import { errorCodeForStatus } from '../../domain/errors.js';
import { ErrorPage } from './ErrorPage.jsx';

/**
 * Адрес /error/:status — сюда приложение переводит, когда сервер ответил ошибкой («#/error/503»).
 * «Попробовать снова» возвращает на страницу, где случилась ошибка.
 */
export function ErrorStatusPage({ params }) {
  const code = errorCodeForStatus(Number(params.status)) ?? 'NOT-FOUND-404';
  const canGoBack = window.history.length > 1;
  return <ErrorPage code={code} onRetry={canGoBack ? () => window.history.back() : undefined} />;
}
