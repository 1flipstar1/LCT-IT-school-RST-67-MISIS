import { useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { ERROR_CODES } from '../../domain/errors.js';
import { PERMISSION } from '../../domain/roles.js';
import { resetState } from '../../store/persistence.js';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { Hint } from '../../ui/Hint.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { RefreshIcon } from '../../ui/icons.js';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import { ADMIN_GUIDE, USER_GUIDE } from './guides.js';
import styles from './HelpPage.module.css';

const ERROR_ROWS = Object.entries(ERROR_CODES).map(([code, info]) => ({ code, ...info }));

export function HelpPage() {
  const { query, pathname, navigate } = useRouter();
  const { can } = useSession();

  const sections = [
    { value: 'user', label: 'Руководство пользователя' },
    ...(can(PERMISSION.manageWorkflows) ? [{ value: 'admin', label: 'Руководство администратора' }] : []),
    { value: 'errors', label: 'Коды ошибок' },
    { value: 'about', label: 'О системе' },
  ];
  const section = sections.some((item) => item.value === query.get('section')) ? query.get('section') : 'user';

  return (
    <>
      <PageHeader title="Справка" hint="Короткие инструкции по основным задачам. Если что-то не получается — найдите код ошибки или напишите в поддержку." />

      <Tabs label="Разделы справки" tabs={sections} value={section} onChange={(value) => navigate(`${pathname}?section=${value}`)} className={styles.tabs} />

      {section === 'user' && <Guide articles={USER_GUIDE} />}
      {section === 'admin' && <Guide articles={ADMIN_GUIDE} />}

      {section === 'errors' && (
        <Card padding="none">
          <CardHeader title="Коды ошибок" hint="Все коды ошибок системы: что означает каждый и что делать дальше." description="Код показывается рядом с сообщением об ошибке. Назовите его поддержке — так проблему найдут быстрее."
            actions={
              <ButtonLink to="/errors" size="s">
                Посмотреть страницы ошибок
              </ButtonLink>
            }
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
              <dd>
                <a href="mailto:it-school-support@rt.ru">it-school-support@rt.ru</a>
              </dd>
            </div>
            <div>
              <dt>Безопасность</dt>
              <dd>Вход через Keycloak, разграничение доступа по ролям, журнал действий. Соответствие 152-ФЗ и приказу ФСТЭК № 117.</dd>
            </div>
            <div>
              <dt>Демо-данные</dt>
              <dd>Изменения на демо-стенде хранятся в браузере. Верните исходные данные, если что-то пошло не так.</dd>
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

function Guide({ articles }) {
  return (
    <div className={styles.guide}>
      <nav className={styles.toc} aria-label="Содержание">
        <p className={styles.tocTitle}>Содержание</p>
        {articles.map((article) => (
          <a
            key={article.id}
            href={`#help-${article.id}`}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(`help-${article.id}`)?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {article.title}
          </a>
        ))}
      </nav>
      <div className={styles.articles}>
        {articles.map((article) => (
          <Card as="article" key={article.id} id={`help-${article.id}`} className={styles.article}>
            <Hint text={article.hint}>
              <h2 className={styles.articleTitle}>{article.title}</h2>
            </Hint>
            <ol className={styles.steps}>
              {article.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <img className={styles.screenshot} src={`/help/${article.image}`} alt={`Скриншот: ${article.title.toLowerCase()}`} loading="lazy" />
          </Card>
        ))}
      </div>
    </div>
  );
}
