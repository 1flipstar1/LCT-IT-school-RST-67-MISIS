import { formatDate, formatNumber } from '../../domain/format.js';
import { downloadBlob, safeFileName } from '../../lib/download.js';
import { svgToImage } from '../../lib/export/chartImage.js';
import { ensurePdfFonts, PDF_COLORS, PdfDocument } from '../../lib/export/pdf.js';

const CHART_TITLE_HEIGHT = 24;

/**
 * PDF-отчёт по странице «Аналитика»: итоги, все графики в том виде, как их видит пользователь,
 * и таблица рейтинга направлений с исходными числами.
 * container — DOM-узел страницы, в котором ищутся графики (ChartCard помечает их data-chart-title).
 */
export async function downloadAnalyticsPdf({ container, summary, totals, ranking }) {
  await ensurePdfFonts();
  const pdf = new PdfDocument({ orientation: 'portrait' });
  const today = formatDate(new Date());

  pdf.text('Аналитика ИТ Школы Ростелекома', { size: 18, weight: 700, gapAfter: 2 });
  pdf.text(`${summary} · сформировано ${today}`, { size: 9, color: PDF_COLORS.secondary, gapAfter: 12 });
  pdf.text(
    `Заявок на обучение: ${formatNumber(totals.applications)} · Обучающихся: ${formatNumber(totals.students)} · ` +
      `Параллельных потоков: ${formatNumber(totals.streams)} · Взаимодействий: ${formatNumber(totals.interactions)}`,
    { size: 11, weight: 700, gapAfter: 18 },
  );

  for (const chart of container.querySelectorAll('[data-chart-title]')) {
    const svg = chart.querySelector('svg');
    if (!svg) continue;
    const size = svg.getBoundingClientRect();
    // Заголовок не должен остаться внизу страницы отдельно от графика.
    pdf.ensureSpace(CHART_TITLE_HEIGHT + pdf.imageHeight(size));
    pdf.text(chart.dataset.chartTitle, { size: 12, weight: 700, gapAfter: 6 });
    pdf.image((await svgToImage(svg)).image, size);
  }

  if (ranking.length > 0) {
    pdf.text('Рейтинг ИТ-направлений', { size: 12, weight: 700, gapAfter: 6 });
    pdf.table({
      header: ['Направление', 'Заявок', 'Обучающихся', 'Потоков', 'Индекс'],
      body: ranking.map((item) => [item.direction.name, formatNumber(item.applications), formatNumber(item.students), item.streams, item.index]),
    });
    pdf.text('Индекс: заявки, обучающиеся и потоки делятся на максимум по выборке, три доли усредняются и умножаются на 100.', {
      size: 8,
      color: PDF_COLORS.secondary,
    });
  }

  downloadBlob(await pdf.toBlob(), safeFileName(`Аналитика ИТ Школы — ${today}`, 'pdf'));
}
