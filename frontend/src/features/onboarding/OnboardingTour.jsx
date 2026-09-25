import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { Button } from '../../ui/Button.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { playCue } from './cues.js';
import { stepsFor } from './tourSteps.js';
import styles from './OnboardingTour.module.css';

export const START_TOUR_EVENT = 'onboarding:start';
/** Запустить курс заново — например, из справки. */
export const startOnboarding = () => window.dispatchEvent(new Event(START_TOUR_EVENT));

const PADDING = 8;
const CARD_WIDTH = 360;
const GAP = 16;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Ждём элемент шага после перехода на страницу: страницы грузятся лениво. */
function waitForTarget(target, timeout = 2500) {
  return new Promise((resolve) => {
    if (!target) {
      resolve(null);
      return;
    }
    const started = performance.now();
    const check = () => {
      const node = document.querySelector(`[data-tour="${target}"]`);
      const rect = node?.getBoundingClientRect();
      if (node && rect.width > 0 && rect.height > 0) resolve(node);
      else if (performance.now() - started > timeout) resolve(null);
      else requestAnimationFrame(check);
    };
    check();
  });
}

function holeFor(node) {
  if (!node) return { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 };
  const rect = node.getBoundingClientRect();
  return { x: rect.left - PADDING, y: rect.top - PADDING, w: rect.width + PADDING * 2, h: rect.height + PADDING * 2 };
}

/** Где поставить карточку шага: со стороны placement, а если не помещается — где есть место. */
function cardPosition(hole, placement, cardHeight) {
  const width = Math.min(CARD_WIDTH, window.innerWidth - GAP * 2);
  if (hole.w === 0) return { left: (window.innerWidth - width) / 2, top: Math.max(GAP, (window.innerHeight - cardHeight) / 2), width };
  const fits = {
    right: hole.x + hole.w + GAP + width < window.innerWidth,
    left: hole.x - GAP - width > 0,
    bottom: hole.y + hole.h + GAP + cardHeight < window.innerHeight,
    top: hole.y - GAP - cardHeight > 0,
  };
  const side = fits[placement] ? placement : ['bottom', 'right', 'left', 'top'].find((item) => fits[item]) ?? 'center';
  const clampX = (x) => Math.min(Math.max(GAP, x), window.innerWidth - width - GAP);
  const clampY = (y) => Math.min(Math.max(GAP, y), window.innerHeight - cardHeight - GAP);
  if (side === 'right') return { left: hole.x + hole.w + GAP, top: clampY(hole.y), width };
  if (side === 'left') return { left: hole.x - GAP - width, top: clampY(hole.y), width };
  if (side === 'bottom') return { left: clampX(hole.x), top: hole.y + hole.h + GAP, width };
  if (side === 'top') return { left: clampX(hole.x), top: hole.y - GAP - cardHeight, width };
  return { left: (window.innerWidth - width) / 2, top: clampY(window.innerHeight - cardHeight - GAP), width };
}

/**
 * Вводный курс при первом входе: подсвечивает элементы интерфейса по разделам с короткими пояснениями.
 * Отметку «пройден / пропущен» хранит сервер в карточке сотрудника — курс не повторится на другом компьютере.
 */
