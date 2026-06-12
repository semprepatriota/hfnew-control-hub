import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  BrainCircuit,
  CheckCircle2,
  GitBranch,
  Inbox,
  MessageSquare,
  Network,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Webhook,
} from 'lucide-react';
import {
  fetchWhatsAppConversationMessages,
  fetchWhatsAppConversations,
  fetchWhatsAppFunnels,
  fetchWhatsAppHubData,
  generateWhatsAppFunnel,
  saveWhatsAppSettings,
  sendWhatsAppDraftMessage,
} from '../services/whatsappApi';
import '../../../components/Pages/Pages.css';
import './WhatsAppHub.css';

const defaultForm = {
  workspace_name: '',
  business_account_id: '',
  phone_number_id: '',
  verify_token: '',
  webhook_path: '',
  auto_reply_enabled: false,
};

const defaultFunnelForm = {
  topic: '',
  product: '',
  audience: '',
  goal: 'converter lead em conversa qualificada',
  tone: 'direto, consultivo e persuasivo',
  steps: 5,
};

const tabs = [
  { id: 'overview', label: 'Geral', icon: Activity },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'flows', label: 'Canvas e funis', icon: GitBranch },
  { id: 'settings', label: 'Configuracao', icon: Save },
  { id: 'diagnostics', label: 'Diagnostico', icon: ShieldCheck },
];

function StatCard({ icon: Icon, label, value, tone = 'green' }) {
  return (
    <article className={`stat-card whatsapp-stat-card whatsapp-stat-card--${tone}`}>
      <div className="stat-icon">
        <Icon size={22} />
      </div>
      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
      </div>
    </article>
  );
}

