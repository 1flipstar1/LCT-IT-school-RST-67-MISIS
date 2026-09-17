import { createSeedState, SEED_VERSION } from '../data/seed.js';
import { localStore } from '../lib/storage.js';

const STORAGE_KEY = 'crm.state';

/**
 * В прототипе состояние живёт в localStorage вместо API: изменения не теряются при перезагрузке.
 * При смене структуры данных (SEED_VERSION) старый кэш сбрасывается, а не ломает интерфейс.
 */
export function loadState() {
  const cached = localStore.read(STORAGE_KEY);
  return cached?.version === SEED_VERSION ? cached : createSeedState();
}

export const saveState = (state) => localStore.write(STORAGE_KEY, state);

export function resetState() {
  localStore.remove(STORAGE_KEY);
  return createSeedState();
}
