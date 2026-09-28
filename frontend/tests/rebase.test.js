import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rebaseState } from '../src/store/rebase.js';

const base = {
  version: 5,
  interactions: [{ id: 'i1', stageId: 's1' }, { id: 'i2', stageId: 's1' }],
  events: [{ id: 'e1', interactionId: 'i1' }],
  reports: [{ id: 'r1' }],
  audit: [],
  integrations: { sources: [{ id: 'lms', lastSync: null }], log: [] },
};

describe('rebaseState', () => {
  it('переносит свои изменения на снимок с изменениями коллег', () => {
    const local = {
      ...base,
      interactions: [{ id: 'i1', stageId: 's2' }, base.interactions[1]],
      events: [...base.events, { id: 'e-mine', interactionId: 'i1' }],
      reports: [{ id: 'r-mine' }, ...base.reports],
    };
    const remote = {
      ...base,
      interactions: [base.interactions[0], { id: 'i2', stageId: 's3' }],
      events: [...base.events, { id: 'e-colleague', interactionId: 'i2' }],
      reports: [{ id: 'r-colleague' }, ...base.reports],
    };

    const merged = rebaseState(base, local, remote);
    assert.deepEqual(merged.interactions, [{ id: 'i1', stageId: 's2' }, { id: 'i2', stageId: 's3' }]);
    assert.deepEqual(merged.events.map((e) => e.id), ['e1', 'e-colleague', 'e-mine']);
    assert.deepEqual(merged.reports.map((r) => r.id), ['r-mine', 'r-colleague', 'r1']);
  });

  it('удаляет то, что пользователь удалил, и не трогает остальное', () => {
    const local = { ...base, events: [] };
    const remote = { ...base, events: [...base.events, { id: 'e-colleague', interactionId: 'i2' }] };
    assert.deepEqual(rebaseState(base, local, remote).events.map((e) => e.id), ['e-colleague']);
  });

  it('неизменённые разделы берёт с сервера, изменённые вложенные — сливает', () => {
    const local = { ...base, integrations: { ...base.integrations, log: [{ id: 'l-mine' }] } };
    const remote = { ...base, integrations: { sources: [{ id: 'lms', lastSync: 'now' }], log: [{ id: 'l-colleague' }] } };
    const merged = rebaseState(base, local, remote);
    assert.deepEqual(merged.integrations.sources, [{ id: 'lms', lastSync: 'now' }]);
    assert.deepEqual(merged.integrations.log.map((l) => l.id), ['l-mine', 'l-colleague']);
  });

  it('отмена действия поверх новых данных откатывает только это действие', () => {
    const before = base;
    const after = { ...base, events: [...base.events, { id: 'e-undo', interactionId: 'i1' }], interactions: [{ id: 'i1', stageId: 's2' }, base.interactions[1]] };
    const current = { ...after, events: [...after.events, { id: 'e-colleague', interactionId: 'i2' }] };
    const undone = rebaseState(after, before, current);
    assert.deepEqual(undone.events.map((e) => e.id), ['e1', 'e-colleague']);
    assert.equal(undone.interactions[0].stageId, 's1');
  });
});
