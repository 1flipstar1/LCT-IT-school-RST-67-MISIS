import { gsap } from 'gsap';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { countByStage } from '../../../domain/analytics.js';
import { plural } from '../../../domain/format.js';
import { PHASES } from '../../../domain/workflow.js';
import { cn } from '../../../lib/cn.js';
import { downloadChartAsPng } from '../../../lib/export/chartImage.js';
import { useElementWidth } from '../../../lib/useElementWidth.js';
import { Card, CardHeader } from '../../../ui/Card.jsx';
import { getSequentialShades } from '../../../ui/charts/shades.js';
import { DropdownMenu } from '../../../ui/DropdownMenu.jsx';
import { DownloadIcon, InteractionsIcon } from '../../../ui/icons.js';
import styles from './StageDistribution.module.css';

const DONUT_SIZE = 220;
const DONUT_RADIUS = 92;
const DONUT_STROKE = 28;
const DONUT_GAP = 3;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const BARS_HEIGHT = 220;
const BAR_GAP = 6;
const AXIS_HEIGHT = 32;
const MIN_BAR = 4;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * «Распределение по этапам»: кольцевая диаграмма показывает доли, столбцы — сколько взаимодействий
 * на каждом из этапов по порядку. Цвет — от светлого к насыщенному оранжевому: чем дальше этап, тем ярче.
 * Наведение на столбец или сектор подсвечивает этап в обеих диаграммах, клик открывает список.
 */
export function StageDistribution({ workflow, rows, onStageSelect }) {
  const chartRef = useRef(null);
  const [barsRef, barsWidth] = useElementWidth();
  const [activeId, setActiveId] = useState(null);

  const counts = useMemo(() => countByStage(rows, workflow), [rows, workflow]);
  const shades = useMemo(() => getSequentialShades(workflow.stages.length), [workflow]);
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const active = counts.find((item) => item.stage.id === activeId);
  const signature = counts.map((item) => item.count).join(',');

  useStageAnimation(chartRef, signature, barsWidth > 0);

  const exportPng = () => downloadChartAsPng(chartRef.current, { title: 'Распределение взаимодействий по этапам', fileName: 'Распределение по этапам.png' });

  return (
    <Card className={styles.card}>
      <CardHeader
        title="Распределение взаимодействий по этапам"
        description={`${total} ${plural(total, ['взаимодействие', 'взаимодействия', 'взаимодействий'])} · ${workflow.name}. Нажмите на этап, чтобы открыть список.`}
        actions={
          <DropdownMenu
            items={[
              { label: 'Скачать PNG', icon: DownloadIcon, onSelect: exportPng },
              { label: 'Открыть списком', icon: InteractionsIcon, onSelect: () => onStageSelect(null) },
            ]}
          />
        }
      />

      <div ref={chartRef} className={styles.body} onMouseLeave={() => setActiveId(null)}>
        <Donut counts={counts} shades={shades} total={total} active={active} onHover={setActiveId} onSelect={onStageSelect} />

        <div ref={barsRef} className={styles.bars}>
          {barsWidth > 0 && (
            <Bars counts={counts} shades={shades} total={total} width={barsWidth} activeId={activeId} onHover={setActiveId} onSelect={onStageSelect} />
          )}
        </div>
      </div>
    </Card>
  );
}

function Donut({ counts, shades, total, active, onHover, onSelect }) {
  const segments = [];
  const withValues = counts.filter((item) => item.count > 0).length;
  let offset = 0;
  counts.forEach((item, index) => {
    if (item.count === 0) return;
    const length = (item.count / total) * CIRCUMFERENCE;
    const gap = withValues > 1 ? DONUT_GAP : 0;
    segments.push({ ...item, color: shades[index], dash: Math.max(length - gap, 1), offset });
    offset += length;
  });

  return (
    <div className={styles.donut}>
      <svg viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} width={DONUT_SIZE} height={DONUT_SIZE} role="img" aria-label="Доли взаимодействий по этапам">
        <circle cx={DONUT_SIZE / 2} cy={DONUT_SIZE / 2} r={DONUT_RADIUS} className={styles.donutTrack} strokeWidth={DONUT_STROKE} />
        <g transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
          {segments.map((segment) => (
            <circle
              key={segment.stage.id}
              data-segment
              data-dash={segment.dash}
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth={DONUT_STROKE}
              strokeDasharray={`${segment.dash} ${CIRCUMFERENCE}`}
              strokeDashoffset={-segment.offset}
              className={cn(styles.segment, active && active.stage.id !== segment.stage.id && styles.dimmed)}
              onMouseEnter={() => onHover(segment.stage.id)}
              onClick={() => onSelect(segment.stage.id)}
            >
              <title>{`${segment.stage.name}: ${segment.count}`}</title>
            </circle>
          ))}
        </g>
        {/* Подпись в центре — внутри SVG, чтобы попадала и в выгрузку PNG. */}
        <text x={DONUT_SIZE / 2} y={DONUT_SIZE / 2 - 6} textAnchor="middle" className={styles.donutValue}>
          {active ? active.count : total}
        </text>
        {splitLabel(active ? active.stage.name : 'всего').map((line, index) => (
          <text key={line} x={DONUT_SIZE / 2} y={DONUT_SIZE / 2 + 22 + index * 18} textAnchor="middle" className={styles.donutLabel}>
            {line}
          </text>
        ))}
      </svg>
      <span className="visually-hidden" aria-live="polite">
        {active ? `${active.stage.name}: ${active.count}` : `Всего: ${total}`}
      </span>
    </div>
  );
}

