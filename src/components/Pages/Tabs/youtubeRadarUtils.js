export const VIDEO_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'long', label: 'Vídeos longos' },
  { id: 'recent', label: 'Recentes' },
  { id: 'views', label: 'Mais vistos' },
];

export const PERFORMANCE_LABELS = {
  above: 'Acima da média',
  normal: 'Na média',
  below: 'Abaixo da média',
};

export function filterRadarVideos(videos = [], filter = 'all', now = Date.now()) {
  const list = Array.isArray(videos) ? [...videos] : [];
  if (filter === 'shorts') return list.filter((video) => video.is_short);
  if (filter === 'long') return list.filter((video) => video.is_long ?? !video.is_short);
  if (filter === 'recent') {
    const cutoff = now - (30 * 24 * 60 * 60 * 1000);
    return list
      .filter((video) => new Date(video.published_at || 0).getTime() >= cutoff)
      .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
  }
  if (filter === 'views') return list.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  return list;
}

export function formatRelativeTime(value, now = Date.now()) {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Sem atualização';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 45) return 'Atualizado agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Atualizado há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Atualizado há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Atualizado há ${days} dia${days === 1 ? '' : 's'}`;
}

export function buildTrendBars(videos = [], days = 30, limit = 18, now = Date.now()) {
  const cutoff = now - (Number(days) * 24 * 60 * 60 * 1000);
  const items = (Array.isArray(videos) ? videos : [])
    .filter((video) => new Date(video.published_at || 0).getTime() >= cutoff)
    .sort((a, b) => new Date(a.published_at || 0) - new Date(b.published_at || 0))
    .slice(-limit);
  const maximum = Math.max(1, ...items.map((video) => Number(video.views || 0)));
  return items.map((video) => ({
    ...video,
    bar_percent: Math.max(5, Math.round((Number(video.views || 0) / maximum) * 100)),
  }));
}

export function buildPeriodBars(series = [], days = 30, limit = 18, now = Date.now()) {
  const cutoff = now - (Number(days) * 24 * 60 * 60 * 1000);
  const items = (Array.isArray(series) ? series : [])
    .filter((item) => new Date(`${item.date || ''}T23:59:59Z`).getTime() >= cutoff)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .slice(-limit);
  const maximum = Math.max(1, ...items.map((item) => Number(item.views || 0)));
  const average = items.length
    ? items.reduce((total, item) => total + Number(item.views || 0), 0) / items.length
    : 0;
  return items.map((item) => {
    const ratio = average ? Number(item.views || 0) / average : 1;
    return {
      ...item,
      bar_percent: Math.max(5, Math.round((Number(item.views || 0) / maximum) * 100)),
      performance_status: ratio >= 1.25 ? 'above' : ratio <= 0.75 ? 'below' : 'normal',
    };
  });
}
