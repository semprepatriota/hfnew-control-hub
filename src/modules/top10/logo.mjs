export const isAnimatedLogo = (logo) => logo?.animated === true;

export function logoStyle(logo, config) {
  const width = Math.round(1080 * config.logo_size);
  const height = Math.round(width * logo.height / logo.width);
  return {
    position: 'absolute', width, height,
    left: Math.min(Math.max(0, Math.round(config.logo_x * 1080 - width / 2)), Math.max(0, 1080 - width)),
    top: Math.min(Math.max(0, Math.round(config.logo_y * 1920 - height / 2)), Math.max(0, 1920 - height)),
    opacity: config.logo_opacity,
  };
}
