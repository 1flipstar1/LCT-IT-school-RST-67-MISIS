import { useMemo, useRef, useState } from 'react';
import { useSession } from '../../auth/SessionProvider.jsx';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { useCatalogIndex } from '../../store/selectors.js';
import { Button } from '../../ui/Button.jsx';
import { IconButton } from '../../ui/IconButton.jsx';
import { AddIcon, DownloadIcon, SettingsIcon } from '../../ui/icons.js';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { describeFilters } from '../filters/describeFilters.js';
import { FilterBar } from '../filters/FilterBar.jsx';
import { useFilters } from '../filters/useFilters.js';
import { downloadAnalyticsPdf } from './analyticsPdf.js';
import { DashboardGrid, WidgetCatalogPanel } from './dashboard/DashboardGrid.jsx';
import { addWidget, moveWidget, normalizeLayout, removeWidget, resizeWidget } from './dashboard/layout.js';
import { useAnalyticsData } from './useAnalyticsData.js';
import { ANALYTICS_WIDGETS, DEFAULT_ANALYTICS_LAYOUT } from './widgets/catalog.js';
import styles from './AnalyticsPage.module.css';

export function AnalyticsPage() {
  const { can, user } = useSession();
  const index = useCatalogIndex();
  const toast = useToast();
  const pageRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [filters, setFilters] = useFilters('analytics');
  const data = useAnalyticsData(filters);

  const availableWidgets = useMemo(() => ANALYTICS_WIDGETS.filter((widget) => !widget.permission || can(widget.permission)), [can]);
  const catalog = useMemo(() => new Map(availableWidgets.map((widget) => [widget.id, widget])), [availableWidgets]);
  const defaultLayout = useMemo(() => normalizeLayout(DEFAULT_ANALYTICS_LAYOUT, catalog), [catalog]);
  const [storedLayout, setStoredLayout] = usePersistentState(`analytics:layout:${user?.id ?? 'anonymous'}`, defaultLayout);
  const layout = useMemo(() => normalizeLayout(storedLayout, catalog), [storedLayout, catalog]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      await downloadAnalyticsPdf({
        container: pageRef.current,
        summary: describeFilters(filters, index),
        totals: { ...data.lms, interactions: data.rows.length },
        ranking: data.ranking,
      });
      toast.success('PDF скачан');
    } catch {
      toast.error('Не удалось сформировать PDF', { code: 'APP-500' });
    } finally {
      setExporting(false);
    }
  };

  const updateLayout = (change) => setStoredLayout((current) => change(normalizeLayout(current, catalog)));
  const handleRemove = (id) => updateLayout((current) => removeWidget(current, id));
  const handleMove = (id, toIndex) => updateLayout((current) => moveWidget(current, id, toIndex));
  const handleResize = (id, size) => updateLayout((current) => resizeWidget(current, id, size));
  const handleAdd = (widget) => updateLayout((current) => addWidget(current, widget));
  const handleReset = () => {
    setStoredLayout(defaultLayout);
    toast.success('Стандартная панель восстановлена');
  };

  return (
    <div ref={pageRef}>
      <PageHeader
        title="Аналитика"
        hint="Настраиваемая панель показателей по данным CRM, LMS и сайта. Фильтры применяются ко всем карточкам."
        meta={<span className={styles.headerHint}>{editing ? 'Режим редактирования: меняйте порядок, размер и состав панели' : `${layout.length} виджетов на панели`}</span>}
        actions={
          <>
            <Button icon={DownloadIcon} onClick={exportPdf} disabled={exporting}>
              {exporting ? 'Формируем PDF…' : 'Скачать PDF'}
            </Button>
            {!editing && (
              <IconButton
                icon={SettingsIcon}
                label="Настроить панель"
                aria-pressed={false}
                onClick={() => setEditing(true)}
              />
            )}
          </>
        }
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        show={{ search: false }}
        actions={
          editing && (
            <>
              <Button icon={AddIcon} onClick={() => setCatalogOpen(true)}>Добавить виджет</Button>
              <Button variant="primary" className={styles.doneButton} onClick={() => setEditing(false)}>Готово</Button>
            </>
          )
        }
      />

      <DashboardGrid
        layout={layout}
        catalog={catalog}
        data={data}
        editing={editing}
        onMove={handleMove}
        onResize={handleResize}
        onRemove={handleRemove}
      />

      <WidgetCatalogPanel
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        widgets={availableWidgets}
        layout={layout}
        onAdd={handleAdd}
        onReset={handleReset}
      />
    </div>
  );
}
