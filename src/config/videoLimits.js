export const VIDEO_EDIT_MAX_DURATION_SECONDS = 360;
export const VIDEO_EDIT_MAX_DURATION_LABEL = '6:00';

export function isVideoDurationWithinEditLimit(duration) {
  return Number(duration || 0) <= VIDEO_EDIT_MAX_DURATION_SECONDS;
}

export function formatVideoDurationLabel(duration) {
  const totalSeconds = Math.max(0, Math.round(Number(duration || 0)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function buildVideoDurationLimitMessage(scopeLabel = 'Esta edição') {
  return `${scopeLabel} aceita vídeos de até ${VIDEO_EDIT_MAX_DURATION_LABEL}.`;
}
