import { useMemo, useState } from 'react';
import { apiErrorToAppError } from '../../api/client.js';
import { EMPTY_FILTERS, filterInteractionRows } from '../../domain/filters.js';
import { formatDate, formatRelativeDateTime, plural } from '../../domain/format.js';
import { DEFAULT_REPORT_COLUMNS, REPORT_COLUMNS, REPORT_FORMATS } from '../../domain/reports.js';
import { cn } from '../../lib/cn.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { useCatalogIndex, useVisibleInteractionRows } from '../../store/selectors.js';
import { useStoreApi, useStoreState } from '../../store/StoreProvider.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { Button } from '../../ui/Button.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { Hint } from '../../ui/Hint.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { Checkbox, TextField } from '../../ui/Field.jsx';
import { DownloadIcon, ReportIcon } from '../../ui/icons.js';
import { ErrorAlert } from '../../ui/InlineAlert.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { FilterBar } from '../filters/FilterBar.jsx';
import { describeFilters } from '../filters/describeFilters.js';
import { useFilters } from '../filters/useFilters.js';
import { exportReport } from './reportExport.js';
import styles from './ReportsPage.module.css';

const PREVIEW_ROWS = 5;

export function ReportsPage() {
  const { reports } = useStoreState();
  const index = useCatalogIndex();
  const allRows = useVisibleInteractionRows();
  const storeApi = useStoreApi();
  const toast = useToast();

  const [filters, setFilters] = useFilters('reports');
  const [columns, setColumns] = usePersistentState('reports:columns', DEFAULT_REPORT_COLUMNS);
  const [format, setFormat] = usePersistentState('reports:format', 'xlsx');
  const [name, setName] = useState(`Взаимодействия с вузами — ${formatDate(new Date())}`);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => filterInteractionRows(allRows, filters), [allRows, filters]);
  const summary = describeFilters(filters, index);
  const selectedColumns = REPORT_COLUMNS.filter((column) => columns.includes(column.id));

  const toggleColumn = (id, checked) =>
    setColumns((current) => (checked ? REPORT_COLUMNS.map((column) => column.id).filter((columnId) => columnId === id || current.includes(columnId)) : current.filter((columnId) => columnId !== id)));

  const generate = async (config) => {
    if (busy) return;
    setBusy(true);
    try {
      const rowCount = await exportReport(config);
      await storeApi.rehydrate();
      setError(null);
      toast.success(`Файл скачан: ${rowCount} ${plural(rowCount, ['строка', 'строки', 'строк'])}`);
    } catch (caught) {
      setError(apiErrorToAppError(caught));
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

          <Step number={3} title="Формат файла" hint="В каком файле скачать отчёт: XLSX или XLS — для работы в таблицах, PDF — для печати и отправки.">
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
              onClick={() => generate({ rows, columns, format, name: name.trim() || 'Отчёт', summary, filters })}
            >
              {busy ? 'Формируем файл…' : `Скачать ${REPORT_FORMATS.find((item) => item.id === format).label}`}
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

function Step({ number, title, description, hint, children }) {
  return (
    <section className={styles.step}>
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
