import assert from 'node:assert/strict';
import test from 'node:test';
import { clearRetiredLeadsAndAgentsData } from '../src/utils/retiredDataCleanup.js';

function makeStorage(initial) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test('one-time cleanup removes only retired Leads and Agents browser data', () => {
  const storage = makeStorage({
    alliance_dark_lead_message_templates: '[{"message":"old"}]',
    alliance_dark_agents_queue_v1_owner: '[{"id":"old"}]',
    alliance_dark_auth_token: 'session',
    forge_draft: 'keep',
  });

  assert.equal(clearRetiredLeadsAndAgentsData(storage), 2);
  assert.equal(storage.getItem('alliance_dark_auth_token'), 'session');
  assert.equal(storage.getItem('forge_draft'), 'keep');
  assert.equal(storage.getItem('alliance_dark_lead_message_templates'), null);
  assert.equal(clearRetiredLeadsAndAgentsData(storage), 0);
});
