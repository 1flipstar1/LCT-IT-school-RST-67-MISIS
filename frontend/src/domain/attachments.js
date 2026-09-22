import { AppError } from './errors.js';
import { fileExtension } from './format.js';

/** Форматы вложений к этапам (ТЗ, функциональные требования, п. 3). */
export const ATTACHMENT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'zip', 'gz', 'gzip', 'rar', 'doc', 'docx', 'xls', 'xlsx'];

export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(',');

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function validateAttachment(file) {
  if (!ATTACHMENT_EXTENSIONS.includes(fileExtension(file.name))) throw new AppError('FILE-415', file.name);
  if (file.size > MAX_ATTACHMENT_BYTES) throw new AppError('FILE-413', file.name);
}

/** В состоянии храним метаданные и непрозрачный id; содержимое остаётся в серверном хранилище. */
export const toAttachmentMeta = (file) => ({
  ...(file.id ? { id: file.id } : {}),
  name: file.name,
  size: file.size,
  ...(file.contentType ? { contentType: file.contentType } : {}),
  ...(file.downloadUrl ? { downloadUrl: file.downloadUrl } : {}),
});
