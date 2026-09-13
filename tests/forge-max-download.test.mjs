import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_NATIVE_ZIP_URL_LENGTH, saveZIP } from '../src/modules/forge-max/services/forgeMaxDownload.js';

// A stored ZIP entry with streaming data descriptor (CRC32 of "123456789").
function zipParts({ zip64 = false, payloadSize = 9, comment = Buffer.alloc(0) } = {}) {
  const name = Buffer.from('test.mp4');
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 6);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);
  const descriptor = Buffer.alloc(16);
  descriptor.writeUInt32LE(0x08074b50);
  descriptor.writeUInt32LE(0xcbf43926, 4);
  descriptor.writeUInt32LE(Math.min(payloadSize, 0xffffffff), 8);
  descriptor.writeUInt32LE(Math.min(payloadSize, 0xffffffff), 12);
  const directory = Buffer.alloc(46 + name.length);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt16LE(20, 4);
  directory.writeUInt16LE(20, 6);
  directory.writeUInt16LE(8, 8);
  directory.writeUInt32LE(0xcbf43926, 16);
  directory.writeUInt32LE(Math.min(payloadSize, 0xffffffff), 20);
  directory.writeUInt32LE(Math.min(payloadSize, 0xffffffff), 24);
  directory.writeUInt16LE(name.length, 28);
  name.copy(directory, 46);
  const directoryOffset = local.length + payloadSize + descriptor.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(zip64 ? 0xffffffff : directoryOffset, 16);
  end.writeUInt16LE(comment.length, 20);
  const extended = Buffer.alloc(zip64 ? 76 : 0);
  if (zip64) {
    extended.writeUInt32LE(0x06064b50);
    extended.writeBigUInt64LE(44n, 4);
    extended.writeUInt16LE(45, 12);
    extended.writeUInt16LE(45, 14);
    extended.writeBigUInt64LE(1n, 24);
    extended.writeBigUInt64LE(1n, 32);
    extended.writeBigUInt64LE(BigInt(directory.length), 40);
    extended.writeBigUInt64LE(BigInt(directoryOffset), 48);
    extended.writeUInt32LE(0x07064b50, 56);
    extended.writeBigUInt64LE(BigInt(directoryOffset + directory.length), 64);
    extended.writeUInt32LE(1, 72);
  }
  return { local, suffix: Buffer.concat([descriptor, directory, extended, end, comment]), end, directoryOffset };
}

function zip(options) {
  const { local, suffix } = zipParts(options);
  return Buffer.concat([local, Buffer.from('123456789'), suffix]);
}

function streamResponse(chunks, headers = {}) {
  let index = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (index === chunks.length) controller.close();
      else controller.enqueue(chunks[index++]);
    },
  }), { headers: { 'content-type': 'application/zip', ...headers } });
}

function setup(response = streamResponse([zip()]), overrides = {}) {
  const events = [];
  const writes = [];
  const writable = {
    async write(chunk) { writes.push(Buffer.from(chunk)); events.push('write'); },
    async close() { events.push('close'); },
    async abort() { events.push('abort'); },
    ...overrides,
  };
  const options = {
    filename: 'clips.zip',
    fallbackUrl: 'https://api.example/api/clips?key=media',
    expectedClipCount: 1,
    browser: { showSaveFilePicker(pickerOptions) {
      events.push('picker');
      assert.equal(pickerOptions.suggestedName, 'clips.zip');
      return Promise.resolve({ async createWritable() { events.push('create'); return writable; } });
    } },
    async request() { events.push('request'); return response; },
    onProgress(progress) { events.push(progress.phase); },
  };
  return { options, events, writes, writable };
}

test('picker runs synchronously before requests; unknown-size ZIP streams in order and only saves after close', async () => {
  const archive = zip();
  const { options, events, writes } = setup(streamResponse([archive.subarray(0, 1), archive.subarray(1, 3), archive.subarray(3, 27), archive.subarray(27)]));
  const operation = saveZIP(options);
  assert.deepEqual(events, ['picker']);
  assert.deepEqual(await operation, { status: 'saved', bytes: archive.length });
  assert.deepEqual(Buffer.concat(writes), archive);
  assert.ok(events.indexOf('request') > events.indexOf('create'));
  assert.ok(events.indexOf('saved') > events.indexOf('close'));
});

test('completion stays pending while writable.close is pending', async () => {
  let finish;
  let closing;
  const isClosing = new Promise((resolve) => { closing = resolve; });
  const { options, events } = setup(undefined, { close() {
    closing();
    return new Promise((resolve) => { finish = resolve; });
  } });
  const operation = saveZIP(options);
  await isClosing;
  assert.ok(!events.includes('saved'));
  finish();
  assert.equal((await operation).status, 'saved');
});

test('picker cancel never requests data or opens a fallback', async () => {
  const { options, events } = setup();
  options.browser.showSaveFilePicker = () => Promise.reject(new DOMException('Cancelled', 'AbortError'));
  assert.equal((await saveZIP(options)).status, 'cancelled');
  assert.deepEqual(events, []);
});

