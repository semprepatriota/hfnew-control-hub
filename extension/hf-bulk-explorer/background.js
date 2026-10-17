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
    url.hostname = 'www.instagram.com';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function instagramPostCode(rawUrl) {
  const normalized = normalizeInstagramMediaUrl(rawUrl);
  return normalized ? new URL(normalized).pathname.match(/\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)\/?$/)?.[1] || '' : '';
}

function isInstagramVideoFile(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && ['cdninstagram.com', 'fbcdn.net'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
      && !/\.(?:jpe?g|png|webp|gif|m3u8|mpd)(?:$|[?])/i.test(url.pathname);
  } catch { return false; }
}

async function waitForTab(tabId, timeoutMs = 25000) {
  await new Promise((resolve, reject) => {
    let timeout;
    const finish = (error) => {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (error) reject(error);
      else resolve();
    };
    const onUpdated = (updatedId, changeInfo) => {
      if (updatedId !== tabId || changeInfo.status !== 'complete') return;
      finish();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    timeout = setTimeout(() => finish(new Error('O Instagram demorou demais para abrir o Reel.')), timeoutMs);
    chrome.tabs.get(tabId).then(current => { if (current.status === 'complete') finish(); }, finish);
  });
}

async function extractInstagramMedia(sourceUrl) {
  try {
  // Self-contained: Chrome serializes this function into the selected post's page.
  const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
  const codeOf = value => {
    try {
      const url = new URL(value, window.location.origin);
      return ['instagram.com', 'www.instagram.com'].includes(url.hostname)
        ? url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(?:reel|p|tv)\/([A-Za-z0-9_-]+)\/?$/)?.[1] || '' : '';
    } catch { return ''; }
  };
  const expectedCode = codeOf(sourceUrl);
  if (!expectedCode) throw new Error('A solicitacao nao aponta para uma publicacao do Instagram.');
  const mediaUrl = (value, image = false) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port
        || !['cdninstagram.com', 'fbcdn.net'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return '';
      if (!image && /\.(?:jpe?g|png|webp|gif|m3u8|mpd)$/i.test(url.pathname)) return '';
      return url.href;
    } catch { return ''; }
  };
  const result = (url, metadata = {}, method = 'page') => ({
    media_url: url, preview_url: url,
    thumbnail: mediaUrl(metadata.thumbnail || '', true),
    duration: Number.isFinite(Number(metadata.duration)) ? Math.max(0, Math.round(Number(metadata.duration))) : 0,
    title: String(metadata.title || document.title || 'Reel do Instagram').slice(0, 500),
    source_shortcode: expectedCode, resolved_via: method,
  });
  const parsedScripts = new WeakSet();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (codeOf(window.location.href) !== expectedCode) {
      throw new Error('O Instagram abriu outro perfil ou publicacao. O video nao foi enviado ao HUB.');
    }
    if (document.querySelector('input[name="username"], form[action*="/accounts/login"]')) {
      throw new Error('O Instagram pediu login. Entre na sua conta no Chrome antes de tentar novamente.');
    }
    // Progressive MP4s remain in post-specific JSON even when the player uses a blob URL.
    let remainingBytes = 8 * 1024 * 1024;
    for (const script of document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]')) {
      if (parsedScripts.has(script)) continue;
      const text = script.textContent || '';
      if (!text || text.length > remainingBytes) continue;
      remainingBytes -= text.length;
      let data;
      try { data = JSON.parse(text); } catch { continue; }
      parsedScripts.add(script);
      const stack = [data];
      let visited = 0;
      while (stack.length && visited++ < 60000) {
        const node = stack.pop();
        if (!node || typeof node !== 'object') continue;
        const matches = node.shortcode === expectedCode || node.code === expectedCode
          || (node['@type'] === 'VideoObject' && [node.url, node['@id'], node.mainEntityOfPage?.['@id'], node.mainEntityOfPage].some(value => typeof value === 'string' && codeOf(value) === expectedCode));
        if (matches) {
          const versions = Array.isArray(node.video_versions) ? [...node.video_versions].sort((a, b) => (Number(b.width) || 0) * (Number(b.height) || 0) - (Number(a.width) || 0) * (Number(a.height) || 0)) : [];
          const url = [node.video_url, ...versions.map(version => version.url), node.contentUrl].map(value => mediaUrl(value)).find(Boolean);
          if (url) return result(url, {
            thumbnail: node.display_url || node.thumbnailUrl || node.image_versions2?.candidates?.[0]?.url,
            duration: node.video_duration || node.duration,
            title: node.caption?.text || node.name,
          }, 'post_json');
        }
        for (const value of Object.values(node)) if (value && typeof value === 'object') stack.push(value);
      }
    }
    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    const canonicalMatches = !canonical || codeOf(canonical) === expectedCode;
    const metaUrl = canonicalMatches && mediaUrl(
      document.querySelector('meta[property="og:video:secure_url"]')?.content
      || document.querySelector('meta[property="og:video"]')?.content
    );
    if (metaUrl) return result(metaUrl, { thumbnail: document.querySelector('meta[property="og:image"]')?.content }, 'post_meta');
    const containers = Array.from(document.querySelectorAll('article, [role="dialog"]'));
    const matching = containers.filter(container => Array.from(container.querySelectorAll('a[href]')).some(anchor => codeOf(anchor.href) === expectedCode));
    const videos = Array.from(new Set(matching.length
      ? matching.flatMap(container => Array.from(container.querySelectorAll('video')))
      : canonicalMatches ? Array.from(document.querySelectorAll('video')) : []));
    // A feed may preload neighboring Reels. Never substitute the first one.
    if (videos.length === 1) {
      const video = videos[0];
      const url = [video.currentSrc, video.src, video.querySelector('source')?.src].map(value => mediaUrl(value)).find(Boolean);
      if (url) return result(url, { thumbnail: video.poster, duration: video.duration }, 'post_player');
    }
    await sleep(500);
  }
  throw new Error('A publicacao abriu, mas o Instagram nao disponibilizou um MP4 identificavel dessa cena. Nenhum outro video foi substituido.');
  } catch (error) {
    // Some Chrome versions omit an injected rejected Promise's diagnostic result.
    return { error: error?.message || 'Falha ao ler o arquivo da publicacao.' };
  }
}

