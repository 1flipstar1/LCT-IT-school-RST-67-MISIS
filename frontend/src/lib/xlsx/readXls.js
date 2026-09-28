import { AppError } from '../../domain/errors.js';

/**
 * Чтение первого листа XLS (Excel 97–2003) прямо в браузере — без библиотек.
 *
 * «.xls» на практике бывает трёх видов, различаем по первым байтам:
 *  • BIFF8 в контейнере Compound File (OLE2) — настоящий файл Excel 97–2003;
 *  • XML Spreadsheet 2003 — так сохраняют выгрузки многие системы (и наши отчёты XLS);
 *  • HTML-таблица с расширением .xls — выгрузки старых веб-систем.
 * Возвращает то же, что readXlsx: массив строк, каждая строка — массив значений ячеек.
 */
export async function readXls(file) {
  try {
    return parseXls(await file.arrayBuffer());
  } catch (error) {
    throw new AppError('IMPORT-400', error.message);
  }
}

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function parseXls(buffer) {
  const bytes = new Uint8Array(buffer);
  if (CFB_SIGNATURE.every((byte, index) => bytes[index] === byte)) return parseBiff(readWorkbookStream(bytes));
  const text = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4096))).toLowerCase();
  const markup = () => new DOMParser().parseFromString(new TextDecoder().decode(bytes), text.includes('<workbook') ? 'application/xml' : 'text/html');
  if (text.includes('urn:schemas-microsoft-com:office:spreadsheet')) return parseSpreadsheetMl(markup());
  if (text.includes('<table')) return parseHtmlTable(markup());
  throw new Error('Файл не похож на книгу Excel 97–2003');
}

/* ---------- Compound File Binary (MS-CFB): достаём поток «Workbook» ---------- */

const END_OF_CHAIN = 0xfffffffe;

function readWorkbookStream(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorSize = 1 << view.getUint16(0x1e, true);
  const miniSectorSize = 1 << view.getUint16(0x20, true);
  const miniCutoff = view.getUint32(0x38, true);
  const sectorOffset = (sector) => (sector + 1) * sectorSize;

  // Таблица FAT: номера её секторов — первые 109 в заголовке, остальные в цепочке DIFAT.
  const fatSectors = [];
  for (let index = 0; index < 109; index += 1) {
    const sector = view.getUint32(0x4c + index * 4, true);
    if (sector < END_OF_CHAIN) fatSectors.push(sector);
  }
  for (let sector = view.getUint32(0x44, true), left = view.getUint32(0x48, true); left > 0 && sector < END_OF_CHAIN; left -= 1) {
    const perSector = sectorSize / 4 - 1;
    for (let index = 0; index < perSector; index += 1) {
      const entry = view.getUint32(sectorOffset(sector) + index * 4, true);
      if (entry < END_OF_CHAIN) fatSectors.push(entry);
    }
    sector = view.getUint32(sectorOffset(sector) + perSector * 4, true);
  }
  const fat = new Uint32Array(fatSectors.length * (sectorSize / 4));
  fatSectors.forEach((sector, index) => {
    for (let item = 0; item < sectorSize / 4; item += 1) fat[index * (sectorSize / 4) + item] = view.getUint32(sectorOffset(sector) + item * 4, true);
  });

  const readChain = (start, table, unit, read) => {
    const parts = [];
    const seen = new Set();
    for (let sector = start; sector < END_OF_CHAIN; sector = table[sector]) {
      if (seen.has(sector) || sector >= table.length) throw new Error('Файл XLS повреждён');
      seen.add(sector);
      parts.push(read(sector, unit));
    }
    const out = new Uint8Array(parts.length * unit);
    parts.forEach((part, index) => out.set(part, index * unit));
    return out;
  };
  const readSector = (sector, unit) => bytes.subarray(sectorOffset(sector), sectorOffset(sector) + unit);

  const directory = readChain(view.getUint32(0x30, true), fat, sectorSize, readSector);
  const directoryView = new DataView(directory.buffer);
  const entries = [];
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const nameLength = directoryView.getUint16(offset + 0x40, true);
    const name = new TextDecoder('utf-16le').decode(directory.subarray(offset, offset + Math.max(0, nameLength - 2)));
    entries.push({ name, type: directory[offset + 0x42], start: directoryView.getUint32(offset + 0x74, true), size: directoryView.getUint32(offset + 0x78, true) });
  }
  const workbook = entries.find((entry) => entry.type === 2 && /^(workbook|book)$/i.test(entry.name));
  if (!workbook) throw new Error('В файле нет книги Excel');

  if (workbook.size >= miniCutoff) return readChain(workbook.start, fat, sectorSize, readSector).subarray(0, workbook.size);

  // Маленькие потоки лежат в «мини-потоке» корневой записи и адресуются своей таблицей MiniFAT.
  const root = entries.find((entry) => entry.type === 5);
  const miniStream = readChain(root.start, fat, sectorSize, readSector);
  const miniFatBytes = readChain(view.getUint32(0x3c, true), fat, sectorSize, readSector);
  const miniFat = new Uint32Array(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.length / 4);
  return readChain(workbook.start, miniFat, miniSectorSize, (sector, unit) => miniStream.subarray(sector * unit, (sector + 1) * unit)).subarray(0, workbook.size);
}

