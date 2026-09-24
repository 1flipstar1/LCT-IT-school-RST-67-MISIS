import { findAlias, hasStem, tokenize } from './text.js';

/**
 * Поиск справочных сущностей в свободном тексте: «отчёт по КФУ и ИТМО, DevOps, кроме Вороновой».
 * Работает только на данных справочников — без ИИ и без сети, поэтому результат предсказуем.
 */

/** Слова, по которым вуз не отличить от других вузов. */
const GENERIC_WORDS = new Set(['университет', 'федеральный', 'государственный', 'национальный', 'исследовательский', 'им', 'имени', 'ниу']);
const MY_WORDS = new Set(['мои', 'моих', 'моим', 'моими']);
const STAGE_CONTEXT = ['этап', 'стади', 'статус'];
const EXCLUSION = /(?:кроме|за исключением|исключая)\s+(.+?)(?=[,.;!?]|\s(?:за|в|во|с|со|по|на|pdf|пдф|excel|xlsx|xls)\s|$)/i;

export const ENTITY_TYPES = [
  { key: 'universityIds', catalog: 'universities' },
  { key: 'managerIds', catalog: 'users' },
  { key: 'directionIds', catalog: 'directions' },
  { key: 'productIds', catalog: 'products' },
  { key: 'programIds', catalog: 'programs' },
  { key: 'stageIds', catalog: 'stages' },
];

const significant = (name) => tokenize(name).filter((token) => token.length > 1 && !GENERIC_WORDS.has(token));

function aliasesOf(catalog, item) {
  const aliases = [significant(item.name)];
  if (item.shortName) aliases.push(significant(item.shortName));
  if (catalog === 'users') aliases.push(significant(item.name).slice(-1));
  return aliases.filter((tokens) => tokens.length > 0);
}

/** Первое слово названия — самостоятельный синоним, если оно не повторяется у других записей справочника. */
function firstWordAliases(catalog, items) {
  if (catalog === 'programs' || catalog === 'users') return new Map();
  const counts = new Map();
  items.forEach((item) => {
    const first = significant(item.name)[0];
    if (first) counts.set(first, (counts.get(first) ?? 0) + 1);
  });
  return new Map(
    items
      .map((item) => [item.id, significant(item.name)[0]])
      .filter(([, first]) => first && first.length >= 4 && counts.get(first) === 1),
  );
}

/** Этапы всех наборов этапов; одноимённые этапы разных наборов ищутся как один. */
function stagesOf(workflows) {
  const byName = new Map();
  workflows.flatMap((workflow) => workflow.stages).forEach((stage) => {
    const entry = byName.get(stage.name) ?? { id: stage.id, name: stage.name, ids: [] };
    entry.ids.push(stage.id);
    byName.set(stage.name, entry);
  });
  return [...byName.values()];
}

export function createEntityMatcher({ universities = [], users = [], directions = [], products = [], programs = [], workflows = [] }) {
  const catalogs = { universities, users, directions, products, programs, stages: stagesOf(workflows) };

  const index = ENTITY_TYPES.map(({ key, catalog }) => {
    const items = catalogs[catalog];
    const firstWords = firstWordAliases(catalog, items);
    const aliases = items
      .flatMap((item) => [
        ...aliasesOf(catalog, item).map((tokens) => ({ item, tokens })),
        ...(firstWords.has(item.id) ? [{ item, tokens: [firstWords.get(item.id)] }] : []),
      ])
      .sort((a, b) => b.tokens.length - a.tokens.length);
    return { key, catalog, items, aliases };
  });

  const idsOf = (item) => item.ids ?? [item.id];

  function scan(text) {
    const tokens = tokenize(text);
    const consumed = new Set();
    const found = Object.fromEntries(ENTITY_TYPES.map(({ key }) => [key, []]));
    const stageContext = hasStem(tokens, STAGE_CONTEXT);

    for (const { key, catalog, aliases } of index) {
      if (catalog === 'stages' && !stageContext) continue;
      for (const { item, tokens: aliasTokens } of aliases) {
        const positions = findAlias(tokens, aliasTokens, consumed);
        if (!positions) continue;
        positions.forEach((position) => consumed.add(position));
        idsOf(item).forEach((id) => {
          if (!found[key].includes(id)) found[key].push(id);
        });
      }
    }
    return { found, tokens };
  }

  return {
    /**
     * Сущности из текста в виде полей фильтра. «кроме X» исключает X из выборки,
     * «мои» ограничивает выборку текущим пользователем.
     */
    extract(text, { userId } = {}) {
      const exclusion = text.match(EXCLUSION);
      const { found, tokens } = scan(exclusion ? text.replace(exclusion[0], ' ') : text);
      if (userId && tokens.some((token) => MY_WORDS.has(token)) && !found.managerIds.includes(userId)) found.managerIds.push(userId);
      if (!exclusion) return found;

      const { found: excluded } = scan(exclusion[1]);
      for (const { key, items } of index) {
        if (excluded[key].length === 0) continue;
        const base = found[key].length > 0 ? found[key] : items.flatMap(idsOf);
        found[key] = base.filter((id) => !excluded[key].includes(id));
      }
      return found;
    },

    /** Названия от ИИ → id справочника. Нераспознанные названия возвращаются отдельно, чтобы о них сказать. */
    resolveNames(key, names = []) {
      const type = index.find((entry) => entry.key === key);
      const ids = [];
      const unknown = [];
      for (const name of names) {
        if (typeof name !== 'string' || !name.trim()) continue;
        const nameTokens = tokenize(name);
        const meaningful = nameTokens.filter((token) => !GENERIC_WORDS.has(token));
        const hit = type.aliases.find(({ tokens }) => findAlias(nameTokens, tokens))
          ?? (meaningful.length > 0 ? type.aliases.find(({ tokens }) => findAlias(tokens, meaningful)) : undefined);
        if (hit) idsOf(hit.item).forEach((id) => ids.includes(id) || ids.push(id));
        else unknown.push(name.trim());
      }
      return { ids, unknown };
    },
  };
}
