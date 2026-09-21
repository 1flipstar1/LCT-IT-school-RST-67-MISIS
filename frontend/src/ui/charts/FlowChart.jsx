import { useState } from 'react';
import { formatNumber } from '../../domain/format.js';
import { useElementWidth } from '../../lib/useElementWidth.js';
import { ChartEmpty } from './ChartEmpty.jsx';
import styles from './charts.module.css';
import { Legend } from './Legend.jsx';
import { clampTooltipLeft } from './scale.js';

const NODE_WIDTH = 10;
const NODE_HEIGHT = 44;
const ARC_SPACE = 96;
const LABEL_SPACE = 24;
const MIN_STROKE = 2;
const MAX_STROKE = 14;

/**
 * Потоки между шагами процесса (вариант Sankey для линейного процесса).
 * Шаги стоят в ряд по порядку; толщина связи — число переходов.
 * Обычный путь вперёд — полосы между соседями, переходы через шаг — дуги сверху,
 * возвраты на доработку — оранжевые дуги снизу. Нестандартные маршруты сразу видны.
 * nodes: [{ id, label, short }], flows: [{ id, from, to, kind: 'next' | 'skip' | 'back', count }] (from/to — индексы узлов)
 * colors: { next, skip, back }
 */
export function FlowChart({ nodes, flows, colors, labels, ariaLabel }) {
  const [containerRef, width] = useElementWidth();
  const [hovered, setHovered] = useState(null);
  if (flows.length === 0) return <ChartEmpty>Переходов между этапами пока нет</ChartEmpty>;

  const maxCount = Math.max(1, ...flows.map((flow) => flow.count));
  const stroke = (count) => MIN_STROKE + (count / maxCount) * (MAX_STROKE - MIN_STROKE);
  const step = nodes.length > 1 ? (width - NODE_WIDTH) / (nodes.length - 1) : 0;
  const nodeX = (index) => index * step + NODE_WIDTH / 2;
  const top = ARC_SPACE;
  const middle = top + NODE_HEIGHT / 2;
  const bottom = top + NODE_HEIGHT;
  const height = bottom + ARC_SPACE + LABEL_SPACE;

  const pathOf = (flow) => {
    const x1 = nodeX(flow.from);
    const x2 = nodeX(flow.to);
    if (flow.kind === 'next') return `M${x1 + NODE_WIDTH / 2},${middle} L${x2 - NODE_WIDTH / 2},${middle}`;
    const span = Math.abs(flow.to - flow.from);
    const lift = Math.min(ARC_SPACE - 8, 24 + span * 14);
    if (flow.kind === 'skip') return `M${x1},${top} C${x1},${top - lift} ${x2},${top - lift} ${x2},${top}`;
    return `M${x1},${bottom} C${x1},${bottom + lift} ${x2},${bottom + lift} ${x2},${bottom}`;
  };

  const legend = [
    { id: 'next', label: labels.next, color: colors.next, shape: 'line' },
    { id: 'skip', label: labels.skip, color: colors.skip, shape: 'line' },
    { id: 'back', label: labels.back, color: colors.back, shape: 'line' },
  ];

  return (
    <div ref={containerRef} className={styles.container}>
      <Legend items={legend} />
      <div className={styles.plot}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className={styles.svg} onMouseLeave={() => setHovered(null)}>
            {flows.map((flow) => (
              <path
                key={flow.id}
                d={pathOf(flow)}
                fill="none"
                strokeWidth={stroke(flow.count)}
                strokeLinecap="round"
                style={{ stroke: colors[flow.kind] }}
                className={`${styles.mark} ${hovered && hovered.id !== flow.id ? styles.dimmed : ''}`}
                onMouseEnter={() => setHovered(flow)}
              />
            ))}
            {nodes.map((node, index) => (
              <g key={node.id}>
                <rect x={nodeX(index) - NODE_WIDTH / 2} y={top} width={NODE_WIDTH} height={NODE_HEIGHT} rx={3} className={styles.whisker} style={{ fill: 'var(--color-text-secondary)' }}>
                  <title>{node.label}</title>
                </rect>
                <text x={nodeX(index)} y={height - 6} textAnchor="middle" className={styles.tickLabel}>
                  <title>{node.label}</title>
                  {node.short}
                </text>
              </g>
            ))}
          </svg>
        )}
        {hovered && (
          <div
            className={styles.tooltip}
            style={{ top: hovered.kind === 'back' ? bottom + 24 : top - 8, left: clampTooltipLeft((nodeX(hovered.from) + nodeX(hovered.to)) / 2, width, 240) }}
          >
            <b>{labels[hovered.kind]}</b>
            <span>
              {nodes[hovered.from].label} → {nodes[hovered.to].label}
            </span>
            <span>Переходов: {formatNumber(hovered.count)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
