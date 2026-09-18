/**
 * Круглые аватарки из frontend/avatars. Раздаются людям по порядку: первому пользователю
 * в справочнике — первая картинка, второму — вторая и так далее; когда картинки заканчиваются,
 * счёт идёт с начала. Порядок берётся из имён файлов, чтобы у человека всегда был один и тот же аватар.
 */
const modules = import.meta.glob('../../avatars/*.svg', { eager: true, query: '?url', import: 'default' });

export const AVATAR_IMAGES = Object.keys(modules)
  .sort()
  .map((path) => modules[path]);

/** Картинка для позиции в списке людей; отрицательный или слишком большой индекс не ломает выдачу. */
export function avatarImageAt(index) {
  if (AVATAR_IMAGES.length === 0) return null;
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return AVATAR_IMAGES[safeIndex % AVATAR_IMAGES.length];
}
