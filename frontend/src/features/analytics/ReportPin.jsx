import { cn } from '../../lib/cn.js';
import { CheckIcon, ReportIcon } from '../../ui/icons.js';
import styles from './AnalyticsPage.module.css';

/**
 * Кнопка «В отчёт» на карточке аналитики. Отмеченные показатели и графики попадают
 * в начало PDF-отчёта на странице «Отчёты». compact — только значок (для плиток KPI).
 */
export function ReportPin({ active, title, onToggle, compact = false }) {
  const label = active ? `Убрать «${title}» из отчёта` : `Добавить «${title}» в отчёт`;
  return (
    <button
      type="button"
      data-tour="report-pin"
      className={cn(styles.reportPin, active && styles.reportPinActive, compact && styles.reportPinCompact)}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      {active ? <CheckIcon size={16} fill="currentColor" /> : <ReportIcon size={16} fill="currentColor" />}
      {!compact && <span>{active ? 'В отчёте' : 'В отчёт'}</span>}
    </button>
  );
}
