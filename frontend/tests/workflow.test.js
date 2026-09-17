import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BASE_WORKFLOW } from '../src/data/workflows.js';
import { addDays } from '../src/domain/format.js';
import { getProgress, getSla, getTransitionTargets, requiresComment, SLA_STATE, TRANSITION_KIND, validateWorkflow } from '../src/domain/workflow.js';

const targetsFrom = (stageId) => getTransitionTargets(BASE_WORKFLOW, stageId).map(({ stage, kind }) => [kind, stage.id]);

describe('getTransitionTargets', () => {
  it('с первого этапа можно только вперёд', () => {
    assert.deepEqual(targetsFrom('st-contacts'), [[TRANSITION_KIND.next, 'st-communication']]);
  });

  it('перед необязательным этапом предлагает его пропустить', () => {
    assert.deepEqual(targetsFrom('st-documents'), [
      [TRANSITION_KIND.next, 'st-corrections'],
      [TRANSITION_KIND.skip, 'st-signing'],
      [TRANSITION_KIND.back, 'st-meeting'],
    ]);
  });

  it('с последнего этапа можно только вернуться', () => {
    assert.deepEqual(targetsFrom('st-control'), [[TRANSITION_KIND.back, 'st-qualification']]);
  });

  it('комментарий обязателен при пропуске и возврате', () => {
    assert.equal(requiresComment(TRANSITION_KIND.next), false);
    assert.equal(requiresComment(TRANSITION_KIND.skip), true);
    assert.equal(requiresComment(TRANSITION_KIND.back), true);
  });
});

describe('getSla', () => {
  const now = new Date('2026-09-17T12:00:00');
  const onStage = (daysAgo, stageId = 'st-contacts') => ({ stageId, stageEnteredAt: addDays(now, -daysAgo).toISOString(), completedAt: null });

  it('в срок, когда до конца больше трёх дней', () => {
    assert.deepEqual(getSla(onStage(1), BASE_WORKFLOW, now).state, SLA_STATE.ok);
  });

  it('«скоро срок» за три дня и меньше', () => {
    const sla = getSla(onStage(5), BASE_WORKFLOW, now); // норматив 7 дней
    assert.equal(sla.state, SLA_STATE.soon);
    assert.equal(sla.daysLeft, 2);
  });

  it('просрочено после норматива', () => {
    const sla = getSla(onStage(10), BASE_WORKFLOW, now);
    assert.equal(sla.state, SLA_STATE.overdue);
    assert.equal(sla.daysLeft, -3);
  });

  it('завершённое взаимодействие не имеет срока', () => {
    assert.equal(getSla({ ...onStage(100), completedAt: now.toISOString() }, BASE_WORKFLOW, now).state, SLA_STATE.done);
  });
});

describe('getProgress', () => {
  it('считает номер этапа и процент', () => {
    assert.deepEqual(getProgress(BASE_WORKFLOW, 'st-signing'), { step: 6, total: 14, percent: 43 });
  });
});

describe('validateWorkflow', () => {
  it('базовый процесс корректен', () => {
    assert.deepEqual(validateWorkflow(BASE_WORKFLOW), []);
  });

  it('находит пустые названия, нулевые сроки и необязательный первый этап', () => {
    const broken = {
      name: ' ',
      stages: [
        { id: 'a', name: '', slaDays: 0, optional: true },
        { id: 'b', name: 'Финал', slaDays: 5 },
      ],
    };
    assert.equal(validateWorkflow(broken).length, 4);
  });
});
