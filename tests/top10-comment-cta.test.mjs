import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ctaSceneSlots, ctaTiming } from '../src/modules/top10/cta.mjs';

test('subscribe CTA targets only the last three populated scenes', () => {
  const items = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].flatMap((rank) => [
    { kind: 'counter', rank, slot: 10-rank }, { kind: 'scene', rank, slot: 10-rank },
  ]);
  assert.deepEqual([...ctaSceneSlots(items)], [7, 8, 9]);
  assert.deepEqual([...ctaSceneSlots(items.slice(0, 6))], [0, 1, 2]);
});

test('TOP 3 CTA is brief within each scene; existing TOP 10 timing stays unchanged', () => {
  assert.equal(ctaTiming(900).length, 90);
  for (const frames of [2, 15, 30, 60, 150, 900]) {
    const timing = ctaTiming(frames, 30, true);
    assert.ok(timing.length <= 45 && timing.end <= frames);
  }
});

test('question CTA is absent from preview and renderer', () => {
  const composition = readFileSync(new URL('../src/modules/top10/Top10Composition.jsx', import.meta.url), 'utf8');
  const backend = readFileSync(new URL('../deploy/top10/backend/services/top10_service.py', import.meta.url), 'utf8');
  assert.doesNotMatch(composition, /commentCta|comment-question/);
  assert.doesNotMatch(backend, /comment_overlay/);
});
