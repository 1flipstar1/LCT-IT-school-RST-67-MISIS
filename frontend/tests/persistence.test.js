import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '../src/api/client.js';
import { createSeedState } from '../src/data/seed.js';
import { createStateCache, hydrateState, persistState } from '../src/store/persistence.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    read(key, fallback = null) {
      return values.has(key) ? structuredClone(values.get(key)) : fallback;
    },
    write(key, value) {
      values.set(key, structuredClone(value));
    },
    remove(key) {
      values.delete(key);
    },
  };
}

const seed = (day) => createSeedState(new Date(`2026-09-${day}T12:00:00Z`));

describe('state persistence', () => {
  it('при чистом кэше гидратирует состояние с сервера', async () => {
    const cache = createStateCache(createMemoryStorage());
    const remoteState = seed('22');
    const result = await hydrateState({
      getState: async () => ({ state: remoteState, revision: 7, updatedAt: '2026-09-22T12:00:00Z' }),
    }, cache);

    assert.equal(result.source, 'server');
    assert.equal(result.state.interactions[0].startedAt, remoteState.interactions[0].startedAt);
    assert.equal(cache.read().revision, 7);
    assert.equal(cache.read().dirty, false);
  });

  it('не теряет грязный локальный снимок при гидратации', async () => {
    const cache = createStateCache(createMemoryStorage());
    const localState = seed('21');
    localState.audit.push({ id: 'offline-change' });
    cache.write({ state: localState, revision: 2, dirty: true });

    const result = await hydrateState({
      getState: async () => ({ state: seed('22'), revision: 5, updatedAt: '2026-09-22T12:00:00Z' }),
    }, cache);

    assert.equal(result.source, 'cache');
    assert.equal(result.needsSync, true);
    assert.equal(result.revision, 5);
    assert.equal(result.state.audit[0].id, 'offline-change');
  });

  it('при офлайне использует локальный кэш', async () => {
    const cache = createStateCache(createMemoryStorage());
    const localState = seed('20');
    cache.write({ state: localState, revision: 3, dirty: false });

    const result = await hydrateState({ getState: async () => { throw new ApiError('offline'); } }, cache);
    assert.equal(result.source, 'cache');
    assert.equal(result.revision, 3);
    assert.equal(result.state.interactions[0].startedAt, localState.interactions[0].startedAt);
  });

  it('офлайн-изменения при гидратации накладываются на свежий снимок сервера', async () => {
    const cache = createStateCache(createMemoryStorage());
    const baseState = seed('21');
    const localState = { ...baseState, audit: [{ id: 'offline-change' }, ...baseState.audit] };
    const remoteState = { ...baseState, audit: [{ id: 'colleague-change' }, ...baseState.audit] };
    cache.write({ state: localState, revision: 2, dirty: true, base: baseState });

    const result = await hydrateState({ getState: async () => ({ state: remoteState, revision: 5 }) }, cache);
    assert.equal(result.revision, 5);
    assert.deepEqual(result.state.audit.map((item) => item.id).slice(0, 2), ['offline-change', 'colleague-change']);
    assert.equal(result.base, remoteState);
  });

  it('с базой отправляет только свои изменения и возвращает актуальный снимок', async () => {
    const baseState = seed('22');
    const localState = { ...baseState, reports: [{ id: 'r-mine' }, ...baseState.reports] };
    const sent = [];
    const client = {
      async postStateChanges(body) {
        sent.push(body);
        return { state: { ...baseState, reports: [{ id: 'r-mine' }, { id: 'r-colleague' }, ...baseState.reports] }, revision: 7 };
      },
      async putState() {
        throw new Error('PUT целого снимка не должен вызываться');
      },
    };

    const result = await persistState(localState, 4, client, { base: baseState });
    assert.deepEqual(sent, [{ changes: { reports: { op: 'list', set: [], prepend: [{ id: 'r-mine' }], append: [], remove: [] } } }]);
    assert.equal(result.revision, 7);
    assert.deepEqual(result.rebasedState.reports.map((r) => r.id).slice(0, 2), ['r-mine', 'r-colleague']);
  });

  it('без изменений ничего не отправляет', async () => {
    const baseState = seed('22');
    const result = await persistState(baseState, 4, { postStateChanges: () => assert.fail('лишний запрос') }, { base: baseState });
    assert.equal(result.revision, 4);
  });

  it('без базы (кэш старой версии) после конфликта повторяет PUT с текущей ревизией и force', async () => {
    const calls = [];
    const client = {
      async putState(body) {
        calls.push(body);
        if (calls.length === 1) {
          throw new ApiError('conflict', {
            status: 409,
            code: 'revision_conflict',
            details: { expectedRevision: 4, currentRevision: 6 },
          });
        }
        return { state: body.state, revision: 7, updatedAt: '2026-09-22T12:00:00Z' };
      },
    };
    const state = seed('22');

    const result = await persistState(state, 4, client);
    assert.equal(result.revision, 7);
    assert.deepEqual(calls.map(({ expectedRevision, force = false }) => ({ expectedRevision, force })), [
      { expectedRevision: 4, force: false },
      { expectedRevision: 6, force: true },
    ]);
  });
});
