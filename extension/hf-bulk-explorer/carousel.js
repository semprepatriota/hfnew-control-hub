/* Collect only the requested post's visible slides. No cookies or account data. */
var HFCarousel = (() => {
  const MAX_ITEMS = 50;
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const label = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  function postUrl(value) {
    try {
      const url = new URL(value);
      const match = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?p\/([A-Za-z0-9_-]{1,30})\/?$/);
      if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname)
        || url.username || url.password || url.port || !match) return '';
      return `https://www.instagram.com/p/${match[1]}/`;
    } catch { return ''; }
  }

  function mediaUrl(value) {
    try {
      const url = new URL(value);
      const allowed = ['cdninstagram.com', 'fbcdn.net'];
      return url.protocol === 'https:' && !url.username && !url.password && !url.port
        && allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : '';
    } catch { return ''; }
  }

  function arrow(root, direction) {
    const labels = direction === 'next' ? ['avancar', 'proximo', 'next'] : ['voltar', 'anterior', 'previous', 'back'];
    return Array.from(root.querySelectorAll('button[aria-label], [role="button"][aria-label]'))
      .find((button) => labels.includes(label(button.getAttribute('aria-label')))
        && !button.disabled && button.getAttribute('aria-disabled') !== 'true');
  }

  function findRoot(doc) {
    const scope = doc.querySelector('main') || doc.querySelector('[role="dialog"]');
    if (!scope) return null;
    const button = arrow(scope, 'next') || arrow(scope, 'previous');
    for (let node = button?.parentElement, depth = 0; node && depth < 8; node = node.parentElement, depth += 1) {
      if (node.querySelector('li img, li video') && node.querySelector('ul, ol')) return node;
    }
    return null;
  }

  function currentFrame(root) {
    if (!root) return null;
    const bounds = root.getBoundingClientRect();
    const candidates = Array.from(root.querySelectorAll('li')).flatMap((slide) => {
      const element = slide.querySelector('video') || slide.querySelector('img');
      if (!element) return [];
      const rect = element.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) return [];
      const overlap = Math.max(0, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left))
        * Math.max(0, Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top));
      const ratio = overlap / (rect.width * rect.height);
      return [{ slide, element, ratio }];
    }).sort((a, b) => b.ratio - a.ratio);
    const chosen = candidates[0];
    // Adjacent slides are preloaded off screen. Never collect them as the current slide.
    if (!chosen || chosen.ratio < 0.9) return null;
    const { element, slide } = chosen;
    const isVideo = element.tagName === 'VIDEO';
    const source = mediaUrl(element.currentSrc || element.src || '');
    const thumbnail = isVideo ? mediaUrl(element.poster || '') : source;
    if (!isVideo && (!source || !element.complete || !element.naturalWidth)) return null;
    return {
      key: `${slide.style?.transform || ''}|${source ? new URL(source).pathname : thumbnail || 'video'}`,
      media_type: isVideo ? 'video' : 'image',
      media_url: source,
      thumbnail,
      preview_url: isVideo ? source : '',
      duration: isVideo && Number.isFinite(element.duration) ? Math.round(element.duration) : 0,
      capture_error: isVideo && !source ? 'O Instagram forneceu uma pre-visualizacao local. O MP4 sera verificado no download.' : '',
    };
  }

  async function collect(request, { doc = document, location = window.location, cancelled = () => false, progress = () => {} } = {}) {
    const sourceUrl = postUrl(request.url);
    if (!sourceUrl || sourceUrl !== postUrl(location.href)) throw new Error('A aba nao corresponde ao carrossel solicitado.');
    const started = Date.now();
    const check = async () => {
      if (await cancelled()) throw new Error('Leitura cancelada.');
      if (Date.now() - started > 150000) throw new Error('A leitura demorou demais. Nenhum carrossel incompleto foi confirmado.');
      if (postUrl(location.href) !== sourceUrl) throw new Error('A publicacao mudou durante a leitura. Tente novamente.');
    };
    const waitFrame = async (previousKey = '') => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await check();
        const root = findRoot(doc);
        const frame = currentFrame(root);
        if (frame && frame.key !== previousKey) return { root, frame };
        await pause(250);
      }
      throw new Error('Nao foi possivel carregar a proxima imagem. Reabra a publicacao e tente novamente.');
    };
    let { root, frame } = await waitFrame();
    // Start at slide 1 even if the supplied link originally pointed into the carousel.
    for (let back = 0; arrow(root, 'previous'); back += 1) {
      if (back >= MAX_ITEMS) throw new Error('Nao foi possivel localizar o inicio do carrossel.');
      arrow(root, 'previous').click();
      ({ root, frame } = await waitFrame(frame.key));
    }
    const children = [];
    const visited = new Set();
    for (let position = 1; position <= MAX_ITEMS; position += 1) {
      await check();
      if (visited.has(frame.key)) throw new Error('A navegacao repetiu uma pagina. O carrossel nao foi marcado como completo.');
      visited.add(frame.key);
      const { key, ...item } = frame;
      children.push({ ...item, position });
      await progress(position);
      await pause(350);
      root = findRoot(doc);
      const stable = currentFrame(root);
      if (!stable || stable.key !== frame.key) throw new Error('A imagem mudou durante a leitura. Tente novamente sem mover as setas.');
      const next = arrow(root, 'next');
      if (!next) {
        if (children.length < 2) throw new Error('Esta publicacao nao apresentou um carrossel completo.');
        return { url: sourceUrl, id: sourceUrl.split('/')[4], title: `Carrossel ${sourceUrl.split('/')[4]}`,
          total_items: children.length, scan_complete: true, children };
      }
      if (position === MAX_ITEMS) throw new Error(`O carrossel ultrapassou o limite de seguranca de ${MAX_ITEMS} itens. Nenhum item foi omitido silenciosamente.`);
      next.click();
      ({ root, frame } = await waitFrame(frame.key));
    }
    throw new Error('A leitura do carrossel nao foi concluida.');
  }

  return { MAX_ITEMS, postUrl, mediaUrl, arrow, findRoot, currentFrame, collect };
})();
