import { useSyncExternalStore } from 'react';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { shouldReduceMotion } from './motion.js';

gsap.registerPlugin(Flip);

/**
 * Режим раскладки каркаса: телефон, планшет или компьютер.
 *
 * Считается по «эффективной» ширине — ширине окна, делённой на масштаб интерфейса (--ui-scale):
 * при 130% на ноутбуке 1280px вёрстке достаётся всего ~985px, и медиазапрос по ширине окна
 * оставил бы меню закреплённым. Режим пишется в html[data-layout], CSS каркаса опирается на него.
 *
 * Смена режима (поворот планшета, изменение окна, смена масштаба) анимируется GSAP Flip:
 * меню и контент плавно переезжают на новые места, а не перепрыгивают.
 */
export const LAYOUT = Object.freeze({ mobile: 'mobile', tablet: 'tablet', desktop: 'desktop' });

/** Пороги в пикселях макета. Меню закрепляется, когда рядом с ним остаётся место для контента. */
const BREAKPOINTS = { tablet: 600, desktop: 960 };
const FLIP_SELECTOR = '[data-layout-flip]';

const listeners = new Set();
let current = null;

function uiScale() {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function measure() {
  const width = window.innerWidth / uiScale();
  if (width < BREAKPOINTS.tablet) return LAYOUT.mobile;
  if (width < BREAKPOINTS.desktop) return LAYOUT.tablet;
  return LAYOUT.desktop;
}

/** Пересчитать режим. animate — плавно перестроить каркас (при первом показе не нужно). */
export function syncLayoutMode({ animate = true } = {}) {
  const next = measure();
  if (next === current) return;
  const targets = animate && current && !shouldReduceMotion() ? [...document.querySelectorAll(FLIP_SELECTOR)] : [];
  // Снимок берём с учётом ещё идущей анимации и только потом её останавливаем:
  // так при быстром изменении окна новый переход начнётся ровно с того места, где элементы сейчас.
  const state = targets.length ? Flip.getState(targets) : null;
  if (state) Flip.killFlipsOf(targets);

  current = next;
  document.documentElement.dataset.layout = next;
  listeners.forEach((listener) => listener());

  if (state) {
    Flip.from(state, {
      duration: 0.5,
      ease: 'power3.inOut',
      absolute: false,
      nested: true,
      prune: true,
      clearProps: 'transform,width,height',
    });
  }
}

let frame = 0;
function onResize() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => syncLayoutMode());
}

// Режим выставляется при загрузке модуля — до первой отрисовки, чтобы каркас не мигнул.
syncLayoutMode({ animate: false });
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLayoutMode() {
  return useSyncExternalStore(subscribe, () => current);
}

export const isDrawerLayout = (mode) => mode !== LAYOUT.desktop;
