/**
 * Нормализация русского текста для разбора команд без ИИ.
 * Морфология упрощена: у слов длиннее четырёх букв сравниваем основу без двух последних букв —
 * «Казанского», «Вороновой», «машинному обучению» совпадают со справочными названиями.
 */

export const normalize = (value = '') => value.toLocaleLowerCase('ru').replace(/ё/g, 'е');

export const tokenize = (value = '') => normalize(value).split(/[^a-zа-я0-9]+/i).filter(Boolean);

const SHORT_WORD = 4;

export const stem = (token) => (token.length <= SHORT_WORD ? token : token.slice(0, Math.max(SHORT_WORD, token.length - 2)));

/** Совпадает ли слово из запроса со словом справочника с точностью до окончания. */
export function tokenMatches(textToken, aliasToken) {
  if (aliasToken.length <= SHORT_WORD) {
    return textToken === aliasToken || (textToken.startsWith(aliasToken) && textToken.length - aliasToken.length <= 2);
  }
  return textToken.startsWith(stem(aliasToken));
}

/**
 * Ищет все слова alias среди ещё не занятых слов запроса.
 * Возвращает индексы найденных слов или null, если хотя бы одного слова нет.
 */
export function findAlias(textTokens, aliasTokens, consumed = new Set()) {
  const positions = [];
  for (const aliasToken of aliasTokens) {
    const position = textTokens.findIndex((token, index) => !consumed.has(index) && !positions.includes(index) && tokenMatches(token, aliasToken));
    if (position === -1) return null;
    positions.push(position);
  }
  return positions;
}

/** Есть ли в тексте слово, начинающееся с одной из основ: hasStem(text, ['отчет', 'выгруз']). */
export const hasStem = (tokens, stems) => tokens.some((token) => stems.some((item) => token.startsWith(item)));

/** Текст в кавычках или после двоеточия: «добавь комментарий: созвонились» → «созвонились». */
export function extractQuoted(value) {
  const quoted = value.match(/[«"“„']([^»"”']{2,})[»"”']/);
  if (quoted) return quoted[1].trim();
  const colon = value.indexOf(':');
  return colon === -1 ? '' : value.slice(colon + 1).trim();
}
