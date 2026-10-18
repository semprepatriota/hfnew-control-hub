export const isAnimatedLogo = (logo) => logo?.animated === true;

export function normalizeLogoLayout(config) {
  return (config.logo_layout_version || 0) < 1
    ? { ...config, logo_x: .12, logo_y: .9, logo_round: true, logo_layout_version: 1 }
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
