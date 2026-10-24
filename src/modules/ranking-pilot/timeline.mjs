export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const MODELS = ['classic', 'interludes'];
export const MAX_FRAMES = FPS * 180;
const bounded = (value, low, high, fallback) => Number.isFinite(Number(value))
  ? Math.min(high, Math.max(low, Number(value))) : fallback;

export function clipFrames(clip, assets) {
  const asset = assets[clip?.assetId];
  if (!asset) throw new Error('Mídia não encontrada.');
  const start = Number(clip.startFrame);
  const end = Number(clip.endFrame);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > asset.frames) {
    throw new Error('O início e o fim precisam estar dentro da duração do vídeo.');
  }
  return end - start;
}

export function buildTimeline(project, assets) {
  if (!MODELS.includes(project?.model)) throw new Error('Modelo inválido.');
  if (!Array.isArray(project.items) || project.items.length > 10) throw new Error('Limite de dez posições no piloto.');
  const items = project.items.filter(item => Array.isArray(item.clips) && item.clips.length);
  const segments = [];
  const reveals = [];
  let from = 0;
  const append = (kind, clip, itemId = null, rank = null) => {
    const frames = clipFrames(clip, assets);
    segments.push({ id: `${kind}-${segments.length}`, kind, clip, from, frames, itemId, rank });
    from += frames;
  };
  for (const [index, item] of items.entries()) {
    if (item.clips.length > 12) throw new Error('Limite de doze subtrechos por posição.');
    const rank = items.length - index;
    reveals.push({ itemId: item.id, rank, from, label: String(item.label ?? '').slice(0, 80) });
    for (const clip of item.clips) append('scene', clip, item.id, rank);
    if (project.model === 'interludes' && item.interlude && index < items.length - 1) {
      append('interlude', item.interlude, item.id, rank);
    }
  }
  if (items.length && project.outro) append('outro', project.outro);
  if (from > MAX_FRAMES) throw new Error('O piloto aceita montagens de até três minutos.');
  return { segments, reveals, durationInFrames: from || 1, count: items.length };
}

export function normalizeProject(project, assets) {
  const copy = JSON.parse(JSON.stringify(project));
  copy.titleLines = (copy.titleLines ?? []).slice(0, 2).map(line => String(line).slice(0, 100));
  while (copy.titleLines.length < 2) copy.titleLines.push('');
  copy.highlights = (copy.highlights ?? ['', '']).slice(0, 2).map(text => String(text).slice(0, 60));
  copy.titleSize = bounded(copy.titleSize, 32, 90, 64);
  copy.labelSize = bounded(copy.labelSize, 24, 64, 38);
  copy.accent = /^#[0-9a-f]{6}$/i.test(copy.accent) ? copy.accent : '#A27BFF';
  const seen = new Set();
  for (const item of copy.items ?? []) {
    if (!item.id || seen.has(item.id)) throw new Error('Identificação de cena duplicada.');
    seen.add(item.id);
    item.label = String(item.label ?? '').slice(0, 80);
    for (const clip of [...(item.clips ?? []), ...(item.interlude ? [item.interlude] : [])]) normalizeClip(clip, assets);
  }
  if (copy.outro) normalizeClip(copy.outro, assets);
  if (copy.music) normalizeClip(copy.music, assets);
  buildTimeline(copy, assets);
  return copy;
}

function normalizeClip(clip, assets) {
  clipFrames(clip, assets);
  clip.volume = bounded(clip.volume, 0, 1, 1);
  clip.x = bounded(clip.x, 0, 1, .5);
  clip.y = bounded(clip.y, 0, 1, .5);
  clip.zoom = bounded(clip.zoom, 1, 2, 1);
  clip.fit = clip.fit === 'contain' ? 'contain' : 'cover';
}

export function moveItem(items, sourceId, targetId) {
  if (sourceId === targetId) return items;
  const source = items.findIndex(item => item.id === sourceId);
  const target = items.findIndex(item => item.id === targetId);
  if (source < 0 || target < 0) return items;
  const next = [...items];
  const [item] = next.splice(source, 1);
  next.splice(target, 0, item);
  return next;
}

export function labelVisible(timeline, rank, frame) {
  const row = timeline.reveals.find(reveal => reveal.rank === rank);
  return !!row && frame >= row.from;
}

export function safeFontSize(text, preferred, maxWidth) {
  return Math.max(12, Math.min(preferred, maxWidth / Math.max(1, [...String(text)].length * .64)));
}

export function previewSeekTime(time, duration, paused, fps = FPS) {
  return paused && Math.abs(time * fps - Math.round(time * fps)) < .0001 && time + .0001 < duration
    ? time + .0001 : time;
}
