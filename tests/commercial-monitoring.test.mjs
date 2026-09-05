import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = (name) => readFileSync(new URL(`../src/components/Pages/${name}`, import.meta.url), 'utf8');

test('commercial panels use the authenticated API client', () => {
  for (const name of ['Admin.jsx', 'Billing.jsx', 'QuotaMonitor.jsx']) {
    const source = page(name);
    assert.match(source, /import \{ apiFetch, apiUrl \} from '\.\.\/\.\.\/config\/api'/);
    assert.doesNotMatch(source, /\bfetch\(apiUrl\(/);
  }
});

test('owner administration displays live API render and storage diagnostics', () => {
  const admin = page('Admin.jsx');
  assert.match(admin, /apiFetch\(apiUrl\('\/api\/security\/runtime'\)/);
  assert.match(admin, /Operação em tempo real/);
  assert.match(admin, /runtime\?\.renders\?\.waiting_count/);
  assert.match(admin, /runtime\?\.storage\?\.free_bytes/);
});
