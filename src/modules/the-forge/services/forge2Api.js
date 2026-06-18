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

export async function getForge2StudioConfig(projectId) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/studio-config`), { cache: 'no-store' }));
}

export async function saveForge2StudioConfig(projectId, studio) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/studio-config`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studio }),
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

export async function generateForge2Copy(projectId, payload) {
  return parseResponse(await fetch(apiUrl(`/api/forge2/projects/${encodeURIComponent(projectId)}/generate-copy`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export function forge2FileUrl(path) {
  return apiUrl(path);
}
