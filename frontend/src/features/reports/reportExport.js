import { formatDate } from '../../domain/format.js';
import { buildReportTable } from '../../domain/reports.js';
import { downloadBlob, safeFileName } from '../../lib/download.js';
import { ensurePdfFonts, PDF_COLORS, PdfDocument } from '../../lib/export/pdf.js';
import { createXls, createXlsx } from '../../lib/export/spreadsheet.js';

const hasVisuals = (visuals) => Boolean(visuals && (visuals.kpis.length || visuals.figures.length || visuals.tables.length));

/**
 * PDF отчёта. Если выбраны показатели и графики из «Аналитики», они идут первыми:
 * плитки KPI сеткой, графики по два в ряд (широкие — на всю строку), затем таблицы виджетов.
 * Сами данные отчёта всегда начинаются с новой страницы.
 */
async function createReportPdf(table, { title, subtitle, visuals }) {
  await ensurePdfFonts();
  const pdf = new PdfDocument({ orientation: 'landscape' });
  pdf.text(title, { size: 16, weight: 700, gapAfter: 2 });
  pdf.text(subtitle, { size: 9, color: PDF_COLORS.secondary, gapAfter: 14 });

  if (hasVisuals(visuals)) {
    if (visuals.kpis.length) {
      pdf.text('Ключевые показатели', { size: 12, weight: 700, gapAfter: 8 });
      pdf.tiles(visuals.kpis);
    }
    if (visuals.figures.length) {
      pdf.text('Графики', { size: 12, weight: 700, gapAfter: 8 });
      pdf.figures(visuals.figures);
    }
    visuals.tables.forEach((item) => {
      pdf.text(item.title, { size: 12, weight: 700, gapAfter: 6 });
      pdf.table(item.table);
    });
    pdf.addPage();
    pdf.text(`${title}: данные`, { size: 14, weight: 700, gapAfter: 10 });
  }

  pdf.table(table);
  return pdf.toBlob();
}

const WRITERS = {
  xlsx: (table) => createXlsx(table),
  xls: (table) => createXls(table),
  pdf: (table, meta) => createReportPdf(table, meta),
};

/**
 * Формирует и скачивает файл отчёта. Бросает AppError (REPORT-400 / REPORT-204), если отчёт не собрать.
 * visuals — снимки виджетов «Аналитики» (только для PDF). Возвращает число строк — для истории отчётов.
 */
export async function exportReport({ rows, columns, format, name, summary, visuals = null }) {
  const table = buildReportTable(rows, columns);
  const blob = await WRITERS[format](table, { title: name, subtitle: `${summary} · сформирован ${formatDate(new Date())}`, visuals });
  downloadBlob(blob, safeFileName(name, format));
  return table.body.length;
}
