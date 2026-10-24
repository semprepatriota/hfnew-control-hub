import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('only the approved Forge route changes to the isolated ranking editor', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/forge"[^\n]+RankingStudio[^\n]+production workspaceId=\{authStatus.workspaceId\}/);
  assert.match(app, /path="\/the-forge"[^\n]+TheForge5050/);
  assert.match(app, /path="\/forge-max"[^\n]+ForgeMaxExtractor/);
  assert.match(app, /path="\/top-10"[^\n]+Top10/);
});
test('production requests and browser drafts cannot use pilot-local storage', () => {
  const client = readFileSync(new URL('../src/modules/ranking-pilot/client.js', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../src/modules/ranking-pilot/RankingPilot.jsx', import.meta.url), 'utf8');
  assert.match(client, /apiUrl\(`\/api\/ranking\$\{path\}`\)/);
  assert.match(editor, /hfnew:ranking:v1:\$\{workspaceId\}:\$\{name\}/);
  assert.match(editor, /window.showSaveFilePicker[\s\S]*await client.download/);
  assert.match(editor, /render.url.includes\('\?'\) \? '&' : '\?'/);
});