async function resolveOne(item) {
  const sourceUrl = normalizeInstagramMediaUrl(item?.url);
  if (!sourceUrl) return { url: item?.url || '', status: 'failed', error: 'Link do Instagram inválido.' };
  let tabId = null;
  let temporary = false;
  try {
    const existing = typeof chrome.tabs.query === 'function' ? await chrome.tabs.query({ url: 'https://www.instagram.com/*' }) : [];
    let tab = existing.find(candidate => instagramPostCode(candidate.url) === instagramPostCode(sourceUrl));
    if (!tab) {
      tab = await chrome.tabs.create({ url: sourceUrl, active: false });
      temporary = true;
    }
    tabId = tab.id;
    if (!Number.isInteger(tabId)) throw new Error('Não foi possível abrir o Reel em segundo plano.');
    await waitForTab(tabId);
    const loadedTab = await chrome.tabs.get(tabId);
    if (instagramPostCode(loadedTab.url) !== instagramPostCode(sourceUrl)) {
      throw new Error('O Instagram redirecionou o Reel. Confirme o login e tente novamente.');
    }
    const execution = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractInstagramMedia,
      args: [sourceUrl],
    });
    const media = execution?.[0]?.result;
    if (media?.error) throw new Error(media.error);
    if (!isInstagramVideoFile(media?.media_url)) throw new Error('O Instagram nao entregou um arquivo de video valido.');
    if (media.source_shortcode && media.source_shortcode !== instagramPostCode(sourceUrl)) throw new Error('O video lido nao corresponde a publicacao solicitada.');
    return { url: item.url, status: 'resolved', ...media };
  } catch (error) {
    return { url: item.url, status: 'failed', error: error?.message || 'Falha ao preparar o Reel.' };
  } finally {
    if (temporary && Number.isInteger(tabId)) await chrome.tabs.remove(tabId).catch(() => null);
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
  const publish = async (status, message = '') => {
    const result = {
      requestId,
      status,
      total: items.length,
      completed,
      results: results.filter(Boolean),
      message,
      checkedAt: nowIso()
    };
    await chrome.storage.local.set({ [HF_LAST_RESOLVE_KEY]: result, [`hfBulkMediaResolve:${requestId}`]: result });
  };
  try {
    // Bound extension-local results without touching cookies, sessions or HUB data.
    const stored = await chrome.storage.local.get(null);
    const stale = Object.keys(stored).filter(key => key.startsWith('hfBulkMediaResolve:')
      && !HF_ACTIVE_RESOLVES.has(key.slice('hfBulkMediaResolve:'.length)))
      .sort((a, b) => String(stored[b]?.checkedAt || '').localeCompare(String(stored[a]?.checkedAt || ''))).slice(20);
    if (stale.length) await chrome.storage.local.remove(stale);
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
