import { useState } from 'react';
import { initials } from '../../domain/format.js';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { useToast } from '../../ui/Toast.jsx';
import { AddIcon, AdjustIcon, MoreIcon } from '../../ui/icons.js';
import { LEGACY_STAGES, searchCards } from './legacyData.js';
import { LegacyButton, LegacyScreen, PageHeader, SearchField, UniversityModal } from './legacyUi.jsx';
import { useLegacyCards } from './useLegacyCards.js';

/**
 * Доска Workflow прежнего дизайна (ветка main): 13 колонок по этапам, карточки переносятся
 * мышью между колонками, клик открывает карточку вуза.
 */
export function WorkflowScreen() {
  useDocumentTitle('Workflow — дизайн main');
  const toast = useToast();
  const { cards, moveCard } = useLegacyCards();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const visibleCards = searchCards(cards, search);

  return (
    <LegacyScreen>
      <PageHeader title="Workflow">
        <LegacyButton icon={<AdjustIcon size={16} fill="currentColor" />}>Фильтры</LegacyButton>
        <LegacyButton primary icon={<AddIcon size={16} fill="currentColor" />}>
          Добавить
        </LegacyButton>
      </PageHeader>

      <div className="workflow-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Поиск взаимодействий..." />
        <div className="view-switch">
          <button className="active">Доска</button>
          <button>Список</button>
        </div>
        <span className="live">
          <i /> Синхронизация включена
        </span>
      </div>

      <div className="board">
        {LEGACY_STAGES.map((stage) => {
          const stageCards = visibleCards.filter((card) => card.stage === stage.id);
          return (
            <div
              className="board-col"
              key={stage.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => moveCard(Number(event.dataTransfer.getData('id')), stage.id)}
            >
              <div className="col-head">
                <span className="stage-dot" style={{ background: stage.color }} />
                <b title={stage.label}>{stage.label}</b>
                <span className="col-count">{stageCards.length}</span>
                <MoreIcon size={16} fill="currentColor" />
              </div>
              <div className="card-list">
                {stageCards.map((card) => (
                  <div
                    className="work-card"
                    key={card.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('id', card.id)}
                    onClick={() => setSelected(card.university)}
                  >
                    <div className="card-top">
                      <span className="mini-logo">{card.initials}</span>
                      <MoreIcon size={16} fill="currentColor" />
                    </div>
                    <b className="card-title">{card.university}</b>
                    <span className="card-product">
                      {card.product} <i /> {card.direction}
                    </span>
                    <div className="card-foot">
                      <span className="person">
                        <span className="avatar tiny">{initials(card.owner)}</span>
                        {card.owner}
                      </span>
                      <span className="card-time">{card.days} дн.</span>
                    </div>
                  </div>
                ))}
              </div>
              <button className="add-card">
                <AddIcon size={15} fill="currentColor" /> Добавить
              </button>
            </div>
          );
        })}
      </div>

      <UniversityModal
        university={selected}
        onClose={() => setSelected(null)}
        onSave={() => toast.success('Изменения сохранены')}
      />
    </LegacyScreen>
  );
}
