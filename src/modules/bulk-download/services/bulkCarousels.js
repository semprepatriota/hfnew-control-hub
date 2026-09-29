export const CAROUSEL_EXTENSION_VERSION = '1.4.1';

export function supportsCarousels(version) {
  const [major, minor] = String(version || '').split('.').map(Number);
  return major > 1 || (major === 1 && minor >= 4);
}

export function normalizeCarouselUrl(value) {
  try {
    const url = new URL(value.trim());
    const match = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?p\/([A-Za-z0-9_-]{1,30})\/?$/);
    if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname)
      || url.username || url.password || url.port || !match) return '';
    return `https://www.instagram.com/p/${match[1]}/`;
  } catch { return ''; }
}

export function carouselItemKey(post, child) {
  return `${normalizeCarouselUrl(post.url)}#${child.position}`;
}

export function validateCarousel(post) {
  if (!normalizeCarouselUrl(post?.url) || post.scan_complete !== true
    || !Number.isInteger(post.total_items) || post.total_items < 2 || post.total_items > 50
    || !Array.isArray(post.children) || post.children.length !== post.total_items) return false;
  const positions = post.children.map((item) => item.position).sort((a, b) => a - b);
  return positions.every((position, index) => position === index + 1)
    && post.children.every((item) => ['image', 'video'].includes(item.media_type));
}

export function carouselSelection(posts, selected) {
  return posts.filter((post) => post.children.some((child) => selected.has(carouselItemKey(post, child))))
    .map((post) => ({
      url: normalizeCarouselUrl(post.url), title: post.title, total_items: post.total_items,
      scan_complete: post.scan_complete,
      children: [...post.children].sort((a, b) => a.position - b.position).map((child) => ({
        position: child.position, media_type: child.media_type, media_url: child.media_url || '',
        thumbnail: child.thumbnail || '', selected: selected.has(carouselItemKey(post, child)),
      })),
    }));
}
