import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { isInstagramUrl, PLATFORM_LABELS, PROFILE_PLATFORMS } from '../src/modules/bulk-download/services/bulkPlatforms.js';

const extension = new URL('../extension/hf-bulk-explorer/', import.meta.url);
const source = (file) => readFileSync(new URL(file, extension), 'utf8');

function card({ id = 'ABC123', thumbnail = 'https://cdn.example/cover.jpg', image,
  video, views = '91,8\u00a0mil', likes = '', labeled = true, kind = 'reel' } = {}) {
  const anchor = {
    href: `https://www.instagram.com/channel/${kind}/${id}/?utm_source=test`,
    innerText: views,
    style: {},
    getAttribute: () => null,
    contains(node) {
      while (node) {
        if (node === this) return true;
        node = node.parentElement;
      }
      return false;
    },
  };
  const metric = (text, label) => ({
    innerText: '',
    getAttribute: () => label,
    parentElement: { innerText: text, parentElement: anchor },
  });
  const viewIcon = labeled ? metric(views, 'Ver icone de contagem') : null;
  const likeIcon = likes ? metric(likes, 'Curtidas') : null;
  const cover = { style: { backgroundImage: `url("${thumbnail}")` } };
  anchor.querySelector = (selector) => {
    if (selector === 'img') return image || null;
    if (selector === 'video') return video || null;
    if (selector.includes('contagem')) return viewIcon;
    if (selector.includes('curtida')) return likeIcon;
    return null;
  };
  anchor.querySelectorAll = (selector) => selector.includes('background-image') && thumbnail ? [cover] : [];
  return anchor;
}

function runtime(file, cards = []) {
  const stats = { delays: [], scrolls: 0 };
  const document = {
    title: 'Public profile',
    documentElement: { scrollHeight: 2000 },
    querySelectorAll: (selector) => selector.includes('a[href') ? cards : [],
    querySelector: () => null,
    getElementById: () => ({ addEventListener() {} }),
  };
  const context = vm.createContext({
    URL,
    document,
    window: {
      // Loading the functions must not start either content-script integration.
      location: { hostname: 'instagram.com', origin: 'https://www.instagram.com', href: 'https://www.instagram.com/channel/reels/' },
      scrollTo() { stats.scrolls += 1; },
    },
    setTimeout(callback, delay) { stats.delays.push(delay); callback(); },
  });
  vm.runInContext(source(file), context, { filename: file });
  return { context, document, stats };
}

test('counts distinguish mil from mi and preserve exact grouped counts', () => {
  const { context } = runtime('content-status.js');
  for (const [text, expected] of [
    ['23 mil', 23000], ['91,8\u00a0mil', 91800], ['1,6 mi', 1600000],
    ['296 mil', 296000], ['1.2M', 1200000], ['2.5K', 2500],
    ['9.876', 9876], ['1,234', 1234], ['1.234.567', 1234567],
    ['1394', 1394], ['0', 0], ['', 0], ['Visualizacoes', 0],
  ]) assert.equal(context.parseCompactCount(text), expected, text);
});

test('CSS Reels covers, img covers and video posters are supported', () => {
  const { context } = runtime('content-status.js');
  assert.equal(context.readCardThumbnail(card()), 'https://cdn.example/cover.jpg');
  assert.equal(context.readCardThumbnail(card({ image: { currentSrc: 'https://cdn.example/img.jpg' } })), 'https://cdn.example/img.jpg');
  assert.equal(context.readCardThumbnail(card({ thumbnail: '', video: { poster: 'https://cdn.example/poster.jpg' } })), 'https://cdn.example/poster.jpg');
  assert.equal(context.readCardThumbnail(card({ thumbnail: 'javascript:alert(1)' })), '');
  assert.equal(context.readCardThumbnail(card({ thumbnail: '' })), '');
});

test('metrics belong to the selected card, never its neighbors', () => {
  const { context } = runtime('content-status.js');
  const current = card({ views: '91,8 mil', likes: '1.394' });
  current.parentElement = { innerText: '1,6 mi\n91,8 mil\n34,1 mil' };
  assert.equal(context.readCardMetric(current, 'views'), 91800);
  assert.equal(context.readCardMetric(current, 'likes'), 1394);
  assert.equal(context.readCardMetric(card({ views: '23 mil', labeled: false }), 'views'), 23000);
  assert.equal(context.readCardMetric(card({ views: '23 mil', labeled: false }), 'likes'), 0);
  assert.equal(context.readCardMetric(card({ views: 'Caption with 2026 inside', labeled: false }), 'views'), 0);
});

