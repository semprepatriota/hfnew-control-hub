import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { contentFramesFor, durationForMedia, NEW_TODAY_IMAGE_FRAMES, NEW_TODAY_MAX_MEDIA_FRAMES } from '../src/modules/new-today/remotion/timeline.js';

const sidebar = readFileSync(new URL('../src/components/Layout/Sidebar.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('NEW TODAY stays above Forge 70/30 and has its own route', () => {
  assert.ok(sidebar.indexOf("id: 'new-today'") < sidebar.indexOf("module: 'forge_7030'"));
  assert.match(app, /Route path="\/new-today"/);
});

test('image preset and videos up to three minutes have bounded frames', () => {
  assert.equal(durationForMedia('image', 0), NEW_TODAY_IMAGE_FRAMES);
  assert.equal(durationForMedia('video', 180), NEW_TODAY_MAX_MEDIA_FRAMES + 90);
  assert.equal(contentFramesFor(durationForMedia('video', 180)), NEW_TODAY_MAX_MEDIA_FRAMES);
});

test('news globe background stays available to the Remotion composition', () => {
  const background = new URL('../public/new-today-globe.png', import.meta.url);
  const sphere = new URL('../public/new-today-globe-sphere.png', import.meta.url);
  const composition = readFileSync(new URL('../src/modules/new-today/remotion/NewTodayComposition.jsx', import.meta.url), 'utf8');
  assert.ok(existsSync(background));
  assert.ok(existsSync(sphere));
  assert.match(composition, /staticFile\('new-today-globe\.png'\)/);
  assert.match(composition, /staticFile\('new-today-globe-sphere\.png'\)/);
  assert.match(composition, /rotate\(\$\{globeTurn\}deg\)/);
});
