import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const file = name => readFileSync(new URL(`../extension/hf-bulk-explorer/${name}`, import.meta.url), 'utf8');
const POST = 'https://www.instagram.com/reel/CHOSEN/';
const MP4 = 'https://scontent.cdninstagram.com/chosen.mp4?token=keep';
function runtime(chrome = {}) {
  const context = vm.createContext({ URL, Date, setTimeout, clearTimeout, setInterval, clearInterval,
    chrome: { ...chrome, runtime: { onMessage: { addListener() {} } } } });
  vm.runInContext(file('background.js'), context);
  return context;
}
function extract({ scripts = [], videos = [], canonical = '', meta = '', href = POST, login = false, containers = [] } = {}) {
  const document = {
    title: 'Chosen Reel',
    querySelector(selector) {
      if (selector.includes('accounts/login')) return login ? {} : null;
      if (selector === 'link[rel="canonical"]') return canonical ? { href: canonical } : null;
      if (selector.startsWith('meta[property="og:video')) return meta ? { content: meta } : null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes('script[')) return scripts.map(value => ({ textContent: typeof value === 'string' ? value : JSON.stringify(value) }));
      if (selector === 'video') return videos;
      if (selector === 'article, [role="dialog"]') return containers;
      return [];
    },
  };
  const context = vm.createContext({ URL, document, window: { location: { href, origin: 'https://www.instagram.com' } }, setTimeout(callback) { callback(); } });
  vm.runInContext(`const extract = ${runtime().extractInstagramMedia.toString()};`, context);
  return vm.runInContext(`extract(${JSON.stringify(POST)}).then(result => { if (result.error) throw new Error(result.error); return result; })`, context);
}
const video = (src = 'blob:https://www.instagram.com/session') => ({ currentSrc: src, src: '', poster: '', duration: 9, querySelector: () => null });

test('blob player is resolved from the selected shortcode JSON, not a neighboring post', async () => {
  const result = await extract({ videos: [video()], scripts: [{ data: { items: [
    { code: 'NEIGHBOR', video_versions: [{ url: 'https://scontent.cdninstagram.com/wrong.mp4', width: 1080 }] },
    { code: 'CHOSEN', video_versions: [{ url: MP4, width: 1080, height: 1920 }], video_duration: 12 },
  ] } }] });
  assert.equal(result.media_url, MP4);
  assert.equal(result.source_shortcode, 'CHOSEN');
  assert.equal(result.resolved_via, 'post_json');
  assert.equal(result.duration, 12);
});

test('best progressive version is selected without stripping authentication query parameters', async () => {
  const result = await extract({ scripts: [{ shortcode: 'CHOSEN', video_versions: [
    { url: 'https://scontent.cdninstagram.com/small.mp4', width: 320, height: 480 },
    { url: MP4, width: 1080, height: 1920 },
  ] }] });
  assert.equal(result.media_url, MP4);
});

test('JSON-LD requires the matching post URL, not just any VideoObject on the page', async () => {
  const result = await extract({ scripts: [{ '@type': 'VideoObject', url: POST, contentUrl: MP4 }] });
  assert.equal(result.media_url, MP4);
  await assert.rejects(extract({ scripts: [{ '@type': 'VideoObject', url: 'https://www.instagram.com/reel/OTHER/', contentUrl: MP4 }] }), /nao disponibilizou/);
});

test('redirect to a profile or another Reel never reports a resolved MP4', async () => {
  for (const href of ['https://www.instagram.com/channel/', 'https://www.instagram.com/reel/OTHER/']) {
    await assert.rejects(extract({ href, meta: MP4 }), /outro perfil ou publicacao/);
  }
});

test('login requirement is reported instead of exporting a login page', async () => {
  await assert.rejects(extract({ login: true }), /pediu login/);
});

test('ambiguous preloaded feed videos are not accepted as the selected Reel', async () => {
  await assert.rejects(extract({ videos: [video(MP4), video('https://scontent.cdninstagram.com/neighbor.mp4')] }), /nao disponibilizou/);
});

test('matching article selects its own player even if a neighboring player appears first', async () => {
  const container = { querySelectorAll: selector => selector === 'a[href]' ? [{ href: POST }] : [video(MP4)] };
  const result = await extract({ containers: [container], videos: [video('https://scontent.cdninstagram.com/wrong.mp4'), video(MP4)] });
  assert.equal(result.media_url, MP4);
});

test('stale OpenGraph for a different canonical post is not exported', async () => {
  await assert.rejects(extract({ canonical: 'https://www.instagram.com/reel/OTHER/', meta: MP4, videos: [video(MP4)] }), /nao disponibilizou/);
});

test('CDN URLs reject profiles, thumbnails, manifests, local addresses and lookalike hosts', async () => {
  const context = runtime();
  for (const url of ['https://www.instagram.com/channel/', 'https://scontent.cdninstagram.com/thumb.jpg', 'https://scontent.cdninstagram.com/video.mpd', 'https://scontent.cdninstagram.com/video.m3u8', 'https://cdninstagram.com.evil.example/v.mp4', 'https://127.0.0.1/v.mp4', 'blob:https://www.instagram.com/v']) {
    assert.equal(context.isInstagramVideoFile(url), false, url);
    await assert.rejects(extract({ scripts: [{ code: 'CHOSEN', video_url: url }] }), /nao disponibilizou/);
  }
});

test('malformed embedded JSON does not block a valid post-specific script', async () => {
  assert.equal((await extract({ scripts: ['{broken', { code: 'CHOSEN', video_url: MP4 }] })).media_url, MP4);
});