test('synchronous picker cancel is also handled without downloading', async () => {
  const { options, events } = setup();
  options.browser.showSaveFilePicker = () => { throw new DOMException('Cancelled', 'AbortError'); };
  assert.equal((await saveZIP(options)).status, 'cancelled');
  assert.deepEqual(events, []);
});

test('picker permission failure is reported without silent native fallback', async () => {
  const { options, events } = setup();
  options.browser.showSaveFilePicker = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
  await assert.rejects(saveZIP(options), /Denied/);
  assert.deepEqual(events, []);
});

test('failure to create a writable does not start an HTTP request', async () => {
  const { options, events } = setup();
  options.browser.showSaveFilePicker = () => Promise.resolve({ createWritable() { throw new Error('Destination full'); } });
  await assert.rejects(saveZIP(options), /Destination full/);
  assert.deepEqual(events, []);
});

test('HTTP errors cancel response and abort destination without claiming saved', async () => {
  const response = new Response('No storage', { status: 507 });
  const { options, events } = setup(response);
  await assert.rejects(saveZIP(options), /HTTP 507/);
  assert.ok(events.includes('abort'));
  assert.ok(!events.includes('write'));
  assert.ok(!events.includes('saved'));
  assert.equal(response.bodyUsed, true);
});

test('HTTP JSON detail/error is shown, including an actionable 401 session failure', async () => {
  for (const [status, payload, detail] of [[401, { detail: 'Token invalid' }, 'Token invalid'], [507, { error: 'Disk full' }, 'Disk full'], [403, { error: { message: 'Access denied' } }, 'Access denied']]) {
    const { options, events } = setup(new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }));
    await assert.rejects(saveZIP(options), (error) => {
      assert.ok(error.message.includes(detail));
      if (status === 401) assert.match(error.message, /Entre novamente/);
      return true;
    });
    assert.ok(events.includes('abort'));
    assert.ok(!events.includes('saved'));
  }
});

test('huge HTTP error bodies are read only up to a bounded diagnostic prefix', async () => {
  let reads = 0;
  let cancelled = false;
  const response = new Response(new ReadableStream({
    pull(controller) { reads += 1; controller.enqueue(new Uint8Array(4096).fill(65)); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 }), { status: 500 });
  const { options } = setup(response);
  await assert.rejects(saveZIP(options), /HTTP 500/);
  assert.equal(reads, 4);
  assert.equal(cancelled, true);
});

test('request network failure aborts the destination', async () => {
  const { options, events } = setup();
  options.request = async () => { throw new Error('Network lost'); };
  await assert.rejects(saveZIP(options), /Network lost/);
  assert.ok(events.includes('abort'));
});

test('HTML and non-PK responses cannot be saved as ZIP', async () => {
  for (const response of [new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }), streamResponse([Buffer.from('<html>login</html>')])]) {
    const { options, events } = setup(response);
    await assert.rejects(saveZIP(options), /ZIP inválido/);
    assert.ok(events.includes('abort'));
    assert.ok(!events.includes('saved'));
  }
});

test('truncated body, missing EOCD, trailing garbage and false EOCD cannot close the destination', async () => {
  const archive = zip();
  const wrongOffset = Buffer.from(archive);
  wrongOffset.writeUInt32LE(3, archive.length - 6);
  const shortPrefix = Buffer.from('PK');
  for (const data of [archive.subarray(0, archive.length - 1), archive.subarray(0, archive.length - 22), Buffer.concat([archive, Buffer.from('bad')]), wrongOffset, shortPrefix]) {
    const { options, events } = setup(streamResponse([data]));
    await assert.rejects(saveZIP(options), /ZIP inválido/);
    assert.ok(events.includes('abort'));
    assert.ok(!events.includes('close'));
  }
});

test('EOCD rejects unexpected clip count and Content-Length mismatches', async () => {
  const archive = zip();
  const first = setup(streamResponse([archive]));
  first.options.expectedClipCount = 2;
  await assert.rejects(saveZIP(first.options), /ZIP inválido/);
  const second = setup(streamResponse([archive], { 'content-length': archive.length + 1 }));
  await assert.rejects(saveZIP(second.options), /ZIP inválido/);
});

test('ZIP64 and a maximal EOCD comment are validated across split chunks', async () => {
  const archive = zip({ zip64: true, comment: Buffer.alloc(65535, 42) });
  const chunks = [];
  for (let i = 0; i < archive.length; i += 713) chunks.push(archive.subarray(i, i + 713));
  const { options } = setup(streamResponse(chunks));
  assert.equal((await saveZIP(options)).status, 'saved');
});

test('damaged ZIP64 locator cannot be mistaken for a complete archive', async () => {
  const archive = zip({ zip64: true });
  archive.writeUInt32LE(0, archive.length - 42);
  const { options, events } = setup(streamResponse([archive]));
  await assert.rejects(saveZIP(options), /ZIP inválido/);
  assert.ok(events.includes('abort'));
});

