import { useMemo } from 'react';
import logoUrl from '../../logo/logo.svg';
import { Link, useRouter } from '../app/router.jsx';
import { useSession } from '../auth/SessionProvider.jsx';
import { ROLE_INFO } from '../domain/roles.js';
import { needsAttention } from '../domain/workflow.js';
import { cn } from '../lib/cn.js';
import { useVisibleInteractionRows } from '../store/selectors.js';
import { useStoreState } from '../store/StoreProvider.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { IconButton } from '../ui/IconButton.jsx';
import { ArrowRightIcon, HelpIcon, SignOutIcon } from '../ui/icons.js';
import { isNavItemActive, NAVIGATION } from './navigation.js';
import styles from './Sidebar.module.css';

function useNavigationBadges() {
  const rows = useVisibleInteractionRows();
  const { inbox } = useStoreState();
  return useMemo(
    () => ({
      attention: rows.filter((row) => needsAttention(row.sla)).length,
      inbox: inbox.filter((item) => item.status === 'new').length,
    }),
    [rows, inbox],
  );
}

export function Sidebar({ open, onNavigate }) {
  const { pathname } = useRouter();
  const { user, role, can, logout } = useSession();
  const badges = useNavigationBadges();

  const groups = NAVIGATION.map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) })).filter(
    (group) => group.items.length > 0,
  );

  return (
    <aside className={cn(styles.sidebar, open && styles.open)} aria-label="Основная навигация" data-print-hidden>
      <Link to="/" className={styles.brand} onClick={onNavigate}>
        <img src={logoUrl} alt="Ростелеком. ИТ Школа — на главную" className={styles.logo} />
      </Link>

      <nav className={styles.nav}>
        {groups.map((group) => (
          <div key={group.id} className={styles.group}>
            <p className={styles.groupLabel}>{group.label}</p>
            <ul className={styles.list}>
              {group.items.map((item) => {
                const active = isNavItemActive(item, pathname);
                const count = item.badge ? badges[item.badge] : 0;
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link to={item.to} className={cn(styles.item, active && styles.active)} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
                      <Icon size={20} fill="currentColor" />
                      <span className={styles.itemLabel}>{item.label}</span>
                      {count > 0 && (
                        <span className={styles.badge} title={item.badge === 'attention' ? 'Требуют внимания' : 'Новые записи'}>
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <Link to="/help" className={cn(styles.help, pathname === '/help' && styles.helpActive)} onClick={onNavigate}>
          <span className={styles.helpIcon}>
            <HelpIcon size={20} fill="currentColor" />
          </span>
          <span className={styles.helpText}>
            <b>Нужна помощь?</b>
            <span>Инструкции и коды ошибок</span>
          </span>
          <ArrowRightIcon size={16} fill="currentColor" className={styles.helpArrow} />
        </Link>
        <div className={styles.user}>
          <Avatar name={user.name} variant="brand" />
          <div className={styles.userText}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{ROLE_INFO[role].label}</span>
          </div>
          <IconButton icon={SignOutIcon} label="Выйти из системы" onClick={logout} />
        </div>
      </div>
    </aside>
  );
}
