import { useState } from 'react';
import { formatNumber } from '../../domain/format.js';
import { useElementWidth } from '../../lib/useElementWidth.js';
import { ChartEmpty } from './ChartEmpty.jsx';
import styles from './charts.module.css';
import { CHAR_WIDTH, truncate } from './scale.js';

const SIZE = 176;
const RADIUS = 72;
const STROKE = 24;
const GAP = 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ROW = 28;

/**
 * Кольцевая диаграмма долей для нескольких укрупнённых категорий (до 5–6).
 * Кольцо и подписи с числами — один SVG: так диаграмма целиком попадает в PNG и PDF.
 * segments: [{ id, label, value, color }]
 */
export function DonutChart({ segments, ariaLabel, centerLabel = 'всего', onSegmentClick }) {
  const [containerRef, width] = useElementWidth();
  const [activeId, setActiveId] = useState(null);
  const total = segments.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) return <ChartEmpty />;

  // Подписи справа от кольца, на узком экране — под ним.
  const side = width >= SIZE + 220;
  const legendX = side ? SIZE + 24 : 0;
  const legendY = side ? Math.max(0, (SIZE - segments.length * ROW) / 2) : SIZE + 16;
  const height = side ? Math.max(SIZE, segments.length * ROW) : SIZE + 16 + segments.length * ROW;
  const legendWidth = Math.max(0, width - legendX);
  const active = segments.find((item) => item.id === activeId);

  let offset = 0;
  const arcs = segments
    .filter((item) => item.value > 0)
    .map((item) => {
      const length = (item.value / total) * CIRCUMFERENCE;
      const arc = { ...item, dash: Math.max(0, length - GAP), offset };
      offset += length;
      return arc;
    });

  const center = side ? SIZE / 2 : width / 2;

  return (
    <div ref={containerRef} className={styles.container} onMouseLeave={() => setActiveId(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className={styles.svg}>
          <g transform={`translate(${center} ${SIZE / 2}) rotate(-90)`}>
            {arcs.map((arc) => (
              <circle
                key={arc.id}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${arc.dash} ${CIRCUMFERENCE}`}
                strokeDashoffset={-arc.offset}
                style={{ stroke: arc.color, cursor: onSegmentClick ? 'pointer' : undefined }}
                className={`${styles.mark} ${activeId && activeId !== arc.id ? styles.dimmed : ''}`}
                onMouseEnter={() => setActiveId(arc.id)}
                onClick={onSegmentClick ? () => onSegmentClick(arc) : undefined}
              >
                <title>{`${arc.label}: ${formatNumber(arc.value)}`}</title>
              </circle>
            ))}
          </g>
          <text x={center} y={SIZE / 2 - 4} textAnchor="middle" className={styles.centerValue}>
            {formatNumber(active ? active.value : total)}
          </text>
          <text x={center} y={SIZE / 2 + 16} textAnchor="middle" className={styles.centerLabel}>
            {active ? `${Math.round((active.value / total) * 100)}%` : centerLabel}
          </text>

          {segments.map((item, index) => {
            const y = legendY + index * ROW + ROW / 2;
            const valueText = `${formatNumber(item.value)} · ${Math.round((item.value / total) * 100)}%`;
            return (
              <g
                key={item.id}
                className={`${styles.mark} ${activeId && activeId !== item.id ? styles.dimmed : ''}`}
                onMouseEnter={() => setActiveId(item.id)}
              >
                <rect x={legendX} y={y - ROW / 2} width={legendWidth} height={ROW} className={styles.hitArea} />
                <rect x={legendX} y={y - 5} width={10} height={10} rx={3} style={{ fill: item.color }} />
                <text x={legendX + 18} y={y} dominantBaseline="middle" className={styles.axisLabel}>
                  {truncate(item.label, legendWidth - 18 - valueText.length * CHAR_WIDTH - 12)}
                </text>
                <text x={width} y={y} textAnchor="end" dominantBaseline="middle" className={styles.valueLabel}>
                  {valueText}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