/* ---------- BIFF8: записи книги (MS-XLS) ---------- */

const RECORD = {
  BOF: 0x0809, EOF: 0x000a, FILEPASS: 0x002f, BOUNDSHEET: 0x0085, SST: 0x00fc, CONTINUE: 0x003c,
  LABELSST: 0x00fd, LABEL: 0x0204, NUMBER: 0x0203, RK: 0x027e, MULRK: 0x00bd, FORMULA: 0x0006, STRING: 0x0207, BOOLERR: 0x0205,
};

function readRecords(stream) {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const records = [];
  for (let offset = 0; offset + 4 <= stream.length;) {
    const type = view.getUint16(offset, true);
    const length = view.getUint16(offset + 2, true);
    records.push({ type, offset, data: stream.subarray(offset + 4, offset + 4 + length) });
    offset += 4 + length;
  }
  return records;
}

function parseBiff(stream) {
  const records = readRecords(stream);
  if (records.some((record) => record.type === RECORD.FILEPASS)) throw new Error('Файл защищён паролем — сохраните его без пароля');

  const sheets = records
    .filter((record) => record.type === RECORD.BOUNDSHEET)
    .map((record) => ({ offset: dataView(record.data).getUint32(0, true), kind: record.data[5] }));
  const firstSheet = sheets.find((sheet) => sheet.kind === 0);
  if (!firstSheet) throw new Error('В книге нет листов с данными');

  const sstIndex = records.findIndex((record) => record.type === RECORD.SST);
  const sharedStrings = sstIndex < 0 ? [] : readSharedStrings(records, sstIndex);

  const cells = new Map();
  const put = (row, column, value) => {
    if (!cells.has(row)) cells.set(row, []);
    cells.get(row)[column] = value;
  };
  let index = records.findIndex((record) => record.offset === firstSheet.offset);
  if (index < 0) throw new Error('Файл XLS повреждён');
  for (index += 1; index < records.length && records[index].type !== RECORD.EOF; index += 1) {
    const { type, data } = records[index];
    const view = dataView(data);
    const row = () => view.getUint16(0, true);
    const column = () => view.getUint16(2, true);
    if (type === RECORD.LABELSST) put(row(), column(), sharedStrings[view.getUint32(6, true)] ?? '');
    else if (type === RECORD.NUMBER) put(row(), column(), view.getFloat64(6, true));
    else if (type === RECORD.RK) put(row(), column(), decodeRk(view.getUint32(6, true)));
    else if (type === RECORD.LABEL) put(row(), column(), readUnicodeString(data, 6, 2).value);
    else if (type === RECORD.BOOLERR) put(row(), column(), data[7] === 0 ? Boolean(data[6]) : '');
    else if (type === RECORD.MULRK) {
      const last = view.getUint16(data.length - 2, true);
      for (let col = column(), offset = 4; col <= last; col += 1, offset += 6) put(row(), col, decodeRk(view.getUint32(offset + 2, true)));
    } else if (type === RECORD.FORMULA) {
      // Результат формулы: число или признак «строка в следующей записи STRING».
      const isSpecial = view.getUint16(12, true) === 0xffff;
      if (!isSpecial) put(row(), column(), view.getFloat64(6, true));
      else if (data[6] === 0 && records[index + 1]?.type === RECORD.STRING) put(row(), column(), readUnicodeString(records[index + 1].data, 0, 2).value);
      else if (data[6] === 1) put(row(), column(), Boolean(data[8]));
    }
  }

  return [...cells.keys()].sort((a, b) => a - b).map((row) => Array.from(cells.get(row), (value) => value ?? ''));
}

const dataView = (data) => new DataView(data.buffer, data.byteOffset, data.byteLength);

/** RK — компактное число: 30-битное целое или старшие биты double, возможно делённое на 100. */
function decodeRk(rk) {
  let value;
  if (rk & 2) value = rk >> 2;
  else {
    const view = new DataView(new ArrayBuffer(8));
    view.setUint32(4, rk & 0xfffffffc, true);
    value = view.getFloat64(0, true);
  }
  return rk & 1 ? value / 100 : value;
}

