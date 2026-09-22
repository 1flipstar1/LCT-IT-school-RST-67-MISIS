import { TRANSFER_STATUSES } from './contract.js';
import { AppError } from './errors.js';
import { createId, toIsoDate } from './format.js';

/** Поля шаблона импорта — ровно список из ТЗ (требования к сервису, п. 1). */
export const IMPORT_FIELDS = [
  { id: 'university', label: 'Название ВУЗа', required: true, aliases: ['вуз', 'университет', 'наименование вуза'] },
  { id: 'vendor', label: 'Вендор', aliases: ['производитель'] },
  { id: 'product', label: 'ПО', required: true, aliases: ['ит-продукт', 'продукт', 'программное обеспечение'] },
  { id: 'direction', label: 'ИТ-направление', aliases: ['направление'] },
  { id: 'program', label: 'ИТ-программа', aliases: ['программа', 'учебная программа'] },
  { id: 'contract', label: 'Номер договора', aliases: ['договор', '№ договора'] },
  { id: 'licenseSignedAt', label: 'Подписание лицензии', aliases: ['дата подписания', 'лицензия подписана'] },
  { id: 'licenseYears', label: 'Срок действия лицензии (год)', aliases: ['срок лицензии', 'срок действия лицензии'] },
  { id: 'transferStatus', label: 'Статус по передаче', aliases: ['статус передачи'] },
  { id: 'manager', label: 'ФИО Менеджера', aliases: ['менеджер', 'ответственный', 'фио менеджера'] },
  { id: 'contacts', label: 'Ответственные от ВУЗа', aliases: ['контакт', 'ответственный от вуза', 'представитель вуза'] },
  { id: 'comment', label: 'Комментарий', aliases: ['примечание'] },
];

const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim();

/** Автосопоставление: колонка файла совпадает с названием поля или одним из синонимов. */
export function autoMatchColumns(headers) {
  const normalizedHeaders = headers.map(normalize);
  return Object.fromEntries(
    IMPORT_FIELDS.map((field) => {
      const candidates = [field.label, ...field.aliases].map(normalize);
      const index = normalizedHeaders.findIndex((header) => candidates.includes(header));
      return [field.id, index === -1 ? '' : String(index)];
    }),
  );
}

export function validateMapping(mapping) {
  const missing = IMPORT_FIELDS.filter((field) => field.required && mapping[field.id] === '');
  if (missing.length > 0) throw new AppError('IMPORT-422', missing.map((field) => field.label).join(', '));
}

