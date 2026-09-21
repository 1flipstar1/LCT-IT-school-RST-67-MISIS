/** «Красивые» деления оси: 0, 50, 100, 150 вместо 0, 47, 94, 141. */
export function niceTicks(max, count = 4) {
  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep || 1));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rawStep);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

/** Примерная ширина строки в SVG (кегль 12–14 px) — для подписей, которые нельзя измерить до отрисовки. */
export const CHAR_WIDTH = 7.4;

export function truncate(text, maxWidth) {
  const maxChars = Math.max(2, Math.floor(maxWidth / CHAR_WIDTH));
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

/** Держит всплывающую подсказку внутри контейнера графика. */
export const clampTooltipLeft = (x, width, tooltipWidth = 180) => Math.min(Math.max(0, x - tooltipWidth / 2), Math.max(0, width - tooltipWidth));
