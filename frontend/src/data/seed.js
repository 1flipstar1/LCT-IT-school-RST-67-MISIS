import { TRANSFER_STATUSES } from '../domain/contract.js';
import { addDays, toIsoDate } from '../domain/format.js';
import { DIRECTIONS, PRODUCTS, PROGRAMS, UNIVERSITIES, USERS } from './catalogs.js';
import { BASE_WORKFLOW } from './workflows.js';

/**
 * Демо-данные строятся детерминированно относительно текущей даты,
 * поэтому сроки, «просрочено» и графики выглядят живыми в любой день показа.
 */

// [id, вуз, направление, продукт, менеджер, № этапа (1…14), дней с начала, дней на текущем этапе, завершено дней назад]
const INTERACTIONS_TABLE = [
  ['i1', 'u1', 'd3', 'p3', 'usr-1', 6, 60, 9],
  ['i2', 'u2', 'd5', 'p5', 'usr-2', 3, 20, 4],
  ['i3', 'u3', 'd1', 'p2', 'usr-3', 4, 34, 12],
  ['i4', 'u4', 'd4', 'p6', 'usr-1', 3, 25, 16],
  ['i5', 'u5', 'd7', 'p7', 'usr-2', 5, 40, 3],
  ['i6', 'u6', 'd3', 'p7', 'usr-3', 8, 120, 18],
  ['i7', 'u7', 'd6', 'p4', 'usr-1', 6, 55, 12],
  ['i8', 'u8', 'd1', 'p1', 'usr-4', 14, 400, 10],
  ['i9', 'u9', 'd2', 'p5', 'usr-4', 11, 210, 40],
  ['i10', 'u10', 'd8', 'p1', 'usr-5', 1, 5, 5],
  ['i11', 'u11', 'd5', 'p8', 'usr-5', 2, 12, 8],
  ['i12', 'u12', 'd4', 'p6', 'usr-3', 9, 150, 12],
  ['i13', 'u1', 'd1', 'p2', 'usr-1', 10, 190, 22],
  ['i14', 'u2', 'd7', 'p7', 'usr-2', 11, 260, 60],
  ['i15', 'u3', 'd6', 'p4', 'usr-3', 7, 90, 3],
  ['i16', 'u5', 'd2', 'p5', 'usr-4', 12, 330, 12],
  ['i17', 'u6', 'd8', 'p1', 'usr-5', 2, 15, 3],
  ['i18', 'u8', 'd3', 'p3', 'usr-4', 4, 30, 2],
  ['i19', 'u9', 'd4', 'p6', 'usr-2', 13, 380, 20],
  ['i20', 'u4', 'd5', 'p8', 'usr-1', 1, 3, 3],
  ['i21', 'u11', 'd1', 'p2', 'usr-5', 8, 140, 32],
  ['i22', 'u12', 'd6', 'p4', 'usr-3', 3, 22, 9],
  ['i23', 'u7', 'd2', 'p5', 'usr-2', 5, 45, 6],
  ['i24', 'u10', 'd7', 'p7', 'usr-4', 14, 420, 35, 20],
  ['i25', 'u3', 'd7', 'p7', 'usr-5', 14, 360, 25, 5],
  ['i26', 'u12', 'd3', 'p3', 'usr-1', 14, 300, 30, 12],
];

/**
 * Возвраты на доработку: на каком этапе вуз вернул работу на предыдущий этап.
 * Этап — не текущий: после возврата карточку снова перевели вперёд.
 */
const RETURNS = {
  i7: { stageId: 'st-documents', comment: 'Вуз запросил другую форму договора — вернули на встречу.' },
  i12: { stageId: 'st-rollout', comment: 'Продукт не встал на стенд вуза — повторная передача лицензий.' },
  i16: { stageId: 'st-classes', comment: 'Учебный совет не утвердил программу — дорабатываем.' },
  i21: { stageId: 'st-handover', comment: 'Вуз не получил ключи лицензий — переподписываем акт.' },
};

/** Комментарий, с которым карточку переводили НА этап. */
const TRANSITION_COMMENTS = {
  'st-communication': 'Контакт найден, отправили первое письмо.',
  'st-meeting': 'Вуз подтвердил интерес к программе, согласуем дату встречи.',
  'st-documents': 'Встреча прошла, договорились о пилоте на следующий семестр.',
  'st-corrections': 'Юристы вуза прислали правки в договор.',
  'st-signing': 'Документы согласованы и отправлены на подпись.',
  'st-handover': 'Договор подписан обеими сторонами.',
  'st-rollout': 'Материалы и лицензии переданы в вуз.',
  'st-teacher-training': 'Продукт развёрнут в учебных классах.',
  'st-curriculum': 'Обучение преподавателей завершено, прошли 12 человек.',
  'st-classes': 'Обновлённая программа утверждена учёным советом.',
  'st-docs-update': 'Семестр завершён, собрали обратную связь.',
  'st-qualification': 'Документация и материалы обновлены.',
  'st-control': 'Курс повышения квалификации пройден.',
};

