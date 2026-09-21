/**
 * Собирает статические страницы ошибок веб-сервера (public/errors/<статус>.html) из каталога
 * ошибок и раскладки фирменной иллюстрации — тех же, что у страницы ошибки в приложении.
 * Запуск: npm run build:error-pages. Результат коммитится: сервер отдаёт эти файлы как есть.
 */
import { copyFileSync, readdirSync, writeFileSync } from 'node:fs';
import { ERROR_CODES, errorCodeForStatus, errorNumber, isRetryable, SERVER_ERROR_PAGES } from '../src/domain/errors.js';
import { ART_FONT_SIZE, layoutErrorArt } from '../src/features/errors/errorArtLayout.js';

const root = new URL('../', import.meta.url);
const out = new URL('public/errors/', root);

// Круглые иллюстрации — в том же порядке, что в ui/avatarImages.js (по имени файла).
const arts = readdirSync(new URL('avatars/', root)).filter((file) => file.endsWith('.svg')).sort();
arts.forEach((file, index) => copyFileSync(new URL(`avatars/${file}`, root), new URL(`art-${index}.svg`, out)));

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function artSvg(number) {
  const { width, height, items } = layoutErrorArt(number, arts.length);
  const shapes = items.map((item, index) =>
    item.kind === 'disc'
      ? `<image class="disc" style="animation-delay: ${index * -1.2}s" href="/errors/art-${item.artIndex}.svg" x="${item.x}" y="${item.y}" width="${item.size}" height="${item.size}" />`
      : `<text x="${item.x}" y="${item.y}" font-size="${ART_FONT_SIZE}" text-anchor="middle">${item.glyph}</text>`,
  );
  return `<svg class="art" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ошибка ${number}">\n        ${shapes.join('\n        ')}\n      </svg>`;
}

for (const status of SERVER_ERROR_PAGES) {
  const code = errorCodeForStatus(status);
  const { title, hint } = ERROR_CODES[code];
  const retry = isRetryable(code);
  const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${status} — ${escape(title)} · ИТ Школа Ростелекома</title>
    <link rel="stylesheet" href="/errors/errors.css" />
  </head>
  <body>
    <main>
      <img class="logo" src="/errors/logo.svg" alt="Ростелеком. ИТ Школа" />
      ${artSvg(errorNumber(code))}
      <h1>${escape(title)}</h1>
      <p class="hint">${escape(hint)}</p>
      <div class="actions">
${retry ? '        <a class="button primary" href="">Обновить страницу</a>\n' : ''}        <a class="button${retry ? '' : ' primary'}" href="/">На главную</a>
      </div>
      <p class="code">Код ошибки: ${code} — назовите его поддержке, так причину найдут быстрее.</p>
    </main>
  </body>
</html>
`;
  writeFileSync(new URL(`${status}.html`, out), html);
  console.log(`public/errors/${status}.html — ${title}`);
}
