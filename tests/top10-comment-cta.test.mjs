import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMENT_CTA_BOX, showCommentCta } from '../src/modules/top10/cta.mjs';

test('comment CTA appears only on the video for positions 2 and 1', () => {
  for (const rank of [10, 9, 8, 7, 6, 5, 4, 3]) {
    assert.equal(showCommentCta({ kind: 'scene', rank }), false);
  }
  for (const rank of [2, 1]) {
    assert.equal(showCommentCta({ kind: 'scene', rank }), true);
    assert.equal(showCommentCta({ kind: 'counter', rank }), false);
    assert.equal(showCommentCta({ kind: 'anime', rank }), false);
  }
});

test('comment CTA aligns beside the fixed logo and above subscribe', () => {
  assert.equal(COMMENT_CTA_BOX.left, 248);
  assert.equal(COMMENT_CTA_BOX.top, 1180);
  assert.ok(COMMENT_CTA_BOX.left > 205);
  assert.ok(COMMENT_CTA_BOX.top + COMMENT_CTA_BOX.height < 1330);
  assert.ok(COMMENT_CTA_BOX.left + COMMENT_CTA_BOX.width < 1080);
});
