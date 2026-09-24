import { EMPTY_FILTERS } from '../../../domain/filters.js';
import { DEFAULT_REPORT_COLUMNS, REPORT_COLUMNS, REPORT_FORMATS } from '../../../domain/reports.js';
import { ENTITY_TYPES } from './entities.js';
import { CAPABILITIES, searchKnowledge } from './knowledge.js';
import { parsePeriod } from './period.js';
import { PAGES, STAGE_MOVE, TOOL } from './tools.js';
import { extractQuoted, hasStem, normalize, tokenize, tokenMatches } from './text.js';

/**
 * Разбор сообщения без ИИ: команда → действие с параметрами, вопрос «как…» → статья базы знаний.
 * Возвращает { kind: 'tool', name, args } | { kind: 'answer', text, article?, suggestions? } | null.
 * null означает «не уверен» — такой запрос уходит локальной модели.
 */

const FILLER = /^(?:(?:а|и|ну|слушай|скажи|подскажи|пожалуйста|помощник|привет)[,!\s]+)+/;
const QUESTION = /^(?:как|каким образом|где|зачем|почему|что такое|что значит|что делать|что нужно|что надо|можно ли|нужно ли|надо ли|для чего|объясни|расскажи|научи|кто может)(?![а-я])/;
const GREETING = /^(?:привет|здравствуй|здравствуйте|добрый (?:день|вечер)|доброе утро|hello|hi)(?![а-яa-z])/;
const THANKS = /(спасибо|благодарю|спс|супер|отлично|класс)[!. ]*$/;
const ABOUT = /(что ты умеешь|что умеешь|что можешь|твои возможности|какие команды|список команд|^помощь$|^help$|кто ты)/;

const OPEN_VERBS = ['открой', 'откройте', 'открыть', 'перейди', 'перейти', 'зайди', 'зайти', 'переключи', 'покажи раздел'];
const SHOW_VERBS = ['покаж', 'найд', 'найти', 'список', 'какие', 'какой', 'выведи', 'отфильтр', 'где', 'кто', 'у кого', 'отбер', 'подбер'];
const REPORT_WORDS = ['отчет', 'выгрузк', 'выгрузи', 'выгрузить', 'экспорт'];
const STATS_WORDS = ['статистик', 'сводк', 'сколько', 'итог', 'показател', 'цифр', 'расклад', 'распределен', 'метрик'];
const ATTENTION_WORDS = ['просроч', 'срочн', 'горящ', 'сорван', 'опазд', 'внимани'];
const STAGE_VERBS = ['переведи', 'перевед', 'перевести', 'передвин', 'продвин', 'сдвин', 'перемест', 'подвин', 'двигай', 'перекин', 'пропусти', 'пропуст', 'верни', 'вернуть', 'откат', 'заверши', 'завершить'];
const COMMENT_VERBS = /(добав|остав|напиш|запиш|внеси|сохрани)[а-я]*\s+(?:[а-я]+\s+)?(комментар|заметк|примечан)|прокомментир/;
const REPEAT_REPORT = /(повтор|снова|еще раз|заново)[а-я ]*отчет|последн[а-я]* отчет/;

const hasPhrase = (tokens, phrase) => {
  const parts = phrase.split(' ');
  return parts.every((part) => tokens.some((token) => token.startsWith(part)));
};
const hasAny = (tokens, phrases) => phrases.some((phrase) => hasPhrase(tokens, phrase));

export function detectFormat(text) {
  if (/(pdf|пдф)/.test(text)) return 'pdf';
  if (/(\bxls\b|97|2003|стар[а-я]* формат)/.test(text)) return 'xls';
  if (/(xlsx|excel|эксел|ексел|таблиц)/.test(text)) return 'xlsx';
  return null;
}

const COLUMN_STEMS = {
  vendor: ['вендор', 'производител'],
  contract: ['номер договор', 'договор'],
  licenseSignedAt: ['подписани лиценз', 'дата лиценз'],
  licenseYears: ['срок лиценз'],
  transferStatus: ['статус передач', 'передач'],
  startedAt: ['дата начал', 'начал работ'],
};

export function detectColumns(tokens) {
  if (hasAny(tokens, ['все колонк', 'всеми колонк', 'все пол', 'всеми пол', 'все столбц', 'полный отчет', 'подробн отчет'])) return REPORT_COLUMNS.map((column) => column.id);
  const extra = Object.entries(COLUMN_STEMS).filter(([, stems]) => hasAny(tokens, stems)).map(([id]) => id);
  return extra.length ? REPORT_COLUMNS.map((column) => column.id).filter((id) => DEFAULT_REPORT_COLUMNS.includes(id) || extra.includes(id)) : null;
}