/** Файлы — результат этапа, с которого уходили. */
const STAGE_FILES = {
  'st-meeting': [{ name: 'Протокол встречи.pdf', size: 428_000 }],
  'st-documents': [{ name: 'Договор (проект).docx', size: 86_000 }],
  'st-corrections': [{ name: 'Договор — правки вуза.docx', size: 91_000 }],
  'st-signing': [{ name: 'Договор подписанный.pdf', size: 1_240_000 }],
  'st-handover': [{ name: 'Лицензии и материалы.zip', size: 18_400_000 }],
  'st-teacher-training': [{ name: 'Список преподавателей.xlsx', size: 24_000 }],
  'st-curriculum': [{ name: 'Учебная программа.pdf', size: 612_000 }],
};

/**
 * Отклонения от «идеальной» карточки, чтобы аналитика показывала реальные ситуации:
 * истекающие лицензии, пробелы в данных договора, незагруженные документы, пропавший контакт.
 * licenseSignedDaysAgo + licenseYears задают срок лицензии относительно даты показа.
 */
const DATA_QUIRKS = {
  i8: { licenseSignedDaysAgo: 380, licenseYears: 1 },
  i9: { licenseSignedDaysAgo: 350, licenseYears: 1 },
  i14: { licenseSignedDaysAgo: 330, licenseYears: 1 },
  i24: { licenseSignedDaysAgo: 395, licenseYears: 1 },
  i13: { contractNumber: '' },
  i6: { licenseYears: null },
  i15: { missingFilesFor: ['st-signing'] },
  i21: { missingFilesFor: ['st-meeting', 'st-teacher-training'] },
  i16: { missingFilesFor: ['st-curriculum'] },
  i22: { noContacts: true },
};

/** Стабильное псевдослучайное число 0…1 из строки — чтобы демо-данные не менялись между запусками. */
function seededRandom(key) {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 10_000) / 10_000;
}

/**
 * Вставляет в историю возврат: с этапа stageId на предыдущий этап процесса и обратно.
 * Оба события — между входом на этап и следующим переходом, чтобы история оставалась последовательной.
 */
function insertReturn(events, id, { stageId, comment }) {
  const enteredIndex = events.findIndex((event) => event.toStageId === stageId);
  const entered = events[enteredIndex];
  const next = events[enteredIndex + 1];
  if (!entered || !next) return events;

  const stages = BASE_WORKFLOW.stages;
  const previous = stages[stages.findIndex((stage) => stage.id === stageId) - 1];
  const from = new Date(entered.at).getTime();
  const span = new Date(next.at).getTime() - from;
  const base = { interactionId: id, type: 'transition', userId: entered.userId, files: [] };

  const back = { ...base, id: `${id}-r1`, at: new Date(from + span * 0.4).toISOString(), fromStageId: stageId, toStageId: previous.id, stageId, comment };
  const forward = {
    ...base,
    id: `${id}-r2`,
    at: new Date(from + span * 0.7).toISOString(),
    fromStageId: previous.id,
    toStageId: stageId,
    stageId: previous.id,
    comment: 'Замечания устранены.',
  };
  return [...events.slice(0, enteredIndex + 1), back, forward, ...events.slice(enteredIndex + 1)];
}

