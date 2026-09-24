import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '../../app/router.jsx';
import { useSession } from '../../auth/SessionProvider.jsx';
import { cn } from '../../lib/cn.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { IconButton } from '../../ui/IconButton.jsx';
import {
  ArrowUpIcon,
  ChatIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  HelpIcon,
  MaximizeIcon,
  MicrophoneIcon,
  MinimizeIcon,
  SettingsIcon,
  StopIcon,
  VolumeIcon,
} from '../../ui/icons.js';
import { AssistantCard } from './AssistantCards.jsx';
import { AssistantSettings } from './AssistantSettings.jsx';
import { matchCommands, PAGE_PROMPTS, pageOf } from './commands.js';
import { MessageText } from './MessageText.jsx';
import { DEFAULT_SETTINGS, withDefaults } from './settings.js';
import { speak, speechOutputSupported, stopSpeaking, useSpeechRecognition } from './speech.js';
import { useAssistant } from './useAssistant.js';
import styles from './AssistantChat.module.css';

const MODEL_BADGE = {
  checking: { tone: 'neutral', text: 'Подключаемся к ИИ…' },
  online: { tone: 'online', text: 'ИИ подключена' },
  offline: { tone: 'neutral', text: 'Встроенный режим' },
  disabled: { tone: 'neutral', text: 'Без ИИ · встроенные команды' },
};

/**
 * Помощник как на Госуслугах: объясняет, как сделать, или делает сам — отчёт, поиск, смену этапа.
 * Команды разбираются в браузере мгновенно; свободные вопросы уходят бесплатной локальной модели (Ollama).
 */
