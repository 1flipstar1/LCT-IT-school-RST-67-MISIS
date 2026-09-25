import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useSession } from '../../auth/SessionProvider.jsx';
import { cn } from '../../lib/cn.js';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { IconButton } from '../../ui/IconButton.jsx';
import {
  ArrowUpIcon,
  ChatIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  MagicIcon,
  MicrophoneIcon,
  SearchIcon,
  SettingsIcon,
  StopIcon,
  VolumeIcon,
} from '../../ui/icons.js';
import { SidePanel } from '../../ui/SidePanel.jsx';
import { AssistantCard } from './AssistantCards.jsx';
import { AssistantSettings } from './AssistantSettings.jsx';
import { matchCommands, PAGE_PROMPTS, pageOf } from './commands.js';
import { closeAssistant, getReturnPath, takeLaunch } from './launch.js';
import { MessageText } from './MessageText.jsx';
import { DEFAULT_SETTINGS, withDefaults } from './settings.js';
import { speak, speechOutputSupported, stopSpeaking, useSpeechRecognition } from './speech.js';
import { useAssistant } from './useAssistant.js';
import styles from './Assistant.module.css';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollToEnd = (behavior = 'instant') => window.scrollTo({ top: document.documentElement.scrollHeight, behavior });

/**
 * Экран ИИ-помощника. Открывается из строки поиска: строка «уезжает» вниз и становится полем ввода,
 * а страница — перепиской. Закрытие проигрывает ту же анимацию в обратную сторону.
 */
export function AssistantPage() {
  useDocumentTitle('ИИ-помощник');
  const { user } = useSession();
  const returnPage = pageOf(getReturnPath());

  const [storedSettings, setStoredSettings] = usePersistentState(`assistant:settings:${user?.id ?? 'guest'}`, DEFAULT_SETTINGS);
  const settings = withDefaults(storedSettings);
  const updateSettings = (patch) => setStoredSettings((current) => ({ ...withDefaults(current), ...patch }));

  const assistant = useAssistant({ settings, page: returnPage });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pageRef = useRef(null);
  const frameRef = useRef(null);
  const threadRef = useRef(null);
  const closingRef = useRef(false);
  const launchRef = useRef(null);
  launchRef.current ??= takeLaunch();

  // Вход: поле ввода прилетает с места строки поиска, остальное проявляется следом.
  useLayoutEffect(() => {
    scrollToEnd();
    if (reducedMotion()) return undefined;
    const { origin } = launchRef.current;
    const context = gsap.context(() => {
      if (origin && frameRef.current) {
        const target = frameRef.current.getBoundingClientRect();
        gsap.from(frameRef.current, {
          x: origin.left - target.left,
          y: origin.top - target.top,
          width: origin.width,
          boxShadow: 'none',
          duration: 0.75,
          ease: 'power3.inOut',
          clearProps: 'transform,width,boxShadow',
        });
      }
      gsap.from('[data-intro]', { autoAlpha: 0, y: 24, duration: 0.5, stagger: 0.06, delay: origin ? 0.3 : 0, ease: 'power2.out', clearProps: 'all' });
    }, pageRef);
    return () => context.revert();
  }, []);

  const { send } = assistant;
  useEffect(() => {
    const { question } = launchRef.current;
    // Вопрос из строки поиска отправляется один раз, при открытии экрана.
    if (question) send(question);
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    stopSpeaking();
    const leave = () => closeAssistant(frameRef.current);
    if (reducedMotion()) {
      leave();
      return;
    }
    // Переписка быстро растворяется; полёт поля наверх и проявление страницы делает уже раскладка.
    gsap.to(['[data-intro]', threadRef.current], { autoAlpha: 0, filter: 'blur(6px)', duration: 0.18, ease: 'power2.in', onComplete: leave });
  }, []);

  useEffect(() => {
    const handleHotkey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'Slash') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, [close]);

  const runAction = (action) => {
    if (action === 'clear') assistant.clear();
    if (action === 'export') assistant.exportChat();
    if (action === 'settings') setSettingsOpen(true);
  };

  const empty = assistant.messages.length === 0;

  return (
    <div ref={pageRef} className={styles.page}>
      <header className={styles.topbar} data-intro>
        <h1 className={styles.title}>ИИ-помощник{settings.mode === 'guide' && <span className={styles.modeTag}>режим подсказок</span>}</h1>
        <div className={styles.toolbar}>
          <IconButton icon={ChatIcon} label="Новый диалог" onClick={assistant.clear} disabled={empty} />
          <IconButton icon={SettingsIcon} label="Настройки помощника" onClick={() => setSettingsOpen(true)} />
          <IconButton icon={CloseIcon} label="Закрыть чат · Ctrl + /" onClick={close} />
        </div>
      </header>

      <div ref={threadRef} className={styles.thread}>
        {empty ? <Welcome page={returnPage} onPick={send} /> : <Conversation assistant={assistant} settings={settings} />}
      </div>

      <Composer ref={frameRef} assistant={assistant} settings={settings} onAction={runAction} />

      <SidePanel open={settingsOpen} onOpenChange={setSettingsOpen} title="Настройки помощника" description="Сохраняются для вашей учётной записи в этом браузере.">
        <AssistantSettings settings={settings} onChange={updateSettings} model={assistant.model} onDone={() => setSettingsOpen(false)} />
      </SidePanel>
    </div>
  );
}

