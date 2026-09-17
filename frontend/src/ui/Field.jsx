import { useId } from 'react';
import { cn } from '../lib/cn.js';
import { CheckIcon, ChevronDownIcon, SearchIcon } from './icons.js';
import styles from './Field.module.css';

/**
 * Поля форм. Нативные input/select/textarea: доступны с клавиатуры и скринридерам,
 * на телефонах открывают системные пикеры. Визуально — по токенам Атомаро.
 */
function FieldShell({ id, label, hint, error, required, children, className }) {
  return (
    <div className={cn(styles.field, className)}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-message`} className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-message`} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const describedBy = (id, hint, error) => (hint || error ? `${id}-message` : undefined);

export function TextField({ label, hint, error, required, className, ...inputProps }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input
        id={id}
        className={cn(styles.control, error && styles.invalid)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
        required={required}
        {...inputProps}
      />
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, required, className, rows = 4, ...textareaProps }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        id={id}
        rows={rows}
        className={cn(styles.control, styles.textarea, error && styles.invalid)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, hint, error)}
        required={required}
        {...textareaProps}
      />
    </FieldShell>
  );
}

/** options: [{ value, label }]; placeholder — пустой первый пункт. */
export function SelectField({ label, hint, error, required, className, options, placeholder, ...selectProps }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <span className={styles.selectWrap}>
        <select
          id={id}
          className={cn(styles.control, styles.select, error && styles.invalid)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, hint, error)}
          required={required}
          {...selectProps}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon size={16} fill="currentColor" className={styles.selectIcon} aria-hidden="true" />
      </span>
    </FieldShell>
  );
}

export function SearchField({ value, onChange, placeholder = 'Поиск', label = 'Поиск', className }) {
  return (
    <label className={cn(styles.search, className)}>
      <SearchIcon size={18} fill="currentColor" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Checkbox({ checked, onChange, label, description, disabled, className }) {
  return (
    <label className={cn(styles.checkbox, disabled && styles.disabled, className)}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className={styles.box} aria-hidden="true">
        <CheckIcon size={16} fill="currentColor" />
      </span>
      <span className={styles.checkboxText}>
        <span>{label}</span>
        {description && <span className={styles.checkboxDescription}>{description}</span>}
      </span>
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className={cn(styles.switch, disabled && styles.disabled)}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className={styles.track} aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
