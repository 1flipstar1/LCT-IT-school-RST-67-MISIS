import { useId, useSyncExternalStore } from 'react';
import { useSession } from '../../auth/SessionProvider.jsx';
import { ROLE_INFO } from '../../domain/roles.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { AVATAR_OPTIONS, avatarImageAt, avatarImageFor } from '../../ui/avatarImages.js';
import { Button } from '../../ui/Button.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { SelectField, Switch } from '../../ui/Field.jsx';
import { MagicIcon } from '../../ui/icons.js';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { SegmentedControl } from '../../ui/SegmentedControl.jsx';
import { useToast } from '../../ui/Toast.jsx';
import { startOnboarding } from '../onboarding/OnboardingTour.jsx';
import { DEFAULT_PREFERENCES, INTERACTION_SORTS, INTERACTION_VIEWS, START_PAGES, TOAST_DURATIONS, UI_SCALES } from './preferences.js';
import { SAVE_STATUS, useProfile } from './ProfileProvider.jsx';
import { TelegramSettings } from './TelegramSettings.jsx';
import styles from './ProfilePage.module.css';

const SAVE_TEXT = {
  [SAVE_STATUS.saved]: 'Изменения сохраняются сразу в вашей учётной записи — настройки будут такими же на любом компьютере.',
  [SAVE_STATUS.saving]: 'Сохраняем…',
  [SAVE_STATUS.local]: 'Сервер недоступен: настройки действуют в этом браузере и сохранятся в учётной записи при следующем изменении.',
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Включено ли уменьшение движения в самой системе — тогда анимации выключены независимо от переключателя. */
function useSystemReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
}

/** Строка настройки: название и пояснение слева, элемент управления справа. */
function Setting({ title, description, children }) {
  const id = useId();
  return (
    <div className={styles.setting} role="group" aria-labelledby={id}>
      <div className={styles.settingText}>
        <span id={id} className={styles.settingTitle}>{title}</span>
        {description && <p className={styles.settingDescription}>{description}</p>}
      </div>
      <div className={styles.settingControl}>{children}</div>
    </div>
  );
}

function ToggleSetting({ title, description, checked, onChange }) {
  return (
    <Setting title={title} description={description}>
      <Switch label={<span className="visually-hidden">{title}</span>} checked={checked} onChange={onChange} />
    </Setting>
  );
}

function Section({ title, description, children }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className={styles.settings}>{children}</div>
    </Card>
  );
}

