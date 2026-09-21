/**
 * Раскладка настраиваемой панели аналитики — чистые функции без React.
 * Раскладка — упорядоченный список { id, size }: какие виджеты стоят на панели, в каком порядке и какого размера.
 * Единая четырёхмодульная сетка: s — 1 модуль, m — 2 модуля, l — 3 модуля.
 * У большого виджета всегда остаётся место для маленькой плитки в той же строке.
 */

export const WIDGET_SIZE = Object.freeze({ s: 's', m: 'm', l: 'l' });

export const WIDGET_SIZE_LABELS = {
  [WIDGET_SIZE.s]: 'Маленький',
  [WIDGET_SIZE.m]: 'Средний',
  [WIDGET_SIZE.l]: 'Большой',
};

/**
 * Приводит сохранённую раскладку к актуальному каталогу: убирает неизвестные и недоступные роли виджеты,
 * дубли и некорректные размеры. Так старый кэш или раскладка другой роли не ломают страницу.
 */
export function normalizeLayout(stored, catalog) {
  if (!Array.isArray(stored)) return [];
  const seen = new Set();
  return stored.flatMap((entry) => {
    const widget = catalog.get(entry?.id);
    if (!widget || seen.has(entry.id)) return [];
    seen.add(entry.id);
    return [{ id: entry.id, size: widget.sizes.includes(entry.size) ? entry.size : widget.defaultSize }];
  });
}

export function addWidget(layout, widget) {
  if (layout.some((entry) => entry.id === widget.id)) return layout;
  return [...layout, { id: widget.id, size: widget.defaultSize }];
}

export function removeWidget(layout, id) {
  return layout.filter((entry) => entry.id !== id);
}

/** Переносит виджет на позицию toIndex (индекс в итоговом списке). */
export function moveWidget(layout, id, toIndex) {
  const fromIndex = layout.findIndex((entry) => entry.id === id);
  if (fromIndex === -1) return layout;
  const target = Math.min(Math.max(0, toIndex), layout.length - 1);
  if (target === fromIndex) return layout;
  const next = [...layout];
  const [entry] = next.splice(fromIndex, 1);
  next.splice(target, 0, entry);
  return next;
}

/** Следующий доступный размер по кругу: s → m → l → s. */
export function nextSize(widget, size) {
  const index = widget.sizes.indexOf(size);
  return widget.sizes[(index + 1) % widget.sizes.length];
}

export function resizeWidget(layout, id, size) {
  return layout.map((entry) => (entry.id === id ? { ...entry, size } : entry));
}
