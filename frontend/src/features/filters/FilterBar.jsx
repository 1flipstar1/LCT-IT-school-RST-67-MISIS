import { useState } from 'react';
import { useSession } from '../../auth/SessionProvider.jsx';
import { countActiveFilters, EMPTY_FILTERS, PERIOD_PRESETS } from '../../domain/filters.js';
import { PERMISSION } from '../../domain/roles.js';
import { cn } from '../../lib/cn.js';
import { useManagers } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { Button } from '../../ui/Button.jsx';
import { DateRangeInput } from '../../ui/DateInput.jsx';
import { SearchField, Switch } from '../../ui/Field.jsx';
import { CalendarIcon, FilterIcon } from '../../ui/icons.js';
import { MultiSelectFilter } from '../../ui/MultiSelectFilter.jsx';
import { SelectMenu } from '../../ui/SelectMenu.jsx';
import { SidePanel } from '../../ui/SidePanel.jsx';
import styles from './FilterBar.module.css';

const toOptions = (items) => items.map((item) => ({ value: item.id, label: item.name }));

/**
 * Панель фильтров — одна и та же во «Взаимодействиях», «Аналитике» и «Отчётах»,
 * чтобы пользователь один раз научился и везде фильтровал одинаково.
 * show — какие фильтры нужны на странице.
 * variant="panel" — рядом с поиском одна кнопка «Фильтры», сами фильтры открываются в панели справа;
 * resultLabel — сколько записей найдено («24 взаимодействия»): подпись кнопки «Показать…» в панели.
 */
export function FilterBar({
  filters,
  onChange,
  show = {},
  stages = [],
  variant = 'inline',
  resultLabel,
  searchPlaceholder = 'Вуз, направление, продукт или менеджер',
}) {
  const set = (patch) => onChange({ ...filters, ...patch });
  const reset = () => onChange({ ...EMPTY_FILTERS, query: filters.query });
  const activeCount = countActiveFilters(filters);
  const inPanel = variant === 'panel';

  const search = show.search !== false && (
    <SearchField className={styles.search} value={filters.query} onChange={(query) => set({ query })} placeholder={searchPlaceholder} />
  );
  const fields = <FilterFields filters={filters} set={set} show={show} stages={stages} fieldClassName={inPanel ? styles.panelField : undefined} />;

  if (inPanel) {
    return <FilterPanelBar search={search} fields={fields} activeCount={activeCount} onReset={reset} resultLabel={resultLabel} />;
  }

  return (
    <div className={styles.bar}>
      {search}
      <div className={styles.filters}>
        {fields}
        {activeCount > 0 && (
          <button type="button" className={styles.reset} onClick={reset}>
            Сбросить фильтры ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
}

/** Сами поля фильтров: строкой под поиском или столбиком в боковой панели. */
function FilterFields({ filters, set, show, stages, fieldClassName }) {
  const { universities, directions, products } = useStoreState();
  const managers = useManagers();
  const { can } = useSession();

  return (
    <>
      <PeriodFilter className={fieldClassName} period={filters.period} onChange={(period) => set({ period })} />
      <MultiSelectFilter className={fieldClassName} label="Вузы" options={toOptions(universities)} value={filters.universityIds} onChange={(universityIds) => set({ universityIds })} />
      <MultiSelectFilter className={fieldClassName} label="Направления" options={toOptions(directions)} value={filters.directionIds} onChange={(directionIds) => set({ directionIds })} />
      <MultiSelectFilter className={fieldClassName} label="Продукты" options={toOptions(products)} value={filters.productIds} onChange={(productIds) => set({ productIds })} />
      {can(PERMISSION.viewAllInteractions) && (
        <MultiSelectFilter className={fieldClassName} label="Ответственные" options={toOptions(managers)} value={filters.managerIds} onChange={(managerIds) => set({ managerIds })} />
      )}
      {show.stages && stages.length > 0 && (
        <MultiSelectFilter className={fieldClassName} label="Этапы" options={toOptions(stages)} value={filters.stageIds} onChange={(stageIds) => set({ stageIds })} />
      )}
      {show.attention && <Switch label="Только срочные" checked={filters.onlyAttention} onChange={(onlyAttention) => set({ onlyAttention })} />}
    </>
  );
}

/** Поиск + кнопка «Фильтры» с числом активных фильтров; поля — в панели справа. */
function FilterPanelBar({ search, fields, activeCount, onReset, resultLabel }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.panelBar}>
      {search}
      <Button icon={FilterIcon} onClick={() => setOpen(true)}>
        Фильтры
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </Button>

      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title="Фильтры"
        description="Изменения применяются сразу."
        footer={
          <>
            <Button variant="ghost" tone="warning" onClick={onReset} disabled={activeCount === 0}>
              Сбросить
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              {resultLabel ? `Показать ${resultLabel}` : 'Готово'}
            </Button>
          </>
        }
      >
        {fields}
      </SidePanel>
    </div>
  );
}

export function PeriodFilter({ period, onChange, className }) {
  const isCustom = period.preset === 'custom';
  return (
    <div className={cn(styles.period, className)}>
      <SelectMenu
        className={styles.periodSelect}
        label="Период"
        value={period.preset}
        options={PERIOD_PRESETS.map(({ id, label }) => ({ value: id, label }))}
        icon={CalendarIcon}
        fullWidth={Boolean(className)}
        onChange={(preset) => onChange({ ...period, preset })}
      />
      {isCustom && (
        <DateRangeInput
          className={styles.dateRange}
          aria-label="Диапазон дат"
          from={period.from}
          to={period.to}
          onChange={({ from, to }) => onChange({ ...period, from, to })}
        />
      )}
    </div>
  );
}
