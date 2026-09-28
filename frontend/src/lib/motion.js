/** Общая настройка анимаций: её учитывают и CSS, и код, который запускает анимации (GSAP). */
export function shouldReduceMotion() {
  return document.documentElement.dataset.reduceMotion === 'true'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
