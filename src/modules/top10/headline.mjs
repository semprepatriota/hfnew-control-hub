export const emptyHeadline = () => ({ enabled: false, text: '', original_text: '', translation: '', hook_cta: '', x: .05, y: .08, width: .9, height: .18, font_size: 64, color: '#ffffff', background: '#101018', opacity: 1, cover_original: true });
export function headlineImage(project, slot, scene) {
  const headline = { ...emptyHeadline(), ...scene?.headline };
  const image = project?.scene_headlines?.[String(slot)];
  return headline.enabled && headline.text.trim() && image && Object.entries(image.settings).every(([key, value]) => headline[key] === value) ? image : null;
}
export function headlineStyle(headline, native = false) {
  const h = { ...emptyHeadline(), ...headline };
  const x = Math.min(h.x, 1-h.width), y = Math.min(h.y, 1-h.height);
  return { position: 'absolute', pointerEvents: 'none', left: native ? Math.round(x*1080) : `${x*100}%`, top: native ? Math.round(y*1920) : `${y*100}%`, width: native ? Math.round(h.width*1080) : `${h.width*100}%`, height: native ? Math.round(h.height*1920) : `${h.height*100}%` };
}