function detectReportName(message) {
  const match = message.match(/(?:назови(?:те)?(?:\s+(?:его|файл))?|под названием|с названием|название)\s*[:—-]?\s*[«"“]?([^»"”\n]{2,80})/i);
  return match ? match[1].trim() : null;
}

function detectComment(message) {
  const match = message.match(/(?:с комментарием|комментарий|причина|потому что|так как)\s*[:—-]?\s*[«"“]?([^»"”\n]{2,})/i);
  return match ? match[1].trim() : extractQuoted(message);
}

export function detectPage(tokens) {
  return PAGES.find((page) => hasAny(tokens, page.stems)) ?? null;
}

const REFERENCE = /(?:^|\s)(по ним|по этим|по ней|по нему|их|для них|эти же|те же|такой же|таким же)(?![а-я])/;

/**
 * Фильтр из текста: сущности справочников, период и «только срочные».
 * «…по ним» без своих условий берёт условия предыдущего ответа (previousFilters).
 */
export function extractFilters(text, { matcher, userId, now, previousFilters }) {
  const entities = matcher.extract(text, { userId });
  const period = parsePeriod(text, now);
  const onlyAttention = hasStem(tokenize(text), ATTENTION_WORDS);
  const own = { ...EMPTY_FILTERS, ...entities, period: period ?? EMPTY_FILTERS.period, onlyAttention };
  if (!previousFilters || !REFERENCE.test(normalize(text))) return own;
  return {
    ...previousFilters,
    ...Object.fromEntries(ENTITY_TYPES.filter(({ key }) => entities[key].length > 0).map(({ key }) => [key, entities[key]])),
    period: period ?? previousFilters.period,
    onlyAttention: onlyAttention || previousFilters.onlyAttention,
  };
}

const hasEntities = (filters) => ENTITY_TYPES.some(({ key }) => filters[key].length > 0);

/** Вуз и направление ищем только до текста комментария: «к КФУ: обсудили DevOps» — это не фильтр по DevOps. */
const beforeQuote = (message, quote) => (quote ? message.slice(0, message.indexOf(quote)) : message);

function detectTool(message, text, tokens, context) {
  if (COMMENT_VERBS.test(text)) {
    const comment = extractQuoted(message);
    return { name: TOOL.addComment, args: { filters: extractFilters(beforeQuote(message, comment), context), text: comment } };
  }

  if (hasStem(tokens, STAGE_VERBS)) {
    const comment = detectComment(message);
    const filters = extractFilters(beforeQuote(message, comment), context);
    if (filters.universityIds.length > 0 || hasStem(tokens, ['этап'])) {
      let move = STAGE_MOVE.next;
      if (hasStem(tokens, ['верн', 'откат', 'назад', 'предыдущ', 'доработк'])) move = STAGE_MOVE.back;
      else if (hasStem(tokens, ['пропуст'])) move = STAGE_MOVE.skip;
      return { name: TOOL.changeStage, args: { filters: { ...filters, stageIds: [] }, move, comment } };
    }
  }

  const filters = extractFilters(message, context);

  if (REPEAT_REPORT.test(text)) return { name: TOOL.repeatReport, args: {} };

  const opens = hasAny(tokens, OPEN_VERBS);
  const page = detectPage(tokens);
  if (opens && page && filters.universityIds.length === 0) return { name: TOOL.openPage, args: { page: page.id } };

  if (hasStem(tokens, REPORT_WORDS) || (detectFormat(text) && hasStem(tokens, ['сдела', 'сформир', 'скача', 'выгруз', 'собер', 'подготов', 'файл', 'нуж', 'хочу', 'дай']))) {
    return {
      name: TOOL.createReport,
      args: { filters, format: detectFormat(text), columns: detectColumns(tokens), name: detectReportName(message) },
    };
  }

  if (opens && filters.universityIds.length > 0) return { name: TOOL.openInteraction, args: { filters } };
  if (hasStem(tokens, STATS_WORDS)) return { name: TOOL.showStats, args: { filters } };
  if ((hasAny(tokens, SHOW_VERBS) && (hasEntities(filters) || filters.onlyAttention || hasStem(tokens, ['взаимодейств', 'вуз']))) || filters.onlyAttention) {
    return { name: TOOL.findInteractions, args: { filters } };
  }
  if (!QUESTION.test(text) && hasEntities(filters) && tokens.length <= 6) return { name: TOOL.findInteractions, args: { filters } };
  return null;
}

