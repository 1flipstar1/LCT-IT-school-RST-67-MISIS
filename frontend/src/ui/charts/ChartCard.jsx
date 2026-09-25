import { useRef } from 'react';
import { downloadChartAsPng } from '../../lib/export/chartImage.js';
import { safeFileName } from '../../lib/download.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { Card, CardHeader } from '../Card.jsx';
import { DataTable } from '../DataTable.jsx';
import { IconButton } from '../IconButton.jsx';
import { DownloadIcon } from '../icons.js';
import { SegmentedControl } from '../SegmentedControl.jsx';
import { useWidgetContext } from '../widgetContext.js';
import styles from './charts.module.css';

const VIEWS = [
  { value: 'chart', label: 'График' },
  { value: 'table', label: 'Таблица' },
];

/**
 * Карточка графика: у каждого графика есть табличный вид (точные числа, доступность)
 * и выгрузка в PNG (ТЗ: визуализация статистики в форматах png, pdf).
 * toolbar — элементы управления самим графиком (например, выбор вуза), выводятся над ним.
 */
export function ChartCard({ id, title, description, hint, chart, table, toolbar, footer }) {
  const [storedView, setView] = usePersistentState(`chart-view:${id}`, 'chart');
  const { action, exportMode } = useWidgetContext();
  const view = exportMode ? 'chart' : storedView;
  const chartRef = useRef(null);

  const exportPng = () => {
    if (chartRef.current) downloadChartAsPng(chartRef.current, { title, fileName: safeFileName(title, 'png') });
  };

  return (
    <Card className={action && !exportMode ? styles.withCornerAction : undefined}>
      <CardHeader
        title={title}
        description={description}
        hint={hint}
        actions={
          !exportMode && (
            <>
              <SegmentedControl label={`Вид: ${title}`} options={VIEWS} value={view} onChange={setView} />
              {view === 'chart' && <IconButton icon={DownloadIcon} label="Скачать график в PNG" onClick={exportPng} />}
            </>
          )
        }
      />
      {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
      {view === 'chart' ? (
        // data-chart-title — по нему экспорт страницы в PDF находит графики и их названия.
        <div ref={chartRef} data-chart-title={title}>
          {chart}
        </div>
      ) : (
        <div className={styles.tableView}>
          <DataTable caption={title} columns={table.columns} rows={table.rows} rowKey={table.rowKey} />
        </div>
      )}
      {footer && <div className={styles.footer}>{footer}</div>}
      {/* Действие панели (например, «В отчёт») — в правом нижнем углу карточки. */}
      {action && !exportMode && <div className={styles.cornerAction}>{action}</div>}
    </Card>
  );
}
