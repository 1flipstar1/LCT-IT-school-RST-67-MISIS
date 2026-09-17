import { useMemo, useState } from 'react';
import { AppError } from '../../domain/errors.js';
import { formatFileSize, plural } from '../../domain/format.js';
import { autoMatchColumns, IMPORT_FIELDS, planImport, SAMPLE_IMPORT_ROWS, validateMapping } from '../../domain/import.js';
import { cn } from '../../lib/cn.js';
import { readXlsx } from '../../lib/xlsx/readXlsx.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { Badge } from '../../ui/Badge.jsx';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { Card } from '../../ui/Card.jsx';
import { FileDropzone } from '../../ui/FileDropzone.jsx';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DownloadIcon, SuccessIcon, WarningIcon } from '../../ui/icons.js';
import { ErrorAlert, InlineAlert } from '../../ui/InlineAlert.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { useToast } from '../../ui/Toast.jsx';
import styles from './ImportPage.module.css';
import { downloadImportTemplate } from './importTemplate.js';

const STEPS = ['Файл', 'Сопоставление', 'Проверка', 'Готово'];

/** Мастер импорта: файл → сопоставление колонок → проверка изменений → результат. */
export function ImportPage() {
  const state = useStoreState();
  const actions = useActions();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [source, setSource] = useState(null); // { name, size, rows }
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const headers = source?.rows[0] ?? [];
  const plan = useMemo(() => (step === 2 && source ? planImport(source.rows, mapping, state) : null), [step, source, mapping, state]);

  const acceptRows = (name, size, rows) => {
    if (rows.length < 2) throw new AppError('IMPORT-400', 'В файле нет строк с данными');
    setSource({ name, size, rows });
    setMapping(autoMatchColumns(rows[0]));
    setError(null);
    setStep(1);
  };

  const handleFile = async ([file]) => {
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) throw new AppError('IMPORT-400', 'Поддерживается XLSX');
      acceptRows(file.name, file.size, await readXlsx(file));
    } catch (caught) {
      setError(caught);
    }
  };

  const goToCheck = () => {
    try {
      validateMapping(mapping);
      setError(null);
      setStep(2);
    } catch (caught) {
      setError(caught);
    }
  };

  const apply = () => {
    const { stats } = plan;
    actions.applyImport({
      universities: plan.universities,
      products: plan.products,
      interactions: plan.interactions,
      summary: `Импорт «${source.name}»: строк ${stats.rows}, новых вузов ${stats.newUniversities}, обновлено договоров ${stats.updatedContracts}`,
    });
    setResult(stats);
    setStep(3);
    toast.success('Данные загружены');
  };

  return (
    <>
      <PageHeader
        back={{ to: '/catalogs', label: 'Справочники' }}
        title="Загрузка из Excel"
        description="Обновите справочники и данные договоров из файла. Перед записью вы увидите, что именно изменится."
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
            <FileDropzone files={[]} multiple={false} accept=".xlsx" onChange={handleFile} title="Перетащите файл XLSX" hint="Первая строка — заголовки колонок · до 25 МБ" />
            <ErrorAlert error={error} />
            <InlineAlert tone="info" title="Нет файла под рукой?">
              Скачайте шаблон с нужными колонками или попробуйте мастер на готовом примере.
            </InlineAlert>
            <div className={styles.actions}>
              <Button icon={DownloadIcon} onClick={downloadImportTemplate}>
                Скачать шаблон
              </Button>
              <Button variant="primary" onClick={() => acceptRows('Пример.xlsx', 9_200, SAMPLE_IMPORT_ROWS)}>
                Попробовать на примере
              </Button>
            </div>
          </div>
        )}

        {step === 1 && source && (
          <div className={styles.stack}>
            <p className={styles.fileLine}>
              <b>{source.name}</b> · {formatFileSize(source.size)} · {source.rows.length - 1} {plural(source.rows.length - 1, ['строка', 'строки', 'строк'])}
            </p>
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
                    </span>
                    <span role="cell">
                      <select
                        className={styles.select}
                        aria-label={`Колонка для поля «${field.label}»`}
                        value={columnIndex}
                        onChange={(event) => setMapping((current) => ({ ...current, [field.id]: event.target.value }))}
                      >
                        <option value="">Не загружать</option>
                        {headers.map((header, index) => (
                          <option key={`${header}-${index}`} value={String(index)}>
                            {header || `Колонка ${index + 1}`}
                          </option>
                        ))}
                      </select>
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
              <Button variant="primary" iconAfter={ArrowRightIcon} onClick={goToCheck}>
                Проверить данные
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
              <Button variant="primary" onClick={apply}>
                Загрузить данные
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
              Обновлено договоров: {result.updatedContracts}. Добавлено вузов: {result.newUniversities}, продуктов: {result.newProducts}, контактов: {result.newContacts}.
            </p>
            <div className={styles.actions}>
              <Button
                onClick={() => {
                  setSource(null);
                  setResult(null);
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
