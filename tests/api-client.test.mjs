import assert from 'node:assert/strict';
import test from 'node:test';

import { apiFetch } from '../src/config/api.js';


test('apiFetch retries a safe GET after a temporary gateway failure', async (context) => {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{}', {
      status: calls === 1 ? 503 : 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  context.after(() => { globalThis.fetch = originalFetch; });

  const response = await apiFetch('https://api.hfnew.com.br/api/status', { retries: 1, timeoutMs: 1000 });
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});


test('apiFetch does not repeat a POST automatically', async (context) => {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('network down');
  };
  context.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    apiFetch('https://api.hfnew.com.br/api/forge/render', { method: 'POST', retries: 3, timeoutMs: 1000 }),
    (error) => error.code === 'API_UNREACHABLE',
  );
  assert.equal(calls, 1);
});