test('profile scan returns exactly five distinct cards with their own covers', async () => {
  const cards = Array.from({ length: 10 }, (_, i) => card({ id: `scene${i}`, thumbnail: `https://cdn.example/${i}.jpg`, views: `${i + 1} mil` }));
  const { context, stats } = runtime('content-status.js', cards);
  const result = await context.collectInstagramProfile({ username: 'channel', limit: 5, sortBy: 'recent', period: 'all' });
  assert.equal(result.items.length, 5);
  assert.equal(stats.scrolls, 0);
  for (const [i, item] of result.items.entries()) {
    assert.equal(item.thumbnail, `https://cdn.example/${i}.jpg`);
    assert.equal(item.view_count, (i + 1) * 1000);
    assert.equal(item.url, `https://www.instagram.com/channel/reel/scene${i}/`);
    assert.equal(item.media_url, '');
    assert.equal(item.preview_url, '');
  }
});

test('profile scan waits for the media grid and stops waiting on empty pages', async () => {
  const { context, document, stats } = runtime('content-status.js');
  let queries = 0;
  document.querySelectorAll = () => ++queries < 3 ? [] : [card()];
  const result = await context.collectInstagramProfile({ username: 'channel', limit: 1, sortBy: 'recent', period: 'all' });
  assert.equal(result.items.length, 1);
  assert.equal(stats.delays.length, 2);
  const empty = runtime('content-status.js');
  const none = await empty.context.collectInstagramProfile({ username: 'channel', limit: 5, sortBy: 'recent', period: 'all' });
  assert.equal(none.items.length, 0);
  assert.ok(empty.stats.delays.length <= 44);
});

test('popup scan accepts username-prefixed Reels and does not treat covers as MP4', async () => {
  const cards = Array.from({ length: 6 }, (_, i) => card({ id: `popup${i}`, views: '91,8 mil' }));
  const { context } = runtime('popup.js', cards);
  const result = await context.collectVisibleMedia(5);
  assert.equal(result.items.length, 5);
  for (const item of result.items) {
    assert.equal(item.thumbnail, 'https://cdn.example/cover.jpg');
    assert.equal(item.media_url, '');
    assert.equal(item.media_type, 'video');
    assert.equal(item.view_count, 91800);
    assert.equal(item.like_count, 0);
  }
});

test('real video preview URLs remain intact; blob URLs never leave the page', async () => {
  for (const file of ['popup.js', 'content-status.js']) {
    const { context } = runtime(file, [
      card({ id: 'direct', video: { currentSrc: 'https://cdn.example/clip.mp4', duration: 12 } }),
      card({ id: 'blob', video: { currentSrc: 'blob:https://www.instagram.com/local-video' } }),
    ]);
    const result = file === 'popup.js' ? await context.collectVisibleMedia(2)
      : await context.collectInstagramProfile({ username: 'channel', limit: 2, sortBy: 'recent', period: 'all' });
    assert.equal(result.items[0].media_url, 'https://cdn.example/clip.mp4');
    assert.equal(result.items[0].preview_url, 'https://cdn.example/clip.mp4');
    assert.equal(result.items[1].media_url, '');
    assert.equal(result.items[1].preview_url, '');
  }
});

test('five-item option exists in both interfaces and dashboard covers load lazily', () => {
  const page = readFileSync(new URL('../src/modules/bulk-download/pages/BulkDownload.jsx', import.meta.url), 'utf8');
  assert.match(page, /\[5,\s*10,\s*25,\s*50,\s*75,\s*100\]/);
  assert.match(page, /loading="lazy" decoding="async"/);
  assert.match(source('popup.html'), /<option value="5">5[^<]*<\/option>/);
});

test('extension release includes every referenced icon and no broader host access', () => {
  const manifest = JSON.parse(source('manifest.json'));
  assert.equal(manifest.version, '1.5.3');
  assert.equal(manifest.background.service_worker, 'background.js');
  assert.deepEqual(manifest.host_permissions, ['https://app.hfnew.com.br/*', 'https://www.instagram.com/*']);
  for (const icon of Object.values(manifest.icons)) assert.ok(existsSync(new URL(icon, extension)), icon);
  for (const script of manifest.content_scripts.flatMap((entry) => entry.js)) assert.ok(existsSync(new URL(script, extension)), script);
});

