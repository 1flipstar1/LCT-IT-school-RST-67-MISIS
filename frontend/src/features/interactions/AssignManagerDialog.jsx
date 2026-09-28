import { useState } from 'react';
import { useManagers } from '../../store/selectors.js';
import { useActions } from '../../store/useActions.js';
import { Button } from '../../ui/Button.jsx';
import { Dialog, DialogForm } from '../../ui/Dialog.jsx';
import { SelectField } from '../../ui/Field.jsx';
import { ErrorAlert } from '../../ui/InlineAlert.jsx';
import { useToast } from '../../ui/Toast.jsx';

/** Смена ответственного — право руководителя (ТЗ, ролевая модель: ответственных «менять, удалять, назначать»). */
export function AssignManagerDialog({ row, open, onOpenChange }) {
  const managers = useManagers();
  const actions = useActions();
  const toast = useToast();
  const [managerId, setManagerId] = useState(row.managerId ?? '');
  const [error, setError] = useState(null);

  const assign = (nextManagerId) => {
    try {
      const { undo } = actions.assignManager({ interactionId: row.id, managerId: nextManagerId });
      onOpenChange(false);
      toast.success(nextManagerId ? 'Ответственный изменён' : 'Ответственный снят', { undo });
    } catch (caught) {
      setError(caught);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    assign(managerId);
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
          {row.managerId && (
            <Button variant="ghost" tone="warning" onClick={() => assign(null)}>Снять ответственного</Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button variant="primary" type="submit" form="assign-form" disabled={!managerId || managerId === row.managerId}>
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
          placeholder="Выберите менеджера"
        />
        <ErrorAlert error={error} />
      </DialogForm>
    </Dialog>
  );
}
