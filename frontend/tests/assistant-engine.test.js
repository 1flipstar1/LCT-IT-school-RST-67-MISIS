import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSeedState } from '../src/data/seed.js';
import { EMPTY_FILTERS } from '../src/domain/filters.js';
import { PERMISSION } from '../src/domain/roles.js';
import { getProgress, getSla, getStage } from '../src/domain/workflow.js';
import { createEntityMatcher } from '../src/features/assistant/engine/entities.js';
import { executeTool } from '../src/features/assistant/engine/execute.js';
import { interpretLocally, resolveModelCall } from '../src/features/assistant/engine/interpret.js';
import { buildKnowledge } from '../src/features/assistant/engine/knowledge.js';
import { parsePeriod } from '../src/features/assistant/engine/period.js';
import { OUT_OF_SCOPE_TEXT } from '../src/features/assistant/engine/scope.js';
import { STAGE_MOVE, TOOL } from '../src/features/assistant/engine/tools.js';
import { DEFAULT_SETTINGS } from '../src/features/assistant/settings.js';
import { HELP_ARTICLES } from '../src/features/help/articles/index.js';

const now = new Date('2026-09-24T12:00:00');
const state = createSeedState(now);
const matcher = createEntityMatcher(state);
const knowledge = buildKnowledge({ articles: HELP_ARTICLES, workflows: state.workflows });
const parse = (text, extra = {}) => interpretLocally(text, { matcher, knowledge, userId: 'usr-1', now, ...extra });

const indexById = (items) => new Map(items.map((item) => [item.id, item]));
const index = {
  universities: indexById(state.universities),
  directions: indexById(state.directions),
  programs: indexById(state.programs),
  products: indexById(state.products),
  users: indexById(state.users),
  workflows: indexById(state.workflows),
};

/** То же обогащение строк, что в store/selectors.js (там оно спрятано за React-хуками). */
const rows = state.interactions.map((interaction) => {
  const workflow = index.workflows.get(interaction.workflowId);
  return {
    ...interaction,
    workflow,
    university: index.universities.get(interaction.universityId),
    direction: index.directions.get(interaction.directionId),
    program: index.programs.get(interaction.programId),
    product: index.products.get(interaction.productId),
    manager: index.users.get(interaction.managerId),
    stage: getStage(workflow, interaction.stageId),
    sla: getSla(interaction, workflow, now),
    progress: getProgress(workflow, interaction.stageId),
    searchText: '',
  };
});

const context = (overrides = {}) => ({
  rows,
  index,
  reports: state.reports,
  settings: DEFAULT_SETTINGS,
  can: () => true,
  userId: 'usr-6',
  now,
  ...overrides,
});
const run = (name, args, overrides) => executeTool({ name, args }, context(overrides));

describe('parsePeriod', () => {
  const period = (text) => parsePeriod(text, now);

  it('понимает месяцы, кварталы и годы', () => {
    assert.deepEqual(period('за март'), { preset: 'custom', from: '2026-03-01', to: '2026-03-31' });
    assert.deepEqual(period('за ноябрь'), { preset: 'custom', from: '2025-11-01', to: '2025-11-30' }, 'будущий месяц — прошлогодний');
    assert.deepEqual(period('в прошлом квартале'), { preset: 'custom', from: '2026-04-01', to: '2026-06-30' });
    assert.deepEqual(period('за 2025 год'), { preset: 'custom', from: '2025-01-01', to: '2025-12-31' });
    assert.deepEqual(period('с начала года'), { preset: 'custom', from: '2026-01-01', to: '2026-09-24' });
  });

  it('понимает скользящие периоды и явные даты', () => {
    assert.equal(period('за последние 3 месяца').preset, '90d');
    assert.equal(period('за последний месяц').preset, '30d');
    assert.deepEqual(period('за две недели'), { preset: 'custom', from: '2026-09-10', to: '2026-09-24' });
    assert.deepEqual(period('с 01.03 по 15.05.2026'), { preset: 'custom', from: '2026-03-01', to: '2026-05-15' });
    assert.deepEqual(period('с 1 марта по 15 мая'), { preset: 'custom', from: '2026-03-01', to: '2026-05-15' });
    assert.equal(period('за всё время').preset, 'all');
    assert.equal(period('отчёт по КФУ'), null);
  });
});

