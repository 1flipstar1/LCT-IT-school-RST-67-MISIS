import { Select } from '@base-ui/react/select';
import { cn } from '../lib/cn.js';
import { ChevronDownIcon, CheckIcon } from './icons.js';
import popupStyles from './Popup.module.css';
import styles from './SelectMenu.module.css';

/**
 * Выбор одного значения: компактный — для ячеек таблицы, fullWidth — для полей формы (см. SelectMenuField).
 */
export function SelectMenu({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  required,
  name,
  form,
  placeholder,
  invalid,
  describedBy,
  title,
  icon: Icon,
  fullWidth = false,
  className,
}) {
  return (
    <Select.Root value={value || null} onValueChange={onChange} disabled={disabled} required={required} name={name} form={form} items={options} modal={false}>
      <Select.Trigger
        id={id}
        className={cn(styles.trigger, fullWidth && styles.fullWidth, invalid && styles.invalid, className)}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        title={title}
      >
        {Icon && <Icon size={18} fill="currentColor" aria-hidden="true" />}
        <Select.Value className={styles.value} placeholder={placeholder} />
        <ChevronDownIcon size={16} fill="currentColor" aria-hidden="true" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className={popupStyles.positioner} sideOffset={6} align="start">
          <Select.Popup className={popupStyles.popup} finalFocus={(closeType) => closeType === 'keyboard'}>
            <Select.List className={styles.list}>
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} className={popupStyles.item}>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className={styles.indicator}>
                    <CheckIcon size={16} fill="currentColor" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
