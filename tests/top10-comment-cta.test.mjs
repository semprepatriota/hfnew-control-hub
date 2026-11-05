import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMENT_CTA_BOX, commentCtaFrames, showCommentCta } from '../src/modules/top10/cta.mjs';

test('comment CTA appears only on the video for position 2', () => {
  for (const rank of [10, 9, 8, 7, 6, 5, 4, 3, 1]) {
    assert.equal(showCommentCta({ kind: 'scene', rank }), false);
  }
  assert.equal(showCommentCta({ kind: 'scene', rank: 2 }), true);
  assert.equal(showCommentCta({ kind: 'counter', rank: 2 }), false);
  assert.equal(showCommentCta({ kind: 'anime', rank: 2 }), false);
});

test('comment CTA leaves a clean end even when scene 2 is the final scene', () => {
  for (const frames of [2, 15, 30, 60, 150]) {
    assert.ok(commentCtaFrames(frames) >= 1);
    assert.ok(commentCtaFrames(frames) < frames);
  }
  assert.equal(commentCtaFrames(150), 135);
  assert.equal(commentCtaFrames(60), 48);
});

test('comment CTA aligns beside the fixed logo and above subscribe', () => {
  assert.equal(COMMENT_CTA_BOX.left, 248);
  assert.equal(COMMENT_CTA_BOX.top, 1180);
  assert.ok(COMMENT_CTA_BOX.left > 205);
  assert.ok(COMMENT_CTA_BOX.top + COMMENT_CTA_BOX.height < 1330);
  assert.ok(COMMENT_CTA_BOX.left + COMMENT_CTA_BOX.width < 1080);
});
