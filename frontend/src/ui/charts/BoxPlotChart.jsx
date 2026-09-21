import { useState } from 'react';
import { formatNumber } from '../../domain/format.js';
import { useElementWidth } from '../../lib/useElementWidth.js';
import { ChartEmpty } from './ChartEmpty.jsx';
import styles from './charts.module.css';
import { clampTooltipLeft, niceTicks, truncate } from './scale.js';

const ROW_HEIGHT = 44;
const BOX_HEIGHT = 20;
const AXIS_HEIGHT = 28;

const format = (value) => formatNumber(Math.round(value * 10) / 10);

/**
 * Диаграмма размаха (box plot), горизонтальная: коробка — от 1-го до 3-го квартиля, линия внутри — медиана,
 * «усы» — до крайних обычных значений, оранжевые точки — аномально долгие или короткие значения.
 * groups: [{ id, label, stats: { min, q1, median, q3, max, outliers, count } }]
 */
export function BoxPlotChart({ groups, ariaLabel, unit = 'дн.' }) {
  const [containerRef, width] = useElementWidth();
  const [hovered, setHovered] = useState(null);
  if (groups.length === 0) return <ChartEmpty />;

  const ticks = niceTicks(Math.max(1, ...groups.flatMap((group) => [group.stats.max, ...group.stats.outliers])));
  const labelWidth = Math.min(200, Math.max(110, width * 0.26));
  const plotWidth = Math.max(0, width - labelWidth - 16);
  const x = (value) => labelWidth + (value / ticks.at(-1)) * plotWidth;
  const height = groups.length * ROW_HEIGHT + AXIS_HEIGHT;

  return (
    <div ref={containerRef} className={styles.container}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className={styles.svg}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={x(tick)} x2={x(tick)} y1={0} y2={height - AXIS_HEIGHT} className={styles.gridLine} />
              <text x={x(tick)} y={height - 8} textAnchor="middle" className={styles.tickLabel}>
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          {groups.map((group, index) => {
            const { stats } = group;
            const cy = index * ROW_HEIGHT + ROW_HEIGHT / 2;
            return (
              <g key={group.id} onMouseEnter={() => setHovered({ group, cy })} onMouseLeave={() => setHovered(null)}>
                <rect x={0} y={cy - ROW_HEIGHT / 2} width={width} height={ROW_HEIGHT} className={styles.hitArea} />
                <text x={0} y={cy} dominantBaseline="middle" className={styles.axisLabel}>
                  {truncate(group.label, labelWidth - 12)}
                </text>
                <line x1={x(stats.min)} x2={x(stats.q1)} y1={cy} y2={cy} className={styles.whisker} />
                <line x1={x(stats.q3)} x2={x(stats.max)} y1={cy} y2={cy} className={styles.whisker} />
                <line x1={x(stats.min)} x2={x(stats.min)} y1={cy - 6} y2={cy + 6} className={styles.whisker} />
                <line x1={x(stats.max)} x2={x(stats.max)} y1={cy - 6} y2={cy + 6} className={styles.whisker} />
                <rect x={x(stats.q1)} y={cy - BOX_HEIGHT / 2} width={Math.max(2, x(stats.q3) - x(stats.q1))} height={BOX_HEIGHT} rx={4} className={styles.softFill} />
                <line x1={x(stats.median)} x2={x(stats.median)} y1={cy - BOX_HEIGHT / 2} y2={cy + BOX_HEIGHT / 2} className={styles.medianLine} />
                {stats.outliers.map((value, outlierIndex) => (
                  <circle key={outlierIndex} cx={x(value)} cy={cy} r={5} className={styles.outlier} />
                ))}
              </g>
            );
          })}
        </svg>
      )}
      {hovered && (
        <div className={styles.tooltip} style={{ top: hovered.cy - 12, left: clampTooltipLeft(x(hovered.group.stats.median), width, 220) }}>
          <b>{hovered.group.label}</b>
          <span>Медиана: {format(hovered.group.stats.median)} {unit}</span>
          <span>
            Половина значений: {format(hovered.group.stats.q1)}–{format(hovered.group.stats.q3)} {unit}
          </span>
          <span>
            Обычный разброс: {format(hovered.group.stats.min)}–{format(hovered.group.stats.max)} {unit}
          </span>
          <span>
            Аномальных: {hovered.group.stats.outliers.length}
            {hovered.group.stats.outliers.length > 0 && ` (${hovered.group.stats.outliers.map(format).join(', ')} ${unit})`}
          </span>
          <span>Всего значений: {hovered.group.stats.count}</span>
        </div>
      )}
    </div>
  );
}
