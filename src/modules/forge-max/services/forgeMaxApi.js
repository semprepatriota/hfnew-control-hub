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

export async function listForgeMaxTimeTemplates() {
  return parseResponse(await fetch(apiUrl('/api/forge-max/time-templates'), { cache: 'no-store' }));
}

export async function uploadForgeMaxTimeTemplate(title, file) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('file', file);
  return parseResponse(await fetch(apiUrl('/api/forge-max/time-templates'), {
    method: 'POST',
    body: formData,
  }));
}

export async function deleteForgeMaxTimeTemplate(templateId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/time-templates/${encodeURIComponent(templateId)}`), {
    method: 'DELETE',
  }));
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

export async function applyForgeMaxTimeTemplate(projectId, templateId, sceneAssetIds) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/timeline/apply-time-template`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: templateId, scene_asset_ids: sceneAssetIds }),
  }));
}

export async function splitForgeMaxTimelineScenes(projectId, clipId, threshold = 0.35) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/timeline/split-scenes`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clip_id: clipId, threshold }),
  }));
}

export async function detectForgeMaxTimelineScenes(projectId, clipId, threshold = 0.25) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/timeline/detect-scenes`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clip_id: clipId, threshold }),
  }));
}

export async function updateForgeMaxMusic(projectId, payload) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/music`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function uploadForgeMaxLogo(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/logo`), {
    method: 'POST',
    body: formData,
  }));
}

export async function updateForgeMaxLogo(projectId, payload) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/logo`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function deleteForgeMaxLogo(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/logo`), {
    method: 'DELETE',
  }));
}

export async function renderForgeMaxTimeline(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/render`), {
    method: 'POST',
  }));
}

export async function deleteForgeMaxRender(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/projects/${encodeURIComponent(projectId)}/render`), {
    method: 'DELETE',
  }));
}

export function forgeMaxFileUrl(path) {
  return apiUrl(path);
}
