import { apiUrl } from '../../../config/api';

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { detail: await response.text() };

  if (!response.ok) {
    const detail = payload?.detail;
    if (typeof detail === 'string') throw new Error(detail);
    if (detail?.message) throw new Error(detail.message);
    throw new Error('A operacao nao foi concluida.');
  }
  return payload;
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  return parseResponse(response);
}

export const bulkDownloadApi = {
  health: () => request('/api/bulk-download/health'),
  inspect: (urls) => request('/api/bulk-download/inspect', {
    method: 'POST',
    body: JSON.stringify({ urls })
  }),
  createJobs: (items, outputFormat, quality) => request('/api/bulk-download/jobs', {
    method: 'POST',
    body: JSON.stringify({ items, output_format: outputFormat, quality })
  }),
  jobs: () => request('/api/bulk-download/jobs'),
  retry: (jobId) => request(`/api/bulk-download/jobs/${encodeURIComponent(jobId)}/retry`, { method: 'POST' }),
  remove: (jobId) => request(`/api/bulk-download/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }),
  pairExtension: () => request('/api/bulk-download/extension/pair', { method: 'POST' }),
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
    fileHandle = await window.showSaveFilePicker({ suggestedName });
  }

  const response = await fetch(apiUrl(`/api/bulk-download/jobs/${encodeURIComponent(job.id)}/file`), {
    cache: 'no-store'
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Nao foi possivel baixar o arquivo.');
  }

  const blob = await response.blob();
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filenameFromHeaders(response, suggestedName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
}
