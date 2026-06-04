const localApiUrl = 'http://127.0.0.1:9000';
const productionApiUrl = 'https://api.hfnew.com.br';
const isLocalHost = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (isLocalHost ? localApiUrl : productionApiUrl)
).replace(/\/$/, '');

export function apiUrl(path = '') {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
