import { addDays, daysBetween } from './format.js';

/**
 * Фазы группируют этапы процесса, чтобы 14 шагов читались как 4 понятных блока.
 * Фаза — только способ показа: переходы всегда идут между конкретными этапами.
 */
export const PHASES = [
  { id: 'acquaintance', label: 'Знакомство' },
  { id: 'contract', label: 'Договор' },
  { id: 'rollout', label: 'Внедрение' },
  { id: 'teaching', label: 'Обучение' },
];

export const PHASE_LABEL = Object.fromEntries(PHASES.map((phase) => [phase.id, phase.label]));

export const SLA_STATE = Object.freeze({
  ok: 'ok',
  soon: 'soon',
  overdue: 'overdue',
  done: 'done',
});

/** За сколько дней до срока карточка попадает в «скоро срок». */
const SLA_WARNING_DAYS = 3;

export const TRANSITION_KIND = Object.freeze({
  next: 'next',
  skip: 'skip',
  back: 'back',
});

export function getStageIndex(workflow, stageId) {
  return workflow.stages.findIndex((stage) => stage.id === stageId);
}

export function getStage(workflow, stageId) {
  return workflow.stages.find((stage) => stage.id === stageId);
}

export function isFinalStage(workflow, stageId) {
  return getStageIndex(workflow, stageId) === workflow.stages.length - 1;
}

export function getProgress(workflow, stageId) {
  const index = getStageIndex(workflow, stageId);
  const total = workflow.stages.length;
  return { step: index + 1, total, percent: Math.round(((index + 1) / total) * 100) };
}

/**
 * Куда можно перевести взаимодействие с текущего этапа:
 *  • на следующий этап;
 *  • через необязательный следующий этап (например, «Корректировка документов»);
 *  • на предыдущий этап — вернуть на доработку.
 * Пропуск и возврат требуют комментария (см. requiresComment).
 */
export function getTransitionTargets(workflow, stageId) {
  const index = getStageIndex(workflow, stageId);
  const { stages } = workflow;
  const targets = [];

  const next = stages[index + 1];
  if (next) targets.push({ stage: next, kind: TRANSITION_KIND.next });
  if (next?.optional && stages[index + 2]) targets.push({ stage: stages[index + 2], kind: TRANSITION_KIND.skip });

  const previous = stages[index - 1];
  if (previous) targets.push({ stage: previous, kind: TRANSITION_KIND.back });

  return targets;
}

export const requiresComment = (kind) => kind !== TRANSITION_KIND.next;

export function getSla(interaction, workflow, now = new Date()) {
  const stage = getStage(workflow, interaction.stageId);
  if (!stage || interaction.completedAt) return { state: SLA_STATE.done, daysLeft: null, deadline: null };

  const deadline = addDays(interaction.stageEnteredAt, stage.slaDays);
  const daysLeft = daysBetween(now, deadline);
  let state = SLA_STATE.ok;
  if (daysLeft < 0) state = SLA_STATE.overdue;
  else if (daysLeft <= SLA_WARNING_DAYS) state = SLA_STATE.soon;

  return { state, daysLeft, deadline };
}

export const needsAttention = (sla) => sla.state === SLA_STATE.overdue || sla.state === SLA_STATE.soon;

/** Проверки перед сохранением процесса в конструкторе. Возвращает список понятных ошибок. */
export function validateWorkflow(workflow) {
  const problems = [];
  if (!workflow.name.trim()) problems.push('Укажите название набора этапов.');
  if (workflow.stages.length < 2) problems.push('Нужно минимум два этапа.');
  workflow.stages.forEach((stage, index) => {
    if (!stage.name.trim()) problems.push(`У этапа № ${index + 1} нет названия.`);
    if (!(stage.slaDays > 0)) problems.push(`У этапа «${stage.name || index + 1}» срок должен быть больше нуля.`);
  });
  if (workflow.stages[0]?.optional) problems.push('Первый этап не может быть необязательным.');
  if (workflow.stages.at(-1)?.optional) problems.push('Последний этап не может быть необязательным.');
  return problems;
}
