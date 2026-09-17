import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../src/domain/errors.js';
import { countActiveFilters, EMPTY_FILTERS, filterInteractionRows } from '../src/domain/filters.js';
import { addDays } from '../src/domain/format.js';
import { buildReportTable, DEFAULT_REPORT_COLUMNS } from '../src/domain/reports.js';
import { SLA_STATE } from '../src/domain/workflow.js';

const now = new Date('2026-09-17T12:00:00');

const row = (overrides) => ({
  id: 'i1',
  universityId: 'u1',
  directionId: 'd1',
  productId: 'p1',
  managerId: 'usr-1',
  stageId: 'st-contacts',
  startedAt: addDays(now, -10).toISOString(),
  completedAt: null,
  sla: { state: SLA_STATE.ok },
  searchText: 'казанский федеральный университет devops',
  university: { name: 'Казанский федеральный университет' },
  direction: { name: 'DevOps' },
  product: { name: 'Astra Linux', vendor: 'Группа Астра' },
  stage: { name: 'Поиск контактов в вузе' },
  manager: { name: 'Алина Воронова' },
  contract: { number: '', licenseSignedAt: '', licenseYears: null, transferStatus: 'Не передано' },
  ...overrides,
});

describe('filterInteractionRows', () => {
  const rows = [
    row({ id: 'recent' }),
    row({ id: 'old', startedAt: addDays(now, -400).toISOString(), completedAt: addDays(now, -200).toISOString(), directionId: 'd2' }),
    row({ id: 'overdue', sla: { state: SLA_STATE.overdue }, searchText: 'итмо backend' }),
  ];
  const ids = (filters) => filterInteractionRows(rows, { ...EMPTY_FILTERS, ...filters }, now).map((item) => item.id);

  it('без фильтров возвращает всё', () => {
    assert.deepEqual(ids({}), ['recent', 'old', 'overdue']);
  });

  it('период отсекает взаимодействия, завершённые до его начала', () => {
    assert.deepEqual(ids({ period: { preset: '90d', from: '', to: '' } }), ['recent', 'overdue']);
  });

  it('фильтрует по направлению, срочности и поиску', () => {
    assert.deepEqual(ids({ directionIds: ['d2'] }), ['old']);
    assert.deepEqual(ids({ onlyAttention: true }), ['overdue']);
    assert.deepEqual(ids({ query: 'ИТМО' }), ['overdue']);
  });

  it('считает активные фильтры', () => {
    assert.equal(countActiveFilters({ ...EMPTY_FILTERS, universityIds: ['u1', 'u2'], onlyAttention: true }), 3);
  });
});

describe('buildReportTable', () => {
  it('строит таблицу со стандартными колонками из ТЗ', () => {
    const table = buildReportTable([row({})], DEFAULT_REPORT_COLUMNS);
    assert.deepEqual(table.header, ['Наименование вуза', 'ИТ-направление', 'ИТ-продукт', 'Статус работы с вузом', 'Ответственный']);
    assert.deepEqual(table.body[0], ['Казанский федеральный университет', 'DevOps', 'Astra Linux', 'Поиск контактов в вузе', 'Алина Воронова']);
  });

  it('без колонок — REPORT-400, без строк — REPORT-204', () => {
    assert.throws(() => buildReportTable([row({})], []), (error) => error instanceof AppError && error.code === 'REPORT-400');
    assert.throws(() => buildReportTable([], DEFAULT_REPORT_COLUMNS), (error) => error.code === 'REPORT-204');
  });
});
