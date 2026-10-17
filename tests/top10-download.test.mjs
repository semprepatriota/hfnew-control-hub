import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { saveTop10MP4 } from '../src/modules/top10/download.js';

const mp4 = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32000000086d646174', 'hex');
const render = { filename: 'top10_test.mp4', url: 'https://api.example/api/top10/media/project/top10_test.mp4?sig=abc', size: mp4.length };
function media(chunks = [mp4], headers = {}, status = 200) {
  return new Response(new ReadableStream({ start(controller) {
    chunks.forEach(chunk => controller.enqueue(chunk));
    controller.close();
  } }), { status, headers: { 'content-type': 'video/mp4', 'content-length': String(mp4.length), ...headers } });
}
function setup(overrides = {}) {
  const events = [], requests = [], received = [], anchors = [], progress = [];
  const writable = {
    async write(chunk) { received.push(Buffer.from(chunk)); },
    async close() { events.push('closed'); },
    async abort() { events.push('aborted'); },
  };
  const options = {
    render, onProgress: value => progress.push(value),
    browser: { location: { href: 'https://app.example/top10' }, showSaveFilePicker() {
      events.push('picker');
      return Promise.resolve({ async createWritable() { return writable; } });
    } },
    document: {
      body: { appendChild() {} },
      createElement(tag) {
        assert.equal(tag, 'a');
        const anchor = { click() { events.push('download'); }, remove() { events.push('removed'); } };
        anchors.push(anchor);
        return anchor;
      },
    },
    async request(url, requestOptions) {
      requests.push({ url, ...requestOptions });
      events.push('request');
      return media();
    },
    ...overrides,
  };
  return { options, events, requests, received, anchors, progress, writable };
}

test('TOP10 picker opens before requests; MP4 saved exactly with progress 100 only after close', async () => {
  const context = setup({ request: async () => media([mp4.subarray(0, 5), mp4.subarray(5, 9), mp4.subarray(9)]) });
  const pending = saveTop10MP4(context.options);
  assert.equal(context.events[0], 'picker');
  assert.equal(await pending, 'saved');
  assert.deepEqual(Buffer.concat(context.received), mp4);
  assert.deepEqual(context.events, ['picker', 'closed']);
  assert.equal(context.progress.at(-1), 100);
});

for (const name of ['SecurityError', 'NotAllowedError', 'NotSupportedError']) {
  for (const sync of [false, true]) {
    test(`TOP10 ${name} (${sync ? 'sync' : 'async'}) falls back to validated signed attachment without another tab`, async () => {
      const context = setup();
      context.options.browser.showSaveFilePicker = () => {
        const error = new DOMException('blocked', name);
        if (sync) throw error;
        return Promise.reject(error);
      };
      assert.equal(await saveTop10MP4(context.options), 'started');
      assert.equal(context.requests[0].method, 'HEAD');
      assert.match(context.anchors[0].href, /sig=abc&download=true$/);
      assert.equal(context.anchors[0].download, render.filename);
      assert.equal(context.anchors[0].target, undefined);
      assert.deepEqual(context.events, ['request', 'download', 'removed']);
      assert.equal(context.received.length, 0);
    });
  }
}

test('TOP10 missing picker uses verified attachment, never claims the file was saved', async () => {
  const context = setup();
  delete context.options.browser.showSaveFilePicker;
  assert.equal(await saveTop10MP4(context.options), 'started');
  assert.ok(!context.events.includes('closed'));
});

test('TOP10 cancellation does not make a request or silently start a fallback download', async () => {
  const context = setup();
  context.options.browser.showSaveFilePicker = () => Promise.reject(new DOMException('cancelled', 'AbortError'));
  assert.equal(await saveTop10MP4(context.options), 'cancelled');
  assert.deepEqual(context.requests, []);
  assert.deepEqual(context.anchors, []);
});

test('TOP10 expired signed media URL renews once for the same MP4', async () => {
  const context = setup();
  let calls = 0;
  context.options.request = async (url) => {
    if (++calls === 1) return new Response('{"detail":"Link expirado"}', { status: 403 });
    assert.match(url, /sig=fresh$/);
    return media();
  };
  context.options.refreshRender = async () => ({ ...render, url: render.url.replace('abc', 'fresh') });
  assert.equal(await saveTop10MP4(context.options), 'saved');
  assert.equal(calls, 2);
});

test('TOP10 does not silently download a different render when refreshing an expired URL', async () => {
  const context = setup({ request: async () => new Response('', { status: 403 }), refreshRender: async () => ({ ...render, filename: 'other.mp4' }) });
  await assert.rejects(saveTop10MP4(context.options), /video exportado mudou/);
  assert.deepEqual(context.received, []);
});

