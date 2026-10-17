import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Forge Max immediately precedes TOP 10 without removing the other Forge modules', () => {
  const sidebar = read('src/components/Layout/Sidebar.jsx');
  const paths = [...sidebar.matchAll(/path: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(paths.indexOf('/top-10'), paths.indexOf('/forge-max') + 1);
  assert.ok(paths.includes('/forge'));
  assert.ok(paths.includes('/the-forge'));
});

test('portrait previews preserve source dimensions and the TOP 10 bridge uses a deliberate selection', () => {
  const page = read('src/modules/forge-max/pages/ForgeMaxExtractor.jsx');
  assert.match(page, /const portrait = videoHeight > videoWidth/);
  assert.match(page, /previewSize && previewSize.id === activeVideo\?\.id/);
  assert.match(page, /onLoadedMetadata/);
  assert.match(page, /selectedClips\.length > 10/);
  assert.match(page, /importForgeMax\(activeVideo\.id, selectedClips\.map/);
  assert.match(page, /navigate\(`\/top-10\?project=/);
  assert.match(page, /Enviar ao TOP 10/);
  const top10 = read('src/modules/top10/Top10.jsx');
  assert.match(top10, /requestedProject/);
  assert.match(top10, /api\.loadProject\(requestedProject\)/);
});
