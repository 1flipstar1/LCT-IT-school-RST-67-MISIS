import { usePersistentState } from '../../lib/usePersistentState.js';
import { useToast } from '../../ui/Toast.jsx';
import { LEGACY_CARDS } from './legacyData.js';

/**
 * Карточки доски прежнего дизайна. В main они лежали в состоянии одного компонента App,
 * здесь у каждого экрана свой адрес, поэтому состояние хранится в localStorage:
 * перевод карточки на доске виден и на дашборде, и после перезагрузки страницы.
 */
export function useLegacyCards() {
  const [cards, setCards] = usePersistentState('legacy.cards', LEGACY_CARDS);
  const toast = useToast();

  const moveCard = (id, stage) => {
    setCards((current) => current.map((card) => (card.id === id ? { ...card, stage } : card)));
    toast.success('Статус взаимодействия обновлён');
  };

  return { cards, moveCard };
}
