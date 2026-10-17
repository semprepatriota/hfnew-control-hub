import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTimeline, emptyScene, swapScenes } from '../src/modules/top10/timeline.mjs';
test('TOP 10 contains twenty contiguous slots descending from ten to one', () => {
  const project = { assets: { a: { duration: 5 } } };
  const config = { model: 'pink3d', scenes: Array.from({ length: 10 }, () => ({ ...emptyScene(), asset_id: 'a', start: 1, end: 2.5 })) };
  const items = buildTimeline(project, config);
  assert.equal(items.length, 20);
  assert.deepEqual(items.filter((item) => item.kind === 'counter').map((item) => item.rank), [10,9,8,7,6,5,4,3,2,1]);
  for (let i = 1; i < items.length; i++) assert.equal(items[i].from, items[i-1].from + items[i-1].frames);
  assert.equal(items.at(-1).from + items.at(-1).frames, 739);
  const changed = swapScenes({ ...config, scenes: config.scenes.map((scene, i) => ({ ...scene, start: i / 10 })) }, 1, 7);
  assert.equal(changed.scenes[1].start, 0.7);
  assert.equal(changed.scenes[7].start, 0.1);
  assert.deepEqual(buildTimeline(project, changed).filter((item) => item.kind === 'counter').map((item) => item.rank), [10,9,8,7,6,5,4,3,2,1]);
  assert.equal(config.scenes[1].start, 1);
});

test('original Cinema timings and corrected pink seven match backend assets', () => {
  const project = { assets: { a: { duration: 1 } } };
  const config = { model: 'film', scenes: Array.from({ length: 10 }, () => ({ ...emptyScene(), asset_id: 'a', end: 1 })) };
  const items = buildTimeline(project, config);
  assert.deepEqual(items.filter((item) => item.kind === 'counter').map((item) => item.frames), [30,25,28,26,28,30,27,28,28,29]);
  assert.equal(items.at(-1).from + items.at(-1).frames, 579);
  const pink = buildTimeline(project, { ...config, model: 'pink3d' });
  assert.equal(pink.find((item) => item.kind === 'counter' && item.rank === 7).frames, 26);
  const frontend = JSON.parse(readFileSync(new URL('../src/modules/top10/counter-catalog.json', import.meta.url)));
  const backend = JSON.parse(readFileSync(new URL('../deploy/top10/backend/assets/top10/counters/manifest.json', import.meta.url)));
  assert.deepEqual(frontend, backend);
});
