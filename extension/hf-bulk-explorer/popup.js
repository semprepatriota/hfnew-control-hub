const scanButton = document.getElementById('scanPage');
const sendButton = document.getElementById('sendItems');
const resultCount = document.getElementById('resultCount');
const pageName = document.getElementById('pageName');
const message = document.getElementById('message');

let currentItems = [];
let currentPageUrl = '';

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

async function collectVisibleMedia(limit = 25) {
  const target = Math.max(1, Math.min(100, Number(limit) || 25));
  let previousHeight = 0;
  for (let round = 0; round < 14; round += 1) {
    const visibleLinks = document.querySelectorAll('a[href*="/reel/"], a[href*="/video/"], a[href*="/pin/"], a[href*="/photo/"]').length;
    if (visibleLinks >= target) break;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    await new Promise((resolve) => setTimeout(resolve, 650));
    const height = document.documentElement.scrollHeight;
    if (height === previousHeight) break;
    previousHeight = height;
  }

  const host = window.location.hostname.toLowerCase();
  const pageUrl = window.location.href;
  const links = Array.from(document.querySelectorAll('a[href]'));
  const collected = new Map();

  const parseCount = (text) => {
    const match = String(text || '').toLowerCase().match(/(\d[\d.,\s]*)(mil|mi|k|m)?\b/);
    if (!match) return 0;
    const digits = match[1].replace(/\s/g, '').replace(/[.,]+$/, '');
    const suffix = match[2] || '';
    const normalized = suffix
      ? digits.replace(/[.,](?=.*[.,])/g, '').replace(',', '.')
      : digits.replace(/[.,]/g, '');
    const multiplier = suffix === 'mil' || suffix === 'k' ? 1000 : suffix ? 1000000 : 1;
    const count = Number(normalized) * multiplier;
    return Number.isFinite(count) ? Math.round(count) : 0;
  };

  const readThumbnail = (anchor) => {
    const image = anchor.querySelector('img');
    const video = anchor.querySelector('video');
    const direct = image?.currentSrc || image?.src || video?.poster || '';
    if (/^https?:\/\//i.test(direct)) return direct;
    for (const node of [anchor, ...anchor.querySelectorAll('[style*="background-image"]')]) {
      const match = (node.style?.backgroundImage || '').match(/url\(\s*(["']?)(.*?)\1\s*\)/i);
      if (match && /^https?:\/\//i.test(match[2])) return match[2];
    }
    return '';
  };

  const readMetric = (anchor, type) => {
    const selector = type === 'views'
      ? '[aria-label*="visualiza" i], [aria-label*="view" i], [aria-label*="contagem" i]'
      : '[aria-label*="curtida" i], [aria-label*="like" i]';
    let node = anchor.querySelector(selector);
    while (node && anchor.contains(node)) {
      const text = node.innerText || node.getAttribute('aria-label') || '';
      if (/\d/.test(text)) return parseCount(text);
      if (node === anchor) break;
      node = node.parentElement;
    }
    const text = anchor.innerText || '';
    return type === 'views' && /^\s*\d[\d.,\s]*(?:mil|mi|k|m)?\s*$/i.test(text)
      ? parseCount(text) : 0;
  };

  const platform = host.includes('instagram') ? 'instagram'
    : host.includes('tiktok') ? 'tiktok'
        : host.includes('facebook') ? 'facebook'
          : host.includes('pinterest') ? 'pinterest'
            : host.includes('kwai') ? 'kwai' : '';

  const supported = (url) => {
    const path = url.pathname;
    if (platform === 'instagram') return /^\/(?:[A-Za-z0-9._]+\/)?(p|reel|tv)\//.test(path);
    if (platform === 'tiktok') return path.includes('/video/');
    if (platform === 'facebook') return path.includes('/reel/') || path.includes('/videos/');
    if (platform === 'pinterest') return path.includes('/pin/');
    if (platform === 'kwai') return path.includes('/photo/') || path.includes('/video/');
    return false;
  };

  for (const anchor of links) {
    let url;
    try { url = new URL(anchor.href, window.location.origin); } catch { continue; }
    if (!supported(url)) continue;
    url.search = '';
    url.hash = '';
    const image = anchor.querySelector('img');
    const video = anchor.querySelector('video');
    const rawVideoUrl = video?.currentSrc || video?.src || '';
    const safeVideoUrl = /^https?:\/\//i.test(rawVideoUrl) ? rawVideoUrl : '';
    const timeNode = anchor.querySelector('time[datetime]');
    const title = image?.alt || anchor.getAttribute('aria-label') || document.title || 'Conteúdo encontrado';
    const thumbnail = readThumbnail(anchor);
    const mediaType = url.pathname.includes('/p/') && !video ? 'image' : 'video';
    const mediaUrl = safeVideoUrl || (platform === 'instagram' && mediaType === 'image' ? thumbnail : '');
    collected.set(url.href, {
      url: url.href,
      media_url: mediaUrl,
      title: title.slice(0, 500),
      thumbnail,
      preview_url: safeVideoUrl,
      platform,
      media_type: mediaType,
      duration: Number.isFinite(video?.duration) ? Math.round(video.duration) : 0,
      view_count: readMetric(anchor, 'views'),
      like_count: readMetric(anchor, 'likes'),
      published_at: timeNode?.dateTime || timeNode?.getAttribute('datetime') || ''
    });
  }

  if (!collected.size) {
    let current;
    try { current = new URL(pageUrl); } catch { current = null; }
    if (current && supported(current)) {
      const image = document.querySelector('main img, article img');
      collected.set(current.href.split('?')[0], {
        url: current.href.split('?')[0],
        media_url: platform === 'instagram' && current.pathname.includes('/p/') ? (image?.currentSrc || '') : '',
        title: document.title || 'Conteúdo encontrado',
        thumbnail: image?.currentSrc || '',
        preview_url: '',
        platform,
        media_type: current.pathname.includes('/p/') ? 'image' : 'video',
        duration: 0,
        view_count: 0,
        like_count: 0,
        published_at: document.querySelector('time[datetime]')?.getAttribute('datetime') || ''
      });
    }
  }

  return { pageUrl, title: document.title, items: Array.from(collected.values()).slice(0, target) };
}

scanButton.addEventListener('click', async () => {
  setMessage('Escaneando a página aberta...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Nenhuma página ativa encontrada.');
    const limit = Number(document.getElementById('scanLimit').value || 25);
    const execution = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectVisibleMedia, args: [limit] });
    const result = execution?.[0]?.result || { items: [] };
    currentItems = result.items || [];
    currentPageUrl = result.pageUrl || tab.url || '';
    resultCount.textContent = String(currentItems.length);
    pageName.textContent = result.title || currentPageUrl;
    sendButton.disabled = !currentItems.length;
    setMessage(
      currentItems.length ? 'Conteúdos prontos para enviar.' : 'Nenhum conteúdo suportado ficou visível nesta página.',
      currentItems.length ? 'success' : 'error'
    );
  } catch (error) {
    setMessage(error.message || 'Não foi possível escanear a página.', 'error');
  }
});

sendButton.addEventListener('click', async () => {
  sendButton.disabled = true;
  setMessage('Enviando os links ao painel aberto...');
  try {
    await chrome.storage.local.set({
      hfBulkLastScan: {
        status: 'success',
        requestId: `manual-${Date.now()}`,
        manual: true,
        total: currentItems.length,
        items: currentItems,
        scanned: currentItems.length,
        datesUnavailable: currentItems.filter((item) => !item.published_at).length,
        pageUrl: currentPageUrl,
        checkedAt: new Date().toISOString()
      }
    });
    setMessage(`${currentItems.length} conteúdo(s) enviados ao painel.`, 'success');
  } catch (error) {
    setMessage(error.message || 'Falha ao enviar os links.', 'error');
  } finally {
    sendButton.disabled = !currentItems.length;
  }
});