function buildInteraction([id, universityId, directionId, productId, managerId, stageNo, startedDaysAgo, stageDaysAgo, completedDaysAgo], now) {
  const stages = BASE_WORKFLOW.stages;
  const startedAt = addDays(now, -startedDaysAgo);
  const stageEnteredAt = addDays(now, -stageDaysAgo);
  // Чётные карточки проходят необязательную «Корректировку документов», нечётные — пропускают.
  const skipCorrections = Number(id.slice(1)) % 2 === 1;
  const path = stages.slice(0, stageNo).filter((stage) => !(stage.optional && skipCorrections && stageNo - 1 > stages.indexOf(stage)));

  let events = [{ id: `${id}-e0`, interactionId: id, type: 'created', userId: managerId, at: startedAt.toISOString(), toStageId: stages[0].id }];
  const quirks = DATA_QUIRKS[id] ?? {};
  // Время на этапе пропорционально его нормативному сроку с разбросом; иногда один этап затягивается втрое.
  const slowStage = seededRandom(`${id}-slow`) < 0.3 ? Math.floor(seededRandom(`${id}-which`) * (path.length - 1)) : -1;
  const weights = path.slice(0, -1).map((stage, index) => stage.slaDays * (0.5 + seededRandom(id + stage.id) * 1.2) * (index === slowStage ? 3 : 1));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let elapsedWeight = 0;
  const transitions = path.length - 1;
  path.slice(1).forEach((stage, index) => {
    const from = path[index];
    elapsedWeight += weights[index];
    const at = addDays(startedAt, Math.round(((startedDaysAgo - stageDaysAgo) * elapsedWeight) / totalWeight));
    events.push({
      id: `${id}-e${index + 1}`,
      interactionId: id,
      type: 'transition',
      userId: managerId,
      at: (index === transitions - 1 ? stageEnteredAt : at).toISOString(),
      fromStageId: from.id,
      toStageId: stage.id,
      stageId: from.id,
      comment: TRANSITION_COMMENTS[stage.id],
      files: quirks.missingFilesFor?.includes(from.id) ? [] : (STAGE_FILES[from.id] ?? []),
    });
  });

  if (RETURNS[id]) events = insertReturn(events, id, RETURNS[id]);

  const completedAt = completedDaysAgo === undefined ? null : addDays(now, -completedDaysAgo).toISOString();
  if (completedAt) {
    const last = stages[stageNo - 1];
    events.push({ id: `${id}-done`, interactionId: id, type: 'completed', userId: managerId, at: completedAt, fromStageId: last.id, toStageId: last.id, stageId: last.id, comment: 'Все этапы выполнены, взаимодействие закрыто.', files: [] });
  }

  const stageIndex = stageNo - 1;
  const signed = stageIndex >= 6;
  const signedEvent = events.find((event) => event.toStageId === 'st-handover');
  const university = UNIVERSITIES.find((item) => item.id === universityId);
  const program = PROGRAMS.find((item) => item.directionId === directionId && item.productIds.includes(productId)) ?? PROGRAMS.find((item) => item.directionId === directionId);

  return {
    interaction: {
      id,
      universityId,
      directionId,
      programId: program.id,
      productId,
      managerId,
      workflowId: BASE_WORKFLOW.id,
      stageId: stages[stageIndex].id,
      contactIds: quirks.noContacts ? [] : university.contacts.slice(0, 1).map((item) => item.id),
      contract: {
        number: signed ? (quirks.contractNumber ?? `РТК-ИТШ-2026/${String(Number(id.slice(1)) * 7).padStart(3, '0')}`) : '',
        licenseSignedAt: signed ? toIsoDate(quirks.licenseSignedDaysAgo ? addDays(now, -quirks.licenseSignedDaysAgo) : (signedEvent?.at ?? startedAt)) : '',
        licenseYears: signed ? ('licenseYears' in quirks ? quirks.licenseYears : 1 + Math.floor(seededRandom(id) * 3)) : null,
        transferStatus: TRANSFER_STATUSES[stageIndex > 6 ? 2 : stageIndex === 6 ? 1 : 0],
      },
      comment: '',
      source: 'manual',
      startedAt: startedAt.toISOString(),
      stageEnteredAt: stageEnteredAt.toISOString(),
      updatedAt: events.at(-1).at,
      completedAt,
    },
    events,
  };
}

/** Показатели из LMS: заявки, обучающиеся и параллельные потоки по месяцам. */
function buildMetrics(interactions, now) {
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return toIsoDate(date).slice(0, 7);
  });
  const classesIndex = BASE_WORKFLOW.stages.findIndex((stage) => stage.id === 'st-classes');

  return interactions.flatMap((interaction) => {
    const stageIndex = BASE_WORKFLOW.stages.findIndex((stage) => stage.id === interaction.stageId);
    const startedMonth = interaction.startedAt.slice(0, 7);
    const teaching = stageIndex >= classesIndex;
    const scale = 0.6 + seededRandom(interaction.id + interaction.directionId);

    return months
      .filter((month) => month >= startedMonth)
      .map((month, index) => {
        // Сезонность приёма: пик заявок в августе–сентябре и январе.
        const monthNumber = Number(month.slice(5));
        const season = [9, 8, 1].includes(monthNumber) ? 1.6 : [6, 7].includes(monthNumber) ? 0.7 : 1;
        const noise = 0.8 + seededRandom(interaction.id + month) * 0.4;
        return {
          universityId: interaction.universityId,
          directionId: interaction.directionId,
          productId: interaction.productId,
          month,
          applications: Math.round(18 * scale * season * noise + index),
          students: teaching ? Math.round(40 * scale * noise + index * 3) : 0,
          streams: teaching ? 1 + Math.floor(scale * 3) : 0,
        };
      });
  });
}

