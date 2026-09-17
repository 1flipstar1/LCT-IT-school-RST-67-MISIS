import { describeError } from '../domain/errors.js';
import { cn } from '../lib/cn.js';
import { ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from './icons.js';
import styles from './InlineAlert.module.css';

const ICONS = { info: InfoIcon, success: SuccessIcon, warning: WarningIcon, danger: ErrorIcon };

/** Сообщение внутри страницы или формы. tone: info | success | warning | danger. */
export function InlineAlert({ tone = 'info', title, children, action, className }) {
  const Icon = ICONS[tone];
  return (
    <div className={cn(styles.alert, styles[tone], className)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={20} fill="currentColor" className={styles.icon} />
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

/** Ошибка с кодом из каталога: что случилось, что делать и код для поддержки. */
export function ErrorAlert({ error, className }) {
  if (!error) return null;
  const { code, title, hint } = describeError(error);
  return (
    <InlineAlert tone="danger" title={title} className={className}>
      {hint} <span className={styles.code}>Код: {code}</span>
    </InlineAlert>
  );
}
