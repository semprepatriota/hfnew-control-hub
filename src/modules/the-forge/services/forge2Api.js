import { apiUrl } from '../../../config/api';

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof payload === 'object' ? payload.detail : payload;
    throw new Error(detail || 'Falha na operação do The Forge 2.0');
  }

  return payload;
}

function limitText(value, maxLength) {
  return String(value || '').slice(0, maxLength);
}

function sanitizeStudioForApi(studio) {
  if (!studio) return studio;
  return {
    ...studio,
    text_overlay: {
      ...(studio.text_overlay || {}),
      title: limitText(studio.text_overlay?.title, 240),
      topic: limitText(studio.text_overlay?.topic, 600),
    },
    production_items: (studio.production_items || []).map((item) => ({
      ...item,
      title: limitText(item.title, 180),
      topic: limitText(item.topic || item.title, 600),
    })),
  };
}

export async function getForge2Health() {
  return parseResponse(await fetch(apiUrl('/api/forge2/health'), { cache: 'no-store' }));
}

export async function getLMStudioStatus() {
  return parseResponse(await fetch(apiUrl('/api/forge2/lm-studio/status'), { cache: 'no-store' }));
}

export async function listForge2Projects() {
  return parseResponse(await fetch(apiUrl('/api/forge2/projects'), { cache: 'no-store' }));
}

export async function createForge2Project(payload) {
  return parseResponse(await fetch(apiUrl('/api/forge2/projects'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function getForge2Project(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}`), { cache: 'no-store' }));
}

export async function deleteForge2Project(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}`), {
    method: 'DELETE',
  }));
}

export async function getForge2StudioConfig(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/studio-config`), { cache: 'no-store' }));
}

export async function saveForge2StudioConfig(projectId, studio) {
  const safeStudio = sanitizeStudioForApi(studio);
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/studio-config`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studio: safeStudio }),
  }));
}

export async function getForge2CopyAgentConfig(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/copy-agent-config`), { cache: 'no-store' }));
}

export async function saveForge2CopyAgentConfig(projectId, payload) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/copy-agent-config`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function uploadForge2Source(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/upload-source`), {
    method: 'POST',
    body: formData,
  }));
}

export async function extractForge2Audio(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/extract-audio`), {
    method: 'POST',
  }));
}

export async function transcribeForge2Project(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/transcribe`), {
    method: 'POST',
  }));
}

export async function saveForge2Transcript(projectId, text) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/transcript`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }));
}

export async function analyzeForge2Project(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/analyze`), {
    method: 'POST',
  }));
}

export async function setForge2PlanItemApproval(projectId, section, itemId, approved, note = '') {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/plan/${encodeURIComponent(section)}/${encodeURIComponent(itemId)}/approval`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved, note }),
  }));
}

export async function generateForge2Srt(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/captions/srt`), {
    method: 'POST',
  }));
}

export async function generateForge2Preview(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/preview`), {
    method: 'POST',
  }));
}

export async function uploadForge2BaseVideo(projectId, file, aspectRatio) {
  const formData = new FormData();
  formData.append('file', file);
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/assets/base-video?aspect_ratio=${encodeURIComponent(aspectRatio)}`), {
    method: 'POST',
    body: formData,
  }));
}

export async function uploadForge2Gif(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/assets/gif`), {
    method: 'POST',
    body: formData,
  }));
}

export async function uploadForge2Music(projectId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/assets/music`), {
    method: 'POST',
    body: formData,
  }));
}

export async function removeForge2Asset(projectId, assetKind, assetId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetKind)}/${encodeURIComponent(assetId)}`), {
    method: 'DELETE',
  }));
}

export async function generateForge2Copy(projectId, payload) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/generate-copy`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function generateForge2Publication(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/generate-publication`), {
    method: 'POST',
  }));
}

export async function renderForge2Studio(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/render`), {
    method: 'POST',
  }));
}

export async function getForge2RenderStatus(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/render-status`), {
    cache: 'no-store',
  }));
}

export async function scheduleForge2Render(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/schedule`), {
    method: 'POST',
  }));
}

export async function publishForge2ToYouTube(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/publish-youtube`), {
    method: 'POST',
  }));
}

export function forge2FileUrl(path) {
  return apiUrl(path);
}
