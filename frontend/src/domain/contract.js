import { daysBetween, toDate } from './format.js';

/** Статусы передачи материалов и лицензий в вуз (поле «Статус по передаче» из ТЗ). */
export const TRANSFER_STATUSES = ['Не передано', 'Передано частично', 'Передано'];

/** За сколько дней до окончания лицензия считается истекающей. */
export const LICENSE_WARNING_DAYS = 60;

export const LICENSE_STATE = Object.freeze({
  none: 'none',
  active: 'active',
  expiring: 'expiring',
  expired: 'expired',
});

export const LICENSE_STATE_LABELS = {
  [LICENSE_STATE.none]: 'Не подписана',
  [LICENSE_STATE.active]: 'Действует',
  [LICENSE_STATE.expiring]: 'Истекает',
  [LICENSE_STATE.expired]: 'Истекла',
};

/** Лицензия действует licenseYears лет с даты подписания; за LICENSE_WARNING_DAYS до конца — «истекает». */
export function getLicenseState(contract, now = new Date()) {
  if (!contract?.licenseSignedAt || !contract.licenseYears) return { state: LICENSE_STATE.none, expiresAt: null, daysLeft: null };

  const expiresAt = toDate(`${contract.licenseSignedAt}T00:00:00`);
  expiresAt.setFullYear(expiresAt.getFullYear() + Number(contract.licenseYears));
  const daysLeft = daysBetween(now, expiresAt);

  let state = LICENSE_STATE.active;
  if (daysLeft < 0) state = LICENSE_STATE.expired;
  else if (daysLeft <= LICENSE_WARNING_DAYS) state = LICENSE_STATE.expiring;
  return { state, expiresAt, daysLeft };
}
