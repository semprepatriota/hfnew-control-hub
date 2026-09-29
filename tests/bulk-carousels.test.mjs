import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { carouselItemKey, carouselSelection, normalizeCarouselUrl, supportsCarousels, validateCarousel } from '../src/modules/bulk-download/services/bulkCarousels.js';

const source = readFileSync(new URL('../extension/hf-bulk-explorer/carousel.js', import.meta.url), 'utf8');
const URL_POST = 'https://www.instagram.com/p/DczgX35ltDO/';
const image = (n) => `https://scontent.cdninstagram.com/${n}.jpg`;

function carouselRuntime({ count = 6, initial = 0, sameImage = false, frozen = false, videoIndex = -1, blob = false } = {}) {
  let active = initial;
  let clicks = 0;
  const bounds = { left: 0, top: 0, right: 500, bottom: 600, width: 500, height: 600 };
  const button = (direction) => ({ disabled: false, parentElement: root,
    getAttribute: (name) => name === 'aria-label' ? direction === 1 ? 'Avancar' : 'Voltar' : '',
    click() { clicks += 1; if (!frozen) active += direction; },
  });
  const root = {
    getBoundingClientRect: () => bounds,
    querySelector: () => ({}),
    querySelectorAll(selector) {
      if (selector === 'li') return Array.from({ length: count }, (_, i) => {
        const element = { tagName: i === videoIndex ? 'VIDEO' : 'IMG',
          currentSrc: i === videoIndex ? blob ? 'blob:https://www.instagram.com/local' : 'https://scontent.cdninstagram.com/clip.mp4' : image(sameImage ? 1 : i),
          poster: image(i), complete: true, naturalWidth: 1320, duration: 4,
          getBoundingClientRect: () => ({ ...bounds, left: (i - active) * 500, right: (i - active + 1) * 500 }),
        };
        return { style: { transform: `translateX(${i * 500}px)` }, querySelector: (s) => s === 'video' ? i === videoIndex ? element : null : element };
      });
      return [...(active > 0 ? [button(-1)] : []), ...(active < count - 1 ? [button(1)] : [])];
    },
  };
  const doc = { querySelector: () => root };
  const context = vm.createContext({ URL, Date, setTimeout(callback) { callback(); } });
  vm.runInContext(source, context);
  return { collector: context.HFCarousel, root, doc, location: { href: URL_POST }, clicks: () => clicks };
}

test('post link validation accepts canonical and username-prefixed links, rejects other targets', () => {
  const { collector } = carouselRuntime();
  for (const raw of [URL_POST, 'https://instagram.com/name/p/DczgX35ltDO/?img_index=4']) {
    assert.equal(normalizeCarouselUrl(raw), URL_POST);
    assert.equal(collector.postUrl(raw), URL_POST);
  }
  for (const raw of ['https://instagram.com/reel/ABC/', 'https://instagram.com:444/p/a/', 'https://instagram.com@evil.test/p/a/',
    'https://instagram.com.evil.test/p/a/', 'javascript:alert(1)', 'http://instagram.com/p/a/']) {
    assert.equal(normalizeCarouselUrl(raw), '');
    assert.equal(collector.postUrl(raw), '');
  }
});

test('collector reads every slide, including carousels longer than ten, in original order', async () => {
  const runtime = carouselRuntime({ count: 16, initial: 4 });
  const result = await runtime.collector.collect({ url: URL_POST }, runtime);
  assert.equal(result.total_items, 16);
  assert.equal(result.scan_complete, true);
  assert.equal(runtime.clicks(), 19);
  assert.deepEqual(Array.from(result.children, (item) => item.position), Array.from({ length: 16 }, (_, i) => i + 1));
  assert.deepEqual(Array.from(result.children, (item) => item.media_url), Array.from({ length: 16 }, (_, i) => image(i)));
});

test('off-screen preloaded images do not replace the current slide', () => {
  const runtime = carouselRuntime({ initial: 3 });
  assert.equal(runtime.collector.currentFrame(runtime.root).media_url, image(3));
});

