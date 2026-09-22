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

  it('после конфликта повторяет PUT с текущей ревизией и force', async () => {
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
