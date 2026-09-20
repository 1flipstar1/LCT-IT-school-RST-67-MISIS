import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import logoUrl from '../../logo/logo.svg';
import { Link, useRouter } from '../app/router.jsx';
import { useSession } from '../auth/SessionProvider.jsx';
import { ROLE_INFO } from '../domain/roles.js';
import { needsAttention } from '../domain/workflow.js';
import { cn } from '../lib/cn.js';
import { useVisibleInteractionRows } from '../store/selectors.js';
import { useStoreState } from '../store/StoreProvider.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { avatarImageAt } from '../ui/avatarImages.js';
import { IconButton } from '../ui/IconButton.jsx';
import { ArrowRightIcon, ChevronDownIcon, HelpIcon, SettingsIcon, SignOutIcon } from '../ui/icons.js';
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

function NavigationGroup({ group, pathname, badges, onNavigate }) {
  return (
    <div className={styles.group}>
      {group.label && <p className={styles.groupLabel}>{group.label}</p>}
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
                {count > 0 && <span className={styles.badge}>{count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Sidebar({ open, onNavigate }) {
  const { pathname } = useRouter();
  const { user, role, can, logout } = useSession();
  const { users } = useStoreState();
  const badges = useNavigationBadges();
  const avatarSrc = avatarImageAt(users.findIndex((item) => item.id === user.id));

  const groups = NAVIGATION.map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) })).filter(
    (group) => group.items.length > 0,
  );
  const adminGroup = groups.find((group) => group.id === 'admin');
  const hasActiveSettingsItem = adminGroup?.items.some((item) => isNavItemActive(item, pathname));
  const [settingsOpen, setSettingsOpen] = useState(hasActiveSettingsItem);
  const settingsContentRef = useRef(null);

  useLayoutEffect(() => {
    const content = settingsContentRef.current;
    if (!content) return undefined;

    const items = content.querySelectorAll('li');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      gsap.set(content, { clearProps: 'height,opacity', display: settingsOpen ? 'grid' : 'none' });
      return undefined;
    }

    const timeline = gsap.timeline();
    if (settingsOpen) {
      timeline
        .set(content, { display: 'grid', height: 0, autoAlpha: 0 })
        .to(content, { height: 'auto', autoAlpha: 1, duration: 0.28, ease: 'power2.out' })
        .fromTo(items, { y: -6, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.2, stagger: 0.04, ease: 'power2.out' }, '-=0.14');
    } else {
      timeline
        .to(content, { height: 0, autoAlpha: 0, duration: 0.24, ease: 'power2.in', onComplete: () => gsap.set(content, { display: 'none' }) }, 0)
        .to(items, { y: -4, autoAlpha: 0, duration: 0.12, stagger: { each: 0.025, from: 'end' }, ease: 'power1.in' }, 0);
    }

    return () => timeline.kill();
  }, [settingsOpen]);

  return (
    <aside className={cn(styles.sidebar, open && styles.open)} aria-label="Основная навигация" data-print-hidden>
      <Link to="/" className={styles.brand} onClick={onNavigate}>
        <img src={logoUrl} alt="Ростелеком. ИТ Школа — на главную" className={styles.logo} />
      </Link>

      <nav className={styles.nav}>
        {groups
          .filter((group) => group.id !== 'admin')
          .map((group) => <NavigationGroup key={group.id} group={group} pathname={pathname} badges={badges} onNavigate={onNavigate} />)}

        {adminGroup && <section className={styles.accordion}>
          <button
            type="button"
            className={cn(styles.accordionToggle, hasActiveSettingsItem && styles.accordionActive)}
            aria-expanded={settingsOpen}
            aria-controls="sidebar-settings"
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <SettingsIcon size={20} fill="currentColor" aria-hidden="true" />
            <span className={styles.itemLabel}>Настройки</span>
            <ChevronDownIcon
              size={20}
              fill="currentColor"
              className={cn(styles.accordionChevron, settingsOpen && styles.accordionChevronOpen)}
              aria-hidden="true"
            />
          </button>

            <div id="sidebar-settings" ref={settingsContentRef} className={styles.accordionContent} aria-hidden={!settingsOpen}>
        {groups.filter((group) => group.id === 'admin').map((group) => (
          <div key={group.id} className={styles.group}>
            <ul className={cn(styles.list, styles.accordionList)}>
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
            </div>
        </section>}

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
          <Avatar name={user.name} src={avatarSrc} variant="brand" />
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
