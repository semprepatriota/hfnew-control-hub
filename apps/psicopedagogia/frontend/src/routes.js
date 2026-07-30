export const APP_ROUTES = {
  dashboard: '/',
  patients: '/adolescentes',
  instruments: '/instrumentos',
  applications: '/aplicacoes',
  integration: '/integracao',
  reports: '/ram',
  profile: '/perfil',
};

export const PUBLIC_ROUTES = {
  privacy: '/privacidade',
  terms: '/termos',
};

export const getViewFromPath = (pathname) => (
  Object.entries(APP_ROUTES).find(([, route]) => route === pathname)?.[0] || 'dashboard'
);
