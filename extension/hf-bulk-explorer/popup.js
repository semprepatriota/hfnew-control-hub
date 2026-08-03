const API_URL = 'https://api.hfnew.com.br/api/bulk-download/extension/import';

const keyInput = document.getElementById('pairingKey');
const saveKeyButton = document.getElementById('saveKey');
const scanButton = document.getElementById('scanPage');
const sendButton = document.getElementById('sendItems');
const resultCount = document.getElementById('resultCount');
const pageName = document.getElementById('pageName');
const connection = document.getElementById('connection');
const message = document.getElementById('message');

let currentItems = [];
let currentPageUrl = '';

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function updateConnection(value) {
  const connected = Boolean(value && value.startsWith('hfbe_'));
  connection.textContent = connected ? 'Chave configurada neste navegador' : 'Chave ainda não configurada';
  connection.className = `status ${connected ? 'ok' : ''}`.trim();
  return connected;
}

chrome.storage.local.get(['hfExplorerKey'], (stored) => {
  keyInput.value = stored.hfExplorerKey || '';
  updateConnection(keyInput.value);
});

saveKeyButton.addEventListener('click', () => {
  const value = keyInput.value.trim();
  if (!value.startsWith('hfbe_')) {
    setMessage('Cole a chave gerada dentro do módulo Baixar em Massa.', 'error');
    return;
  }
  chrome.storage.local.set({ hfExplorerKey: value }, () => {
    updateConnection(value);
    setMessage('Chave salva.', 'success');
  });
});

function collectVisibleMedia() {
  const host = window.location.hostname.toLowerCase();
  const pageUrl = window.location.href;
  const links = Array.from(document.querySelectorAll('a[href]'));
  const collected = new Map();

  const platform = host.includes('instagram') ? 'instagram'
    : host.includes('youtube') ? 'youtube'
      : host.includes('tiktok') ? 'tiktok'
        : host.includes('facebook') ? 'facebook'
          : host.includes('pinterest') ? 'pinterest'
            : host.includes('kwai') ? 'kwai' : '';

  const supported = (url) => {
    const path = url.pathname;
    if (platform === 'instagram') return /^\/(p|reel|tv)\//.test(path);
    if (platform === 'youtube') return path === '/watch' || path.startsWith('/shorts/');
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
    const title = image?.alt || anchor.getAttribute('aria-label') || document.title || 'Conteúdo encontrado';
    const thumbnail = image?.currentSrc || image?.src || video?.poster || '';
    const mediaUrl = platform === 'instagram' && image?.currentSrc ? image.currentSrc : '';
    const mediaType = url.pathname.includes('/p/') && !video ? 'image' : 'video';
    collected.set(url.href, {
      url: url.href,
      media_url: mediaUrl,
      title: title.slice(0, 500),
      thumbnail,
      platform,
      media_type: mediaType
    });
  }

  if (!collected.size) {
    let current;
    try { current = new URL(pageUrl); } catch { current = null; }
    if (current && supported(current)) {
      const image = document.querySelector('main img, article img');
      collected.set(current.href.split('?')[0], {
        url: current.href.split('?')[0],
        media_url: platform === 'instagram' ? (image?.currentSrc || '') : '',
        title: document.title || 'Conteúdo encontrado',
        thumbnail: image?.currentSrc || '',
        platform,
        media_type: current.pathname.includes('/p/') ? 'image' : 'video'
      });
    }
  }

  return { pageUrl, title: document.title, items: Array.from(collected.values()).slice(0, 200) };
}

scanButton.addEventListener('click', async () => {
  setMessage('Escaneando a página aberta...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Nenhuma página ativa encontrada.');
    const execution = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectVisibleMedia });
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
  const stored = await chrome.storage.local.get(['hfExplorerKey']);
  const extensionKey = stored.hfExplorerKey || keyInput.value.trim();
  if (!updateConnection(extensionKey)) {
    setMessage('Salve primeiro a chave de conexão.', 'error');
    return;
  }
  sendButton.disabled = true;
  setMessage('Enviando os links ao HF New Control Hub...');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HF-Explorer-Key': extensionKey },
      body: JSON.stringify({ page_url: currentPageUrl, items: currentItems })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || 'O app recusou os links.');
    setMessage(`${payload.total} conteúdo(s) enviado(s).`, 'success');
  } catch (error) {
    setMessage(error.message || 'Falha ao enviar os links.', 'error');
  } finally {
    sendButton.disabled = !currentItems.length;
  }
});
