import { useState } from 'react';
import logoUrl from '../../logo/logo.svg';
import { IconButton } from '../ui/IconButton.jsx';
import { MenuIcon } from '../ui/icons.js';
import { Sidebar } from './Sidebar.jsx';
import { AssistantChat } from '../features/assistant/AssistantChat.jsx';
import { GlobalSearch } from './GlobalSearch.jsx';
import styles from './AppLayout.module.css';

/** Hash-роутер занимает #, поэтому «Перейти к содержимому» переводит фокус вручную. */
function focusMainContent(event) {
  event.preventDefault();
  document.getElementById('main')?.focus();
}

/** Каркас: навигация слева, контент справа. На телефоне и планшете навигация открывается кнопкой в шапке. */
export function AppLayout({ children }) {
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink} onClick={focusMainContent}>
        Перейти к содержимому
      </a>

      <header className={styles.mobileBar} data-print-hidden>
        <IconButton icon={MenuIcon} label="Открыть меню" onClick={() => setNavOpen(true)} aria-expanded={navOpen} />
        <img src={logoUrl} alt="Ростелеком" className={styles.mobileLogo} />
      </header>

      <Sidebar open={navOpen} onNavigate={closeNav} />
      {navOpen && <div className={styles.scrim} onClick={closeNav} aria-hidden="true" />}

      <main id="main" tabIndex={-1} className={styles.main}>
        <div className={styles.searchBar}><GlobalSearch /></div>
        <div className={styles.content}>{children}</div>
      </main>
      <AssistantChat />
    </div>
  );
}
