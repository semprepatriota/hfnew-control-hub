import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/Pages/ForgeEditor.jsx', import.meta.url), 'utf8');

test('Forge video library is paginated and cancels stale requests', () => {
  assert.match(source, /FORGE_LIBRARY_PAGE_SIZE = 12/);
  assert.match(source, /libraryAbortRef\.current\?\.abort\(\)/);
  assert.match(source, /limit: String\(FORGE_LIBRARY_PAGE_SIZE\)/);
  assert.match(source, /videoLibraryHasMore/);
});

test('Forge cards use cached posters and avoid eager video loading', () => {
  assert.match(source, /poster=\{poster \|\| undefined\}/);
  assert.match(source, /preload="none"/);
  assert.match(source, /video\.preview_url \? apiUrl\(video\.preview_url\)/);
});
