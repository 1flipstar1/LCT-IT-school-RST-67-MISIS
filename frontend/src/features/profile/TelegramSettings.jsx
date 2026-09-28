import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../api/client.js';
import { formatDate } from '../../domain/format.js';
import { Button, ButtonLink } from '../../ui/Button.jsx';
import { Card } from '../../ui/Card.jsx';
import { CheckIcon, SendIcon, SuccessIcon } from '../../ui/icons.js';
import { InlineAlert } from '../../ui/InlineAlert.jsx';
import { useToast } from '../../ui/Toast.jsx';
import styles from './TelegramSettings.module.css';

/** Как часто спрашивать сервер, нажал ли руководитель «Старт» в Telegram. */
const LINK_POLL_MS = 3000;

const BENEFITS = {
  own: ['Заявки, за которые вы отвечаете', 'Свои изменения тоже приходят', 'Подключение — за 30 секунд'],
  team: ['Только заявки вашей команды', 'Отменённые переходы не приходят', 'Подключение — за 30 секунд'],
  all: ['Все заявки всех команд', 'Отменённые переходы не приходят', 'Подключение — за 30 секунд'],
};
const WHO = { own: 'меняется ваша заявка', team: 'меняется заявка вашей команды', all: 'меняется любая заявка' };

/**
 * Уведомления в Telegram: менеджеру по своим заявкам, руководителю по команде,
 * администратору по всем. Пока чат не подключён — баннер с примером сообщения;
 * после подключения — компактная строка состояния.
 */
