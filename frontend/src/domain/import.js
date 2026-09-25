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

export const IMPORT_ROW_STATUS = Object.freeze({
  updated: 'updated',
  created: 'created',
  catalog: 'catalog',
  skipped: 'skipped',
});

export const IMPORT_ROW_STATUS_LABEL = {
  updated: 'Договор обновлён',
  created: 'Создано взаимодействие',
  catalog: 'Только справочники',
  skipped: 'Пропущена',
};

const CONTRACT_FIELD_LABEL = {
  number: 'Номер договора',
  licenseSignedAt: 'Подписание лицензии',
  licenseYears: 'Срок лицензии',
  transferStatus: 'Статус передачи',
};

const isFilled = (value) => value !== '' && value !== null && value !== undefined;

/**
 * План импорта — что изменится, ещё до записи в базу. Пользователь видит итог, изменения по полям
 * и замечания по строкам и только потом подтверждает. Функция чистая: на вход текущие данные,
 * на выход новые массивы.
 *
 * options.createInteractions — для пары «вуз — продукт» без взаимодействия создать его на первом этапе;
 * options.keepFilled — не перезаписывать заполненные поля договора;
 * options.actorId — ответственный по умолчанию для новых взаимодействий; options.now — время импорта.
 */
export function planImport(rows, mapping, state, options = {}) {
  const { universities, directions, programs, products, interactions, users, workflows = [], events = [] } = state;
  const { createInteractions = false, keepFilled = false, actorId = null, now = new Date() } = options;
  const [, ...dataRows] = rows;
  const cell = (row, fieldId) => (mapping[fieldId] === '' ? '' : row[Number(mapping[fieldId])] ?? '');
  const text = (row, fieldId) => String(cell(row, fieldId)).trim();
  const at = new Date(now).toISOString();

  const nextUniversities = universities.map((item) => ({ ...item, contacts: [...item.contacts] }));
  const nextProducts = [...products];
  const nextPrograms = programs.map((item) => ({ ...item, productIds: [...item.productIds] }));
  const nextInteractions = interactions.map((item) => ({ ...item }));
  const newEvents = [];
  const stats = { rows: 0, newUniversities: 0, newPrograms: 0, newProducts: 0, newContacts: 0, updatedContracts: 0, newInteractions: 0, skipped: 0 };
  const issues = [];
  const rowResults = [];
  const changes = [];

  const findByName = (items, name) => items.find((item) => normalize(item.name) === normalize(name) || normalize(item.shortName) === normalize(name));

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (row.every((value) => String(value).trim() === '')) return;
    stats.rows += 1;
    const messages = [];
    const warn = (message) => {
      messages.push(message);
      issues.push({ rowNumber, level: 'warning', message });
    };

    const universityName = text(row, 'university');
    const productName = text(row, 'product');
    if (!universityName || !productName) {
      const message = 'Не заполнены «Название ВУЗа» или «ПО» — строка пропущена.';
      issues.push({ rowNumber, level: 'error', message });
      rowResults.push({ rowNumber, status: IMPORT_ROW_STATUS.skipped, level: 'error', university: universityName, product: productName, messages: [message] });
      stats.skipped += 1;
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
    if (directionName && !direction) warn(`ИТ-направление «${directionName}» не найдено — программа не добавлена.`);
    let program = programName && direction ? nextPrograms.find((item) => item.directionId === direction.id && normalize(item.name) === normalize(programName)) : null;
    if (programName && direction && !program) {
      program = { id: createId('pr'), directionId: direction.id, name: programName, description: '', productIds: [product.id] };
      nextPrograms.push(program);
      stats.newPrograms += 1;
    } else if (program && !program.productIds.includes(product.id)) {
      program.productIds.push(product.id);
    }

    const contactNames = text(row, 'contacts').split(/[;\n]/).map((name) => name.trim()).filter(Boolean);
    contactNames.forEach((contactName) => {
      if (university.contacts.some((contact) => normalize(contact.name) === normalize(contactName))) return;
      university.contacts.push({ id: createId('c'), name: contactName, position: '', email: '', phone: '' });
      stats.newContacts += 1;
    });

    const managerName = text(row, 'manager');
    const manager = managerName ? users.find((user) => normalize(user.name) === normalize(managerName)) : null;
    if (managerName && !manager) warn(`Менеджер «${managerName}» не найден среди пользователей — ответственный не изменён.`);

    const signedAt = parseExcelDate(cell(row, 'licenseSignedAt'));
    if (signedAt === null) warn('Дата подписания лицензии не распознана — оставлена прежняя.');
    const years = Number(cell(row, 'licenseYears'));
    const transferStatus = text(row, 'transferStatus');
    if (transferStatus && !TRANSFER_STATUSES.includes(transferStatus)) warn(`Статус передачи «${transferStatus}» не из списка: ${TRANSFER_STATUSES.join(', ')}.`);
    const incoming = {
      number: text(row, 'contract'),
      licenseSignedAt: signedAt || '',
      licenseYears: years > 0 ? years : null,
      transferStatus: TRANSFER_STATUSES.includes(transferStatus) ? transferStatus : '',
    };
    const label = `${university.shortName || university.name} · ${product.name}`;

    let interaction = nextInteractions.find((item) => item.universityId === university.id && item.productId === product.id && (!program || item.programId === program.id));
    let status = IMPORT_ROW_STATUS.updated;

    if (!interaction && createInteractions) {
      const workflow = workflows[0];
      const targetProgram = program
        ?? (direction && nextPrograms.find((item) => item.directionId === direction.id && item.productIds.includes(product.id)))
        ?? (direction && nextPrograms.find((item) => item.directionId === direction.id));
      const managerId = manager?.id ?? (users.some((user) => user.id === actorId) ? actorId : null);
      if (!workflow || !targetProgram || !managerId) {
        warn(!targetProgram ? 'Чтобы создать взаимодействие, укажите существующее ИТ-направление.' : 'Не удалось определить ответственного для нового взаимодействия.');
      } else {
        if (!targetProgram.productIds.includes(product.id)) targetProgram.productIds.push(product.id);
        interaction = {
          id: createId('i'),
          universityId: university.id,
          directionId: targetProgram.directionId,
          programId: targetProgram.id,
          productId: product.id,
          managerId,
          workflowId: workflow.id,
          stageId: workflow.stages[0].id,
          contactIds: university.contacts.filter((contact) => contactNames.some((name) => normalize(name) === normalize(contact.name))).map((contact) => contact.id),
          contract: { number: '', licenseSignedAt: '', licenseYears: null, transferStatus: TRANSFER_STATUSES[0] },
          comment: '',
          source: 'import',
          startedAt: at,
          stageEnteredAt: at,
          updatedAt: at,
          completedAt: null,
        };
        nextInteractions.push(interaction);
        newEvents.push({ id: createId('ev'), interactionId: interaction.id, type: 'created', userId: actorId ?? managerId, at, toStageId: interaction.stageId, comment: 'Создано импортом из файла' });
        stats.newInteractions += 1;
        status = IMPORT_ROW_STATUS.created;
      }
    }

    if (!interaction) {
      if (!createInteractions) warn(`Нет взаимодействия «${universityName} — ${productName}». Обновлены только справочники.`);
      rowResults.push({ rowNumber, status: IMPORT_ROW_STATUS.catalog, level: 'warning', university: university.name, product: product.name, messages });
      return;
    }

    const contract = { ...interaction.contract };
    Object.keys(CONTRACT_FIELD_LABEL).forEach((field) => {
      if (!isFilled(incoming[field]) || incoming[field] === contract[field]) return;
      if (keepFilled && isFilled(contract[field])) return;
      if (status === IMPORT_ROW_STATUS.updated) changes.push({ rowNumber, label, field: CONTRACT_FIELD_LABEL[field], before: contract[field], after: incoming[field] });
      contract[field] = incoming[field];
    });
    interaction.contract = contract;
    if (manager && manager.id !== interaction.managerId) {
      if (status === IMPORT_ROW_STATUS.updated) changes.push({ rowNumber, label, field: 'Ответственный', before: users.find((user) => user.id === interaction.managerId)?.name ?? '', after: manager.name });
      interaction.managerId = manager.id;
    }
    const comment = text(row, 'comment');
    if (comment && comment !== interaction.comment && !(keepFilled && interaction.comment)) {
      if (status === IMPORT_ROW_STATUS.updated) changes.push({ rowNumber, label, field: 'Комментарий', before: interaction.comment, after: comment });
      interaction.comment = comment;
    }
    if (status === IMPORT_ROW_STATUS.updated) stats.updatedContracts += 1;
    rowResults.push({ rowNumber, status, level: messages.length ? 'warning' : 'ok', university: university.name, product: product.name, messages });
  });

  return {
    universities: nextUniversities,
    programs: nextPrograms,
    products: nextProducts,
    interactions: nextInteractions,
    events: newEvents.length ? [...events, ...newEvents] : null,
    stats,
    issues,
    rowResults,
    changes,
  };
}

