import { useState } from 'react';
import { formatDate, formatDays, formatMonth, toDate, toIsoDate } from '../../domain/format.js';
import { useElementWidth } from '../../lib/useElementWidth.js';
import { ChartEmpty } from './ChartEmpty.jsx';
import styles from './charts.module.css';
import { Legend } from './Legend.jsx';
import { clampTooltipLeft, truncate } from './scale.js';

const AXIS_HEIGHT = 24;
const LANE_HEIGHT = 32;
const BAR_HEIGHT = 16;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Первые числа месяцев между двумя датами — деления оси времени. */
function monthStarts(from, to) {
  const ticks = [];
  const cursor = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  while (cursor <= to) {
    ticks.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}

/**
 * Диаграмма Ганта: история прохождения этапов. Каждая дорожка — взаимодействие,
 * каждый отрезок — пребывание на этапе; незакрытый отрезок (текущий этап) доходит до сегодня.
 * lanes: [{ id, label, segments: [{ id, from, to, label, color }] }], legend: [{ id, label, color }]
 */
export function TimelineChart({ lanes, legend, ariaLabel, now = new Date() }) {
  const [containerRef, width] = useElementWidth();
  const [hovered, setHovered] = useState(null);

  const segments = lanes.flatMap((lane) => lane.segments);
  if (segments.length === 0) return <ChartEmpty />;

  const start = new Date(Math.min(...segments.map((segment) => toDate(segment.from).getTime())));
  const end = now;
  const labelWidth = Math.min(200, Math.max(110, width * 0.26));
  const plotWidth = Math.max(0, width - labelWidth - 8);
  const x = (date) => labelWidth + ((toDate(date) - start) / Math.max(DAY_MS, end - start)) * plotWidth;
  const height = AXIS_HEIGHT + lanes.length * LANE_HEIGHT;

  const ticks = monthStarts(start, end);
  const labelEvery = Math.max(1, Math.ceil((ticks.length * 44) / Math.max(1, plotWidth)));

  return (
    <div ref={containerRef} className={styles.container}>
      {legend && <Legend items={legend} />}
      <div className={styles.plot}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className={styles.svg} onMouseLeave={() => setHovered(null)}>
            {ticks.map((tick, index) => (
              <g key={tick.getTime()}>
                <line x1={x(tick)} x2={x(tick)} y1={AXIS_HEIGHT - 4} y2={height} className={styles.gridLine} />
                {index % labelEvery === 0 && (
                  <text x={x(tick) + 4} y={12} className={styles.tickLabel}>
                    {formatMonth(toIsoDate(tick).slice(0, 7))}
                    {tick.getMonth() === 0 ? ` ${tick.getFullYear()}` : ''}
                  </text>
                )}
              </g>
            ))}
            {lanes.map((lane, laneIndex) => {
              const y = AXIS_HEIGHT + laneIndex * LANE_HEIGHT;
              return (
                <g key={lane.id}>
                  <text x={0} y={y + LANE_HEIGHT / 2} dominantBaseline="middle" className={styles.axisLabel}>
                    <title>{lane.label}</title>
                    {truncate(lane.label, labelWidth - 12)}
                  </text>
                  {lane.segments.map((segment) => {
                    const left = x(segment.from);
                    const barWidth = Math.max(3, x(segment.to ?? end) - left - 1);
                    return (
                      <rect
                        key={segment.id}
                        x={left}
                        y={y + (LANE_HEIGHT - BAR_HEIGHT) / 2}
                        width={barWidth}
                        height={BAR_HEIGHT}
                        rx={3}
                        style={{ fill: segment.color }}
                        className={`${styles.mark} ${hovered && hovered.segment.id !== segment.id ? styles.dimmed : ''}`}
                        onMouseEnter={() => setHovered({ segment, lane, y, x: left + barWidth / 2 })}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}
        {hovered && (
          <div className={styles.tooltip} style={{ top: hovered.y, left: clampTooltipLeft(hovered.x, width, 220) }}>
            <b>{hovered.segment.label}</b>
            <span>{hovered.lane.label}</span>
            <span>
              {formatDate(hovered.segment.from)} — {hovered.segment.to ? formatDate(hovered.segment.to) : 'сейчас'}
            </span>
            <span>{formatDays(Math.max(0, Math.round((toDate(hovered.segment.to ?? end) - toDate(hovered.segment.from)) / DAY_MS)))}</span>
          </div>
        )}
      </div>
    </div>
  );
}
