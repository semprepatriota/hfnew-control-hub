import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ctaTiming, ctaStyle } from '../src/modules/top10/cta.mjs';
import { headlineStyle } from '../src/modules/top10/headline.mjs';

test('CTA reuses the exact approved subscribe art, not a redrawn label', () => {
  const asset = readFileSync(new URL('../src/modules/top10/assets/subscribe-short-button.png', import.meta.url));
  assert.equal(createHash('sha256').update(asset).digest('hex'), 'aab18263d1bb07e49cf7384b4512a1f89a84a286b4121727ddf3c6f79d4c17e5');
});
test('one CTA appears for at most three seconds and fits short and long outputs', () => {
  for (const frames of [1, 2, 15, 30, 90, 600, 18000]) {
    const t = ctaTiming(frames);
    assert.ok(t.start >= 0 && t.length > 0 && t.length <= 90 && t.end <= frames);
    assert.equal(ctaStyle(t.start-1, frames).visible, false);
    assert.equal(ctaStyle(t.end, frames).visible, false);
  }
});
test('CTA is silent, fades at both ends and does not overlap the fixed logo', () => {
  const timing = ctaTiming(900);
  assert.equal(ctaStyle(timing.start, 900).opacity, 0);
  assert.equal(ctaStyle(timing.end-1, 900).opacity, 0);
  const middle = ctaStyle(timing.start+15, 900);
  assert.equal(middle.opacity, 1);
  assert.ok(middle.like.top+middle.like.height < 1653);
  const composition = readFileSync(new URL('../src/modules/top10/Top10Composition.jsx', import.meta.url), 'utf8');
  assert.match(composition, /config.cta_enabled !== false && <Top10Cta/);
  assert.doesNotMatch(readFileSync(new URL('../src/modules/top10/Top10Cta.jsx', import.meta.url),'utf8'), /<Audio|<Video/);
});
test('headline lift is stable, clamped and never accumulates on repeated previews', () => {
  const h = {x:0,y:.08,width:1,height:.13};
  assert.equal(headlineStyle(h, true).top, 125);
  assert.deepEqual(headlineStyle(h), headlineStyle(h));
  assert.equal(h.y,.08);
  assert.equal(headlineStyle({...h,y:0},true).top,0);
});
