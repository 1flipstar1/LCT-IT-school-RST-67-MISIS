import { cn } from '../lib/cn.js';
import styles from './SegmentedControl.module.css';

/** Переключатель вида. options: [{ value, label, icon }]. Управляется стрелками как radiogroup. */
export function SegmentedControl({ label, options, value, onChange, className }) {
  const handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const index = options.findIndex((option) => option.value === value);
    const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[nextIndex].value);
    event.currentTarget.querySelectorAll('[role="radio"]')[nextIndex]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn(styles.control, className)} onKeyDown={handleKeyDown}>
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
        const checked = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={cn(styles.segment, checked && styles.checked)}
            onClick={() => onChange(optionValue)}
          >
            {Icon && <Icon size={18} fill="currentColor" />}
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}
