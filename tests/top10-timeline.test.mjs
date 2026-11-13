import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activeSlots, buildTimeline, emptyScene, normalizeInserts, swapScenes } from '../src/modules/top10/timeline.mjs';

test('TOP 3 uses ranks 3, 2, 1 and keeps extras after their scene even without the next scene', () => {
  const project = { assets: { a: {duration: 2}, b: {duration: 2}, c: {duration: 2}, image: {kind: 'insert_image'}, clip: {kind: 'insert_video', duration: 2}, final: {kind: 'insert_image'} } };
  const scenes = Array.from({length:10}, emptyScene);
  for (const slot of [7, 8, 9]) scenes[slot] = {...emptyScene(), asset_id: ['a','b','c'][slot-7], end: 2};
  scenes[0] = {...emptyScene(), asset_id: 'a', end: 2};
  const config = {format:'top3', model:'pink3d', counters_enabled:false, scenes,
    inserts:[{asset_id:'image', start:0, duration:1.5, volume:0}, {asset_id:'clip', start:.5, duration:2, volume:0}, {asset_id:'final', start:0, duration:3, volume:0}]};
  assert.deepEqual(activeSlots(config), [7,8,9]);
  const items = buildTimeline(project, config);
  assert.deepEqual(items.map(item=>item.kind), ['scene','insert','scene','insert','scene','insert']);
  assert.deepEqual(items.filter(item=>item.kind==='scene').map(item=>item.rank), [3,2,1]);
  assert.deepEqual(items.map(item=>item.from), [0,60,105,165,225,285]);
  assert.equal(buildTimeline(project, {...config, counters_enabled:true}).filter(item=>item.kind==='counter').length,3);
  scenes[8] = emptyScene();
  assert.deepEqual(buildTimeline(project, config).map(item=>item.kind), ['scene','insert','scene','insert']);
  const oldConfig = {...config, inserts: config.inserts.slice(0, 2)};
  assert.equal(normalizeInserts(oldConfig).inserts.length, 3);
  assert.equal(normalizeInserts({...config, inserts:[{asset_id:'image', duration:1}]}).inserts[0].duration, 1.5);
  assert.equal(normalizeInserts(oldConfig).inserts[2].duration, 2);
  assert.deepEqual(buildTimeline(project, oldConfig).map(item=>item.kind), ['scene','insert','scene']);
});

test('TOP 3 renders one selected scene and its extra in each rank', () => {
  const project = {assets: {scene: {duration: 1}, extra: {kind: 'insert_image'}}};
  for (const slot of [7, 8, 9]) {
    const scenes = Array.from({length: 10}, emptyScene);
    scenes[slot] = {...emptyScene(), asset_id: 'scene', end: 1};
    const inserts = Array.from({length: 3}, () => ({asset_id: '', duration: 2}));
    inserts[slot - 7].asset_id = 'extra';
    const items = buildTimeline(project, {format: 'top3', scenes, inserts, counters_enabled: false});
    assert.deepEqual(items.map(item => item.kind), ['scene', 'insert']);
    assert.deepEqual(items.map(item => item.from), [0, 30]);
  }
});

