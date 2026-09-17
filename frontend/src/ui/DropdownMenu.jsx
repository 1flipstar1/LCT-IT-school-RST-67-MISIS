import { Menu } from '@base-ui/react/menu';
import { IconButton } from './IconButton.jsx';
import { MoreIcon } from './icons.js';
import styles from './Popup.module.css';

/** Меню «⋯» с дополнительными действиями карточки. items: [{ label, icon, onSelect }]. */
export function DropdownMenu({ label = 'Ещё действия', items }) {
  return (
    <Menu.Root>
      <Menu.Trigger render={<IconButton icon={MoreIcon} label={label} />} />
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} sideOffset={6} align="end">
          <Menu.Popup className={styles.popup}>
            {items.map(({ label: itemLabel, icon: Icon, onSelect }) => (
              <Menu.Item key={itemLabel} className={styles.item} onClick={onSelect}>
                {Icon && <Icon size={18} fill="currentColor" />}
                {itemLabel}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
