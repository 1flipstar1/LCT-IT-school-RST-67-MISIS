import { useMemo, useState } from 'react';
import { useSession } from '../../auth/SessionProvider.jsx';
import { PERMISSION } from '../../domain/roles.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { useManagers } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { Card } from '../../ui/Card.jsx';
import { DataTable } from '../../ui/DataTable.jsx';
import { SearchField } from '../../ui/Field.jsx';
import { DownloadIcon, UploadIcon } from '../../ui/icons.js';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import styles from './CatalogsPage.module.css';
import { downloadImportTemplate } from './importTemplate.js';

/** Справочники из ТЗ: вузы, ИТ-направления, ИТ-продукты и ответственные. Обновляются импортом из Excel. */
export function CatalogsPage() {
  const { universities, directions, products, interactions } = useStoreState();
  const managers = useManagers();
  const { can } = useSession();
  const [tab, setTab] = usePersistentState('catalogs:tab', 'universities');
  const [query, setQuery] = useState('');

  const usage = useMemo(() => {
    const count = (key) => interactions.reduce((map, item) => map.set(item[key], (map.get(item[key]) ?? 0) + 1), new Map());
    return { universityId: count('universityId'), directionId: count('directionId'), productId: count('productId'), managerId: count('managerId') };
  }, [interactions]);

  const catalogs = {
    universities: {
      label: 'Вузы',
      rows: universities,
      search: (item) => `${item.name} ${item.shortName} ${item.city}`,
      columns: [
        { id: 'name', header: 'Название', primary: true, cell: (item) => <b className={styles.strong}>{item.name}</b> },
        { id: 'short', header: 'Сокращение', cell: (item) => item.shortName },
        { id: 'city', header: 'Город', cell: (item) => item.city || '—' },
        { id: 'contacts', header: 'Контактов', align: 'right', cell: (item) => item.contacts.length },
        { id: 'usage', header: 'Взаимодействий', align: 'right', cell: (item) => usage.universityId.get(item.id) ?? 0 },
      ],
    },
    directions: {
      label: 'ИТ-направления',
      rows: directions,
      search: (item) => item.name,
      columns: [
        { id: 'name', header: 'Направление', primary: true, cell: (item) => <b className={styles.strong}>{item.name}</b> },
        { id: 'usage', header: 'Взаимодействий', align: 'right', cell: (item) => usage.directionId.get(item.id) ?? 0 },
      ],
    },
    products: {
      label: 'ИТ-продукты',
      rows: products,
      search: (item) => `${item.name} ${item.vendor}`,
      columns: [
        { id: 'name', header: 'Продукт (ПО)', primary: true, cell: (item) => <b className={styles.strong}>{item.name}</b> },
        { id: 'vendor', header: 'Вендор', cell: (item) => item.vendor },
        { id: 'usage', header: 'Взаимодействий', align: 'right', cell: (item) => usage.productId.get(item.id) ?? 0 },
      ],
    },
    managers: {
      label: 'Ответственные',
      rows: managers,
      search: (item) => `${item.name} ${item.email}`,
      columns: [
        { id: 'name', header: 'Менеджер ИТ Школы', primary: true, cell: (item) => <b className={styles.strong}>{item.name}</b> },
        { id: 'email', header: 'Почта', cell: (item) => item.email },
        { id: 'usage', header: 'Ведёт взаимодействий', align: 'right', cell: (item) => <Badge tone="brand">{usage.managerId.get(item.id) ?? 0}</Badge> },
      ],
    },
  };

  const current = catalogs[tab] ?? catalogs.universities;
  const normalizedQuery = query.trim().toLowerCase();
  const rows = normalizedQuery ? current.rows.filter((item) => current.search(item).toLowerCase().includes(normalizedQuery)) : current.rows;

  return (
    <>
      <PageHeader
        title="Справочники"
        actions={
          can(PERMISSION.importCatalogs) && (
            <>
              <Button icon={DownloadIcon} onClick={downloadImportTemplate}>
                Шаблон Excel
              </Button>
              <ButtonLink to="/catalogs/import" variant="primary" icon={UploadIcon}>
                Загрузить из Excel
              </ButtonLink>
            </>
          )
        }
      />

      <Card padding="none">
        <div className={styles.head}>
          <Tabs
            label="Справочники"
            value={tab}
            onChange={(value) => {
              setTab(value);
              setQuery('');
            }}
            tabs={Object.entries(catalogs).map(([value, catalog]) => ({ value, label: catalog.label, count: catalog.rows.length }))}
          />
          <SearchField className={styles.search} value={query} onChange={setQuery} placeholder={`Поиск: ${current.label.toLowerCase()}`} />
        </div>
        <DataTable caption={current.label} columns={current.columns} rows={rows} />
      </Card>
    </>
  );
}
