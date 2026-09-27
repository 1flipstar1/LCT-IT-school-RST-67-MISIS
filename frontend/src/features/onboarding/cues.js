import { gsap } from 'gsap';
import { zoomOf } from '../../lib/zoom.js';
import { celebrate } from './celebrate.js';

/**
 * Анимации-подсказки тура, описанные данными: { type: 'pulse' | 'sweep' | 'typing' | 'pointer' | 'burst' | 'fireworks', ...параметры }.
 * Шаг тура хранит только JSON-описание, а здесь по нему собирается таймлайн GSAP.
 * layer — слой для временных элементов, target — подсвеченный элемент, rect — его «окно» (или null), card — карточка шага.
 * Возвращает { kill }: тур вызывает его при переходе к следующему шагу, чтобы снять анимацию и вернуть элементы как были.
 */

const COLOR = { brand: 'var(--color-brand)', accent: 'var(--color-accent)' };
/** Острие стрелки курсора внутри svg 28×28 (viewBox 24): курсор ставим острием, а не углом картинки. */
const POINTER_TIP = { x: 6, y: 3.5 };

function spawn(parent, className, style = {}) {
  const node = document.createElement('div');
  node.className = className;
  Object.assign(node.style, style);
  parent.appendChild(node);
  return node;
}

const BUILDERS = {
  /** Кольцо вокруг элемента мягко «дышит». */
  pulse({ repeat = 1 }, { ring, timeline, onCleanup }) {
    timeline.fromTo(ring, { scale: 1 }, { scale: 1.04, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: repeat * 2 - 1 });
    onCleanup(() => gsap.set(ring, { scale: 1 }));
  },

  /** По элементу проходит световая полоса — «вот эта область». Полоса не выходит за границы окна. */
  sweep({ axis = 'x' }, { layer, rect, classes, timeline }) {
    if (!rect) return;
    const horizontal = axis === 'x';
    const size = Math.min(160, (horizontal ? rect.w : rect.h) * 0.6);
    const clip = spawn(layer, classes.sweep, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    const bar = spawn(clip, classes.sweepBar, {
      width: horizontal ? `${size}px` : '100%',
      height: horizontal ? '100%' : `${size}px`,
      background: `linear-gradient(${horizontal ? '90deg' : '180deg'}, transparent, color-mix(in srgb, var(--color-brand) 22%, transparent), transparent)`,
    });
    const from = horizontal ? { x: -size } : { y: -size };
    const to = horizontal ? { x: rect.w } : { y: rect.h };
    timeline.fromTo(bar, from, { ...to, duration: 1.2, ease: 'power2.inOut', repeat: 1, repeatDelay: 0.4 });
  },

  /**
   * В поле «печатается» пример запроса. Текст рисуется поверх поля его же шрифтом и с его отступом,
   * а плейсхолдер и введённое значение на это время прячутся — иначе строки наложатся друг на друга.
   */
  typing({ text = '' }, { layer, target, classes, timeline, onCleanup }) {
    const input = target?.matches('input, textarea') ? target : target?.querySelector('input, textarea');
    if (!input) return;
    const box = input.getBoundingClientRect();
    const style = getComputedStyle(input);
    // Слой подсказок не увеличен, а поле — внутри увеличенного интерфейса: переводим его размеры в экранные.
    const zoom = zoomOf(input);
    const px = (value) => parseFloat(value) * zoom;
    const left = box.left + px(style.paddingLeft) + px(style.borderLeftWidth);
    const line = spawn(layer, classes.typing, {
      left: `${left}px`,
      top: `${box.top + box.height / 2}px`,
      maxWidth: `${box.right - px(style.paddingRight) - left}px`,
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: `${px(style.fontSize)}px`,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
    });

    const saved = { placeholder: input.placeholder, color: input.style.color };
    const restore = () => {
      input.placeholder = saved.placeholder;
      input.style.color = saved.color;
    };
    input.placeholder = '';
    input.style.color = 'transparent';
    onCleanup(restore);
    const state = { count: 0 };
    timeline.to(state, {
      count: text.length,
      duration: text.length * 0.06,
      ease: 'none',
      delay: 0.3,
      onUpdate: () => { line.textContent = text.slice(0, Math.round(state.count)); },
    });
    timeline.to(line, { opacity: 0, duration: 0.3, delay: 1.4 });
    timeline.call(restore);
  },

  /** «Курсор» подъезжает к элементу и нажимает на него. */
  pointer({ click = true }, { layer, rect, classes, timeline }) {
    if (!rect) return;
    const pointer = spawn(layer, classes.pointer);
    pointer.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M5 3l14 8-6 2-3 6z" fill="white" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const x = rect.x + rect.w / 2;
    const y = rect.y + rect.h / 2;
    gsap.set(pointer, { transformOrigin: `${POINTER_TIP.x}px ${POINTER_TIP.y}px` });
    timeline.fromTo(
      pointer,
      { x: x - POINTER_TIP.x + 90, y: y - POINTER_TIP.y + 70, opacity: 0 },
      { x: x - POINTER_TIP.x, y: y - POINTER_TIP.y, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.2 },
    );
    if (click) {
      const ripple = spawn(layer, classes.ripple, { left: `${x}px`, top: `${y}px` });
      timeline.to(pointer, { scale: 0.82, duration: 0.12, yoyo: true, repeat: 1 });
      timeline.fromTo(ripple, { scale: 0, opacity: 0.6 }, { scale: 3, opacity: 0, duration: 0.6, ease: 'power2.out' }, '<');
    }
    timeline.to(pointer, { opacity: 0, duration: 0.4, delay: 0.8 });
  },

  /** Праздничный «салют» из точек фирменных цветов вокруг карточки. */
  burst({ colors = ['brand', 'accent'], count = 20 }, { layer, card, classes, timeline }) {
    const box = card.getBoundingClientRect();
    const originX = box.left + box.width / 2;
    const originY = box.top;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4;
      const distance = 90 + Math.random() * 110;
      const dot = spawn(layer, classes.dot, { left: `${originX}px`, top: `${originY}px`, background: COLOR[colors[index % colors.length]] });
      timeline.fromTo(
        dot,
        { x: 0, y: 0, scale: 0.4, opacity: 1 },
        { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance - 40, scale: 1, opacity: 0, duration: 1.1 + Math.random() * 0.5, ease: 'power3.out' },
        0.15 + Math.random() * 0.15,
      );
    }
  },

  /** Хлопушки и фейерверк в честь окончания курса. Живут своим холстом и догорают, даже когда тур уже закрыт. */
  fireworks() {
    celebrate();
  },
};

export function playCue(cue, context) {
  const cleanups = [];
  const cleanup = () => {
    cleanups.splice(0).forEach((run) => run());
    context.layer.replaceChildren();
  };
  const timeline = gsap.timeline({ onComplete: cleanup });
  const build = cue && BUILDERS[cue.type];
  if (build) build(cue, { ...context, timeline, onCleanup: (run) => cleanups.push(run) });
  return {
    kill() {
      timeline.kill();
      cleanup();
    },
  };
}
