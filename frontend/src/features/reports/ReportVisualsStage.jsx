import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { renderChartCanvas } from '../../lib/export/chartImage.js';
import { WidgetContext } from '../../ui/widgetContext.js';
import { useAnalyticsData } from '../analytics/useAnalyticsData.js';
import styles from './ReportsPage.module.css';

const EXPORT_CONTEXT = { exportMode: true, action: null };
/** Широкие виджеты (тепловые карты, календарь) рисуются на всю ширину и занимают в PDF целую строку. */
const isWide = (widget) => widget.defaultSize === 'l';
const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 350))));

/** Таблица виджета без графика — в PDF она попадает таблицей, а не картинкой. */
function readTable(node) {
  const table = node.querySelector('table');
  if (!table) return null;
  const cells = (row) => [...row.querySelectorAll('th, td')].map((cell) => cell.innerText.trim());
  const [head, ...body] = [...table.querySelectorAll('tr')].map(cells);
  return head ? { header: head, body: body.filter((row) => row.length) } : null;
}

/**
 * Невидимая «сцена» для PDF: выбранные виджеты аналитики рисуются вне экрана по фильтрам отчёта,
 * затем графики снимаются в картинки, а плитки KPI превращаются в числа.
 * onCaptured({ kpis, figures, tables, skipped }) вызывается один раз.
 */
export function ReportVisualsStage({ widgets, filters, onCaptured }) {
  const data = useAnalyticsData(filters);
  const stageRef = useRef(null);
  const doneRef = useRef(false);
  const charts = widgets.filter((widget) => !widget.metric);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      await settle();
      if (cancelled || doneRef.current) return;
      doneRef.current = true;

      const kpis = widgets.filter((widget) => widget.metric).map((widget) => ({ label: widget.title, ...widget.metric(data) }));
      const figures = [];
      const tables = [];
      const skipped = [];
      for (const widget of charts) {
        const node = stageRef.current?.querySelector(`[data-report-widget="${widget.id}"]`);
        const chart = node?.querySelector('[data-chart-title]') ?? node;
        const canvas = chart ? await renderChartCanvas(chart, { padding: 8 }) : null;
        if (canvas) {
          figures.push({ title: widget.title, image: canvas, width: canvas.width / 2, height: canvas.height / 2, wide: isWide(widget) });
          continue;
        }
        const table = node && readTable(node);
        if (table) tables.push({ title: widget.title, table });
        else skipped.push(widget.title);
      }
      onCaptured({ kpis, figures, tables, skipped });
    })();
    return () => {
      cancelled = true;
    };
    // Снимок делается один раз для набора виджетов, с которым сцена открылась.
  }, []);

  return createPortal(
    <div ref={stageRef} className={styles.stage} aria-hidden="true">
      <WidgetContext.Provider value={EXPORT_CONTEXT}>
        {charts.map((widget) => {
          const Widget = widget.Component;
          return (
            <div key={widget.id} data-report-widget={widget.id} className={isWide(widget) ? styles.stageWide : styles.stageItem}>
              <Widget data={data} />
            </div>
          );
        })}
      </WidgetContext.Provider>
    </div>,
    document.body,
  );
}
