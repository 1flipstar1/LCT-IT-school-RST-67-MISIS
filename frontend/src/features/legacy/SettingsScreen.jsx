import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { useToast } from '../../ui/Toast.jsx';
import { AddIcon, AdjustIcon, SettingsIcon } from '../../ui/icons.js';
import { LegacyButton, LegacyScreen, PageHeader } from './legacyUi.jsx';

const CONNECTIONS = [
  { title: 'LMS Ростелекома', note: 'Данные обучения синхронизируются каждые 4 часа', state: 'Подключено' },
  { title: 'Сайт ИТ Школы', note: 'Импорт заявок с публичного сайта', state: 'Подключено' },
  { title: 'Уведомления', note: 'Email-уведомления о смене статуса и SLA', state: 'Включены' },
];

/** «Настройки системы» прежнего дизайна (ветка main): список подключений. */
export function SettingsScreen() {
  useDocumentTitle('Настройки системы — дизайн main');
  const toast = useToast();

  return (
    <LegacyScreen>
      <PageHeader title="Настройки системы">
        <LegacyButton primary onClick={() => toast.success('Форма добавления открыта')} icon={<AddIcon size={16} fill="currentColor" />}>
          Добавить интеграцию
        </LegacyButton>
      </PageHeader>

      <section className="panel table-panel">
        <div className="table-meta">
          <span>
            <b>Подключения</b>
          </span>
          <LegacyButton icon={<AdjustIcon size={15} fill="currentColor" />}>Фильтры</LegacyButton>
        </div>
        <div className="settings-list">
          {CONNECTIONS.map((connection) => (
            <div className="setting-row" key={connection.title}>
              <div>
                <b>{connection.title}</b>
                <span>{connection.note}</span>
              </div>
              <span className="status-tag green">{connection.state}</span>
              <button className="icon-button" aria-label={`Настроить: ${connection.title}`}>
                <SettingsIcon size={17} fill="currentColor" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </LegacyScreen>
  );
}
