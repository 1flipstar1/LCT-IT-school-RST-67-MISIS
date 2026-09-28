import { Button } from '../../ui/Button.jsx';
import { Dialog } from '../../ui/Dialog.jsx';
import { PRIVACY_POLICY, PRIVACY_POLICY_UPDATED } from './privacyPolicy.js';
import styles from './PrivacyPolicyDialog.module.css';

/** Политика обработки ПДн — доступна до входа (152-ФЗ, ст. 18.1). */
export function PrivacyPolicyDialog({ open, onOpenChange }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="l"
      title="Политика обработки персональных данных"
      description={`CRM ИТ Школы Ростелекома · в соответствии с 152-ФЗ · редакция от ${PRIVACY_POLICY_UPDATED}`}
      footer={<Button variant="primary" onClick={() => onOpenChange(false)}>Понятно</Button>}
    >
      <div className={styles.policy}>
        {PRIVACY_POLICY.map((section) => (
          <section key={section.title}>
            <h3 className={styles.title}>{section.title}</h3>
            <ul className={styles.list}>
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
