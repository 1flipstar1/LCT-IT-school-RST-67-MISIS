import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { cn } from '../lib/cn.js';
import styles from './Tabs.module.css';

/** Вкладки. tabs: [{ value, label, count }]. Содержимое активной вкладки рендерит родитель. */
export function Tabs({ label, tabs, value, onChange, className, animateIndicator = false }) {
  const tabRefs = useRef(new Map());
  const indicatorRef = useRef(null);
  const indicatorReadyRef = useRef(false);

  useLayoutEffect(() => {
    if (!animateIndicator) return undefined;

    const tab = tabRefs.current.get(value);
    const indicator = indicatorRef.current;
    if (!tab || !indicator) return undefined;

    const position = { x: tab.offsetLeft, width: tab.offsetWidth };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!indicatorReadyRef.current || reduceMotion) {
      gsap.set(indicator, { ...position, scaleX: 1 });
      indicatorReadyRef.current = true;
      return undefined;
    }

    gsap.to(indicator, {
      x: position.x,
      scaleX: position.width / indicator.offsetWidth,
      duration: 0.28,
      ease: 'power2.out',
      overwrite: 'auto',
      onComplete: () => gsap.set(indicator, { width: position.width, scaleX: 1 }),
    });

    return () => gsap.killTweensOf(indicator);
  }, [animateIndicator, value]);

  const handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const index = tabs.findIndex((tab) => tab.value === value);
    const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[nextIndex].value);
    event.currentTarget.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn(styles.tabs, animateIndicator && styles.animated, className)} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            ref={(node) => {
              if (node) tabRefs.current.set(tab.value, node);
              else tabRefs.current.delete(tab.value);
            }}
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cn(styles.tab, selected && styles.selected)}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.count !== undefined && <span className={styles.count}>{tab.count}</span>}
          </button>
        );
      })}
      {animateIndicator && <span ref={indicatorRef} className={styles.indicator} aria-hidden="true" />}
    </div>
  );
}
