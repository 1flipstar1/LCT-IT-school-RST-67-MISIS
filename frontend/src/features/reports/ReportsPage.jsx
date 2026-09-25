import { useMemo, useRef, useState } from 'react';
import { useSession } from '../../auth/SessionProvider.jsx';
import { EMPTY_FILTERS, filterInteractionRows } from '../../domain/filters.js';
import { formatDate, formatRelativeDateTime, plural } from '../../domain/format.js';
import { DEFAULT_REPORT_COLUMNS, REPORT_COLUMNS, REPORT_FORMATS } from '../../domain/reports.js';
import { cn } from '../../lib/cn.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { useCatalogIndex, useVisibleInteractionRows } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { Badge } from '../../ui/Badge.jsx';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { IconButton } from '../../ui/IconButton.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { Hint } from '../../ui/Hint.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { Checkbox, TextField } from '../../ui/Field.jsx';
import { AnalyticsIcon, ArrowDownIcon, ArrowUpIcon, DownloadIcon, ReportIcon, TrashIcon } from '../../ui/icons.js';
import { ErrorAlert } from '../../ui/InlineAlert.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { FilterBar } from '../filters/FilterBar.jsx';
import { describeFilters } from '../filters/describeFilters.js';
import { useFilters } from '../filters/useFilters.js';
import { useReportWidgets } from '../analytics/reportWidgets.js';
import { ANALYTICS_WIDGETS } from '../analytics/widgets/catalog.js';
import { exportReport } from './reportExport.js';
import { ReportVisualsStage } from './ReportVisualsStage.jsx';
import styles from './ReportsPage.module.css';

const PREVIEW_ROWS = 5;

