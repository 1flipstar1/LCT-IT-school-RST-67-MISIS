import { useState } from 'react';
import { initials } from '../../domain/format.js';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { useToast } from '../../ui/Toast.jsx';
import { AddIcon, AdjustIcon, ChevronDownIcon, DownloadIcon, MoreIcon } from '../../ui/icons.js';
import { LEGACY_UNIVERSITIES } from './legacyData.js';
import { LegacyButton, LegacyScreen, PageHeader, SearchField, UniversityCell, UniversityModal } from './legacyUi.jsx';

/** Цвета статусов в таблице — по порядку строк, как в прежнем дизайне. */
const STATUS_TONES = ['purple', 'amber', 'blue', 'amber', 'blue', 'purple'];

const STATUSES = [...new Set(LEGACY_UNIVERSITIES.map((university) => university.status))];

/** «Мои вузы» прежнего дизайна (ветка main): поиск, фильтр по статусу в шапке таблицы и карточка вуза. */
export function UniversitiesScreen() {
  useDocumentTitle('Мои вузы — дизайн main');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [selected, setSelected] = useState(null);

  const needle = search.toLowerCase();
  const list = LEGACY_UNIVERSITIES.filter(
    (university) =>
      Object.values(university).join(' ').toLowerCase().includes(needle) &&
      (!statusFilter || university.status === statusFilter),
  );

  /** Клик по заголовку «Статус workflow» перебирает статусы и сбрасывает фильтр на последнем. */
  const cycleStatus = () =>
    setStatusFilter((current) => {
      const index = current ? STATUSES.indexOf(current) : -1;
      return index > -1 && index < STATUSES.length - 1 ? STATUSES[index + 1] : null;
    });

  return (
    <LegacyScreen>
      <PageHeader title="Мои вузы">
        <LegacyButton onClick={() => toast.success('Экспорт подготовлен')} icon={<DownloadIcon size={16} fill="currentColor" />}>
          Экспорт
        </LegacyButton>
        <LegacyButton primary onClick={() => toast.success('Открыта форма нового вуза')} icon={<AddIcon size={16} fill="currentColor" />}>
          Добавить вуз
        </LegacyButton>
      </PageHeader>

      <div className="toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Поиск по вузам, продуктам..." />
        <LegacyButton icon={<AdjustIcon size={16} fill="currentColor" />}>
          Фильтры <span className="filter-count">2</span>
        </LegacyButton>
      </div>

      <section className="panel table-panel">
        <table>
          <thead>
            <tr>
              <th>ВУЗ</th>
              <th>ПРОДУКТ / НАПРАВЛЕНИЕ</th>
              <th
                className={`sortable ${statusFilter ? 'active' : ''}`}
                onClick={cycleStatus}
                title={statusFilter ? `Фильтр: ${statusFilter}. Нажмите, чтобы сбросить` : 'Фильтр по статусу. Нажмите, чтобы применить'}
              >
                СТАТУС WORKFLOW
                {statusFilter && <em className="th-chip">{statusFilter}</em>}
                <ChevronDownIcon size={12} fill="currentColor" />
              </th>
              <th>МЕНЕДЖЕР</th>
              <th>ПОСЛЕДНЕЕ ИЗМЕНЕНИЕ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((university, index) => (
              <tr key={university.name} onClick={() => setSelected(university.name)}>
                <td>
                  <UniversityCell name={university.name} />
                </td>
                <td>
                  <b>{university.product}</b>
                  <span className="subtext">{university.direction}</span>
                </td>
                <td>
                  <span className={`status-tag ${STATUS_TONES[index % STATUS_TONES.length]}`}>{university.status}</span>
                </td>
                <td>
                  <span className="person">
                    <span className="avatar tiny">{initials(university.manager)}</span>
                    {university.manager}
                  </span>
                </td>
                <td className="muted">{university.updatedAt}</td>
                <td>
                  <MoreIcon size={18} fill="#9ba6b5" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <span>
            Показано {list.length ? 1 : 0}–{Math.min(6, list.length)} из {list.length}
          </span>
          <div>
            <button>‹</button>
            <button className="selected-page">1</button>
            <button>2</button>
            <button>3</button>
            <button>4</button>
            <button>›</button>
          </div>
        </div>
      </section>

      <UniversityModal
        university={selected}
        onClose={() => setSelected(null)}
        onSave={() => toast.success('Изменения сохранены')}
      />
    </LegacyScreen>
  );
}
