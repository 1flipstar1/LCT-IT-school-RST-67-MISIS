import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { ArrowRightIcon, CatalogIcon, EducationIcon, UsersIcon } from '../../ui/icons.js';
import { LegacyScreen, PageHeader } from './legacyUi.jsx';

const CATALOGS = [
  { title: 'ИТ-продукты', count: '12 записей', Icon: CatalogIcon, note: 'МойОфис, Р7-Офис, Контур' },
  { title: 'ИТ-направления', count: '8 записей', Icon: EducationIcon, note: 'Программная инженерия, Аналитика данных' },
  { title: 'Ответственные', count: '16 записей', Icon: UsersIcon, note: 'Команда KAM и представители вузов' },
];

/** «Каталоги» прежнего дизайна (ветка main): три карточки справочников. */
export function CatalogsScreen() {
  useDocumentTitle('Каталоги — дизайн main');

  return (
    <LegacyScreen>
      <PageHeader title="Каталоги" />
      <div className="catalog-grid">
        {CATALOGS.map(({ title, count, Icon, note }) => (
          <div className="catalog-card" key={title}>
            <Icon fill="currentColor" />
            <span>{count}</span>
            <h2>{title}</h2>
            <p>{note}</p>
            <ArrowRightIcon size={18} fill="currentColor" />
          </div>
        ))}
      </div>
    </LegacyScreen>
  );
}
