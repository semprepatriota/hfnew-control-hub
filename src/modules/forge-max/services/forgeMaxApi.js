import { apiUrl } from '../../../config/api';

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof payload === 'object' ? payload.detail : payload || 'Falha no Forge Max 3.0');
  }
  return payload;
}

export async function getForgeMaxHealth() {
  return parseResponse(await fetch(apiUrl('/api/forge-max/health'), { cache: 'no-store' }));
}

export async function listForgeMaxProjects() {
  return parseResponse(await fetch(apiUrl('/api/forge-max/projects'), { cache: 'no-store' }));
}

export async function createForgeMaxProject(title) {
  return parseResponse(await fetch(apiUrl('/api/forge-max/projects'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  }));
}

export async function getForgeMaxProject(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}`), { cache: 'no-store' }));
}

export async function deleteForgeMaxProject(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}`), {
    method: 'DELETE',
  }));
}

export async function uploadForgeMaxVideo(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/assets/video`), {
    method: 'POST',
    body: formData,
  }));
}

export async function uploadForgeMaxMusic(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/assets/music`), {
    method: 'POST',
    body: formData,
  }));
}

export async function deleteForgeMaxVideo(projectId, assetId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`), {
    method: 'DELETE',
  }));
}

export async function deleteForgeMaxMusic(projectId, musicId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/music/${encodeURIComponent(musicId)}`), {
    method: 'DELETE',
  }));
}

export async function updateForgeMaxTimeline(projectId, clips) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/timeline`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clips }),
  }));
}

export async function updateForgeMaxMusic(projectId, payload) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/music`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function renderForgeMaxTimeline(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/render`), {
    method: 'POST',
  }));
}

export function forgeMaxFileUrl(path) {
  return apiUrl(path);
}
