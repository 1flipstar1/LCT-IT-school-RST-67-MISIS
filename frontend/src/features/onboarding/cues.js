import { gsap } from 'gsap';

/**
 * Анимации-подсказки тура, описанные данными: { type: 'pulse' | 'sweep' | 'typing' | 'pointer' | 'burst', ...параметры }.
 * Шаг тура хранит только JSON-описание, а здесь по нему собирается таймлайн GSAP.
 * layer — слой для временных элементов, rect — подсвеченная область (или null), card — карточка шага.
 * Возвращает таймлайн: тур останавливает его при переходе к следующему шагу.
 */

const COLOR = { brand: 'var(--color-brand)', accent: 'var(--color-accent)' };

function spawn(layer, className, style = {}) {
  const node = document.createElement('div');
  node.className = className;
  Object.assign(node.style, style);
  layer.appendChild(node);
  return node;
}

const BUILDERS = {
  /** Кольцо вокруг элемента мягко «дышит». */
  pulse({ repeat = 1 }, { ring, timeline }) {
    timeline.fromTo(ring, { scale: 1, opacity: 1 }, { scale: 1.06, opacity: 0.35, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: repeat * 2 - 1 });
  },

  /** По элементу проходит световая полоса — «вот эта область». */
  sweep({ axis = 'x' }, { layer, rect, classes, timeline }) {
    if (!rect) return;
    const horizontal = axis === 'x';
    const bar = spawn(layer, classes.sweep, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: horizontal ? '80px' : `${rect.w}px`,
      height: horizontal ? `${rect.h}px` : '80px',
      background: `linear-gradient(${horizontal ? '90deg' : '180deg'}, transparent, color-mix(in srgb, var(--color-brand) 28%, transparent), transparent)`,
    });
    timeline.fromTo(bar, horizontal ? { x: -80 } : { y: -80 }, { ...(horizontal ? { x: rect.w } : { y: rect.h }), duration: 1.1, ease: 'power2.inOut', repeat: 1, repeatDelay: 0.4 });
  },

  /** В поле «печатается» пример запроса. */
  typing({ text = '' }, { layer, rect, classes, timeline }) {
    if (!rect) return;
    const line = spawn(layer, classes.typing, { left: `${rect.x + 56}px`, top: `${rect.y + rect.h / 2}px` });
    const state = { count: 0 };
    timeline.to(state, {
      count: text.length,
      duration: text.length * 0.06,
      ease: 'none',
      delay: 0.3,
      onUpdate: () => { line.textContent = `${text.slice(0, Math.round(state.count))}▍`; },
    });
    timeline.to(line, { opacity: 0, duration: 0.3, delay: 1.2 });
  },

  /** «Курсор» подъезжает к элементу и нажимает на него. */
  pointer({ click = true }, { layer, rect, classes, timeline }) {
    if (!rect) return;
    const pointer = spawn(layer, classes.pointer);
    pointer.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M5 3l14 8-6 2-3 6z" fill="white" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const x = rect.x + rect.w / 2;
    const y = rect.y + rect.h / 2;
    timeline.fromTo(pointer, { x: x + 90, y: y + 70, opacity: 0 }, { x, y, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.2 });
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
};

export function playCue(cue, context) {
  const timeline = gsap.timeline({
    onComplete: () => context.layer.replaceChildren(),
  });
  const build = cue && BUILDERS[cue.type];
  if (build) build(cue, { ...context, timeline });
  return timeline;
}
