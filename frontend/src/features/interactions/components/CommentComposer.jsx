import { useState } from 'react';
import { ATTACHMENT_ACCEPT, validateAttachment } from '../../../domain/attachments.js';
import { sessionStore } from '../../../lib/storage.js';
import { usePersistentState } from '../../../lib/usePersistentState.js';
import { useActions } from '../../../store/useActions.js';
import { Button } from '../../../ui/Button.jsx';
import { TextAreaField } from '../../../ui/Field.jsx';
import { FileDropzone } from '../../../ui/FileDropzone.jsx';
import { AttachmentIcon } from '../../../ui/icons.js';
import { ErrorAlert } from '../../../ui/InlineAlert.jsx';
import { useToast } from '../../../ui/Toast.jsx';
import styles from './CommentComposer.module.css';

/** Комментарий и файлы к текущему этапу без смены этапа. Черновик переживает перезагрузку вкладки. */
export function CommentComposer({ row }) {
  const actions = useActions();
  const toast = useToast();
  const draftKey = `draft:comment:${row.id}`;
  const [comment, setComment] = usePersistentState(draftKey, '', sessionStore);
  const [files, setFiles] = useState([]);
  const [showFiles, setShowFiles] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = comment.trim().length > 0 || files.length > 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      const { undo } = actions.addComment({ interactionId: row.id, comment, files });
      sessionStore.remove(draftKey);
      setComment('');
      setFiles([]);
      setShowFiles(false);
      setError(null);
      toast.success(files.length ? 'Файлы добавлены' : 'Комментарий добавлен', { undo });
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <TextAreaField
        label={`Комментарий к этапу «${row.stage.name}»`}
        rows={3}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Что сделано, о чём договорились, какие следующие шаги"
      />
      {showFiles && (
        <FileDropzone
          files={files}
          onChange={setFiles}
          accept={ATTACHMENT_ACCEPT}
          validate={validateAttachment}
          onError={setError}
          hint="PNG, JPEG, PDF, ZIP, GZIP, RAR, DOC, DOCX, XLS, XLSX · до 25 МБ"
        />
      )}
      <ErrorAlert error={error} />
      <div className={styles.actions}>
        {!showFiles && (
          <Button variant="ghost" icon={AttachmentIcon} onClick={() => setShowFiles(true)}>
            Прикрепить файлы
          </Button>
        )}
        <Button variant="primary" type="submit" disabled={!canSubmit}>
          Отправить
        </Button>
      </div>
    </form>
  );
}