function Welcome({ page, onPick }) {
  const prompts = PAGE_PROMPTS[page] ?? PAGE_PROMPTS.other;
  return (
    <section className={styles.welcome} aria-labelledby="assistant-welcome">
      <span className={styles.welcomeMark} data-intro aria-hidden="true"><MagicIcon size={48} fill="currentColor" /></span>
      <h2 id="assistant-welcome" className={styles.welcomeTitle} data-intro>Чем помочь?</h2>
      <p className={styles.welcomeText} data-intro>
        Спросите, <strong>как</strong> что-то сделать, — объясню по шагам. Или попросите <strong>сделать</strong>: сформирую отчёт, найду просроченные этапы, переведу этап.
      </p>
      <div className={styles.starters} data-intro>
        {prompts.map((prompt) => (
          <button key={prompt} type="button" className={styles.starter} onClick={() => onPick(prompt)}>
            <MagicIcon size={18} fill="currentColor" aria-hidden="true" />
            {prompt}
          </button>
        ))}
      </div>
      <p className={styles.welcomeHint} data-intro>Наберите «/», чтобы увидеть быстрые команды.</p>
    </section>
  );
}

/**
 * Появление сообщения: вопрос пользователя выезжает справа; у ответа сначала «вспыхивает» значок,
 * затем абзацы и пункты проявляются из размытия, следом поднимается карточка с кнопками.
 */
function revealMessage(node) {
  const clear = { clearProps: 'all' };
  if (!node.querySelector('[data-avatar]')) {
    gsap.from(node, { autoAlpha: 0, x: 32, scale: 0.96, transformOrigin: '100% 100%', duration: 0.4, ease: 'power3.out', ...clear });
    return;
  }
  const blocks = node.querySelectorAll('[data-text] > p, [data-text] li');
  const card = node.querySelector('[data-card]');
  const tools = node.querySelector('[data-tools]');
  const timeline = gsap.timeline();
  timeline.from(node.querySelector('[data-avatar]'), { autoAlpha: 0, scale: 0.3, rotate: -120, duration: 0.5, ease: 'back.out(2)', ...clear });
  if (blocks.length) timeline.from(blocks, { autoAlpha: 0, y: 10, filter: 'blur(6px)', duration: 0.45, stagger: 0.08, ease: 'power2.out', ...clear }, 0.1);
  if (card) {
    timeline.from(card, { autoAlpha: 0, y: 24, scale: 0.98, filter: 'blur(4px)', duration: 0.55, ease: 'power3.out', ...clear }, '-=0.25');
    timeline.from(card.firstElementChild?.children ?? [], { autoAlpha: 0, y: 8, duration: 0.35, stagger: 0.06, ease: 'power2.out', ...clear }, '-=0.35');
  }
  if (tools) timeline.from(tools, { autoAlpha: 0, duration: 0.3, ...clear }, '-=0.1');
}

