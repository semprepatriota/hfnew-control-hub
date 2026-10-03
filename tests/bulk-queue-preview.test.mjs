import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/modules/bulk-download/pages/BulkDownload.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/modules/bulk-download/pages/bulk-download.css', import.meta.url), 'utf8');

test('link analysis panel is removed without losing result clearing', () => {
  assert.doesNotMatch(page, /Links para analisar|Analisar links|analyzeLinks/);
  assert.match(page, /onClick=\{clearResults\}[^>]*title="Limpar resultados"/);
});

test('history shows a compact lazy preview with an image fallback', () => {
  assert.match(page, /<JobPreview job=\{job\} \/>/);
  assert.match(page, /<video src=\{preview\}[^>]*preload="none"/);
  assert.match(page, /<img src=\{thumbnail\}[^>]*loading="lazy"/);
  assert.match(styles, /\.bulk-job-preview \{[^}]*width: 72px; height: 58px;/);
});
