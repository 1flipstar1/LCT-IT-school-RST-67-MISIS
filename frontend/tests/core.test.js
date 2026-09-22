import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSeedState } from '../src/data/seed.js';
import { formatFileSize, initials, plural } from '../src/domain/format.js';
import { can, createVisibilityFilter, DATA_SCOPE, PERMISSION, ROLE } from '../src/domain/roles.js';
import { getStage } from '../src/domain/workflow.js';
import { createZip } from '../src/lib/export/zip.js';
import { ACTION, reducer } from '../src/store/reducer.js';

describe('format', () => {
  it('plural склоняет по правилам русского языка', () => {
    const days = ['день', 'дня', 'дней'];
    assert.deepEqual([1, 2, 5, 11, 21, 22, 111].map((count) => plural(count, days)), ['день', 'дня', 'дней', 'дней', 'день', 'дня', 'дней']);
  });

  it('initials и formatFileSize', () => {
    assert.equal(initials('Алина Воронова'), 'АВ');
    assert.equal(formatFileSize(1_240_000), '1,2 МБ');
  });
});

describe('roles', () => {
  const users = [
    { id: 'lead', role: ROLE.lead, access: { scope: DATA_SCOPE.team, directionIds: [] } },
    { id: 'm1', role: ROLE.manager, leadId: 'lead', access: { scope: DATA_SCOPE.own, directionIds: [] } },
    { id: 'm2', role: ROLE.manager, leadId: 'other', access: { scope: DATA_SCOPE.own, directionIds: ['d1'] } },
  ];
  const interactions = [
    { id: 'a', managerId: 'm1', directionId: 'd1' },
    { id: 'b', managerId: 'm2', directionId: 'd1' },
    { id: 'c', managerId: 'm2', directionId: 'd2' },
  ];
  const visibleFor = (userId) => interactions.filter(createVisibilityFilter(users.find((user) => user.id === userId), users)).map((item) => item.id);

  it('менеджер видит своё, руководитель — команду', () => {
    assert.deepEqual(visibleFor('m1'), ['a']);
    assert.deepEqual(visibleFor('lead'), ['a']);
  });

  it('ограничение по направлениям сужает видимость', () => {
    assert.deepEqual(visibleFor('m2'), ['b']);
  });

  it('права ролей', () => {
    assert.equal(can(ROLE.manager, PERMISSION.assignManager), false);
    assert.equal(can(ROLE.lead, PERMISSION.assignManager), true);
    assert.equal(can(ROLE.lead, PERMISSION.manageUsers), false);
    assert.equal(can(ROLE.admin, PERMISSION.manageUsers), true);
  });
});

describe('seed', () => {
  const state = createSeedState(new Date('2026-09-17T12:00:00'));
  const ids = (items) => new Set(items.map((item) => item.id));

  it('все ссылки взаимодействий указывают на существующие записи каталогов', () => {
    const universities = ids(state.universities);
    const directions = ids(state.directions);
    const programs = ids(state.programs);
    const products = ids(state.products);
    const users = ids(state.users);
    state.interactions.forEach((interaction) => {
      assert.ok(universities.has(interaction.universityId), interaction.id);
      assert.ok(directions.has(interaction.directionId), interaction.id);
      assert.ok(programs.has(interaction.programId), interaction.id);
      assert.ok(products.has(interaction.productId), interaction.id);
      assert.ok(users.has(interaction.managerId), interaction.id);
      const program = state.programs.find((item) => item.id === interaction.programId);
      assert.equal(program.directionId, interaction.directionId, interaction.id);
      assert.ok(program.productIds.includes(interaction.productId), interaction.id);
    });
  });

  it('события переходов ссылаются на этапы процесса', () => {
    const workflow = state.workflows[0];
    state.events
      .filter((event) => event.type === 'transition')
      .forEach((event) => {
        assert.ok(getStage(workflow, event.fromStageId), event.id);
        assert.ok(getStage(workflow, event.toStageId), event.id);
      });
  });
});

describe('interaction editing', () => {
  it('обновляет параметры и сохраняет событие с записью аудита', () => {
    const state = createSeedState(new Date('2026-09-17T12:00:00'));
    const previous = state.interactions[0];
    const event = { id: 'ev-edit', interactionId: previous.id, type: 'updated', userId: 'usr-6', at: '2026-09-17T13:00:00.000Z' };
    const audit = { at: event.at, actorId: event.userId, text: 'Изменены параметры: ИТ-продукт', target: { type: 'interaction', id: previous.id } };
    const next = reducer(state, {
      type: ACTION.interactionUpdated,
      payload: { interactionId: previous.id, patch: { productId: 'p1' }, event, audit },
    });

    assert.equal(next.interactions[0].productId, 'p1');
    assert.equal(next.interactions[0].updatedAt, event.at);
    assert.equal(next.events.at(-1), event);
    assert.equal(next.audit[0].text, audit.text);
    assert.notEqual(next.interactions, state.interactions);
  });
});

describe('createZip', () => {
  it('формирует архив с корректными сигнатурами и CRC-32', async () => {
    const bytes = new Uint8Array(await createZip([{ name: 'hello.txt', content: 'hello' }]).arrayBuffer());
    const view = new DataView(bytes.buffer);
    assert.equal(view.getUint32(0, true), 0x04034b50);
    assert.equal(view.getUint32(14, true), 0x3610a686); // CRC-32 строки «hello»
    assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  });
});
