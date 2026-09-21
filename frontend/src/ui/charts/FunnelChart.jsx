import { useState } from 'react';
import { formatNumber } from '../../domain/format.js';
import { useElementWidth } from '../../lib/useElementWidth.js';
import { ChartEmpty } from './ChartEmpty.jsx';
import styles from './charts.module.css';
import { clampTooltipLeft, truncate } from './scale.js';

const ROW_HEIGHT = 30;
const BAR_HEIGHT = 20;
const VALUE_WIDTH = 104;

/**
 * Воронка: полоса каждого шага центрирована, её ширина — сколько дошло до шага.
 * Справа — число и конверсия из предыдущего шага; просадка конверсии видна без подсказок.
 * steps: [{ id, label, value, conversion, muted }] — muted (необязательный этап) рисуется светлее.
 */
export function FunnelChart({ steps, ariaLabel, onStepClick, valueLabel = 'Дошли' }) {
  const [containerRef, width] = useElementWidth();
  const [hovered, setHovered] = useState(null);
  const max = Math.max(0, ...steps.map((step) => step.value));

  if (max === 0) return <ChartEmpty />;

  const labelWidth = Math.min(260, Math.max(120, width * 0.34));
  const plotWidth = Math.max(0, width - labelWidth - VALUE_WIDTH);
  const center = labelWidth + plotWidth / 2;
  const height = steps.length * ROW_HEIGHT;

  return (
    <div ref={containerRef} className={styles.container}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className={styles.svg}>
          {steps.map((step, index) => {
            const y = index * ROW_HEIGHT;
            const barWidth = step.value === 0 ? 0 : Math.max(4, (step.value / max) * plotWidth);
            return (
              <g
                key={step.id}
                className={onStepClick ? styles.interactiveRow : undefined}
                onMouseEnter={() => setHovered({ ...step, y, barWidth })}
                onMouseLeave={() => setHovered(null)}
                onClick={onStepClick ? () => onStepClick(step) : undefined}
              >
                <rect x={0} y={y} width={width} height={ROW_HEIGHT} className={styles.hitArea} />
                <text x={0} y={y + ROW_HEIGHT / 2} dominantBaseline="middle" className={styles.axisLabel}>
                  <title>{step.label}</title>
                  {truncate(`${index + 1}. ${step.label}`, labelWidth - 12)}
                </text>
                {barWidth > 0 && (
                  <rect
                    x={center - barWidth / 2}
                    y={y + (ROW_HEIGHT - BAR_HEIGHT) / 2}
                    width={barWidth}
                    height={BAR_HEIGHT}
                    rx={4}
                    className={hovered?.id === step.id ? styles.barActive : step.muted ? styles.softFill : styles.bar}
                  />
                )}
                <text x={width - VALUE_WIDTH + 12} y={y + ROW_HEIGHT / 2} dominantBaseline="middle" className={styles.valueLabel}>
                  {formatNumber(step.value)}
                </text>
                {step.conversion !== null && (
                  <text x={width} y={y + ROW_HEIGHT / 2} textAnchor="end" dominantBaseline="middle" className={styles.tickLabel}>
                    {step.conversion}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hovered && (
        <div className={styles.tooltip} style={{ top: hovered.y, left: clampTooltipLeft(center, width) }}>
          <b>{hovered.label}</b>
          <span>
            {valueLabel}: {formatNumber(hovered.value)}
          </span>
          {hovered.conversion !== null && <span>Конверсия из предыдущего этапа: {hovered.conversion}%</span>}
          {hovered.muted && <span>Необязательный этап</span>}
        </div>
      )}
    </div>
  );
}
