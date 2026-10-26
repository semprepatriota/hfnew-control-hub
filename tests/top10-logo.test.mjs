import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAnimatedLogo, logoStyle, normalizeLogoLayout } from '../src/modules/top10/logo.mjs';

test('animated logo requires explicit media metadata; existing images remain images', () => {
  assert.equal(isAnimatedLogo({ animated: true }), true);
  assert.equal(isAnimatedLogo({ filename: 'logo.png' }), false);
});
test('logo cannot change size, position, opacity or round shape through an old draft', () => {
  const config = { logo_layout_version: 1, logo_round: false, logo_size: .4, logo_x: .86, logo_y: .1, logo_opacity: .7 };
  const style = logoStyle({ width: 720, height: 720 }, config);
  assert.equal(style.width, 151);
  assert.equal(style.height, 151);
  assert.equal(style.left, 54);
  assert.equal(style.top, 1537);
  assert.equal(style.opacity, 1);
  assert.equal(style.borderRadius, '50%');
});
test('old and current projects keep the approved layout and preserve enable/disable', () => {
  const old = { logo_size: .14, logo_x: .86, logo_y: .1, logo_opacity: 1 };
  const next = normalizeLogoLayout(old);
  assert.equal(old.logo_x, .86);
  assert.equal(next.logo_x, .12);
  assert.equal(next.logo_y, .84);
  const style = logoStyle({ width: 720, height: 720 }, next);
  assert.equal(style.borderRadius, '50%');
  assert.equal(style.left, 54);
  assert.equal(style.top, 1537);
  assert.equal(style.width, style.height);
  const edited = { ...next, logo_x: .3, logo_y: .8, logo_enabled: false };
  assert.equal(normalizeLogoLayout(edited).logo_x, .12);
  assert.equal(normalizeLogoLayout(edited).logo_y, .84);
  assert.equal(normalizeLogoLayout(edited).logo_enabled, false);
  assert.equal(normalizeLogoLayout(next), next);
});
test('logo settings cannot be edited accidentally in the panel', () => {
  const source = readFileSync(new URL('../src/modules/top10/Top10.jsx', import.meta.url), 'utf8');
  for (const key of ['logo_size', 'logo_x', 'logo_y', 'logo_opacity']) {
    assert.equal(source.includes(`update("${key}",`), false);
  }
  assert.ok(source.includes('update("logo_enabled", event.target.checked)'));
});
