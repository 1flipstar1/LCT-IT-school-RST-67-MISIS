import { getStoredAccessToken } from '../auth/sessionStorage.js';
import { AppError, errorCodeForStatus } from '../domain/errors.js';

export const API_BASE_URL = '/api/v1';

/** Ошибка HTTP/API с исходным кодом сервера и деталями для разрешения конфликтов. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = null, details = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function apiErrorToAppError(error) {
  if (error instanceof AppError) return error;
  return new AppError(errorCodeForStatus(error?.status ?? 0) ?? 'APP-500', error?.details);
}

async function readPayload(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createRequestSignal(signal, timeoutMs) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });

  const timeout = timeoutMs > 0 ? setTimeout(() => controller.abort(new Error('API request timeout')), timeoutMs) : null;
  return {
    signal: controller.signal,
    dispose() {
      if (timeout) clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    },
  };
}

export function createApiClient({
  baseUrl = API_BASE_URL,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  getAccessToken = getStoredAccessToken,
  timeoutMs = 8_000,
} = {}) {
  const root = baseUrl.replace(/\/$/, '');

  async function request(path, { method = 'GET', body, formData, responseType = 'json', signal } = {}) {
    if (!fetchImpl) throw new ApiError('Fetch API недоступен', { status: 0, code: 'network_error' });

    const accessToken = getAccessToken?.();
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const requestSignal = createRequestSignal(signal, timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        method,
        headers,
        body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
        cache: 'no-store',
        credentials: 'same-origin',
        signal: requestSignal.signal,
      });
    } catch (error) {
      throw new ApiError('Не удалось связаться с сервером', { status: 0, code: 'network_error', cause: error });
    } finally {
      requestSignal.dispose();
    }

    if (response.ok && responseType === 'blob') return response.blob();
    const payload = await readPayload(response);
    if (!response.ok) {
      const apiError = payload && typeof payload === 'object' ? payload.error : null;
      throw new ApiError(apiError?.message ?? `HTTP ${response.status}`, {
        status: response.status,
        code: apiError?.code ?? null,
        details: apiError?.details ?? null,
      });
    }
    return payload;
  }

  return Object.freeze({
    getState: (options = {}) => request('/state', options),
    putState: ({ state, expectedRevision, force = false }, options = {}) =>
      request('/state', {
        ...options,
        method: 'PUT',
        body: { state, expectedRevision, ...(force ? { force: true } : {}) },
      }),
    demoLogin: (role, options = {}) => request('/auth/demo', { ...options, method: 'POST', body: { role } }),
    uploadAttachment: (file, options = {}) => {
      const formData = new FormData();
      formData.append('file', file, file.name);
      return request('/attachments', { ...options, method: 'POST', formData });
    },
    downloadAttachment: (attachmentId, options = {}) =>
      request(`/attachments/${encodeURIComponent(attachmentId)}`, { ...options, responseType: 'blob' }),
    syncIntegration: (sourceId, options = {}) =>
      request(`/integrations/${encodeURIComponent(sourceId)}/sync`, { ...options, method: 'POST' }),
  });
}

export const apiClient = createApiClient();
