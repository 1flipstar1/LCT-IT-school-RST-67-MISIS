/**
 * Раскладка фирменной иллюстрации ошибки: цифры номера, а вместо каждого нуля — круглая картинка.
 * Чистая функция без React: по ней рисуют и страницу в приложении, и статические страницы сервера
 * (scripts/build-error-pages.mjs), поэтому выглядят они одинаково.
 */
export const ART_HEIGHT = 144;
const DISC_SIZE = 124;
// Цифры Rostelecom Basis Bold занимают 72 % кегля: подбираем кегль так, чтобы цифра была ростом с круг.
const DIGIT_HEIGHT_RATIO = 0.72;
export const ART_FONT_SIZE = Math.round((DISC_SIZE * 0.96) / DIGIT_HEIGHT_RATIO);
const BASELINE = ART_HEIGHT / 2 + (ART_FONT_SIZE * DIGIT_HEIGHT_RATIO) / 2;
const DIGIT_WIDTH = 104;
const GAP = 8;

/**
 * number — строка «404» или null (нет номера — одна картинка). artCount — сколько картинок есть:
 * картинка выбирается по номеру, чтобы у каждой ошибки была своя.
 */
export function layoutErrorArt(number, artCount) {
  const glyphs = number ? [...number] : ['0'];
  const seed = Number(number ?? 0);
  let x = 0;
  let discIndex = 0;
  const items = glyphs.map((glyph) => {
    let item;
    if (glyph === '0') {
      item = { kind: 'disc', x, y: (ART_HEIGHT - DISC_SIZE) / 2, size: DISC_SIZE, artIndex: (seed + discIndex++) % artCount };
      x += DISC_SIZE + GAP;
    } else {
      item = { kind: 'digit', glyph, x: x + DIGIT_WIDTH / 2, y: BASELINE };
      x += DIGIT_WIDTH + GAP;
    }
    return item;
  });
  return { width: x - GAP, height: ART_HEIGHT, items };
}
