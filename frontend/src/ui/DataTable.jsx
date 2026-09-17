import { cn } from '../lib/cn.js';
import styles from './DataTable.module.css';

/**
 * Таблица с адаптивом: на телефоне каждая строка превращается в карточку «подпись: значение».
 * columns: [{ id, header, cell: (row) => node, width, align, primary, hideOnMobile }]
 * primary-колонка на телефоне становится заголовком карточки.
 */
export function DataTable({ columns, rows, rowKey = (row) => row.id, onRowClick, getRowLabel, empty, caption }) {
  if (rows.length === 0 && empty) return empty;

  const handleKeyDown = (event, row) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" style={{ width: column.width, textAlign: column.align }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(onRowClick && styles.clickable)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (event) => handleKeyDown(event, row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick && getRowLabel ? getRowLabel(row) : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  data-label={column.header}
                  style={{ textAlign: column.align }}
                  className={cn(column.primary && styles.primary, column.hideOnMobile && styles.hideOnMobile)}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
