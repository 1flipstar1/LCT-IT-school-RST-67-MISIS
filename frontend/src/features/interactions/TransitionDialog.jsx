import { useState } from 'react';
import { ATTACHMENT_ACCEPT, validateAttachment } from '../../domain/attachments.js';
import { getTransitionTargets, isFinalStage, requiresComment, TRANSITION_KIND } from '../../domain/workflow.js';
import { cn } from '../../lib/cn.js';
import { sessionStore } from '../../lib/storage.js';
import { usePersistentState } from '../../lib/usePersistentState.js';
import { useActions } from '../../store/useActions.js';
import { Button } from '../../ui/Button.jsx';
import { Dialog, DialogForm } from '../../ui/Dialog.jsx';
import { TextAreaField } from '../../ui/Field.jsx';
import { FileDropzone } from '../../ui/FileDropzone.jsx';
import { ArrowDownIcon, ArrowUpIcon, CheckLargeIcon, ChevronRightIcon } from '../../ui/icons.js';
import { ErrorAlert } from '../../ui/InlineAlert.jsx';
import { useToast } from '../../ui/Toast.jsx';
import styles from './TransitionDialog.module.css';

const COMPLETE = 'complete';

const OPTION_TEXT = {
  [TRANSITION_KIND.next]: { title: 'Следующий этап', icon: ArrowDownIcon },
  [TRANSITION_KIND.skip]: { title: 'Пропустить необязательный этап', icon: ChevronRightIcon },
  [TRANSITION_KIND.back]: { title: 'Вернуть на доработку', icon: ArrowUpIcon },
  [COMPLETE]: { title: 'Завершить взаимодействие', icon: CheckLargeIcon },
};

/**
 * Перевод взаимодействия на другой этап (ТЗ: переход от статуса к статусу с комментарием и файлами).
 * Черновик комментария сохраняется: закрыли окно случайно — текст на месте.
 */
export function TransitionDialog({ row, open, onOpenChange, preferredStageId }) {
  const actions = useActions();
  const toast = useToast();
  const { workflow, stage: currentStage } = row;

  const final = isFinalStage(workflow, row.stageId);
  const options = [
    ...(final ? [{ kind: COMPLETE, stage: currentStage }] : []),
    ...getTransitionTargets(workflow, row.stageId),
  ];
  const initialOption = options.find((option) => option.stage.id === preferredStageId) ?? options[0];

  const draftKey = `draft:transition:${row.id}`;
  const [comment, setComment] = usePersistentState(draftKey, '', sessionStore);
  const [selectedKey, setSelectedKey] = useState(`${initialOption.kind}:${initialOption.stage.id}`);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);

  const selected = options.find((option) => `${option.kind}:${option.stage.id}` === selectedKey) ?? initialOption;
  const commentRequired = selected.kind !== COMPLETE && requiresComment(selected.kind);

  const close = () => {
    setError(null);
    setFiles([]);
    onOpenChange(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    try {
      const payload = { interactionId: row.id, comment, files };
      const { undo } =
        selected.kind === COMPLETE
          ? actions.completeInteraction(payload)
          : actions.transitionInteraction({ ...payload, expectedStageId: row.stageId, toStageId: selected.stage.id, kind: selected.kind });

      sessionStore.remove(draftKey);
      setComment('');
      close();
      toast.success(selected.kind === COMPLETE ? 'Взаимодействие завершено' : `Этап изменён: «${selected.stage.name}»`, { undo });
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      size="m"
      title="Сменить этап"
      description={`${row.university.shortName} · ${row.direction.name}. Сейчас: «${currentStage.name}».`}
      footer={
        <>
          <Button onClick={close}>Отмена</Button>
          <Button variant="primary" type="submit" form="transition-form">
            {selected.kind === COMPLETE ? 'Завершить' : 'Сменить этап'}
          </Button>
        </>
      }
    >
      <DialogForm id="transition-form" onSubmit={handleSubmit}>
        <fieldset className={styles.options}>
          <legend className={styles.legend}>Куда перевести</legend>
          {options.map((option) => {
            const key = `${option.kind}:${option.stage.id}`;
            const { title, icon: Icon } = OPTION_TEXT[option.kind];
            const checked = key === selectedKey;
            return (
              <label key={key} className={cn(styles.option, checked && styles.checked)}>
                <input type="radio" name="target" value={key} checked={checked} onChange={() => setSelectedKey(key)} className="visually-hidden" />
                <span className={styles.optionIcon}>
                  <Icon size={20} fill="currentColor" />
                </span>
                <span className={styles.optionText}>
                  <span className={styles.optionTitle}>{title}</span>
                  <span className={styles.optionStage}>
                    {option.kind === COMPLETE ? 'Все этапы пройдены — взаимодействие попадёт в архив' : option.stage.name}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {selected.kind !== COMPLETE && selected.kind === TRANSITION_KIND.next && selected.stage.hint && (
          <p className={styles.hint}>
            <b>На следующем этапе:</b> {selected.stage.hint}
          </p>
        )}

        <TextAreaField
          label="Комментарий"
          required={commentRequired}
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={commentRequired ? 'Почему возвращаем или пропускаем этап' : 'Итог этапа: о чём договорились, что дальше'}
          hint={commentRequired ? 'Обязательно при возврате и пропуске этапа.' : 'Необязательно, но помогает коллегам.'}
        />

        <div className={styles.files}>
          <p className={styles.legend}>Файлы к этапу «{currentStage.name}»</p>
          <FileDropzone
            files={files}
            onChange={setFiles}
            accept={ATTACHMENT_ACCEPT}
            validate={validateAttachment}
            onError={setError}
            hint="PNG, JPEG, PDF, ZIP, GZIP, RAR, DOC, DOCX, XLS, XLSX · до 25 МБ"
          />
        </div>

        <ErrorAlert error={error} />
      </DialogForm>
    </Dialog>
  );
}
