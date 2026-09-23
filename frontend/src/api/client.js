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

  async function request(path, { method = 'GET', body, formData, responseType = 'json', signal, requestTimeoutMs = timeoutMs } = {}) {
    if (!fetchImpl) throw new ApiError('Fetch API недоступен', { status: 0, code: 'network_error' });

    const accessToken = getAccessToken?.();
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const requestSignal = createRequestSignal(signal, requestTimeoutMs);
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

    const binaryResponse = response.ok && (responseType === 'blob' || responseType === 'download');
    const payload = binaryResponse ? await response.blob() : await readPayload(response);
    if (!response.ok) {
      const apiError = payload && typeof payload === 'object' ? payload.error : null;
      throw new ApiError(apiError?.message ?? `HTTP ${response.status}`, {
        status: response.status,
        code: apiError?.code ?? null,
        details: apiError?.details ?? null,
      });
    }
    if (responseType === 'blob') return payload;
    if (responseType === 'download') {
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      return { blob: payload, filename: encodedName ? decodeURIComponent(encodedName) : 'download.bin' };
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
    createImport: (file, options = {}) => {
      const formData = new FormData();
      formData.append('file', file);
      return request('/imports', { requestTimeoutMs: 60_000, ...options, method: 'POST', formData });
    },
    getImport: (jobId, options = {}) => request(`/imports/${jobId}`, options),
    previewImport: (jobId, mapping, options = {}) => request(`/imports/${jobId}/preview`, { ...options, method: 'POST', body: { mapping } }),
    applyImport: (jobId, mapping, options = {}) => request(`/imports/${jobId}/apply`, { ...options, method: 'POST', body: { mapping } }),
    createReport: (payload, options = {}) => request('/report-jobs', { requestTimeoutMs: 60_000, ...options, method: 'POST', body: payload }),
    getReport: (jobId, options = {}) => request(`/report-jobs/${jobId}`, options),
    downloadReport: (jobId, options = {}) => request(`/report-jobs/${jobId}/download`, { requestTimeoutMs: 60_000, ...options, responseType: 'download' }),
  });
}

/** Poll a short-lived background job without keeping a request open. */
export async function waitForJob(fetchJob, initialJob, { ready = ['completed'], timeoutMs = 120_000, intervalMs = 700 } = {}) {
  const startedAt = Date.now();
  let job = initialJob;
  while (!ready.includes(job.status)) {
    if (job.status === 'failed') throw new ApiError(job.error || 'Фоновое задание завершилось ошибкой', { status: 500, code: 'job_failed' });
    if (Date.now() - startedAt >= timeoutMs) throw new ApiError('Фоновое задание выполняется слишком долго', { status: 408, code: 'job_timeout' });
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    job = await fetchJob(job.id);
  }
  return job;
}

export const apiClient = createApiClient();
