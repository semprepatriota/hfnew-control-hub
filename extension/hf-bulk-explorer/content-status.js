const HF_STATUS_KEY = 'hfInstagramBrowserStatus';
const HF_PENDING_SCAN_KEY = 'hfBulkPendingScan';
const HF_LAST_SCAN_KEY = 'hfBulkLastScan';
const HF_MESSAGE_SOURCE = 'HF_BULK_EXPLORER';

function nowIso() {
  return new Date().toISOString();
}

function detectInstagramLogin() {
  const pathname = window.location.pathname.toLowerCase();
  const loginPage = pathname.startsWith('/accounts/login');
  const loginForm = Boolean(document.querySelector('input[name="username"], form[action*="/accounts/login"]'));
  const loggedNavigation = Boolean(document.querySelector(
    'a[href*="/direct/inbox"], a[href="/accounts/edit/"], svg[aria-label="Perfil"], svg[aria-label="Profile"]'
  ));
  const loginLink = Boolean(document.querySelector('a[href*="/accounts/login"], button[type="submit"]'));
  return !loginPage && !loginForm && (loggedNavigation || !loginLink);
}

async function updateInstagramStatus() {
  const payload = {
    open: true,
    loggedIn: detectInstagramLogin(),
    checkedAt: nowIso(),
    pageUrl: window.location.href
  };
  await chrome.storage.local.set({ [HF_STATUS_KEY]: payload });
}

async function postStatusToApp() {
  const stored = await chrome.storage.local.get([HF_STATUS_KEY, HF_LAST_SCAN_KEY]);
  window.postMessage({
    source: HF_MESSAGE_SOURCE,
    type: 'HF_BULK_EXTENSION_STATUS',
    payload: {
      installed: true,
      version: chrome.runtime.getManifest().version,
      checkedAt: nowIso(),
      instagram: stored[HF_STATUS_KEY] || null,
      lastScan: stored[HF_LAST_SCAN_KEY] || null
    }
  }, window.location.origin);
}

function parseCompactCount(text) {
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
}

