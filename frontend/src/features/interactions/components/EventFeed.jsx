import { Link } from '../../../app/router.jsx';
import { formatFileSize, formatRelativeDateTime } from '../../../domain/format.js';
import { getStage, getStageIndex } from '../../../domain/workflow.js';
import { Avatar } from '../../../ui/Avatar.jsx';
import { AttachmentIcon } from '../../../ui/icons.js';
import { useAttachmentDownload } from '../../../lib/useAttachmentDownload.js';
import styles from './EventFeed.module.css';

/** Короткое описание события без гендерных окончаний: имя автора показывается отдельно. */
export function describeEvent(event, workflow, users) {
  switch (event.type) {
    case 'created':
      return 'Взаимодействие создано';
    case 'transition': {
      const to = getStage(workflow, event.toStageId);
      const isBack = getStageIndex(workflow, event.toStageId) < getStageIndex(workflow, event.fromStageId);
      return `${isBack ? 'Возврат на этап' : 'Переход на этап'} «${to?.name ?? 'удалённый этап'}»`;
    }
    case 'comment':
      return event.comment ? 'Комментарий' : 'Добавлены файлы';
    case 'assign':
      return `Ответственный: ${users.get(event.toUserId)?.name ?? '—'}`;
    case 'updated':
      return 'Параметры взаимодействия изменены';
    case 'completed':
      return 'Взаимодействие завершено';
    default:
      return 'Изменение';
  }
}

/**
 * Лента событий. showSubject — показывать, к какому вузу относится событие (на главной),
 * в карточке взаимодействия это лишнее.
 */
export function EventFeed({ items, users, showSubject = false }) {
  const downloadAttachment = useAttachmentDownload();
  return (
    <ol className={styles.feed}>
      {items.map(({ event, row }) => {
        const author = users.get(event.userId);
        return (
          <li key={event.id} className={styles.event}>
            <Avatar name={author?.name ?? 'Система'} size="s" />
            <div className={styles.body}>
              <p className={styles.headline}>
                <span className={styles.author}>{author?.name ?? 'Система'}</span>
                <span className={styles.time}>{formatRelativeDateTime(event.at)}</span>
              </p>
              <p className={styles.action}>{describeEvent(event, row.workflow, users)}</p>
              {showSubject && (
                <Link to={`/interactions/${row.id}`} className={styles.subject}>
                  {row.university.shortName} · {row.direction.name}
                </Link>
              )}
              {event.comment && <p className={styles.comment}>{event.comment}</p>}
              {event.files?.length > 0 && (
                <ul className={styles.files}>
                  {event.files.map((file) => (
                    <li key={file.name} className={styles.file}>
                      <AttachmentIcon size={16} fill="currentColor" />
                      {file.id ? (
                        <button type="button" className={styles.fileName} onClick={() => downloadAttachment(file)}>
                          {file.name}
                        </button>
                      ) : (
                        <span className={styles.fileName}>{file.name}</span>
                      )}
                      <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
