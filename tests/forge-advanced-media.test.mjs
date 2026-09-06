import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const forge = readFileSync(new URL('../src/components/Pages/ForgeEditor.jsx', import.meta.url), 'utf8');
const player = readFileSync(new URL('../src/components/Media/ForgeAdvancedVideoPlayer.jsx', import.meta.url), 'utf8');
const waveform = readFileSync(new URL('../src/components/Media/ForgeAudioWaveform.jsx', import.meta.url), 'utf8');

test('advanced media is isolated to the selected Forge 70/30 assets', () => {
  assert.match(forge, /<ForgeAdvancedVideoPlayer[\s\S]*source=\{getSelectedVideoSource\(selectedVideo\)\}/);
  assert.match(forge, /<ForgeAudioWaveform[\s\S]*source=\{getSelectedAudioSource\(selectedAudio\)\}/);
  assert.match(forge, /if \(video\.video_url\) return apiUrl\(video\.video_url\)/);
  assert.match(forge, /if \(audio\.audio_url\) return apiUrl\(audio\.audio_url\)/);
});

test('scene analysis starts only after the explicit user command', () => {
  assert.match(player, /onClick=\{onAnalyzeScenes\}/);
  assert.match(player, /Detectar cenas/);
  assert.doesNotMatch(player, /useEffect\([\s\S]{0,300}onAnalyzeScenes/);
  assert.match(forge, /method: 'POST'/);
  assert.match(forge, /\/api\/forge\/library-scenes\//);
});

test('waveform is loaded on demand and retains a native audio fallback', () => {
  assert.match(waveform, /import\('wavesurfer\.js'\)/);
  assert.match(waveform, /failed && <audio/);
  assert.match(waveform, /dragToSeek: true/);
});

test('Forge 70/30 keeps the lower video fill fixed', () => {
  assert.match(forge, /const FIXED_BOTTOM_VIDEO_FIT = 'cover'/);
  assert.match(forge, /layoutPreset === 'classic7030' && bottomRatio > 0[\s\S]{0,120}FIXED_BOTTOM_VIDEO_FIT/);
  assert.match(forge, /Vídeo inferior[\s\S]{0,120}Preenchimento fixo/);
  assert.doesNotMatch(forge, />\s*Sem cortar\s*</);
  assert.match(forge, />\s*Cortar laterais\s*</);
});