export function ProfilePage() {
  const { user, role } = useSession();
  const { users } = useStoreState();
  const { preferences, update, status } = useProfile();
  const toast = useToast();
  const systemReducedMotion = useSystemReducedMotion();
  const fallbackAvatar = avatarImageAt(users.findIndex((item) => item.id === user.id));
  const currentAvatar = avatarImageFor(preferences.avatar) ?? fallbackAvatar;

  return (
    <>
      <PageHeader title="Настройки профиля" hint="Личные настройки интерфейса: видны только вам и действуют на любом компьютере, где вы входите в CRM." />

      <div className={styles.layout}>
        {/* Уведомления в Telegram — первыми: руководителю это самое полезное, что можно включить. */}
        {(role === 'lead' || role === 'admin') && <TelegramSettings />}

        <Card>
          <div className={styles.identity}>
            <Avatar name={user.name} src={currentAvatar} />
            <div className={styles.identityText}>
              <h2 className={styles.identityName}>{user.name}</h2>
              <p>{ROLE_INFO[role].label}{user.email ? ` · ${user.email}` : ''}</p>
            </div>
          </div>
          <CardHeader title="Аватарка" description="Её видят коллеги в ленте событий и в списке ответственных." />
          <div className={styles.avatars} role="radiogroup" aria-label="Аватарка">
            {AVATAR_OPTIONS.map(({ id, src }, index) => (
              <button
                key={id}
                type="button"
                role="radio"
                className={styles.avatar}
                aria-label={`Аватарка ${index + 1}`}
                aria-checked={currentAvatar === src}
                onClick={() => update({ avatar: id })}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        </Card>

        <Section title="Внешний вид и анимации" description="Как выглядит и ведёт себя интерфейс.">
          <Setting title="Масштаб интерфейса" description="Размер шрифтов, кнопок, отступов и иконок во всей CRM. 110% — стандартный; на небольшом экране удобнее 100%.">
            <SegmentedControl
              label="Масштаб интерфейса"
              options={UI_SCALES}
              value={preferences.uiScale}
              onChange={(uiScale) => update({ uiScale })}
            />
          </Setting>
          <ToggleSetting
            title="Отключить анимации"
            description={systemReducedMotion
              ? 'В системе включено уменьшение движения — анимации уже выключены независимо от этой настройки.'
              : 'Переходы между страницами, графики, уведомления и курс новичка будут появляться сразу, без движения.'}
            checked={preferences.reduceMotion || systemReducedMotion}
            onChange={(reduceMotion) => update({ reduceMotion })}
          />
          <ToggleSetting
            title="Всплывающие пояснения"
            description="Подсказка «что это за блок» при наведении на заголовок. Можно выключить, когда интерфейс уже знаком."
            checked={preferences.showHints}
            onChange={(showHints) => update({ showHints })}
          />
          <ToggleSetting
            title="Счётчики в меню"
            description="Оранжевые числа у «Взаимодействий» и «Интеграций»: сколько этапов требуют внимания и сколько записей ждут разбора."
            checked={preferences.showBadges}
            onChange={(showBadges) => update({ showBadges })}
          />
        </Section>

        <Section title="Работа с вузами" description="С чего начинается день и как показывать список взаимодействий.">
          <Setting title="Стартовая страница" description="Какой раздел открывается после входа в систему.">
            <SelectField
              aria-label="Стартовая страница"
              className={styles.select}
              value={preferences.startPage}
              onChange={(event) => update({ startPage: event.target.value })}
              options={START_PAGES}
            />
          </Setting>
          <Setting title="Вид списка взаимодействий" description="Доска этапов с перетаскиванием карточек или таблица с сортировкой.">
            <SegmentedControl
              label="Вид списка взаимодействий"
              options={INTERACTION_VIEWS}
              value={preferences.interactionView}
              onChange={(interactionView) => update({ interactionView })}
            />
          </Setting>
          <Setting title="Сортировка таблицы" description="Порядок строк в таблице взаимодействий.">
            <SelectField
              aria-label="Сортировка таблицы"
              className={styles.select}
              value={preferences.interactionSort}
              onChange={(event) => update({ interactionSort: event.target.value })}
              options={INTERACTION_SORTS}
            />
          </Setting>
        </Section>

        <Section title="Уведомления и клавиатура" description="Сообщения о действиях и быстрые клавиши.">
          <Setting title="Время показа уведомлений" description="Сколько висит сообщение внизу экрана — и сколько есть времени нажать «Отменить».">
            <div className={styles.inline}>
              <SegmentedControl
                label="Время показа уведомлений"
                options={TOAST_DURATIONS}
                value={preferences.toastDuration}
                onChange={(toastDuration) => update({ toastDuration })}
              />
              <Button variant="ghost" size="s" onClick={() => toast.success('Так выглядит уведомление')}>Показать пример</Button>
            </div>
          </Setting>
          <ToggleSetting
            title="Горячие клавиши"
            description="Ctrl + K (⌘ + K на Mac) — поиск по системе, Ctrl + / — чат с ИИ-помощником. Выключите, если они мешают другим программам."
            checked={preferences.shortcuts}
            onChange={(shortcuts) => update({ shortcuts })}
          />
        </Section>

        <Section title="Обучение" description="Если что-то забылось.">
          <Setting title="Курс новичка" description="Пошаговый показ всех разделов и кнопок с подсветкой. Выйти можно в любой момент клавишей Esc.">
            <Button icon={MagicIcon} onClick={startOnboarding}>Пройти заново</Button>
          </Setting>
        </Section>

        <div className={styles.footer}>
          <p role="status" className={status === SAVE_STATUS.local ? styles.statusWarning : styles.status}>{SAVE_TEXT[status]}</p>
          <Button variant="ghost" onClick={() => update(DEFAULT_PREFERENCES)}>Сбросить настройки</Button>
        </div>
      </div>
    </>
  );
}
