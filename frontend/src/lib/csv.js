/**
 * Чтение CSV без библиотек. Excel в русской локали сохраняет CSV через «;» и в Windows-1251,
 * другие программы — через «,» и в UTF-8: разделитель и кодировка определяются автоматически.
 */

/** Разделитель — тот из «;», «,» и табуляции, которого больше всего в первой строке вне кавычек. */
export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, '');
  return [';', ',', '\t'].reduce((best, candidate) => (firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best), ';');
}

/** Строки CSV → массив строк с ячейками. Поддерживает кавычки, "" внутри кавычек и переносы в ячейке. */
export function parseCsv(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(value.trim());
      value = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (value !== '' || row.length) {
    row.push(value.trim());
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell !== ''));
}

/** Текст файла: UTF-8, а если в нём «битые» символы — Windows-1251. */
export async function readTextFile(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '');
  return utf8.includes('�') ? new TextDecoder('windows-1251').decode(buffer) : utf8;
}
