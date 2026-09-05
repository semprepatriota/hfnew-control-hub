import { apiFetch, apiUrl } from '../../../config/api';

async function parse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Falha na operação do The Forge 50/50');
  return data;
}

export const listForge5050Projects = () => apiFetch(apiUrl('/api/forge5050/projects'), { cache: 'no-store' }).then(parse);

export const createForge5050Project = (title) => apiFetch(apiUrl('/api/forge5050/projects'), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
}).then(parse);

export const getForge5050Project = (id) => apiFetch(apiUrl(`/api/forge5050/projects/${encodeURIComponent(id)}`), { cache: 'no-store' }).then(parse);

export const deleteForge5050Project = (id) => apiFetch(apiUrl(`/api/forge5050/projects/${encodeURIComponent(id)}`), { method: 'DELETE' }).then(parse);

export const uploadForge5050Video = (id, slot, file) => {
  const form = new FormData();
  form.append('file', file);
  return apiFetch(apiUrl(`/api/forge5050/projects/${encodeURIComponent(id)}/upload?slot=${slot}`), { method: 'POST', body: form, timeoutMs: 30 * 60 * 1000 }).then(parse);
};

export const uploadForge5050Logo = (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return apiFetch(apiUrl(`/api/forge5050/projects/${encodeURIComponent(id)}/logo`), { method: 'POST', body: form, timeoutMs: 10 * 60 * 1000 }).then(parse);
};

export const deleteForge5050Logo = (id) => apiFetch(apiUrl(`/api/forge5050/projects/${encodeURIComponent(id)}/logo`), {
  method: 'DELETE',
}).then(parse);

export const saveForge5050Config = (id, config) => apiFetch(apiUrl(`/api/forge5050/projects/${encodeURIComponent(id)}/config`), {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
}).then(parse);

export const renderForge5050 = (id, config) => apiFetch(apiUrl(`/api/forge5050/projects/${encodeURIComponent(id)}/render`), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config), timeoutMs: 30 * 60 * 1000,
}).then(parse);

export const deleteForge5050Render = (id) => apiFetch(apiUrl(`/api/forge5050/projects/${encodeURIComponent(id)}/render`), {
  method: 'DELETE',
}).then(parse);

export const generateForge5050SocialMetadata = (platform, titleHint, descriptionHint) => apiFetch(apiUrl('/api/forge/generate-social-metadata'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platform,
    media_type: 'video',
    title_hint: titleHint,
    description_hint: descriptionHint,
  }),
}).then(parse);

export const generateForge5050Hook = (context, currentHeadline = '') => apiFetch(apiUrl('/api/forge5050/generate-hook'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ context, current_headline: currentHeadline }),
}).then(parse);

export const forge5050FileUrl = (path) => apiUrl(path);
export const forge5050DownloadUrl = (path) => {
  const [pathname, query = ''] = String(path || '').split('?', 2);
  return apiUrl(`${pathname}/download${query ? `?${query}` : ''}`);
};
