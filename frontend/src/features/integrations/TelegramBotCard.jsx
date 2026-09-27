import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client.js';
import { plural } from '../../domain/format.js';
import { Badge } from '../../ui/Badge.jsx';
import { ButtonLink } from '../../ui/Button.jsx';
import { Card } from '../../ui/Card.jsx';
import { Hint } from '../../ui/Hint.jsx';
import { ErrorIcon, SendIcon, SuccessIcon } from '../../ui/icons.js';
import styles from './IntegrationsPage.module.css';

/**
 * Telegram-бот рядом с LMS и сайтом: настроен ли, получает ли сообщения и сколько руководителей
 * подключили уведомления о смене этапа. Сами уведомления подключаются в настройках профиля.
 */
export function TelegramBotCard({ canConnect }) {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    let active = true;
    apiClient.getTelegramOverview()
      .then((result) => active && setOverview(result))
      .catch(() => active && setOverview({ unreachable: true }));
    return () => { active = false; };
  }, []);

  if (!overview) return null;
  const working = overview.configured && overview.polling;

  return (
    <Card>
      <div className={styles.sourceHead}>
        <div>
          <Hint text="Бот пишет в Telegram, когда менеджер переводит заявку на другой этап, возвращает на доработку или завершает: руководителю — о его команде, администратору — обо всех. Чат подключают в настройках профиля.">
            <h2 className={styles.sourceName}>Telegram-бот</h2>
          </Hint>
          <p className={styles.sourceDescription}>Уведомления руководителям и администраторам о смене этапа заявки.</p>
        </div>
        {working ? (
          <Badge tone="success" icon={SuccessIcon}>Работает</Badge>
        ) : (
          <Badge tone="warning" icon={ErrorIcon}>{overview.configured ? 'Нет связи' : 'Не настроен'}</Badge>
        )}
      </div>
      {overview.unreachable ? (
        <p className={styles.sourceError}>Не удалось получить состояние бота.</p>
      ) : overview.configured ? (
        <dl className={styles.sourceFacts}>
          <div>
            <dt>Бот</dt>
            <dd>{overview.botUsername ? `@${overview.botUsername}` : '—'}</dd>
          </div>
          <div>
            <dt>Подключили</dt>
            <dd>{overview.connected} из {overview.recipients} {plural(overview.recipients, ['получателя', 'получателей', 'получателей'])}</dd>
          </div>
          <div>
            <dt>Приём сообщений</dt>
            <dd>{overview.polling ? 'Long polling' : 'Выключен'}</dd>
          </div>
        </dl>
      ) : (
        <p className={styles.sourceDescription}>
          Создайте бота у @BotFather, задайте TELEGRAM_BOT_TOKEN в настройках API и перезапустите его. Инструкция — backend/README.md, раздел «Telegram-бот».
        </p>
      )}
      {canConnect && overview.configured && <ButtonLink to="/profile" icon={SendIcon}>Подключить свой Telegram</ButtonLink>}
    </Card>
  );
}
