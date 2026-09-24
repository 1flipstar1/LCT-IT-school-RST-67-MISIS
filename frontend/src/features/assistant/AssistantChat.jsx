import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../api/client.js';
import { useRouter } from '../../app/router.jsx';
import { ArrowUpIcon, CloseIcon, HelpIcon } from '../../ui/icons.js';
import styles from './AssistantChat.module.css';

const QUICK_PROMPTS = [
  'Как работать с этапами?',
  'Как сформировать отчёт?',
  'Что нужно для этапа договора?',
];

function currentPage(pathname) {
  const section = pathname.split('/')[1];
  if (!section) return 'dashboard';
  return ['interactions', 'reports', 'help'].includes(section) ? section : 'other';
}

/** Read-only first release: the model can explain the UI but cannot invoke actions. */
export function AssistantChat() {
  const { pathname } = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const triggerRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handleOpen = (event) => {
      setDraft(event.detail?.question || '');
      setOpen(true);
    };
    window.addEventListener('open-assistant', handleOpen);
    return () => window.removeEventListener('open-assistant', handleOpen);
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [open, messages, busy, error]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const send = async (text) => {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.slice(-8);
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const response = await apiClient.chatWithAssistant({ message, history, page: currentPage(pathname) });
      setMessages((current) => [...current, { role: 'assistant', content: response.message }]);
    } catch (caught) {
      setError(caught?.message || 'Помощник временно недоступен. Попробуйте позже.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className={styles.container} data-print-hidden>
      {open && (
        <section
          id="assistant-chat"
          className={styles.panel}
          role="dialog"
          aria-modal="false"
          aria-labelledby="assistant-title"
          onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
        >
          <header className={styles.header}>
            <div>
              <h2 id="assistant-title" className={styles.title}>Помощник</h2>
              <p className={styles.subtitle}>Подскажет, как работать в системе</p>
            </div>
            <button type="button" className={styles.close} onClick={close} aria-label="Закрыть чат">
              <CloseIcon size={20} fill="currentColor" />
            </button>
          </header>

          <div className={styles.conversation} role="log" aria-label="Сообщения чата" aria-live="polite">
            <div className={styles.welcome}>
              Здравствуйте! Спросите об этапах работы или создании отчёта.
            </div>
            {messages.map((entry, index) => (
              <div key={index} className={entry.role === 'user' ? styles.userMessage : styles.assistantMessage}>
                {entry.content}
              </div>
            ))}
            {busy && <div className={styles.assistantMessage} role="status">Готовлю ответ…</div>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div ref={bottomRef} />
          </div>

          {messages.length === 0 && (
            <div className={styles.prompts} aria-label="Быстрые вопросы">
              {QUICK_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" className={styles.prompt} onClick={() => send(prompt)} disabled={busy}>
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <form className={styles.form} onSubmit={(event) => { event.preventDefault(); send(draft); }}>
            <label htmlFor="assistant-input" className="visually-hidden">Ваш вопрос помощнику</label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              className={styles.input}
              rows={2}
              maxLength={2000}
              placeholder="Напишите вопрос…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              disabled={busy}
            />
            <button type="submit" className={styles.send} aria-label="Отправить сообщение" disabled={!draft.trim() || busy}>
              <ArrowUpIcon size={20} fill="currentColor" />
            </button>
          </form>
          <p className={styles.disclaimer}>ИИ может ошибаться — проверяйте важные данные.</p>
        </section>
      )}

      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={open ? 'Скрыть помощника' : 'Открыть помощника'}
        aria-expanded={open}
        aria-controls={open ? 'assistant-chat' : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <HelpIcon size={22} fill="currentColor" />
        <span>Помощник</span>
      </button>
    </div>
  );
}
