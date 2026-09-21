import { useMemo, useState } from 'react';
import { createId, formatDate, plural } from '../../domain/format.js';
import { PHASES } from '../../domain/workflow.js';
import { cn } from '../../lib/cn.js';
import { useStoreState } from '../../store/StoreProvider.jsx';
import { useActions } from '../../store/useActions.js';
import { Badge } from '../../ui/Badge.jsx';
import { Button } from '../../ui/Button.jsx';
import { Card, CardHeader } from '../../ui/Card.jsx';
import { Checkbox, SelectField, TextField } from '../../ui/Field.jsx';
import { IconButton } from '../../ui/IconButton.jsx';
import { AddIcon, ArrowDownIcon, ArrowUpIcon, TrashIcon } from '../../ui/icons.js';
import { InlineAlert } from '../../ui/InlineAlert.jsx';
import { PageHeader } from '../../ui/PageHeader.jsx';
import { useToast } from '../../ui/Toast.jsx';
import styles from './WorkflowsPage.module.css';

const PHASE_OPTIONS = PHASES.map((phase) => ({ value: phase.id, label: phase.label }));

const newStage = (phase = 'acquaintance') => ({ id: createId('st'), name: '', phase, slaDays: 7, optional: false, hint: '' });

/** Конструктор процессов: создание, переименование, порядок и сроки этапов. */
export function WorkflowsPage() {
  const { workflows, interactions } = useStoreState();
  const actions = useActions();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(workflows[0].id);
  // Черновики по каждому процессу: переключение между процессами не теряет правки.
  const [drafts, setDrafts] = useState({});
  const [problems, setProblems] = useState([]);

  const saved = workflows.find((workflow) => workflow.id === selectedId) ?? drafts[selectedId];
  const draft = drafts[selectedId] ?? saved;
  const isNew = !workflows.some((workflow) => workflow.id === selectedId);
  const isDirty = isNew || JSON.stringify(draft) !== JSON.stringify(saved);

  const usageByStage = useMemo(() => {
    const usage = new Map();
    interactions.forEach((item) => usage.set(item.stageId, (usage.get(item.stageId) ?? 0) + 1));
    return usage;
  }, [interactions]);

  const updateDraft = (update) => {
    setProblems([]);
    setDrafts((current) => ({ ...current, [selectedId]: update(current[selectedId] ?? saved) }));
  };
  const updateStage = (stageId, patch) =>
    updateDraft((workflow) => ({ ...workflow, stages: workflow.stages.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage)) }));
  const moveStage = (index, offset) =>
    updateDraft((workflow) => {
      const stages = [...workflow.stages];
      [stages[index], stages[index + offset]] = [stages[index + offset], stages[index]];
      return { ...workflow, stages };
    });

  const createWorkflow = () => {
    const id = createId('wf');
    setDrafts((current) => ({
      ...current,
      [id]: { id, name: 'Новый набор этапов', description: '', version: 0, updatedAt: new Date().toISOString(), stages: [newStage(), { ...newStage('teaching'), name: 'Контроль исполнения' }] },
    }));
    setSelectedId(id);
    setProblems([]);
  };

  const discard = () => {
    setDrafts(({ [selectedId]: _discarded, ...rest }) => rest);
    setProblems([]);
    if (isNew) setSelectedId(workflows[0].id);
  };

  const save = () => {
    const found = actions.saveWorkflow(draft);
    if (found.length > 0) {
      setProblems(found);
      return;
    }
    setDrafts(({ [selectedId]: _saved, ...rest }) => rest);
    toast.success(isNew ? 'Набор этапов создан' : 'Этапы сохранены');
  };

  const listed = [...workflows, ...Object.values(drafts).filter((item) => !workflows.some((workflow) => workflow.id === item.id))];

  return (
    <>
      <PageHeader
        title="Этапы работы"
        actions={
          <Button variant="primary" icon={AddIcon} onClick={createWorkflow}>
            Новый набор этапов
          </Button>
        }
      />

      <div className={styles.layout}>
        <nav className={styles.list} aria-label="Наборы этапов">
          {listed.map((workflow) => {
            const count = interactions.filter((item) => item.workflowId === workflow.id).length;
            const unsaved = Boolean(drafts[workflow.id]);
            return (
              <button
                key={workflow.id}
                type="button"
                className={cn(styles.listItem, workflow.id === selectedId && styles.listItemActive)}
                onClick={() => {
                  setSelectedId(workflow.id);
                  setProblems([]);
                }}
                aria-current={workflow.id === selectedId}
              >
                <span className={styles.listName}>{(drafts[workflow.id] ?? workflow).name || 'Без названия'}</span>
                <span className={styles.listMeta}>
                  {workflow.stages.length} {plural(workflow.stages.length, ['этап', 'этапа', 'этапов'])} · {count} {plural(count, ['взаимодействие', 'взаимодействия', 'взаимодействий'])}
                </span>
                {unsaved && <Badge tone="warning">Не сохранено</Badge>}
              </button>
            );
          })}
        </nav>

        <Card>
          <CardHeader
            title={isNew ? 'Новый набор этапов' : `Версия ${saved.version}`}
            description={isNew ? 'Заполните этапы и сохраните.' : `Изменено ${formatDate(saved.updatedAt)}. После сохранения появится версия ${saved.version + 1}.`}
          />

          <div className={styles.meta}>
            <TextField label="Название набора этапов" required value={draft.name} onChange={(event) => updateDraft((workflow) => ({ ...workflow, name: event.target.value }))} />
            <TextField label="Для кого эти этапы" value={draft.description} onChange={(event) => updateDraft((workflow) => ({ ...workflow, description: event.target.value }))} />
          </div>

          <ol className={styles.stages}>
            {draft.stages.map((stage, index) => {
              const usage = usageByStage.get(stage.id) ?? 0;
              return (
                <li key={stage.id} className={styles.stage}>
                  <div className={styles.stageOrder}>
                    <span className={styles.stageNumber}>{index + 1}</span>
                    <IconButton icon={ArrowUpIcon} size="s" label={`Поднять этап ${index + 1}`} disabled={index === 0} onClick={() => moveStage(index, -1)} />
                    <IconButton
                      icon={ArrowDownIcon}
                      size="s"
                      label={`Опустить этап ${index + 1}`}
                      disabled={index === draft.stages.length - 1}
                      onClick={() => moveStage(index, 1)}
                    />
                  </div>
                  <div className={styles.stageFields}>
                    <div className={styles.stageRow}>
                      <TextField label="Название этапа" value={stage.name} onChange={(event) => updateStage(stage.id, { name: event.target.value })} className={styles.stageName} />
                      <SelectField label="Фаза" value={stage.phase} options={PHASE_OPTIONS} onChange={(event) => updateStage(stage.id, { phase: event.target.value })} />
                      <TextField label="Срок, дней" type="number" min={1} value={stage.slaDays} onChange={(event) => updateStage(stage.id, { slaDays: Number(event.target.value) })} />
                    </div>
                    <TextField label="Подсказка менеджеру: что сделать на этапе" value={stage.hint ?? ''} onChange={(event) => updateStage(stage.id, { hint: event.target.value })} />
                    <div className={styles.stageFooter}>
                      <Checkbox label="Необязательный этап" description="Можно пропустить с комментарием" checked={Boolean(stage.optional)} onChange={(optional) => updateStage(stage.id, { optional })} />
                      <span className={styles.usage}>{usage > 0 ? `Сейчас на этапе: ${usage}` : 'Сейчас на этапе никого'}</span>
                    </div>
                  </div>
                  <IconButton
                    icon={TrashIcon}
                    label={usage > 0 ? `Нельзя удалить: на этапе ${usage} взаимод.` : `Удалить этап ${index + 1}`}
                    disabled={usage > 0 || draft.stages.length <= 2}
                    onClick={() => updateDraft((workflow) => ({ ...workflow, stages: workflow.stages.filter((item) => item.id !== stage.id) }))}
                  />
                </li>
              );
            })}
          </ol>

          <Button icon={AddIcon} onClick={() => updateDraft((workflow) => ({ ...workflow, stages: [...workflow.stages, newStage(workflow.stages.at(-1)?.phase)] }))}>
            Добавить этап
          </Button>

          {problems.length > 0 && (
            <InlineAlert tone="danger" title="Изменения не сохранены" className={styles.problems}>
              <ul>
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </InlineAlert>
          )}

          <footer className={styles.footer}>
            <span className={styles.dirty}>{isDirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</span>
            <Button onClick={discard} disabled={!isDirty}>
              {isNew ? 'Удалить черновик' : 'Отменить изменения'}
            </Button>
            <Button variant="primary" onClick={save} disabled={!isDirty}>
              Сохранить
            </Button>
          </footer>
        </Card>
      </div>
    </>
  );
}
