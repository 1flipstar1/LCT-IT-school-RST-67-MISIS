/**
 * Последовательная шкала оттенков одного цвета: от светлого к насыщенному.
 * Используется, когда цвет кодирует порядок (например, этапы: чем дальше этап, тем ярче).
 */
export function getSequentialShades(count, from = [255, 207, 179], to = [255, 79, 18]) {
  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 1 : index / (count - 1);
    return `#${from.map((start, channel) => Math.round(start + (to[channel] - start) * ratio).toString(16).padStart(2, '0')).join('')}`;
  });
}

const BRAND_LIGHT = [182, 120, 255];
const BRAND_DARK = [74, 0, 145];

/**
 * Последовательная шкала фирменного фиолетового — для порядка (фазы процесса) и интенсивности (тепловая карта).
 * Самый светлый оттенок держит контраст ≥ 3:1 с белым фоном, поэтому видна даже узкая полоска.
 */
export const getBrandShades = (count) => getSequentialShades(count, BRAND_LIGHT, BRAND_DARK);

/** Цвет интенсивности 0…1 на фиолетовой шкале: от почти белого к насыщенному фирменному. */
export function getBrandIntensity(ratio) {
  const from = [243, 234, 255];
  const clamped = Math.min(1, Math.max(0, ratio));
  return `#${from.map((start, channel) => Math.round(start + (BRAND_DARK[channel] - start) * clamped).toString(16).padStart(2, '0')).join('')}`;
}

/** Статусные цвета из токенов — только для состояний (в срок, истекает, просрочено), не для рядов данных. */
export const STATUS_COLORS = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  neutral: 'var(--color-border-strong)',
};
