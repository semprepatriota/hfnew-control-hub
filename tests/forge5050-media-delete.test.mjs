import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/modules/the-forge-50-50/pages/TheForge5050.jsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../src/modules/the-forge-50-50/services/forge5050Api.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/modules/the-forge-50-50/styles/the-forge-50-50.css', import.meta.url), 'utf8');

test('Forge 50/50 permite apagar somente a mídia escolhida da Biblioteca', () => {
  assert.match(api, /deleteForge5050Media/);
  assert.match(api, /\/media\/\$\{encodeURIComponent\(filename\)\}/);
  assert.match(api, /method:\s*'DELETE'/);
  assert.match(page, /Apagar \$\{image \? 'imagem' : 'vídeo'\}/);
  assert.match(page, /O arquivo original será removido deste projeto/);
  assert.match(page, /onDelete=\{removeMedia\}/);
  assert.match(page, /<Trash2 size=\{15\}/);
  assert.match(css, /\.forge5050-media-delete/);
});