/** Название этапа в центре кольца — не больше двух строк по ~16 символов. */
function splitLabel(text, maxChars = 16) {
  const lines = [''];
  text.split(' ').forEach((word) => {
    const current = lines.at(-1);
    if (current && `${current} ${word}`.length > maxChars) lines.push(word);
    else lines[lines.length - 1] = current ? `${current} ${word}` : word;
  });
  if (lines.length <= 2) return lines;
  return [lines[0], `${lines.slice(1).join(' ').slice(0, maxChars - 1)}…`];
}

function Bars({ counts, shades, total, width, activeId, onHover, onSelect }) {
  const count = counts.length;
  const barWidth = Math.max(6, (width - BAR_GAP * (count - 1)) / count);
  const max = Math.max(1, ...counts.map((item) => item.count));
  const x = (index) => index * (barWidth + BAR_GAP);
  const barHeight = (value) => (value === 0 ? MIN_BAR : Math.max(MIN_BAR * 2, (value / max) * BARS_HEIGHT));
  const radius = Math.min(6, barWidth / 2);

  const phaseRanges = PHASES.map((phase) => {
    const indexes = counts.map((item, index) => (item.stage.phase === phase.id ? index : -1)).filter((index) => index !== -1);
    return indexes.length ? { phase, from: indexes[0], to: indexes.at(-1) } : null;
  }).filter(Boolean);

  const activeIndex = counts.findIndex((item) => item.stage.id === activeId);
  const active = counts[activeIndex];

  return (
    <>
      <svg width={width} height={BARS_HEIGHT + AXIS_HEIGHT} role="img" aria-label="Количество взаимодействий на каждом этапе по порядку" className={styles.barsSvg}>
        {counts.map((item, index) => {
          const height = barHeight(item.count);
          const top = BARS_HEIGHT - height;
          return (
            <g key={item.stage.id} className={styles.barGroup} onMouseEnter={() => onHover(item.stage.id)} onClick={() => onSelect(item.stage.id)}>
              {/* Невидимая колонка на всю высоту — удобная зона наведения даже для нулевых этапов. */}
              <rect x={x(index)} y={0} width={barWidth} height={BARS_HEIGHT} className={styles.hitArea} />
              <path
                data-bar
                d={`M${x(index)},${BARS_HEIGHT} V${top + radius} Q${x(index)},${top} ${x(index) + radius},${top} H${x(index) + barWidth - radius} Q${x(index) + barWidth},${top} ${x(index) + barWidth},${top + radius} V${BARS_HEIGHT} Z`}
                fill={item.count === 0 ? undefined : shades[index]}
                className={cn(styles.bar, item.count === 0 && styles.emptyBar, activeId && activeId !== item.stage.id && styles.dimmed)}
              />
            </g>
          );
        })}
        {phaseRanges.map(({ phase, from, to }) => {
          const start = x(from);
          const end = x(to) + barWidth;
          return (
            <g key={phase.id}>
              <line x1={start} x2={end} y1={BARS_HEIGHT + 8} y2={BARS_HEIGHT + 8} className={styles.axisLine} />
              <text x={(start + end) / 2} y={BARS_HEIGHT + 26} textAnchor="middle" className={styles.axisLabel}>
                {phase.label}
              </text>
            </g>
          );
        })}
      </svg>

      {active && (
        <div className={styles.tooltip} style={{ left: Math.min(Math.max(0, x(activeIndex) + barWidth / 2 - 110), width - 220) }} role="status">
          <b>{active.stage.name}</b>
          <span>
            Этап {activeIndex + 1} из {count}
            {active.stage.optional ? ' · необязательный' : ''}
          </span>
          <span>
            Взаимодействий: {active.count}
            {total > 0 && ` · ${Math.round((active.count / total) * 100)}%`}
          </span>
        </div>
      )}
    </>
  );
}

/**
 * Анимация появления (как в прежней версии главной): сектора кольца дорисовываются по очереди,
 * столбцы вырастают снизу вверх. При включённом «уменьшении движения» в ОС анимация отключается.
 */
function useStageAnimation(containerRef, signature, ready) {
  useLayoutEffect(() => {
    if (!ready || !containerRef.current || prefersReducedMotion()) return undefined;

    const context = gsap.context(() => {
      const timeline = gsap.timeline();
      gsap.utils.toArray('[data-segment]').forEach((segment) => {
        timeline.fromTo(
          segment,
          { attr: { 'stroke-dasharray': `0 ${CIRCUMFERENCE}` } },
          { attr: { 'stroke-dasharray': `${segment.dataset.dash} ${CIRCUMFERENCE}` }, duration: 0.16, ease: 'power2.out' },
        );
      });
      // Масштаб задаём атрибутом transform с опорой на базовую линию: GSAP-свойство scaleY
      // на SVG-путях считает transform-origin от bbox и сдвигает столбцы.
      const growFromBaseline = (scale) => `translate(0 ${BARS_HEIGHT}) scale(1 ${scale}) translate(0 -${BARS_HEIGHT})`;
      timeline.fromTo(
        '[data-bar]',
        { attr: { transform: growFromBaseline(0) } },
        { attr: { transform: growFromBaseline(1) }, duration: 0.55, stagger: 0.045, ease: 'power3.out' },
        0.1,
      );
    }, containerRef);

    return () => context.revert();
  }, [containerRef, signature, ready]);
}
