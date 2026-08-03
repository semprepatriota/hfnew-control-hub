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
  const normalized = String(text || '').toLowerCase().replace(/\s/g, '').replace(',', '.');
  const match = normalized.match(/(\d+(?:\.\d+)?)(mi|mil|m|k)?/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (match[2] === 'mi' || match[2] === 'm') return Math.round(value * 1000000);
  if (match[2] === 'mil' || match[2] === 'k') return Math.round(value * 1000);
  return Math.round(value);
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
    const container = anchor.closest('article') || anchor.parentElement;
    const time = container?.querySelector('time[datetime]');
    const text = container?.innerText || anchor.innerText || '';
    const numbers = text.match(/\d+(?:[.,]\d+)?\s*(?:mi|mil|m|k)?/gi) || [];
    collected.set(url.href, {
      url: url.href,
      media_url: mediaUrl,
      preview_url: mediaUrl,
      title: (image?.alt || anchor.getAttribute('aria-label') || 'Conteúdo do Instagram').slice(0, 500),
      thumbnail: image?.currentSrc || image?.src || video?.poster || '',
      platform: 'instagram',
      media_type: url.pathname.includes('/p/') && !video ? 'image' : 'video',
      duration: Number.isFinite(video?.duration) ? Math.round(video.duration) : 0,
      view_count: parseCompactCount(numbers[0] || ''),
      like_count: parseCompactCount(numbers[1] || ''),
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
