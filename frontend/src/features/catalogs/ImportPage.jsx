import { useState } from 'react';
import { apiClient, apiErrorToAppError, waitForJob } from '../../api/client.js';
import { AppError } from '../../domain/errors.js';
import { formatFileSize, plural } from '../../domain/format.js';
import { autoMatchColumns, IMPORT_FIELDS, SAMPLE_IMPORT_ROWS, validateMapping } from '../../domain/import.js';
import { cn } from '../../lib/cn.js';
import { createXlsx } from '../../lib/export/spreadsheet.js';
import { useStoreApi } from '../../store/StoreProvider.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { Card } from '../../ui/Card.jsx';
import { FileDropzone } from '../../ui/FileDropzone.jsx';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DownloadIcon, SuccessIcon, WarningIcon } from '../../ui/icons.js';
import { ErrorAlert, InlineAlert } from '../../ui/InlineAlert.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { SelectMenu } from '../../ui/SelectMenu.jsx';
import { useToast } from '../../ui/Toast.jsx';
import styles from './ImportPage.module.css';
import { downloadImportTemplate } from './importTemplate.js';

const STEPS = ['Файл', 'Сопоставление', 'Проверка', 'Готово'];

/** Мастер импорта: файл → сопоставление колонок → проверка изменений → результат. */
export function ImportPage() {
  const storeApi = useStoreApi();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [source, setSource] = useState(null); // { name, size, rows }
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);

  const headers = source?.headers ?? [];

  const normalizeImportError = (caught) => {
    if (caught instanceof AppError) return caught;
    if (caught?.status === 413) return new AppError('FILE-413', caught.details);
    if (caught?.status === 415) return new AppError('FILE-415', caught.details);
    if (caught?.status === 422) return new AppError('IMPORT-400', caught.details);
    return apiErrorToAppError(caught);
  };

  const handleFile = async ([file]) => {
    if (!file) return;
    setBusy(true);
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new AppError('FILE-415');
      const queued = await apiClient.createImport(file);
      const parsed = await waitForJob((jobId) => apiClient.getImport(jobId), queued, { ready: ['ready'] });
      const parsedResult = parsed.result;
      setSource({ jobId: parsed.id, name: file.name, size: file.size, headers: parsedResult.headers, previewRows: parsedResult.previewRows, rowCount: parsedResult.rowCount });
      setMapping(autoMatchColumns(parsedResult.headers));
      setPlan(null);
      setError(null);
      setStep(1);
    } catch (caught) {
      setError(normalizeImportError(caught));
    } finally {
      setBusy(false);
    }
  };

  const goToCheck = async () => {
    setBusy(true);
    try {
      validateMapping(mapping);
      const preview = await apiClient.previewImport(source.jobId, mapping);
      setPlan(preview);
      setError(null);
      setStep(2);
    } catch (caught) {
      setError(normalizeImportError(caught));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      const queued = await apiClient.applyImport(source.jobId, mapping);
      const completed = await waitForJob((jobId) => apiClient.getImport(jobId), queued);
      await storeApi.rehydrate();
      setResult(completed.result.stats);
      setError(null);
      setStep(3);
      toast.success('Данные загружены');
    } catch (caught) {
      setError(normalizeImportError(caught));
    } finally {
      setBusy(false);
    }
  };

  const trySample = () => {
    const [header, ...body] = SAMPLE_IMPORT_ROWS;
    const blob = createXlsx({ header, body }, 'Импорт');
    handleFile([new File([blob], 'Пример.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })]);
  };

  return (
    <>
      <PageHeader
        back={{ to: '/catalogs', label: 'Справочники' }}
        title="Загрузка из Excel" hint="Обновите справочники и данные договоров из файла. Перед записью вы увидите, что именно изменится."
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
            <FileDropzone files={[]} multiple={false} accept=".xls,.xlsx" onChange={handleFile} title={busy ? 'Загружаем и проверяем файл…' : 'Перетащите файл XLS или XLSX'} hint="Первая строка — заголовки колонок · до 25 МБ" />
            <ErrorAlert error={error} />
            <InlineAlert tone="info" title="Нет файла под рукой?">
              Скачайте шаблон с нужными колонками или попробуйте мастер на готовом примере.
            </InlineAlert>
            <div className={styles.actions}>
              <Button icon={DownloadIcon} onClick={downloadImportTemplate}>
                Скачать шаблон
              </Button>
              <Button variant="primary" disabled={busy} onClick={trySample}>
                Попробовать на примере
              </Button>
            </div>
          </div>
        )}

        {step === 1 && source && (
          <div className={styles.stack}>
            <p className={styles.fileLine}>
              <b>{source.name}</b> · {formatFileSize(source.size)} · {source.rowCount} {plural(source.rowCount, ['строка', 'строки', 'строк'])}
            </p>
            <div className={styles.mapping} role="table" aria-label="Сопоставление полей">
              <div className={styles.mappingHead} role="row">
                <span role="columnheader">Поле в системе</span>
                <span role="columnheader">Колонка в файле</span>
                <span role="columnheader">Пример значения</span>
              </div>
              {IMPORT_FIELDS.map((field) => {
                const columnIndex = mapping[field.id];
                const sample = columnIndex === '' ? '' : source.previewRows[0]?.[Number(columnIndex)];
                return (
                  <div key={field.id} className={styles.mappingRow} role="row">
                    <span role="cell" className={styles.fieldName}>
                      {field.label}
                      {field.required && <span className={styles.required}> *</span>}
                    </span>
                    <span role="cell">
                      <SelectMenu
                        label={`Колонка для поля «${field.label}»`}
                        value={columnIndex === '' ? '__skip__' : columnIndex}
                        onChange={(value) => setMapping((current) => ({ ...current, [field.id]: value === '__skip__' ? '' : value }))}
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
            <ErrorAlert error={error} />
            <div className={styles.actions}>
              <Button icon={ArrowLeftIcon} onClick={() => setStep(0)}>
                Другой файл
              </Button>
              <Button variant="primary" iconAfter={ArrowRightIcon} disabled={busy} onClick={goToCheck}>
                {busy ? 'Проверяем…' : 'Проверить данные'}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && plan && (
          <div className={styles.stack}>
            <div className={styles.summary}>
              <Summary value={plan.stats.rows} label="строк в файле" />
              <Summary value={plan.stats.updatedContracts} label="договоров обновится" />
              <Summary value={plan.stats.newUniversities} label="новых вузов" />
              <Summary value={plan.stats.newPrograms} label="новых программ" />
              <Summary value={plan.stats.newProducts} label="новых продуктов" />
              <Summary value={plan.stats.newContacts} label="новых контактов" />
            </div>
            {plan.issues.length === 0 ? (
              <InlineAlert tone="success" title="Ошибок не найдено">
                Все строки можно загрузить.
              </InlineAlert>
            ) : (
              <div className={styles.issues}>
                <p className={styles.issuesTitle}>Обратите внимание ({plan.issues.length})</p>
                <ul>
                  {plan.issues.map((issue) => (
                    <li key={`${issue.rowNumber}-${issue.message}`} className={styles.issue}>
                      <Badge tone={issue.level === 'error' ? 'danger' : 'warning'} icon={WarningIcon}>
                        Строка {issue.rowNumber}
                      </Badge>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className={styles.actions}>
              <Button icon={ArrowLeftIcon} onClick={() => setStep(1)}>
                К сопоставлению
              </Button>
              <Button variant="primary" disabled={busy} onClick={apply}>
                {busy ? 'Загружаем…' : 'Загрузить данные'}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className={styles.done}>
            <span className={styles.doneIcon}>
              <SuccessIcon size={32} fill="currentColor" />
            </span>
            <h2 className={styles.doneTitle}>Данные загружены</h2>
            <p className={styles.doneText}>
              Обновлено договоров: {result.updatedContracts}. Добавлено вузов: {result.newUniversities}, программ: {result.newPrograms}, продуктов: {result.newProducts}, контактов: {result.newContacts}.
            </p>
            <div className={styles.actions}>
              <Button
                onClick={() => {
                  setSource(null);
                  setResult(null);
                  setPlan(null);
                  setMapping({});
                  setError(null);
                  setStep(0);
                }}
              >
                Загрузить ещё файл
              </Button>
              <ButtonLink to="/catalogs" variant="primary">
                К справочникам
              </ButtonLink>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

function Summary({ value, label }) {
  return (
    <div className={styles.summaryItem}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
