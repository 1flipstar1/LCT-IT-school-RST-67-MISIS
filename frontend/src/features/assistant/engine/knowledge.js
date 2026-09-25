import { PHASES } from '../../../domain/workflow.js';
import { formatDays } from '../../../domain/format.js';
import { stem, tokenize } from './text.js';

/**
 * Встроенная база знаний помощника: статьи справки (features/help/articles), состав этапов
 * и подсказки каждого этапа. Отвечает на «как сделать…» мгновенно и без ИИ, а к инструкции
 * прикладывает кнопку «Сделать за меня», если у статьи есть действие.
 */

export const CAPABILITIES = [
  '**Отчёты** — «Сделай отчёт по КФУ и ИТМО за март в PDF». Файл готов сразу, скачайте по кнопке.',
  '**Поиск** — «Покажи просроченные по DevOps», «Какие вузы на этапе подписания?»',
  '**Статистика** — «Сколько взаимодействий в работе?», «Статистика по моим вузам за год».',
  '**Этапы** — «Переведи КФУ на следующий этап», «Верни ИТМО назад с комментарием: нет подписи».',
  '**Комментарии** — «Добавь комментарий к ТПУ: договорились о встрече».',
  '**Сводка по вузу** — «Как дела у КФУ?»: этап, срок, ответственный, последние события и следующий шаг.',
  '**Контакты** — «Контакты ИТМО»: кому звонить и писать в вузе.',
  '**План на день** — «Что мне сегодня делать?»: просроченные и срочные этапы с подсказкой, с чего начать.',
  '**Нагрузка** — «Нагрузка по менеджерам»: у кого сколько в работе и просрочено.',
  '**Навигация** — «Открой аналитику», «Открой доску этапов».',
  '**Инструкции** — «Как сменить этап?», «Что делать на этапе подписания?»',
];

/** keywords уже записаны основами («отчет», «выгруз») — повторно их не усекаем. */
function entry({ id, title, keywords = [], steps = [], text = '', link, action }) {
  const keywordStems = keywords.map((keyword) => tokenize(keyword));
  const titleStems = tokenize(title).filter((token) => token.length > 3).map(stem);
  return { id, title, steps, text, link, action, keywordStems, titleStems };
}

/**
 * articles — статьи справки, доступные пользователю; workflows — наборы этапов.
 * Состав этапов берётся из настоящих наборов, а не из статьи: руководитель мог их изменить.
 */
export function buildKnowledge({ articles = [], workflows = [] }) {
  const fromArticles = articles
    .filter((article) => article.id !== 'stages-list')
    .map((article) => entry({ ...article, link: `/help?article=${article.id}` }));

  const workflow = workflows[0];
  const stageList = workflow
    ? PHASES.map((phase) => `**${phase.label}:** ${workflow.stages.filter((stage) => stage.phase === phase.id).map((stage) => stage.name + (stage.optional ? ' (необязательный)' : '')).join('; ')}`)
    : [];

  const stageEntries = (workflow?.stages ?? []).map((stage, index) =>
    entry({
      id: `stage-${stage.id}`,
      title: `Этап «${stage.name}»`,
      keywords: [stage.name],
      text: [
        `Этап ${index + 1} из ${workflow.stages.length}${stage.optional ? ', необязательный' : ''}. Норматив — ${formatDays(stage.slaDays)}.`,
        stage.hint,
        stage.expectsFiles ? 'Результат этапа обычно подтверждают файлом.' : '',
      ].filter(Boolean).join(' '),
      link: '/workflows',
    }),
  );

  return [
    ...fromArticles,
    entry({ id: 'stages', title: 'Этапы работы с вузом', keywords: ['какие этапы', 'список этапов', 'фаз', 'сколько этапов', 'все этапы'], steps: stageList, link: '/help?article=stages-list' }),
    ...stageEntries,
  ];
}

/**
 * Лучшая статья по тексту или null, если уверенного совпадения нет.
 * minScore: для явного вопроса «как…» хватает одного ключевого слова, для прочих фраз нужно больше.
 */
export function searchKnowledge(knowledge, question, minScore = 2) {
  const questionStems = tokenize(question).filter((token) => token.length > 2).map(stem);
  const matches = (token, keywordStem) => token.startsWith(keywordStem) || (token.length >= 4 && keywordStem.startsWith(token));
  const hits = (stems) => stems.every((keywordStem) => questionStems.some((token) => matches(token, keywordStem)));

  let best = null;
  for (const item of knowledge) {
    const keywordScore = item.keywordStems.filter((stems) => stems.length > 0 && hits(stems)).reduce((sum, stems) => sum + 2 * stems.length, 0);
    const titleScore = item.titleStems.filter((titleStem) => questionStems.some((token) => matches(token, titleStem))).length;
    const score = keywordScore + titleScore;
    if (score >= minScore && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}
