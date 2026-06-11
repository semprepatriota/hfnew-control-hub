import { apiUrl } from '../../../config/api';

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof payload === 'object' ? payload.detail : payload;
    throw new Error(detail || 'Falha no Forge Easy Editor');
  }

  return payload;
}

export async function getForgeEasyEditor(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/editor/projects/${encodeURIComponent(projectId)}`), {
    cache: 'no-store',
  }));
}

export async function initializeForgeEasyEditor(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/editor/projects/${encodeURIComponent(projectId)}/initialize`), {
    method: 'POST',
  }));
}

export async function saveForgeEasyTimeline(projectId, payload) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/editor/projects/${encodeURIComponent(projectId)}/timeline`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function importForgeEasyYouTube(projectId, payload) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/editor/projects/${encodeURIComponent(projectId)}/youtube-import`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function uploadForgeEasySource(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return parseResponse(await fetch(apiUrl(`/api/forge2/editor/projects/${encodeURIComponent(projectId)}/upload-source`), {
    method: 'POST',
    body: formData,
  }));
}

export async function analyzeForgeEasyProject(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/editor/projects/${encodeURIComponent(projectId)}/analyze`), {
    method: 'POST',
  }));
}
