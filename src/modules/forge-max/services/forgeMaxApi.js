import { apiUrl } from '../../../config/api';

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = typeof payload === 'object' ? payload?.detail : payload;
    throw new Error(typeof detail === 'string' ? detail : 'Falha no extrator Forge Max 3.0');
  }
  return payload;
}

export function forgeMaxMediaUrl(path = '') {
  return path ? apiUrl(path) : '';
}

export function forgeMaxThumbnailUrl(video, seconds) {
  if (!video?.id || !video?.media_key) return '';
  const query = new URLSearchParams({
    seconds: String(Math.max(0, Number(seconds) || 0)),
    key: video.media_key,
  });
  return apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(video.id)}/thumbnail?${query}`);
}

export async function getForgeMaxHealth() {
  return parseResponse(await fetch(apiUrl('/api/forge-max/extractor/health'), { cache: 'no-store' }));
}

export async function listForgeMaxVideos() {
  return parseResponse(await fetch(apiUrl('/api/forge-max/extractor/videos'), { cache: 'no-store' }));
}

export async function getForgeMaxVideo(videoId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}`), {
    cache: 'no-store',
  }));
}

export async function uploadForgeMaxVideo(file) {
  const formData = new FormData();
  formData.append('file', file);
  return parseResponse(await fetch(apiUrl('/api/forge-max/extractor/videos'), {
    method: 'POST',
    body: formData,
  }));
}

export async function deleteForgeMaxVideo(videoId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}`), {
    method: 'DELETE',
  }));
}

export async function analyzeForgeMaxScenes(videoId, threshold) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}/analyze`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threshold }),
  }));
}

export async function extractForgeMaxClip(videoId, payload) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}/clips`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export async function deleteForgeMaxClip(videoId, clipId) {
  return parseResponse(await fetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}/clips/${encodeURIComponent(clipId)}`), {
    method: 'DELETE',
  }));
}
