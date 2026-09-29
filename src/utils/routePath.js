export function normalizeRoutePath(pathname) {
  const path = String(pathname || '/');
  return path === '/' ? path : path.replace(/\/+$/, '') || '/';
}
