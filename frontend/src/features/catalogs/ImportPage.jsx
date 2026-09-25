import { useMemo, useState } from 'react';
import { useSession } from '../../auth/SessionProvider.jsx';
import { AppError } from '../../domain/errors.js';
import { formatDate, formatFileSize, plural } from '../../domain/format.js';
import {
  autoMatchColumns,
  headerSignature,
  IMPORT_FIELDS,
  IMPORT_ROW_STATUS,
  IMPORT_ROW_STATUS_LABEL,
  planImport,
  SAMPLE_IMPORT_ROWS,
  validateMapping,
} from '../../domain/import.js';
import { cn } from '../../lib/cn.js';
import { readTextFile, parseCsv } from '../../lib/csv.js';
import { downloadBlob, safeFileName } from '../../lib/download.js';
import { createXlsx } from '../../lib/export/spreadsheet.js';
import { localStore } from '../../lib/storage.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { readXlsx } from '../../lib/xlsx/readXlsx.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { Badge } from '../../ui/Badge.jsx';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { Card } from '../../ui/Card.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { Switch } from '../../ui/Field.jsx';
import { FileDropzone } from '../../ui/FileDropzone.jsx';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DownloadIcon, SuccessIcon, UploadIcon, WarningIcon } from '../../ui/icons.js';
import { ErrorAlert, InlineAlert } from '../../ui/InlineAlert.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { SegmentedControl } from '../../ui/SegmentedControl.jsx';
import { SelectMenu } from '../../ui/SelectMenu.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { ImportHistory } from './ImportHistory.jsx';
import styles from './ImportPage.module.css';
import { downloadImportTemplate } from './importTemplate.js';

const STEPS = ['Файл', 'Сопоставление', 'Проверка', 'Готово'];
const PREVIEW_ROWS = 5;
const MAPPING_MEMORY = 'import:mappings';

const ROW_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'issues', label: 'С замечаниями' },
  { value: 'errors', label: 'Ошибки' },
];

const STATUS_TONE = { updated: 'success', created: 'brand', catalog: 'warning', skipped: 'danger' };

/** Файл → строки таблицы. XLSX читается как книга, CSV — с автоопределением разделителя и кодировки. */
async function readRows(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) return readXlsx(file);
  if (name.endsWith('.csv')) return parseCsv(await readTextFile(file));
  throw new AppError('IMPORT-400', 'Поддерживаются XLSX и CSV');
}

/**
 * Мастер импорта: файл → сопоставление колонок → проверка изменений → результат.
 * План строится в браузере по тем же правилам, что показаны на шаге проверки; применяет его
 * сервер — атомарно, с историей и возможностью отменить импорт целиком.
 */