export function AssistantChat() {
  const { pathname } = useRouter();
  const { user } = useSession();
  const page = pageOf(pathname);

  const [storedSettings, setStoredSettings] = usePersistentState(`assistant:settings:${user?.id ?? 'guest'}`, DEFAULT_SETTINGS);
  const settings = withDefaults(storedSettings);
  const updateSettings = (patch) => setStoredSettings((current) => ({ ...withDefaults(current), ...patch }));

  const assistant = useAssistant({ settings, page });
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('chat');
  const [expanded, setExpanded] = usePersistentState('assistant:expanded', false);

  const triggerRef = useRef(null);
  const close = useCallback(() => {
    setOpen(false);
    stopSpeaking();
    triggerRef.current?.focus();
  }, []);

  const { send } = assistant;
  useEffect(() => {
    const handleOpen = (event) => {
      setOpen(true);
      setView('chat');
      const question = event.detail?.question?.trim();
      if (question) send(question);
    };
    const handleHotkey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'Slash') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('open-assistant', handleOpen);
    window.addEventListener('keydown', handleHotkey);
    return () => {
      window.removeEventListener('open-assistant', handleOpen);
      window.removeEventListener('keydown', handleHotkey);
    };
  }, [send]);

  const runAction = (action) => {
    if (action === 'clear') assistant.clear();
    if (action === 'export') assistant.exportChat();
    if (action === 'settings') setView('settings');
  };

  const badge = MODEL_BADGE[assistant.model.state];

  return (
    <div className={styles.container} data-print-hidden>
      {open && (
        <section
          id="assistant-chat"
          className={cn(styles.panel, expanded && styles.expanded)}
          role="dialog"
          aria-modal="false"
          aria-labelledby="assistant-title"
          onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
        >
          <header className={styles.header}>
            <span className={styles.avatar} aria-hidden="true"><HelpIcon size={20} fill="currentColor" /></span>
            <div className={styles.heading}>
              <h2 id="assistant-title" className={styles.title}>Помощник</h2>
              <p className={styles.subtitle}>
                <span className={cn(styles.dot, badge.tone === 'online' && styles.dotOnline)} aria-hidden="true" />
                {badge.text}
                {settings.mode === 'guide' && ' · режим подсказок'}
              </p>
            </div>
            <div className={styles.headerActions}>
              <IconButton size="s" icon={ChatIcon} label="Новый диалог" onClick={assistant.clear} disabled={assistant.messages.length === 0} />
              <IconButton size="s" icon={DownloadIcon} label="Скачать переписку" onClick={assistant.exportChat} disabled={assistant.messages.length === 0} />
              <IconButton size="s" icon={SettingsIcon} label="Настройки помощника" aria-pressed={view === 'settings'} onClick={() => setView(view === 'settings' ? 'chat' : 'settings')} />
              <IconButton size="s" icon={expanded ? MinimizeIcon : MaximizeIcon} label={expanded ? 'Уменьшить окно' : 'Развернуть окно'} onClick={() => setExpanded(!expanded)} className={styles.expandButton} />
              <IconButton size="s" icon={CloseIcon} label="Закрыть помощника" onClick={close} />
            </div>
          </header>

          {view === 'settings' ? (
            <AssistantSettings settings={settings} onChange={updateSettings} model={assistant.model} onDone={() => setView('chat')} />
          ) : (
            <>
              <Conversation assistant={assistant} settings={settings} page={page} />
              <Composer assistant={assistant} settings={settings} onAction={runAction} />
            </>
          )}
        </section>
      )}

      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={open ? 'Скрыть помощника' : 'Открыть помощника'}
        title="Помощник · Ctrl + /"
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

function Conversation({ assistant, settings, page }) {
  const { messages, busy, send, runCall, cards } = assistant;
  const bottomRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

  const copy = async (message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Буфер обмена недоступен (например, без HTTPS) — кнопка просто ничего не делает.
    }
  };

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const suggestions = messages.length === 0 ? PAGE_PROMPTS[page] ?? PAGE_PROMPTS.other : lastAssistant?.suggestions ?? [];
  const runSuggestion = (item) => (typeof item === 'string' ? send(item) : runCall(item.call, item.label));

  return (
    <div className={styles.conversation} role="log" aria-label="Сообщения чата" aria-live="polite">
      {messages.length === 0 && (
        <div className={styles.welcome}>
          <p className={styles.welcomeTitle}>Здравствуйте! Чем помочь?</p>
          <p>Спросите, <strong>как</strong> что-то сделать, — объясню по шагам. Или попросите <strong>сделать</strong>: сформирую отчёт, найду просроченные этапы, переведу этап.</p>
          <p className={styles.welcomeHint}>Наберите «/», чтобы увидеть быстрые команды.</p>
        </div>
      )}

      {messages.map((message) => (
        <div key={message.id} className={message.role === 'user' ? styles.userRow : styles.assistantRow}>
          {message.text && (
            <div className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
              {message.role === 'user' ? message.text : <MessageText text={message.text} />}
            </div>
          )}
          {message.card && <AssistantCard message={message} actions={cards} onRun={runCall} onSend={send} />}
          {message.role === 'assistant' && message.text && (
            <div className={styles.messageTools}>
              {message.source === 'ai' && <span className={styles.sourceTag}>Ответ ИИ</span>}
              <IconButton size="s" icon={copiedId === message.id ? CheckIcon : CopyIcon} label={copiedId === message.id ? 'Скопировано' : 'Скопировать ответ'} onClick={() => copy(message)} />
              {speechOutputSupported && <IconButton size="s" icon={VolumeIcon} label="Озвучить ответ" onClick={() => speak(message.text)} />}
            </div>
          )}
        </div>
      ))}

      {busy && (
        <div className={styles.assistantRow} role="status">
          <div className={cn(styles.assistantMessage, styles.typing)}>
            <span className={styles.typingDots} aria-hidden="true"><span /><span /><span /></span>
            Думаю над ответом…
          </div>
        </div>
      )}

      {settings.showSuggestions && !busy && suggestions.length > 0 && (
        <div className={styles.prompts} aria-label="Подсказки">
          {suggestions.map((item) => {
            const label = typeof item === 'string' ? item : item.label;
            return <button key={label} type="button" className={styles.prompt} onClick={() => runSuggestion(item)}>{label}</button>;
          })}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function Composer({ assistant, settings, onAction }) {
  const { send, stop, busy, messages } = assistant;
  const [draft, setDraft] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const commands = matchCommands(draft);
  const speech = useSpeechRecognition({ onText: setDraft, onFinal: (text) => { setDraft(''); send(text); } });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => setHighlighted(0), [draft]);

  const submit = () => {
    if (!draft.trim() || busy) return;
    send(draft);
    setDraft('');
  };

  const pickCommand = (command) => {
    if (command.template) setDraft(command.template);
    else if (command.prompt) {
      send(command.prompt);
      setDraft('');
    } else {
      onAction(command.action);
      setDraft('');
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (commands.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlighted((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + commands.length) % commands.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pickCommand(commands[highlighted]);
        return;
      }
    }
    if (event.key === 'ArrowUp' && !draft) {
      const lastQuestion = [...messages].reverse().find((message) => message.role === 'user');
      if (lastQuestion) {
        event.preventDefault();
        setDraft(lastQuestion.text);
      }
      return;
    }
    const sendKey = settings.enterToSend ? !event.shiftKey && !event.ctrlKey && !event.metaKey : event.ctrlKey || event.metaKey;
    if (event.key === 'Enter' && sendKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      {commands.length > 0 && (
        <ul className={styles.commands} role="listbox" aria-label="Быстрые команды">
          {commands.map((command, index) => (
            <li key={command.command} role="option" aria-selected={index === highlighted}>
              <button type="button" className={cn(styles.command, index === highlighted && styles.commandActive)} onMouseDown={(event) => event.preventDefault()} onClick={() => pickCommand(command)}>
                <span className={styles.commandName}>{command.command}</span>
                <span className={styles.rowMeta}>{command.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.composer}>
        <label htmlFor="assistant-input" className="visually-hidden">Сообщение помощнику</label>
        <textarea
          id="assistant-input"
          ref={inputRef}
          className={styles.input}
          rows={1}
          maxLength={2000}
          placeholder={speech.listening ? 'Говорите…' : 'Спросите или попросите сделать…'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {speech.supported && (
          <IconButton
            icon={MicrophoneIcon}
            label={speech.listening ? 'Остановить запись' : 'Сказать голосом'}
            className={cn(styles.mic, speech.listening && styles.micActive)}
            onClick={speech.listening ? speech.stop : speech.start}
            disabled={busy}
          />
        )}
        {busy ? (
          <button type="button" className={styles.send} aria-label="Остановить ответ" onClick={stop}>
            <StopIcon size={20} fill="currentColor" />
          </button>
        ) : (
          <button type="submit" className={styles.send} aria-label="Отправить сообщение" disabled={!draft.trim()}>
            <ArrowUpIcon size={20} fill="currentColor" />
          </button>
        )}
      </div>
      <p className={styles.disclaimer}>
        {settings.enterToSend ? 'Enter — отправить, Shift + Enter — новая строка' : 'Ctrl + Enter — отправить'} · ИИ может ошибаться, проверяйте важное
      </p>
    </form>
  );
}
