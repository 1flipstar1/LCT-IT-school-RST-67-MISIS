import { useState } from 'react';
import { useElementWidth } from '../../lib/useElementWidth.js';
import styles from './charts.module.css';

const ROW_HEIGHT = 32;
const BAR_HEIGHT = 14;
const GROUP_HEADER_HEIGHT = 32;
const VALUE_WIDTH = 44;
const CHAR_WIDTH = 7.4;
/** Ограничение длины столбца: на широком экране короткие значения не растягиваются на весь монитор. */
const MAX_PLOT_WIDTH = 560;

const truncate = (text, maxWidth) => {
  const maxChars = Math.floor(maxWidth / CHAR_WIDTH);
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
};

/**
 * Горизонтальные столбцы, сгруппированные по смыслу (например, этапы по фазам).
 * Одна величина — один цвет; подписи и значения всегда видны, подробности — в подсказке.
 * groups: [{ id, label?, items: [{ id, label, value }] }] — без label группа выводится без заголовка.
 */
export function BarChart({ groups, ariaLabel, formatTooltip, onBarClick }) {
  const [containerRef, width] = useElementWidth();
  const [hovered, setHovered] = useState(null);

  const labelWidth = Math.min(300, Math.max(140, width * 0.4));
  const plotWidth = Math.min(MAX_PLOT_WIDTH, Math.max(0, width - labelWidth - VALUE_WIDTH));
  const max = Math.max(1, ...groups.flatMap((group) => group.items.map((item) => item.value)));

  let y = 0;
  const layout = groups.map((group) => {
    const headerY = y;
    if (group.label) y += GROUP_HEADER_HEIGHT;
    const items = group.items.map((item) => {
      const rowY = y;
      y += ROW_HEIGHT;
      return { ...item, y: rowY, barWidth: item.value === 0 ? 0 : Math.max(4, (item.value / max) * plotWidth) };
    });
    return { ...group, headerY, items };
  });
  const height = y;

  return (
    <div ref={containerRef} className={styles.container}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className={styles.svg}>
          {layout.map((group) => (
            <g key={group.id}>
              {group.label && (
                <text x={0} y={group.headerY + 20} className={styles.groupLabel}>
                  {group.label}
                </text>
              )}
              {group.items.map((item) => (
                <g
                  key={item.id}
                  className={onBarClick ? styles.interactiveRow : undefined}
                  onMouseEnter={() => setHovered(item)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={onBarClick ? () => onBarClick(item) : undefined}
                >
                  {/* Невидимая подложка на всю строку — крупная зона наведения и клика. */}
                  <rect x={0} y={item.y} width={width} height={ROW_HEIGHT} className={styles.hitArea} />
                  <text x={0} y={item.y + ROW_HEIGHT / 2} className={styles.axisLabel} dominantBaseline="middle">
                    <title>{item.label}</title>
                    {truncate(item.label, labelWidth - 16)}
                  </text>
                  {item.barWidth > 0 && (
                    <rect
                      x={labelWidth}
                      y={item.y + (ROW_HEIGHT - BAR_HEIGHT) / 2}
                      width={item.barWidth}
                      height={BAR_HEIGHT}
                      rx={4}
                      className={hovered?.id === item.id ? styles.barActive : styles.bar}
                    />
                  )}
                  <text x={labelWidth + item.barWidth + 8} y={item.y + ROW_HEIGHT / 2} className={styles.valueLabel} dominantBaseline="middle">
                    {item.value}
                  </text>
                </g>
              ))}
            </g>
          ))}
        </svg>
      )}
      {hovered && formatTooltip && (
        <div className={styles.tooltip} style={{ top: hovered.y - 8, left: labelWidth + Math.min(hovered.barWidth, plotWidth - 120) }}>
          {formatTooltip(hovered)}
        </div>
      )}
    </div>
  );
}
