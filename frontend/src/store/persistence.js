import { ApiError, apiClient } from '../api/client.js';
import { createSeedState, SEED_VERSION } from '../data/seed.js';
import { localStore } from '../lib/storage.js';
import { diffState, rebaseState } from './rebase.js';

const STORAGE_KEY = 'crm.state';
const SYNC_KEY = 'crm.state.sync';
// Последний снимок, который сервер принял от этого браузера: от него считаются несохранённые изменения.
const BASE_KEY = 'crm.state.base';

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
      const base = storage.read(BASE_KEY);
      return {
        state: hasCachedState ? cached : createSeedState(),
        revision: Number.isInteger(metadata?.revision) ? metadata.revision : null,
        updatedAt: metadata?.updatedAt ?? null,
        // Кэш старой версии приложения не имеет metadata: считаем его несинхронизированным.
        dirty: hasCachedState ? metadata?.dirty !== false : false,
        hasCachedState,
        base: hasCachedState && isUsableState(base) ? base : null,
      };
    },
    /** base: undefined — не менять сохранённую базу, null — забыть её. */
    write({ state, revision = null, updatedAt = null, dirty = false, base }) {
      storage.write(STORAGE_KEY, state);
      storage.write(SYNC_KEY, { revision, updatedAt, dirty });
      if (base) storage.write(BASE_KEY, base);
      else if (base === null) storage.remove(BASE_KEY);
    },
    remove() {
      storage.remove(STORAGE_KEY);
      storage.remove(SYNC_KEY);
      storage.remove(BASE_KEY);
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
      // Офлайн-изменения накладываем на свежий снимок: иначе они уйдут с новой ревизией
      // и перезапишут то, что другие сотрудники сохранили за это время.
      const state = cached.base ? rebaseState(cached.base, cached.state, remote.state) : cached.state;
      const base = cached.base ? remote.state : null;
      const result = { ...cached, state, base, revision: remote.revision, source: 'cache', needsSync: true };
      cache.write(result);
      return result;
    }

    const result = {
      state: remote.state,
      revision: remote.revision,
      updatedAt: remote.updatedAt ?? null,
      dirty: false,
      hasCachedState: true,
      base: remote.state,
      source: 'server',
      needsSync: false,
    };
    cache.write(result);
    return result;
  } catch (error) {
    return { ...cached, source: 'cache', needsSync: cached.dirty, error };
  }
}

const isConflict = (error) => error instanceof ApiError && (error.status === 409 || error.code === 'revision_conflict');

/**
 * Сохраняет изменения пользователя.
 *
 * С base (снимок, который сервер уже принял от этого браузера) отправляются только изменения —
 * POST /state/changes: сервер накладывает их на актуальный снимок, поэтому одновременная работа
 * не конфликтует и не затирает чужие смены этапов и отчёты. Ответ — актуальный снимок со всеми
 * изменениями коллег (rebasedState), его сразу показывает UI.
 *
 * Без base (кэш старой версии приложения) — прежний путь: PUT целого снимка, при 409 — повтор с force.
 */
export async function persistState(state, expectedRevision, client = apiClient, { base = null } = {}) {
  if (base) {
    const changes = diffState(base, state);
    if (Object.keys(changes).length === 0) return { revision: expectedRevision, rebasedState: null };
    const saved = await client.postStateChanges({ changes });
    return { ...saved, rebasedState: saved.state };
  }

  try {
    return await client.putState({ state, expectedRevision });
  } catch (error) {
    if (!isConflict(error)) throw error;

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