test('media resolver keeps the selected Reel and ignores blob video sources', async () => {
  const background = vm.createContext({
    URL,
    Date,
    setTimeout(callback) { callback(); },
    chrome: { runtime: { onMessage: { addListener() {} } } },
  });
  vm.runInContext(source('background.js'), background);
  assert.equal(background.normalizeInstagramMediaUrl('https://www.instagram.com/reel/ABC123/?utm_source=test'), 'https://www.instagram.com/reel/ABC123/');
  assert.equal(background.normalizeInstagramMediaUrl('https://instagram.com.evil.invalid/reel/ABC123/'), '');
  assert.equal(background.normalizeInstagramMediaUrl('https://www.instagram.com:8443/reel/ABC123/'), '');
  const document = {
    title: 'Cena escolhida',
    querySelectorAll: () => [{ currentSrc: 'blob:https://www.instagram.com/video', src: 'https://scontent.cdninstagram.com/cena.mp4', duration: 9, poster: '', querySelector: () => null }],
    querySelector: () => null,
  };
  const media = vm.createContext({ document, setTimeout(callback) { callback(); } });
  vm.runInContext(`const extract = ${background.extractInstagramMedia.toString()};`, media);
  const result = await vm.runInContext('extract()', media);
  assert.equal(result.media_url, 'https://scontent.cdninstagram.com/cena.mp4');
});

test('media resolver acknowledges the request before opening Instagram', () => {
  let listener;
  let response;
  let tabOpened = false;
  const context = vm.createContext({
    URL,
    Date,
    setInterval() { return 1; },
    clearInterval() {},
    chrome: {
      runtime: { onMessage: { addListener(callback) { listener = callback; } } },
      storage: { local: { set: async () => undefined } },
      tabs: { create() { tabOpened = true; return new Promise(() => {}); } },
    },
  });
  vm.runInContext(source('background.js'), context);
  listener({ type: 'HF_BULK_RESOLVE_MEDIA_BATCH', payload: {
    requestId: 'request-1', items: [{ url: 'https://www.instagram.com/reel/ABC123/' }],
  } }, { url: 'https://app.hfnew.com.br/bulk-download' }, (value) => { response = value; });
  assert.equal(response?.accepted, true);
  assert.equal(tabOpened, false);
});

test('media resolver rejects a sender with a lookalike app hostname', () => {
  let listener;
  const context = vm.createContext({
    URL,
    chrome: { runtime: { onMessage: { addListener(callback) { listener = callback; } } } },
  });
  vm.runInContext(source('background.js'), context);
  let response;
  listener({ type: 'HF_BULK_RESOLVE_MEDIA_BATCH', payload: {
    requestId: 'request-1', items: [{ url: 'https://www.instagram.com/reel/ABC123/' }],
  } }, { url: 'https://app.hfnew.com.br.evil.invalid/' }, (value) => { response = value; });
  assert.equal(response?.accepted, false);
});

test('media resolver closes its temporary tab after preparing the selected Reel', async () => {
  const updates = [];
  const removed = [];
  let heartbeatCleared = false;
  const context = vm.createContext({
    URL,
    Date,
    setInterval() { return 1; },
    clearInterval() { heartbeatCleared = true; },
    chrome: {
      runtime: { onMessage: { addListener() {} } },
      storage: { local: {
        set: async (value) => { updates.push(value.hfBulkLastMediaResolve); },
        get: async () => ({}),
      } },
      tabs: {
        create: async () => ({ id: 7 }),
        get: async () => ({ status: 'complete', url: 'https://www.instagram.com/reel/ABC123/' }),
        remove: async (id) => { removed.push(id); },
      },
      scripting: { executeScript: async () => [{ result: {
        media_url: 'https://scontent.cdninstagram.com/ABC123.mp4',
      } }] },
    },
  });
  vm.runInContext(source('background.js'), context);
  await context.resolveBatch({ requestId: 'request-2', items: [{ url: 'https://www.instagram.com/reel/ABC123/' }] });
  assert.equal(updates.at(-1).status, 'success');
  assert.equal(updates.at(-1).results[0].media_url, 'https://scontent.cdninstagram.com/ABC123.mp4');
  assert.deepEqual(removed, [7]);
  assert.equal(heartbeatCleared, true);
});

