import assert from 'node:assert/strict';
import test from 'node:test';
import {buildTimeline, emptyScene, headlineFrames, INTRO_HEADLINE_DROP_PX, isIntroHeadline} from '../src/modules/top10/timeline.mjs';
import {headlineStyle} from '../src/modules/top10/headline.mjs';

const scenes = Array.from({length: 10}, emptyScene);
scenes[2] = {...emptyScene(), asset_id: 'first', end: 2};
scenes[4] = {...emptyScene(), asset_id: 'second', end: 2};
const project = {assets: {first: {duration: 2}, second: {duration: 2}}};
const config = {format: 'classic', model: 'pink3d', counters_enabled: false, scenes};
test('only the first populated scene without counters gets a 12-frame headline', () => {
  let items = buildTimeline(project, config);
  assert.deepEqual(items.map(item => item.kind), ['scene', 'scene']);
  assert.equal(headlineFrames(config, items, items[0]), 12);
  assert.equal(headlineFrames(config, items, items[1]), 60);
  assert.equal(isIntroHeadline(config, items, items[0]), true);
  assert.equal(isIntroHeadline(config, items, items[1]), false);
  assert.equal(headlineStyle(scenes[2].headline, true, INTRO_HEADLINE_DROP_PX).top, 189);
  assert.equal(headlineStyle(scenes[4].headline, true).top, 125);
  config.counters_enabled = true;
  items = buildTimeline(project, config);
  assert.equal(headlineFrames(config, items, items[1]), 60);
  assert.equal(isIntroHeadline(config, items, items[0]), false);
  config.format = 'anime_5';
  config.counters_enabled = false;
  scenes[5] = {...emptyScene(), asset_id: 'first', end: 2};
  items = buildTimeline(project, config);
  assert.equal(headlineFrames(config, items, items[0]), 12);
});
