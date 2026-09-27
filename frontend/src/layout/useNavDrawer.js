import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { isDrawerLayout, useLayoutMode } from '../lib/layoutMode.js';
import { shouldReduceMotion } from '../lib/motion.js';

gsap.registerPlugin(Draggable);

/** Какую долю ширины меню нужно протащить влево, чтобы оно закрылось. */
const SWIPE_CLOSE_SHARE = 0.3;
const PHASE = { closed: 'closed', open: 'open', closing: 'closing' };

/**
 * Выезжающее меню на телефоне и планшете.
 *
 * Состояния покоя («закрыто» / «открыто», класс .open) задаёт CSS, а GSAP только анимирует переход
 * между ними и в конце снимает свои инлайновые стили. Поэтому закрытие идёт в три фазы:
 * open → closing (анимация, класс ещё стоит) → closed (класс снят, CSS прячет меню за краем).
 * Закрыть можно пунктом меню, тапом по затемнению, Esc или свайпом влево.
 */
export function useNavDrawer({ panelRef, scrimRef, triggerRef }) {
  const mode = useLayoutMode();
  const drawer = isDrawerLayout(mode);
  const [phase, setPhase] = useState(PHASE.closed);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const closingRef = useRef(null);

  // Меню снова открыли, пока оно уезжало: останавливаем закрытие, иначе его onComplete
  // захлопнул бы только что открытое меню. Инлайновый сдвиг сбрасываем — появление начнётся с края.
  const open = useCallback(() => {
    closingRef.current?.kill();
    closingRef.current = null;
    gsap.set([panelRef.current, scrimRef.current].filter(Boolean), { clearProps: 'transform,opacity,visibility' });
    setPhase(PHASE.open);
  }, [panelRef, scrimRef]);

  const finishClose = useCallback(() => {
    closingRef.current = null;
    gsap.set([panelRef.current, scrimRef.current].filter(Boolean), { clearProps: 'all' });
    setPhase(PHASE.closed);
    triggerRef.current?.focus({ preventScroll: true });
  }, [panelRef, scrimRef, triggerRef]);

  const close = useCallback(() => {
    if (phaseRef.current !== PHASE.open) return;
    if (shouldReduceMotion()) {
      finishClose();
      return;
    }
    setPhase(PHASE.closing);
    const panel = panelRef.current;
    closingRef.current = gsap.timeline({ onComplete: finishClose })
      .to(panel, { x: -panel.offsetWidth, xPercent: 0, duration: 0.3, ease: 'power2.in' }, 0)
      .to(scrimRef.current, { autoAlpha: 0, duration: 0.25, ease: 'power1.in' }, 0);
  }, [finishClose, panelRef, scrimRef]);

  // Появление: меню, затемнение и пункты — одним таймлайном.
  useLayoutEffect(() => {
    if (phase !== PHASE.open || shouldReduceMotion()) return undefined;
    const panel = panelRef.current;
    const items = panel.querySelectorAll('li, [data-drawer-item]');
    const timeline = gsap.timeline()
      .fromTo(panel, { xPercent: -100 }, { xPercent: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform' }, 0)
      .fromTo(scrimRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.out' }, 0)
      .fromTo(items, { x: -18, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.3, stagger: 0.025, ease: 'power2.out', clearProps: 'transform,opacity,visibility' }, 0.12);
    return () => timeline.kill();
  }, [phase, panelRef, scrimRef]);

  // Свайп влево закрывает меню; затемнение гаснет вслед за пальцем.
  useEffect(() => {
    if (phase !== PHASE.open) return undefined;
    const panel = panelRef.current;
    const [swipe] = Draggable.create(panel, {
      type: 'x',
      bounds: { minX: -panel.offsetWidth, maxX: 0 },
      edgeResistance: 0.85,
      minimumMovement: 8,
      allowNativeTouchScrolling: true,
      zIndexBoost: false,
      onDrag() {
        gsap.set(scrimRef.current, { autoAlpha: 1 + this.x / panel.offsetWidth });
      },
      onRelease() {
        if (this.x < -panel.offsetWidth * SWIPE_CLOSE_SHARE) close();
        else gsap.timeline()
          .to(panel, { x: 0, duration: 0.25, ease: 'power2.out', clearProps: 'transform' }, 0)
          .to(scrimRef.current, { autoAlpha: 1, duration: 0.2 }, 0);
      },
    });
    return () => swipe.kill();
  }, [phase, close, panelRef, scrimRef]);

  // Esc закрывает; пока меню открыто, фокус внутри него, а страница под ним не прокручивается.
  useEffect(() => {
    if (phase === PHASE.closed) return undefined;
    document.documentElement.setAttribute('data-nav-open', '');
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    if (phase === PHASE.open) panelRef.current?.querySelector('a, button')?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.removeAttribute('data-nav-open');
    };
  }, [phase, close, panelRef]);

  // Окно стало широким — меню закрепилось, выезжающее состояние больше не нужно.
  useEffect(() => {
    if (!drawer && phaseRef.current !== PHASE.closed) {
      gsap.killTweensOf([panelRef.current, scrimRef.current]);
      gsap.set([panelRef.current, scrimRef.current].filter(Boolean), { clearProps: 'all' });
      setPhase(PHASE.closed);
    }
  }, [drawer, panelRef, scrimRef]);

  return { drawer, isOpen: phase !== PHASE.closed, expanded: phase === PHASE.open, open, close };
}
