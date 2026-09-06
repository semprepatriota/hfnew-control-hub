import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPeriodBars,
  buildTrendBars,
  filterRadarVideos,
  formatRelativeTime,
} from '../src/components/Pages/Tabs/youtubeRadarUtils.js';

const NOW = Date.parse('2026-09-05T12:00:00Z');
const videos = [
  { video_id: 'a', is_short: true, views: 100, published_at: '2026-09-04T12:00:00Z' },
  { video_id: 'b', is_short: false, views: 300, published_at: '2026-07-01T12:00:00Z' },
  { video_id: 'c', is_short: false, views: 200, published_at: '2026-09-03T12:00:00Z' },
];

test('YouTube Radar filters Shorts, long videos, recent videos and most viewed', () => {
  assert.deepEqual(filterRadarVideos(videos, 'shorts', NOW).map((item) => item.video_id), ['a']);
  assert.deepEqual(filterRadarVideos(videos, 'long', NOW).map((item) => item.video_id), ['b', 'c']);
  assert.deepEqual(filterRadarVideos(videos, 'recent', NOW).map((item) => item.video_id), ['a', 'c']);
  assert.deepEqual(filterRadarVideos(videos, 'views', NOW).map((item) => item.video_id), ['b', 'c', 'a']);
});

test('YouTube Radar formats the update age without triggering API work', () => {
  assert.equal(formatRelativeTime('2026-09-05T11:58:00Z', NOW), 'Atualizado há 2 min');
  assert.equal(formatRelativeTime('2026-09-03T11:00:00Z', NOW), 'Atualizado há 2 dias');
});

test('trend bars respect the selected period and normalize view heights', () => {
  const bars = buildTrendBars(videos, 7, 18, NOW);
  assert.deepEqual(bars.map((item) => item.video_id), ['c', 'a']);
  assert.equal(Math.max(...bars.map((item) => item.bar_percent)), 100);
});

test('period bars use the complete daily series rather than only visible cards', () => {
  const bars = buildPeriodBars([
    { date: '2026-07-01', views: 900 },
    { date: '2026-09-03', views: 200 },
    { date: '2026-09-04', views: 400 },
  ], 7, 18, NOW);
  assert.deepEqual(bars.map((item) => item.date), ['2026-09-03', '2026-09-04']);
  assert.equal(bars[1].bar_percent, 100);
});
