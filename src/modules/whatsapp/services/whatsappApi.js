import { apiUrl } from '../../../config/api';

const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';

function getAuthHeaders() {
  if (typeof window === 'undefined') {
    return {};
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function normalizeErrorMessage(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || 'Erro desconhecido';
  }

  if (Array.isArray(value)) {
    const messages = value
      .map((item) => normalizeErrorMessage(item))
      .filter(Boolean);
    return messages.length ? messages.join(' | ') : 'Erro desconhecido';
  }

  if (value && typeof value === 'object') {
    if (typeof value.detail !== 'undefined') {
      return normalizeErrorMessage(value.detail);
    }

    if (typeof value.message !== 'undefined') {
      return normalizeErrorMessage(value.message);
    }

    if (typeof value.error !== 'undefined') {
      return normalizeErrorMessage(value.error);
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      return 'Erro desconhecido';
    }
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return 'Erro desconhecido';
}

async function parseJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(normalizeErrorMessage(data.detail || data.message || data.error || fallbackMessage));
  }
  return data;
}

export async function fetchWhatsAppHubData() {
  const headers = getAuthHeaders();
  const [statusResponse, healthResponse, settingsResponse, canvasResponse] = await Promise.all([
    fetch(apiUrl('/api/whatsapp/status'), { headers }),
    fetch(apiUrl('/api/whatsapp/health'), { headers }),
    fetch(apiUrl('/api/whatsapp/settings'), { headers }),
    fetch(apiUrl('/api/whatsapp/flow-canvas'), { headers }),
  ]);

  const [status, health, settings, canvas] = await Promise.all([
    parseJson(statusResponse, 'Erro ao carregar status do WhatsApp Hub'),
    parseJson(healthResponse, 'Erro ao carregar saude do modulo'),
    parseJson(settingsResponse, 'Erro ao carregar configuracao do modulo'),
    parseJson(canvasResponse, 'Erro ao carregar canvas do modulo'),
  ]);

  return { status, health, settings, canvas };
}

export async function saveWhatsAppSettings(payload) {
  const response = await fetch(apiUrl('/api/whatsapp/settings'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  return parseJson(response, 'Erro ao salvar configuracao do WhatsApp Hub');
}

export async function saveWhatsAppFlowCanvas(payload) {
  const response = await fetch(apiUrl('/api/whatsapp/flow-canvas'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  return parseJson(response, 'Erro ao salvar canvas do WhatsApp Hub');
}

export async function fetchWhatsAppConversations() {
  const response = await fetch(apiUrl('/api/whatsapp/conversations'), {
    headers: getAuthHeaders(),
  });
  return parseJson(response, 'Erro ao carregar conversas do WhatsApp Hub');
}

export async function fetchWhatsAppConversationMessages(conversationId) {
  const response = await fetch(apiUrl(`/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`), {
    headers: getAuthHeaders(),
  });
  return parseJson(response, 'Erro ao carregar mensagens da conversa');
}

export async function sendWhatsAppDraftMessage(conversationId, payload) {
  const response = await fetch(apiUrl(`/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Erro ao salvar resposta da conversa');
}

export async function fetchWhatsAppFunnels() {
  const response = await fetch(apiUrl('/api/whatsapp/funnels'), {
    headers: getAuthHeaders(),
  });
  return parseJson(response, 'Erro ao carregar funis do WhatsApp Hub');
}

export async function generateWhatsAppFunnel(payload) {
  const response = await fetch(apiUrl('/api/whatsapp/funnels/generate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return parseJson(response, 'Erro ao gerar funil do WhatsApp Hub');
}
