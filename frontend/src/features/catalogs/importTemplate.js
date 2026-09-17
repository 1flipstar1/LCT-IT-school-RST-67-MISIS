import { SAMPLE_IMPORT_ROWS } from '../../domain/import.js';
import { downloadBlob } from '../../lib/download.js';
import { createXlsx } from '../../lib/export/spreadsheet.js';

/** Шаблон импорта с колонками из ТЗ и тремя строками-примерами. */
export function downloadImportTemplate() {
  const [header, ...body] = SAMPLE_IMPORT_ROWS;
  downloadBlob(createXlsx({ header, body }, 'Импорт'), 'Шаблон импорта ИТ Школы.xlsx');
}