/** Подпись заголовков файла — по ней мастер вспоминает сопоставление колонок из прошлого импорта. */
export const headerSignature = (headers) => headers.map(normalize).join('|');

/** Пример файла: две строки обновят существующие договоры, одна добавит новый вуз. */
export const SAMPLE_IMPORT_ROWS = [
  IMPORT_FIELDS.map((field) => field.label),
  ['Казанский федеральный университет', 'МойОфис', 'МойОфис', 'Аналитика данных', 'Аналитик данных', 'РТК-ИТШ-2026/101', '15.08.2026', 2, 'Передано частично', 'Алина Воронова', 'Ирина Петрова', 'Лицензии на 120 рабочих мест'],
  ['Университет ИТМО', 'Postgres Professional', 'Postgres Pro', 'Backend-разработка', 'Backend-разработчик', 'РТК-ИТШ-2026/102', '02.09.2026', 3, 'Не передано', 'Михаил Орлов', 'Сергей Лавров; Анна Григорьева', ''],
  ['Пермский политехнический университет', 'Группа Астра', 'Astra Linux', 'Системное администрирование', 'Системный администратор Linux', '', '', '', 'Не передано', 'Ольга Лебедева', 'Дмитрий Пермяков', 'Новый вуз из заявки с выставки'],
];
