import { useMemo, useState } from 'react';
import { formatNumber } from '../../domain/format.js';
import { useVisibleMetrics } from '../../store/selectors.js';
import { Person } from '../../ui/Avatar.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { Button } from '../../ui/Button.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { AddIcon, MailIcon, PhoneIcon, UsersIcon } from '../../ui/icons.js';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { ErrorPage } from '../errors/ErrorPage.jsx';
import { InteractionTable } from '../interactions/components/InteractionTable.jsx';
import { NewInteractionDialog } from '../interactions/NewInteractionDialog.jsx';
import { useUniversitySummaries } from './useUniversitySummaries.js';
import styles from './UniversityPage.module.css';

export function UniversityPage({ params }) {
  const summary = useUniversitySummaries().find((item) => item.id === params.id);
  if (!summary) return <ErrorPage code="NOT-FOUND-404" />;
  return <UniversityView summary={summary} />;
}

function UniversityView({ summary }) {
  const { university, rows, directions } = summary;
  const [creating, setCreating] = useState(false);
  const metrics = useVisibleMetrics(rows);

  const totals = useMemo(() => {
    const lastMonth = metrics.reduce((latest, metric) => (metric.month > latest ? metric.month : latest), '');
    const current = metrics.filter((metric) => metric.month === lastMonth);
    return {
      applications: metrics.reduce((sum, metric) => sum + metric.applications, 0),
      students: current.reduce((sum, metric) => sum + metric.students, 0),
      streams: current.reduce((sum, metric) => sum + metric.streams, 0),
    };
  }, [metrics]);

  return (
    <>
      <PageHeader
        back={{ to: '/universities', label: 'Все вузы' }}
        title={university.name}
        meta={
          <>
            {university.city && <Badge>{university.city}</Badge>}
            {directions.map((direction) => (
              <Badge key={direction.id} tone="brand">
                {direction.name}
              </Badge>
            ))}
          </>
        }
        actions={
          <Button variant="primary" icon={AddIcon} onClick={() => setCreating(true)}>
            Новое взаимодействие
          </Button>
        }
      />

      <section className={styles.stats} aria-label="Показатели из LMS">
        <Metric label="Заявок за год" value={totals.applications} />
        <Metric label="Обучающихся сейчас" value={totals.students} />
        <Metric label="Параллельных потоков" value={totals.streams} />
      </section>

      <div className={styles.layout}>
        <Card padding="none">
          <CardHeader title="Взаимодействия" description="Каждая строка — отдельное ИТ-направление и продукт." />
          <InteractionTable rows={rows} hiddenColumns={['university', 'updated']} />
        </Card>

        <Card>
          <CardHeader title="Контакты в вузе" />
          {university.contacts.length === 0 ? (
            <EmptyState icon={UsersIcon} title="Контактов нет" description="Добавьте ответственного от вуза через импорт справочника." />
          ) : (
            <ul className={styles.contacts}>
              {university.contacts.map((contact) => (
                <li key={contact.id} className={styles.contact}>
                  <Person name={contact.name} caption={contact.position} size="m" />
                  <a href={`mailto:${contact.email}`}>
                    <MailIcon size={16} fill="currentColor" />
                    {contact.email}
                  </a>
                  <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>
                    <PhoneIcon size={16} fill="currentColor" />
                    {contact.phone}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <NewInteractionDialog open={creating} onOpenChange={setCreating} defaults={{ universityId: university.id }} />
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{formatNumber(value)}</strong>
    </div>
  );
}
