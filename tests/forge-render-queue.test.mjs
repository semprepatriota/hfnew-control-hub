import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../src/components/Pages/ForgeEditor.jsx', import.meta.url);

test('Forge 70/30 uses the persistent render job endpoint', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /\/api\/forge\/render\/jobs/);
  assert.doesNotMatch(source, /apiFetch\(apiUrl\('\/api\/forge\/render'\)/);
});

test('active render job is retained and recovered after leaving the module', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /FORGE_7030_RENDER_JOB_KEY/);
  assert.match(source, /Recuperando renderizacao em andamento/);
  assert.match(source, /Reconectando a renderizacao na VPS/);
});
