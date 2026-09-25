import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSeedState } from '../src/data/seed.js';
import { autoMatchColumns, headerSignature, IMPORT_ROW_STATUS, planImport, SAMPLE_IMPORT_ROWS } from '../src/domain/import.js';
import { detectDelimiter, parseCsv } from '../src/lib/csv.js';

const state = createSeedState(new Date('2026-09-17T12:00:00'));
const mapping = autoMatchColumns(SAMPLE_IMPORT_ROWS[0]);

describe('parseCsv', () => {
  it('определяет разделитель и понимает кавычки и переносы в ячейке', () => {
    assert.equal(detectDelimiter('Вуз;ПО;Комментарий\nКФУ;МойОфис;x'), ';');
    assert.equal(detectDelimiter('Вуз,ПО\nКФУ,МойОфис'), ',');
    const rows = parseCsv('Вуз;Комментарий\r\n"КФУ";"Сказали ""да""; ждём\nдоговор"\r\n\r\nИТМО;\n');
    assert.deepEqual(rows, [['Вуз', 'Комментарий'], ['КФУ', 'Сказали "да"; ждём\nдоговор'], ['ИТМО', '']]);
  });
});

describe('planImport: режимы и отчёт по строкам', () => {
  it('по умолчанию без взаимодействия обновляются только справочники', () => {
    const plan = planImport(SAMPLE_IMPORT_ROWS, mapping, state);
    const newUniversity = plan.rowResults.find((row) => row.rowNumber === 4);
    assert.equal(newUniversity.status, IMPORT_ROW_STATUS.catalog);
    assert.equal(plan.events, null);
    assert.ok(plan.changes.some((change) => change.field === 'Номер договора' && change.after === 'РТК-ИТШ-2026/101'));
  });

  it('createInteractions создаёт взаимодействие на первом этапе с событием', () => {
    const plan = planImport(SAMPLE_IMPORT_ROWS, mapping, state, { createInteractions: true, actorId: 'usr-6' });
    assert.equal(plan.stats.newInteractions, 1);
    const created = plan.interactions.find((item) => item.source === 'import');
    assert.equal(created.stageId, state.workflows[0].stages[0].id);
    assert.equal(created.managerId, 'usr-5', 'менеджер из файла, а не тот, кто загружает');
    const program = plan.programs.find((item) => item.id === created.programId);
    assert.equal(program.directionId, created.directionId);
    assert.ok(program.productIds.includes(created.productId));
    assert.equal(plan.events.at(-1).interactionId, created.id);
  });

  it('keepFilled не перезаписывает заполненные поля договора', () => {
    const filled = { ...state, interactions: state.interactions.map((item) => (item.id === 'i1' ? { ...item, contract: { ...item.contract, number: 'СТАРЫЙ-1' } } : item)) };
    const plan = planImport(SAMPLE_IMPORT_ROWS, mapping, filled, { keepFilled: true });
    assert.equal(plan.interactions.find((item) => item.id === 'i1').contract.number, 'СТАРЫЙ-1');
    assert.ok(!plan.changes.some((change) => change.field === 'Номер договора' && change.before === 'СТАРЫЙ-1'));
  });

  it('строка без обязательных полей пропускается и считается', () => {
    const rows = [...SAMPLE_IMPORT_ROWS, ['', 'Вендор', '', '', '', '', '', '', '', '', '', '']];
    const plan = planImport(rows, mapping, state);
    assert.equal(plan.stats.skipped, 1);
    assert.equal(plan.rowResults.at(-1).level, 'error');
  });

  it('подпись заголовков не зависит от регистра и ё', () => {
    assert.equal(headerSignature(['Название ВУЗа', 'Счёт']), headerSignature(['название вуза', 'счет']));
  });
});
