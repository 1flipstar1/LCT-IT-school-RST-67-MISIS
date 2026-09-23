import { buildReportTable } from '../../domain/reports.js';
import { apiClient, waitForJob } from '../../api/client.js';
import { downloadBlob } from '../../lib/download.js';

/**
 * Формирует и скачивает файл отчёта. Бросает AppError (REPORT-400 / REPORT-204), если отчёт не собрать.
 * Возвращает число строк — для истории отчётов.
 */
export async function exportReport({ rows, columns, format, name, summary, filters }) {
  const table = buildReportTable(rows, columns);
  const queued = await apiClient.createReport({ name, format, summary, table, filters, columns });
  const completed = await waitForJob((jobId) => apiClient.getReport(jobId), queued, { timeoutMs: 300_000 });
  const artifact = await apiClient.downloadReport(completed.id);
  downloadBlob(artifact.blob, artifact.filename);
  return table.body.length;
}
