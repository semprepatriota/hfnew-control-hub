const localApiUrl = 'http://127.0.0.1:9000';
const productionApiUrl = 'https://api.hfnew.com.br';
const buildEnv = import.meta.env || {};
const isLocalHost = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export const API_BASE_URL = (
  buildEnv.VITE_API_BASE_URL
  || (isLocalHost ? localApiUrl : productionApiUrl)
).replace(/\/$/, '');

export function apiUrl(path = '') {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';
const RETRYABLE_STATUS = new Set([408, 425, 429, 502, 503, 504]);

function requestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `hub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function retryDelay(attempt, response) {
  const retryAfter = Number(response?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5000);
  }
  return Math.min(350 * (2 ** attempt), 2500);
}

function sleep(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    if (!signal) return;
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/**
 * Fetch central do Hub. Repetições são limitadas a consultas idempotentes;
 * uploads, gerações e renders nunca são enviados duas vezes automaticamente.
 */
export async function apiFetch(input, options = {}) {
  const {
    timeoutMs: suppliedTimeout,
    retries: suppliedRetries,
    signal: callerSignal,
    ...requestOptions
  } = options;
  const method = String(requestOptions.method || 'GET').toUpperCase();
  const isUpload = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;
  const timeoutMs = suppliedTimeout === 0
    ? 0
    : Number(suppliedTimeout || (isUpload ? 30 * 60 * 1000 : method === 'GET' ? 15000 : 60000));
  const retries = method === 'GET' || method === 'HEAD'
    ? Math.max(0, Math.min(Number(suppliedRetries ?? 2), 3))
    : 0;
  const url = typeof input === 'string' ? input : input?.url || '';
  const headers = new Headers(requestOptions.headers || (typeof input !== 'string' ? input.headers : undefined));
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_TOKEN_KEY) : '';
  if (token && url.includes('/api/') && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (url.includes('/api/') && !headers.has('X-Request-ID')) {
    headers.set('X-Request-ID', requestId());
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) onCallerAbort();
      else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
    const timeoutId = timeoutMs > 0 ? setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs) : null;

    try {
      const response = await fetch(input, { ...requestOptions, headers, signal: controller.signal });
      if (attempt < retries && RETRYABLE_STATUS.has(response.status)) {
        await response.body?.cancel?.().catch(() => undefined);
        await sleep(retryDelay(attempt, response), callerSignal);
        continue;
      }
      return response;
    } catch (error) {
      if (callerSignal?.aborted) throw error;
      lastError = timedOut
        ? Object.assign(new Error('A API demorou além do limite desta operação.'), { code: 'API_TIMEOUT' })
        : error;
      if (attempt >= retries || timedOut) break;
      await sleep(retryDelay(attempt), callerSignal);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      callerSignal?.removeEventListener?.('abort', onCallerAbort);
    }
  }

  if (lastError?.code === 'API_TIMEOUT') throw lastError;
  throw Object.assign(
    new Error('Não foi possível conectar à API. Verifique a conexão e tente novamente.'),
    { code: 'API_UNREACHABLE', cause: lastError },
  );
}
