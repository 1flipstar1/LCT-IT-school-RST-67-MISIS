import { AppError } from './errors.js';
import { formatDate } from './format.js';

export const REPORT_FORMATS = [
  { id: 'xlsx', label: 'XLSX', description: 'Excel 2007 и новее' },
  { id: 'xls', label: 'XLS', description: 'Excel 97–2003' },
  { id: 'pdf', label: 'PDF', description: 'Для печати и отправки' },
];

/**
 * Колонки отчёта. Базовый набор различает направление, программу и продукт,
 * остальные — поля договора из каталога импорта.
 */
export const REPORT_COLUMNS = [
  { id: 'university', label: 'Наименование вуза', value: (row) => row.university.name, core: true },
  { id: 'direction', label: 'ИТ-направление', value: (row) => row.direction.name, core: true },
  { id: 'program', label: 'ИТ-программа', value: (row) => row.program.name, core: true },
  { id: 'product', label: 'ИТ-продукт', value: (row) => row.product.name, core: true },
  { id: 'stage', label: 'Статус работы с вузом', value: (row) => row.stage.name, core: true },
  { id: 'manager', label: 'Ответственный', value: (row) => row.manager?.name ?? '—', core: true },
  { id: 'vendor', label: 'Вендор', value: (row) => row.product.vendor },
  { id: 'contract', label: 'Номер договора', value: (row) => row.contract.number || '—' },
  { id: 'licenseSignedAt', label: 'Подписание лицензии', value: (row) => formatDate(row.contract.licenseSignedAt) },
  { id: 'licenseYears', label: 'Срок лицензии, лет', value: (row) => row.contract.licenseYears ?? '—' },
  { id: 'transferStatus', label: 'Статус передачи', value: (row) => row.contract.transferStatus },
  { id: 'startedAt', label: 'Дата начала', value: (row) => formatDate(row.startedAt) },
];

export const DEFAULT_REPORT_COLUMNS = REPORT_COLUMNS.filter((column) => column.core).map((column) => column.id);

/** Превращает строки взаимодействий в таблицу отчёта: заголовок + значения в порядке колонок. */
export function buildReportTable(rows, columnIds) {
  if (columnIds.length === 0) throw new AppError('REPORT-400');
  if (rows.length === 0) throw new AppError('REPORT-204');

  const columns = REPORT_COLUMNS.filter((column) => columnIds.includes(column.id));
  return {
    header: columns.map((column) => column.label),
    body: rows.map((row) => columns.map((column) => column.value(row))),
  };
}
