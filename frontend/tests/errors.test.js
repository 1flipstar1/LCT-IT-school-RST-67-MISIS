import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { AppError, codeForRenderError, ERROR_CODES, errorCodeForStatus, errorNumber, isRetryable } from '../src/domain/errors.js';

describe('страницы ошибок', () => {
  it('сопоставляет частые HTTP-статусы с кодами каталога', () => {
    assert.equal(errorCodeForStatus(404), 'NOT-FOUND-404');
    assert.equal(errorCodeForStatus(500), 'SERVER-500');
    assert.equal(errorCodeForStatus(503), 'UNAVAILABLE-503');
    assert.equal(errorCodeForStatus(505), 'PROTOCOL-505');
    assert.equal(errorCodeForStatus(0), 'NETWORK-0');
    for (const status of [0, 400, 401, 403, 404, 408, 429, 500, 502, 503, 504, 505]) {
      const code = errorCodeForStatus(status);
      assert.ok(ERROR_CODES[code]?.title && ERROR_CODES[code]?.hint, `нет текста для ${status}`);
    }
  });

  it('незнакомые статусы относит к общей ошибке запроса или сервера', () => {
    assert.equal(errorCodeForStatus(418), 'REQUEST-400');
    assert.equal(errorCodeForStatus(507), 'SERVER-500');
    assert.equal(errorCodeForStatus(302), null);
  });

  it('берёт номер для крупной надписи и знает, что можно повторить', () => {
    assert.equal(errorNumber('NOT-FOUND-404'), '404');
    assert.equal(errorNumber('NETWORK-0'), null);
    assert.ok(isRetryable('UNAVAILABLE-503'));
    assert.ok(!isRetryable('NOT-FOUND-404'));
  });

  it('недогруженную страницу считает проблемой связи, а не поломкой интерфейса', () => {
    assert.equal(codeForRenderError(new TypeError('Failed to fetch dynamically imported module: /src/x.jsx')), 'NETWORK-0');
    assert.equal(codeForRenderError(new TypeError('Importing a module script failed.')), 'NETWORK-0');
    assert.equal(codeForRenderError(new Error('Cannot read properties of undefined')), 'APP-500');
    assert.equal(codeForRenderError(new AppError('ACCESS-403')), 'ACCESS-403');
  });

  it('статические страницы сервера совпадают с каталогом', () => {
    for (const status of [404, 500, 502, 503, 504]) {
      const html = readFileSync(new URL(`../public/errors/${status}.html`, import.meta.url), 'utf8');
      const code = errorCodeForStatus(status);
      assert.ok(html.includes(ERROR_CODES[code].title), `${status}.html: заголовок не совпадает с каталогом`);
      assert.ok(html.includes(code), `${status}.html: нет кода ${code}`);
    }
  });
});
