import { useSession } from '../../auth/SessionProvider.jsx';
import { countActiveFilters, EMPTY_FILTERS, PERIOD_PRESETS } from '../../domain/filters.js';
import { PERMISSION } from '../../domain/roles.js';
import { useManagers } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { SearchField, Switch } from '../../ui/Field.jsx';
import { CalendarIcon, ChevronDownIcon } from '../../ui/icons.js';
import { MultiSelectFilter } from '../../ui/MultiSelectFilter.jsx';
import styles from './FilterBar.module.css';

const toOptions = (items) => items.map((item) => ({ value: item.id, label: item.name }));

/**
 * Панель фильтров — одна и та же во «Взаимодействиях», «Аналитике» и «Отчётах»,
 * чтобы пользователь один раз научился и везде фильтровал одинаково.
 * show — какие фильтры нужны на странице.
 */
export function FilterBar({ filters, onChange, show = {}, stages = [], searchPlaceholder = 'Вуз, направление, продукт или менеджер' }) {
  const { universities, directions, products } = useStoreState();
  const managers = useManagers();
  const session = useSession();
  const set = (patch) => onChange({ ...filters, ...patch });
  const activeCount = countActiveFilters(filters);

  const canSeeManagers = session.can(PERMISSION.viewAllInteractions);

  return (
    <div className={styles.bar}>
      {show.search !== false && (
        <SearchField className={styles.search} value={filters.query} onChange={(query) => set({ query })} placeholder={searchPlaceholder} />
      )}

      <div className={styles.filters}>
        <PeriodFilter period={filters.period} onChange={(period) => set({ period })} />
        <MultiSelectFilter label="Вузы" options={toOptions(universities)} value={filters.universityIds} onChange={(universityIds) => set({ universityIds })} />
        <MultiSelectFilter label="Направления" options={toOptions(directions)} value={filters.directionIds} onChange={(directionIds) => set({ directionIds })} />
        <MultiSelectFilter label="Продукты" options={toOptions(products)} value={filters.productIds} onChange={(productIds) => set({ productIds })} />
        {canSeeManagers && (
          <MultiSelectFilter label="Ответственные" options={toOptions(managers)} value={filters.managerIds} onChange={(managerIds) => set({ managerIds })} />
        )}
        {show.stages && stages.length > 0 && (
          <MultiSelectFilter label="Этапы" options={toOptions(stages)} value={filters.stageIds} onChange={(stageIds) => set({ stageIds })} />
        )}
        {show.attention && (
          <Switch label="Только срочные" checked={filters.onlyAttention} onChange={(onlyAttention) => set({ onlyAttention })} />
        )}
        {activeCount > 0 && (
          <button type="button" className={styles.reset} onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}>
            Сбросить фильтры ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
}

export function PeriodFilter({ period, onChange }) {
  const isCustom = period.preset === 'custom';
  return (
    <div className={styles.period}>
      <label className={styles.periodSelect}>
        <CalendarIcon size={18} fill="currentColor" aria-hidden="true" />
        <span className="visually-hidden">Период</span>
        <select value={period.preset} onChange={(event) => onChange({ ...period, preset: event.target.value })}>
          {PERIOD_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon size={16} fill="currentColor" aria-hidden="true" />
      </label>
      {isCustom && (
        <span className={styles.dates}>
          <input type="date" aria-label="Начало периода" value={period.from} max={period.to || undefined} onChange={(event) => onChange({ ...period, from: event.target.value })} />
          <span aria-hidden="true">—</span>
          <input type="date" aria-label="Конец периода" value={period.to} min={period.from || undefined} onChange={(event) => onChange({ ...period, to: event.target.value })} />
        </span>
      )}
    </div>
  );
}
