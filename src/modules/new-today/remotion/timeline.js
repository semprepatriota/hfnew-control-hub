export const NEW_TODAY_FPS = 30;
export const NEW_TODAY_MAX_MEDIA_FRAMES = 180 * NEW_TODAY_FPS;
export const NEW_TODAY_INTRO_FRAMES = 21;
export const NEW_TODAY_IMAGE_FRAMES = 213;
export const NEW_ATLAS_TEMPLATES = ['classic', 'bulletin', 'brief'];

export function durationForMedia(type, seconds) {
  if (type !== 'video') return NEW_TODAY_IMAGE_FRAMES;
  const contentFrames = Math.max(1, Math.round(Number(seconds || 0) * NEW_TODAY_FPS));
  return Math.min(NEW_TODAY_MAX_MEDIA_FRAMES, contentFrames) + NEW_TODAY_INTRO_FRAMES;
}

export function contentFramesFor(durationInFrames) {
  return Math.max(1, durationInFrames - NEW_TODAY_INTRO_FRAMES);
}
