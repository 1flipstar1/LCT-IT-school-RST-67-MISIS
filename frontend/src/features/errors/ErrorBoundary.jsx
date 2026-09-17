import { Component } from 'react';
import { ErrorPage } from './ErrorPage.jsx';

/**
 * Перехватывает непредвиденные ошибки рендера: вместо белого экрана — страница с кодом APP-500.
 * В продуктиве здесь же отправка ошибки в систему мониторинга.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[APP-500]', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <ErrorPage code="APP-500" onRetry={() => window.location.reload()} />;
    return this.props.children;
  }
}
