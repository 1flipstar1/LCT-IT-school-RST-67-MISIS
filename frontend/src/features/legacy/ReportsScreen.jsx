import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { useToast } from '../../ui/Toast.jsx';
import { AddIcon, AnalyticsIcon, DownloadIcon, ReportIcon } from '../../ui/icons.js';
import { LegacyButton, LegacyScreen, PageHeader } from './legacyUi.jsx';

const HISTORY = [
  { name: 'Реестр вузов — май 2026', author: 'Алексей Козлов', createdAt: 'Сегодня, 10:24', format: 'XLSX' },
  { name: 'Отчёт по конверсии Q1', author: 'Елена Ким', createdAt: '14.05.2026', format: 'PDF' },
  { name: 'Программы обучения — регионы', author: 'Михаил Орлов', createdAt: '12.05.2026', format: 'XLSX' },
];

/** «Отчёты» прежнего дизайна (ветка main): две заготовки отчётов и история выгрузок. */
export function ReportsScreen() {
  useDocumentTitle('Отчёты — дизайн main');
  const toast = useToast();

  return (
    <LegacyScreen>
      <PageHeader title="Отчёты">
        <LegacyButton primary onClick={() => toast.success('Конструктор отчёта открыт')} icon={<AddIcon size={16} fill="currentColor" />}>
          Создать отчёт
        </LegacyButton>
      </PageHeader>

      <div className="report-cards">
        <div className="report-card">
          <ReportIcon size={24} fill="currentColor" />
          <div>
            <b>Реестр взаимодействий</b>
            <span>Вузы, статусы, ответственные</span>
          </div>
          <LegacyButton onClick={() => toast.success('Отчёт скачивается')} icon={<DownloadIcon size={15} fill="currentColor" />}>
            XLSX
          </LegacyButton>
        </div>
        <div className="report-card">
          <AnalyticsIcon size={24} fill="currentColor" />
          <div>
            <b>Статистика по программам</b>
            <span>Обучающиеся и заявки за период</span>
          </div>
          <LegacyButton onClick={() => toast.success('Отчёт скачивается')} icon={<DownloadIcon size={15} fill="currentColor" />}>
            PDF
          </LegacyButton>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>История отчётов</h2>
            <span>Последние сформированные документы</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>НАЗВАНИЕ</th>
              <th>АВТОР</th>
              <th>ДАТА СОЗДАНИЯ</th>
              <th>ФОРМАТ</th>
              <th>СТАТУС</th>
            </tr>
          </thead>
          <tbody>
            {HISTORY.map((report) => (
              <tr key={report.name}>
                <td>
                  <b>{report.name}</b>
                </td>
                <td>{report.author}</td>
                <td className="muted">{report.createdAt}</td>
                <td>
                  <span className="file-type">{report.format}</span>
                </td>
                <td>
                  <span className="status-tag green">Готов</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </LegacyScreen>
  );
}
