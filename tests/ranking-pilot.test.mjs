import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTimeline, labelVisible, moveItem, normalizeProject, MAX_FRAMES, previewSeekTime, safeFontSize } from '../src/modules/ranking-pilot/timeline.mjs';

const assets = { a: { frames: 300 }, v: { frames: 24 }, end: { frames: 30 } };
const clip = (id = 'a', frames = 60) => ({ assetId: id, startFrame: 0, endFrame: frames, volume: .8, x: .5, y: .5, zoom: 1 });
const project = (model = 'classic') => ({ model, titleLines: ['Ranking', 'Melhores'], highlights: ['', ''],
  titleSize: 64, labelSize: 38, items: [
    { id: 'first', label: 'Primeira', clips: [clip()], interlude: clip('v', 24) },
    { id: 'last', label: 'Última', clips: [clip()] },
  ] });

test('classic ranks play in descending order without mandatory ten items', () => {
  const timeline = buildTimeline(project(), assets);
  assert.deepEqual(timeline.segments.map(s => [s.kind, s.rank, s.from, s.frames]), [['scene', 2, 0, 60], ['scene', 1, 60, 60]]);
  assert.equal(timeline.durationInFrames, 120);
});
test('interludes preserve revealed labels without becoming ranking positions', () => {
  const timeline = buildTimeline(project('interludes'), assets);
  assert.equal(timeline.count, 2);
  assert.deepEqual(timeline.segments.map(s => [s.kind, s.from]), [['scene', 0], ['interlude', 60], ['scene', 84]]);
  assert.equal(labelVisible(timeline, 2, 0), true);
  assert.equal(labelVisible(timeline, 1, 83), false);
  assert.equal(labelVisible(timeline, 1, 84), true);
  assert.equal(labelVisible(timeline, 2, 84), true);
});
test('subclips share the same rank and do not reveal another item', () => {
  const data = project('interludes'); data.items[0].clips.push(clip());
  const timeline = buildTimeline(data, assets);
  assert.deepEqual(timeline.segments.map(s => s.from), [0, 60, 120, 144]);
  assert.deepEqual(timeline.segments.map(s => s.rank), [2, 2, 2, 1]);
});
test('empty slots are skipped and deleting an item leaves no numeric holes', () => {
  const data = project(); data.items.unshift({ id: 'empty', clips: [] }); data.items.pop();
  const timeline = buildTimeline(data, assets);
  assert.equal(timeline.count, 1); assert.equal(timeline.reveals[0].rank, 1);
});
test('cut bounds use integer frames and reject empty, negative and beyond-EOF ranges', () => {
  for (const patch of [{ startFrame: -1 }, { endFrame: 301 }, { endFrame: 0 }, { startFrame: 1.5 }]) {
    const data = project(); Object.assign(data.items[0].clips[0], patch);
    assert.throws(() => buildTimeline(data, assets));
  }
  const data = project(); data.items[0].clips[0] = { ...clip(), startFrame: 299, endFrame: 300 };
  assert.equal(buildTimeline(data, assets).segments[0].frames, 1);
});
test('missing assets, duplicate scene ids and unsafe lengths fail before rendering', () => {
  const data = project(); data.items[0].clips[0].assetId = 'missing';
  assert.throws(() => normalizeProject(data, assets));
  const duplicate = project(); duplicate.items[1].id = 'first';
  assert.throws(() => normalizeProject(duplicate, assets));
  const excess = project(); excess.items = Array.from({ length: 11 }, (_, index) => ({ id: `item-${index}`, clips: [clip()] }));
  assert.throws(() => buildTimeline(excess, assets), /dez posições/);
});
test('long timelines are blocked without changing the project', () => {
  const data = project(); data.items[0].clips[0].endFrame = MAX_FRAMES;
  assert.throws(() => buildTimeline(data, { ...assets, a: { frames: MAX_FRAMES } }), /três minutos/);
});
test('outro follows the last frame and never adds another ranking position', () => {
  const data = project('interludes'); data.outro = clip('end', 30);
  const timeline = buildTimeline(data, assets);
  assert.equal(timeline.segments.at(-1).from, 144); assert.equal(timeline.durationInFrames, 174);
  assert.equal(timeline.count, 2); assert.equal(labelVisible(timeline, 1, 173), true);
});
test('reordering changes playback order while retaining each clip and audio setting', () => {
  const data = project(); const moved = moveItem(data.items, 'last', 'first');
  assert.equal(moved[0].id, 'last'); assert.equal(data.items[0].id, 'first');
  assert.equal(moved[0].clips[0].volume, .8);
  assert.equal(buildTimeline({ ...data, items: moved }, assets).reveals[0].itemId, 'last');
});
test('normalization bounds styling and audio without mutating editor state', () => {
  const data = project(); data.items[0].clips[0].volume = 30; data.titleSize = 500;
  const result = normalizeProject(data, assets);
  assert.equal(result.items[0].clips[0].volume, 1); assert.equal(result.titleSize, 90);
  assert.equal(data.titleSize, 500);
  assert.ok(safeFontSize('Momento', 64, 990) <= 64);
});
test('paused HTML seeks reach the last rational frame without changing playback or crossing EOF', () => {
  const corrected = previewSeekTime(1.966666, 2, true);
  assert.ok(corrected > 59/30 && corrected < 2);
  assert.equal(previewSeekTime(corrected, 2, true), corrected);
  assert.equal(previewSeekTime(1.966666, 2, false), 1.966666);
  assert.equal(previewSeekTime(2, 2, true), 2);
});