test('TOP 5 places five independent extras after scenes 5 through 1', () => {
  const scenes = Array.from({length: 10}, emptyScene);
  const assets = {image: {kind: 'insert_image'}, clip: {kind: 'insert_video', duration: .8}};
  for (let slot = 5; slot <= 9; slot++) {
    assets[`scene${slot}`] = {duration: 1};
    scenes[slot] = {...emptyScene(), asset_id: `scene${slot}`, end: 1};
  }
  const config = normalizeInserts({format: 'anime_5', model: 'pink3d', counters_enabled: false, scenes,
    anime_inserts: [
      {asset_id: 'image', duration: 1.5, start: 0, volume: 0},
      {asset_id: 'clip', duration: 2, start: 0, volume: 1},
      {asset_id: 'image', duration: 3, start: 0, volume: 0},
      {asset_id: 'image', duration: 1.5, start: 0, volume: 0},
      {asset_id: 'clip', duration: 2, start: 0, volume: 0},
    ]});
  const project = {assets};
  const items = buildTimeline(project, config);
  assert.deepEqual(activeSlots(config), [5, 6, 7, 8, 9]);
  assert.deepEqual(items.map(item => item.kind), Array.from({length: 5}, () => ['scene', 'insert']).flat());
  assert.deepEqual(items.filter(item => item.kind === 'insert').map(item => item.frames), [45, 60, 90, 45, 60]);
  assert.deepEqual(items.filter(item => item.kind === 'insert').map(item => item.rank), [5, 4, 3, 2, 1]);
  for (let i = 1; i < items.length; i++) assert.equal(items[i].from, items[i - 1].from + items[i - 1].frames);
  scenes[6] = emptyScene();
  assert.deepEqual(buildTimeline(project, config).slice(0, 3).map(item => item.kind), ['scene', 'insert', 'scene']);
  assert.equal(normalizeInserts({format: 'anime_5', scenes}).anime_inserts.length, 5);
  assert.equal(normalizeInserts({format: 'anime_5', scenes}).anime_inserts[4].duration, 2);
  assert.equal(normalizeInserts({...config, anime_inserts: [{duration: 1}]}).anime_inserts[0].duration, 1.5);
  assert.equal(config.inserts.length, 3);
});

test('no-counter format joins ten trimmed scenes with no gaps and keeps the saved model', () => {
  const project = { assets: { a: { duration: 5 } } };
  const config = { model: 'film', counters_enabled: false, scenes: Array.from({ length: 10 }, () => ({ ...emptyScene(), asset_id: 'a', start: 1, end: 2.5 })) };
  const before = structuredClone(config);
  const items = buildTimeline(project, config);
  assert.equal(items.length, 10);
  assert.ok(items.every(item => item.kind === 'scene' && item.frames === 45));
  assert.deepEqual(items.map(item => item.from), Array.from({ length: 10 }, (_, i) => i * 45));
  assert.equal(items.at(-1).from + items.at(-1).frames, 450);
  assert.deepEqual(config, before);
  assert.equal(buildTimeline(project, { ...config, counters_enabled: true }).length, 20);
});

test('no-counter format skips empty slots and respects the scene reorder', () => {
  const project = { assets: { a: { duration: 2 }, b: { duration: 3 } } };
  const config = { model: 'pink3d', counters_enabled: false, scenes: Array.from({ length: 10 }, emptyScene) };
  config.scenes[2] = { ...emptyScene(), asset_id: 'a', end: 2 };
  config.scenes[8] = { ...emptyScene(), asset_id: 'b', start: 1, end: 3 };
  let items = buildTimeline(project, config);
  assert.deepEqual(items.map(item => [item.slot, item.from, item.frames]), [[2,0,60], [8,60,60]]);
  items = buildTimeline(project, swapScenes(config, 2, 8));
  assert.deepEqual(items.map(item => item.scene.asset_id), ['b', 'a']);
  assert.deepEqual(buildTimeline(project, { ...config, scenes: Array.from({ length: 10 }, emptyScene) }), []);
});
test('partial projects omit empty slots and their counters without renumbering', () => {
  const project = { assets: { a: { duration: 1 } } };
  const config = { model: 'pink3d', scenes: Array.from({ length: 10 }, (_, slot) => ({ ...emptyScene(), asset_id: slot < 8 ? 'a' : '', end: 1 })) };
  const items = buildTimeline(project, config);
  assert.equal(items.length, 16);
  assert.deepEqual(items.filter(item => item.kind === 'counter').map(item => item.rank), [10,9,8,7,6,5,4,3]);
  for (let i = 1; i < items.length; i++) assert.equal(items[i].from, items[i-1].from + items[i-1].frames);
  config.scenes[1] = emptyScene();
  const sparse = buildTimeline(project, config);
  assert.deepEqual(sparse.filter(item => item.kind === 'scene').map(item => item.slot), [0,2,3,4,5,6,7]);
  assert.equal(sparse.find(item => item.slot === 2 && item.kind === 'scene').rank, 8);
  assert.deepEqual(buildTimeline(project, { ...config, scenes: Array.from({ length: 10 }, emptyScene) }), []);
});
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
