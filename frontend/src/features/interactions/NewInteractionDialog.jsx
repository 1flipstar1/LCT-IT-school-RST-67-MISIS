import { useState } from 'react';
import { useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { ROLE } from '../../domain/roles.js';
import { useManagers } from '../../store/selectors.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { Button } from '../../ui/Button.jsx';
import { Dialog, DialogForm } from '../../ui/Dialog.jsx';
import { SelectField, TextAreaField, TextField } from '../../ui/Field.jsx';
import { useToast } from '../../ui/Toast.jsx';

const NEW_UNIVERSITY = '__new__';

const toOptions = (items, label = (item) => item.name) => items.map((item) => ({ value: item.id, label: label(item) }));

/** Создание взаимодействия: пять обязательных полей и сразу переход в карточку. */
export function NewInteractionDialog({ open, onOpenChange, defaults = {} }) {
  const { universities, directions, products, workflows } = useStoreState();
  const managers = useManagers();
  const { user, role } = useSession();
  const actions = useActions();
  const toast = useToast();
  const { navigate } = useRouter();

  const initialForm = {
    universityId: defaults.universityId ?? '',
    newUniversityName: '',
    directionId: defaults.directionId ?? '',
    productId: defaults.productId ?? '',
    workflowId: workflows[0].id,
    managerId: role === ROLE.manager ? user.id : '',
    comment: '',
  };
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const isNewUniversity = form.universityId === NEW_UNIVERSITY;

  const errors = {
    universityId: !form.universityId && 'Выберите вуз',
    newUniversityName: isNewUniversity && !form.newUniversityName.trim() && 'Введите название вуза',
    directionId: !form.directionId && 'Выберите ИТ-направление',
    productId: !form.productId && 'Выберите ИТ-продукт',
    managerId: !form.managerId && 'Назначьте ответственного',
  };
  const visibleError = (field) => (submitted ? errors[field] || undefined : undefined);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;

    const id = actions.createInteraction({
      ...form,
      universityId: isNewUniversity ? null : form.universityId,
      newUniversityName: isNewUniversity ? form.newUniversityName : '',
    });
    toast.success('Взаимодействие создано');
    onOpenChange(false);
    setForm(initialForm);
    setSubmitted(false);
    navigate(`/interactions/${id}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Новое взаимодействие"
      description="Взаимодействие — это работа с одним вузом по одному ИТ-направлению и продукту."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button variant="primary" type="submit" form="new-interaction-form">
            Создать
          </Button>
        </>
      }
    >
      <DialogForm id="new-interaction-form" onSubmit={handleSubmit}>
        <SelectField
          label="Вуз"
          required
          placeholder="Выберите вуз"
          value={form.universityId}
          onChange={update('universityId')}
          options={[...toOptions(universities), { value: NEW_UNIVERSITY, label: '+ Добавить новый вуз' }]}
          error={visibleError('universityId')}
        />
        {isNewUniversity && (
          <TextField
            label="Название нового вуза"
            required
            value={form.newUniversityName}
            onChange={update('newUniversityName')}
            placeholder="Например, Пермский политехнический университет"
            error={visibleError('newUniversityName')}
          />
        )}
        <SelectField
          label="ИТ-направление"
          required
          placeholder="Выберите направление"
          value={form.directionId}
          onChange={update('directionId')}
          options={toOptions(directions)}
          error={visibleError('directionId')}
        />
        <SelectField
          label="ИТ-продукт"
          required
          placeholder="Выберите продукт"
          value={form.productId}
          onChange={update('productId')}
          options={toOptions(products, (product) => `${product.name} — ${product.vendor}`)}
          error={visibleError('productId')}
        />
        <SelectField
          label="Этапы работы"
          value={form.workflowId}
          onChange={update('workflowId')}
          options={toOptions(workflows, (workflow) => `${workflow.name} (${workflow.stages.length} этапов)`)}
          hint="Набор этапов, по которым пойдёт работа."
        />
        <SelectField
          label="Ответственный"
          required
          placeholder="Выберите менеджера"
          value={form.managerId}
          onChange={update('managerId')}
          options={toOptions(role === ROLE.manager ? [user] : managers)}
          disabled={role === ROLE.manager}
          hint={role === ROLE.manager ? 'Вы будете ответственным. Сменить может руководитель.' : undefined}
          error={visibleError('managerId')}
        />
        <TextAreaField label="Комментарий" rows={3} value={form.comment} onChange={update('comment')} placeholder="С чего начинаем, кто инициатор" />
      </DialogForm>
    </Dialog>
  );
}
