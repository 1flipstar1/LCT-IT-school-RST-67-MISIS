import { AVATAR_IMAGES } from '../../ui/avatarImages.js';
import { ART_FONT_SIZE, layoutErrorArt } from './errorArtLayout.js';
import styles from './ErrorArt.module.css';

/**
 * Фирменная иллюстрация ошибки: номер крупными цифрами, а каждый ноль — круглая иллюстрация
 * Ростелекома (те же, что у аватарок): «4◐4», «5◐3». Без номера (нет связи) — одна иллюстрация.
 */
export function ErrorArt({ number, className }) {
  const { width, height, items } = layoutErrorArt(number, AVATAR_IMAGES.length);

  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={number ? `Ошибка ${number}` : 'Нет связи'}>
      {items.map((item, index) =>
        item.kind === 'disc' ? (
          <image
            key={index}
            className={styles.disc}
            style={{ animationDelay: `${index * -1.2}s` }}
            href={AVATAR_IMAGES[item.artIndex]}
            x={item.x}
            y={item.y}
            width={item.size}
            height={item.size}
          />
        ) : (
          <text key={index} className={styles.digit} x={item.x} y={item.y} fontSize={ART_FONT_SIZE} textAnchor="middle">
            {item.glyph}
          </text>
        ),
      )}
    </svg>
  );
}
