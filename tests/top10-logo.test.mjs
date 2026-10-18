import test from 'node:test';
import assert from 'node:assert/strict';
import { isAnimatedLogo, logoStyle, normalizeLogoLayout } from '../src/modules/top10/logo.mjs';

test('animated logo requires explicit media metadata; existing images remain images', () => {
  assert.equal(isAnimatedLogo({ animated: true }), true);
  assert.equal(isAnimatedLogo({ filename: 'logo.png' }), false);
});
test('logo keeps fixed dimensions, opacity and stays inside the video', () => {
  const config = { logo_layout_version: 1, logo_round: false, logo_size: .14, logo_x: .86, logo_y: .1, logo_opacity: .7 };
  assert.deepEqual(logoStyle({ width: 720, height: 720 }, config), {
    position: 'absolute', width: 151, height: 151, left: 853, top: 117, opacity: .7,
  });
  assert.equal(logoStyle({ width: 720, height: 720 }, { ...config, logo_x: 1 }).left, 929);
  assert.equal(logoStyle({ width: 720, height: 720 }, { ...config, logo_y: 0 }).top, 0);
});
test('old projects migrate once to a round bottom-left logo; future edits stay editable', () => {
  const old = { logo_size: .14, logo_x: .86, logo_y: .1, logo_opacity: 1 };
  const next = normalizeLogoLayout(old);
  assert.equal(old.logo_x, .86);
  assert.equal(next.logo_x, .12);
  assert.equal(next.logo_y, .9);
  const style = logoStyle({ width: 720, height: 720 }, next);
  assert.equal(style.borderRadius, '50%');
  assert.equal(style.left, 54);
  assert.equal(style.top, 1653);
  assert.equal(style.width, style.height);
  const edited = { ...next, logo_x: .3, logo_y: .8 };
  assert.equal(normalizeLogoLayout(edited), edited);
});