function buildInbox(now) {
  return [
    {
      id: 'in-1',
      source: 'site',
      receivedAt: addDays(now, -0.1).toISOString(),
      status: 'new',
      title: 'Заявка с сайта: обучение DevOps',
      payload: {
        universityName: 'Санкт-Петербургский политехнический университет Петра Великого',
        universityId: null,
        directionId: 'd1',
        programId: 'pr1',
        productId: 'p1',
        contact: { name: 'Сергей Павлов', position: 'Заведующий кафедрой', email: 's.pavlov@demo-spbstu.ru' },
        message: 'Хотим внедрить курс DevOps на Astra Linux для 3-го курса с сентября.',
      },
    },
    {
      id: 'in-2',
      source: 'lms',
      receivedAt: addDays(now, -0.4).toISOString(),
      status: 'new',
      title: 'LMS: новые потоки по аналитике данных',
      payload: {
        universityId: 'u1',
        directionId: 'd3',
        programId: 'pr3',
        productId: 'p3',
        suggestedInteractionId: 'i1',
        message: 'Открыто 3 параллельных потока, зачислено 86 обучающихся.',
      },
    },
    {
      id: 'in-3',
      source: 'site',
      receivedAt: addDays(now, -1.2).toISOString(),
      status: 'new',
      title: 'Заявка с сайта: повышение квалификации',
      payload: {
        universityId: 'u2',
        universityName: 'Университет ИТМО',
        directionId: 'd5',
        programId: 'pr5',
        productId: 'p5',
        suggestedInteractionId: 'i2',
        contact: { name: 'Анна Григорьева', position: 'Методист', email: 'a.grigoreva@demo-itmo.ru' },
        message: 'Просим добавить курс повышения квалификации для 8 преподавателей Backend-направления.',
      },
    },
    {
      id: 'in-4',
      source: 'lms',
      receivedAt: addDays(now, -2).toISOString(),
      status: 'linked',
      title: 'LMS: завершён курс тестирования',
      payload: {
        universityId: 'u9',
        directionId: 'd2',
        programId: 'pr2',
        productId: 'p5',
        suggestedInteractionId: 'i9',
        linkedInteractionId: 'i9',
        message: 'Курс завершили 64 обучающихся, средний балл 4,6.',
      },
    },
  ];
}

function buildIntegrations(now) {
  return {
    sources: [
      {
        id: 'lms',
        name: 'LMS ИТ Школы',
        description: 'Обучающиеся, потоки и прогресс по курсам',
        endpoint: 'https://lms.it-school.demo/api/v1/metrics',
        schedule: 'Каждые 4 часа',
        enabled: true,
        lastSyncAt: addDays(now, -0.15).toISOString(),
        lastStatus: 'success',
      },
      {
        id: 'site',
        name: 'Сайт ИТ Школы',
        description: 'Заявки вузов с формы на сайте (Laravel)',
        endpoint: 'https://it-school.demo/api/v1/leads',
        schedule: 'Каждые 15 минут',
        enabled: true,
        lastSyncAt: addDays(now, -0.02).toISOString(),
        lastStatus: 'failed',
        lastErrorCode: 'SYNC-502',
      },
    ],
    log: [
      { id: 'sl-1', sourceId: 'site', at: addDays(now, -0.02).toISOString(), status: 'failed', records: 0, errorCode: 'SYNC-502' },
      { id: 'sl-2', sourceId: 'lms', at: addDays(now, -0.15).toISOString(), status: 'success', records: 24 },
      { id: 'sl-3', sourceId: 'site', at: addDays(now, -0.1).toISOString(), status: 'success', records: 1 },
      { id: 'sl-4', sourceId: 'lms', at: addDays(now, -0.4).toISOString(), status: 'success', records: 31 },
    ],
  };
}

function buildReports(now) {
  return [
    { id: 'r-1', name: 'Все взаимодействия за квартал', createdAt: addDays(now, -1).toISOString(), userId: 'usr-6', format: 'xlsx', rowCount: 24, summary: 'Последние 3 месяца · все вузы' },
    { id: 'r-2', name: 'Кибербезопасность — статусы', createdAt: addDays(now, -6).toISOString(), userId: 'usr-7', format: 'pdf', rowCount: 3, summary: 'За всё время · Кибербезопасность' },
    { id: 'r-3', name: 'Мои вузы', createdAt: addDays(now, -12).toISOString(), userId: 'usr-1', format: 'xls', rowCount: 5, summary: 'За всё время · Алина Воронова' },
  ];
}

export const SEED_VERSION = 5;

export function createSeedState(now = new Date()) {
  const built = INTERACTIONS_TABLE.map((row) => buildInteraction(row, now));
  const interactions = built.map((item) => item.interaction);
  const events = built.flatMap((item) => item.events);

  return {
    version: SEED_VERSION,
    universities: UNIVERSITIES,
    directions: DIRECTIONS,
    programs: PROGRAMS,
    products: PRODUCTS,
    users: USERS,
    workflows: [BASE_WORKFLOW],
    interactions,
    events,
    metrics: buildMetrics(interactions, now),
    inbox: buildInbox(now),
    integrations: buildIntegrations(now),
    reports: buildReports(now),
    audit: [],
  };
}
