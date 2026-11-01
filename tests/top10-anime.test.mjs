import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSlots, buildTimeline, emptyScene } from '../src/modules/top10/timeline.mjs';

const makeProject = () => {
  const scenes = Array.from({ length: 10 }, (_, slot) => ({...emptyScene(), asset_id: `a${slot}`, end: 1}));
  const assets = Object.fromEntries(scenes.map(scene => [scene.asset_id, {duration: 1}]));
  return {scenes, assets};
};

test('anime format renders only ranks 5 to 1 and retains the stored ten scenes', () => {
  const {scenes, assets} = makeProject();
  const project = {assets, anime: {a5: {url: '/anime.png', approved: true,
    framing: {start: 0, end: 1, x: .5, y: .5, zoom: 1}}}};
  const config = {model: 'pink3d', format: 'anime_5', counters_enabled: true, scenes};
  const before = structuredClone(config);
  assert.deepEqual(activeSlots(config), [5,6,7,8,9]);
  const items = buildTimeline(project, config);
  assert.deepEqual(items.filter(item => item.kind === 'scene').map(item => item.rank), [5,4,3,2,1]);
  assert.deepEqual(items.filter(item => item.kind === 'counter').map(item => item.rank), [5,4,3,2,1]);
  assert.deepEqual(items.filter(item => item.kind === 'anime').map(item => item.rank), [5]);
  for (let i = 1; i < items.length; i++) assert.equal(items[i].from, items[i-1].from + items[i-1].frames);
  assert.deepEqual(config, before);
});

test('anime is optional and approval is required; classic output is unchanged', () => {
  const {scenes, assets} = makeProject();
  const project = {assets, anime: {a5: {url: '/anime.png', approved: false,
    framing: {start: 0, end: 1, x: .5, y: .5, zoom: 1}}}};
  const config = {model: 'pink3d', format: 'anime_5', counters_enabled: false, scenes};
  assert.equal(buildTimeline(project, config).length, 5);
  project.anime.a5.approved = true;
  assert.equal(buildTimeline(project, config).length, 6);
  config.scenes[5].zoom = 1.2;
  assert.equal(buildTimeline(project, config).length, 5);
  const classic = buildTimeline(project, {...config, format: 'classic'});
  assert.equal(classic.length, 10);
  assert.equal(classic.filter(item => item.kind === 'anime').length, 0);
  assert.deepEqual(activeSlots({format: 'classic'}), [0,1,2,3,4,5,6,7,8,9]);
});