/** Дата из Excel: серийный номер (45123), «17.09.2026» или «2026-09-17». */
export function parseExcelDate(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value === 'number') return toIsoDate(new Date(Date.UTC(1899, 11, 30) + value * 86_400_000));
  const text = String(value).trim();
  const russian = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (russian) return `${russian[3]}-${russian[2].padStart(2, '0')}-${russian[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

/**
 * План импорта — что изменится, ещё до записи в базу. Пользователь видит итог и ошибки по строкам
 * и только потом подтверждает. Функция чистая: на вход текущие данные, на выход новые массивы.
 */
export function planImport(rows, mapping, { universities, directions, programs, products, interactions, users }) {
  const [, ...dataRows] = rows;
  const cell = (row, fieldId) => (mapping[fieldId] === '' ? '' : row[Number(mapping[fieldId])] ?? '');
  const text = (row, fieldId) => String(cell(row, fieldId)).trim();

  const nextUniversities = universities.map((item) => ({ ...item, contacts: [...item.contacts] }));
  const nextProducts = [...products];
  const nextPrograms = programs.map((item) => ({ ...item, productIds: [...item.productIds] }));
  const nextInteractions = interactions.map((item) => ({ ...item }));
  const stats = { rows: 0, newUniversities: 0, newPrograms: 0, newProducts: 0, newContacts: 0, updatedContracts: 0 };
  const issues = [];

  const findByName = (items, name) => items.find((item) => normalize(item.name) === normalize(name) || normalize(item.shortName) === normalize(name));

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (row.every((value) => String(value).trim() === '')) return;
    stats.rows += 1;

    const universityName = text(row, 'university');
    const productName = text(row, 'product');
    if (!universityName || !productName) {
      issues.push({ rowNumber, level: 'error', message: 'Не заполнены «Название ВУЗа» или «ПО» — строка пропущена.' });
      return;
    }

    let university = findByName(nextUniversities, universityName);
    if (!university) {
      university = { id: createId('u'), name: universityName, shortName: universityName, city: '', contacts: [] };
      nextUniversities.push(university);
      stats.newUniversities += 1;
    }

    let product = findByName(nextProducts, productName);
    if (!product) {
      product = { id: createId('p'), name: productName, vendor: text(row, 'vendor') || 'Не указан' };
      nextProducts.push(product);
      stats.newProducts += 1;
    }

    const directionName = text(row, 'direction');
    const programName = text(row, 'program');
    const direction = directionName ? findByName(directions, directionName) : null;
    if (directionName && !direction) issues.push({ rowNumber, level: 'warning', message: `ИТ-направление «${directionName}» не найдено — программа не добавлена.` });
    let program = programName && direction ? nextPrograms.find((item) => item.directionId === direction.id && normalize(item.name) === normalize(programName)) : null;
    if (programName && direction && !program) {
      program = { id: createId('pr'), directionId: direction.id, name: programName, description: '', productIds: [product.id] };
      nextPrograms.push(program);
      stats.newPrograms += 1;
    } else if (program && !program.productIds.includes(product.id)) {
      program.productIds.push(product.id);
    }

    text(row, 'contacts')
      .split(/[;\n]/)
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((contactName) => {
        if (university.contacts.some((contact) => normalize(contact.name) === normalize(contactName))) return;
        university.contacts.push({ id: createId('c'), name: contactName, position: '', email: '', phone: '' });
        stats.newContacts += 1;
      });

    const managerName = text(row, 'manager');
    if (managerName && !users.some((user) => normalize(user.name) === normalize(managerName))) {
      issues.push({ rowNumber, level: 'warning', message: `Менеджер «${managerName}» не найден среди пользователей — ответственный не изменён.` });
    }

    const interaction = nextInteractions.find((item) => item.universityId === university.id && item.productId === product.id && (!program || item.programId === program.id));
    if (!interaction) {
      issues.push({ rowNumber, level: 'warning', message: `Нет взаимодействия «${universityName} — ${productName}». Обновлены только справочники.` });
      return;
    }

    const signedAt = parseExcelDate(cell(row, 'licenseSignedAt'));
    if (signedAt === null) issues.push({ rowNumber, level: 'warning', message: 'Дата подписания лицензии не распознана — оставлена прежняя.' });
    const years = Number(cell(row, 'licenseYears'));
    const transferStatus = text(row, 'transferStatus');

    interaction.contract = {
      number: text(row, 'contract') || interaction.contract.number,
      licenseSignedAt: signedAt || interaction.contract.licenseSignedAt,
      licenseYears: years > 0 ? years : interaction.contract.licenseYears,
      transferStatus: TRANSFER_STATUSES.includes(transferStatus) ? transferStatus : interaction.contract.transferStatus,
    };
    const manager = users.find((user) => normalize(user.name) === normalize(managerName));
    if (manager) interaction.managerId = manager.id;
    if (text(row, 'comment')) interaction.comment = text(row, 'comment');
    stats.updatedContracts += 1;
  });

  return { universities: nextUniversities, programs: nextPrograms, products: nextProducts, interactions: nextInteractions, stats, issues };
}

/** Пример файла: две строки обновят существующие договоры, одна добавит новый вуз. */
export const SAMPLE_IMPORT_ROWS = [
  IMPORT_FIELDS.map((field) => field.label),
  ['Казанский федеральный университет', 'МойОфис', 'МойОфис', 'Аналитика данных', 'Аналитик данных', 'РТК-ИТШ-2026/101', '15.08.2026', 2, 'Передано частично', 'Алина Воронова', 'Ирина Петрова', 'Лицензии на 120 рабочих мест'],
  ['Университет ИТМО', 'Postgres Professional', 'Postgres Pro', 'Backend-разработка', 'Backend-разработчик', 'РТК-ИТШ-2026/102', '02.09.2026', 3, 'Не передано', 'Михаил Орлов', 'Сергей Лавров; Анна Григорьева', ''],
  ['Пермский политехнический университет', 'Группа Астра', 'Astra Linux', 'Системное администрирование', 'Системный администратор Linux', '', '', '', 'Не передано', 'Ольга Лебедева', 'Дмитрий Пермяков', 'Новый вуз из заявки с выставки'],
];
