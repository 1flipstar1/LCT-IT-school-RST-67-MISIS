import { AppError } from '../../domain/errors.js';

/**
 * Чтение первого листа XLSX прямо в браузере — без библиотек.
 * XLSX — это zip-архив с XML: читаем центральный каталог, распаковываем нужные файлы
 * встроенным DecompressionStream('deflate-raw') и разбираем XML через DOMParser.
 * Возвращает массив строк, каждая строка — массив значений ячеек.
 */
export async function readXlsx(file) {
  try {
    const archive = await readZip(await file.arrayBuffer());
    const sharedStrings = archive.has('xl/sharedStrings.xml') ? parseSharedStrings(await archive.text('xl/sharedStrings.xml')) : [];
    const sheetPath = await findFirstSheetPath(archive);
    return parseSheet(await archive.text(sheetPath), sharedStrings);
  } catch (error) {
    throw new AppError('IMPORT-400', error.message);
  }
}

async function readZip(buffer) {
  const view = new DataView(buffer);
  let endOffset = buffer.byteLength - 22;
  while (endOffset >= 0 && view.getUint32(endOffset, true) !== 0x06054b50) endOffset -= 1;
  if (endOffset < 0) throw new Error('Файл не является архивом XLSX');

  const entryCount = view.getUint16(endOffset + 10, true);
  let cursor = view.getUint32(endOffset + 16, true);
  const entries = new Map();
  const decoder = new TextDecoder();

  for (let index = 0; index < entryCount; index += 1) {
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const name = decoder.decode(new Uint8Array(buffer, cursor + 46, nameLength));
    entries.set(name, {
      method: view.getUint16(cursor + 10, true),
      compressedSize: view.getUint32(cursor + 20, true),
      localOffset: view.getUint32(cursor + 42, true),
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  const readBytes = async ({ method, compressedSize, localOffset }) => {
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const bytes = new Uint8Array(buffer, dataStart, compressedSize);
    if (method === 0) return bytes;
    if (method !== 8) throw new Error(`Неподдерживаемый метод сжатия: ${method}`);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };

  return {
    has: (name) => entries.has(name),
    text: async (name) => {
      const entry = entries.get(name);
      if (!entry) throw new Error(`В архиве нет ${name}`);
      return decoder.decode(await readBytes(entry));
    },
  };
}

const parseXml = (text) => new DOMParser().parseFromString(text, 'application/xml');

function parseSharedStrings(xml) {
  return [...parseXml(xml).getElementsByTagName('si')].map((item) =>
    [...item.getElementsByTagName('t')].map((node) => node.textContent).join(''),
  );
}

async function findFirstSheetPath(archive) {
  const workbook = parseXml(await archive.text('xl/workbook.xml'));
  const firstSheet = workbook.getElementsByTagName('sheet')[0];
  const relationId = firstSheet?.getAttribute('r:id');
  const relations = parseXml(await archive.text('xl/_rels/workbook.xml.rels'));
  const target = [...relations.getElementsByTagName('Relationship')].find((node) => node.getAttribute('Id') === relationId)?.getAttribute('Target');
  if (!target) return 'xl/worksheets/sheet1.xml';
  return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
}

const columnIndex = (reference) => {
  const letters = reference.replace(/\d+/g, '');
  return [...letters].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
};

function parseSheet(xml, sharedStrings) {
  return [...parseXml(xml).getElementsByTagName('row')].map((row) => {
    const values = [];
    [...row.getElementsByTagName('c')].forEach((cell) => {
      const type = cell.getAttribute('t');
      const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
      let value;
      if (type === 's') value = sharedStrings[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = [...cell.getElementsByTagName('t')].map((node) => node.textContent).join('');
      else if (type === 'str' || type === 'b') value = raw;
      else value = raw === '' ? '' : Number(raw);
      values[columnIndex(cell.getAttribute('r'))] = value;
    });
    return Array.from(values, (value) => value ?? '');
  });
}
