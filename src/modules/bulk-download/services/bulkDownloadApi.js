import { apiUrl } from '../../../config/api';

const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_TOKEN_KEY) : '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let payload;
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => ({ detail: 'A API retornou uma resposta JSON invalida.' }));
  } else {
    payload = { detail: await response.text() };
  }

  if (!response.ok) {
    const detail = payload?.detail;
    if (response.status === 401) throw new Error('Sua sessao expirou. Entre novamente no HUB.');
    if (typeof detail === 'string') throw new Error(detail);
    if (detail?.message) throw new Error(detail.message);
    throw new Error('A operacao nao foi concluida.');
  }
  return payload;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(apiUrl(path), {
      cache: 'no-store',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...getAuthHeaders(),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error('Nao foi possivel conectar ao servico Baixar em Massa.');
  }
  return parseResponse(response);
}

export const bulkDownloadApi = {
  health: () => request('/api/bulk-download/health'),
  inspect: (urls) => request('/api/bulk-download/inspect', {
    method: 'POST',
    body: JSON.stringify({ urls })
  }),
  inspectProfile: (platform, username, limit, sortBy, period, dateFrom, dateTo, signal) => request('/api/bulk-download/profile', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      platform,
      username,
      limit,
      sort_by: sortBy,
      period,
      date_from: dateFrom,
      date_to: dateTo
    })
  }),
  createJobs: (items, outputFormat, quality) => request('/api/bulk-download/jobs', {
    method: 'POST',
    body: JSON.stringify({ items, output_format: outputFormat, quality })
  }),
  createCarouselJob: (posts, requestId) => request('/api/bulk-download/carousels/jobs', {
    method: 'POST',
    body: JSON.stringify({ posts, request_id: requestId })
  }),
  jobs: () => request('/api/bulk-download/jobs'),
  retry: (jobId) => request(`/api/bulk-download/jobs/${encodeURIComponent(jobId)}/retry`, { method: 'POST' }),
  remove: (jobId) => request(`/api/bulk-download/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }),
  removeMany: (jobIds) => request('/api/bulk-download/jobs/delete-batch', {
    method: 'POST',
    body: JSON.stringify({ job_ids: jobIds })
  }),
  extensionInbox: () => request('/api/bulk-download/extension/inbox'),
  clearExtensionInbox: () => request('/api/bulk-download/extension/inbox', { method: 'DELETE' })
};

function filenameFromHeaders(response, fallback) {
  const disposition = response.headers.get('content-disposition') || '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const value = utfMatch?.[1] || plainMatch?.[1] || fallback;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function saveBulkDownloadFile(job) {
  const suggestedName = job.filename || `hf-download-${job.id}.mp4`;
  let fileHandle = null;

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      fileHandle = await window.showSaveFilePicker({ suggestedName, startIn: 'downloads' });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      // Some managed browsers expose the API but reject it outside a trusted gesture.
      // Falling back to the regular browser download keeps the completed file accessible.
      fileHandle = null;
    }
  }

  let response;
  try {
    response = await fetch(apiUrl(`/api/bulk-download/jobs/${encodeURIComponent(job.id)}/file`), {
      cache: 'no-store',
      headers: getAuthHeaders()
    });
  } catch {
    throw new Error('A conexao caiu antes de iniciar o salvamento do arquivo.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Sua sessao expirou. Entre novamente no HUB.');
    throw new Error(payload.detail || 'Nao foi possivel baixar o arquivo.');
  }

  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    try {
      let written = 0;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.byteLength) continue;
          written += value.byteLength;
          await writable.write(value);
        }
      } else {
        const blob = await response.blob();
        if (!blob.size) throw new Error('O servidor retornou um arquivo vazio.');
        written = blob.size;
        await writable.write(blob);
      }
      if (!written) throw new Error('O servidor retornou um arquivo vazio.');
      await writable.close();
      return { filename: suggestedName, size: written, picker: true };
    } catch (error) {
      await writable.abort?.().catch(() => null);
      throw error;
    }
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error('O servidor retornou um arquivo vazio.');
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  const filename = filenameFromHeaders(response, suggestedName);
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
  return { filename, size: blob.size, picker: false };
}