test('reader error after partial writes aborts rather than closing', async () => {
  let reads = 0;
  const response = new Response(new ReadableStream({ pull(controller) {
    if (reads++ === 0) controller.enqueue(zip().subarray(0, 47));
    else controller.error(new Error('Connection interrupted'));
  } }), { headers: { 'content-type': 'application/zip' } });
  const { options, events } = setup(response);
  await assert.rejects(saveZIP(options), /Connection interrupted/);
  assert.ok(events.includes('write'));
  assert.ok(events.includes('abort'));
  assert.ok(!events.includes('close'));
});

test('write and close errors abort partial output and never claim saved', async () => {
  for (const method of ['write', 'close']) {
    const { options, events } = setup(undefined, { [method]: async () => { throw new Error(`${method} failed`); } });
    await assert.rejects(saveZIP(options), new RegExp(`${method} failed`));
    assert.ok(events.includes('abort'));
    assert.ok(!events.includes('saved'));
  }
});

test('abort cleanup failure warns to check the partial destination', async () => {
  const { options } = setup(streamResponse([Buffer.from('not zip')]), { abort: async () => { throw new Error('Disk failure'); } });
  await assert.rejects(saveZIP(options), /Falha ao descartar o ZIP parcial/);
});

test('cancel after response headers cancels a pending body read and aborts partial file', async () => {
  let cancelled = false;
  let startedRead;
  const pendingRead = new Promise((resolve) => { startedRead = resolve; });
  const response = new Response(new ReadableStream({
    pull() { startedRead(); },
    cancel() { cancelled = true; },
  }), { headers: { 'content-type': 'application/zip' } });
  const { options, events } = setup(response);
  const controller = new AbortController();
  options.signal = controller.signal;
  const operation = saveZIP(options);
  await pendingRead;
  // Wait until the helper is reading, not merely the stream's initial prefetch.
  while (!events.includes('saving')) await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  assert.equal((await operation).status, 'cancelled');
  assert.equal(cancelled, true);
  assert.ok(events.includes('abort'));
  assert.ok(!events.includes('close'));
});

test('multi-gigabyte ZIP64 transfer uses incremental backpressure, never Blob or full-body methods', async (context) => {
  const block = new Uint8Array(16 * 1024 * 1024);
  const blocks = 257;
  const { local, suffix } = zipParts({ zip64: true, payloadSize: blocks * block.length });
  let index = 0;
  let writing = false;
  let bytesWritten = 0;
  const response = new Response(new ReadableStream({ pull(controller) {
    assert.equal(writing, false, 'must finish write before reading another block');
    if (index === 0) controller.enqueue(local);
    else if (index <= blocks) controller.enqueue(block);
    else if (index === blocks + 1) controller.enqueue(suffix);
    else controller.close();
    index += 1;
  } }, { highWaterMark: 0 }), { headers: { 'content-type': 'application/zip' } });
  for (const method of ['blob', 'arrayBuffer', 'text', 'json']) response[method] = () => { throw new Error(`Forbidden full-body ${method}`); };
  const OriginalBlob = globalThis.Blob;
  globalThis.Blob = class { constructor() { throw new Error('Blob allocation forbidden'); } };
  context.after(() => { globalThis.Blob = OriginalBlob; });
  const { options } = setup(response, { async write(chunk) {
    assert.equal(writing, false);
    writing = true;
    await Promise.resolve();
    bytesWritten += chunk.length;
    writing = false;
  } });
  const progress = [];
  options.onProgress = (value) => { progress.push(value); };
  const result = await saveZIP(options);
  assert.equal(result.status, 'saved');
  assert.ok(result.bytes > 4 * 1024 ** 3);
  assert.equal(result.bytes, bytesWritten);
  assert.equal(progress.at(-1).totalBytes, null);
});

function nativeDocument() {
  const events = [];
  const anchor = { click() { events.push('click'); }, remove() { events.push('remove'); } };
  return { events, anchor, document: { createElement() { return anchor; }, body: { appendChild() { events.push('append'); } } } };
}

test('native fallback starts a keyed URL without claiming verified completion or fetching a Blob', async () => {
  const native = nativeDocument();
  const { options, events } = setup();
  options.browser = {};
  options.document = native.document;
  const result = await saveZIP(options);
  assert.equal(result.status, 'started');
  assert.equal(native.anchor.href, options.fallbackUrl);
  assert.deepEqual(native.events, ['append', 'click', 'remove']);
  assert.deepEqual(events, []);
});

test('long selected native URLs are rejected before navigation; picker still accepts 600 IDs via request', async () => {
  const { options } = setup();
  options.fallbackUrl += '&clip_ids=some-long-id'.repeat(600);
  assert.ok(options.fallbackUrl.length > MAX_NATIVE_ZIP_URL_LENGTH);
  const native = nativeDocument();
  await assert.rejects(saveZIP({ ...options, browser: {}, document: native.document }), /Use Chrome no computador/);
  assert.deepEqual(native.events, []);
  assert.equal((await saveZIP(options)).status, 'saved');
});
