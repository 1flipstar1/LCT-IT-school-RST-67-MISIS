import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError, createApiClient } from '../src/api/client.js';

function jsonResponse(body, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  };
}

describe('API client', () => {
  it('передаёт Bearer-токен и контракт GET/PUT state', async () => {
    const calls = [];
    const client = createApiClient({
      baseUrl: 'http://backend.test/api/v1/',
      getAccessToken: () => 'demo-token',
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse({ state: { version: 5 }, revision: calls.length, updatedAt: '2026-09-22T10:00:00Z' });
      },
    });

    await client.getState();
    await client.putState({ state: { version: 5 }, expectedRevision: 4, force: true });

    assert.equal(calls[0].url, 'http://backend.test/api/v1/state');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer demo-token');
    assert.equal(calls[1].options.method, 'PUT');
    assert.deepEqual(JSON.parse(calls[1].options.body), {
      state: { version: 5 },
      expectedRevision: 4,
      force: true,
    });
  });

  it('отправляет роль в demo login и возвращает ответ без преобразований', async () => {
    let request;
    const response = { accessToken: 'token', tokenType: 'Bearer', user: { id: 'usr-1', role: 'manager' }, expiresIn: 3600 };
    const client = createApiClient({
      fetchImpl: async (url, options) => {
        request = { url, options };
        return jsonResponse(response);
      },
    });

    assert.deepEqual(await client.demoLogin('manager'), response);
    assert.equal(request.url, '/api/v1/auth/demo');
    assert.deepEqual(JSON.parse(request.options.body), { role: 'manager' });
  });

  it('отправляет вопрос помощнику с историей и Bearer-токеном', async () => {
    let request;
    const client = createApiClient({
      getAccessToken: () => 'demo-token',
      fetchImpl: async (url, options) => {
        request = { url, options };
        return jsonResponse({ type: 'message', message: 'Ответ' });
      },
    });

    const payload = { message: 'Как сменить этап?', history: [], page: 'interactions' };
    assert.deepEqual(await client.chatWithAssistant(payload), { type: 'message', message: 'Ответ' });
    assert.equal(request.url, '/api/v1/assistant/chat');
    assert.equal(request.options.headers.Authorization, 'Bearer demo-token');
    assert.deepEqual(JSON.parse(request.options.body), payload);
  });

  it('сохраняет код и детали ошибки сервера', async () => {
    const client = createApiClient({
      fetchImpl: async () => jsonResponse({
        error: {
          code: 'revision_conflict',
          message: 'Revision changed',
          details: { expectedRevision: 2, currentRevision: 3 },
        },
      }, 409),
    });

    await assert.rejects(
      client.putState({ state: {}, expectedRevision: 2 }),
      (error) => error instanceof ApiError
        && error.status === 409
        && error.code === 'revision_conflict'
        && error.details.currentRevision === 3,
    );
  });

  it('превращает сетевой сбой в ApiError со статусом 0', async () => {
    const client = createApiClient({ fetchImpl: async () => { throw new TypeError('offline'); } });
    await assert.rejects(client.getState(), (error) => error instanceof ApiError && error.status === 0);
  });
});