function readCardThumbnail(anchor) {
  const image = anchor.querySelector('img');
  const video = anchor.querySelector('video');
  const direct = image?.currentSrc || image?.src || video?.poster || '';
  if (/^https?:\/\//i.test(direct)) return direct;
  // Instagram Reels also renders covers as CSS backgrounds, without an img tag.
  for (const node of [anchor, ...anchor.querySelectorAll('[style*="background-image"]')]) {
    const background = node.style?.backgroundImage || '';
    const match = background.match(/url\(\s*(["']?)(.*?)\1\s*\)/i);
    if (match && /^https?:\/\//i.test(match[2])) return match[2];
  }
  return '';
}

function readCardMetric(anchor, type) {
  const selector = type === 'views'
    ? '[aria-label*="visualiza" i], [aria-label*="view" i], [aria-label*="contagem" i]'
    : '[aria-label*="curtida" i], [aria-label*="like" i]';
  let node = anchor.querySelector(selector);
  while (node && anchor.contains(node)) {
    const text = node.innerText || node.getAttribute('aria-label') || '';
    if (/\d/.test(text)) return parseCompactCount(text);
    if (node === anchor) break;
    node = node.parentElement;
  }
  const text = anchor.innerText || '';
  return type === 'views' && /^\s*\d[\d.,\s]*(?:mil|mi|k|m)?\s*$/i.test(text)
    ? parseCompactCount(text) : 0;
}

function periodBounds(request) {
  const now = new Date();
  if (request.period === '7d') return [new Date(now.getTime() - 7 * 86400000), now];
  if (request.period === '30d') return [new Date(now.getTime() - 30 * 86400000), now];
  if (request.period === 'custom') {
    const start = request.dateFrom ? new Date(`${request.dateFrom}T00:00:00`) : null;
    const end = request.dateTo ? new Date(`${request.dateTo}T23:59:59`) : null;
    return [start, end];
  }
  return [null, null];
}

async function collectInstagramProfile(request) {
  // A new tab can finish navigation before the React media grid is populated.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const cards = Array.from(document.querySelectorAll('a[href*="/reel/"], a[href*="/p/"]'));
    if (cards.some((card) => readCardThumbnail(card))) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const candidateTarget = request.sortBy === 'recent' && request.period === 'all'
    ? Number(request.limit)
    : Math.min(200, Math.max(100, Number(request.limit) * 3));
  let previousHeight = 0;
  for (let round = 0; round < 24; round += 1) {
    const count = document.querySelectorAll('a[href*="/reel/"], a[href*="/p/"]').length;
    if (count >= candidateTarget) break;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    await new Promise((resolve) => setTimeout(resolve, 700));
    const height = document.documentElement.scrollHeight;
    if (height === previousHeight) break;
    previousHeight = height;
  }

  const collected = new Map();
  for (const anchor of document.querySelectorAll('a[href*="/reel/"], a[href*="/p/"]')) {
    const url = new URL(anchor.href, window.location.origin);
    url.search = '';
    url.hash = '';
    const image = anchor.querySelector('img');
    const video = anchor.querySelector('video');
    const rawMediaUrl = video?.currentSrc || video?.src || '';
    const mediaUrl = /^https?:\/\//i.test(rawMediaUrl) ? rawMediaUrl : '';
    const time = anchor.querySelector('time[datetime]');
    collected.set(url.href, {
      url: url.href,
      media_url: mediaUrl,
      preview_url: mediaUrl,
      title: (image?.alt || anchor.getAttribute('aria-label') || `Reel de @${request.username}`).slice(0, 500),
      thumbnail: readCardThumbnail(anchor),
      platform: 'instagram',
      media_type: url.pathname.includes('/p/') && !video ? 'image' : 'video',
      duration: Number.isFinite(video?.duration) ? Math.round(video.duration) : 0,
      view_count: readCardMetric(anchor, 'views'),
      like_count: readCardMetric(anchor, 'likes'),
      published_at: time?.dateTime || time?.getAttribute('datetime') || ''
    });
  }

  const candidates = Array.from(collected.values());
  const [startAt, endAt] = periodBounds(request);
  let datesUnavailable = 0;
  let filtered = candidates.filter((item) => {
    if (!startAt && !endAt) return true;
    if (!item.published_at) {
      datesUnavailable += 1;
      return true;
    }
    const published = new Date(item.published_at);
    return (!startAt || published >= startAt) && (!endAt || published <= endAt);
  });

  if (request.sortBy === 'views') filtered.sort((a, b) => b.view_count - a.view_count);
  else if (request.sortBy === 'likes') filtered.sort((a, b) => b.like_count - a.like_count);
  else filtered.sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));

  return {
    items: filtered.slice(0, Number(request.limit)),
    scanned: candidates.length,
    datesUnavailable
  };
}

async function runPendingInstagramScan() {
  const stored = await chrome.storage.local.get([HF_PENDING_SCAN_KEY]);
  const request = stored[HF_PENDING_SCAN_KEY];
  if (!request || request.platform !== 'instagram') return;
  if (Date.now() - Number(request.requestedAt || 0) > 120000) {
    await chrome.storage.local.remove(HF_PENDING_SCAN_KEY);
    return;
  }
  const currentHandle = window.location.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  if (currentHandle !== String(request.username || '').replace(/^@/, '').toLowerCase()) return;

  try {
    const result = await collectInstagramProfile(request);
    if (!result.items.length) throw new Error('Nenhum vídeo visível foi encontrado neste perfil.');
    await chrome.storage.local.set({
      [HF_LAST_SCAN_KEY]: {
        status: 'success',
        requestId: request.requestId || '',
        total: result.items.length,
        items: result.items,
        scanned: result.scanned,
        datesUnavailable: result.datesUnavailable,
        checkedAt: nowIso()
      }
    });
  } catch (error) {
    await chrome.storage.local.set({
      [HF_LAST_SCAN_KEY]: {
        status: 'error',
        requestId: request.requestId || '',
        message: error.message || 'Falha ao escanear perfil.',
        checkedAt: nowIso()
      }
    });
  } finally {
    await chrome.storage.local.remove(HF_PENDING_SCAN_KEY);
  }
}

if (window.location.hostname === 'www.instagram.com') {
  updateInstagramStatus();
  window.setTimeout(runPendingInstagramScan, 1800);
  window.setInterval(updateInstagramStatus, 15000);
}

if (window.location.hostname === 'app.hfnew.com.br') {
  postStatusToApp();
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'HF_NEW_CONTROL_HUB') return;
    if (event.data?.type === 'HF_BULK_EXTENSION_CHECK') postStatusToApp();
    if (event.data?.type === 'HF_BULK_PROFILE_SCAN' && event.data?.payload) {
      chrome.storage.local.set({
        [HF_PENDING_SCAN_KEY]: { ...event.data.payload, requestedAt: Date.now() }
      });
    }
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes[HF_STATUS_KEY] || changes[HF_LAST_SCAN_KEY])) postStatusToApp();
  });
}
