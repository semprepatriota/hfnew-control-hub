import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../src/components/Layout/Sidebar.jsx', import.meta.url), 'utf8');
const leads = readFileSync(new URL('../src/components/Pages/Leads.jsx', import.meta.url), 'utf8');

test('Agents is absent from navigation while Leads remains available', () => {
  assert.doesNotMatch(app, /import\('\.\/components\/Pages\/Agents'\)/);
  assert.doesNotMatch(app, /Route path="\/agentes"/);
  assert.doesNotMatch(sidebar, /path: '\/agentes'/);
  assert.equal(existsSync(new URL('../src/components/Pages/Agents.jsx', import.meta.url)), false);
  assert.match(app, /Route path="\/leads"/);
  assert.match(sidebar, /path: '\/leads'/);
});

test('Leads keeps on-demand ChatGPT message generation without a CRONOS panel', () => {
  assert.match(leads, /onClick=\{generateMasterLeadMessage\}/);
  assert.match(leads, /Gerar MSG com ChatGPT/);
  assert.doesNotMatch(leads, /CRONOS|cronos_responder_agent/);
});

test('WhatsApp Hub is absent without changing the other modules', () => {
  assert.doesNotMatch(app, /Route path="\/whatsapp"/);
  assert.doesNotMatch(sidebar, /path: '\/whatsapp'/);
  assert.equal(existsSync(new URL('../src/modules/whatsapp/pages/WhatsAppHub.jsx', import.meta.url)), false);
  assert.match(app, /Route path="\/forge"/);
});
