const HF_LAST_RESOLVE_KEY = 'hfBulkLastMediaResolve';
const HF_ACTIVE_RESOLVES = new Set();
const HF_MAX_RESOLVE_ITEMS = 10;
const HF_RESOLVE_WORKERS = 3;

function nowIso() {
  return new Date().toISOString();
}

function normalizeInstagramMediaUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || '').trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol !== 'https:' || host !== 'instagram.com' || url.username || url.password || url.port) return '';
    if (!/^\/(?:[A-Za-z0-9._]+\/)?(?:reel|p|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return '';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

async function waitForTab(tabId, timeoutMs = 25000) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === 'complete') return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('O Instagram demorou demais para abrir o Reel.'));
    }, timeoutMs);
    const onUpdated = (updatedId, changeInfo) => {
      if (updatedId !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function extractInstagramMedia() {
  const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
  const publicUrl = (value) => /^https:\/\//i.test(String(value || '')) ? String(value) : '';
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const metaUrl = publicUrl(
      document.querySelector('meta[property="og:video:secure_url"]')?.content
      || document.querySelector('meta[property="og:video"]')?.content
    );
    if (metaUrl) {
      return {
        media_url: metaUrl,
        preview_url: metaUrl,
        thumbnail: publicUrl(document.querySelector('meta[property="og:image"]')?.content),
        duration: 0,
        title: (document.title || 'Reel do Instagram').slice(0, 500)
      };
    }
    const videos = Array.from(new Set([
      ...document.querySelectorAll('main video'),
      ...document.querySelectorAll('article video'),
      ...document.querySelectorAll('video')
    ]));
    for (const video of videos) {
      const mediaUrl = [video.currentSrc, video.src, video.querySelector('source')?.src]
        .map(publicUrl).find(Boolean);
      if (!mediaUrl) continue;
      return {
        media_url: mediaUrl,
        preview_url: mediaUrl,
        thumbnail: publicUrl(video.poster),
        duration: Number.isFinite(video.duration) ? Math.round(video.duration) : 0,
        title: (document.title || 'Reel do Instagram').slice(0, 500)
      };
    }
    await sleep(500);
  }
  throw new Error('O Reel abriu, mas o Instagram não liberou o arquivo de vídeo.');
}

async function resolveOne(item) {
  const sourceUrl = normalizeInstagramMediaUrl(item?.url);
  if (!sourceUrl) return { url: item?.url || '', status: 'failed', error: 'Link do Instagram inválido.' };
  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url: sourceUrl, active: false });
    tabId = tab.id;
    if (!Number.isInteger(tabId)) throw new Error('Não foi possível abrir o Reel em segundo plano.');
    await waitForTab(tabId);
    const loadedTab = await chrome.tabs.get(tabId);
    if (!normalizeInstagramMediaUrl(loadedTab.url)) {
      throw new Error('O Instagram redirecionou o Reel. Confirme o login e tente novamente.');
    }
    const execution = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractInstagramMedia
    });
    const media = execution?.[0]?.result;
    if (!media?.media_url) throw new Error('O Instagram não entregou o endereço do vídeo.');
    return { url: item.url, status: 'resolved', ...media };
  } catch (error) {
    return { url: item.url, status: 'failed', error: error?.message || 'Falha ao preparar o Reel.' };
  } finally {
    if (Number.isInteger(tabId)) await chrome.tabs.remove(tabId).catch(() => null);
  }
}

async function resolveBatch(payload) {
  const requestId = String(payload?.requestId || '');
  const items = Array.isArray(payload?.items) ? payload.items.slice(0, HF_MAX_RESOLVE_ITEMS) : [];
  if (!/^[A-Za-z0-9-]{1,80}$/.test(requestId) || !items.length) {
    throw new Error('Solicitação de vídeos inválida.');
  }
  if (HF_ACTIVE_RESOLVES.has(requestId)) return;
  HF_ACTIVE_RESOLVES.add(requestId);
  const heartbeat = setInterval(() => {
    chrome.storage.local.get(HF_LAST_RESOLVE_KEY).catch(() => null);
  }, 20000);
  const results = new Array(items.length);
  let cursor = 0;
  let completed = 0;
  const publish = async (status, message = '') => chrome.storage.local.set({
    [HF_LAST_RESOLVE_KEY]: {
      requestId,
      status,
      total: items.length,
      completed,
      results: results.filter(Boolean),
      message,
      checkedAt: nowIso()
    }
  });
  try {
    await publish('resolving');
    const worker = async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await resolveOne(items[index]);
        completed += 1;
        await publish('resolving');
      }
    };
    await Promise.all(Array.from({ length: Math.min(HF_RESOLVE_WORKERS, items.length) }, worker));
    const resolved = results.filter((item) => item?.status === 'resolved').length;
    const status = resolved === items.length ? 'success' : resolved ? 'partial' : 'error';
    const message = resolved
      ? `${resolved} de ${items.length} vídeo(s) preparados.`
      : 'O Instagram não liberou nenhum MP4. Confirme que a conta continua conectada.';
    await publish(status, message);
  } finally {
    clearInterval(heartbeat);
    HF_ACTIVE_RESOLVES.delete(requestId);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'HF_BULK_RESOLVE_MEDIA_BATCH') return false;
  let senderOrigin = '';
  try { senderOrigin = new URL(sender.url).origin; } catch { /* Invalid sender URL. */ }
  if (senderOrigin !== 'https://app.hfnew.com.br') {
    sendResponse({ accepted: false });
    return false;
  }
  const requestId = String(message.payload?.requestId || '');
  const items = message.payload?.items;
  if (!/^[A-Za-z0-9-]{1,80}$/.test(requestId) || !Array.isArray(items) || !items.length) {
    sendResponse({ accepted: false, error: 'Solicitacao de videos invalida.' });
    return false;
  }
  sendResponse({ accepted: true });
  resolveBatch(message.payload)
    .catch(async (error) => {
      await chrome.storage.local.set({
        [HF_LAST_RESOLVE_KEY]: {
          requestId,
          status: 'error',
          total: items.length,
          completed: 0,
          results: [],
          message: error?.message || 'Falha ao preparar os vídeos.',
          checkedAt: nowIso()
        }
      });
    });
  return false;
});
