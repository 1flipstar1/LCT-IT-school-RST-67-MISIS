import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSeedState } from '../src/data/seed.js';
import { rankDirections } from '../src/domain/analytics.js';
import { autoMatchColumns, IMPORT_FIELDS, parseExcelDate, planImport, SAMPLE_IMPORT_ROWS, validateMapping } from '../src/domain/import.js';

describe('rankDirections', () => {
  const directions = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'empty', name: 'Без данных' },
  ];
  const metrics = [
    { directionId: 'a', applications: 100, students: 50, streams: 2 },
    { directionId: 'b', applications: 50, students: 50, streams: 4 },
  ];

  it('индекс — среднее долей от максимума, направления без данных не попадают в рейтинг', () => {
    const ranking = rankDirections(metrics, directions);
    assert.deepEqual(
      ranking.map((item) => [item.direction.id, item.index]),
      [
        ['a', 83], // (1 + 1 + 0.5) / 3
        ['b', 83], // (0.5 + 1 + 1) / 3
      ],
    );
  });
});

describe('import', () => {
  it('parseExcelDate понимает серийный номер Excel и русский формат', () => {
    assert.equal(parseExcelDate(45000), '2023-03-15');
    assert.equal(parseExcelDate('5.9.2026'), '2026-09-05');
    assert.equal(parseExcelDate('2026-09-05'), '2026-09-05');
    assert.equal(parseExcelDate('когда-нибудь'), null);
    assert.equal(parseExcelDate(''), '');
  });

  it('autoMatchColumns сопоставляет колонки по названиям и синонимам', () => {
    const mapping = autoMatchColumns(['Комментарий', 'вуз', 'Продукт']);
    assert.equal(mapping.university, '1');
    assert.equal(mapping.product, '2');
    assert.equal(mapping.comment, '0');
    assert.equal(mapping.vendor, '');
  });

  it('validateMapping требует обязательные поля', () => {
    assert.throws(() => validateMapping({ university: '0', product: '' }), (error) => error.code === 'IMPORT-422');
  });

  it('planImport по примеру: два договора обновлены, один новый вуз', () => {
    const state = createSeedState(new Date('2026-09-17T12:00:00'));
    const mapping = autoMatchColumns(SAMPLE_IMPORT_ROWS[0]);
    assert.equal(Object.keys(mapping).length, IMPORT_FIELDS.length);

    const plan = planImport(SAMPLE_IMPORT_ROWS, mapping, state);
    assert.equal(plan.stats.rows, 3);
    assert.equal(plan.stats.updatedContracts, 2);
    assert.equal(plan.stats.newUniversities, 1);

    const kfu = plan.interactions.find((item) => item.id === 'i1');
    assert.equal(kfu.contract.number, 'РТК-ИТШ-2026/101');
    assert.equal(kfu.contract.licenseSignedAt, '2026-08-15');
    // Исходные данные не мутируются — план можно отменить.
    assert.notEqual(state.interactions.find((item) => item.id === 'i1').contract.number, 'РТК-ИТШ-2026/101');
  });
});
