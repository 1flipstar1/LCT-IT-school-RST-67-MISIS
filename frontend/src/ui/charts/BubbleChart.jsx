import { useState } from 'react';
import { formatNumber } from '../../domain/format.js';
import { useElementWidth } from '../../lib/useElementWidth.js';
import { ChartEmpty } from './ChartEmpty.jsx';
import styles from './charts.module.css';
import { clampTooltipLeft, niceTicks } from './scale.js';

const MARGIN = { top: 16, right: 24, bottom: 44, left: 56 };
const MIN_RADIUS = 6;
const MAX_RADIUS = 26;
/** Подписываем только самые крупные пузыри — иначе подписи наезжают друг на друга. */
const LABELLED = 4;

/**
 * Пузырьковая диаграмма: две величины по осям, третья — площадью пузыря.
 * points: [{ id, label, x, y, size }]
 */
export function BubbleChart({ points, xLabel, yLabel, sizeLabel, ariaLabel, height = 300 }) {
  const [containerRef, width] = useElementWidth();
  const [hovered, setHovered] = useState(null);
  if (points.length === 0) return <ChartEmpty />;

  const xTicks = niceTicks(Math.max(1, ...points.map((point) => point.x)));
  const yTicks = niceTicks(Math.max(1, ...points.map((point) => point.y)));
  const maxSize = Math.max(1, ...points.map((point) => point.size));
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const x = (value) => MARGIN.left + (value / xTicks.at(-1)) * plotWidth;
  const y = (value) => MARGIN.top + plotHeight - (value / yTicks.at(-1)) * plotHeight;
  // Площадь пропорциональна значению — радиус через квадратный корень.
  const radius = (value) => MIN_RADIUS + Math.sqrt(value / maxSize) * (MAX_RADIUS - MIN_RADIUS);

  const labelled = new Set([...points].sort((a, b) => b.size - a.size).slice(0, LABELLED).map((point) => point.id));
  // Крупные — снизу, мелкие — поверх, чтобы их можно было навести.
  const ordered = [...points].sort((a, b) => b.size - a.size);

  return (
    <div ref={containerRef} className={styles.container}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className={styles.svg}>
          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} className={styles.gridLine} />
              <text x={MARGIN.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className={styles.tickLabel}>
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text key={`x${tick}`} x={x(tick)} y={height - MARGIN.bottom + 18} textAnchor="middle" className={styles.tickLabel}>
              {formatNumber(tick)}
            </text>
          ))}
          <text x={MARGIN.left + plotWidth / 2} y={height - 4} textAnchor="middle" className={styles.tickLabel}>
            {xLabel} →
          </text>
          <text transform={`translate(12 ${MARGIN.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" className={styles.tickLabel}>
            {yLabel} →
          </text>
          {ordered.map((point) => (
            <g key={point.id} onMouseEnter={() => setHovered(point)} onMouseLeave={() => setHovered(null)}>
              <circle
                cx={x(point.x)}
                cy={y(point.y)}
                r={radius(point.size)}
                className={`${styles.mark} ${hovered?.id === point.id ? styles.point : styles.softFill} ${hovered && hovered.id !== point.id ? styles.dimmed : ''}`}
              />
              {labelled.has(point.id) && (
                <text x={x(point.x) + radius(point.size) + 4} y={y(point.y)} dominantBaseline="middle" className={styles.tickLabel}>
                  {point.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
      {hovered && (
        <div className={styles.tooltip} style={{ top: y(hovered.y) - radius(hovered.size) - 4, left: clampTooltipLeft(x(hovered.x), width) }}>
          <b>{hovered.label}</b>
          <span>
            {xLabel}: {formatNumber(hovered.x)}
          </span>
          <span>
            {yLabel}: {formatNumber(hovered.y)}
          </span>
          <span>
            {sizeLabel}: {formatNumber(hovered.size)}
          </span>
        </div>
      )}
    </div>
  );
}
