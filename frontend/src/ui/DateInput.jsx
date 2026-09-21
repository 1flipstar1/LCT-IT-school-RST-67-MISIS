import AtomaroInputDateModule from '@atomaro/ui-kit/components/InputDate/InputDate';
import { cn } from '../lib/cn.js';
import { interopDefault } from '../lib/interopDefault.js';
import styles from './DateInput.module.css';

const AtomaroInputDate = interopDefault(AtomaroInputDateModule);

const isoToDate = (iso) => {
  if (!iso) return undefined;

  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const dateToIso = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Поле даты из дизайн-системы Atomaro. Снаружи компонент по-прежнему работает
 * с ISO-строкой, чтобы не менять модель фильтров.
 */
export function DateInput({ value, onChange, min, max, className, 'aria-label': ariaLabel }) {
  return (
    <span className={cn(styles.root, className)}>
      <AtomaroInputDate
        className={styles.control}
        activeDate={isoToDate(value)}
        minDate={isoToDate(min)}
        maxDate={isoToDate(max)}
        minYear={1900}
        maxYear={2100}
        size="m"
        placeholder="ДД.ММ.ГГГГ"
        aria-label={ariaLabel}
        placement="bottomLeft"
        useInPortal
        onChange={(date) => onChange(dateToIso(date))}
      />
    </span>
  );
}

/** Единое поле выбора диапазона на штатном range-picker Atomaro. */
export function DateRangeInput({ from, to, onChange, className, 'aria-label': ariaLabel }) {
  return (
    <span className={cn(styles.root, styles.range, className)}>
      <AtomaroInputDate
        className={styles.control}
        activeDate={isoToDate(from)}
        secondDate={isoToDate(to)}
        isRange
        minYear={1900}
        maxYear={2100}
        size="m"
        placeholder="ДД.ММ.ГГГГ — ДД.ММ.ГГГГ"
        aria-label={ariaLabel}
        placement="bottomLeft"
        useInPortal
        onChange={(startDate, endDate) =>
          onChange({ from: dateToIso(startDate), to: dateToIso(endDate) })
        }
      />
    </span>
  );
}
