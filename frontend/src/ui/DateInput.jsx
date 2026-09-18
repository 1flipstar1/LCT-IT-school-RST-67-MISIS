import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn.js';
import { CalendarIcon } from './icons.js';
import styles from './DateInput.module.css';

const DATE_DIGITS = 8; // ДД ММ ГГГГ

/** «01052026» → «01.05.2026». Точка ставится, только когда следующая часть уже начата, — Backspace не застревает на ней. */
const mask = (digits) => [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.');

/** ISO «2026-05-01» → «01.05.2026». */
const isoToText = (iso) => (iso ? iso.split('-').reverse().join('.') : '');

/** Восемь цифр → ISO-дата, если такой день существует (31.02 — нет); иначе null. */
function digitsToIso(digits) {
  if (digits.length !== DATE_DIGITS) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  const exists = year >= 1900 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return exists ? `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}` : null;
}

/**
 * Дата с клавиатуры: цифры набираются подряд, точки появляются сами — «01052026» → «01.05.2026».
 * Наружу отдаётся ISO-дата (как у <input type="date">) или '' для пустого поля. Несуществующая дата
 * подсвечивается, а недописанная при уходе из поля возвращается к последней верной.
 * Кнопка с календарём открывает системный выбор даты — для тех, кому удобнее мышью.
 */
export function DateInput({ value, onChange, min, max, className, 'aria-label': ariaLabel }) {
  const [text, setText] = useState(() => isoToText(value));
  const pickerRef = useRef(null);

  // Значение поменялось снаружи (календарь, «Сбросить») — показываем его.
  useEffect(() => setText(isoToText(value)), [value]);

  const digits = text.replace(/\D/g, '');
  const invalid = digits.length === DATE_DIGITS && digitsToIso(digits) === null;

  const handleChange = (event) => {
    const nextDigits = event.target.value.replace(/\D/g, '').slice(0, DATE_DIGITS);
    setText(mask(nextDigits));
    if (nextDigits.length === 0) {
      onChange('');
      return;
    }
    const iso = digitsToIso(nextDigits);
    if (iso) onChange(iso);
  };

  const handleBlur = () => {
    if (digits.length > 0 && digitsToIso(digits) === null) setText(isoToText(value));
  };

  return (
    <span className={cn(styles.field, invalid && styles.invalid, className)}>
      <input
        className={styles.input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="ДД.ММ.ГГГГ"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      <button type="button" className={styles.calendar} aria-label="Выбрать в календаре" onClick={() => pickerRef.current?.showPicker?.()}>
        <CalendarIcon size={18} fill="currentColor" />
      </button>
      {/* Невидимое системное поле — только источник календаря для кнопки выше. */}
      <input
        ref={pickerRef}
        className={styles.picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  );
}
