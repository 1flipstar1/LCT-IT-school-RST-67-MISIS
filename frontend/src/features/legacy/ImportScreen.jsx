import { useState } from 'react';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { useToast } from '../../ui/Toast.jsx';
import { ArrowRightIcon, CheckIcon, CheckLargeIcon, HelpIcon, UploadIcon, XlsxIcon } from '../../ui/icons.js';
import { LegacyButton, LegacyScreen, PageHeader } from './legacyUi.jsx';

const STEPS = ['Загрузка файла', 'Сопоставление полей', 'Проверка', 'Результат'];

const FIELD_MAPPING = [
  ['Название вуза', 'Название ВУЗа'],
  ['ИТ-продукт', 'Продукт'],
  ['ИТ-направление', 'Направление'],
  ['Номер договора', 'Договор №'],
  ['Ответственный менеджер', 'Менеджер'],
];

/** «Импорт данных» прежнего дизайна (ветка main): четыре шага от загрузки файла до результата. */
export function ImportScreen() {
  useDocumentTitle('Импорт данных — дизайн main');
  const toast = useToast();
  const [step, setStep] = useState(0);

  return (
    <LegacyScreen>
      <PageHeader title="Импорт данных">
        <LegacyButton icon={<HelpIcon size={16} fill="currentColor" />}>Инструкция</LegacyButton>
      </PageHeader>

      <div className="import-steps">
        {STEPS.map((label, index) => (
          <div key={label} className={step >= index ? 'current' : ''}>
            <span>{index + 1}</span> {label}
          </div>
        ))}
      </div>

      <section className="panel import-panel">
        {step === 0 && (
          <>
            <div className="upload-zone">
              <div className="upload-icon">
                <UploadIcon size={26} fill="currentColor" />
              </div>
              <h2>Перетащите файл сюда</h2>
              <p>или выберите его на компьютере</p>
              <LegacyButton primary onClick={() => setStep(1)} icon={<XlsxIcon size={16} fill="currentColor" />}>
                Выбрать файл
              </LegacyButton>
              <span className="file-hint">Поддерживаются XLS, XLSX · до 20 МБ</span>
            </div>
            <div className="import-note">
              <CheckIcon size={18} fill="currentColor" />
              <div>
                <b>Перед началом</b>
                <span>Убедитесь, что в первой строке файла находятся заголовки колонок.</span>
              </div>
            </div>
          </>
        )}

        {step === 1 && <FieldMapping onNext={() => setStep(2)} />}
        {step === 2 && <Validation onNext={() => setStep(3)} />}

        {step === 3 && (
          <div className="result-state">
            <div className="success-icon">
              <CheckLargeIcon size={32} fill="currentColor" />
            </div>
            <h2>Импорт завершён</h2>
            <p>Данные успешно добавлены в систему.</p>
            <div className="result-numbers">
              <div>
                <b>124</b>
                <span>добавлено</span>
              </div>
              <div>
                <b>3</b>
                <span>пропущено</span>
              </div>
              <div>
                <b>0</b>
                <span>ошибок</span>
              </div>
            </div>
            <LegacyButton
              primary
              onClick={() => {
                setStep(0);
                toast.success('Импорт завершён успешно');
              }}
            >
              Вернуться к импортам
            </LegacyButton>
          </div>
        )}
      </section>
    </LegacyScreen>
  );
}

function FieldMapping({ onNext }) {
  return (
    <>
      <div className="import-title">
        <div>
          <h2>Сопоставление полей</h2>
          <p>Проверьте, как колонки файла будут импортированы в систему.</p>
        </div>
        <span className="file-pill">
          <XlsxIcon size={16} fill="currentColor" /> universities_may.xlsx
        </span>
      </div>
      <div className="mapping">
        {FIELD_MAPPING.map(([column, field]) => (
          <div key={column}>
            <b>{column}</b>
            <ArrowRightIcon size={16} fill="currentColor" />
            <select defaultValue={field}>
              <option>{field}</option>
              <option>Не импортировать</option>
            </select>
            <CheckIcon size={17} fill="#059669" />
          </div>
        ))}
      </div>
      <div className="import-footer">
        <span>Сопоставлено 5 из 5 полей</span>
        <LegacyButton primary onClick={onNext}>
          Продолжить <ArrowRightIcon size={16} fill="currentColor" />
        </LegacyButton>
      </div>
    </>
  );
}

function Validation({ onNext }) {
  return (
    <div className="check-state">
      <div className="check-header">
        <div className="success-icon small">
          <CheckLargeIcon size={20} fill="currentColor" />
        </div>
        <div>
          <h2>Файл готов к импорту</h2>
          <p>Проверка завершена без критических ошибок.</p>
        </div>
      </div>
      <div className="validation">
        <div>
          <b>124</b>
          <span>строки проверены</span>
        </div>
        <div>
          <b className="green">121</b>
          <span>готовы к импорту</span>
        </div>
        <div>
          <b className="amber-text">3</b>
          <span>с предупреждениями</span>
        </div>
      </div>
      <LegacyButton primary onClick={onNext}>
        Импортировать данные <UploadIcon size={16} fill="currentColor" />
      </LegacyButton>
    </div>
  );
}
