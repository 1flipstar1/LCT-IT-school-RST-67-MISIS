import { initials } from '../../domain/format.js';
import { useDocumentTitle } from '../../lib/useDocumentTitle.js';
import { useToast } from '../../ui/Toast.jsx';
import { AddIcon, AdjustIcon, MoreIcon } from '../../ui/icons.js';
import { LegacyButton, LegacyScreen, PageHeader } from './legacyUi.jsx';

const TEAM = [
  { name: 'Алексей Козлов', email: 'alexey@rtk.ru', role: 'Администратор', lastSeen: 'Сегодня, 09:42' },
  { name: 'Алина Воронова', email: 'alina@rtk.ru', role: 'Пользователь', lastSeen: 'Сегодня, 09:18' },
  { name: 'Михаил Орлов', email: 'mikhail@rtk.ru', role: 'Пользователь', lastSeen: 'Вчера, 18:05' },
  { name: 'Елена Ким', email: 'elena@rtk.ru', role: 'Руководитель', lastSeen: 'Вчера, 17:44' },
];

/** «Пользователи» прежнего дизайна (ветка main): команда проекта одной таблицей. */
export function UsersScreen() {
  useDocumentTitle('Пользователи — дизайн main');
  const toast = useToast();

  return (
    <LegacyScreen>
      <PageHeader title="Пользователи">
        <LegacyButton primary onClick={() => toast.success('Форма добавления открыта')} icon={<AddIcon size={16} fill="currentColor" />}>
          Добавить пользователя
        </LegacyButton>
      </PageHeader>

      <section className="panel table-panel">
        <div className="table-meta">
          <span>
            <b>Команда проекта</b>
          </span>
          <LegacyButton icon={<AdjustIcon size={15} fill="currentColor" />}>Фильтры</LegacyButton>
        </div>
        <table>
          <thead>
            <tr>
              <th>ПОЛЬЗОВАТЕЛЬ</th>
              <th>РОЛЬ</th>
              <th>СТАТУС</th>
              <th>ПОСЛЕДНИЙ ВХОД</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {TEAM.map((member) => (
              <tr key={member.name}>
                <td>
                  <span className="person">
                    <span className="avatar tiny">{initials(member.name)}</span>
                    <span>
                      <b>{member.name}</b>
                      <small>{member.email}</small>
                    </span>
                  </span>
                </td>
                <td>
                  <span className="status-tag purple">{member.role}</span>
                </td>
                <td>
                  <span className="status-tag green">Активен</span>
                </td>
                <td className="muted">{member.lastSeen}</td>
                <td>
                  <MoreIcon size={18} fill="currentColor" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </LegacyScreen>
  );
}
