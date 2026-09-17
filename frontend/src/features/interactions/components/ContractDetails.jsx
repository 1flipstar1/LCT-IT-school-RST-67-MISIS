import { useState } from 'react';
import { TRANSFER_STATUSES } from '../../../domain/contract.js';
import { formatDate } from '../../../domain/format.js';
import { useActions } from '../../../store/useActions.js';
import { Button } from '../../../ui/Button.jsx';
import { SelectField, TextAreaField, TextField } from '../../../ui/Field.jsx';
import { EditIcon } from '../../../ui/icons.js';
import { useToast } from '../../../ui/Toast.jsx';
import styles from './ContractDetails.module.css';

/**
 * Данные договора — те же поля, что в шаблоне импорта из ТЗ:
 * вендор, ПО, номер договора, подписание лицензии, срок лицензии, статус передачи, комментарий.
 */
export function ContractDetails({ row }) {
  const actions = useActions();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(row));

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const startEditing = () => {
    setForm(toForm(row));
    setEditing(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const { undo } = actions.updateInteraction({
      interactionId: row.id,
      patch: {
        comment: form.comment,
        contract: {
          number: form.number.trim(),
          licenseSignedAt: form.licenseSignedAt,
          licenseYears: form.licenseYears ? Number(form.licenseYears) : null,
          transferStatus: form.transferStatus,
        },
      },
    });
    setEditing(false);
    toast.success('Данные договора сохранены', { undo });
  };

  if (!editing) {
    const { contract } = row;
    const items = [
      ['Вендор', row.product.vendor],
      ['ПО', row.product.name],
      ['Номер договора', contract.number || 'Не указан'],
      ['Подписание лицензии', contract.licenseSignedAt ? formatDate(contract.licenseSignedAt) : 'Не подписана'],
      ['Срок действия лицензии', contract.licenseYears ? `${contract.licenseYears} г.` : '—'],
      ['Статус передачи', contract.transferStatus],
      ['Комментарий', row.comment || '—'],
    ];
    return (
      <div className={styles.details}>
        <dl className={styles.list}>
          {items.map(([term, value]) => (
            <div key={term} className={styles.item}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <Button icon={EditIcon} onClick={startEditing}>
          Изменить данные
        </Button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.grid}>
        <TextField label="Вендор" value={row.product.vendor} disabled hint="Берётся из справочника ИТ-продуктов" />
        <TextField label="ПО" value={row.product.name} disabled />
        <TextField label="Номер договора" value={form.number} onChange={update('number')} placeholder="РТК-ИТШ-2026/001" />
        <TextField label="Подписание лицензии" type="date" value={form.licenseSignedAt} onChange={update('licenseSignedAt')} />
        <TextField label="Срок действия лицензии, лет" type="number" min={1} max={10} value={form.licenseYears} onChange={update('licenseYears')} />
        <SelectField
          label="Статус передачи"
          value={form.transferStatus}
          onChange={update('transferStatus')}
          options={TRANSFER_STATUSES.map((status) => ({ value: status, label: status }))}
        />
      </div>
      <TextAreaField label="Комментарий" rows={3} value={form.comment} onChange={update('comment')} />
      <div className={styles.actions}>
        <Button onClick={() => setEditing(false)}>Отмена</Button>
        <Button variant="primary" type="submit">
          Сохранить
        </Button>
      </div>
    </form>
  );
}

function toForm(row) {
  return {
    number: row.contract.number,
    licenseSignedAt: row.contract.licenseSignedAt,
    licenseYears: row.contract.licenseYears ?? '',
    transferStatus: row.contract.transferStatus,
    comment: row.comment,
  };
}
