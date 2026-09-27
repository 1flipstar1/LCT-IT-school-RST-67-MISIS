import { useLayoutEffect, useRef, useState } from 'react';
import { toLayoutPx } from './zoom.js';

/**
 * Расстояние от верха страницы до элемента — чтобы растянуть его до низа окна: calc(100dvh - offset).
 * Пересчитывается, когда меняется высота блоков над элементом (перенос текста, загрузка шрифта)
 * и размер окна.
 */
export function useOffsetTop() {
  const ref = useRef(null);
  const [offsetTop, setOffsetTop] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    // Результат идёт в CSS (calc с --viewport-height), поэтому переводим в пиксели макета.
    const measure = () => setOffsetTop(Math.round(toLayoutPx(element.getBoundingClientRect().top + window.scrollY, element)));
    measure();

    const observer = new ResizeObserver(measure);
    for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      observer.observe(sibling);
    }
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return [ref, offsetTop];
}
