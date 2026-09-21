import { useState } from 'react';
import { formatDate, toIsoDate } from '../../domain/format.js';
import { useElementWidth } from '../../lib/useElementWidth.js';
import styles from './charts.module.css';
import { Legend } from './Legend.jsx';

const CELL = 18;
const CELL_GAP = 3;
const MONTH_TITLE = 22;
const WEEKDAY_ROW = 16;
const MONTH_GAP = 20;
const WEEKDAYS = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
const monthTitle = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });

/** Дни месяца с позицией в сетке «неделя × день недели» (неделя начинается с понедельника). */
function monthDays(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const slot = offset + index;
    return { date, iso: toIsoDate(date), column: slot % 7, row: Math.floor(slot / 7) };
  });
}

/**
 * Календарь сроков: несколько месяцев мини-сетками, дни с событиями закрашены цветом вида события.
 * Сегодня обведено. Подробности дня — во всплывающей подсказке.
 * events: [{ id, date, kind, label, detail }], kinds: { [kind]: { label, color } }
 */
export function CalendarChart({ start, monthCount = 6, events, kinds, ariaLabel, now = new Date() }) {
  const [containerRef, width] = useElementWidth();
  const [hovered, setHovered] = useState(null);

  const byDay = new Map();
  events.forEach((event) => {
    const key = toIsoDate(event.date);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  });

  const monthWidth = 7 * CELL + 6 * CELL_GAP;
  const monthHeight = MONTH_TITLE + WEEKDAY_ROW + 6 * (CELL + CELL_GAP);
  const perRow = Math.max(1, Math.floor((width + MONTH_GAP) / (monthWidth + MONTH_GAP)));
  const months = Array.from({ length: monthCount }, (_, index) => new Date(start.getFullYear(), start.getMonth() + index, 1));
  const height = Math.ceil(months.length / perRow) * (monthHeight + MONTH_GAP) - MONTH_GAP;
  const todayIso = toIsoDate(now);
  const kindOrder = Object.keys(kinds);

  return (
    <div ref={containerRef} className={styles.container}>
      <Legend items={kindOrder.map((kind) => ({ id: kind, label: kinds[kind].label, color: kinds[kind].color }))} />
      <div className={styles.plot}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className={styles.svg} onMouseLeave={() => setHovered(null)}>
            {months.map((month, monthIndex) => {
              const originX = (monthIndex % perRow) * (monthWidth + MONTH_GAP);
              const originY = Math.floor(monthIndex / perRow) * (monthHeight + MONTH_GAP);
              return (
                <g key={month.getTime()} transform={`translate(${originX} ${originY})`}>
                  <text x={0} y={14} className={styles.valueLabel}>
                    {monthTitle.format(month).replace(' г.', '')}
                  </text>
                  {WEEKDAYS.map((day, index) => (
                    <text key={index} x={index * (CELL + CELL_GAP) + CELL / 2} y={MONTH_TITLE + 10} textAnchor="middle" className={styles.tickLabel}>
                      {day}
                    </text>
                  ))}
                  {monthDays(month.getFullYear(), month.getMonth()).map((day) => {
                    const dayEvents = byDay.get(day.iso) ?? [];
                    // Если в день несколько видов событий, цвет — по первому виду в легенде (он важнее).
                    const kind = kindOrder.find((item) => dayEvents.some((event) => event.kind === item));
                    const x = day.column * (CELL + CELL_GAP);
                    const y = MONTH_TITLE + WEEKDAY_ROW + day.row * (CELL + CELL_GAP);
                    return (
                      <g key={day.iso} onMouseEnter={() => setHovered(dayEvents.length ? { day, events: dayEvents, x: originX + x, y: originY + y } : null)}>
                        <rect x={x} y={y} width={CELL} height={CELL} rx={4} style={kind ? { fill: kinds[kind].color } : undefined} className={kind ? undefined : styles.emptyCell}>
                          <title>{formatDate(day.date)}</title>
                        </rect>
                        {day.iso === todayIso && <rect x={x - 1} y={y - 1} width={CELL + 2} height={CELL + 2} rx={5} className={styles.todayRing} />}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        )}
        {hovered && (
          <div className={styles.tooltip} style={{ top: hovered.y, left: Math.min(hovered.x, Math.max(0, width - 240)) }}>
            <b>{formatDate(hovered.day.date)}</b>
            {hovered.events.slice(0, 5).map((event) => (
              <span key={event.id}>
                {kinds[event.kind].label}: {event.label}
              </span>
            ))}
            {hovered.events.length > 5 && <span>И ещё {hovered.events.length - 5}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
