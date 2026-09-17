import { formatDate } from '../../domain/format.js';
import { buildReportTable } from '../../domain/reports.js';
import { downloadBlob, safeFileName } from '../../lib/download.js';
import { ensurePdfFonts, PdfDocument } from '../../lib/export/pdf.js';
import { createXls, createXlsx } from '../../lib/export/spreadsheet.js';

async function createReportPdf(table, { title, subtitle }) {
  await ensurePdfFonts();
  const pdf = new PdfDocument({ orientation: 'landscape' });
  pdf.text(title, { size: 16, weight: 700, gapAfter: 2 });
  pdf.text(subtitle, { size: 9, color: '#56565f', gapAfter: 14 });
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
 * Возвращает число строк — для истории отчётов.
 */
export async function exportReport({ rows, columns, format, name, summary }) {
  const table = buildReportTable(rows, columns);
  const blob = await WRITERS[format](table, { title: name, subtitle: `${summary} · сформирован ${formatDate(new Date())}` });
  downloadBlob(blob, safeFileName(name, format));
  return table.body.length;
}
