import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useRouter } from '../app/router.jsx';
import { cn } from '../lib/cn.js';
import logoUrl from '../../logo/logo.svg';
import { IconButton } from '../ui/IconButton.jsx';
import { MenuIcon } from '../ui/icons.js';
import { Sidebar } from './Sidebar.jsx';
import { ASSISTANT_PATH } from '../features/assistant/launch.js';
import { OnboardingTour } from '../features/onboarding/OnboardingTour.jsx';
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
  const { pathname } = useRouter();
  const closeNav = () => setNavOpen(false);
  // В чате строка поиска становится полем ввода внизу экрана (features/assistant/AssistantPage.jsx).
  const chat = pathname === ASSISTANT_PATH;
  const contentRef = useRef(null);
  const previousPathRef = useRef(pathname);

  // Вход в чат: снимаем растворение прежней страницы (launch.js). Возврат: страница проявляется из размытия.
  useLayoutEffect(() => {
    const cameFromChat = previousPathRef.current === ASSISTANT_PATH && !chat;
    previousPathRef.current = pathname;
    if (chat) gsap.set(contentRef.current, { clearProps: 'all' });
    if (!cameFromChat || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      contentRef.current,
      { autoAlpha: 0, y: 16, filter: 'blur(12px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.65, ease: 'power2.out', clearProps: 'all' },
    );
  }, [pathname, chat]);

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
        {!chat && <div className={styles.searchBar}><GlobalSearch /></div>}
        <div ref={contentRef} className={cn(styles.content, chat && styles.chat)} data-app-content>{children}</div>
      </main>
      <OnboardingTour />
    </div>
  );
}
