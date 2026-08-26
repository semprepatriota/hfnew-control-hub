import { apiUrl } from '../../../config/api';

const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';

function authHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_TOKEN_KEY) : '';
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Falha no HF Research Studio');
  }
  return payload;
}

async function request(path, options = {}) {
  const headers = authHeaders(options.headers || {});
  return parseResponse(await fetch(apiUrl(path), { cache: 'no-store', ...options, headers }));
}

export const researchStudioApi = {
  health: () => request('/api/research-studio/health'),
  listProjects: () => request('/api/research-studio/projects'),
  getProject: (projectId) => request(`/api/research-studio/projects/${encodeURIComponent(projectId)}`),
  createProject: (payload) => request('/api/research-studio/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  deleteProject: (projectId) => request(`/api/research-studio/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  }),
  generatePlan: (projectId, useAi) => request(`/api/research-studio/projects/${encodeURIComponent(projectId)}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ use_ai: Boolean(useAi) }),
  }),
  search: (projectId, payload) => request(`/api/research-studio/projects/${encodeURIComponent(projectId)}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  addManualAsset: (projectId, payload) => request(`/api/research-studio/projects/${encodeURIComponent(projectId)}/assets/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  updateAsset: (projectId, assetId, payload) => request(`/api/research-studio/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  deleteAsset: (projectId, assetId) => request(`/api/research-studio/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
  }),
  updateEditor: (projectId, payload) => request(`/api/research-studio/projects/${encodeURIComponent(projectId)}/editor`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  createRemotionJob: (projectId) => request(`/api/research-studio/projects/${encodeURIComponent(projectId)}/remotion/jobs`, {
    method: 'POST',
  }),
  downloadRemotionJob: async (projectId, jobId) => {
    const response = await fetch(apiUrl(`/api/research-studio/projects/${encodeURIComponent(projectId)}/remotion/jobs/${encodeURIComponent(jobId)}/download`), {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.detail || 'Falha ao baixar pacote Remotion');
    }
    return response.blob();
  },
};
