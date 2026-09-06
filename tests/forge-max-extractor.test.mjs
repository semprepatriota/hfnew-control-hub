import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampTimelineValue,
  snapTimelineTime,
  uploadPercent,
} from '../src/modules/forge-max/services/forgeMaxTimeline.js';


test('Forge Max upload progress stays inside zero and one hundred', () => {
  assert.equal(uploadPercent(0, 100), 0);
  assert.equal(uploadPercent(51, 100), 51);
  assert.equal(uploadPercent(120, 100), 100);
  assert.equal(uploadPercent(10, 0), 0);
});


test('Forge Max timeline values are clamped to the video duration', () => {
  assert.equal(clampTimelineValue(-2, 0, 60), 0);
  assert.equal(clampTimelineValue(61, 0, 60), 60);
});


test('Forge Max snapping uses a nearby detected scene boundary', () => {
  const scenes = [
    { start_seconds: 0, end_seconds: 12.5 },
    { start_seconds: 12.5, end_seconds: 27 },
  ];
  assert.equal(snapTimelineTime(12.43, 60, scenes, true, 8), 12.5);
  assert.equal(snapTimelineTime(9.2, 60, scenes, true, 0.5), 9.2);
  assert.equal(snapTimelineTime(18.123, 60, scenes, false, 8), 18.12);
});
