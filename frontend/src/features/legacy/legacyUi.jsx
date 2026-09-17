import { Button as AtomaroButton } from '@atomaro/ui-kit';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowRightIcon, CloseIcon, MoreIcon, SearchIcon } from '../../ui/icons.js';
import { universityLogo } from './legacyData.js';
import './legacy.css';

/**
 * Мелкие элементы прежнего дизайна (ветка main): шапка страницы, кнопка, KPI-плитка,
 * поиск и карточка вуза. Разметка и классы — как в main, стили берутся из legacy.css.
 */

/**
 * Обёртка экрана. Старый styles.css глобальный, поэтому он изолирован под класс .legacy —
 * любой перенесённый экран обязан рендериться внутри этого контейнера.
 */
export function LegacyScreen({ children }) {
  return <div className="legacy">{children}</div>;
}

export function PageHeader({ title, children }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      <div className="page-actions">{children}</div>
    </div>
  );
}

/** Остальные props пробрасываются: так кнопку можно передать в Dialog.Close через render. */
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

export function Kpi({ title, value, change, note, icon, tone, warning }) {
  return (
    <div className="kpi">
      <div className={`kpi-icon ${tone}`}>{icon}</div>
      <div className="kpi-body">
        <span>{title}</span>
        <strong>{value}</strong>
        <div>
          <b className={warning ? 'warning' : ''}>{change}</b>
          <small>{note}</small>
        </div>
      </div>
      <MoreIcon className="kpi-more" size={17} fill="currentColor" />
    </div>
  );
}

export function SearchField({ value, onChange, placeholder }) {
  return (
    <div className="search">
      <SearchIcon size={17} fill="currentColor" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
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

/** Карточка вуза из main: сводка, текущие взаимодействия и кнопки. */
export function UniversityModal({ university, onClose, onSave }) {
  const interactions = [
    ['МойОфис', 'Информационные системы', 'Подписание документов'],
    ['Р7-Офис', 'Программная инженерия', 'Обмен документами'],
    ['Контур', 'Аналитика данных', 'Контроль исполнения'],
  ];

  return (
    <Dialog.Root open={Boolean(university)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Портал выносит окно из .legacy, поэтому класс добавлен и здесь. */}
        <div className="legacy">
          <Dialog.Backdrop className="modal-backdrop" />
          <Dialog.Viewport className="modal-viewport">
            <Dialog.Popup className="modal">
              <Dialog.Close className="modal-close" aria-label="Закрыть">
                <CloseIcon size={18} fill="currentColor" />
              </Dialog.Close>
              <div className="modal-heading">
                <span className="uni-logo large">{universityLogo(university ?? '')}</span>
                <div>
                  <Dialog.Title render={<h2 />}>{university}</Dialog.Title>
                  <Dialog.Description className="muted">Последнее обновление сегодня в 10:24</Dialog.Description>
                </div>
              </div>
              <div className="modal-stats">
                <div>
                  <span>Активных взаимодействий</span>
                  <b>4</b>
                </div>
                <div>
                  <span>Текущая конверсия</span>
                  <b>42%</b>
                </div>
                <div>
                  <span>Менеджер</span>
                  <b>Алина Воронова</b>
                </div>
              </div>
              <h3>Текущие взаимодействия</h3>
              {interactions.map(([product, direction, status]) => (
                <div className="modal-interaction" key={product}>
                  <div>
                    <b>{product}</b>
                    <span>{direction}</span>
                  </div>
                  <span className="status-tag blue">{status}</span>
                  <ArrowRightIcon size={17} fill="currentColor" />
                </div>
              ))}
              <div className="modal-footer">
                <Dialog.Close render={<LegacyButton />}>Закрыть</Dialog.Close>
                <LegacyButton primary onClick={onSave}>
                  Редактировать вуз
                </LegacyButton>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
