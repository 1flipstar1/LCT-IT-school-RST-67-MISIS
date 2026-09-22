import { ApiError, apiClient } from '../api/client.js';
import { createSeedState, SEED_VERSION } from '../data/seed.js';
import { localStore } from '../lib/storage.js';

const STORAGE_KEY = 'crm.state';
const SYNC_KEY = 'crm.state.sync';

const REQUIRED_ARRAYS = [
  'universities',
  'directions',
  'programs',
  'products',
  'users',
  'workflows',
  'interactions',
  'events',
  'metrics',
  'inbox',
  'reports',
  'audit',
];

/** Не принимаем неполный/устаревший снимок: такой ответ не должен ломать уже работающий UI. */
export function isUsableState(state) {
  return Boolean(
    state
      && state.version === SEED_VERSION
      && REQUIRED_ARRAYS.every((key) => Array.isArray(state[key]))
      && state.users.length > 0
      && state.workflows.length > 0
      && state.integrations
      && Array.isArray(state.integrations.sources)
      && Array.isArray(state.integrations.log),
  );
}

export function createStateCache(storage = localStore) {
  return {
    read() {
      const cached = storage.read(STORAGE_KEY);
      const hasCachedState = isUsableState(cached);
      const metadata = storage.read(SYNC_KEY, {});
      return {
        state: hasCachedState ? cached : createSeedState(),
        revision: Number.isInteger(metadata?.revision) ? metadata.revision : null,
        updatedAt: metadata?.updatedAt ?? null,
        // Кэш старой версии приложения не имеет metadata: считаем его несинхронизированным.
        dirty: hasCachedState ? metadata?.dirty !== false : false,
        hasCachedState,
      };
    },
    write({ state, revision = null, updatedAt = null, dirty = false }) {
      storage.write(STORAGE_KEY, state);
      storage.write(SYNC_KEY, { revision, updatedAt, dirty });
    },
    remove() {
      storage.remove(STORAGE_KEY);
      storage.remove(SYNC_KEY);
    },
  };
}

export const stateCache = createStateCache();

/**
 * Синхронное начальное значение нужно reducer до ответа API. После монтирования StoreProvider
 * заменяет его серверным снимком либо оставляет как офлайн-fallback.
 */
export function loadState() {
  return stateCache.read().state;
}

export const saveState = (state, metadata = {}) => stateCache.write({ state, ...metadata });

/** Загружает источник истины, не теряя локальные изменения, сделанные без связи. */
export async function hydrateState(client = apiClient, cache = stateCache, options = {}) {
  const cached = cache.read();
  try {
    const remote = await client.getState(options);
    if (!isUsableState(remote?.state)) {
      cache.write({ ...cached, revision: remote?.revision ?? cached.revision, dirty: true });
      return { ...cached, revision: remote?.revision ?? cached.revision, source: 'cache', needsSync: true };
    }

    if (cached.hasCachedState && cached.dirty) {
      const result = { ...cached, revision: remote.revision, source: 'cache', needsSync: true };
      cache.write(result);
      return result;
    }

    const result = {
      state: remote.state,
      revision: remote.revision,
      updatedAt: remote.updatedAt ?? null,
      dirty: false,
      hasCachedState: true,
      source: 'server',
      needsSync: false,
    };
    cache.write(result);
    return result;
  } catch (error) {
    return { ...cached, source: 'cache', needsSync: cached.dirty, error };
  }
}

/**
 * Сохраняет снимок с optimistic locking. При 409 локальная работа остаётся в UI и кэше,
 * а повторный PUT явно разрешает замену целого снимка на актуальной ревизии.
 */
export async function persistState(state, expectedRevision, client = apiClient) {
  try {
    return await client.putState({ state, expectedRevision });
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 409 && error.code !== 'revision_conflict')) throw error;

    let currentRevision = error.details?.currentRevision;
    if (!Number.isInteger(currentRevision)) {
      const current = await client.getState();
      currentRevision = current.revision;
    }
    return client.putState({ state, expectedRevision: currentRevision, force: true });
  }
}

export function resetState() {
  const current = stateCache.read();
  const state = createSeedState();
  stateCache.write({ state, revision: current.revision, dirty: true });
  return state;
}
