import { PHASES } from '../../../domain/workflow.js';
import { formatDays } from '../../../domain/format.js';
import { stem, tokenize } from './text.js';

/**
 * Встроенная база знаний: статьи справки, правила переходов (logic/Этапы.md) и подсказки этапов.
 * Отвечает на «как сделать…» мгновенно и без ИИ, а к инструкции прикладывает кнопку «Сделать за меня».
 */

const GUIDE_KEYWORDS = {
  start: ['начать', 'день', 'сегодня', 'главн', 'дашборд', 'чем заняться'],
  stage: ['этап', 'смен', 'перевест', 'перевод', 'статус', 'продвин'],
  board: ['доск', 'перетащ', 'канбан', 'колонк'],
  report: ['отчет', 'выгруз', 'скача', 'excel', 'эксел', 'pdf', 'xlsx', 'xls', 'файл'],
  access: ['доступ', 'роль', 'прав', 'пользовател', 'сотрудник'],
  workflow: ['этапы работы', 'конструктор', 'норматив', 'порядок этап', 'изменить этап', 'настро'],
  import: ['импорт', 'загруз', 'справочник', 'шаблон', 'excel'],
  integrations: ['lms', 'сайт', 'интеграц', 'синхрон', 'входящ'],
};

/** Что помощник может выполнить сам после инструкции. */
const GUIDE_ACTIONS = {
  report: { label: 'Сформировать отчёт за меня', prompt: 'Сформируй отчёт за последние 3 месяца' },
  start: { label: 'Показать срочные', prompt: 'Покажи просроченные и срочные взаимодействия' },
  stage: { label: 'Показать мои срочные этапы', prompt: 'Покажи срочные взаимодействия' },
  board: { label: 'Открыть доску', prompt: 'Открой доску этапов' },
};

const TRANSITION_RULES = [
  'Вперёд — на следующий этап; комментарий и файлы по желанию.',
  'Пропуск — только через необязательный этап; комментарий обязателен.',
  'Назад — возврат на предыдущий этап на доработку; комментарий обязателен.',
  'С последнего этапа взаимодействие завершается.',
];

export const CAPABILITIES = [
  '**Отчёты** — «Сделай отчёт по КФУ и ИТМО за март в PDF». Файл готов сразу, скачайте по кнопке.',
  '**Поиск** — «Покажи просроченные по DevOps», «Какие вузы на этапе подписания?»',
  '**Статистика** — «Сколько взаимодействий в работе?», «Статистика по моим вузам за год».',
  '**Этапы** — «Переведи КФУ на следующий этап», «Верни ИТМО назад с комментарием: нет подписи».',
  '**Комментарии** — «Добавь комментарий к ТПУ: договорились о встрече».',
  '**Навигация** — «Открой аналитику», «Открой доску этапов».',
  '**Инструкции** — «Как сменить этап?», «Что делать на этапе подписания?»',
];

function entry({ id, title, keywords, steps = [], text = '', link, action }) {
  const keywordStems = keywords.map((keyword) => tokenize(keyword).map(stem));
  const titleStems = tokenize(title).filter((token) => token.length > 3).map(stem);
  return { id, title, steps, text, link, action, keywordStems, titleStems };
}

export function buildKnowledge({ userGuide = [], adminGuide = [], workflows = [] }) {
  const guides = [
    ...userGuide.map((guide) => ({ guide, link: `/help?section=user` })),
    ...adminGuide.map((guide) => ({ guide, link: `/help?section=admin` })),
  ].map(({ guide, link }) =>
    entry({
      id: guide.id,
      title: guide.title,
      keywords: GUIDE_KEYWORDS[guide.id] ?? [],
      steps: guide.steps,
      link,
      action: GUIDE_ACTIONS[guide.id],
    }),
  );

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
    ...guides,
    entry({ id: 'rules', title: 'Правила смены этапов', keywords: ['пропуст', 'вернуть', 'назад', 'комментар обязател', 'необязательн', 'правил', 'можно'], steps: TRANSITION_RULES, link: '/help?section=user' }),
    entry({ id: 'stages', title: 'Этапы работы с вузом', keywords: ['какие этапы', 'список этапов', 'фаз', 'сколько этапов', 'все этапы'], steps: stageList, link: '/workflows' }),
    entry({ id: 'filters', title: 'Как найти взаимодействие', keywords: ['найти', 'поиск', 'фильтр', 'отфильтр'], steps: ['Откройте «Взаимодействия».', 'Задайте период, вузы, направления, продукты или ответственных в панели фильтров.', 'Или просто напишите мне: «Покажи взаимодействия КФУ по DevOps».'], link: '/interactions' }),
    entry({ id: 'create', title: 'Как создать взаимодействие', keywords: ['создать взаимодейств', 'новое взаимодейств', 'добавить взаимодейств', 'добавить вуз'], steps: ['Откройте «Взаимодействия».', 'Нажмите «Новое взаимодействие» в шапке страницы.', 'Выберите вуз, направление, программу, продукт и ответственного — взаимодействие начнётся с первого этапа.'], link: '/interactions' }),
    entry({ id: 'comment', title: 'Как оставить комментарий или файл', keywords: ['комментар', 'заметк', 'приложить', 'файл', 'документ'], steps: ['Откройте карточку взаимодействия.', 'В ленте событий напишите комментарий и приложите файлы.', 'Или напишите мне: «Добавь комментарий к КФУ: созвонились с проректором».'], link: '/interactions' }),
    entry({ id: 'analytics', title: 'Как смотреть аналитику', keywords: ['аналитик', 'график', 'динамик', 'рейтинг', 'нагрузк'], steps: ['Откройте «Аналитику».', 'Выберите период и фильтры — графики пересчитаются.', 'Любой график можно скачать в PNG или посмотреть таблицей.'], link: '/analytics' }),
    ...stageEntries,
  ];
}

/** Лучшая статья по вопросу или null, если уверенного совпадения нет. */
export function searchKnowledge(knowledge, question) {
  const questionStems = tokenize(question).filter((token) => token.length > 2).map(stem);
  const hits = (stems) => stems.every((keywordStem) => questionStems.some((token) => token.startsWith(keywordStem) || keywordStem.startsWith(token)));

  let best = null;
  for (const item of knowledge) {
    const keywordScore = item.keywordStems.filter((stems) => stems.length > 0 && hits(stems)).reduce((sum, stems) => sum + 2 * stems.length, 0);
    const titleScore = item.titleStems.filter((titleStem) => questionStems.some((token) => token.startsWith(titleStem) || titleStem.startsWith(token))).length;
    const score = keywordScore + titleScore;
    if (score >= 2 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}
