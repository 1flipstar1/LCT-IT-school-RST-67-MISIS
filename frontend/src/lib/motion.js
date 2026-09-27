/** Shared by CSS preferences and imperative animation callers. */
export function shouldReduceMotion() {
  return document.documentElement.dataset.reduceMotion === 'true'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
