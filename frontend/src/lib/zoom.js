/**
 * Масштаб интерфейса сделан через CSS zoom (см. --ui-scale в styles/tokens.css). Внутри увеличенного
 * элемента getBoundingClientRect и clientX отдают экранные пиксели, а CSS-свойства и transform
 * задаются в пикселях макета — перед записью в стиль экранные размеры нужно разделить на zoom.
 */
export const zoomOf = (element) => element?.currentCSSZoom || 1;

/** Экранные пиксели → пиксели макета элемента. */
export const toLayoutPx = (value, element) => value / zoomOf(element);
