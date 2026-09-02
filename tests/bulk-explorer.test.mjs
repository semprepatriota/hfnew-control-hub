import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

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
  assert.equal(manifest.version, '1.3.1');
  assert.deepEqual(manifest.host_permissions, ['https://app.hfnew.com.br/*', 'https://www.instagram.com/*']);
  for (const icon of Object.values(manifest.icons)) assert.ok(existsSync(new URL(icon, extension)), icon);
  for (const script of manifest.content_scripts.flatMap((entry) => entry.js)) assert.ok(existsSync(new URL(script, extension)), script);
});
