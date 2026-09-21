import { useState } from 'react';
import { formatNumber } from '../../domain/format.js';
import { useElementWidth } from '../../lib/useElementWidth.js';
import styles from './charts.module.css';
import { niceTicks } from './scale.js';

const MARGIN = { top: 16, right: 16, bottom: 32, left: 48 };

/**
 * Линейный график одной величины во времени. Наведение показывает вертикальную линию и точное значение.
 * points: [{ key, label, value }]
 */
export function LineChart({ points, ariaLabel, valueLabel, height = 260 }) {
  const [containerRef, width] = useElementWidth();
  const [activeIndex, setActiveIndex] = useState(null);

  const ticks = niceTicks(Math.max(1, ...points.map((point) => point.value)));
  const yMax = ticks.at(-1);
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const x = (index) => MARGIN.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value) => MARGIN.top + plotHeight - (value / yMax) * plotHeight;

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)}`).join(' ');
  const labelEvery = width < 520 ? 2 : 1;
  const active = activeIndex === null ? null : points[activeIndex];

  const handlePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left - MARGIN.left) / plotWidth;
    setActiveIndex(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <div ref={containerRef} className={styles.container}>
      {width > 0 && points.length > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          className={styles.svg}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setActiveIndex(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} className={styles.gridLine} />
              <text x={MARGIN.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className={styles.tickLabel}>
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          {points.map((point, index) =>
            index % labelEvery === 0 ? (
              <text key={point.key} x={x(index)} y={height - 8} textAnchor="middle" className={styles.tickLabel}>
                {point.label}
              </text>
            ) : null,
          )}
          <path d={path} className={styles.line} />
          {active && (
            <g>
              <line x1={x(activeIndex)} x2={x(activeIndex)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} className={styles.crosshair} />
              <circle cx={x(activeIndex)} cy={y(active.value)} r={5} className={styles.point} />
            </g>
          )}
        </svg>
      )}
      {active && (
        <div
          className={styles.tooltip}
          style={{ top: y(active.value) - 64, left: Math.min(Math.max(0, x(activeIndex) - 70), width - 160) }}
        >
          <b>{active.label}</b>
          <span>
            {valueLabel}: {formatNumber(active.value)}
          </span>
        </div>
      )}
    </div>
  );
}