/**
 * context: { matcher, knowledge, userId, now, previousFilters? }.
 * Вопрос «как…» никогда не запускает действие: сначала инструкция, а выполнить можно кнопкой под ней.
 */
export function interpretLocally(message, context) {
  const text = normalize(message).trim().replace(FILLER, '');
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  if (GREETING.test(text) && tokens.length <= 3) {
    return { kind: 'answer', text: 'Здравствуйте! Я могу объяснить, как что-то сделать, или сделать это сам. Например, сформировать отчёт или найти просроченные этапы.', suggestions: ['Что ты умеешь?', 'Покажи просроченные', 'Как сформировать отчёт?'] };
  }
  if (THANKS.test(text) && tokens.length <= 4) return { kind: 'answer', text: 'Пожалуйста! Обращайтесь.' };
  if (ABOUT.test(text)) return { kind: 'answer', text: `Вот что я умею:\n\n${CAPABILITIES.map((line) => `- ${line}`).join('\n')}` };

  const question = QUESTION.test(text);
  if (!question) {
    const tool = detectTool(message, text, tokens, context);
    if (tool) return { kind: 'tool', ...tool };
  }

  const article = searchKnowledge(context.knowledge, text, question ? 2 : 4);
  return article ? { kind: 'answer', article } : null;
}

/**
 * Действие, выбранное локальной моделью, → те же параметры, что у локального разбора.
 * Основа — точный разбор исходного текста; названия от модели дополняют то, что разбор не нашёл.
 */
export function resolveModelCall({ name, arguments: args = {} }, message, context) {
  const text = typeof args.text === 'string' && args.text.trim() ? args.text.trim() : extractQuoted(message);
  const comment = typeof args.comment === 'string' && args.comment.trim() ? args.comment.trim() : detectComment(message);
  const quote = { [TOOL.addComment]: text, [TOOL.changeStage]: comment }[name];
  const filters = extractFilters(beforeQuote(message, quote && message.includes(quote) ? quote : ''), context);
  const unknown = [];

  // Модель иногда добавляет условия от себя. Берём только названия, которые пользователь действительно упомянул.
  const messageTokens = tokenize(message);
  const mentioned = (name) => typeof name === 'string' && tokenize(name).some((token) => token.length > 2 && messageTokens.some((word) => tokenMatches(word, token)));

  const modelKeys = { universities: 'universityIds', directions: 'directionIds', products: 'productIds', programs: 'programIds', managers: 'managerIds', stages: 'stageIds' };
  for (const [argName, key] of Object.entries(modelKeys)) {
    if (filters[key].length > 0 || !Array.isArray(args[argName])) continue;
    const resolved = context.matcher.resolveNames(key, args[argName].filter(mentioned));
    filters[key] = resolved.ids;
    unknown.push(...resolved.unknown);
  }

  if (filters.period.preset === 'all' && !/(все|весь) (время|период)/.test(normalize(message))) {
    if (args.date_from || args.date_to) filters.period = { preset: 'custom', from: args.date_from ?? '', to: args.date_to ?? '' };
    else if (['30d', '90d', '365d'].includes(args.period)) filters.period = { preset: args.period, from: '', to: '' };
  }
  if (args.only_attention === true) filters.onlyAttention = true;

  const tokens = tokenize(message);
  const format = detectFormat(normalize(message)) ?? (REPORT_FORMATS.some((item) => item.id === args.format) ? args.format : null);
  const columns = detectColumns(tokens) ?? (Array.isArray(args.columns) ? args.columns.filter((id) => REPORT_COLUMNS.some((column) => column.id === id)) : null);
  const move = Object.values(STAGE_MOVE).includes(args.move) ? args.move : STAGE_MOVE.next;

  return {
    name,
    unknown,
    args: {
      filters: name === TOOL.changeStage ? { ...filters, stageIds: [] } : filters,
      format,
      columns: columns?.length ? columns : null,
      name: typeof args.name === 'string' && args.name.trim() ? args.name.trim() : detectReportName(message),
      page: PAGES.some((page) => page.id === args.page) ? args.page : detectPage(tokens)?.id,
      move,
      comment,
      text,
    },
  };
}
