import { useState } from 'react';
import { formatNumber } from '../../domain/format.js';
import { useElementWidth } from '../../lib/useElementWidth.js';
import { ChartEmpty } from './ChartEmpty.jsx';
import styles from './charts.module.css';
import { Legend } from './Legend.jsx';
import { truncate } from './scale.js';

const ROW_HEIGHT = 32;
const BAR_HEIGHT = 16;
const VALUE_WIDTH = 44;
const MAX_PLOT_WIDTH = 560;
const SEGMENT_GAP = 2;

/**
 * Горизонтальные столбцы с накоплением: из чего складывается итог строки (например, фазы у менеджера).
 * Между сегментами — зазор цвета фона, итог подписан справа, разбивка — в подсказке и таблице.
 * rows: [{ id, label, values: { [seriesId]: number } }], series: [{ id, label, color }]
 */
export function StackedBarChart({ rows, series, ariaLabel, onRowClick }) {
  const [containerRef, width] = useElementWidth();
  const [hovered, setHovered] = useState(null);

  const totals = rows.map((row) => series.reduce((sum, item) => sum + (row.values[item.id] ?? 0), 0));
  const max = Math.max(0, ...totals);
  if (max === 0) return <ChartEmpty />;

  const labelWidth = Math.min(240, Math.max(120, width * 0.34));
  const plotWidth = Math.min(MAX_PLOT_WIDTH, Math.max(0, width - labelWidth - VALUE_WIDTH));
  const height = rows.length * ROW_HEIGHT;

  return (
    <div ref={containerRef} className={styles.container}>
      <Legend items={series.map((item) => ({ ...item, shape: 'square' }))} />
      <div className={styles.plot}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className={styles.svg}>
            {rows.map((row, index) => {
              const y = index * ROW_HEIGHT;
              let x = labelWidth;
              const segments = series
                .filter((item) => row.values[item.id] > 0)
                .map((item) => {
                  const segmentWidth = (row.values[item.id] / max) * plotWidth;
                  const segment = { ...item, x, width: Math.max(2, segmentWidth - SEGMENT_GAP) };
                  x += segmentWidth;
                  return segment;
                });
              return (
                <g
                  key={row.id}
                  className={onRowClick ? styles.interactiveRow : undefined}
                  onMouseEnter={() => setHovered({ row, y, total: totals[index], x })}
                  onMouseLeave={() => setHovered(null)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  <rect x={0} y={y} width={width} height={ROW_HEIGHT} className={styles.hitArea} />
                  <text x={0} y={y + ROW_HEIGHT / 2} dominantBaseline="middle" className={styles.axisLabel}>
                    <title>{row.label}</title>
                    {truncate(row.label, labelWidth - 16)}
                  </text>
                  {segments.map((segment, segmentIndex) => (
                    <rect
                      key={segment.id}
                      x={segment.x}
                      y={y + (ROW_HEIGHT - BAR_HEIGHT) / 2}
                      width={segment.width}
                      height={BAR_HEIGHT}
                      rx={segmentIndex === segments.length - 1 ? 4 : 1}
                      style={{ fill: segment.color }}
                      className={`${styles.mark} ${hovered && hovered.row.id !== row.id ? styles.dimmed : ''}`}
                    />
                  ))}
                  <text x={x + 8} y={y + ROW_HEIGHT / 2} dominantBaseline="middle" className={styles.valueLabel}>
                    {formatNumber(totals[index])}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        {hovered && (
          <div className={styles.tooltip} style={{ top: hovered.y, left: Math.min(labelWidth, Math.max(0, width - 200)) }}>
            <b>{hovered.row.label}</b>
            {series.map((item) => (
              <span key={item.id}>
                {item.label}: {formatNumber(hovered.row.values[item.id] ?? 0)}
              </span>
            ))}
            <span>Всего: {formatNumber(hovered.total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