test('extension returns the resolved Reel to the same HUB request', async () => {
  const stored = {};
  const posted = [];
  let receiveAppMessage;
  let storageChanged;
  const window = {
    location: { hostname: 'app.hfnew.com.br', origin: 'https://app.hfnew.com.br' },
    addEventListener(_type, callback) { receiveAppMessage = callback; },
    postMessage(message) { posted.push(message); },
  };
  const context = vm.createContext({
    URL,
    Date,
    window,
    chrome: {
      runtime: { getManifest: () => ({ version: '1.5.3' }), sendMessage: async () => ({ accepted: true }) },
      storage: {
        local: {
          get: async (keys) => Object.fromEntries(keys.filter((key) => key in stored).map((key) => [key, stored[key]])),
          set: async (values) => {
            Object.assign(stored, values);
            storageChanged(Object.fromEntries(Object.keys(values).map((key) => [key, {}])), 'local');
          },
        },
        onChanged: { addListener(callback) { storageChanged = callback; } },
      },
    },
  });
  vm.runInContext(source('content-status.js'), context);
  receiveAppMessage({ source: window, data: {
    source: 'HF_NEW_CONTROL_HUB', type: 'HF_BULK_RESOLVE_MEDIA',
    payload: { requestId: 'request-3', items: [{ url: 'https://www.instagram.com/reel/ABC123/' }] },
  } });
  stored.hfBulkLastMediaResolve = {
    requestId: 'request-3', status: 'success', checkedAt: new Date().toISOString(),
    results: [{ url: 'https://www.instagram.com/reel/ABC123/', status: 'resolved', media_url: 'https://scontent.cdninstagram.com/ABC123.mp4' }],
  };
  storageChanged({ hfBulkLastMediaResolve: {} }, 'local');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(posted.some((message) => message.payload?.lastMediaResolve?.requestId === 'request-3'));
  assert.ok(posted.some((message) => message.payload?.lastMediaResolve?.results?.[0]?.media_url === 'https://scontent.cdninstagram.com/ABC123.mp4'));
});

test('individual Save chooses a destination and downloads the finished job automatically', () => {
  const page = readFileSync(new URL('../src/modules/bulk-download/pages/BulkDownload.jsx', import.meta.url), 'utf8');
  assert.match(page, /fileHandle = await window\.showSaveFilePicker/);
  assert.match(page, /queueItems\(\[item\], `save:\$\{item\.url\}`, \{ autoSave: true, fileHandle \}\)/);
  assert.match(page, /job\.status === 'completed'[\s\S]*?saveBulkDownloadFile\(job, \{ fileHandle, skipPicker: true \}\)/);
  assert.match(page, /if \(queueInFlightRef\.current\) return;/);
});

test('selected destination receives streamed bytes, without a second page or Blob', async () => {
  const service = readFileSync(new URL('../src/modules/bulk-download/services/bulkDownloadApi.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/m, '').replace(/^export /gm, '');
  const writes = [];
  let closed = false;
  const context = vm.createContext({
    apiUrl: (path) => path,
    window: { localStorage: { getItem: () => 'test-token' } },
    fetch: async () => ({
      ok: true,
      headers: { get: () => 'video/mp4' },
      body: { getReader: () => {
        let done = false;
        return { read: async () => {
          if (done) return { done: true };
          done = true;
          return { done: false, value: new Uint8Array([0, 1, 2, 3]) };
        } };
      } },
    }),
    document: { createElement() { throw new Error('unexpected browser download'); } },
  });
  vm.runInContext(service, context);
  const fileHandle = { name: 'meu-video.mp4', createWritable: async () => ({
    write: async (value) => { writes.push(...value); },
    close: async () => { closed = true; },
  }) };
  const result = await context.saveBulkDownloadFile({ id: 'abc', filename: 'server.mp4' }, { fileHandle, skipPicker: true });
  assert.deepEqual(writes, [0, 1, 2, 3]);
  assert.equal(closed, true);
  assert.equal(result.filename, 'meu-video.mp4');
});

test('only Instagram is available; TikTok is visibly coming soon', () => {
  assert.deepEqual(PROFILE_PLATFORMS, [
    { value: 'instagram', label: 'Instagram', disabled: false },
    { value: 'tiktok', label: 'TikTok (em breve)', disabled: true },
  ]);
  const page = readFileSync(new URL('../src/modules/bulk-download/pages/BulkDownload.jsx', import.meta.url), 'utf8');
  assert.match(page, /<option[^>]*disabled=\{disabled\}/);
  assert.doesNotMatch(page, /Object\.(entries|values)\(PLATFORM_LABELS\)/);
  assert.doesNotMatch(page, /https:\/\/www\.(tiktok|facebook|pinterest|kwai)\.com/);
  assert.equal(PLATFORM_LABELS.facebook, 'Facebook');
});

test('new link searches accept Instagram, not other networks or lookalike hosts', () => {
  for (const url of ['https://www.instagram.com/reel/example/', 'https://instagram.com/p/example/', 'http://m.instagram.com/example/']) {
    assert.equal(isInstagramUrl(url), true, url);
  }
  for (const url of ['https://www.tiktok.com/@example/video/123', 'https://www.facebook.com/reel/123',
    'https://www.pinterest.com/pin/123', 'https://www.kwai.com/@example',
    'https://instagram.com.evil.example/reel/123', 'https://notinstagram.com/reel/123',
    'https://instagram.com@evil.example/reel/123', 'ftp://instagram.com/example', 'not a url']) {
    assert.equal(isInstagramUrl(url), false, url);
  }
});