export function OnboardingTour() {
  const { user, can } = useSession();
  const { pathname, navigate } = useRouter();
  const actions = useActions();
  const toast = useToast();
  const steps = useMemo(() => stepsFor(can), [can]);

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const autoStartedRef = useRef(false);
  const geometryRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 });
  const holeRef = useRef(null);
  const ringRef = useRef(null);
  const cardRef = useRef(null);
  const cueLayerRef = useRef(null);
  const cueRef = useRef(null);
  const targetRef = useRef(null);
  const primaryRef = useRef(null);

  const step = steps[index];

  // Первый вход: у сотрудника ещё нет отметки о курсе. Зависимости — примитивы: объект пользователя
  // пересоздаётся при каждой загрузке данных, а запуск не должен сбрасываться из-за этого.
  const userId = user?.id;
  const onboarded = Boolean(user?.onboarding);
  useEffect(() => {
    if (autoStartedRef.current || !userId || onboarded || pathname === '/assistant') return undefined;
    const timer = setTimeout(() => {
      autoStartedRef.current = true;
      setIndex(0);
      setActive(true);
    }, 700);
    return () => clearTimeout(timer);
  }, [userId, onboarded, pathname]);

  useEffect(() => {
    const start = () => {
      setIndex(0);
      setActive(true);
    };
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, []);

  const applyGeometry = useCallback(() => {
    const { x, y, w, h } = geometryRef.current;
    const hole = holeRef.current;
    if (hole) {
      hole.setAttribute('x', x);
      hole.setAttribute('y', y);
      hole.setAttribute('width', w);
      hole.setAttribute('height', h);
    }
    if (ringRef.current) Object.assign(ringRef.current.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, opacity: w ? 1 : 0 });
  }, []);

  const finish = useCallback(async (status) => {
    cueRef.current?.kill();
    const layer = cardRef.current?.parentElement;
    const close = () => setActive(false);
    if (layer && !reducedMotion()) gsap.to(layer, { autoAlpha: 0, duration: 0.3, onComplete: close });
    else close();
    if (status === 'skipped') toast.success('Курс пропущен. Пройти его можно в любой момент в «Справке».');
    try {
      await actions.finishOnboarding(status);
    } catch {
      // Отметка не сохранилась (нет связи) — курс просто покажется при следующем входе.
    }
  }, [actions, toast]);

  // Переход к шагу: нужная страница → элемент → «окно» и карточка плавно переезжают к нему.
  useLayoutEffect(() => {
    if (!active || !step) return undefined;
    let cancelled = false;
    if (step.route && step.route !== pathname) navigate(step.route);

    (async () => {
      const node = await waitForTarget(step.target);
      if (cancelled) return;
      node?.scrollIntoView({ block: 'center', behavior: 'instant' });
      targetRef.current = node;
      const hole = holeFor(node);
      const card = cardRef.current;
      const position = cardPosition(hole, step.placement, card.offsetHeight || 220);
      const duration = reducedMotion() ? 0 : 0.55;

      cueRef.current?.kill();
      cueLayerRef.current?.replaceChildren();
      gsap.to(geometryRef.current, { ...hole, duration, ease: 'power3.inOut', onUpdate: applyGeometry });
      gsap.to(card, { left: position.left, top: position.top, width: position.width, duration, ease: 'power3.inOut' });
      gsap.fromTo(card.querySelector('[data-tour-content]'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: duration * 0.8, delay: duration * 0.4, ease: 'power2.out' });
      primaryRef.current?.focus({ preventScroll: true });

      if (!reducedMotion()) {
        gsap.delayedCall(duration, () => {
          if (cancelled || !cueLayerRef.current) return;
          cueRef.current = playCue(step.cue, { layer: cueLayerRef.current, rect: node ? hole : null, card, ring: ringRef.current, classes: styles });
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // pathname не в зависимостях: переход на страницу шага не должен перезапускать сам шаг.
  }, [active, index]);

  // Окно и карточка следуют за элементом при прокрутке и изменении размера окна.
  useEffect(() => {
    if (!active) return undefined;
    const follow = () => {
      Object.assign(geometryRef.current, holeFor(targetRef.current));
      applyGeometry();
      const position = cardPosition(geometryRef.current, step?.placement, cardRef.current?.offsetHeight || 220);
      gsap.set(cardRef.current, position);
    };
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
  }, [active, step, applyGeometry]);

  const next = useCallback(() => (index === steps.length - 1 ? finish('completed') : setIndex((value) => value + 1)), [index, steps.length, finish]);
  const back = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') finish('skipped');
      else if (event.key === 'ArrowRight') next();
      else if (event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, back, finish]);

  useLayoutEffect(() => {
    if (!active || reducedMotion()) return;
    gsap.fromTo(cardRef.current?.parentElement, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });
  }, [active]);

  if (!active || !step) return null;
  const last = index === steps.length - 1;

  return createPortal(
    <div className={styles.layer} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
      <svg className={styles.shade} aria-hidden="true">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect ref={holeRef} rx="14" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" className={styles.shadeFill} mask="url(#tour-mask)" />
      </svg>
      <div ref={ringRef} className={styles.ring} aria-hidden="true" />
      <div ref={cueLayerRef} className={styles.cues} aria-hidden="true" />

      <section ref={cardRef} className={styles.card}>
        <div data-tour-content className={styles.content}>
          <div className={styles.progress} aria-label={`Шаг ${index + 1} из ${steps.length}`}>
            {steps.map((item, dotIndex) => (
              <span key={item.id} className={dotIndex <= index ? styles.dotDone : styles.dotTodo} />
            ))}
          </div>
          <p className={styles.counter}>Курс новичка · {index + 1} из {steps.length}</p>
          <h2 id="tour-title" className={styles.title}>{step.id === 'welcome' && user?.name ? `Добро пожаловать, ${user.name.split(' ')[0]}!` : step.title}</h2>
          <p id="tour-text" className={styles.text}>{step.text}</p>
          <div className={styles.actions}>
            {!last && <button type="button" className={styles.skip} onClick={() => finish('skipped')}>Пропустить курс</button>}
            <span className={styles.spacer} />
            {index > 0 && <Button variant="ghost" size="s" onClick={back}>Назад</Button>}
            <span ref={primaryRef} tabIndex={-1} className={styles.focusAnchor} />
            <Button variant="primary" size="s" onClick={next}>
              {index === 0 ? 'Начать' : last ? 'Начать работу' : 'Далее'}
            </Button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
