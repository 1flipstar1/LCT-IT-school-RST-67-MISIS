/** Отдаёт Blob пользователю как файл с понятным именем. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** «Отчёт по вузам 17.09.2026.xlsx» — без символов, запрещённых в именах файлов Windows. */
export function safeFileName(name, extension) {
  return `${name.replace(/[\\/:*?"<>|]+/g, ' ').trim()}.${extension}`;
}
