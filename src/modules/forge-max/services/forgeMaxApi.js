import { apiFetch, apiUrl } from '../../../config/api.js';

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

export function forgeMaxClipsArchiveUrl(video, clipIds = []) {
  if (!video?.id || !video?.media_key) return '';
  const query = new URLSearchParams({ key: video.media_key });
  for (const id of [...new Set(clipIds)]) query.append('clip_ids', id);
  return apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(video.id)}/clips/download-all?${query}`);
}

export function downloadForgeMaxClipsArchive(video, clipIds = null, signal) {
  if (!video?.id || !video?.media_key) throw new Error('Vídeo sem chave de download.');
  const options = { cache: 'no-store', retries: 0, timeoutMs: 120000, signal };
  if (clipIds === null) return apiFetch(forgeMaxClipsArchiveUrl(video), options);
  const ids = [...new Set(clipIds)];
  if (!ids.length) throw new Error('Selecione pelo menos um trecho pronto.');
  return apiFetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(video.id)}/clips/download-selected`), {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: video.media_key, clip_ids: ids }),
  });
}

export function pruneForgeMaxClipSelection(ids, clips, previousVideoId, videoId) {
  if (previousVideoId !== videoId) return [];
  const available = new Set(clips.filter((clip) => clip.status !== 'extracting').map((clip) => clip.id));
  return [...new Set(ids)].filter((id) => available.has(id));
}

export async function getForgeMaxHealth() {
  return parseResponse(await apiFetch(apiUrl('/api/forge-max/extractor/health'), { cache: 'no-store' }));
}

export async function listForgeMaxVideos() {
  return parseResponse(await apiFetch(apiUrl('/api/forge-max/extractor/videos'), { cache: 'no-store' }));
}

export async function getForgeMaxVideo(videoId) {
  return parseResponse(await apiFetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}`), {
    cache: 'no-store',
  }));
}

export async function uploadForgeMaxVideo(file, handlers = {}) {
  const tus = await import('tus-js-client');
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('alliance_dark_auth_token') : '';
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: apiUrl('/api/forge/resumable/files'),
      chunkSize: 8 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      removeFingerprintOnSuccess: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      metadata: {
        filename: file.name,
        filetype: file.type || 'video/mp4',
        target: 'forge_max_extractor',
      },
      onError: reject,
      onProgress: (bytesUploaded, bytesTotal) => {
        handlers.onProgress?.(bytesUploaded, bytesTotal);
      },
      onSuccess: async () => {
        try {
          const response = await apiFetch(apiUrl('/api/forge/resumable/finalize'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ upload_url: upload.url, target: 'forge_max_extractor' }),
            timeoutMs: 120000,
          });
          resolve(await parseResponse(response));
        } catch (error) {
          reject(error);
        }
      },
    });
    handlers.onUploadReady?.(upload);
    upload.findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      })
      .catch(reject);
  });
}

export async function deleteForgeMaxVideo(videoId) {
  return parseResponse(await apiFetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}`), {
    method: 'DELETE',
  }));
}

export async function analyzeForgeMaxScenes(videoId, threshold) {
  return parseResponse(await apiFetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}/analyze`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threshold }),
    timeoutMs: 60 * 60 * 1000,
  }));
}

export async function extractForgeMaxClip(videoId, payload) {
  return parseResponse(await apiFetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}/clips`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: 30 * 60 * 1000,
  }));
}

export async function deleteForgeMaxClip(videoId, clipId) {
  return parseResponse(await apiFetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}/clips/${encodeURIComponent(clipId)}`), {
    method: 'DELETE',
  }));
}

export async function deleteForgeMaxClips(videoId, clips, onProgress) {
  const deletedIds = [];
  const failures = [];
  const seen = new Set();
  for (const clip of clips) {
    if (seen.has(clip.id)) continue;
    seen.add(clip.id);
    try {
      if (clip.status === 'extracting') throw new Error('Extração em andamento; trecho não excluído.');
      await deleteForgeMaxClip(videoId, clip.id);
      deletedIds.push(clip.id);
      onProgress?.({ deletedId: clip.id, completed: seen.size, deleted: deletedIds.length, failed: failures.length });
    } catch (caught) {
      failures.push({ id: clip.id, title: clip.title || clip.id, error: caught.message });
      onProgress?.({ completed: seen.size, deleted: deletedIds.length, failed: failures.length });
    }
  }
  return { deletedIds, failures };
}

export async function cancelForgeMaxTask(videoId, taskType, clipId = '') {
  return parseResponse(await apiFetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}/tasks/cancel`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_type: taskType, clip_id: clipId }),
  }));
}

export async function retryForgeMaxTask(videoId, taskType, clipId = '') {
  return parseResponse(await apiFetch(apiUrl(`/api/forge-max/extractor/videos/${encodeURIComponent(videoId)}/tasks/retry`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_type: taskType, clip_id: clipId }),
  }));
}
