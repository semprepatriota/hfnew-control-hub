export function clampTimelineValue(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

export function uploadPercent(uploadedBytes, totalBytes) {
  const total = Number(totalBytes) || 0;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((Number(uploadedBytes) || 0) / total) * 100)));
}

export function snapTimelineTime(value, duration, scenes, enabled, zoom, fps = 25) {
  const normalized = clampTimelineValue(value, 0, duration);
  const rate=Number(fps);
  const snapped=Number.isFinite(rate) && rate>0 ? Math.min(duration,Math.round(normalized*rate)/rate) : Math.round(normalized*1e6)/1e6;
  if (!enabled) return snapped;
  const boundaries = [
    0,
    duration,
    ...(Array.isArray(scenes) ? scenes : []).flatMap((scene) => [scene.start_seconds, scene.end_seconds]),
  ].map(Number).filter(Number.isFinite);
  const nearest = boundaries.slice(1).reduce((best, candidate) => (
    Math.abs(candidate - normalized) < Math.abs(best - normalized) ? candidate : best
  ), boundaries[0] ?? normalized);
  const snapTolerance = Math.min(0.75, Math.max(0.12, 8 / Math.max(1, Number(zoom) || 1)));
  return Math.abs(nearest - normalized) <= snapTolerance
    ? nearest
    : snapped;
}

export function previewRangeEnd(start, end, fps) {
  const rate=Number.isFinite(Number(fps)) && Number(fps)>0 ? Number(fps) : 30;
  const lastFrame=Math.max(0,Math.round(end*rate)-1);
  return Math.max(start,Math.min(end-1e-6,(lastFrame+.5)/rate));
}
