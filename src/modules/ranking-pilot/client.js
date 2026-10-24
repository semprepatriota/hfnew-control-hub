import { apiFetch, apiUrl } from '../../config/api';

export function createRankingClient(production = false) {
  const url = path => production ? apiUrl(`/api/ranking${path}`) : `/api/pilot${path}`;
  const request = async (path, options = {}) => {
    const response = production
      ? await apiFetch(url(path), { ...options, timeoutMs: options.body instanceof Blob ? 1800000 : 30000 })
      : await fetch(url(path), options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? data.detail ?? 'Falha na operação do ranking.');
    return data;
  };
  return {
    request,
    media: value => production && value ? apiUrl(value) : value,
    download: value => production ? apiFetch(value, { timeoutMs: 0, retries: 0 }) : fetch(value),
  };
}
