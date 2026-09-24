import { Button } from '../../ui/Button.jsx';
import { Switch } from '../../ui/Field.jsx';
import { SegmentedControl } from '../../ui/SegmentedControl.jsx';
import { DEFAULT_SETTINGS, SETTING_OPTIONS } from './settings.js';
import { speechOutputSupported } from './speech.js';
import styles from './AssistantChat.module.css';

const MODEL_STATE_TEXT = {
  checking: 'Проверяем подключение…',
  online: 'Подключена',
  offline: 'Недоступна — работают встроенные команды',
  disabled: 'Отключена',
};

function Choice({ name, label, settings, onChange }) {
  const options = SETTING_OPTIONS[name];
  const description = options.find((option) => option.value === settings[name])?.description;
  return (
    <div className={styles.setting}>
      <p className={styles.settingLabel}>{label}</p>
      <SegmentedControl label={label} value={settings[name]} onChange={(value) => onChange({ [name]: value })} options={options} className={styles.settingControl} />
      {description && <p className={styles.settingHint}>{description}</p>}
    </div>
  );
}

const SWITCHES = [
  { name: 'confirmChanges', label: 'Спрашивать подтверждение перед изменением данных' },
  { name: 'autoDownload', label: 'Скачивать отчёт сразу, без нажатия кнопки' },
  { name: 'showSuggestions', label: 'Показывать подсказки следующих шагов' },
  { name: 'enterToSend', label: 'Отправлять по Enter (перенос строки — Shift + Enter)' },
  { name: 'keepHistory', label: 'Сохранять переписку после закрытия браузера' },
  { name: 'speak', label: 'Озвучивать ответы', hidden: !speechOutputSupported },
];

export function AssistantSettings({ settings, onChange, model, onDone }) {
  return (
    <div className={styles.settings}>
      <Choice name="mode" label="Режим работы" settings={settings} onChange={onChange} />
      <Choice name="engine" label="Как понимать запросы" settings={settings} onChange={onChange} />
      <Choice name="detail" label="Ответы модели" settings={settings} onChange={onChange} />
      <Choice name="reportFormat" label="Формат отчёта по умолчанию" settings={settings} onChange={onChange} />

      <div className={styles.switches}>
        {SWITCHES.filter((item) => !item.hidden).map((item) => (
          <Switch key={item.name} label={item.label} checked={settings[item.name]} onChange={(checked) => onChange({ [item.name]: checked })} />
        ))}
      </div>

      <div className={styles.modelInfo}>
        <p className={styles.settingLabel}>Локальная ИИ-модель</p>
        <p className={styles.settingHint}>
          {MODEL_STATE_TEXT[model.state]}{model.model ? ` · ${model.model}` : ''}. Модель работает на сервере компании через Ollama: бесплатно, данные не уходят во внешние сервисы.
        </p>
        <p className={styles.settingHint}>Горячая клавиша: Ctrl + / открывает и закрывает помощника.</p>
      </div>

      <div className={styles.cardActions}>
        <Button variant="primary" size="s" onClick={onDone}>Готово</Button>
        <Button variant="ghost" size="s" onClick={() => onChange(DEFAULT_SETTINGS)}>Сбросить настройки</Button>
      </div>
    </div>
  );
}
