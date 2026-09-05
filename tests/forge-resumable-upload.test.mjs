import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const forgeUrl = new URL('../src/components/Pages/ForgeEditor.jsx', import.meta.url);

test('Forge loads tus only when a video upload starts', async () => {
  const source = await readFile(forgeUrl, 'utf8');
  assert.match(source, /await import\('tus-js-client'\)/);
  assert.doesNotMatch(source, /^import .*tus-js-client/m);
});

test('resumable video upload exposes progress pause and finalization', async () => {
  const source = await readFile(forgeUrl, 'utf8');
  assert.match(source, /retryDelays: \[0, 1000, 3000, 5000, 10000\]/);
  assert.match(source, /\/api\/forge\/resumable\/finalize/);
  assert.match(source, /Pausar envio/);
  assert.match(source, /Continuar envio/);
});
