import { useId } from 'react';
import { cn } from '../lib/cn.js';
import { CheckIcon, SearchIcon } from './icons.js';
import styles from './Field.module.css';
import { SelectMenu } from './SelectMenu.jsx';

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
/** Выбор значения в форме: подпись как у остальных полей, список — как в «Пользователях и доступе». */
export function SelectMenuField({ label, hint, error, required, className, value, options, onChange, placeholder, disabled, name, form }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <SelectMenu
        id={id}
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        name={name}
        form={form}
        invalid={Boolean(error)}
        describedBy={describedBy(id, hint, error)}
        fullWidth
      />
    </FieldShell>
  );
}

/**
 * Совместимый API прежнего поля: визуально и по поведению это единый SelectMenu из фильтров,
 * а onChange сохраняет привычную форму event.target.value для экранов приложения.
 */
export function SelectField({ label, hint, error, required, className, options, placeholder, value, onChange, disabled, name, form, 'aria-label': ariaLabel }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <SelectMenu
        id={id}
        label={ariaLabel ?? label}
        value={value}
        options={options}
        onChange={(nextValue) => onChange?.({ target: { value: nextValue }, currentTarget: { value: nextValue } })}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        name={name}
        form={form}
        invalid={Boolean(error)}
        describedBy={describedBy(id, hint, error)}
        fullWidth
      />
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
