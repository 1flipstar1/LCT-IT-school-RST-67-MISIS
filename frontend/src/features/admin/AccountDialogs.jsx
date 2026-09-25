import { useEffect, useState } from 'react';
import { describeError } from '../../domain/errors.js';
import { DATA_SCOPE, DATA_SCOPE_LABEL, ROLE, ROLE_INFO } from '../../domain/roles.js';
import { Button } from '../../ui/Button.jsx';
import { Dialog, DialogForm } from '../../ui/Dialog.jsx';
import { SelectMenuField, TextField } from '../../ui/Field.jsx';
import { CheckIcon, CopyIcon } from '../../ui/icons.js';
import { InlineAlert } from '../../ui/InlineAlert.jsx';
import { MultiSelectFilter } from '../../ui/MultiSelectFilter.jsx';
import styles from './UsersPage.module.css';

const DEFAULT_SCOPE = { [ROLE.manager]: DATA_SCOPE.own, [ROLE.lead]: DATA_SCOPE.team, [ROLE.admin]: DATA_SCOPE.all };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const USERNAME = /^[a-zA-Z0-9._-]{3,60}$/;

const emptyForm = (isAdmin, currentUser) => ({
  name: '',
  email: '',
  username: '',
  role: ROLE.manager,
  leadId: isAdmin ? '' : currentUser.id,
  scope: DATA_SCOPE.own,
  directionIds: [],
});

/** Новый сотрудник: учётная запись в Keycloak с временным паролем и карточка в CRM. */
export function CreateAccountDialog({ open, onOpenChange, isAdmin, currentUser, leads, directions, keycloak, onCreate }) {
  const [form, setForm] = useState(() => emptyForm(isAdmin, currentUser));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyForm(isAdmin, currentUser));
      setErrors({});
      setSubmitError(null);
    }
  }, [open, isAdmin, currentUser]);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const loginPreview = form.username || form.email.split('@')[0] || 'логин';

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (form.name.trim().split(/\s+/).length < 2) nextErrors.name = 'Укажите имя и фамилию.';
    if (!EMAIL.test(form.email.trim())) nextErrors.email = 'Укажите рабочую почту, например i.ivanov@rt.ru.';
    if (form.username && !USERNAME.test(form.username)) nextErrors.username = 'Латиница, цифры, точка, дефис или подчёркивание; от 3 символов.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    setSubmitError(null);
    try {
      await onCreate({
        name: form.name.trim().replace(/\s+/g, ' '),
        email: form.email.trim().toLowerCase(),
        username: form.username.trim() || null,
        role: form.role,
        leadId: form.role === ROLE.manager ? form.leadId || null : null,
        access: { scope: form.scope, directionIds: form.directionIds },
      });
    } catch (error) {
      setSubmitError(error?.message || describeError(error).title);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Новый сотрудник"
      description={keycloak ? 'Создадим учётную запись в Keycloak и выдадим временный пароль — при первом входе сотрудник задаст свой.' : 'Keycloak не подключён: будет создана только карточка в CRM.'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Отмена</Button>
          <Button variant="primary" type="submit" form="create-account" disabled={busy}>{busy ? 'Создаём…' : 'Создать'}</Button>
        </>
      }
    >
      <DialogForm id="create-account" onSubmit={submit}>
        <TextField label="Имя и фамилия" required value={form.name} error={errors.name} autoComplete="off" onChange={(event) => set({ name: event.target.value })} placeholder="Мария Иванова" />
        <TextField label="Рабочая почта" required type="email" value={form.email} error={errors.email} autoComplete="off" onChange={(event) => set({ email: event.target.value })} placeholder="m.ivanova@rt.ru" />
        <TextField label="Логин" value={form.username} error={errors.username} hint={`Если не заполнить — «${loginPreview}». Войти можно и по почте.`} autoComplete="off" onChange={(event) => set({ username: event.target.value })} />
        {isAdmin ? (
          <SelectMenuField
            label="Роль"
            value={form.role}
            hint={ROLE_INFO[form.role].description}
            options={Object.values(ROLE).map((role) => ({ value: role, label: ROLE_INFO[role].label }))}
            onChange={(role) => set({ role, scope: DEFAULT_SCOPE[role] })}
          />
        ) : (
          <InlineAlert tone="info" title="Роль: менеджер вашей команды">Руководитель заводит менеджеров к себе в команду. Другие роли назначает администратор.</InlineAlert>
        )}
        {isAdmin && form.role === ROLE.manager && (
          <SelectMenuField
            label="Руководитель"
            value={form.leadId}
            options={[{ value: '', label: 'Не назначен' }, ...leads.map((lead) => ({ value: lead.id, label: lead.name }))]}
            onChange={(leadId) => set({ leadId })}
          />
        )}
        {isAdmin && (
          <SelectMenuField
            label="Видит данные"
            value={form.scope}
            options={Object.values(DATA_SCOPE).map((scope) => ({ value: scope, label: DATA_SCOPE_LABEL[scope] }))}
            onChange={(scope) => set({ scope })}
          />
        )}
        <div className={styles.field}>
          <span className={styles.fieldLabel}>ИТ-направления</span>
          <MultiSelectFilter
            label={form.directionIds.length ? 'Только выбранные' : 'Все направления'}
            ariaLabel="Ограничить ИТ-направления"
            options={directions.map((direction) => ({ value: direction.id, label: direction.name }))}
            value={form.directionIds}
            onChange={(directionIds) => set({ directionIds })}
          />
        </div>
        {submitError && <InlineAlert tone="danger" title="Не удалось создать">{submitError}</InlineAlert>}
      </DialogForm>
    </Dialog>
  );
}

/** Временный пароль показывается один раз: его нужно передать сотруднику лично. */
export function PasswordDialog({ issued, onClose }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [issued]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog
      open={Boolean(issued)}
      onOpenChange={(open) => !open && onClose()}
      title={issued?.created ? 'Сотрудник создан' : 'Новый временный пароль'}
      description={issued ? `${issued.user.name} · ${issued.user.email}` : ''}
      footer={<Button variant="primary" onClick={onClose}>Готово</Button>}
    >
      {issued && (
        <div className={styles.issued}>
          <p className={styles.issuedText}>Передайте данные сотруднику лично. Пароль показывается только сейчас — потом его можно только выдать заново.</p>
          <dl className={styles.credentials}>
            {issued.user.username && (<><dt>Логин</dt><dd>{issued.user.username}</dd></>)}
            <dt>Временный пароль</dt>
            <dd className={styles.password}>
              <code>{issued.password}</code>
              <Button size="s" variant="ghost" icon={copied ? CheckIcon : CopyIcon} onClick={copy}>{copied ? 'Скопирован' : 'Скопировать'}</Button>
            </dd>
          </dl>
          <InlineAlert tone="info" title="Что дальше">
            Сотрудник нажимает «Войти через Keycloak», вводит логин или почту и этот пароль — и сразу задаёт свой. Прежние сессии при смене пароля не сохраняются.
          </InlineAlert>
        </div>
      )}
    </Dialog>
  );
}
