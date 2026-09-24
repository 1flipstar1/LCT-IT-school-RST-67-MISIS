import { addDays, startOfDay, toIsoDate } from '../../../domain/format.js';
import { normalize } from './text.js';

/**
 * Период из фразы: «за март», «за последние 2 недели», «с 01.03 по 15.05.2026», «в прошлом квартале».
 * Возвращает период в модели фильтров ({ preset, from, to }) или null, если период не назван.
 */

const MONTHS = [
  /^январ/, /^феврал/, /^март/, /^апрел/, /^ма[йяе]$/, /^июн/, /^июл/, /^август/, /^сентябр/, /^октябр/, /^ноябр/, /^декабр/,
];
const MONTH_WORD = '(январ[а-я]*|феврал[а-я]*|март[а-я]*|апрел[а-я]*|ма[йяе]|июн[а-я]*|июл[а-я]*|август[а-я]*|сентябр[а-я]*|октябр[а-я]*|ноябр[а-я]*|декабр[а-я]*)(?![а-я])';
const monthIndex = (word) => MONTHS.findIndex((pattern) => pattern.test(word));

const UNITS = [
  { pattern: /^(дн|день|сут)/, days: 1 },
  { pattern: /^недел/, days: 7 },
  { pattern: /^(месяц|мес)/, days: 30 },
  { pattern: /^квартал/, days: 90 },
  { pattern: /^(год|лет)/, days: 365 },
];
const PRESET_BY_DAYS = { 30: '30d', 90: '90d', 365: '365d' };
const NUMBER_WORDS = { один: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, десять: 10, двенадцать: 12 };
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4 };

const custom = (from, to) => ({ preset: 'custom', from: from ? toIsoDate(from) : '', to: to ? toIsoDate(to) : '' });
const fullYear = (value, fallback) => {
  if (!value) return fallback;
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
};
const monthRange = (year, month) => [new Date(year, month, 1), new Date(year, month + 1, 0)];
const quarterRange = (year, quarter) => [new Date(year, (quarter - 1) * 3, 1), new Date(year, quarter * 3, 0)];
/** «за ноябрь» в сентябре — прошлый ноябрь: будущих данных нет. */
const pastYearOf = (month, now) => (month > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear());

function parseDate(day, month, year, now) {
  const date = new Date(fullYear(year, now.getFullYear()), month, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function rolling(amountWord, unitWord, now) {
  const unit = UNITS.find(({ pattern }) => pattern.test(unitWord));
  if (!unit) return null;
  const amount = amountWord ? Number(amountWord) || NUMBER_WORDS[amountWord] || 1 : 1;
  const days = amount * unit.days;
  if (PRESET_BY_DAYS[days]) return { preset: PRESET_BY_DAYS[days], from: '', to: '' };
  return custom(addDays(startOfDay(now), -days), now);
}

export function parsePeriod(input, now = new Date()) {
  const text = normalize(input);
  const today = startOfDay(now);
  const year = now.getFullYear();
  let match;

  if (/за (вс[её]|весь) (время|период)|за все годы/.test(text)) return { preset: 'all', from: '', to: '' };

  match = text.match(/с\s+(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s*(?:г\.?)?\s*(?:по|до|-|—)\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (match) return custom(parseDate(match[1], match[2] - 1, match[3], now), parseDate(match[4], match[5] - 1, match[6] ?? match[3], now));

  match = text.match(new RegExp(`с\\s+(\\d{1,2})\\s+${MONTH_WORD}(?:\\s+(\\d{4}))?\\s+(?:по|до)\\s+(\\d{1,2})\\s+${MONTH_WORD}(?:\\s+(\\d{4}))?`));
  if (match) return custom(parseDate(match[1], monthIndex(match[2]), match[3] ?? match[6], now), parseDate(match[4], monthIndex(match[5]), match[6], now));

  match = text.match(new RegExp(`с\\s+${MONTH_WORD}(?:\\s+(\\d{4}))?\\s+(?:по|до)\\s+${MONTH_WORD}(?:\\s+(\\d{4}))?`));
  if (match) {
    const toYear = fullYear(match[4], year);
    return custom(monthRange(fullYear(match[2], toYear), monthIndex(match[1]))[0], monthRange(toYear, monthIndex(match[3]))[1]);
  }

  match = text.match(/(?:^|\s)с\s+(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (match) return custom(parseDate(match[1], match[2] - 1, match[3], now), null);

  if (/(прошл|прошедш|предыдущ)[а-я]* месяц/.test(text)) return custom(...monthRange(year, now.getMonth() - 1));
  if (/(прошл|прошедш|предыдущ)[а-я]* квартал/.test(text)) {
    const quarter = Math.floor(now.getMonth() / 3);
    return custom(...(quarter === 0 ? quarterRange(year - 1, 4) : quarterRange(year, quarter)));
  }
  if (/(прошл|прошедш|предыдущ)[а-я]* год/.test(text)) return custom(new Date(year - 1, 0, 1), new Date(year - 1, 11, 31));
  if (/(эт|текущ)[а-я]* месяц|с начала месяца/.test(text)) return custom(new Date(year, now.getMonth(), 1), today);
  if (/(эт|текущ)[а-я]* квартал|с начала квартала/.test(text)) return custom(new Date(year, Math.floor(now.getMonth() / 3) * 3, 1), today);
  if (/(эт|текущ)[а-я]* год|с начала года/.test(text)) return custom(new Date(year, 0, 1), today);
  if (/за сегодня|сегодняшн/.test(text)) return custom(today, today);

  match = text.match(/(\d|i{1,3}|iv)\s*(?:-?й\s+)?квартал[а-я]*(?:\s+(\d{4}))?/);
  if (match) return custom(...quarterRange(fullYear(match[2], year), Number(match[1]) || ROMAN[match[1]]));

  match = text.match(/(?:за|в|во)\s+(\d{4})\s*(?:г(?![а-я])|год)/);
  if (match) return custom(new Date(Number(match[1]), 0, 1), new Date(Number(match[1]), 11, 31));

  match = text.match(new RegExp(`(?:за|в)\\s+${MONTH_WORD}(?:\\s+(\\d{4}))?`));
  if (match) {
    const month = monthIndex(match[1]);
    return custom(...monthRange(fullYear(match[2], pastYearOf(month, now)), month));
  }

  match = text.match(/(?:за|в течение)\s+(?:последн[а-я]+\s+)?(\d+|[а-я]+)?\s*(дн[а-я]*|день|сут[а-я]*|недел[а-я]*|месяц[а-я]*|мес(?![а-я])|квартал[а-я]*|год[а-я]*|лет)/);
  if (match) {
    const amount = match[1] && !/^последн/.test(match[1]) ? match[1] : null;
    return rolling(amount, match[2], now);
  }
  return null;
}
