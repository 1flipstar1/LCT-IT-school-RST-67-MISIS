import { useRef } from 'react';
import { downloadChartAsPng } from '../../lib/export/chartImage.js';
import { safeFileName } from '../../lib/download.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { Card, CardHeader } from '../Card.jsx';
import { DataTable } from '../DataTable.jsx';
import { IconButton } from '../IconButton.jsx';
import { DownloadIcon } from '../icons.js';
import { SegmentedControl } from '../SegmentedControl.jsx';
import styles from './charts.module.css';

const VIEWS = [
  { value: 'chart', label: 'График' },
  { value: 'table', label: 'Таблица' },
];

/**
 * Карточка графика: у каждого графика есть табличный вид (точные числа, доступность)
 * и выгрузка в PNG (ТЗ: визуализация статистики в форматах png, pdf).
 */
export function ChartCard({ id, title, description, hint, chart, table, footer }) {
  const [view, setView] = usePersistentState(`chart-view:${id}`, 'chart');
  const chartRef = useRef(null);

  const exportPng = () => {
    if (chartRef.current) downloadChartAsPng(chartRef.current, { title, fileName: safeFileName(title, 'png') });
  };

  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        hint={hint}
        actions={
          <>
            <SegmentedControl label={`Вид: ${title}`} options={VIEWS} value={view} onChange={setView} />
            {view === 'chart' && <IconButton icon={DownloadIcon} label="Скачать график в PNG" onClick={exportPng} />}
          </>
        }
      />
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
    </Card>
  );
}
