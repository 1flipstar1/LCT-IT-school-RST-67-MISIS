import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { parseExcelDate } from '../src/domain/import.js';
import { parseXls } from '../src/lib/xlsx/readXls.js';

const fixture = (name) => {
  const bytes = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

describe('чтение XLS (Excel 97–2003, BIFF8)', () => {
  // Фикстуры создаёт настоящий писатель BIFF8 (xlwt): tests/fixtures/make-import-biff8.py.
  const rows = parseXls(fixture('import-biff8.xls'));

  it('читает первый лист с заголовками шаблона импорта и кириллицей', () => {
    assert.equal(rows[0][0], 'Название ВУЗа');
    assert.equal(rows[0][9], 'Комментарий');
    assert.deepEqual(rows[1].slice(0, 4), ['Казанский федеральный университет', 'МойОфис', 'МойОфис Стандартный', 'Д-2026/17']);
    assert.equal(rows[1][7], 'Алина Воронова');
  });

  it('числа, дробные RK и даты Excel', () => {
    assert.equal(parseExcelDate(rows[1][4]), '2026-09-17');
    assert.equal(rows[1][5], 3);
    assert.equal(rows[2][5], 2.5);
    assert.equal(rows[2][3], 123456789);
    assert.equal(rows[2][1], '', 'пустые ячейки — пустые строки, как в readXlsx');
  });

  it('длинные строки и таблица строк через записи CONTINUE', () => {
    assert.equal(rows[1][9], `Длинный комментарий ${'ё'.repeat(300)}`);
    assert.equal(rows.length, 403);
    assert.equal(rows[402][0], `Вуз № 402 — уникальная строка для SST ${'x'.repeat(402 % 50)}`);
    assert.equal(rows[402][5], 402);
  });

  it('маленькая книга из мини-потока контейнера', () => {
    assert.deepEqual(parseXls(fixture('import-biff8-small.xls')), [['Название ВУЗа'], ['НИУ ВШЭ', 42]]);
  });

  it('не принимает посторонний файл', () => {
    assert.throws(() => parseXls(new TextEncoder().encode('просто текст').buffer), /не похож на книгу Excel/);
  });
});
