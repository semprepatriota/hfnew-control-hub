export const emptyHeadline = () => ({ enabled: false, text: '', original_text: '', translation: '', hook_cta: '', x: 0, y: .08, width: 1, height: .13, font_size: 64, color: '#000000', background: '#ffffff', opacity: 1, cover_original: true });
export const HEADLINE_LAYOUT_VERSION = 2;
export const needsHeadlineRefresh = (project, config) => config.scenes.some((scene, slot) =>
  project.assets[scene.asset_id] && scene.headline?.enabled && scene.headline.text?.trim()
  && project.scene_headlines?.[String(slot)]?.layout_version !== HEADLINE_LAYOUT_VERSION);
export function fixedHeadline(value, captionBox = null) {
  const h = { ...emptyHeadline(), ...value };
  const height = captionBox ? Math.min(.3, Math.max(.13, captionBox.height + .06)) : Math.min(.3, Math.max(.13, h.height));
  const y = Math.min(1-height, Math.max(0, captionBox ? captionBox.y - .025 : h.y));
  return { ...h, x:0, y, width:1, height, font_size:64, color:'#000000', background:'#ffffff', opacity:1, cover_original:true };
}
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
