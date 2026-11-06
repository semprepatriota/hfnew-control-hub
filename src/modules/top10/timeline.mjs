import catalog from './counter-catalog.json' with { type: 'json' };
import { emptyHeadline } from './headline.mjs';
export const FPS = 30;
export const INTRO_HEADLINE_DROP_PX = 416;
export const activeSlots = (config) => config?.format === 'anime_5' ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
export const MODELS = Object.entries(catalog.models).map(([id, model]) => ({ id, ...model }));
export const emptyScene = () => ({ asset_id: '', start: 0, end: 0, x: 0.5, y: 0.5, zoom: 1, volume: 1, headline: emptyHeadline() });
export const isIntroHeadline = (config, items, item) =>
  config.counters_enabled === false && item.kind === 'scene' &&
  item.slot === items.find((part) => part.kind === 'scene')?.slot;
export const headlineFrames = (config, items, item, fps = FPS) =>
  isIntroHeadline(config, items, item)
    ? Math.min(item.frames, Math.round(0.4 * fps))
    : item.frames;
export const animeMatches = (scene, anime) => anime?.framing &&
  ['start', 'end', 'x', 'y', 'zoom'].every(key => anime.framing[key] === scene[key]);
export function buildTimeline(project, config) {
  let cursor = 0;
  return activeSlots(config).map((slot) => {
    const scene = config.scenes[slot];
    const asset = project.assets[scene.asset_id];
    if (!asset) return [];
    const model = MODELS.find(({ id }) => id === config.model);
    const counterFrames = config.counters_enabled === false ? 0 : model?.frames_by_rank?.[10 - slot] || model?.frames || 30;
    const counter = { kind: 'counter', slot, rank: 10 - slot, from: cursor, frames: counterFrames };
    cursor += counterFrames;
    const frames = Math.max(2, Math.round((Math.min(scene.end || asset.duration, asset.duration) - scene.start) * FPS));
    const clip = { kind: 'scene', slot, rank: 10 - slot, from: cursor, frames, asset, scene };
    cursor += frames;
    const anime = config.format === 'anime_5' ? project.anime?.[scene.asset_id] : null;
    const still = anime?.approved && anime?.url && animeMatches(scene, anime) ? {kind: 'anime', slot, rank: 10-slot, from: cursor, frames: 24, anime} : null;
    if (still) cursor += still.frames;
    return [...(counterFrames ? [counter] : []), clip, ...(still ? [still] : [])];
  }).flat();
}
export function swapScenes(config, first, second) {
  if (![first, second].every((slot) => Number.isInteger(slot) && slot >= 0 && slot < 10)) return config;
  const scenes = [...config.scenes];
  [scenes[first], scenes[second]] = [scenes[second], scenes[first]];
  return { ...config, scenes };
}
export const timeLabel = (seconds) => `${Math.floor(Math.max(0, seconds) / 60)}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
