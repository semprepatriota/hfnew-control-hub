const CLEANUP_MARKER = 'hfnew_leads_agents_cleanup_20261005_v1';
const LEADS_TEMPLATES_KEY = 'alliance_dark_lead_message_templates';
const AGENTS_QUEUE_PREFIX = 'alliance_dark_agents_queue_v1';

export function clearRetiredLeadsAndAgentsData(storage) {
  if (!storage || storage.getItem(CLEANUP_MARKER) === 'done') {
    return 0;
  }

  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key === LEADS_TEMPLATES_KEY || key?.startsWith(AGENTS_QUEUE_PREFIX)) {
      keys.push(key);
    }
  }
  for (const key of keys) {
    storage.removeItem(key);
  }
  storage.setItem(CLEANUP_MARKER, 'done');
  return keys.length;
}
