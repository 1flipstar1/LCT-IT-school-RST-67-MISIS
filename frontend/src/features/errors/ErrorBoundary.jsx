import { Component } from 'react';
import { codeForRenderError } from '../../domain/errors.js';
import { ErrorPage } from './ErrorPage.jsx';

/**
 * Перехватывает ошибки рендера: вместо белого экрана — страница ошибки. Если не догрузился файл
 * страницы (пропала сеть), показывается «Нет подключения к интернету», иначе — APP-500.
 * В продуктиве здесь же отправка ошибки в систему мониторинга.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[${codeForRenderError(error)}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) return <ErrorPage code={codeForRenderError(this.state.error)} onRetry={() => window.location.reload()} />;
    return this.props.children;
  }
}
