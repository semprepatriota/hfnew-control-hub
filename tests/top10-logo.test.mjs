import test from 'node:test';
import assert from 'node:assert/strict';
import { isAnimatedLogo, logoStyle } from '../src/modules/top10/logo.mjs';

test('animated logo requires explicit media metadata; existing images remain images', () => {
  assert.equal(isAnimatedLogo({ animated: true }), true);
  assert.equal(isAnimatedLogo({ filename: 'logo.png' }), false);
});
test('logo keeps fixed dimensions, opacity and stays inside the video', () => {
  const config = { logo_size: .14, logo_x: .86, logo_y: .1, logo_opacity: .7 };
  assert.deepEqual(logoStyle({ width: 720, height: 720 }, config), {
    position: 'absolute', width: 151, height: 151, left: 853, top: 117, opacity: .7,
  });
  assert.equal(logoStyle({ width: 720, height: 720 }, { ...config, logo_x: 1 }).left, 929);
  assert.equal(logoStyle({ width: 720, height: 720 }, { ...config, logo_y: 0 }).top, 0);
});
