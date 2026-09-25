import { useMemo, useState } from 'react';
import { Link, useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { ERROR_CODES } from '../../domain/errors.js';
import { plural } from '../../domain/format.js';
import { cn } from '../../lib/cn.js';
import { resetState } from '../../store/persistence.js';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { SearchField } from '../../ui/Field.jsx';
import { ArrowLeftIcon, ArrowRightIcon, HelpIcon, MagicIcon, RefreshIcon, SearchIcon } from '../../ui/icons.js';
import { InlineAlert } from '../../ui/InlineAlert.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import { openAssistant } from '../assistant/launch.js';
import { startOnboarding } from '../onboarding/OnboardingTour.jsx';
import { articlesFor, HELP_CATEGORIES, searchArticles } from './articles/index.js';
import styles from './HelpPage.module.css';

const ERROR_ROWS = Object.entries(ERROR_CODES).map(([code, info]) => ({ code, ...info }));
const POPULAR = ['first-login', 'stage', 'report', 'assistant-prompts', 'edit-card', 'report-pin', 'import', 'access'];

/** **жирный** в тексте статьи — названия кнопок и разделов. */
const rich = (text) => text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part));

const askAssistant = (question) => openAssistant({ question, from: document.querySelector('[data-tour="search"]') });

export function HelpPage() {
  const { query, pathname, navigate } = useRouter();
  const { can } = useSession();
  const [search, setSearch] = useState('');
  const articles = useMemo(() => articlesFor(can), [can]);

  const section = ['errors', 'about'].includes(query.get('section')) ? query.get('section') : 'kb';
  const article = articles.find((item) => item.id === query.get('article')) ?? null;
  const categoryId = article?.category ?? query.get('category');
  const category = HELP_CATEGORIES.find((item) => item.id === categoryId) ?? null;
  const go = (params) => {
    setSearch('');
    navigate(`${pathname}?${new URLSearchParams(params)}`);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <PageHeader
        title="Справка"
        hint="База знаний по всем разделам: пошаговые инструкции со скриншотами. Не нашли ответ — спросите ИИ-помощника."
        actions={<Button icon={MagicIcon} onClick={startOnboarding}>Пройти курс новичка</Button>}
      />

      <Tabs
        label="Разделы справки"
        tabs={[
          { value: 'kb', label: 'База знаний', count: articles.length },
          { value: 'errors', label: 'Коды ошибок' },
          { value: 'about', label: 'О системе' },
        ]}
        value={section}
        onChange={(value) => go(value === 'kb' ? {} : { section: value })}
        className={styles.tabs}
      />

      {section === 'kb' && (
        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Разделы базы знаний">
            <SearchField value={search} onChange={setSearch} placeholder="Поиск по справке" label="Поиск по справке" className={styles.search} />
            <nav className={styles.categories}>
              {HELP_CATEGORIES.map((item) => {
                const inCategory = articles.filter((entry) => entry.category === item.id);
                if (inCategory.length === 0) return null;
                const open = category?.id === item.id;
                return (
                  <div key={item.id} className={styles.categoryGroup}>
                    <button type="button" className={cn(styles.categoryLink, open && styles.categoryActive)} onClick={() => go({ category: item.id })} aria-expanded={open}>
                      <span>{item.title}</span>
                      <span className={styles.count}>{inCategory.length}</span>
                    </button>
                    {open && (
                      <ul className={styles.articleLinks}>
                        {inCategory.map((entry) => (
                          <li key={entry.id}>
                            <Link to={`/help?article=${entry.id}`} className={cn(styles.articleLink, entry.id === article?.id && styles.articleLinkActive)}>{entry.title}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>

          <div className={styles.main}>
            {search.trim() ? (
              <SearchResults results={searchArticles(articles, search)} query={search} onOpen={(id) => go({ article: id })} />
            ) : article ? (
              <ArticleView key={article.id} article={article} category={category} articles={articles} onOpen={(id) => go({ article: id })} onCategory={() => go({ category: article.category })} />
            ) : category ? (
              <CategoryView category={category} articles={articles.filter((entry) => entry.category === category.id)} onOpen={(id) => go({ article: id })} />
            ) : (
              <Home articles={articles} onOpen={(id) => go({ article: id })} onCategory={(id) => go({ category: id })} />
            )}
          </div>
        </div>
      )}

      {section === 'errors' && (
        <Card padding="none">
          <CardHeader
            title="Коды ошибок"
            hint="Все коды ошибок системы: что означает каждый и что делать дальше."
            description="Код показывается рядом с сообщением об ошибке. Назовите его поддержке — так проблему найдут быстрее."
            actions={<ButtonLink to="/errors" size="s">Посмотреть страницы ошибок</ButtonLink>}
          />
          <DataTable
            caption="Коды ошибок"
            rows={ERROR_ROWS}
            rowKey={(row) => row.code}
            columns={[
              { id: 'code', header: 'Код', width: 160, cell: (row) => <code className={styles.code}>{row.code}</code> },
              { id: 'title', header: 'Что случилось', primary: true, cell: (row) => <b className={styles.strong}>{row.title}</b> },
              { id: 'hint', header: 'Что делать', cell: (row) => row.hint },
            ]}
          />
        </Card>
      )}

      {section === 'about' && (
        <Card className={styles.about}>
          <CardHeader title="CRM ИТ Школы Ростелекома" hint="О системе: куда писать в поддержку, как защищены данные и как вернуть демо-данные." description="Система контроля взаимодействия с вузами по ИТ-направлениям." />
          <dl className={styles.facts}>
            <div>
              <dt>Поддержка</dt>
              <dd><a href="mailto:it-school-support@rt.ru">it-school-support@rt.ru</a></dd>
            </div>
            <div>
              <dt>Безопасность</dt>
              <dd>Вход через Keycloak, разграничение доступа по ролям, журнал действий. Соответствие 152-ФЗ и приказу ФСТЭК № 117.</dd>
            </div>
            <div>
              <dt>Демо-данные</dt>
              <dd>Изменения синхронизируются с сервером и кэшируются в браузере для работы при кратком обрыве связи. Верните исходные данные, если что-то пошло не так.</dd>
            </div>
          </dl>
          <Button
            tone="warning"
            icon={RefreshIcon}
            onClick={() => {
              resetState();
              window.location.reload();
            }}
          >
            Сбросить демо-данные
          </Button>
        </Card>
      )}
    </>
  );
}

function Home({ articles, onOpen, onCategory }) {
  const popular = POPULAR.map((id) => articles.find((item) => item.id === id)).filter(Boolean);
  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <span className={styles.heroIcon} aria-hidden="true"><HelpIcon size={28} fill="currentColor" /></span>
        <div>
          <h2 className={styles.heroTitle}>Чем помочь?</h2>
          <p className={styles.heroText}>{articles.length} {plural(articles.length, ['статья', 'статьи', 'статей'])} по всем разделам — с шагами и скриншотами. Впервые в системе — начните с курса новичка.</p>
        </div>
        <div className={styles.heroActions}>
          <Button variant="primary" icon={MagicIcon} onClick={startOnboarding}>Пройти курс новичка</Button>
          <Button icon={SearchIcon} onClick={() => askAssistant('')}>Спросить ИИ-помощника</Button>
        </div>
      </section>

      <section aria-labelledby="help-popular">
        <h2 id="help-popular" className={styles.sectionTitle}>Популярное</h2>
        <div className={styles.popular}>
          {popular.map((item) => (
            <button key={item.id} type="button" className={styles.popularItem} onClick={() => onOpen(item.id)}>
              <span className={styles.popularTitle}>{item.title}</span>
              <span className={styles.popularText}>{item.summary}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="help-categories">
        <h2 id="help-categories" className={styles.sectionTitle}>Разделы</h2>
        <div className={styles.categoryGrid}>
          {HELP_CATEGORIES.map((item) => {
            const count = articles.filter((entry) => entry.category === item.id).length;
            if (count === 0) return null;
            return (
              <button key={item.id} type="button" className={styles.categoryCard} onClick={() => onCategory(item.id)}>
                <span className={styles.categoryTitle}>{item.title}</span>
                <span className={styles.popularText}>{item.description}</span>
                <span className={styles.categoryCount}>{count} {plural(count, ['статья', 'статьи', 'статей'])}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CategoryView({ category, articles, onOpen }) {
  return (
    <section>
      <h2 className={styles.pageTitle}>{category.title}</h2>
      <p className={styles.lead}>{category.description}</p>
      <div className={styles.articleList}>
        {articles.map((item) => (
          <button key={item.id} type="button" className={styles.articleCard} onClick={() => onOpen(item.id)}>
            <span className={styles.popularTitle}>{item.title}</span>
            <span className={styles.popularText}>{item.summary}</span>
            <ArrowRightIcon size={18} fill="currentColor" className={styles.cardArrow} />
          </button>
        ))}
      </div>
    </section>
  );
}

function SearchResults({ results, query, onOpen }) {
  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchIcon}
        title="Ничего не нашлось"
        description="Попробуйте другие слова — или спросите ИИ-помощника, он поймёт вопрос своими словами."
        action={<Button icon={MagicIcon} onClick={() => askAssistant(query)}>Спросить помощника</Button>}
      />
    );
  }
  return (
    <section>
      <p className={styles.lead}>Найдено: {results.length}</p>
      <div className={styles.articleList}>
        {results.map((item) => (
          <button key={item.id} type="button" className={styles.articleCard} onClick={() => onOpen(item.id)}>
            <span className={styles.resultCategory}>{HELP_CATEGORIES.find((entry) => entry.id === item.category)?.title}</span>
            <span className={styles.popularTitle}>{item.title}</span>
            <span className={styles.popularText}>{item.summary}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ArticleView({ article, category, articles, onOpen, onCategory }) {
  const siblings = articles.filter((item) => item.category === article.category);
  const position = siblings.findIndex((item) => item.id === article.id);
  const previous = siblings[position - 1];
  const next = siblings[position + 1];
  const related = (article.related ?? []).map((id) => articles.find((item) => item.id === id)).filter(Boolean);

  return (
    <article className={styles.article} id={`help-${article.id}`}>
      <button type="button" className={styles.breadcrumb} onClick={onCategory}>
        <ArrowLeftIcon size={16} fill="currentColor" /> {category?.title}
      </button>
      <h2 className={styles.pageTitle}>{article.title}</h2>
      <p className={styles.lead}>{article.summary}</p>
      {article.permission && <p className={styles.audience}>Для руководителей и администраторов</p>}

      <ol className={styles.steps}>
        {article.steps.map((step) => <li key={step}>{rich(step)}</li>)}
      </ol>

      {article.image && (
        <figure className={styles.figure}>
          <a href={`/help/${article.image}`} target="_blank" rel="noreferrer" title="Открыть скриншот в полном размере">
            <img className={styles.screenshot} src={`/help/${article.image}`} alt={`Скриншот: ${article.title.toLowerCase()}`} loading="lazy" />
          </a>
        </figure>
      )}

      {article.tips?.length > 0 && (
        <InlineAlert tone="info" title="Полезно знать">
          <ul className={styles.tips}>{article.tips.map((tip) => <li key={tip}>{rich(tip)}</li>)}</ul>
        </InlineAlert>
      )}

      <div className={styles.articleActions}>
        {article.action && <Button variant="primary" icon={MagicIcon} onClick={() => askAssistant(article.action.prompt)}>{article.action.label}</Button>}
        <Button icon={HelpIcon} onClick={() => askAssistant('')}>Задать вопрос помощнику</Button>
      </div>

      {related.length > 0 && (
        <section className={styles.related} aria-labelledby="help-related">
          <h3 id="help-related" className={styles.relatedTitle}>Связанные статьи</h3>
          <div className={styles.relatedList}>
            {related.map((item) => (
              <button key={item.id} type="button" className={styles.relatedItem} onClick={() => onOpen(item.id)}>{item.title}</button>
            ))}
          </div>
        </section>
      )}

      <nav className={styles.pager} aria-label="Соседние статьи">
        {previous ? <button type="button" className={styles.pagerLink} onClick={() => onOpen(previous.id)}><ArrowLeftIcon size={16} fill="currentColor" /> {previous.title}</button> : <span />}
        {next && <button type="button" className={cn(styles.pagerLink, styles.pagerNext)} onClick={() => onOpen(next.id)}>{next.title} <ArrowRightIcon size={16} fill="currentColor" /></button>}
      </nav>
    </article>
  );
}

