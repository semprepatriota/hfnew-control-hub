export const isAnimatedLogo = (logo) => logo?.animated === true;
export const FIXED_LOGO_LAYOUT = Object.freeze({
  logo_x: .12, logo_y: .66, logo_size: .14, logo_opacity: 1,
  logo_round: true, logo_layout_version: 6,
});

export function normalizeLogoLayout(config) {
  return Object.entries(FIXED_LOGO_LAYOUT).some(([key, value]) => config[key] !== value)
    ? { ...config, ...FIXED_LOGO_LAYOUT }
    : config;
}

export function logoStyle(logo, rawConfig) {
  const config = normalizeLogoLayout(rawConfig);
  const width = Math.round(1080 * config.logo_size);
  const height = config.logo_round ? width : Math.round(width * logo.height / logo.width);
  return {
    position: 'absolute', width, height,
    left: Math.min(Math.max(0, Math.round(config.logo_x * 1080 - width / 2)), Math.max(0, 1080 - width)),
    top: Math.min(Math.max(0, Math.round(config.logo_y * 1920 - height / 2)), Math.max(0, 1920 - height)),
    opacity: config.logo_opacity,
    ...(config.logo_round ? {
      borderRadius: '50%', padding: Math.round(width * .08), boxSizing: 'border-box',
      objectFit: 'contain', backgroundColor: '#000',
    } : {}),
  };
}