test('TOP10 preserves backend error; never creates a file for JSON 404', async () => {
  const context = setup({ request: async () => new Response('{"detail":"Arquivo nao encontrado"}', { status: 404 }) });
  await assert.rejects(saveTop10MP4(context.options), /HTTP 404.*Arquivo nao encontrado/);
  assert.deepEqual(context.received, []);
  assert.ok(!context.events.includes('closed'));
});

test('TOP10 refuses partial HTTP 206 even if content-type is MP4', async () => {
  const context = setup({ request: async () => media([mp4], {}, 206) });
  await assert.rejects(saveTop10MP4(context.options), /MP4 completo/);
  assert.deepEqual(context.received, []);
});

test('TOP10 refuses HTML mislabeled as video/mp4 and discards the partial file', async () => {
  const context = setup({ render: { ...render, size: null }, request: async () => media([Buffer.from('<html>error</html>')], { 'content-length': '17' }) });
  await assert.rejects(saveTop10MP4(context.options), /nao e um MP4 valido/);
  assert.ok(context.events.includes('aborted'));
  assert.ok(!context.events.includes('closed'));
});

test('TOP10 truncated response is checked against render size even without Content-Length', async () => {
  const context = setup({ request: async () => media([mp4.subarray(0, 16)], { 'content-length': '' }) });
  await assert.rejects(saveTop10MP4(context.options), /Download incompleto/);
  assert.ok(context.events.includes('aborted'));
});

test('TOP10 size mismatch in headers is rejected before writing any bytes', async () => {
  const context = setup({ request: async () => media([mp4], { 'content-length': '999' }) });
  await assert.rejects(saveTop10MP4(context.options), /tamanho do MP4/);
  assert.deepEqual(context.received, []);
});

test('TOP10 interruption discards the file and keeps the button retryable', async () => {
  const context = setup({ request: async () => new Response(new ReadableStream({ pull() { throw new TypeError('connection reset'); } }), { headers: { 'content-type': 'video/mp4' } }) });
  await assert.rejects(saveTop10MP4(context.options), /conexao foi interrompida/);
  assert.ok(context.events.includes('aborted'));
  assert.ok(!context.events.includes('closed'));
});

test('TOP10 aborted transfer is an explicit failure, not silently treated as picker cancellation', async () => {
  const context = setup({ request: async () => new Response(new ReadableStream({ pull() { throw new DOMException('body aborted', 'AbortError'); } }), { headers: { 'content-type': 'video/mp4' } }) });
  await assert.rejects(saveTop10MP4(context.options), /transferencia do MP4 foi interrompida/);
  assert.ok(context.events.includes('aborted'));
  assert.ok(!context.events.includes('closed'));
});

test('TOP10 disk or security denial at final close is reported, never claimed as saved', async () => {
  const context = setup();
  context.writable.close = async () => { throw new DOMException('blocked on close', 'NotAllowedError'); };
  await assert.rejects(saveTop10MP4(context.options), /Windows nao permitiu salvar/);
  assert.notEqual(context.progress.at(-1), 100);
});

test('TOP10 failure to discard a partial file does not falsely report successful cleanup', async () => {
  const context = setup({ request: async () => media([mp4.subarray(0, 16)], { 'content-length': '' }) });
  context.writable.abort = async () => { throw new Error('disk failure'); };
  await assert.rejects(saveTop10MP4(context.options), /nao confirmou o descarte/);
});

test('TOP10 stalled body is stopped and discarded rather than freezing download forever', async () => {
  const context = setup({ idleTimeoutMs: 20, request: async () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'video/mp4' } }) });
  await assert.rejects(saveTop10MP4(context.options), /transferencia ficou sem resposta/);
  assert.ok(context.events.includes('aborted'));
});

test('TOP10 invalid render is rejected before the picker opens', async () => {
  const context = setup({ render: {} });
  await assert.rejects(saveTop10MP4(context.options), /Nenhum MP4/);
  assert.deepEqual(context.events, []);
});

test('TOP10 signed media bypasses central JSON timeout; refreshed metadata stays authenticated', () => {
  const api = readFileSync(new URL('../src/modules/top10/api.js', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/modules/top10/Top10.jsx', import.meta.url), 'utf8');
  assert.match(api, /request:.*fetch\(url, \{.*credentials: "omit", cache: "no-store"/);
  assert.match(api, /await loadProject\(projectId\)/);
  assert.match(page, /api\.downloadMP4\([\s\S]*?project\.id/);
});