export function ImportPage() {
  const state = useStoreState();
  const actions = useActions();
  const toast = useToast();
  const { user } = useSession();

  const [step, setStep] = useState(0);
  const [source, setSource] = useState(null); // { name, size, rows, file }
  const [mapping, setMapping] = useState({});
  const [autoMapped, setAutoMapped] = useState(new Set());
  const [mappingRestored, setMappingRestored] = useState(false);
  const [options, setOptions] = usePersistentState('import:options', { createInteractions: false, keepFilled: false });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const headers = source?.rows[0] ?? [];
  const plan = useMemo(
    () => (step === 2 && source ? planImport(source.rows, mapping, state, { ...options, actorId: user?.id }) : null),
    [step, source, mapping, state, options, user?.id],
  );

  const acceptRows = (name, size, rows, file = null) => {
    if (rows.length < 2) throw new AppError('IMPORT-400', 'В файле нет строк с данными');
    const auto = autoMatchColumns(rows[0]);
    const remembered = localStore.read(MAPPING_MEMORY, {})[headerSignature(rows[0])];
    setSource({ name, size, rows, file });
    setMapping(remembered ?? auto);
    setAutoMapped(new Set(Object.entries(auto).filter(([, column]) => column !== '').map(([field]) => field)));
    setMappingRestored(Boolean(remembered));
    setError(null);
    setStep(1);
  };

  const handleFile = async ([file]) => {
    if (!file) return;
    try {
      acceptRows(file.name, file.size, await readRows(file), file);
    } catch (caught) {
      setError(caught);
    }
  };

  const goToCheck = () => {
    try {
      validateMapping(mapping);
      const memory = localStore.read(MAPPING_MEMORY, {});
      localStore.write(MAPPING_MEMORY, { ...memory, [headerSignature(headers)]: mapping });
      setError(null);
      setStep(2);
    } catch (caught) {
      setError(caught);
    }
  };

  const apply = async () => {
    const { stats } = plan;
    setBusy(true);
    try {
      const applied = await actions.commitImport({
        file: source.file,
        fileName: source.name,
        plan,
        options,
        summary: `Импорт «${source.name}»: строк ${stats.rows}, обновлено договоров ${stats.updatedContracts}, создано взаимодействий ${stats.newInteractions}, новых вузов ${stats.newUniversities}`,
      });
      setJob(applied);
      setHistoryVersion((version) => version + 1);
      setError(null);
      setStep(3);
      toast.success('Данные загружены');
    } catch (caught) {
      setError(caught?.status === 409 ? new AppError('IMPORT-409') : caught);
      if (caught?.status === 409) toast.error('Данные изменились, пока вы проверяли файл. Проверка пересчитана — посмотрите её ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setSource(null);
    setJob(null);
    setError(null);
    setStep(0);
  };

  return (
    <>
      <PageHeader
        title="Импорт данных"
        hint="Загрузите вузы, продукты, программы и данные договоров из Excel или CSV. Перед записью вы увидите, что именно изменится, а после — сможете отменить импорт целиком."
        actions={<Button icon={DownloadIcon} onClick={downloadImportTemplate}>Скачать шаблон</Button>}
      />

      <ol className={styles.steps} aria-label="Шаги импорта">
        {STEPS.map((label, index) => (
          <li key={label} className={cn(styles.step, index === step && styles.stepCurrent, index < step && styles.stepDone)} aria-current={index === step ? 'step' : undefined}>
            <span className={styles.stepMarker}>{index < step ? <CheckIcon size={16} fill="currentColor" /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <Card className={styles.panel}>
        {step === 0 && (
          <div className={styles.stack}>
            <FileDropzone files={[]} multiple={false} accept=".xlsx,.csv" onChange={handleFile} title="Перетащите файл XLSX или CSV" hint="Первая строка — заголовки колонок · до 25 МБ · CSV через «;» или «,»" />
            <ErrorAlert error={error} />
            <InlineAlert tone="info" title="Нет файла под рукой?">
              Скачайте шаблон с колонками из регламента или попробуйте мастер на готовом примере.
            </InlineAlert>
            <div className={styles.actions}>
              <Button variant="primary" onClick={() => acceptRows('Пример.xlsx', 9_200, SAMPLE_IMPORT_ROWS)}>
                Попробовать на примере
              </Button>
            </div>
          </div>
        )}

        {step === 1 && source && (
          <MappingStep
            source={source}
            headers={headers}
            mapping={mapping}
            autoMapped={autoMapped}
            restored={mappingRestored}
            onChange={setMapping}
            error={error}
            onBack={restart}
            onNext={goToCheck}
          />
        )}

        {step === 2 && plan && (
          <CheckStep
            source={source}
            plan={plan}
            options={options}
            onOptions={setOptions}
            error={error}
            busy={busy}
            onBack={() => setStep(1)}
            onApply={apply}
          />
        )}

        {step === 3 && job && (
          <div className={styles.done}>
            <span className={styles.doneIcon}>
              <SuccessIcon size={32} fill="currentColor" />
            </span>
            <h2 className={styles.doneTitle}>{job.status === 'rolled_back' ? 'Импорт отменён' : 'Данные загружены'}</h2>
            <p className={styles.doneText}>
              Обновлено договоров: {job.stats.updatedContracts ?? 0}. Создано взаимодействий: {job.stats.newInteractions ?? 0}.
              Добавлено вузов: {job.stats.newUniversities ?? 0}, программ: {job.stats.newPrograms ?? 0}, продуктов: {job.stats.newProducts ?? 0}, контактов: {job.stats.newContacts ?? 0}.
            </p>
            <p className={styles.doneHint}>
              {job.status === 'rolled_back'
                ? 'Справочники и договоры вернулись к состоянию до загрузки. Файл остался в истории.'
                : 'Импорт сохранён в истории ниже: его можно отменить целиком, а исходный файл — скачать.'}
            </p>
            <div className={styles.actions}>
              <Button icon={UploadIcon} onClick={restart}>Загрузить ещё файл</Button>
              <ButtonLink to="/interactions" variant="primary">К взаимодействиям</ButtonLink>
            </div>
          </div>
        )}
      </Card>

      {(step === 0 || step === 3) && <ImportHistory version={historyVersion} onRolledBack={() => setJob((current) => (current ? { ...current, status: 'rolled_back' } : current))} />}
    </>
  );
}

function MappingStep({ source, headers, mapping, autoMapped, restored, onChange, error, onBack, onNext }) {
  const previewRows = source.rows.slice(1, PREVIEW_ROWS + 1);
  const matched = IMPORT_FIELDS.filter((field) => mapping[field.id] !== '').length;
  return (
    <div className={styles.stack}>
      <p className={styles.fileLine}>
        <b>{source.name}</b> · {formatFileSize(source.size)} · {source.rows.length - 1} {plural(source.rows.length - 1, ['строка', 'строки', 'строк'])} · сопоставлено {matched} из {IMPORT_FIELDS.length} полей
      </p>
      {restored && (
        <InlineAlert tone="success" title="Сопоставление восстановлено">
          Файл с такими же колонками уже загружали — применили прошлые настройки. Их можно поменять.
        </InlineAlert>
      )}
      <div className={styles.mapping} role="table" aria-label="Сопоставление полей">
        <div className={styles.mappingHead} role="row">
          <span role="columnheader">Поле в системе</span>
          <span role="columnheader">Колонка в файле</span>
          <span role="columnheader">Пример значения</span>
        </div>
        {IMPORT_FIELDS.map((field) => {
          const columnIndex = mapping[field.id];
          const sample = columnIndex === '' ? '' : source.rows[1]?.[Number(columnIndex)];
          return (
            <div key={field.id} className={styles.mappingRow} role="row">
              <span role="cell" className={styles.fieldName}>
                {field.label}
                {field.required && <span className={styles.required}> *</span>}
                {autoMapped.has(field.id) && mapping[field.id] !== '' && <Badge tone="success">авто</Badge>}
              </span>
              <span role="cell">
                <SelectMenu
                  label={`Колонка для поля «${field.label}»`}
                  value={columnIndex === '' ? '__skip__' : columnIndex}
                  onChange={(value) => onChange((current) => ({ ...current, [field.id]: value === '__skip__' ? '' : value }))}
                  options={[
                    { value: '__skip__', label: 'Не загружать' },
                    ...headers.map((header, index) => ({ value: String(index), label: header || `Колонка ${index + 1}` })),
                  ]}
                  fullWidth
                />
              </span>
              <span role="cell" className={styles.sample}>
                {sample === '' || sample === undefined ? '—' : String(sample)}
              </span>
            </div>
          );
        })}
      </div>

      <section className={styles.preview} aria-label="Первые строки файла">
        <p className={styles.issuesTitle}>Первые строки файла</p>
        <DataTable
          caption="Первые строки файла"
          rows={previewRows.map((cells, index) => ({ id: index, cells }))}
          columns={headers.map((header, columnIndex) => ({ id: `c${columnIndex}`, header: header || `Колонка ${columnIndex + 1}`, primary: columnIndex === 0, cell: (row) => String(row.cells[columnIndex] ?? '') }))}
        />
      </section>

      <ErrorAlert error={error} />
      <div className={styles.actions}>
        <Button icon={ArrowLeftIcon} onClick={onBack}>Другой файл</Button>
        <Button variant="primary" iconAfter={ArrowRightIcon} onClick={onNext}>Проверить данные</Button>
      </div>
    </div>
  );
}

/** Отчёт проверки — настоящий XLSX: каждая строка файла, что с ней будет и почему. */
function downloadCheckReport(source, plan) {
  const header = ['Строка', 'Вуз', 'Продукт', 'Результат', 'Замечания'];
  const body = plan.rowResults.map((row) => [row.rowNumber, row.university, row.product, IMPORT_ROW_STATUS_LABEL[row.status], row.messages.join(' ')]);
  downloadBlob(createXlsx({ header, body }, 'Проверка'), safeFileName(`Проверка импорта ${source.name.replace(/\.[^.]+$/, '')} ${formatDate(new Date())}`, 'xlsx'));
}

function CheckStep({ source, plan, options, onOptions, error, busy, onBack, onApply }) {
  const [tab, setTab] = useState('rows');
  const [rowFilter, setRowFilter] = useState('all');
  const errors = plan.rowResults.filter((row) => row.level === 'error').length;
  const rows = plan.rowResults.filter((row) => rowFilter === 'all' || (rowFilter === 'errors' ? row.level === 'error' : row.level !== 'ok'));
  const nothingToApply = plan.stats.rows === plan.stats.skipped;

  return (
    <div className={styles.stack}>
      <div className={styles.options}>
        <Switch
          label="Создавать взаимодействия для новых пар «вуз — продукт» (на первом этапе)"
          checked={options.createInteractions}
          onChange={(createInteractions) => onOptions((current) => ({ ...current, createInteractions }))}
        />
        <Switch
          label="Не перезаписывать уже заполненные поля договора"
          checked={options.keepFilled}
          onChange={(keepFilled) => onOptions((current) => ({ ...current, keepFilled }))}
        />
      </div>

      <div className={styles.summary}>
        <Summary value={plan.stats.rows} label="строк в файле" />
        <Summary value={plan.stats.updatedContracts} label="договоров обновится" />
        <Summary value={plan.stats.newInteractions} label="взаимодействий создастся" />
        <Summary value={plan.stats.newUniversities} label="новых вузов" />
        <Summary value={plan.stats.newPrograms + plan.stats.newProducts} label="программ и продуктов" />
        <Summary value={plan.stats.newContacts} label="новых контактов" />
        <Summary value={plan.stats.skipped} label="строк пропущено" tone={plan.stats.skipped ? 'danger' : undefined} />
      </div>

      {plan.issues.length === 0 ? (
        <InlineAlert tone="success" title="Ошибок не найдено">Все строки можно загрузить.</InlineAlert>
      ) : (
        <InlineAlert tone={errors ? 'danger' : 'warning'} title={`Замечаний: ${plan.issues.length}`}>
          {errors ? `${errors} ${plural(errors, ['строка будет пропущена', 'строки будут пропущены', 'строк будут пропущены'])}. ` : ''}
          Остальные строки загрузятся. Подробности — на вкладках ниже и в отчёте проверки.
        </InlineAlert>
      )}

      <div className={styles.checkTabs}>
        <Tabs
          label="Результат проверки"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'rows', label: 'Строки', count: plan.rowResults.length },
            { value: 'changes', label: 'Изменения', count: plan.changes.length },
            { value: 'issues', label: 'Замечания', count: plan.issues.length },
          ]}
        />
        <Button size="s" variant="ghost" icon={DownloadIcon} onClick={() => downloadCheckReport(source, plan)}>Отчёт проверки XLSX</Button>
      </div>

      {tab === 'rows' && (
        <>
          <SegmentedControl label="Какие строки показать" options={ROW_FILTERS} value={rowFilter} onChange={setRowFilter} className={styles.rowFilter} />
          <DataTable
            caption="Строки файла"
            rows={rows}
            rowKey={(row) => row.rowNumber}
            empty={<p className={styles.emptyNote}>Таких строк нет.</p>}
            columns={[
              { id: 'row', header: '№', cell: (row) => row.rowNumber },
              { id: 'university', header: 'Вуз', primary: true, cell: (row) => row.university || '—' },
              { id: 'product', header: 'Продукт', cell: (row) => row.product || '—' },
              { id: 'status', header: 'Результат', cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{IMPORT_ROW_STATUS_LABEL[row.status]}</Badge> },
              { id: 'notes', header: 'Замечания', cell: (row) => (row.messages.length ? row.messages.join(' ') : '—') },
            ]}
          />
        </>
      )}

      {tab === 'changes' && (
        <DataTable
          caption="Изменения в договорах"
          rows={plan.changes.map((change, index) => ({ ...change, id: index }))}
          empty={<p className={styles.emptyNote}>Существующие договоры не изменятся.</p>}
          columns={[
            { id: 'row', header: '№', cell: (change) => change.rowNumber },
            { id: 'label', header: 'Взаимодействие', primary: true, cell: (change) => change.label },
            { id: 'field', header: 'Поле', cell: (change) => change.field },
            { id: 'before', header: 'Было', cell: (change) => <span className={styles.before}>{String(change.before || '—')}</span> },
            { id: 'after', header: 'Станет', cell: (change) => <span className={styles.after}>{String(change.after)}</span> },
          ]}
        />
      )}

      {tab === 'issues' && (
        plan.issues.length === 0 ? <p className={styles.emptyNote}>Замечаний нет.</p> : (
          <ul className={styles.issues}>
            {plan.issues.map((issue) => (
              <li key={`${issue.rowNumber}-${issue.message}`} className={styles.issue}>
                <Badge tone={issue.level === 'error' ? 'danger' : 'warning'} icon={WarningIcon}>Строка {issue.rowNumber}</Badge>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        )
      )}

      <ErrorAlert error={error} />
      <div className={styles.actions}>
        <Button icon={ArrowLeftIcon} onClick={onBack} disabled={busy}>К сопоставлению</Button>
        <Button variant="primary" icon={UploadIcon} onClick={onApply} disabled={busy || nothingToApply}>
          {busy ? 'Загружаем…' : 'Загрузить данные'}
        </Button>
      </div>
    </div>
  );
}

function Summary({ value, label, tone }) {
  return (
    <div className={cn(styles.summaryItem, tone === 'danger' && styles.summaryDanger)}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
