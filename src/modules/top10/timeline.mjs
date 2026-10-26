import catalog from './counter-catalog.json' with { type: 'json' };
import { emptyHeadline } from './headline.mjs';
export const FPS = 30;
export const MODELS = Object.entries(catalog.models).map(([id, model]) => ({ id, ...model }));
export const emptyScene = () => ({ asset_id: '', start: 0, end: 0, x: 0.5, y: 0.5, zoom: 1, volume: 1, headline: emptyHeadline() });
export function buildTimeline(project, config) {
  let cursor = 0;
  return Array.from({ length: 10 }, (_, slot) => {
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
    return counterFrames ? [counter, clip] : [clip];
  }).flat();
}
export function swapScenes(config, first, second) {
  if (![first, second].every((slot) => Number.isInteger(slot) && slot >= 0 && slot < 10)) return config;
  const scenes = [...config.scenes];
  [scenes[first], scenes[second]] = [scenes[second], scenes[first]];
  return { ...config, scenes };
}
export const timeLabel = (seconds) => `${Math.floor(Math.max(0, seconds) / 60)}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
