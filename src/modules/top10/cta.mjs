export const CTA_VERSION = 2;
// TOP 10 placement; preserve the timing and one appearance per video.
export function ctaTiming(totalFrames, fps = 30) {
  if (!Number.isInteger(totalFrames) || totalFrames < 1 || !Number.isFinite(fps) || fps <= 0) throw new Error('Duração inválida');
  const seconds = totalFrames / fps;
  const length = Math.min(totalFrames, Math.max(1, Math.round(Math.min(3, Math.max(.2, seconds-.1))*fps)));
  const latest = Math.max(0, totalFrames-length-Math.round(.1*fps));
  const start = Math.min(Math.round(Math.max(2.5, Math.min(8, seconds*.22))*fps), latest);
  return { start, length, end: start+length, fade: Math.max(1, Math.min(Math.round(.24*fps), Math.floor(length/4))) };
}
export function ctaStyle(frame, totalFrames, fps = 30) {
  const timing = ctaTiming(totalFrames, fps);
  const local = frame-timing.start;
  const visible = local >= 0 && local < timing.length;
  const opacity = visible ? Math.max(0, Math.min(1, local/timing.fade, (timing.length-1-local)/timing.fade)) : 0;
  const riseFrames = Math.min(Math.round(.3*fps), Math.max(1, Math.round(timing.length/3)));
  const rise = 2*Math.floor(Math.max(0, (riseFrames-local)/fps*48)/2);
  return { visible, opacity, button: { left: 314, top: 1330+rise, width: 360, height: 90 },
    like: { left: 690, top: 1334, width: 76, height: 86 } };
}
