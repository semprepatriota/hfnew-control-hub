import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deleteForgeMaxClips,
  downloadForgeMaxClipsArchive,
  forgeMaxClipsArchiveUrl,
  pruneForgeMaxClipSelection,
} from '../src/modules/forge-max/services/forgeMaxApi.js';

function mockFetch(context, handler) {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = { localStorage: { getItem() { return 'mock-auth'; } } };
  globalThis.fetch = handler;
  context.after(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow; });
}

const video = { id: 'video/id', media_key: 'media+key' };

test('selected ZIP POST uses apiFetch authentication, JSON key/IDs and leaves response body streaming', async (context) => {
  const response = new Response('PK', { headers: { 'content-type': 'application/zip' } });
  mockFetch(context, async (url, options) => {
    assert.ok(url.endsWith('/videos/video%2Fid/clips/download-selected'));
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.get('Authorization'), 'Bearer mock-auth');
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    assert.deepEqual(JSON.parse(options.body), { key: 'media+key', clip_ids: ['clip-a', 'clip-b'] });
    return response;
  });
  const result = await downloadForgeMaxClipsArchive(video, ['clip-a', 'clip-b', 'clip-a']);
  assert.equal(result, response);
  assert.equal(result.bodyUsed, false);
});

test('all-clips ZIP keeps existing GET keyed contract', async (context) => {
  mockFetch(context, async (url, options) => {
    assert.equal(url, forgeMaxClipsArchiveUrl(video));
    assert.equal(new URL(url).searchParams.get('key'), video.media_key);
    assert.equal(options.method, undefined);
    assert.equal(options.headers.get('Authorization'), 'Bearer mock-auth');
    return new Response('PK', { headers: { 'content-type': 'application/zip' } });
  });
  await downloadForgeMaxClipsArchive(video);
});

test('600 selected IDs use one authenticated POST, not an oversized query URL', async (context) => {
  const ids = Array.from({ length: 600 }, (_, i) => `clip-${i}`);
  mockFetch(context, async (url, options) => {
    assert.ok(url.length < 200);
    assert.equal(JSON.parse(options.body).clip_ids.length, 600);
    return new Response('PK');
  });
  await downloadForgeMaxClipsArchive(video, ids);
});

test('selected legacy GET URL repeats and encodes clip_ids; missing keys and empty selections fail', () => {
  const url = new URL(forgeMaxClipsArchiveUrl(video, ['clip/+?', 'clip-two', 'clip-two']));
  assert.deepEqual(url.searchParams.getAll('clip_ids'), ['clip/+?', 'clip-two']);
  assert.equal(forgeMaxClipsArchiveUrl({ id: 'no-key' }), '');
  assert.throws(() => downloadForgeMaxClipsArchive({ id: 'no-key' }), /sem chave/);
  assert.throws(() => downloadForgeMaxClipsArchive(video, []), /Selecione/);
});

test('serial deletion continues after a failure, skips extracting clips, deduplicates and reports exact successes', async (context) => {
  const calls = [];
  const progress = [];
  let inFlight = 0;
  mockFetch(context, async (url, options) => {
    assert.equal(options.method, 'DELETE');
    assert.equal(inFlight++, 0, 'deletions must be serial');
    const id = decodeURIComponent(url.split('/').at(-1));
    calls.push(id);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight -= 1;
    return new Response(JSON.stringify(id === 'failed' ? { detail: 'Permission denied' } : { deleted: true }), {
      status: id === 'failed' ? 403 : 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const result = await deleteForgeMaxClips(video.id, [
    { id: 'first', status: 'ready' },
    { id: 'failed', title: 'Failed clip', status: 'ready' },
    { id: 'extracting', status: 'extracting' },
    { id: 'last', status: 'error' },
    { id: 'first', status: 'ready' },
  ], (value) => progress.push(value));
  assert.deepEqual(calls, ['first', 'failed', 'last']);
  assert.deepEqual(result.deletedIds, ['first', 'last']);
  assert.equal(result.failures.length, 2);
  assert.equal(result.failures[0].error, 'Permission denied');
  assert.equal(result.failures[1].id, 'extracting');
  assert.deepEqual(progress.filter((item) => item.deletedId).map((item) => item.deletedId), ['first', 'last']);
  assert.deepEqual(progress.at(-1), { deletedId: 'last', completed: 4, deleted: 2, failed: 2 });
});

test('all failed deletions report zero success and retain selectable IDs', async (context) => {
  mockFetch(context, async () => { throw new Error('Offline'); });
  const clips = [{ id: 'a', status: 'ready' }, { id: 'b', status: 'cancelled' }];
  const result = await deleteForgeMaxClips(video.id, clips);
  assert.deepEqual(result.deletedIds, []);
  assert.equal(result.failures.length, 2);
  assert.deepEqual(pruneForgeMaxClipSelection(['a', 'b'], clips, video.id, video.id), ['a', 'b']);
});

test('clip selection resets on video switch and prunes deleted or newly extracting clips only', () => {
  const clips = [{ id: 'keep', status: 'ready' }, { id: 'error', status: 'error' }, { id: 'busy', status: 'extracting' }];
  assert.deepEqual(pruneForgeMaxClipSelection(['keep', 'gone', 'error', 'busy', 'keep'], clips, 'v1', 'v1'), ['keep', 'error']);
  assert.deepEqual(pruneForgeMaxClipSelection(['keep'], clips, 'v1', 'v2'), []);
});
