import { shouldReduceMotion } from '../lib/motion.js';
import { useEffect, useLayoutEffect, useRef } from 'react';
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
import { useNavDrawer } from './useNavDrawer.js';
import { useProfile } from '../features/profile/ProfileProvider.jsx';
import styles from './AppLayout.module.css';

/** Hash-роутер занимает #, поэтому «Перейти к содержимому» переводит фокус вручную. */
function focusMainContent(event) {
  event.preventDefault();
  document.getElementById('main')?.focus();
}

/** Каркас: навигация слева, контент справа. На телефоне и планшете навигация открывается кнопкой в шапке. */
export function AppLayout({ children }) {
  const { pathname, navigate } = useRouter();
  const { preferences } = useProfile();
  const panelRef = useRef(null);
  const scrimRef = useRef(null);
  const menuButtonRef = useRef(null);
  const nav = useNavDrawer({ panelRef, scrimRef, triggerRef: menuButtonRef });
  // В чате строка поиска становится полем ввода внизу экрана (features/assistant/AssistantPage.jsx).
  const chat = pathname === ASSISTANT_PATH;
  const contentRef = useRef(null);
  const previousPathRef = useRef(pathname);

  // Стартовая страница из настроек профиля: один раз при входе, если открыта главная без адреса раздела.
  // Ссылки на конкретный раздел и переходы внутри приложения не трогаем.
  const startPageRef = useRef(preferences.startPage);
  useEffect(() => {
    const startPage = startPageRef.current;
    if (pathname === '/' && startPage !== '/') navigate(startPage);
    // Только при первом показе каркаса после входа.
  }, []);

  // Вход в чат: снимаем растворение прежней страницы (launch.js). Возврат: страница проявляется из размытия.
  useLayoutEffect(() => {
    const cameFromChat = previousPathRef.current === ASSISTANT_PATH && !chat;
    previousPathRef.current = pathname;
    if (chat) gsap.set(contentRef.current, { clearProps: 'all' });
    if (!cameFromChat || shouldReduceMotion()) return;
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
        <IconButton ref={menuButtonRef} icon={MenuIcon} label="Открыть меню" onClick={nav.open} aria-expanded={nav.expanded} aria-controls="app-navigation" />
        <img src={logoUrl} alt="Ростелеком" className={styles.mobileLogo} />
      </header>

      <Sidebar open={nav.isOpen} onNavigate={nav.close} panelRef={panelRef} />
      {nav.drawer && nav.isOpen && <div ref={scrimRef} className={styles.scrim} onClick={nav.close} aria-hidden="true" data-nav-scrim />}

      <main id="main" tabIndex={-1} className={styles.main} data-layout-flip>
        {!chat && <div className={styles.searchBar}><GlobalSearch /></div>}
        <div ref={contentRef} className={cn(styles.content, chat && styles.chat)} data-app-content>{children}</div>
      </main>
      <OnboardingTour />
    </div>
  );
}
