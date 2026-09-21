import { useState } from 'react';
import { useElementWidth } from '../../lib/useElementWidth.js';
import { ChartEmpty } from './ChartEmpty.jsx';
import styles from './charts.module.css';
import { truncate } from './scale.js';
import { getBrandIntensity } from './shades.js';

const CELL_HEIGHT = 30;
const MIN_CELL_WIDTH = 36;
const HEADER_HEIGHT = 96;
const CELL_GAP = 2;

/**
 * Тепловая карта «строки × столбцы» (вуз × направление, менеджер × фаза).
 * Цвет — одна фиолетовая шкала от светлого к насыщенному; число всегда написано в ячейке,
 * поэтому цвет не единственный носитель смысла. Пустые пересечения — нейтральный фон.
 * Если столбцов много, карта прокручивается по горизонтали, а не сжимается до нечитаемого.
 */
export function HeatmapChart({ rows, columns, getValue, ariaLabel, formatTooltip, onCellClick }) {
  const [containerRef, width] = useElementWidth();
  const [hovered, setHovered] = useState(null);

  const values = rows.flatMap((row) => columns.map((column) => getValue(row, column)));
  const max = Math.max(0, ...values);
  if (rows.length === 0 || columns.length === 0 || max === 0) return <ChartEmpty />;

  const labelWidth = Math.min(200, Math.max(110, width * 0.26));
  const cellWidth = Math.max(MIN_CELL_WIDTH, Math.min(88, (width - labelWidth) / columns.length));
  const svgWidth = Math.max(width, labelWidth + cellWidth * columns.length);
  const height = HEADER_HEIGHT + rows.length * CELL_HEIGHT;

  return (
    <div ref={containerRef} className={`${styles.container} ${styles.scrollX}`}>
      {width > 0 && (
        <svg width={svgWidth} height={height} role="img" aria-label={ariaLabel} className={styles.svg} onMouseLeave={() => setHovered(null)}>
          {columns.map((column, columnIndex) => {
            const x = labelWidth + columnIndex * cellWidth + cellWidth / 2;
            return (
              <text key={column.id} transform={`translate(${x} ${HEADER_HEIGHT - 8}) rotate(-40)`} className={styles.tickLabel}>
                <title>{column.label}</title>
                {truncate(column.label, 120)}
              </text>
            );
          })}
          {rows.map((row, rowIndex) => {
            const y = HEADER_HEIGHT + rowIndex * CELL_HEIGHT;
            return (
              <g key={row.id}>
                <text x={0} y={y + CELL_HEIGHT / 2} dominantBaseline="middle" className={styles.axisLabel}>
                  <title>{row.label}</title>
                  {truncate(row.label, labelWidth - 12)}
                </text>
                {columns.map((column, columnIndex) => {
                  const value = getValue(row, column);
                  const ratio = value / max;
                  const x = labelWidth + columnIndex * cellWidth;
                  const isHovered = hovered?.row.id === row.id && hovered?.column.id === column.id;
                  return (
                    <g
                      key={column.id}
                      style={{ cursor: onCellClick && value > 0 ? 'pointer' : undefined }}
                      onMouseEnter={() => setHovered({ row, column, value, x, y })}
                      onClick={onCellClick && value > 0 ? () => onCellClick(row, column) : undefined}
                    >
                      <rect
                        x={x + CELL_GAP / 2}
                        y={y + CELL_GAP / 2}
                        width={cellWidth - CELL_GAP}
                        height={CELL_HEIGHT - CELL_GAP}
                        rx={4}
                        style={value > 0 ? { fill: getBrandIntensity(0.15 + ratio * 0.85) } : undefined}
                        className={value > 0 ? undefined : styles.emptyCell}
                        strokeWidth={isHovered ? 2 : 0}
                        stroke={isHovered ? 'currentColor' : undefined}
                      />
                      {value > 0 && (
                        <text
                          x={x + cellWidth / 2}
                          y={y + CELL_HEIGHT / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={`${styles.cellValue} ${ratio > 0.45 ? styles.cellValueOnDark : ''}`}
                        >
                          {value}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}
      {hovered && (
        <div className={styles.tooltip} style={{ top: hovered.y, left: Math.min(hovered.x, Math.max(0, svgWidth - 200)) }}>
          {formatTooltip ? formatTooltip(hovered) : (
            <>
              <b>{hovered.row.label}</b>
              <span>
                {hovered.column.label}: {hovered.value}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
