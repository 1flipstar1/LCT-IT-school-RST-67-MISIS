import { Popover } from '@base-ui/react/popover';
import { useMemo, useState } from 'react';
import { cn } from '../lib/cn.js';
import { Checkbox } from './Field.jsx';
import { ChevronDownIcon } from './icons.js';
import popupStyles from './Popup.module.css';
import styles from './MultiSelectFilter.module.css';

/**
 * Фильтр-«чип» с выбором нескольких значений. Когда значений больше семи, появляется поиск.
 * options: [{ value, label }]
 */
export function MultiSelectFilter({ label, options, value, onChange }) {
  const [query, setQuery] = useState('');
  const selected = new Set(value);

  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? options.filter((option) => option.label.toLowerCase().includes(normalized)) : options;
  }, [options, query]);

  const toggle = (optionValue, checked) =>
    onChange(checked ? [...value, optionValue] : value.filter((item) => item !== optionValue));

  const summary =
    value.length === 0 ? null : value.length === 1 ? options.find((option) => option.value === value[0])?.label : `${value.length}`;

  return (
    <Popover.Root onOpenChange={(open) => !open && setQuery('')}>
      <Popover.Trigger className={cn(styles.trigger, value.length > 0 && styles.active)}>
        <span className={styles.label}>{label}</span>
        {summary && <span className={styles.summary}>{summary}</span>}
        <ChevronDownIcon size={16} fill="currentColor" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className={popupStyles.positioner} sideOffset={6} align="start">
          <Popover.Popup className={cn(popupStyles.popup, styles.popup)}>
            {options.length > 7 && (
              <input
                className={styles.search}
                type="search"
                placeholder="Найти"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={`Поиск: ${label}`}
              />
            )}
            <div className={styles.options}>
              {visibleOptions.map((option) => (
                <Checkbox
                  key={option.value}
                  className={styles.option}
                  label={option.label}
                  checked={selected.has(option.value)}
                  onChange={(checked) => toggle(option.value, checked)}
                />
              ))}
              {visibleOptions.length === 0 && <p className={styles.nothing}>Ничего не найдено</p>}
            </div>
            {value.length > 0 && (
              <button type="button" className={styles.clear} onClick={() => onChange([])}>
                Сбросить
              </button>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
