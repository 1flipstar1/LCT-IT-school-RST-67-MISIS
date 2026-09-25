import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useRouter } from '../app/router.jsx';
import { useSession } from '../auth/SessionProvider.jsx';
import { articlesFor } from '../features/help/articles/index.js';
import { openAssistant, takeReturnOrigin } from '../features/assistant/launch.js';
import { NAVIGATION } from './navigation.js';
import { MagicIcon, SearchIcon } from '../ui/icons.js';
import styles from './GlobalSearch.module.css';

const BLOCKS = [
  { title: 'Требуют внимания', path: '/' },
  { title: 'Распределение по этапам', path: '/' },
  { title: 'Последние изменения', path: '/' },
  { title: 'Панель фильтров', path: '/interactions' },
  { title: 'Доска этапов', path: '/interactions', match: 'Доска' },
  { title: 'Конструктор отчёта', path: '/reports' },
  { title: 'История отчётов', path: '/reports', match: 'История' },
  { title: 'Входящие записи', path: '/integrations' },
];
const normalize = (value) => value.toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();

function findTarget(label) {
  const headings = [...document.querySelectorAll('#main h1, #main h2, #main h3, #main h4, #main [role="heading"]')];
  const exact = headings.find((node) => normalize(node.textContent) === normalize(label));
  const partial = headings.find((node) => normalize(node.textContent).includes(normalize(label)));
  return (exact || partial)?.closest('article, section, [class*="card"], [class*="Card"]') || exact || partial || document.querySelector('#main h1');
}

function reveal(label) {
  let attempts = 0;
  const check = () => {
    const target = findTarget(label);
    if (!target && attempts++ < 30) return window.setTimeout(check, 100);
    if (!target) return;
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(target, { boxShadow: '0 0 0 0 var(--color-brand)' }, { boxShadow: '0 0 0 6px var(--focus-soft)', duration: 0.45, repeat: 1, yoyo: true, repeatDelay: 0.55, clearProps: 'boxShadow' });
    }
  };
  window.setTimeout(check, 80);
}

export function GlobalSearch() {
  const { path, pathname, navigate } = useRouter();
  const { can } = useSession();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 0);
  const rootRef = useRef(null);
  const fieldRef = useRef(null);
  const inputRef = useRef(null);
  const pendingRef = useRef(null);
  const entries = useMemo(() => [
    ...NAVIGATION.flatMap((group) => group.items.filter((item) => can(item.permission)).map((item) => ({ title: item.label, path: item.to, type: 'Раздел' }))),
    ...BLOCKS.filter((block) => !['/integrations', '/workflows'].includes(block.path) || can(NAVIGATION[2].items.find((item) => item.to === block.path)?.permission)).map((block) => ({ ...block, type: 'Блок' })),
    ...articlesFor(can).map((article) => ({ title: article.title, hint: article.summary, path: `/help?article=${article.id}`, type: 'Статья' })),
  ], [can]);
  const results = query.trim() ? entries.filter((entry) => normalize(`${entry.title} ${entry.hint || ''}`).includes(normalize(query))).slice(0, 8) : entries.filter((entry) => entry.type === 'Раздел').slice(0, 5);

  // Возврат из чата: строка поиска летит на своё место из поля ввода чата, пока страница проявляется.
  useLayoutEffect(() => {
    const origin = takeReturnOrigin();
    if (!origin || !fieldRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = fieldRef.current.getBoundingClientRect();
    gsap.from(fieldRef.current, {
      x: origin.left - target.left,
      y: origin.top - target.top,
      width: origin.width,
      boxShadow: 'none',
      duration: 0.65,
      ease: 'power3.inOut',
      clearProps: 'transform,width,boxShadow',
    });
  }, []);

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  useEffect(() => {
    if (!pendingRef.current) return;
    const { label, target } = pendingRef.current;
    pendingRef.current = null;
    if (target) {
      let attempts = 0;
      const check = () => {
        const node = document.getElementById(target);
        if (!node && attempts++ < 30) return window.setTimeout(check, 100);
        if (node) {
          node.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.fromTo(node, { boxShadow: '0 0 0 0 var(--color-brand)' }, { boxShadow: '0 0 0 6px var(--focus-soft)', duration: 0.45, repeat: 1, yoyo: true, repeatDelay: 0.55, clearProps: 'boxShadow' });
        }
      };
      window.setTimeout(check, 80);
    } else reveal(label);
  }, [path]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyK') { event.preventDefault(); setOpen(true); inputRef.current?.focus(); }
      if ((event.ctrlKey || event.metaKey) && event.code === 'Slash') { event.preventDefault(); openAssistant({ from: fieldRef.current }); }
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer);
    return () => { window.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onPointer); };
  }, []);

  const select = (entry) => {
    setOpen(false);
    setQuery('');
    // Строка поиска «уезжает» вниз и становится полем ввода чата — см. features/assistant/launch.js.
    if (entry.type === 'AI') { openAssistant({ question: query, from: fieldRef.current }); return; }
    if (entry.path === path || entry.path === pathname) {
      if (entry.target) {
        const node = document.getElementById(entry.target);
        node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (node) gsap.fromTo(node, { boxShadow: '0 0 0 0 var(--color-brand)' }, { boxShadow: '0 0 0 6px var(--focus-soft)', duration: 0.45, repeat: 1, yoyo: true, repeatDelay: 0.55, clearProps: 'boxShadow' });
      } else reveal(entry.match || entry.title);
    }
    else { pendingRef.current = { label: entry.match || entry.title, target: entry.target }; navigate(entry.path); }
  };

  return <div className={styles.root} ref={rootRef} data-print-hidden>
    <div ref={fieldRef} data-tour="search" className={`${styles.field} ${scrolled ? styles.scrolled : ''}`}>
      <span className={styles.searchMark} aria-hidden="true">
        <SearchIcon size={20} fill="currentColor" />
        <span className={styles.aiMark}>Ai</span>
      </span>
      <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Найдите раздел или спросите ИИ-помощника" aria-label="Поиск по программе и базе знаний" aria-expanded={open} aria-controls="global-search-results" onKeyDown={(event) => { if (event.key === 'Enter' && query.trim()) { event.preventDefault(); select({ type: 'AI' }); } }} />
      <kbd>Ctrl K</kbd>
      <button type="button" data-tour="open-chat" className={styles.chatButton} onClick={() => select({ type: 'AI' })} title="Открыть чат с ИИ-помощником · Ctrl + /">
        <MagicIcon size={18} fill="currentColor" aria-hidden="true" />
        <span>Открыть чат</span>
      </button>
    </div>
    {open && <div id="global-search-results" className={styles.results} role="listbox" aria-label="Результаты поиска">
      {results.length ? results.map((entry, index) => <button role="option" aria-selected="false" type="button" key={`${entry.type}-${entry.title}-${index}`} className={styles.result} onClick={() => select(entry)}><span><strong>{entry.title}</strong><small>{entry.type}{entry.hint ? ` · ${entry.hint}` : ''}</small></span><span className={styles.arrow}>↗</span></button>) : <p className={styles.empty}>Ничего не найдено</p>}
      <button type="button" className={`${styles.result} ${styles.ai}`} onClick={() => select({ type: 'AI' })}><MagicIcon size={20} fill="currentColor" /><span><strong>Спросить у ИИ-помощника</strong><small>{query.trim() ? `Вопрос: ${query.trim()} · Enter` : 'Объяснит, как сделать, или сделает сам'}</small></span><span className={styles.arrow}>↗</span></button>
    </div>}
  </div>;
}
