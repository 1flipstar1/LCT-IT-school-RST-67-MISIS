/**
 * Изменения пользователя как набор операций над снимком — и их перенос на другой снимок.
 *
 * diffState(base, local) — что пользователь изменил относительно base (последнего принятого сервером снимка).
 * applyChanges(state, changes) — наложить эти изменения на любой снимок. Тот же формат применяет
 * сервер в POST /state/changes (backend/app/domain/changes.py), поэтому одновременная работа не
 * затирает чужие смены этапов, комментарии и отчёты: каждый отправляет только своё.
 *
 * Формат изменений по ключу снимка:
 *   { op: 'list', set: [записи], prepend: [записи], append: [записи], remove: [id] } — списки записей с id;
 *   { op: 'object', fields: { ключ: изменение } } — вложенные объекты (integrations);
 *   { op: 'value', value } — остальное целиком.
 */

// Списки, которые reducer наращивает с начала (новые сверху); остальные растут с конца.
const GROWS_AT_FRONT = new Set(['audit', 'reports', 'interactions', 'log']);

export function diffState(base, local) {
  return diffObject(base ?? {}, local);
}

export function applyChanges(state, changes) {
  const result = { ...state };
  for (const [key, change] of Object.entries(changes)) result[key] = applyChange(state[key], change);
  return result;
}

/** Изменения local относительно base, перенесённые на remote. */
export const rebaseState = (base, local, remote) => applyChanges(remote, diffState(base, local));

function diffObject(base, local) {
  const changes = {};
  for (const key of Object.keys(local)) {
    const change = diffValue(key, base?.[key], local[key]);
    if (change) changes[key] = change;
  }
  return changes;
}

function diffValue(key, base, local) {
  if (deepEqual(base, local)) return null;
  if (isIdList(base) && isIdList(local)) return diffList(key, base, local);
  if (isPlainObject(base) && isPlainObject(local)) return { op: 'object', fields: diffObject(base, local) };
  return { op: 'value', value: local };
}

function diffList(key, base, local) {
  const baseById = new Map(base.map((item) => [item.id, item]));
  const localIds = new Set(local.map((item) => item.id));
  const firstKnown = local.findIndex((item) => baseById.has(item.id));
  const change = { op: 'list', set: [], prepend: [], append: [], remove: base.filter((item) => !localIds.has(item.id)).map((item) => item.id) };
  local.forEach((item, index) => {
    const before = baseById.get(item.id);
    if (before) {
      if (!deepEqual(before, item)) change.set.push(item);
      return;
    }
    // Новые записи ставим туда же, куда их поставил reducer.
    const atFront = firstKnown === -1 ? GROWS_AT_FRONT.has(key) : index < firstKnown;
    (atFront ? change.prepend : change.append).push(item);
  });
  return change;
}

function applyChange(current, change) {
  if (change.op === 'value') return change.value;
  if (change.op === 'object') {
    const result = isPlainObject(current) ? { ...current } : {};
    for (const [key, nested] of Object.entries(change.fields)) result[key] = applyChange(result[key], nested);
    return result;
  }
  const list = Array.isArray(current) ? current : [];
  const removed = new Set(change.remove);
  const updates = new Map(change.set.map((item) => [item.id, item]));
  const added = new Set([...change.prepend, ...change.append].map((item) => item.id));
  const kept = list
    .filter((item) => !removed.has(item.id) && !added.has(item.id))
    .map((item) => updates.get(item.id) ?? item);
  const keptIds = new Set(kept.map((item) => item.id));
  // Изменённая запись, которую кто-то успел удалить, возвращается: правка пользователя важнее.
  const restored = change.set.filter((item) => !keptIds.has(item.id));
  return [...change.prepend, ...kept, ...restored, ...change.append];
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isIdList = (value) => Array.isArray(value) && value.every((item) => isPlainObject(item) && item.id !== undefined);

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}