export function ReportsPage() {
  const { reports } = useStoreState();
  const index = useCatalogIndex();
  const allRows = useVisibleInteractionRows();
  const actions = useActions();
  const toast = useToast();

  const [filters, setFilters] = useFilters('reports');
  const [columns, setColumns] = usePersistentState('reports:columns', DEFAULT_REPORT_COLUMNS);
  const [format, setFormat] = usePersistentState('reports:format', 'xlsx');
  const [name, setName] = useState(`Взаимодействия с вузами — ${formatDate(new Date())}`);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { can } = useSession();
  const reportWidgets = useReportWidgets();
  const widgetCatalog = useMemo(() => new Map(ANALYTICS_WIDGETS.filter((widget) => !widget.permission || can(widget.permission)).map((widget) => [widget.id, widget])), [can]);
  const selectedWidgets = reportWidgets.ids.map((id) => widgetCatalog.get(id)).filter(Boolean);
  const [stage, setStage] = useState(null);
  const stageResolverRef = useRef(null);

  /** Рисует выбранные виджеты вне экрана по фильтрам отчёта и возвращает их снимки для PDF. */
  const captureVisuals = (widgets, reportFilters) => new Promise((resolve) => {
    stageResolverRef.current = resolve;
    setStage({ widgets, filters: reportFilters });
  });

  const rows = useMemo(() => filterInteractionRows(allRows, filters), [allRows, filters]);
  const summary = describeFilters(filters, index);
  const selectedColumns = REPORT_COLUMNS.filter((column) => columns.includes(column.id));

  const toggleColumn = (id, checked) =>
    setColumns((current) => (checked ? REPORT_COLUMNS.map((column) => column.id).filter((columnId) => columnId === id || current.includes(columnId)) : current.filter((columnId) => columnId !== id)));

  const generate = async (config) => {
    if (busy) return;
    setBusy(true);
    try {
      const widgets = (config.widgetIds ?? []).map((id) => widgetCatalog.get(id)).filter(Boolean);
      const visuals = config.format === 'pdf' && widgets.length > 0 ? await captureVisuals(widgets, config.filters) : null;
      const rowCount = await exportReport({ ...config, visuals });
      actions.recordReport({ name: config.name, format: config.format, rowCount, summary: config.summary, filters: config.filters, columns: config.columns, widgetIds: config.widgetIds ?? [] });
      setError(null);
      const extra = visuals ? ` и ${visuals.kpis.length + visuals.figures.length + visuals.tables.length} ${plural(visuals.kpis.length + visuals.figures.length + visuals.tables.length, ['график или показатель', 'графика или показателя', 'графиков и показателей'])}` : '';
      toast.success(`Файл скачан: ${rowCount} ${plural(rowCount, ['строка', 'строки', 'строк'])}${extra}`);
      if (visuals?.skipped.length) toast.error(`Не удалось добавить: ${visuals.skipped.join(', ')}`);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const regenerate = (report) => {
    const reportFilters = { ...EMPTY_FILTERS, ...report.filters };
    generate({
      rows: filterInteractionRows(allRows, reportFilters),
      columns: report.columns ?? DEFAULT_REPORT_COLUMNS,
      format: report.format,
      name: report.name,
      summary: report.summary,
      filters: reportFilters,
      widgetIds: report.widgetIds ?? [],
    });
  };

  return (
    <>
      <PageHeader title="Отчёты" hint="Выгрузка взаимодействий с вузами за период в XLSX, XLS или PDF. Выберите фильтры, колонки и формат." />

      <div className={styles.layout}>
        <Card className={styles.builder}>
          <Step number={1} title="Период и фильтры" hint="Какие взаимодействия попадут в отчёт: период, вузы, направления, продукты и ответственные." description={`Подходит ${rows.length} ${plural(rows.length, ['взаимодействие', 'взаимодействия', 'взаимодействий'])}`}>
            <FilterBar filters={filters} onChange={setFilters} show={{ search: false }} />
          </Step>

          <Step number={2} title="Колонки" hint="Какие данные будут в отчёте и в каком порядке." description="Первые пять — стандартный набор отчёта.">
            <div className={styles.columns}>
              {REPORT_COLUMNS.map((column) => (
                <Checkbox key={column.id} label={column.label} checked={columns.includes(column.id)} onChange={(checked) => toggleColumn(column.id, checked)} />
              ))}
            </div>
          </Step>

          <Step
            number={3}
            title="Графики и показатели"
            hint="Отметьте на странице «Аналитика» кнопкой «В отчёт» нужные плитки и графики — в PDF они будут в начале, посчитанные по фильтрам этого отчёта."
            description={selectedWidgets.length ? `Выбрано: ${selectedWidgets.length}. Попадут в начало PDF, по два графика в ряд.` : 'Необязательно. Добавляются только в PDF.'}
          >
            <ReportWidgetList widgets={selectedWidgets} selection={reportWidgets} pdf={format === 'pdf'} onUsePdf={() => setFormat('pdf')} />
          </Step>

          <Step number={4} title="Формат файла" hint="В каком файле скачать отчёт: XLSX или XLS — для работы в таблицах, PDF — для печати и отправки.">
            <div className={styles.formats} role="radiogroup" aria-label="Формат файла">
              {REPORT_FORMATS.map((item) => (
                <label key={item.id} className={cn(styles.format, format === item.id && styles.formatChecked)}>
                  <input type="radio" name="format" value={item.id} checked={format === item.id} onChange={() => setFormat(item.id)} className="visually-hidden" />
                  <span className={styles.formatLabel}>{item.label}</span>
                  <span className={styles.formatDescription}>{item.description}</span>
                </label>
              ))}
            </div>
            <TextField label="Название отчёта" value={name} onChange={(event) => setName(event.target.value)} />
          </Step>

          <ErrorAlert error={error} />

          <div className={styles.submit}>
            <Button
              variant="primary"
              size="l"
              icon={DownloadIcon}
              disabled={busy}
              onClick={() => generate({ rows, columns, format, name: name.trim() || 'Отчёт', summary, filters, widgetIds: selectedWidgets.map((widget) => widget.id) })}
            >
              {busy ? (stage ? 'Рисуем графики…' : 'Формируем файл…') : `Скачать ${REPORT_FORMATS.find((item) => item.id === format).label}`}
            </Button>
          </div>
        </Card>

        <Card padding="none" className={styles.preview}>
          <CardHeader title="Предпросмотр" hint="Первые строки отчёта с выбранными колонками — так он будет выглядеть в файле." description={`${summary}. Показаны первые ${Math.min(PREVIEW_ROWS, rows.length)} из ${rows.length}.`} />
          {selectedColumns.length === 0 || rows.length === 0 ? (
            <EmptyState icon={ReportIcon} title="Нечего показать" description={selectedColumns.length === 0 ? 'Отметьте хотя бы одну колонку.' : 'Под фильтры не попало ни одного взаимодействия.'} />
          ) : (
            <DataTable
              caption="Предпросмотр отчёта"
              rows={rows.slice(0, PREVIEW_ROWS)}
              columns={selectedColumns.map((column, columnIndex) => ({ id: column.id, header: column.label, primary: columnIndex === 0, cell: column.value }))}
            />
          )}
        </Card>
      </div>

      {stage && (
        <ReportVisualsStage
          widgets={stage.widgets}
          filters={stage.filters}
          onCaptured={(visuals) => {
            setStage(null);
            stageResolverRef.current?.(visuals);
          }}
        />
      )}

      <Card padding="none">
        <CardHeader title="История отчётов" hint="Отчёты, которые уже формировали. Любой можно собрать заново по актуальным данным." description="Отчёт можно сформировать заново — с теми же фильтрами и колонками, но по актуальным данным." />
        <DataTable
          caption="История отчётов"
          rows={reports}
          empty={<EmptyState icon={ReportIcon} title="Отчётов пока нет" description="Сформированные отчёты появятся здесь." />}
          columns={[
            {
              id: 'name',
              header: 'Отчёт',
              primary: true,
              cell: (report) => (
                <span className={styles.reportName}>
                  <span>{report.name}</span>
                  <span className={styles.secondary}>{report.summary}</span>
                </span>
              ),
            },
            { id: 'format', header: 'Формат', cell: (report) => <Badge tone="brand">{report.format.toUpperCase()}</Badge> },
            { id: 'rows', header: 'Строк', align: 'right', cell: (report) => report.rowCount },
            { id: 'author', header: 'Автор', cell: (report) => index.users.get(report.userId)?.name ?? '—' },
            { id: 'date', header: 'Создан', cell: (report) => formatRelativeDateTime(report.createdAt) },
            {
              id: 'actions',
              header: '',
              align: 'right',
              cell: (report) => (
                <Button variant="ghost" size="s" icon={DownloadIcon} disabled={busy} onClick={() => regenerate(report)}>
                  Скачать
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}

function ReportWidgetList({ widgets, selection, pdf, onUsePdf }) {
  if (widgets.length === 0) {
    return (
      <div className={styles.widgetEmpty}>
        <p>На странице «Аналитика» у каждого графика и показателя есть кнопка «В отчёт».</p>
        <ButtonLink to="/analytics" icon={AnalyticsIcon} size="s">Выбрать в «Аналитике»</ButtonLink>
      </div>
    );
  }
  return (
    <div className={styles.widgetPicker}>
      <ol className={styles.widgetList}>
        {widgets.map((widget, index) => {
          const Icon = widget.icon ?? AnalyticsIcon;
          return (
            <li key={widget.id} className={styles.widgetItem}>
              <span className={styles.widgetIcon}><Icon size={18} fill="currentColor" /></span>
              <span className={styles.widgetText}>
                <span className={styles.widgetTitle}>{widget.title}</span>
                <span className={styles.secondary}>{widget.metric ? 'Показатель' : widget.chartType ?? 'График'}</span>
              </span>
              <IconButton size="s" icon={ArrowUpIcon} label="Выше" disabled={index === 0} onClick={() => selection.move(widget.id, -1)} />
              <IconButton size="s" icon={ArrowDownIcon} label="Ниже" disabled={index === widgets.length - 1} onClick={() => selection.move(widget.id, 1)} />
              <IconButton size="s" icon={TrashIcon} label="Убрать из отчёта" onClick={() => selection.remove(widget.id)} />
            </li>
          );
        })}
      </ol>
      <div className={styles.widgetFooter}>
        {!pdf && (
          <button type="button" className={styles.widgetHint} onClick={onUsePdf}>
            Графики попадают только в PDF — выбрать PDF
          </button>
        )}
        <ButtonLink to="/analytics" size="s" variant="ghost">Добавить ещё</ButtonLink>
        <Button size="s" variant="ghost" onClick={selection.clear}>Очистить</Button>
      </div>
    </div>
  );
}

function Step({ number, title, description, hint, children }) {
  return (
    <section className={styles.step} data-tour={`report-step-${number}`}>
      <header className={styles.stepHeader}>
        <span className={styles.stepNumber}>{number}</span>
        <div>
          <Hint text={hint}>
            <h2 className={styles.stepTitle}>{title}</h2>
          </Hint>
          {description && <p className={styles.stepDescription}>{description}</p>}
        </div>
      </header>
      <div className={styles.stepBody}>{children}</div>
    </section>
  );
}
