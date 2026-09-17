import { useState } from 'react';
import { useManagers } from '../../store/selectors.js';
import { useActions } from '../../store/useActions.js';
import { Button } from '../../ui/Button.jsx';
import { Dialog, DialogForm } from '../../ui/Dialog.jsx';
import { SelectField } from '../../ui/Field.jsx';
import { ErrorAlert } from '../../ui/InlineAlert.jsx';
import { useToast } from '../../ui/Toast.jsx';

/** Смена ответственного — право руководителя (ТЗ, ролевая модель). */
export function AssignManagerDialog({ row, open, onOpenChange }) {
  const managers = useManagers();
  const actions = useActions();
  const toast = useToast();
  const [managerId, setManagerId] = useState(row.managerId ?? '');
  const [error, setError] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    try {
      const { undo } = actions.assignManager({ interactionId: row.id, managerId });
      onOpenChange(false);
      toast.success('Ответственный изменён', { undo });
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="s"
      title="Сменить ответственного"
      description="Новый ответственный увидит взаимодействие в своём списке и получит уведомление."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button variant="primary" type="submit" form="assign-form" disabled={managerId === row.managerId}>
            Назначить
          </Button>
        </>
      }
    >
      <DialogForm id="assign-form" onSubmit={handleSubmit}>
        <SelectField
          label="Менеджер"
          value={managerId}
          onChange={(event) => setManagerId(event.target.value)}
          options={managers.map((manager) => ({ value: manager.id, label: manager.name }))}
        />
        <ErrorAlert error={error} />
      </DialogForm>
    </Dialog>
  );
}
