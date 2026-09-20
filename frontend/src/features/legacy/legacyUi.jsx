import { Button as AtomaroButton } from '@atomaro/ui-kit';
import { universityLogo } from './legacyData.js';
import './legacy.css';

/**
 * Мелкие элементы прежнего дизайна (ветка main): шапка страницы, кнопка, KPI-плитка
 * и ячейка вуза. Разметка и классы — как в main, стили берутся из legacy.css.
 */

/**
 * Обёртка экрана. Старый styles.css глобальный, поэтому он изолирован под класс .legacy —
 * любой перенесённый экран обязан рендериться внутри этого контейнера.
 */
export function LegacyScreen({ children, className = '' }) {
  return <div className={`legacy ${className}`.trim()}>{children}</div>;
}

export function PageHeader({ title, children }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      <div className="page-actions">{children}</div>
    </div>
  );
}

/** Остальные props пробрасываются в кнопку atomaro как есть. */
export function LegacyButton({ children, primary = false, icon, className = '', ...rest }) {
  return (
    <AtomaroButton
      className={`button atomaro-button ${primary ? 'primary' : ''} ${className}`.trim()}
      variant={primary ? 'primary' : 'outline'}
      iconPrefix={icon}
      label={children}
      {...rest}
    />
  );
}

export function Kpi({ title, value, icon, tone }) {
  return (
    <div className="kpi">
      <div className={`kpi-icon ${tone}`}>{icon}</div>
      <div className="kpi-body">
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

/** Логотип вуза и его название — ячейка таблиц и карточек прежнего дизайна. */
export function UniversityCell({ name, children }) {
  return (
    <div className="uni-cell">
      <span className="uni-logo">{universityLogo(name)}</span>
      {children ?? <b>{name}</b>}
    </div>
  );
}
