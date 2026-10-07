import { apiFetch, apiUrl } from '../../../config/api';

async function jsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Não foi possível concluir a operação.');
  return data;
}

export async function createNewTodayRender(file, values) {
  const body = new FormData();
  body.append('media', file);
  body.append('settings', JSON.stringify(values));
  return jsonResponse(await apiFetch(apiUrl('/api/new-today/renders'), { method: 'POST', body, timeoutMs: 0 }));
}

export async function analyzeNewTodayMaterial(values) {
  return jsonResponse(await apiFetch(apiUrl('/api/new-today/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
    timeoutMs: 60000,
  }));
}

export async function readNewTodayRender(id) {
  return jsonResponse(await apiFetch(apiUrl(`/api/new-today/renders/${encodeURIComponent(id)}`)));
}

export async function loadNewTodayRender(id) {
  const response = await apiFetch(apiUrl(`/api/new-today/renders/${encodeURIComponent(id)}/file`), { timeoutMs: 0 });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || 'O MP4 não está disponível.');
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error('O servidor retornou um arquivo vazio.');
  return URL.createObjectURL(blob);
}

export function downloadNewTodayRender(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'new-atlas.mp4';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
