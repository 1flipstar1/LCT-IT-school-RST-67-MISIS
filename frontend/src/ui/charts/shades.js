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
