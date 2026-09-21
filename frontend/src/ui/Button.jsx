// Прямой путь к компоненту: индекс ui-kit в CommonJS тянет в бандл все компоненты кита.
import AtomaroButtonModule from '@atomaro/ui-kit/components/Button/Button/Button';
import { useId } from 'react';
import { cn } from '../lib/cn.js';
import { interopDefault } from '../lib/interopDefault.js';
import styles from './Button.module.css';

const AtomaroButton = interopDefault(AtomaroButtonModule);

const ICON_SIZE = { s: 16, m: 18, l: 20 };

/**
 * Кнопка дизайн-системы Атомаро с упрощённым API проекта.
 * variant: primary — главное действие экрана (одно на экран), outline — второстепенное,
 * ghost — действие внутри карточки или таблицы.
 */
export function Button({ variant = 'outline', tone = 'brand', size = 'm', icon: Icon, iconAfter: IconAfter, children, fullWidth, className, type = 'button', id, ...rest }) {
  // Атомаро по умолчанию ставит всем кнопкам id="button" — задаём уникальный, чтобы id не дублировались.
  const generatedId = useId();
  const iconSize = ICON_SIZE[size];
  return (
    <AtomaroButton
      id={id ?? generatedId}
      type={type}
      variant={variant}
      colorScheme="accent"
      size={size}
      label={children}
      iconPrefix={Icon ? <Icon size={iconSize} fill="currentColor" /> : undefined}
      iconSuffix={IconAfter ? <IconAfter size={iconSize} fill="currentColor" /> : undefined}
      className={cn(styles.button, tone === 'warning' && styles.warning, fullWidth && styles.fullWidth, className)}
      {...rest}
    />
  );
}

/**
 * Ссылка, которая выглядит как кнопка Атомаро: для переходов между страницами (семантически это <a>).
 * to — адрес внутри приложения, href — внешний адрес, он открывается в новой вкладке.
 */
export function ButtonLink({ to, href, variant = 'outline', size = 'm', icon: Icon, children, fullWidth, className }) {
  const iconSize = ICON_SIZE[size];
  return (
    <a
      href={href ?? `#${to}`}
      {...(href && { target: '_blank', rel: 'noreferrer' })}
      className={cn('button', `button--${variant}`, 'button--accent', `button--size-${size}`, styles.button, styles.link, fullWidth && styles.fullWidth, className)}
    >
      {Icon && <Icon size={iconSize} fill="currentColor" />}
      <span className="button__label">{children}</span>
    </a>
  );
}
