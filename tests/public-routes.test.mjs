import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeRoutePath } from '../src/utils/routePath.js';

test('public routes accept URLs with or without trailing slashes', () => {
  assert.equal(normalizeRoutePath('/politica-de-privacidade'), '/politica-de-privacidade');
  assert.equal(normalizeRoutePath('/politica-de-privacidade/'), '/politica-de-privacidade');
  assert.equal(normalizeRoutePath('/suporte///'), '/suporte');
  assert.equal(normalizeRoutePath('/'), '/');
});