function WhatsAppHub() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [statusData, setStatusData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [canvasData, setCanvasData] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [funnels, setFunnels] = useState([]);
  const [funnelForm, setFunnelForm] = useState(defaultFunnelForm);
  const [generatedPlan, setGeneratedPlan] = useState(null);

  const loadOperationalData = async () => {
    const [conversationData, funnelData] = await Promise.all([
      fetchWhatsAppConversations(),
      fetchWhatsAppFunnels(),
    ]);
    const nextConversations = conversationData.items || [];
    setConversations(nextConversations);
    setFunnels(funnelData.items || []);
    setSelectedConversationId((current) => current || nextConversations[0]?.id || '');
  };

  const loadModule = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchWhatsAppHubData();
      setStatusData(data.status);
      setHealthData(data.health);
      setCanvasData(data.canvas);
      setFormData({
        workspace_name: data.settings.workspace_name || '',
        business_account_id: data.settings.business_account_id || '',
        phone_number_id: data.settings.phone_number_id || '',
        verify_token: data.settings.verify_token || '',
        webhook_path: data.settings.webhook_path || '',
        auto_reply_enabled: Boolean(data.settings.auto_reply_enabled),
      });
      await loadOperationalData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModule();
  }, []);

  useEffect(() => {
    async function loadMessages() {
      if (!selectedConversationId) {
        setSelectedConversation(null);
        setMessages([]);
        return;
      }
      try {
        const data = await fetchWhatsAppConversationMessages(selectedConversationId);
        setSelectedConversation(data.conversation || null);
        setMessages(data.messages || []);
      } catch (err) {
        setError(err.message);
      }
    }

    loadMessages();
  }, [selectedConversationId]);

  const connectionLabel = useMemo(() => {
    if (!statusData) return '--';
    return statusData.connected ? 'Conectado' : 'Pendente';
  }, [statusData]);

  const webhookLabel = useMemo(() => {
    if (!healthData) return '--';
    return healthData.webhook.verified ? 'Validado' : 'Aguardando';
  }, [healthData]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFunnelChange = (event) => {
    const { name, value } = event.target;
    setFunnelForm((current) => ({
      ...current,
      [name]: name === 'steps' ? Number(value) : value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await saveWhatsAppSettings(formData);
      setFormData({
        workspace_name: response.settings.workspace_name || '',
        business_account_id: response.settings.business_account_id || '',
        phone_number_id: response.settings.phone_number_id || '',
        verify_token: response.settings.verify_token || '',
        webhook_path: response.settings.webhook_path || '',
        auto_reply_enabled: Boolean(response.settings.auto_reply_enabled),
      });
      setNotice('Configuracao salva.');
      await loadModule();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateFunnel = async () => {
    if (!funnelForm.topic.trim()) {
      setError('Informe o assunto do funil.');
      return;
    }

    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const response = await generateWhatsAppFunnel(funnelForm);
      setGeneratedPlan(response.plan);
      setFunnels((current) => [response.plan, ...current.filter((item) => item.id !== response.plan.id)]);
      setNotice('Funil criado como rascunho supervisionado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendDraft = async () => {
    if (!selectedConversationId || !replyText.trim()) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const response = await sendWhatsAppDraftMessage(selectedConversationId, {
        text: replyText,
        mode: 'manual_draft',
      });
      setSelectedConversation(response.conversation);
      setMessages((current) => [...current, response.message]);
      setConversations((current) => current.map((item) => (
        item.id === selectedConversationId
          ? { ...item, last_message: response.message.text, status: 'respondido', updated_at: response.message.created_at }
          : item
      )));
      setReplyText('');
      setNotice('Resposta salva no rascunho da conversa.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner">Carregando WhatsApp Hub...</div>;
  }

  return (
    <div className="page-container whatsapp-hub-page">
      <div className="page-header">
        <div>
          <h1>WHATSAPP HUB</h1>
          <p>Operacao, automacao supervisionada e construcao de fluxos de conversa.</p>
        </div>
        <button type="button" className="refresh-button whatsapp-hub-refresh" onClick={loadModule} disabled={loading}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="success-banner">{notice}</div> : null}

      <section className="whatsapp-tabs" aria-label="Navegacao do WhatsApp Hub">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`whatsapp-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </section>

      {activeTab === 'overview' ? (
        <>
          <section className="stats-grid">
            <StatCard icon={Smartphone} label="Conexao Meta" value={connectionLabel} />
            <StatCard icon={Webhook} label="Webhook" value={webhookLabel} tone="blue" />
            <StatCard icon={Bot} label="Agentes ativos" value={String(statusData?.agents?.length || 0)} tone="gold" />
            <StatCard icon={Inbox} label="Conversas" value={String(conversations.length)} tone="green" />
          </section>

          <section className="whatsapp-hub-grid">
            <article className="content-section whatsapp-panel">
              <div className="whatsapp-panel__header">
                <div>
                  <h2>Agentes centrais</h2>
                  <p>Base de inteligencia separada do restante do app.</p>
                </div>
              </div>
              <div className="whatsapp-agent-grid">
                {(statusData?.agents || []).map((agent) => (
                  <div key={agent.id} className="whatsapp-agent-card">
                    <div className="whatsapp-agent-card__icon">
                      {agent.id === 'master_supervisor_agent' ? <BrainCircuit size={18} /> : <MessageSquare size={18} />}
                    </div>
                    <div className="whatsapp-agent-card__body">
                      <strong>{agent.name}</strong>
                      <span>{agent.role}</span>
                      <p>{agent.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="content-section whatsapp-panel">
              <div className="whatsapp-panel__header">
                <div>
                  <h2>Fila atual</h2>
                  <p>Leitura operacional inicial para atendimento supervisionado.</p>
                </div>
              </div>
              <div className="whatsapp-mini-list">
                {conversations.slice(0, 4).map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    className="whatsapp-mini-row"
                    onClick={() => {
                      setSelectedConversationId(conversation.id);
                      setActiveTab('inbox');
                    }}
                  >
                    <span>
                      <strong>{conversation.contact_name}</strong>
                      <small>{conversation.last_message}</small>
                    </span>
                    <em>{conversation.status}</em>
                  </button>
                ))}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {activeTab === 'inbox' ? (
        <section className="whatsapp-inbox-grid">
          <article className="content-section whatsapp-panel whatsapp-conversation-list">
            <div className="whatsapp-panel__header">
              <div>
                <h2>Conversas</h2>
                <p>Fila local preparada para receber eventos do webhook.</p>
              </div>
            </div>
            <div className="whatsapp-thread-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`whatsapp-thread ${selectedConversationId === conversation.id ? 'active' : ''}`}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <span>
                    <strong>{conversation.contact_name}</strong>
                    <small>{conversation.phone}</small>
                  </span>
                  <p>{conversation.last_message}</p>
                  <em>{conversation.status}</em>
                </button>
              ))}
            </div>
          </article>

          <article className="content-section whatsapp-panel whatsapp-chat-panel">
            <div className="whatsapp-panel__header">
              <div>
                <h2>{selectedConversation?.contact_name || 'Conversa'}</h2>
                <p>{selectedConversation?.phone || 'Selecione uma conversa'}</p>
              </div>
            </div>
            <div className="whatsapp-message-list">
              {messages.map((message) => (
                <div key={message.id} className={`whatsapp-message whatsapp-message--${message.direction}`}>
                  <p>{message.text}</p>
                  <span>{message.delivery || message.created_at}</span>
                </div>
              ))}
            </div>
            <div className="whatsapp-reply-box">
              <textarea
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Escreva uma resposta supervisionada..."
                rows="4"
              />
              <button type="button" className="btn-primary" onClick={handleSendDraft} disabled={sending || !replyText.trim()}>
                <Send size={16} />
                {sending ? 'Salvando...' : 'Salvar resposta'}
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'flows' ? (
        <section className="whatsapp-hub-grid whatsapp-hub-grid--bottom">
          <article className="content-section whatsapp-panel">
            <div className="whatsapp-panel__header">
              <div>
                <h2>Agente construtor de funis</h2>
                <p>Gera um rascunho estruturado para revisao antes de qualquer automacao.</p>
              </div>
            </div>
            <div className="whatsapp-form-grid">
              <label className="whatsapp-field whatsapp-field--full">
                <span>Assunto do funil</span>
                <input name="topic" value={funnelForm.topic} onChange={handleFunnelChange} placeholder="Ex: venda de consultoria, suporte premium, recuperacao de lead" />
              </label>
              <label className="whatsapp-field">
                <span>Produto ou oferta</span>
                <input name="product" value={funnelForm.product} onChange={handleFunnelChange} placeholder="Nome do produto" />
              </label>
              <label className="whatsapp-field">
                <span>Publico</span>
                <input name="audience" value={funnelForm.audience} onChange={handleFunnelChange} placeholder="Quem vai receber" />
              </label>
              <label className="whatsapp-field">
                <span>Objetivo</span>
                <input name="goal" value={funnelForm.goal} onChange={handleFunnelChange} />
              </label>
              <label className="whatsapp-field">
                <span>Etapas</span>
                <input type="number" min="3" max="10" name="steps" value={funnelForm.steps} onChange={handleFunnelChange} />
              </label>
            </div>
            <button type="button" className="btn-primary" onClick={handleGenerateFunnel} disabled={generating}>
              <Sparkles size={16} />
              {generating ? 'Gerando...' : 'Gerar funil'}
            </button>

            {generatedPlan ? (
              <div className="whatsapp-generated-plan">
                <strong>{generatedPlan.topic}</strong>
                {generatedPlan.messages.map((message) => (
                  <div key={`${generatedPlan.id}_${message.step}`} className="whatsapp-plan-step">
                    <span>{message.step}. {message.stage}</span>
                    <p>{message.draft}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </article>

          <article className="content-section whatsapp-panel">
            <div className="whatsapp-panel__header">
              <div>
                <h2>Canvas operacional</h2>
                <p>Estrutura inicial dos fluxos conectando frase, mensagem, decisao e handoff.</p>
              </div>
            </div>
            <div className="whatsapp-canvas-lanes">
              {(canvasData?.nodes || []).map((node) => (
                <div key={node.id} className="whatsapp-canvas-node">
                  <div className="whatsapp-canvas-node__top">
                    <span className="whatsapp-canvas-node__type">{node.type}</span>
                    <CheckCircle2 size={14} />
                  </div>
                  <strong>{node.label}</strong>
                  <p>{node.description}</p>
                </div>
              ))}
            </div>
            <div className="whatsapp-canvas-links">
              <div className="whatsapp-panel__subheader">
                <Network size={16} />
                <span>Conexoes previstas</span>
              </div>
              <ul>
                {(canvasData?.edges || []).map((edge) => (
                  <li key={edge.id}>
                    <span>{edge.source_label}</span>
                    <span className="whatsapp-canvas-arrow">→</span>
                    <span>{edge.target_label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="whatsapp-funnel-history">
              <strong>Funis salvos</strong>
              {(funnels || []).slice(0, 5).map((funnel) => (
                <button key={funnel.id} type="button" onClick={() => setGeneratedPlan(funnel)}>
                  <span>{funnel.topic}</span>
                  <small>{funnel.status}</small>
                </button>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <section className="content-section whatsapp-panel">
          <div className="whatsapp-panel__header">
            <div>
              <h2>Configuracao base</h2>
              <p>Campos operacionais do modulo WhatsApp. Mantidos fora dos outros paines.</p>
            </div>
          </div>
          <div className="whatsapp-form-grid">
            <label className="whatsapp-field">
              <span>Nome do workspace</span>
              <input type="text" name="workspace_name" value={formData.workspace_name} onChange={handleChange} placeholder="HF WhatsApp Hub" />
            </label>
            <label className="whatsapp-field">
              <span>Business Account ID</span>
              <input type="text" name="business_account_id" value={formData.business_account_id} onChange={handleChange} placeholder="123456789012345" />
            </label>
            <label className="whatsapp-field">
              <span>Phone Number ID</span>
              <input type="text" name="phone_number_id" value={formData.phone_number_id} onChange={handleChange} placeholder="109876543210987" />
            </label>
            <label className="whatsapp-field">
              <span>Verify token do webhook</span>
              <input type="text" name="verify_token" value={formData.verify_token} onChange={handleChange} placeholder="token-de-validacao" />
            </label>
            <label className="whatsapp-field whatsapp-field--full">
              <span>Caminho do webhook</span>
              <input type="text" name="webhook_path" value={formData.webhook_path} onChange={handleChange} placeholder="/api/whatsapp/webhook" />
            </label>
          </div>
          <label className="whatsapp-toggle">
            <input type="checkbox" name="auto_reply_enabled" checked={formData.auto_reply_enabled} onChange={handleChange} />
            <span>Permitir respostas automaticas supervisionadas</span>
          </label>
          <div className="whatsapp-form-actions">
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar configuracao'}
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === 'diagnostics' ? (
        <section className="whatsapp-hub-grid">
          <article className="content-section whatsapp-panel">
            <div className="whatsapp-panel__header">
              <div>
                <h2>Saude do modulo</h2>
                <p>Diagnostico rapido do backend, webhook e configuracao Meta.</p>
              </div>
            </div>
            <div className="whatsapp-health-list">
              <div className="whatsapp-health-row"><span>App Meta</span><strong>{healthData?.meta?.app_id_present ? 'presente' : 'ausente'}</strong></div>
              <div className="whatsapp-health-row"><span>Token de acesso</span><strong>{healthData?.meta?.access_token_present ? 'presente' : 'ausente'}</strong></div>
              <div className="whatsapp-health-row"><span>Business Account ID</span><strong>{healthData?.meta?.business_account_id_present ? 'presente' : 'ausente'}</strong></div>
              <div className="whatsapp-health-row"><span>Phone Number ID</span><strong>{healthData?.meta?.phone_number_id_present ? 'presente' : 'ausente'}</strong></div>
              <div className="whatsapp-health-row"><span>LM Studio</span><strong>{healthData?.lm_studio?.status || 'offline'}</strong></div>
            </div>
          </article>
          <article className="content-section whatsapp-panel">
            <div className="whatsapp-panel__header">
              <div>
                <h2>Escopo atual</h2>
                <p>Estado real desta fase de construcao.</p>
              </div>
            </div>
            <div className="whatsapp-scope-grid">
              <div className="whatsapp-scope-card">
                <ShieldCheck size={18} />
                <strong>Disponivel</strong>
                <p>Menu, rota, configuracao, webhook base, inbox local, rascunho de resposta e funil supervisionado.</p>
              </div>
              <div className="whatsapp-scope-card">
                <MessageSquare size={18} />
                <strong>Proxima etapa</strong>
                <p>Conectar eventos reais do WhatsApp Cloud API, templates oficiais e envio aprovado pela Meta.</p>
              </div>
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}

export default WhatsAppHub;