function tabsContext({ existing = false, redirected = false } = {}) {
  const removed = [], updates = [], injections = [], listeners = new Set();
  const chrome = {
    tabs: {
      query: async () => existing ? [{ id: 4, url: POST }] : [],
      create: async options => { assert.equal(options.active, false); return { id: 9 }; },
      get: async () => ({ status: 'complete', url: redirected ? 'https://www.instagram.com/reel/OTHER/' : POST }),
      remove: async id => { removed.push(id); },
      onUpdated: { addListener(listener) { listeners.add(listener); }, removeListener(listener) { listeners.delete(listener); } },
    },
    storage: { local: { get: async () => ({}), set: async data => { updates.push(data); } } },
    scripting: { executeScript: async options => { injections.push(options); return [{ result: { media_url: MP4, source_shortcode: 'CHOSEN' } }]; } },
  };
  return { context: runtime(chrome), removed, updates, injections, listeners };
}

test('existing user tab is reused and never closed, while the script receives the requested URL', async () => {
  const state = tabsContext({ existing: true });
  assert.equal((await state.context.resolveOne({ url: POST })).status, 'resolved');
  assert.deepEqual(state.removed, []);
  assert.equal(state.injections[0].target.tabId, 4);
  assert.equal(state.injections[0].args[0], POST);
  assert.equal(state.listeners.size, 0);
});

test('only temporary extension tabs are closed, also on wrong-post redirects', async () => {
  const state = tabsContext({ redirected: true });
  assert.equal((await state.context.resolveOne({ url: POST })).status, 'failed');
  assert.deepEqual(state.removed, [9]);
  assert.equal(state.injections.length, 0);
});

test('load-complete race is handled by registering the listener before reading tab status', async () => {
  const state = tabsContext();
  const original = state.context.chrome.tabs.get;
  state.context.chrome.tabs.get = async id => {
    for (const listener of state.listeners) listener(id, { status: 'complete' });
    return original(id);
  };
  assert.equal((await state.context.resolveOne({ url: POST })).status, 'resolved');
  assert.equal(state.listeners.size, 0);
});

test('batch result is stored under its request ID as well as the legacy compatibility key', async () => {
  const state = tabsContext();
  await state.context.resolveBatch({ requestId: 'request-isolated', items: [{ url: POST }] });
  const last = state.updates.at(-1);
  assert.equal(last['hfBulkMediaResolve:request-isolated'].status, 'success');
  assert.equal(last.hfBulkLastMediaResolve.results[0].media_url, MP4);
});

test('Chrome injected diagnostic is propagated instead of replacing it with a generic media error', async () => {
  const state = tabsContext();
  state.context.chrome.scripting.executeScript = async () => [{ result: { error: 'O Instagram pediu login.' } }];
  const result = await state.context.resolveOne({ url: POST });
  assert.equal(result.status, 'failed');
  assert.equal(result.error, 'O Instagram pediu login.');
  assert.deepEqual(state.removed, [9]);
});

test('the service worker rejects a result associated with a different shortcode', async () => {
  const state = tabsContext();
  state.context.chrome.scripting.executeScript = async () => [{ result: { media_url: MP4, source_shortcode: 'OTHER' } }];
  const result = await state.context.resolveOne({ url: POST });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /nao corresponde/);
});

test('result history is bounded without deleting other extension settings', async () => {
  const state = tabsContext();
  const stored = Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`hfBulkMediaResolve:old-${index}`, { checkedAt: String(index).padStart(3, '0') }]));
  stored.hfInstagramBrowserStatus = { open: true };
  stored.unrelatedSetting = 'preserve';
  let removed;
  state.context.chrome.storage.local.get = async () => stored;
  state.context.chrome.storage.local.remove = async keys => { removed = keys; };
  await state.context.resolveBatch({ requestId: 'latest', items: [{ url: POST }] });
  assert.equal(removed.length, 5);
  assert.ok(removed.every(key => key.startsWith('hfBulkMediaResolve:')));
  assert.ok(!removed.includes('unrelatedSetting'));
});

test('HUB retrieves its own final result even if another HUB tab replaced the legacy last result', async () => {
  const stored = {}, posted = [];
  let receive, changed;
  const window = { location: { hostname: 'app.hfnew.com.br', origin: 'https://app.hfnew.com.br' },
    addEventListener(_type, listener) { receive = listener; }, postMessage(data) { posted.push(data); } };
  const context = vm.createContext({ URL, Date, window, chrome: {
    runtime: { getManifest: () => ({ version: '1.6.0' }), sendMessage: async () => ({ accepted: true }) },
    storage: { local: { get: async keys => Object.fromEntries(keys.filter(key => key in stored).map(key => [key, stored[key]])), set: async () => {} },
      onChanged: { addListener(listener) { changed = listener; } } },
  } });
  vm.runInContext(file('content-status.js'), context);
  receive({ source: window, data: { source: 'HF_NEW_CONTROL_HUB', type: 'HF_BULK_RESOLVE_MEDIA', payload: { requestId: 'mine', items: [{ url: POST }] } } });
  stored.hfBulkLastMediaResolve = { requestId: 'other', status: 'error' };
  stored['hfBulkMediaResolve:mine'] = { requestId: 'mine', status: 'success', results: [{ url: POST, media_url: MP4 }] };
  changed({ 'hfBulkMediaResolve:mine': { newValue: stored['hfBulkMediaResolve:mine'] } }, 'local');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(posted.some(data => data.payload?.lastMediaResolve?.requestId === 'mine' && data.payload.lastMediaResolve.status === 'success'));
});