export function TelegramSettings() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => apiClient.getTelegramStatus().then(setStatus), []);

  useEffect(() => {
    load().catch(() => setStatus({ unreachable: true }));
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => load().catch(() => setStatus({ unreachable: true })), 10000);
    return () => clearInterval(timer);
  }, [load]);

  // Пока ссылка действует, ждём, когда бот получит «Старт». Следующий запрос — только после
  // ответа на предыдущий (setTimeout, а не setInterval), чтобы медленная сеть не копила запросы.
  useEffect(() => {
    if (!link) return undefined;
    let cancelled = false;
    let timer;
    const check = async () => {
      if (Date.parse(link.expiresAt) < Date.now()) {
        setLink(null);
        return;
      }
      const next = await apiClient.getTelegramStatus().catch(() => null);
      if (cancelled) return;
      if (next?.connected) {
        setStatus(next);
        setLink(null);
        toast.success('Telegram подключён — теперь вы не пропустите ни одного перехода');
        return;
      }
      timer = setTimeout(check, LINK_POLL_MS);
    };
    timer = setTimeout(check, LINK_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [link, toast]);

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error.message || 'Не удалось выполнить действие');
    } finally {
      setBusy(false);
    }
  };

  if (!status || status.available === false) return null;

  if (status.unreachable) {
    return <InlineAlert tone="warning" title="Уведомления в Telegram">Не удалось узнать состояние бота. Обновите страницу позже.</InlineAlert>;
  }
  if (!status.configured) {
    return (
      <InlineAlert tone="info" title="Уведомления в Telegram скоро будут доступны">
        Администратору: создайте бота у @BotFather, укажите токен в TELEGRAM_BOT_TOKEN и перезапустите API — см. backend/README.md, раздел «Telegram-бот».
      </InlineAlert>
    );
  }

  if (!status.polling) {
    return (
      <InlineAlert tone="warning" title="Нет связи с Telegram">
        Бот настроен, но сейчас не получает сообщения. Подключение чата станет доступно, когда связь восстановится; состояние обновится автоматически.
      </InlineAlert>
    );
  }

  if (status.connected) {
    return (
      <Card className={styles.connected}>
        <span className={styles.connectedIcon}><SuccessIcon size={24} fill="currentColor" /></span>
        <div className={styles.connectedText}>
          <h2 className={styles.connectedTitle}>Уведомления в Telegram подключены</h2>
          <p>
            Чат <b>{status.username ? `@${status.username}` : status.chatName ?? 'в Telegram'}</b> с {formatDate(status.linkedAt)}.
            Бот пишет, когда {WHO[status.scope] ?? 'меняется заявка'}. Команда /stop в чате тоже отключит уведомления.
          </p>
        </div>
        <div className={styles.connectedActions}>
          <Button size="s" icon={SendIcon} disabled={busy} onClick={() => run(async () => {
            await apiClient.sendTelegramTest();
            toast.success('Проверочное сообщение отправлено');
          })}>
            Отправить проверку
          </Button>
          <Button size="s" variant="ghost" tone="warning" disabled={busy} onClick={() => run(async () => {
            setStatus(await apiClient.disconnectTelegram());
            toast.success('Уведомления в Telegram отключены');
          })}>
            Отключить
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <section className={styles.banner} aria-labelledby="telegram-banner-title">
      <div className={styles.pitch}>
        {link ? (
          <>
            <span className={styles.eyebrow}>Шаг 2 из 2</span>
            <h2 id="telegram-banner-title" className={styles.title}>Осталось нажать «Старт» в Telegram</h2>
            <ol className={styles.steps}>
              <li>Откройте чат с ботом {status.botUsername && <b>@{status.botUsername}</b>}.</li>
              <li>Нажмите «Старт» — эта страница сама отметит подключение.</li>
            </ol>
            <div className={styles.actions}>
              <ButtonLink href={link.url} variant="primary" icon={SendIcon} className={styles.cta}>Открыть Telegram</ButtonLink>
              <button type="button" className={styles.secondary} onClick={() => setLink(null)}>Отмена</button>
            </div>
            <p className={styles.waiting}><span className={styles.pulse} aria-hidden="true" />Ждём подтверждения · ссылка действует 15 минут</p>
          </>
        ) : (
          <>
            <span className={styles.eyebrow}>Новое · Telegram</span>
            <h2 id="telegram-banner-title" className={styles.title}>Узнавайте об изменениях заявок — прямо в Telegram</h2>
            <p className={styles.lead}>
              Бот напишет, когда {WHO[status.scope] ?? 'меняется заявка'}: переход на новый этап, возврат на доработку или завершение работы с вузом.
              Не нужно держать CRM открытой, чтобы быть в курсе.
            </p>
            <ul className={styles.benefits}>
              {(BENEFITS[status.scope] ?? BENEFITS.team).map((benefit) => (
                <li key={benefit}><CheckIcon size={16} fill="currentColor" aria-hidden="true" />{benefit}</li>
              ))}
            </ul>
            <div className={styles.actions}>
              <Button variant="primary" size="l" icon={SendIcon} className={styles.cta} disabled={busy}
                onClick={() => run(async () => setLink(await apiClient.createTelegramLink()))}>
                Подключить Telegram
              </Button>
              <span className={styles.note}>Бесплатно · отключить можно в любой момент</span>
            </div>
          </>
        )}
      </div>

      <figure className={styles.preview} aria-label="Пример уведомления в Telegram">
        <figcaption className={styles.previewHead}>
          <span className={styles.previewAvatar} aria-hidden="true"><SendIcon size={16} fill="currentColor" /></span>
          <span>
            <b>{status.botUsername ? `@${status.botUsername}` : 'Бот CRM'}</b>
            <small>бот · сейчас</small>
          </span>
        </figcaption>
        {/* Тот же формат, что у настоящего уведомления: backend/app/services/telegram.py → format_stage_message. */}
        <div className={styles.bubble}>
          <b>➡️ Переход на следующий этап</b>
          <span>🏛 <b>КФУ</b> · 💻 DevOps · 📦 РЕД ОС</span>
          <span>📍 «Встреча с вузом» → <b>«Обмен документами»</b></span>
          <span>📊 Этап 4 из 14 ▰▰▰▰▱▱▱▱▱▱▱▱▱▱</span>
          <span>⏳ Срок этапа: 10 дней</span>
          <span>👤 Кто изменил: Алина Воронова</span>
          <span>💬 <i>Договорились о пилоте на весенний семестр</i></span>
        </div>
      </figure>
    </section>
  );
}
