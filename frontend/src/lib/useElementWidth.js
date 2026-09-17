import { useEffect, useRef, useState } from 'react';

/** Ширина элемента с обновлением при ресайзе — графики рисуются в SVG под точный размер контейнера. */
export function useElementWidth(initialWidth = 0) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
