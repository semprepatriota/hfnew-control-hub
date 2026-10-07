import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { contentFramesFor, durationForMedia, NEW_ATLAS_TEMPLATES, NEW_TODAY_IMAGE_FRAMES, NEW_TODAY_INTRO_FRAMES, NEW_TODAY_MAX_MEDIA_FRAMES } from '../src/modules/new-today/remotion/timeline.js';

const sidebar = readFileSync(new URL('../src/components/Layout/Sidebar.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('NEW ATLAS stays above Forge 70/30 and keeps its old route as a redirect', () => {
  assert.ok(sidebar.indexOf("id: 'new-today'") < sidebar.indexOf("module: 'forge_7030'"));
  assert.match(sidebar, /label: 'NEW ATLAS'/);
  assert.match(app, /Route path="\/new-atlas"/);
  assert.match(app, /Route path="\/new-today" element=\{<Navigate to="\/new-atlas" replace \/>\}/);
});

test('all three templates reach preview and render while preserving the original', () => {
  assert.deepEqual(NEW_ATLAS_TEMPLATES, ['classic', 'bulletin', 'brief']);
  const page = readFileSync(new URL('../src/modules/new-today/pages/NewToday.jsx', import.meta.url), 'utf8');
  const composition = readFileSync(new URL('../src/modules/new-today/remotion/NewTodayComposition.jsx', import.meta.url), 'utf8');
  assert.match(page, /setTemplate\(option\)/);
  assert.match(page, /template, summary: summary\.trim\(\), callout: callout\.trim\(\)/);
  assert.match(composition, /props\.template === 'bulletin'/);
  assert.match(composition, /props\.template === 'brief'/);
  assert.match(composition, /return <Story \{\.\.\.props\} \/>/);
});

test('image preset and videos up to three minutes have bounded frames', () => {
  assert.equal(NEW_TODAY_INTRO_FRAMES, 21);
  assert.equal(NEW_TODAY_IMAGE_FRAMES, 213);
  assert.equal(durationForMedia('image', 0), NEW_TODAY_IMAGE_FRAMES);
  assert.equal(durationForMedia('video', 180), NEW_TODAY_MAX_MEDIA_FRAMES + NEW_TODAY_INTRO_FRAMES);
  assert.equal(contentFramesFor(durationForMedia('video', 180)), NEW_TODAY_MAX_MEDIA_FRAMES);
  assert.equal(contentFramesFor(NEW_TODAY_IMAGE_FRAMES), 192);
});

test('NEW TODAY ends on the story without the old closing screen', () => {
  const composition = readFileSync(new URL('../src/modules/new-today/remotion/NewTodayComposition.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/modules/new-today/pages/NewToday.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(composition, /<Outro|Leia a notícia completa/);
  assert.doesNotMatch(page, /Chamada final|Leia a notícia completa/);
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

test('material analysis is requested only by its button and keeps editorial confirmation', () => {
  const page = readFileSync(new URL('../src/modules/new-today/pages/NewToday.jsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/modules/new-today/services/newTodayApi.js', import.meta.url), 'utf8');
  assert.match(page, /async function analyzeMaterial\(\)/);
  assert.match(page, /onClick=\{analyzeMaterial\}/);
  assert.match(page, /'Analisar material'/);
  assert.match(page, /function applyAnalysis\(\)/);
  assert.match(page, /setConfirmed\(false\)/);
  assert.match(api, /apiUrl\('\/api\/new-today\/analyze'\)/);
  assert.match(api, /method: 'POST'/);
});
