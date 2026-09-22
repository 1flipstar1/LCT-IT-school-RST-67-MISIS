import { useMemo, useState } from 'react';
import { useSession } from '../../auth/SessionProvider.jsx';
import { PERMISSION } from '../../domain/roles.js';
import { useManagers } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { Button } from '../../ui/Button.jsx';
import { Dialog, DialogForm } from '../../ui/Dialog.jsx';
import { Checkbox, SelectField } from '../../ui/Field.jsx';
import { ErrorAlert, InlineAlert } from '../../ui/InlineAlert.jsx';
import { useToast } from '../../ui/Toast.jsx';
import styles from './EditInteractionDialog.module.css';

const toOptions = (items, label = (item) => item.name) => items.map((item) => ({ value: item.id, label: label(item) }));
const sameIds = (left, right) => left.length === right.length && left.every((id) => right.includes(id));

export function EditInteractionDialog({ row, open, onOpenChange }) {
  const { universities, directions, programs, products } = useStoreState();
  const managers = useManagers();
  const session = useSession();
  const actions = useActions();
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    universityId: row.universityId,
    directionId: row.directionId,
    programId: row.programId,
    productId: row.productId,
    managerId: row.managerId,
    contactIds: row.contactIds ?? [],
  }));
  const [error, setError] = useState(null);
  const selectedUniversity = useMemo(
    () => universities.find((university) => university.id === form.universityId),
    [universities, form.universityId],
  );
  const contacts = selectedUniversity?.contacts ?? [];

  const update = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'universityId' ? { contactIds: [] } : null),
      ...(field === 'directionId' ? { programId: '', productId: '' } : null),
      ...(field === 'programId' ? { productId: '' } : null),
    }));
  };
  const availablePrograms = programs.filter((program) => program.directionId === form.directionId);
  const selectedProgram = programs.find((program) => program.id === form.programId);
  const availableProducts = products.filter((product) => selectedProgram?.productIds.includes(product.id));
  const toggleContact = (contactId, checked) => {
    setForm((current) => ({
      ...current,
      contactIds: checked ? [...current.contactIds, contactId] : current.contactIds.filter((id) => id !== contactId),
    }));
  };
  const unchanged =
    form.universityId === row.universityId &&
    form.directionId === row.directionId &&
    form.programId === row.programId &&
    form.productId === row.productId &&
    form.managerId === row.managerId &&
    sameIds(form.contactIds, row.contactIds ?? []);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError(null);
    try {
      const { undo } = actions.updateInteraction({ interactionId: row.id, ...form });
      onOpenChange(false);
      toast.success('Параметры заявки сохранены', undo ? { undo } : undefined);
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="l"
      title="Редактировать параметры"
      description="Изменения сразу появятся в карточке и будут записаны в историю."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            variant="primary"
            type="submit"
            form="edit-interaction-form"
            disabled={unchanged || !form.universityId || !form.directionId || !form.programId || !form.productId || !form.managerId}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <DialogForm id="edit-interaction-form" onSubmit={handleSubmit}>
        <div className={styles.grid}>
          <SelectField
            className={styles.wide}
            label="Вуз"
            required
            value={form.universityId}
            onChange={update('universityId')}
            options={toOptions(universities, (university) => `${university.shortName} — ${university.name}`)}
          />
          <SelectField
            label="ИТ-направление"
            required
            value={form.directionId}
            onChange={update('directionId')}
            options={toOptions(directions)}
          />
          <SelectField
            label="ИТ-программа"
            required
            placeholder={form.directionId ? 'Выберите программу' : 'Сначала выберите направление'}
            value={form.programId}
            onChange={update('programId')}
            options={toOptions(availablePrograms)}
            disabled={!form.directionId}
          />
          <SelectField
            label="ИТ-продукт"
            required
            value={form.productId}
            onChange={update('productId')}
            options={toOptions(availableProducts, (product) => `${product.name} — ${product.vendor}`)}
            disabled={!form.programId}
          />
          {session.can(PERMISSION.assignManager) && (
            <SelectField
              className={styles.wide}
              label="Ответственный"
              required
              value={form.managerId}
              onChange={update('managerId')}
              options={toOptions(managers)}
            />
          )}
        </div>

        <fieldset className={styles.contacts}>
          <legend>Контактные лица вуза</legend>
          {contacts.length > 0 ? (
            <div className={styles.contactList}>
              {contacts.map((contact) => (
                <Checkbox
                  key={contact.id}
                  checked={form.contactIds.includes(contact.id)}
                  onChange={(checked) => toggleContact(contact.id, checked)}
                  label={contact.name}
                  description={`${contact.position} · ${contact.email}`}
                />
              ))}
            </div>
          ) : (
            <InlineAlert>У выбранного вуза пока нет контактных лиц в справочнике.</InlineAlert>
          )}
        </fieldset>
        <ErrorAlert error={error} />
      </DialogForm>
    </Dialog>
  );
}