/** Строка BIFF8: длина, флаги (1 — UTF-16, 8 — rich text, 4 — азиатская фонетика), символы. */
function readUnicodeString(data, offset, lengthBytes) {
  const view = dataView(data);
  const length = lengthBytes === 2 ? view.getUint16(offset, true) : data[offset];
  const flags = data[offset + lengthBytes];
  let cursor = offset + lengthBytes + 1;
  const runs = flags & 8 ? view.getUint16(cursor, true) : 0;
  if (flags & 8) cursor += 2;
  const phonetic = flags & 4 ? view.getUint32(cursor, true) : 0;
  if (flags & 4) cursor += 4;
  const wide = flags & 1;
  const value = decodeChars(data.subarray(cursor, cursor + length * (wide ? 2 : 1)), wide);
  return { value, end: cursor + length * (wide ? 2 : 1) + runs * 4 + phonetic };
}

const decodeChars = (bytes, wide) => (wide ? new TextDecoder('utf-16le').decode(bytes) : String.fromCharCode(...bytes));

/**
 * Таблица общих строк (SST). Она длиннее одной записи и продолжается в записях CONTINUE; строка может
 * разорваться на границе, и тогда продолжение начинается с нового байта флагов (кодировка может смениться).
 */
function readSharedStrings(records, sstIndex) {
  const chunks = [records[sstIndex].data];
  for (let index = sstIndex + 1; records[index]?.type === RECORD.CONTINUE; index += 1) chunks.push(records[index].data);

  let chunk = 0;
  let position = 8; // Всего строк и уникальных строк — по 4 байта.
  const total = dataView(chunks[0]).getUint32(4, true);
  const ensure = () => {
    while (chunks[chunk] && position >= chunks[chunk].length) {
      chunk += 1;
      position = 0;
    }
  };
  const readBytes = (count) => {
    const out = new Uint8Array(count);
    for (let filled = 0; filled < count;) {
      ensure();
      const take = Math.min(count - filled, chunks[chunk].length - position);
      out.set(chunks[chunk].subarray(position, position + take), filled);
      filled += take;
      position += take;
    }
    return out;
  };
  const u16 = () => dataView(readBytes(2)).getUint16(0, true);
  const u32 = () => dataView(readBytes(4)).getUint32(0, true);

  const strings = [];
  for (let item = 0; item < total && chunks[chunk]; item += 1) {
    ensure();
    const length = u16();
    const flags = readBytes(1)[0];
    const runs = flags & 8 ? u16() : 0;
    const phonetic = flags & 4 ? u32() : 0;
    let wide = flags & 1;
    let text = '';
    for (let left = length; left > 0;) {
      if (position >= chunks[chunk].length) {
        chunk += 1;
        position = 0;
        wide = readBytes(1)[0] & 1; // Продолжение строки в новой записи CONTINUE.
      }
      const available = Math.floor((chunks[chunk].length - position) / (wide ? 2 : 1));
      const take = Math.min(left, available);
      text += decodeChars(readBytes(take * (wide ? 2 : 1)), wide);
      left -= take;
    }
    readBytes(runs * 4 + phonetic); // Форматирование и фонетика не нужны.
    strings.push(text);
  }
  return strings;
}

/* ---------- XML Spreadsheet 2003 и HTML ---------- */

function parseSpreadsheetMl(document) {
  const table = document.getElementsByTagNameNS('*', 'Table')[0];
  if (!table) return [];
  const rows = [];
  [...table.getElementsByTagNameNS('*', 'Row')].forEach((rowNode) => {
    const explicit = Number(rowNode.getAttribute('ss:Index') || rowNode.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Index'));
    const rowIndex = explicit ? explicit - 1 : rows.length;
    const values = [];
    let column = 0;
    [...rowNode.getElementsByTagNameNS('*', 'Cell')].forEach((cell) => {
      const index = Number(cell.getAttribute('ss:Index') || cell.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Index'));
      if (index) column = index - 1;
      const data = cell.getElementsByTagNameNS('*', 'Data')[0];
      const type = data?.getAttribute('ss:Type') || data?.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Type');
      const text = data?.textContent ?? '';
      values[column] = type === 'Number' && text !== '' ? Number(text) : text;
      column += 1;
    });
    rows[rowIndex] = Array.from(values, (value) => value ?? '');
  });
  return rows.filter(Boolean);
}

function parseHtmlTable(document) {
  const table = document.querySelector('table');
  if (!table) return [];
  return [...table.rows].map((row) => [...row.cells].map((cell) => cell.textContent.trim()));
}
