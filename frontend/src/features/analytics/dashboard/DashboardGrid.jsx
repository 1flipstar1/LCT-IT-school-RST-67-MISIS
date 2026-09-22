import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { Flip } from 'gsap/Flip';
import { Button } from '../../../ui/Button.jsx';
import { AddIcon, RefreshIcon } from '../../../ui/icons.js';
import { SidePanel } from '../../../ui/SidePanel.jsx';
import { WIDGET_CATEGORY } from '../widgets/common.js';
import { moveWidget, nextSize, resizeWidget } from './layout.js';
import styles from '../AnalyticsPage.module.css';

gsap.registerPlugin(Draggable, Flip);

const centerDistance = (a, b) => {
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  return (ax - bx) ** 2 + (ay - by) ** 2;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const RESIZE_HYSTERESIS = 8;

const sizeSpan = (size, columns) => {
  if (size === 's') return 1;
  if (size === 'm') return Math.min(2, columns);
  return Math.min(3, columns);
};

/** Ближайшая реальная ячейка CSS Grid; transform-анимации соседей на расчёт не влияют. */
function closestGridIndex(nodes, dragged, grid) {
  const draggedRect = dragged.getBoundingClientRect();
  const gridRect = grid.getBoundingClientRect();
  let result = Number(dragged.dataset.widgetIndex);
  let distance = Number.POSITIVE_INFINITY;
  nodes.forEach((node) => {
    const slot = {
      left: gridRect.left + node.offsetLeft,
      top: gridRect.top + node.offsetTop,
      width: node.offsetWidth,
      height: node.offsetHeight,
    };
    const nextDistance = centerDistance(draggedRect, slot);
    if (nextDistance < distance) {
      result = Number(node.dataset.widgetIndex);
      distance = nextDistance;
    }
  });
  return result;
}

/**
 * Режим редактирования как на iOS: GSAP Draggable двигает карточку под указателем,
 * Flip плавно перестраивает CSS Grid после отпускания, отдельный угловой маркер меняет размер.
 */
function useGsapDashboardEditing({
  editing,
  layout,
  catalog,
  onPreviewMove,
  onPreviewCommit,
  onPreviewCancel,
  onPreviewResize,
  onPreviewResizeCommit,
}) {
  const gridRef = useRef(null);
  const callbacksRef = useRef({ onPreviewMove, onPreviewCommit, onPreviewCancel, onPreviewResize, onPreviewResizeCommit });
  callbacksRef.current = { onPreviewMove, onPreviewCommit, onPreviewCancel, onPreviewResize, onPreviewResizeCommit };
  const layoutKey = layout.map((entry) => `${entry.id}:${entry.size}`).join('|');

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!editing || !grid) return undefined;

    const nodes = [...grid.querySelectorAll('[data-widget-id]')];
    const contents = nodes.map((node) => node.querySelector('[data-widget-content]'));
    const placeholder = grid.querySelector('[data-drop-placeholder]');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draggables = [];

    if (!reduceMotion) {
      contents.forEach((content, index) => {
        gsap.to(content, {
          rotation: index % 2 === 0 ? 0.16 : -0.16,
          duration: 0.18 + (index % 3) * 0.02,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: (index % 4) * 0.025,
        });
      });
    }

    nodes.forEach((node) => {
      const id = node.dataset.widgetId;
      const fromIndex = Number(node.dataset.widgetIndex);
      const dragHandle = node.querySelector('[data-drag-handle]');
      const resizeHandle = node.querySelector('[data-resize-handle]');
      const content = node.querySelector('[data-widget-content]');
      const widget = catalog.get(id);
      let previewTarget = fromIndex;
      let lastPreviewAt = 0;
      let previewAnimation = null;

      const movePlaceholder = () => {
        if (!placeholder) return;
        gsap.killTweensOf(placeholder);
        gsap.set(placeholder, {
          x: node.offsetLeft,
          y: node.offsetTop,
          width: node.offsetWidth,
          height: node.offsetHeight,
          opacity: 1,
        });
      };

      const [moveDrag] = Draggable.create(node, {
        type: 'x,y',
        trigger: dragHandle,
        bounds: grid,
        edgeResistance: 0.82,
        minimumMovement: 4,
        cursor: 'grabbing',
        activeCursor: 'grabbing',
        zIndexBoost: false,
        onPress() {
          previewTarget = fromIndex;
          lastPreviewAt = 0;
          node.classList.add(styles.widgetDragging);
          movePlaceholder();
          gsap.to(content, { scale: 1.018, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
        },
        onDrag() {
          const currentNodes = [...grid.querySelectorAll('[data-widget-id]')];
          const index = closestGridIndex(currentNodes, node, grid);
          const now = performance.now();
          if (index === previewTarget || now - lastPreviewAt < 110) return;

          const visualBefore = node.getBoundingClientRect();
          const state = Flip.getState(currentNodes.filter((item) => item !== node));
          previewTarget = index;
          lastPreviewAt = now;
          callbacksRef.current.onPreviewMove(id, index);
          this.update(false, true);
          const visualAfter = node.getBoundingClientRect();
          this.x += visualBefore.left - visualAfter.left;
          this.y += visualBefore.top - visualAfter.top;
          gsap.set(node, { x: this.x, y: this.y });
          previewAnimation?.kill();
          previewAnimation = Flip.from(state, {
            duration: reduceMotion ? 0 : 0.3,
            ease: 'power3.out',
            absolute: false,
            simple: true,
            prune: true,
          });
          movePlaceholder();
        },
        onRelease() {
          node.classList.remove(styles.widgetDragging);
          gsap.to(content, { scale: 1, duration: 0.32, ease: 'power3.out', overwrite: 'auto' });
          gsap.to(placeholder, { opacity: 0, duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
          gsap.to(node, {
            x: 0,
            y: 0,
            duration: reduceMotion ? 0 : 0.38,
            ease: 'back.out(1.5)',
            clearProps: 'x,y,zIndex',
            onComplete: () => {
              if (previewTarget !== fromIndex) callbacksRef.current.onPreviewCommit(id, previewTarget);
              else callbacksRef.current.onPreviewCancel();
            },
          });
        },
      });
      draggables.push(moveDrag);

      if (!resizeHandle || !widget || widget.sizes.length < 2) return;
      let previewIndex = widget.sizes.indexOf(layout[fromIndex]?.size);
      const startIndex = previewIndex;
      let startWidth = 0;
      let allowedWidths = [];
      let appliedPreviewIndex = startIndex;
      let resizeAnimation = null;

      const applyResizePreview = (index) => {
        if (index === appliedPreviewIndex) return;
        const currentNodes = [...grid.querySelectorAll('[data-widget-id]')];
        const state = Flip.getState(currentNodes.filter((item) => item !== node));
        appliedPreviewIndex = index;
        callbacksRef.current.onPreviewResize(id, widget.sizes[index]);
        resizeAnimation?.kill();
        resizeAnimation = Flip.from(state, {
          duration: reduceMotion ? 0 : 0.3,
          ease: 'power3.out',
          absolute: false,
          simple: true,
          prune: true,
        });
      };

      const [resizeDrag] = Draggable.create(resizeHandle, {
        type: 'x',
        minimumMovement: 3,
        cursor: 'nwse-resize',
        activeCursor: 'nwse-resize',
        onPress() {
          const gridStyle = getComputedStyle(grid);
          const columns = gridStyle.gridTemplateColumns
            .split(/\s+/)
            .map((value) => Number.parseFloat(value))
            .filter(Number.isFinite);
          const gap = Number.parseFloat(gridStyle.columnGap) || 0;
          allowedWidths = widget.sizes.map((size) => {
            const span = sizeSpan(size, columns.length);
            return columns.slice(0, span).reduce((sum, width) => sum + width, 0) + gap * Math.max(0, span - 1);
          });
          startWidth = node.getBoundingClientRect().width;
          previewIndex = startIndex;
          appliedPreviewIndex = startIndex;
          node.classList.add(styles.widgetResizing);
          gsap.set(node, { width: startWidth, willChange: 'width' });
          gsap.set(content, { willChange: 'filter, opacity' });
          movePlaceholder();
        },
        onDrag() {
          const minWidth = Math.min(...allowedWidths);
          const maxWidth = Math.max(...allowedWidths);
          const width = clamp(startWidth + this.x, minWidth, maxWidth);
          const delta = width - startWidth;
          const range = Math.max(1, maxWidth - minWidth);
          const progress = Math.abs(delta) / range;
          previewIndex = allowedWidths.reduce(
            (best, candidate, index) => (Math.abs(candidate - width) < Math.abs(allowedWidths[best] - width) ? index : best),
            0,
          );

          // iOS-like hysteresis: reserve the larger slot almost immediately,
          // but keep it occupied until the card is nearly back to the smaller size.
          let reservedIndex = appliedPreviewIndex;
          while (
            reservedIndex < allowedWidths.length - 1
            && width > allowedWidths[reservedIndex] + RESIZE_HYSTERESIS
          ) reservedIndex += 1;
          while (
            reservedIndex > 0
            && width <= allowedWidths[reservedIndex - 1] + RESIZE_HYSTERESIS
          ) reservedIndex -= 1;
          applyResizePreview(reservedIndex);

          gsap.set(resizeHandle, { x: 0 });
          gsap.set(node, { width });
          gsap.set(content, {
            filter: reduceMotion ? 'none' : `blur(${0.25 + progress * 1.1}px)`,
            opacity: 0.96,
          });
          movePlaceholder();
        },
        onRelease() {
          node.classList.remove(styles.widgetResizing);
          gsap.to(resizeHandle, { x: 0, duration: 0.34, ease: 'back.out(2)', clearProps: 'x' });
          gsap.to(placeholder, { opacity: 0, duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
          // The release still rounds to the nearest supported size (50% threshold).
          applyResizePreview(previewIndex);
          const targetWidth = allowedWidths[previewIndex] ?? startWidth;
          gsap.to(node, {
            width: targetWidth,
            duration: reduceMotion ? 0 : 0.24,
            ease: 'power3.out',
            overwrite: 'auto',
            onComplete: () => {
              gsap.set(node, { clearProps: 'width,willChange' });
              if (previewIndex !== startIndex) callbacksRef.current.onPreviewResizeCommit(id, widget.sizes[previewIndex]);
              else callbacksRef.current.onPreviewCancel();
            },
          });
          gsap.to(content, {
            filter: 'blur(0px)',
            opacity: 1,
            duration: reduceMotion ? 0 : 0.2,
            ease: 'power2.out',
            overwrite: 'auto',
            onComplete: () => gsap.set(content, { clearProps: 'filter,opacity,willChange' }),
          });
        },
      });
      draggables.push(resizeDrag);
    });

    return () => {
      draggables.forEach((draggable) => draggable.kill());
      gsap.killTweensOf([...nodes, ...contents]);
      if (placeholder) gsap.set(placeholder, { clearProps: 'x,y,width,height,opacity' });
      gsap.set(nodes, { clearProps: 'x,y,width,scale,rotation,zIndex,willChange' });
      gsap.set(contents, { clearProps: 'x,y,scale,rotation,filter,opacity,willChange' });
    };
  }, [editing, layoutKey, catalog]);

  return gridRef;
}

export function DashboardGrid({ layout, catalog, data, editing, onMove, onResize, onRemove }) {
  const [previewLayout, setPreviewLayout] = useState(null);
  const renderedLayout = previewLayout ?? layout;

  useEffect(() => {
    if (!editing) setPreviewLayout(null);
  }, [editing]);

  const handlePreviewMove = (id, toIndex) => {
    flushSync(() => setPreviewLayout((current) => moveWidget(current ?? layout, id, toIndex)));
  };
  const handlePreviewCommit = (id, toIndex) => {
    flushSync(() => {
      onMove(id, toIndex);
      setPreviewLayout(null);
    });
  };
  const handlePreviewResize = (id, size) => {
    flushSync(() => setPreviewLayout((current) => resizeWidget(current ?? layout, id, size)));
  };
  const handlePreviewResizeCommit = (id, size) => {
    flushSync(() => {
      onResize(id, size);
      setPreviewLayout(null);
    });
  };
  const handlePreviewCancel = () => setPreviewLayout(null);
  const gridRef = useGsapDashboardEditing({
    editing,
    layout,
    catalog,
    onPreviewMove: handlePreviewMove,
    onPreviewCommit: handlePreviewCommit,
    onPreviewCancel: handlePreviewCancel,
    onPreviewResize: handlePreviewResize,
    onPreviewResizeCommit: handlePreviewResizeCommit,
  });

  if (layout.length === 0) {
    return (
      <div className={styles.emptyDashboard}>
        <strong>Панель пока пустая</strong>
        <span>Включите редактирование шестерёнкой и добавьте нужные показатели и графики.</span>
      </div>
    );
  }

  return (
    <section ref={gridRef} className={styles.dashboardGrid} aria-label="Панель аналитики">
      {editing && <div className={styles.dropPlaceholder} data-drop-placeholder aria-hidden="true" />}
      {renderedLayout.map((entry, index) => {
        const widget = catalog.get(entry.id);
        if (!widget) return null;
        const Widget = widget.Component;
        const heightClass = widget.rowSpan === 2 ? styles.widgetDoubleRow : '';
        return (
          <div
            key={entry.id}
            data-widget-id={entry.id}
            data-widget-index={index}
            className={`${styles.widget} ${styles[`size-${entry.size}`]} ${heightClass} ${editing ? styles.widgetEditing : ''}`}
          >
            {editing && (
              <>
                <button className={styles.removeButton} type="button" aria-label={`Удалить «${widget.title}» с панели`} title="Удалить с панели" onClick={() => onRemove(entry.id)} />
                <div
                  className={styles.dragSurface}
                  data-drag-handle
                  role="button"
                  tabIndex={0}
                  aria-label={`Переместить «${widget.title}». Перетащите или используйте стрелки на клавиатуре`}
                  onKeyDown={(event) => {
                    if (['ArrowLeft', 'ArrowUp'].includes(event.key) && index > 0) {
                      event.preventDefault();
                      onMove(entry.id, index - 1);
                    }
                    if (['ArrowRight', 'ArrowDown'].includes(event.key) && index < renderedLayout.length - 1) {
                      event.preventDefault();
                      onMove(entry.id, index + 1);
                    }
                  }}
                />
                {widget.sizes.length > 1 && (
                  <button
                    className={styles.resizeHandle}
                    data-resize-handle
                    type="button"
                    aria-label={`Изменить размер «${widget.title}»`}
                    title="Потяните для изменения размера"
                    onClick={() => onResize(entry.id, nextSize(widget, entry.size))}
                  >
                    <svg className={styles.resizeGlyph} viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 18h5.5c4.2 0 7.5-3.3 7.5-7.5V5" />
                    </svg>
                  </button>
                )}
              </>
            )}
            <div data-widget-content className={styles.widgetContent}>
              <Widget data={data} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function WidgetCatalogPanel({ open, onOpenChange, widgets, layout, onAdd, onReset }) {
  const selected = new Set(layout.map((entry) => entry.id));
  const categories = Object.values(WIDGET_CATEGORY)
    .map((name) => ({ name, widgets: widgets.filter((widget) => widget.category === name) }))
    .filter((group) => group.widgets.length > 0);

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Добавить на панель"
      description="Показатели и графики сохраняются на этом устройстве. Их порядок и размер можно менять в режиме редактирования."
      footer={
        <>
          <Button variant="ghost" icon={RefreshIcon} onClick={onReset}>Вернуть стандартную</Button>
          <Button onClick={() => onOpenChange(false)}>Готово</Button>
        </>
      }
    >
      {categories.map((group) => (
        <section key={group.name} className={styles.catalogGroup}>
          <h3>{group.name}</h3>
          <div className={styles.catalogList}>
            {group.widgets.map((widget) => {
              const added = selected.has(widget.id);
              const Icon = widget.icon;
              return (
                <article key={widget.id} className={styles.catalogItem}>
                  <span className={styles.catalogIcon}>{Icon && <Icon size={20} fill="currentColor" />}</span>
                  <div className={styles.catalogText}>
                    <strong>{widget.title}</strong>
                    <span>{widget.description}</span>
                    <small>{widget.chartType}</small>
                  </div>
                  <Button size="s" variant={added ? 'ghost' : 'outline'} icon={added ? undefined : AddIcon} disabled={added} onClick={() => onAdd(widget)}>
                    {added ? 'На панели' : 'Добавить'}
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </SidePanel>
  );
}