describe('createEntityMatcher', () => {
  const extract = (text) => matcher.extract(text, { userId: 'usr-1' });

  it('находит вузы по краткому названию и в любом падеже', () => {
    assert.deepEqual(extract('по КФУ и ИТМО').universityIds, ['u1', 'u2']);
    assert.deepEqual(extract('по казанскому университету').universityIds, ['u1']);
    assert.deepEqual(extract('у Вороновой').managerIds, ['usr-1']);
    assert.deepEqual(extract('мои взаимодействия').managerIds, ['usr-1']);
  });

  it('«кроме» исключает, а направление не путается с этапом', () => {
    const excluded = extract('все вузы кроме КФУ и ИТМО');
    assert.equal(excluded.universityIds.length, state.universities.length - 2);
    assert.ok(!excluded.universityIds.includes('u1'));

    const ml = extract('на этапе обучения по машинному обучению');
    assert.deepEqual(ml.directionIds, ['d7']);
    assert.deepEqual(ml.stageIds, ['st-teacher-training']);
    assert.deepEqual(extract('обучение').stageIds, [], 'без слова «этап» этапы не ищем');
  });
});

describe('interpretLocally', () => {
  it('«как…» — инструкция, «сделай…» — действие', () => {
    const howTo = parse('Как сделать отчёт?');
    assert.equal(howTo.kind, 'answer');
    assert.equal(howTo.article.id, 'report');

    const doIt = parse('Сделай отчёт по КФУ и ИТМО за март в пдф');
    assert.equal(doIt.name, TOOL.createReport);
    assert.deepEqual(doIt.args.filters.universityIds, ['u1', 'u2']);
    assert.equal(doIt.args.format, 'pdf');
    assert.equal(doIt.args.filters.period.from, '2026-03-01');
  });

  it('распознаёт поиск, статистику, навигацию и изменения', () => {
    assert.equal(parse('Какие вузы на этапе подписания?').name, TOOL.findInteractions);
    assert.equal(parse('покажи просроченные').args.filters.onlyAttention, true);
    assert.equal(parse('сколько взаимодействий у Вороновой').name, TOOL.showStats);
    assert.deepEqual(parse('открой доску').args, { page: 'board' });
    assert.equal(parse('открой КФУ').name, TOOL.openInteraction);
    assert.equal(parse('повтори последний отчёт').name, TOOL.repeatReport);

    const back = parse('Верни ИТМО назад с комментарием: нет подписи ректора');
    assert.equal(back.name, TOOL.changeStage);
    assert.equal(back.args.move, STAGE_MOVE.back);
    assert.equal(back.args.comment, 'нет подписи ректора');

    const comment = parse('Добавь комментарий к ТПУ: договорились о встрече по DevOps');
    assert.equal(comment.args.text, 'договорились о встрече по DevOps');
    assert.deepEqual(comment.args.filters.directionIds, [], 'DevOps из текста комментария — не фильтр');
  });

  it('«по ним» берёт условия предыдущего ответа', () => {
    const previousFilters = { ...EMPTY_FILTERS, universityIds: ['u3'], onlyAttention: true };
    const report = parse('сделай отчёт по ним', { previousFilters });
    assert.deepEqual(report.args.filters.universityIds, ['u3']);
    assert.equal(report.args.filters.onlyAttention, true);
  });

  it('понимает сводку по вузу, контакты, план на день и нагрузку', () => {
    assert.equal(parse('Как дела у КФУ?').name, TOOL.interactionDetails);
    assert.equal(parse('что с ИТМО').name, TOOL.interactionDetails);
    assert.equal(parse('контакты ТПУ').name, TOOL.universityContacts);
    assert.equal(parse('Что мне сегодня делать?').name, TOOL.dailyPlan);
    assert.equal(parse('нагрузка по менеджерам').name, TOOL.managerWorkload);
    assert.equal(parse('что делать на этапе подписания документов?').kind, 'answer', 'вопрос об этапе — не план на день');
  });

  it('не отвечает на посторонние запросы', () => {
    for (const text of ['2+2', 'сколько будет 7*8', 'напиши код на питоне', 'расскажи анекдот', 'какая погода завтра']) {
      assert.equal(parse(text).text, OUT_OF_SCOPE_TEXT, text);
    }
    assert.equal(parse('Отчёт по КФУ за 2025 год').name, TOOL.createReport);
  });

  it('незнакомое оставляет модели', () => {
    assert.equal(parse('посоветуй стратегию переговоров с ректором'), null);
    assert.equal(parse('привет').kind, 'answer');
  });
});

