import { ADMIN_ARTICLES } from './admin.js';
import { ASSISTANT_ARTICLES } from './assistant.js';
import { DATA_ARTICLES } from './data.js';
import { WORK_ARTICLES } from './work.js';

/**
 * База знаний, встроенная в CRM (ТЗ, нефункциональные требования, п. 5).
 *
 * Статья: { id, category, title, summary, steps[], tips?[], image?, keywords[], related?[], permission?, action? }
 *  • steps — шаги; **жирный** выделяет названия кнопок и разделов;
 *  • image — скриншот из public/help (обновляется скриптом scripts/capture-help-screenshots.mjs);
 *  • keywords — основы слов для поиска и для ответов ИИ-помощника;
 *  • permission — статья видна только ролям с этим правом;
 *  • action — { label, prompt }: кнопка «сделать с помощником».
 */
export const HELP_CATEGORIES = [
  { id: 'start', title: 'Начало работы', description: 'Вход, роли, интерфейс и курс новичка' },
  { id: 'dashboard', title: 'Дашборд', description: 'Главная страница и срочные этапы' },
  { id: 'interactions', title: 'Взаимодействия', description: 'Список, фильтры, доска этапов' },
  { id: 'cards', title: 'Карточка взаимодействия', description: 'Этапы, комментарии, файлы, изменения' },
  { id: 'analytics', title: 'Аналитика', description: 'Показатели, графики, настройка панели' },
  { id: 'reports', title: 'Отчёты', description: 'Выгрузка в XLSX, XLS и PDF с графиками' },
  { id: 'assistant', title: 'ИИ-помощник', description: 'Инструкции, действия, готовые запросы' },
  { id: 'search', title: 'Поиск', description: 'Поиск по разделам и справке' },
  { id: 'catalogs', title: 'Справочники', description: 'Вузы, направления, программы, продукты' },
  { id: 'import', title: 'Импорт данных', description: 'Загрузка Excel и CSV, проверка, отмена' },
  { id: 'workflows', title: 'Этапы работы', description: 'Процесс и конструктор этапов' },
  { id: 'integrations', title: 'Интеграции', description: 'LMS и сайт: входящие записи и обмен' },
  { id: 'users', title: 'Сотрудники и доступ', description: 'Учётные записи, роли, пароли, журнал' },
  { id: 'security', title: 'Безопасность', description: 'Пароли, 152-ФЗ, Keycloak' },
  { id: 'troubleshooting', title: 'Если что-то не так', description: 'Коды ошибок и частые проблемы' },
];

export const HELP_ARTICLES = [...WORK_ARTICLES, ...DATA_ARTICLES, ...ASSISTANT_ARTICLES, ...ADMIN_ARTICLES];

const byId = new Map(HELP_ARTICLES.map((article) => [article.id, article]));
export const articleById = (id) => byId.get(id) ?? null;

/** Статьи, доступные роли пользователя. */
export const articlesFor = (can) => HELP_ARTICLES.filter((article) => !article.permission || can(article.permission));

const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru').replace(/ё/g, 'е');

/** Поиск по заголовку, описанию, ключевым словам и шагам; заголовок весит больше. */
export function searchArticles(articles, query) {
  const words = normalize(query).split(/[^a-zа-я0-9]+/).filter((word) => word.length > 1);
  if (words.length === 0) return [];
  return articles
    .map((article) => {
      const title = normalize(article.title);
      const body = normalize([article.summary, ...(article.keywords ?? []), ...article.steps].join(' '));
      const score = words.reduce((sum, word) => sum + (title.includes(word) ? 3 : 0) + (body.includes(word) ? 1 : 0), 0);
      const matchesAll = words.every((word) => title.includes(word) || body.includes(word));
      return { article, score: matchesAll ? score : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.article);
}
