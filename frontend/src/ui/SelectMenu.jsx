import { Select } from '@base-ui/react/select';
import { ChevronDownIcon, CheckIcon } from './icons.js';
import popupStyles from './Popup.module.css';
import styles from './SelectMenu.module.css';

/** Компактный выбор одного значения для ячеек таблицы. */
export function SelectMenu({ label, value, options, onChange, disabled, title }) {
  return (
    <Select.Root value={value} onValueChange={onChange} disabled={disabled} items={options} modal={false}>
      <Select.Trigger className={styles.trigger} aria-label={label} title={title}>
        <Select.Value className={styles.value} />
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
