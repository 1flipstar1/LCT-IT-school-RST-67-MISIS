import { useState } from 'react';
import { useRouter } from '../../app/router.jsx';
import { useActions } from '../../store/useActions.js';
import { Button } from '../../ui/Button.jsx';
import { Dialog } from '../../ui/Dialog.jsx';
import { ErrorAlert } from '../../ui/InlineAlert.jsx';
import { TrashIcon } from '../../ui/icons.js';
import { useToast } from '../../ui/Toast.jsx';

/** Подтверждение удаления заявки: вместе с ней уходят история и файлы, поэтому спрашиваем явно. */
export function DeleteInteractionDialog({ row, eventCount, open, onOpenChange }) {
  const actions = useActions();
  const toast = useToast();
  const { navigate } = useRouter();
  const [error, setError] = useState(null);

  const handleDelete = () => {
    try {
      const { undo } = actions.deleteInteraction({ interactionId: row.id });
      onOpenChange(false);
      navigate('/interactions');
      toast.success('Заявка удалена', { undo });
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="s"
      title="Удалить заявку?"
      description={`${row.university.name} · ${row.direction.name}`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button tone="warning" icon={TrashIcon} onClick={handleDelete}>Удалить</Button>
        </>
      }
    >
      <p>
        Заявка исчезнет из списков, доски и аналитики вместе с историей ({eventCount}&nbsp;зап.) и приложенными файлами.
        Запись об удалении останется в журнале действий.
      </p>
      <ErrorAlert error={error} />
    </Dialog>
  );
}