describe('executeTool', () => {
  it('отчёт: карточка со строками и форматом по умолчанию', () => {
    const result = run(TOOL.createReport, { filters: { ...EMPTY_FILTERS, universityIds: ['u1'] } });
    assert.equal(result.card.kind, 'report');
    assert.equal(result.card.rowCount, 2);
    assert.equal(result.card.spec.format, 'xlsx');
    assert.equal(result.effect, undefined);
    assert.equal(run(TOOL.createReport, { filters: {} }, { settings: { ...DEFAULT_SETTINGS, autoDownload: true } }).effect.type, 'download');
  });

  it('пустой отчёт не предлагается к скачиванию', () => {
    const result = run(TOOL.createReport, { filters: { ...EMPTY_FILTERS, period: { preset: 'custom', from: '2001-01-01', to: '2001-01-31' } } });
    assert.equal(result.card, undefined);
    assert.match(result.text, /не попало/);
  });

  it('смена этапа соблюдает правила переходов', () => {
    const several = run(TOOL.changeStage, { filters: { universityIds: ['u1'] }, move: STAGE_MOVE.next });
    assert.equal(several.card.kind, 'choice', 'у КФУ два взаимодействия — нужно выбрать');

    const next = run(TOOL.changeStage, { interactionId: 'i1', move: STAGE_MOVE.next });
    assert.equal(next.card.transitionKind, 'next');
    assert.equal(next.effect, undefined, 'по умолчанию ждём подтверждения');

    const back = run(TOOL.changeStage, { interactionId: 'i1', move: STAGE_MOVE.back }, { settings: { ...DEFAULT_SETTINGS, confirmChanges: false } });
    assert.equal(back.effect, undefined, 'без комментария возврат не выполняется даже без подтверждения');
    assert.match(back.text, /нужен комментарий/);

    const skip = run(TOOL.changeStage, { interactionId: 'i4', move: STAGE_MOVE.skip });
    assert.match(skip.text, /необязательный/);

    const auto = run(TOOL.changeStage, { interactionId: 'i4', move: STAGE_MOVE.next }, { settings: { ...DEFAULT_SETTINGS, confirmChanges: false } });
    assert.equal(auto.effect.type, 'commit');
  });

  it('раздел без прав не открывается', () => {
    const denied = run(TOOL.openPage, { page: 'users' }, { can: (permission) => permission !== PERMISSION.manageUsers });
    assert.equal(denied.effect, undefined);
    assert.deepEqual(run(TOOL.openPage, { page: 'board' }).effect, { type: 'navigate', path: '/interactions', view: 'board' });
  });

  it('сводка, контакты, нагрузка и план на день', () => {
    const details = run(TOOL.interactionDetails, { interactionId: 'i1' });
    assert.equal(details.card.kind, 'details');
    assert.match(details.text, /этап 6 из 14/);

    const contacts = run(TOOL.universityContacts, { filters: { ...EMPTY_FILTERS, universityIds: ['u1'] } });
    assert.deepEqual(contacts.card, { kind: 'contacts', universityIds: ['u1'] });

    const workload = run(TOOL.managerWorkload, { filters: {} });
    assert.equal(workload.card.items.reduce((sum, item) => sum + item.active, 0), rows.filter((row) => !row.completedAt).length);

    const plan = run(TOOL.dailyPlan, {}, { userId: 'usr-1' });
    assert.ok(plan.card.ids.every((id) => rows.find((row) => row.id === id).managerId === 'usr-1'));
  });

  it('статистика считает просрочки и фазы', () => {
    const { card } = run(TOOL.showStats, { filters: {} });
    assert.equal(card.stats.total, rows.length);
    assert.equal(card.stats.phases.reduce((sum, phase) => sum + phase.count, 0), card.stats.active);
  });
});

describe('resolveModelCall', () => {
  const resolve = (action, message) => resolveModelCall(action, message, { matcher, knowledge, userId: 'usr-1', now });

  it('берёт от модели только названия, упомянутые пользователем', () => {
    const call = resolve(
      { name: TOOL.findInteractions, arguments: { universities: ['Томский политехнический университет'], stages: ['встреча', 'согласование'] } },
      'перекинь томский политех дальше по воронке',
    );
    assert.deepEqual(call.args.filters.universityIds, ['u4']);
    assert.deepEqual(call.args.filters.stageIds, []);
  });

  it('не берёт от модели период, если пользователь не говорил о времени', () => {
    const call = resolve({ name: TOOL.managerWorkload, arguments: { period: '30d' } }, 'кто у нас больше всех загружен');
    assert.equal(call.args.filters.period.preset, 'all');
  });

  it('дополняет разбор форматом и периодом от модели', () => {
    const call = resolve({ name: TOOL.createReport, arguments: { universities: ['КФУ'], format: 'pdf', period: '90d' } }, 'файлик для начальства по казанскому вузу, разбивка по месяцам');
    assert.deepEqual(call.args.filters.universityIds, ['u1']);
    assert.equal(call.args.format, 'pdf');
    assert.equal(call.args.filters.period.preset, '90d');
  });
});
