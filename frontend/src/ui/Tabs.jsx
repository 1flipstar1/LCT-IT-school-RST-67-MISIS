import { cn } from '../lib/cn.js';
import styles from './Tabs.module.css';

/** Вкладки. tabs: [{ value, label, count }]. Содержимое активной вкладки рендерит родитель. */
export function Tabs({ label, tabs, value, onChange, className }) {
  const handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const index = tabs.findIndex((tab) => tab.value === value);
    const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[nextIndex].value);
    event.currentTarget.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn(styles.tabs, className)} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cn(styles.tab, selected && styles.selected)}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.count !== undefined && <span className={styles.count}>{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