function Conversation({ assistant, settings }) {
  const { messages, busy, send, runCall, cards } = assistant;
  const listRef = useRef(null);
  const countRef = useRef(messages.length);
  const [copiedId, setCopiedId] = useState(null);

  // Новые сообщения проявляются по частям; уже открытая история не анимируется.
  useLayoutEffect(() => {
    const added = messages.length - countRef.current;
    countRef.current = messages.length;
    if (added > 0 && !reducedMotion()) {
      [...listRef.current.querySelectorAll('[data-message]')].slice(-added).forEach(revealMessage);
    }
    scrollToEnd(added > 0 ? 'smooth' : 'instant');
  }, [messages.length, busy]);

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
  const suggestions = lastAssistant?.suggestions ?? [];
  const runSuggestion = (item) => (typeof item === 'string' ? send(item) : runCall(item.call, item.label));

  return (
    <div ref={listRef} className={styles.messages} role="log" aria-label="Переписка с помощником" aria-live="polite">
      {messages.map((message) => (
        <div key={message.id} data-message className={message.role === 'user' ? styles.userRow : styles.assistantRow}>
          {message.role === 'assistant' && <span className={styles.avatar} data-avatar aria-hidden="true"><MagicIcon size={22} fill="currentColor" /></span>}
          <div className={styles.messageBody}>
            {message.text && (
              <div className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
                {message.role === 'user' ? message.text : <MessageText text={message.text} />}
              </div>
            )}
            {message.card && <div data-card><AssistantCard message={message} actions={cards} onRun={runCall} onSend={send} /></div>}
            {message.role === 'assistant' && message.text && (
              <div className={styles.messageTools} data-tools>
                {message.source === 'ai' && <span className={styles.sourceTag}>Ответ ИИ</span>}
                <IconButton size="s" icon={copiedId === message.id ? CheckIcon : CopyIcon} label={copiedId === message.id ? 'Скопировано' : 'Скопировать ответ'} onClick={() => copy(message)} />
                {speechOutputSupported && <IconButton size="s" icon={VolumeIcon} label="Озвучить ответ" onClick={() => speak(message.text)} />}
              </div>
            )}
          </div>
        </div>
      ))}

      {busy && (
        <div className={styles.assistantRow} role="status">
          <span className={cn(styles.avatar, styles.avatarThinking)} aria-hidden="true"><MagicIcon size={22} fill="currentColor" /></span>
          <p className={styles.thinking}>Думаю над ответом…</p>
        </div>
      )}

      {settings.showSuggestions && !busy && suggestions.length > 0 && (
        <div className={styles.suggestions} aria-label="Следующие шаги">
          {suggestions.map((item) => {
            const label = typeof item === 'string' ? item : item.label;
            return <button key={label} type="button" className={styles.suggestion} onClick={() => runSuggestion(item)}>{label}</button>;
          })}
        </div>
      )}
    </div>
  );
}

/** Поле ввода внизу экрана. ref — рамка поля: её анимирует переход из строки поиска. */
function Composer({ ref, assistant, settings, onAction }) {
  const { send, stop, busy, messages } = assistant;
  const [draft, setDraft] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const commands = matchCommands(draft);
  const speech = useSpeechRecognition({ onText: setDraft, onFinal: (text) => { setDraft(''); send(text); } });

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
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
    <div className={cn(styles.dock, busy && styles.dockBusy)}>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className={styles.glow} aria-hidden="true" />
        {commands.length > 0 && (
          <ul className={styles.commands} role="listbox" aria-label="Быстрые команды">
            {commands.map((command, index) => (
              <li key={command.command} role="option" aria-selected={index === highlighted}>
                <button type="button" className={cn(styles.command, index === highlighted && styles.commandActive)} onMouseDown={(event) => event.preventDefault()} onClick={() => pickCommand(command)}>
                  <span className={styles.commandName}>{command.command}</span>
                  <span className={styles.commandDescription}>{command.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div ref={ref} className={styles.frame}>
          <div className={styles.composer}>
            <span className={styles.searchMark} aria-hidden="true">
              <SearchIcon size={20} fill="currentColor" />
              <span className={styles.aiMark}>Ai</span>
            </span>
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
        </div>
      </form>
      <p className={styles.disclaimer} data-intro>
        {settings.enterToSend ? 'Enter — отправить, Shift + Enter — новая строка' : 'Ctrl + Enter — отправить'} · ИИ может ошибаться, проверяйте важное
      </p>
    </div>
  );
}
