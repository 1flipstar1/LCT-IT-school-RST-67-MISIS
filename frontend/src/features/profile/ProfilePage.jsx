import { useSession } from '../../auth/SessionProvider.jsx';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { ROLE_INFO } from '../../domain/roles.js';
import { Avatar } from '../../ui/Avatar.jsx';
import { AVATAR_OPTIONS, avatarImageAt, avatarImageFor } from '../../ui/avatarImages.js';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { Button } from '../../ui/Button.jsx';
import { SelectField, Switch } from '../../ui/Field.jsx';
import { DEFAULT_PREFERENCES } from './preferences.js';
import { useProfile } from './ProfileProvider.jsx';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const { user, role } = useSession();
  const { users } = useStoreState();
  const { preferences, update, error } = useProfile();
  const fallback = avatarImageAt(users.findIndex((item) => item.id === user.id));
  return <>
    <PageHeader title="Настройки профиля" />
    <div className={styles.layout}>
      <Card>
        <div className={styles.identity}>
          <Avatar name={user.name} src={avatarImageFor(preferences.avatar) ?? fallback} />
          <div><h2>{user.name}</h2><p>{ROLE_INFO[role].label}</p>{user.email && <p>{user.email}</p>}</div>
        </div>
        <CardHeader title="Аватарка" description="Выберите изображение для своего профиля." />
        <div className={styles.avatars} role="group" aria-label="Выбор аватарки">
          {AVATAR_OPTIONS.map(({ id, src }, index) => <button key={id} type="button"
            className={styles.avatar} aria-label={`Аватарка ${index + 1}`}
            aria-pressed={(avatarImageFor(preferences.avatar) ?? fallback) === src}
            onClick={() => update({ avatar: id })}>
            <img src={src} alt="" /><span>{index + 1}</span>
          </button>)}
        </div>
      </Card>
      <Card>
        <CardHeader title="Интерфейс" description="Настройте приложение для комфортной работы." />
        <div className={styles.fields}>
          <div><Switch label="Отключить анимации" checked={preferences.reduceMotion} onChange={(reduceMotion) => update({ reduceMotion })} />
            <p>Переходы, графики и другие эффекты будут отображаться без движения. Системное уменьшение движения учитывается всегда.</p></div>
          <div><Switch label="Счётчики в меню" checked={preferences.showBadges} onChange={(showBadges) => update({ showBadges })} />
            <p>Количество срочных взаимодействий и новых записей интеграций.</p></div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Взаимодействия" description="Эти параметры также обновляются при выборе вида и сортировки в списке взаимодействий." />
        <div className={styles.fields}>
          <SelectField label="Вид списка" value={preferences.interactionView} onChange={(event) => update({ interactionView: event.target.value })}
            options={[{ value: 'table', label: 'Таблица' }, { value: 'board', label: 'Доска' }]} />
          <SelectField label="Сортировка таблицы" value={preferences.interactionSort} onChange={(event) => update({ interactionSort: event.target.value })}
            options={[{ value: 'urgency', label: 'Сначала срочные' }, { value: 'updated', label: 'Недавно изменённые' }, { value: 'university', label: 'По вузу (А–Я)' }, { value: 'progress', label: 'По этапу' }]} />
        </div>
      </Card>
      <div className={styles.footer}>
        <p role="status">{error || 'Изменения сохраняются автоматически для вашего профиля в этом браузере.'}</p>
        <Button onClick={() => update(DEFAULT_PREFERENCES)}>Сбросить настройки профиля</Button>
      </div>
    </div>
  </>;
}
