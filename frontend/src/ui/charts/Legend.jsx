import styles from './charts.module.css';
import { CHAR_WIDTH } from './scale.js';

const SWATCH = 10;
const HEIGHT = 20;

/**
 * Легенда рядов. Каждый элемент — маленький SVG, а не HTML: так легенда попадает в PNG и PDF
 * вместе с графиком (экспорт собирает все SVG карточки на их местах).
 * items: [{ id, label, color, shape: 'square' | 'line' | 'dot' }]
 */
export function Legend({ items }) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => {
        const width = SWATCH + 8 + item.label.length * CHAR_WIDTH;
        return (
          <li key={item.id}>
            <svg width={width} height={HEIGHT} role="img" aria-label={item.label} className={styles.svg}>
              {item.shape === 'line' ? (
                <line x1={0} x2={SWATCH + 2} y1={HEIGHT / 2} y2={HEIGHT / 2} style={{ stroke: item.color }} strokeWidth={3} strokeLinecap="round" />
              ) : (
                <rect x={0} y={(HEIGHT - SWATCH) / 2} width={SWATCH} height={SWATCH} rx={item.shape === 'dot' ? SWATCH / 2 : 3} style={{ fill: item.color }} />
              )}
              <text x={SWATCH + 6} y={HEIGHT / 2} dominantBaseline="middle" className={styles.legendLabel}>
                {item.label}
              </text>
            </svg>
          </li>
        );
      })}
    </ul>
  );
}
