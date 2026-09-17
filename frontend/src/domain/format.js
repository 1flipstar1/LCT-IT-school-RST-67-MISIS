const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'short' });
const numberFormatter = new Intl.NumberFormat('ru-RU');

export const toDate = (value) => (value instanceof Date ? value : new Date(value));

export const formatDate = (value) => (value ? dateFormatter.format(toDate(value)) : '—');

export const formatNumber = (value) => numberFormatter.format(value);

export const formatPercent = (value) => `${Math.round(value)}%`;

export function formatMonth(isoMonth) {
  const label = monthFormatter.format(new Date(`${isoMonth}-01T00:00:00`)).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function startOfDay(value) {
  const date = new Date(toDate(value));
  date.setHours(0, 0, 0, 0);
  return date;
}

export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

export function addDays(value, days) {
  return new Date(toDate(value).getTime() + days * DAY_MS);
}

/** «сегодня, 14:05», «вчера, 09:12», «12 мая» */
export function formatRelativeDateTime(value, now = new Date()) {
  const date = toDate(value);
  const diff = daysBetween(date, now);
  if (diff === 0) return `сегодня, ${timeFormatter.format(date)}`;
  if (diff === 1) return `вчера, ${timeFormatter.format(date)}`;
  if (date.getFullYear() === now.getFullYear()) return shortDateFormatter.format(date);
  return formatDate(date);
}

/** plural(3, ['день', 'дня', 'дней']) → 'дня' */
export function plural(count, [one, few, many]) {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const formatDays = (count) => `${count} ${plural(count, ['день', 'дня', 'дней'])}`;

export function initials(fullName = '') {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
}

export function fileExtension(name = '') {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export const toIsoDate = (value) => {
  const date = toDate(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const createId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
