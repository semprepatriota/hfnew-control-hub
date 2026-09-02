export const PROFILE_PLATFORMS = [
  { value: 'instagram', label: 'Instagram', disabled: false },
  { value: 'tiktok', label: 'TikTok (em breve)', disabled: true },
];

// Historical downloads keep their original network labels.
export const PLATFORM_LABELS = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  kwai: 'Kwai',
};

export function isInstagramUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol)
      && (url.hostname === 'instagram.com' || url.hostname.endsWith('.instagram.com'));
  } catch {
    return false;
  }
}