test('two slides reusing the same media remain separate positions', async () => {
  const runtime = carouselRuntime({ sameImage: true });
  const result = await runtime.collector.collect({ url: URL_POST }, runtime);
  assert.equal(result.children.length, 6);
  assert.notEqual(carouselItemKey(result, result.children[0]), carouselItemKey(result, result.children[1]));
});

test('mixed carousels preserve videos and never substitute an image for a blob MP4', async () => {
  for (const blob of [true, false]) {
    const runtime = carouselRuntime({ videoIndex: 2, blob });
    const result = await runtime.collector.collect({ url: URL_POST }, runtime);
    assert.equal(result.children[2].media_type, 'video');
    assert.equal(result.children[2].media_url, blob ? '' : 'https://scontent.cdninstagram.com/clip.mp4');
    assert.equal(Boolean(result.children[2].capture_error), blob);
  }
});

test('stalled, cancelled, single-image, oversized or wrong-post scans do not return success', async () => {
  for (const options of [{ frozen: true }, { count: 51 }, { count: 1 }]) {
    const runtime = carouselRuntime(options);
    await assert.rejects(runtime.collector.collect({ url: URL_POST }, runtime));
  }
  const runtime = carouselRuntime();
  await assert.rejects(runtime.collector.collect({ url: URL_POST }, { ...runtime, cancelled: () => true }), /cancelada/);
  await assert.rejects(runtime.collector.collect({ url: 'https://www.instagram.com/p/OTHER/' }, runtime), /corresponde/);
});

test('URL, continuity and selection checks prevent merged or silently incomplete carousels', async () => {
  const runtime = carouselRuntime();
  const post = JSON.parse(JSON.stringify(await runtime.collector.collect({ url: URL_POST }, runtime)));
  assert.equal(validateCarousel(post), true);
  assert.equal(validateCarousel({ ...post, scan_complete: false }), false);
  assert.equal(validateCarousel({ ...post, children: post.children.slice(0, 5) }), false);
  assert.equal(validateCarousel({ ...post, children: [...post.children.slice(1), post.children[1]] }), false);
  const chosen = new Set([carouselItemKey(post, post.children[0]), carouselItemKey(post, post.children[4])]);
  const payload = carouselSelection([post], chosen);
  assert.equal(payload[0].children.length, 6);
  assert.deepEqual(payload[0].children.filter((c) => c.selected).map((c) => c.position), [1, 5]);
  assert.deepEqual(carouselSelection([post], new Set()), []);
});

test('unsupported extension versions cannot start carousels and existing permission scope is retained', () => {
  for (const version of [null, '1.2.1', '1.3.0', '1.3.1']) assert.equal(supportsCarousels(version), false);
  for (const version of ['1.4.0', '1.4.1', '2.0.0']) assert.equal(supportsCarousels(version), true);
  const manifest = JSON.parse(readFileSync(new URL('../extension/hf-bulk-explorer/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);
  assert.deepEqual(manifest.content_scripts[0].js, ['carousel.js', 'content-status.js']);
  assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage|fetch\(/);
});

test('carousel results are delivered only to the tab that requested them', async () => {
  const messages = [];
  const last = { requestId: 'own-request', status: 'success', post: { url: URL_POST } };
  const context = vm.createContext({ URL, Date, chrome: {
    storage: { local: { get: async () => ({ hfBulkLastCarousel: last }) } },
    runtime: { getManifest: () => ({ version: '1.4.0' }) },
  }, window: { location: { hostname: 'test.invalid', origin: 'https://app.hfnew.com.br' },
    postMessage: (message) => messages.push(message) } });
  vm.runInContext(readFileSync(new URL('../extension/hf-bulk-explorer/content-status.js', import.meta.url), 'utf8'), context);
  await context.postStatusToApp();
  assert.equal(messages.at(-1).payload.lastCarousel, null);
  vm.runInContext("appCarouselRequestId = 'different-tab';", context);
  await context.postStatusToApp();
  assert.equal(messages.at(-1).payload.lastCarousel, null);
  vm.runInContext("appCarouselRequestId = 'own-request';", context);
  await context.postStatusToApp();
  assert.equal(messages.at(-1).payload.lastCarousel.requestId, 'own-request');
});
