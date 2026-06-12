import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  BrainCircuit,
  CheckCircle2,
  GitBranch,
  Inbox,
  Link2,
  MessageSquare,
  MousePointer2,
  Network,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Webhook,
} from 'lucide-react';
import {
  fetchWhatsAppConversationMessages,
  fetchWhatsAppConversations,
  fetchWhatsAppFunnels,
  fetchWhatsAppHubData,
  generateWhatsAppFunnel,
  saveWhatsAppFlowCanvas,
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
  goal: 'qualificar e levar para atendimento humano',
  tone: 'direto, consultivo e persuasivo',
  steps: 5,
  provider: 'chatgpt',
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
  const canvasBoardRef = useRef(null);
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
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [draggingNodeId, setDraggingNodeId] = useState('');
  const [edgeForm, setEdgeForm] = useState({ source: '', target: '', label: 'proximo passo' });
  const [newNodeType, setNewNodeType] = useState('mensagem');

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
    if (!selectedNodeId && canvasData?.nodes?.length) {
      setSelectedNodeId(canvasData.nodes[0].id);
    }
  }, [canvasData, selectedNodeId]);

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

  const canvasNodes = canvasData?.nodes || [];
  const canvasEdges = canvasData?.edges || [];
  const selectedNode = useMemo(
    () => canvasNodes.find((node) => node.id === selectedNodeId) || canvasNodes[0] || null,
    [canvasNodes, selectedNodeId],
  );

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

  const updateCanvasNode = (nodeId, patch) => {
    setCanvasData((current) => {
      const safeCanvas = current || { nodes: [], edges: [], notes: '' };
      return {
        ...safeCanvas,
        nodes: (safeCanvas.nodes || []).map((node) => (
          node.id === nodeId ? { ...node, ...patch } : node
        )),
      };
    });
  };

  const addCanvasNode = () => {
    const nodeId = `node_${Date.now()}`;
    const nextNode = {
      id: nodeId,
      type: newNodeType,
      label: newNodeType === 'decisao' ? 'Nova decisao' : 'Nova mensagem',
      description: newNodeType === 'decisao'
        ? 'Defina a regra de escolha deste ponto do fluxo.'
        : 'Escreva aqui a frase ou mensagem deste bloco.',
      x: 90 + (canvasNodes.length % 3) * 260,
      y: 90 + Math.floor(canvasNodes.length / 3) * 170,
    };
    setCanvasData((current) => ({
      ...(current || { edges: [], notes: '' }),
      nodes: [...((current || {}).nodes || []), nextNode],
    }));
    setSelectedNodeId(nodeId);
  };

  const deleteCanvasNode = (nodeId) => {
    setCanvasData((current) => {
      const safeCanvas = current || { nodes: [], edges: [], notes: '' };
      const nextNodes = (safeCanvas.nodes || []).filter((node) => node.id !== nodeId);
      const nextEdges = (safeCanvas.edges || []).filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
      setSelectedNodeId(nextNodes[0]?.id || '');
      return { ...safeCanvas, nodes: nextNodes, edges: nextEdges };
    });
  };

  const addCanvasEdge = () => {
    if (!edgeForm.source || !edgeForm.target || edgeForm.source === edgeForm.target) {
      setError('Selecione uma origem e um destino diferentes para criar a conexao.');
      return;
    }

    const sourceNode = canvasNodes.find((node) => node.id === edgeForm.source);
    const targetNode = canvasNodes.find((node) => node.id === edgeForm.target);
    const edgeId = `edge_${edgeForm.source}_${edgeForm.target}_${Date.now()}`;
    const nextEdge = {
      id: edgeId,
      source: edgeForm.source,
      target: edgeForm.target,
      source_label: sourceNode?.label || edgeForm.source,
      target_label: targetNode?.label || edgeForm.target,
      label: edgeForm.label || 'proximo passo',
    };
    setCanvasData((current) => ({
      ...(current || { nodes: [], notes: '' }),
      edges: [...((current || {}).edges || []), nextEdge],
    }));
    setEdgeForm((current) => ({ ...current, target: '' }));
    setError('');
  };

  const deleteCanvasEdge = (edgeId) => {
    setCanvasData((current) => ({
      ...(current || { nodes: [], notes: '' }),
      edges: ((current || {}).edges || []).filter((edge) => edge.id !== edgeId),
    }));
  };

  const handleCanvasPointerMove = (event) => {
    if (!draggingNodeId || !canvasBoardRef.current) return;
    const bounds = canvasBoardRef.current.getBoundingClientRect();
    const x = Math.max(16, Math.min(Math.round(event.clientX - bounds.left - 95), Math.max(bounds.width - 230, 16)));
    const y = Math.max(16, Math.min(Math.round(event.clientY - bounds.top - 42), Math.max(bounds.height - 120, 16)));
    updateCanvasNode(draggingNodeId, { x, y });
  };

  const handleSaveCanvas = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const normalizedCanvas = {
        nodes: canvasNodes,
        edges: canvasEdges.map((edge) => {
          const sourceNode = canvasNodes.find((node) => node.id === edge.source);
          const targetNode = canvasNodes.find((node) => node.id === edge.target);
          return {
            ...edge,
            source_label: sourceNode?.label || edge.source_label || edge.source,
            target_label: targetNode?.label || edge.target_label || edge.target,
          };
        }),
        notes: canvasData?.notes || '',
      };
      const response = await saveWhatsAppFlowCanvas(normalizedCanvas);
      setCanvasData(response.canvas);
      setNotice('Canvas salvo.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const applyGeneratedPlanToCanvas = () => {
    if (!generatedPlan) return;
    setCanvasData((current) => ({
      ...(current || { notes: '' }),
      nodes: generatedPlan.nodes || [],
      edges: generatedPlan.edges || [],
      notes: `Funil aplicado: ${generatedPlan.topic}`,
    }));
    setSelectedNodeId(generatedPlan.nodes?.[0]?.id || '');
    setNotice('Funil aplicado no canvas. Revise e salve para persistir.');
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
      setCanvasData((current) => ({
        ...(current || { notes: '' }),
        nodes: response.plan.nodes || [],
        edges: response.plan.edges || [],
        notes: `Funil aplicado: ${response.plan.topic}`,
      }));
      setSelectedNodeId(response.plan.nodes?.[0]?.id || '');
      setNotice(response.plan.warning || 'Funil criado e aplicado no canvas.');
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
        <section className="whatsapp-manychat-workspace">
          <article className="content-section whatsapp-panel whatsapp-ai-command">
            <div className="whatsapp-panel__header">
              <div>
                <h2>Construtor inteligente</h2>
                <p>Descreva o funil. O sistema monta os blocos no canvas para voce editar.</p>
              </div>
              <button type="button" className="btn-primary" onClick={handleGenerateFunnel} disabled={generating}>
                <Sparkles size={16} />
                {generating ? 'Gerando...' : 'Gerar e montar'}
              </button>
            </div>

            <div className="whatsapp-ai-grid">
              <label className="whatsapp-field">
                <span>Gerar com</span>
                <select name="provider" value={funnelForm.provider} onChange={handleFunnelChange}>
                  <option value="chatgpt">ChatGPT</option>
                  <option value="local">Gerador local</option>
                </select>
              </label>

              <label className="whatsapp-field whatsapp-ai-grid__topic">
                <span>Assunto principal</span>
                <input name="topic" value={funnelForm.topic} onChange={handleFunnelChange} placeholder="Ex: venda de consultoria, suporte premium, recuperacao de lead" />
              </label>

              <label className="whatsapp-field">
                <span>Produto / oferta</span>
                <input name="product" value={funnelForm.product} onChange={handleFunnelChange} placeholder="Nome do produto" />
              </label>

              <label className="whatsapp-field">
                <span>Publico</span>
                <input name="audience" value={funnelForm.audience} onChange={handleFunnelChange} placeholder="Quem vai receber" />
              </label>

              <label className="whatsapp-field whatsapp-ai-grid__goal">
                <span>Resultado desejado</span>
                <select name="goal" value={funnelForm.goal} onChange={handleFunnelChange}>
                  <option value="qualificar e levar para atendimento humano">Qualificar e levar para humano</option>
                  <option value="vender uma oferta pelo WhatsApp">Vender uma oferta</option>
                  <option value="recuperar lead parado">Recuperar lead parado</option>
                  <option value="tirar duvidas e enviar link">Tirar duvidas e enviar link</option>
                  <option value="agendar diagnostico ou reuniao">Agendar diagnostico/reuniao</option>
                </select>
              </label>

              <label className="whatsapp-field">
                <span>Etapas</span>
                <input type="number" min="3" max="10" name="steps" value={funnelForm.steps} onChange={handleFunnelChange} />
              </label>
            </div>

            {generatedPlan ? (
              <div className="whatsapp-generated-plan">
                <div className="whatsapp-generated-plan__header">
                  <div>
                    <strong>{generatedPlan.topic}</strong>
                    <span>{generatedPlan.provider === 'chatgpt' ? 'Gerado com ChatGPT' : 'Gerado localmente'}</span>
                  </div>
                  <button type="button" className="refresh-button" onClick={applyGeneratedPlanToCanvas}>
                    Aplicar no canvas
                  </button>
                </div>
                {generatedPlan.messages.map((message) => (
                  <div key={`${generatedPlan.id}_${message.step}`} className="whatsapp-plan-step">
                    <span>{message.step}. {message.stage}</span>
                    <p>{message.draft}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </article>

          <article className="content-section whatsapp-panel whatsapp-flow-shell">
            <div className="whatsapp-panel__header">
              <div>
                <h2>Canvas construtor de fluxo</h2>
                <p>Crie blocos, arraste no quadro, edite as mensagens e conecte cada etapa.</p>
              </div>
              <button type="button" className="btn-primary" onClick={handleSaveCanvas} disabled={saving || canvasNodes.length === 0}>
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar canvas'}
              </button>
            </div>

            <div className="whatsapp-flow-toolbar">
              <label>
                <span>Tipo de bloco</span>
                <select value={newNodeType} onChange={(event) => setNewNodeType(event.target.value)}>
                  <option value="mensagem">Mensagem</option>
                  <option value="decisao">Decisao</option>
                  <option value="imagem">Imagem</option>
                  <option value="link">Link</option>
                  <option value="handoff">Humano</option>
                </select>
              </label>
              <button type="button" className="refresh-button" onClick={addCanvasNode}>
                <Plus size={16} />
                Novo bloco
              </button>
            </div>

            <div className="whatsapp-flow-builder">
              <div
                className="whatsapp-flow-board"
                ref={canvasBoardRef}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={() => setDraggingNodeId('')}
                onPointerLeave={() => setDraggingNodeId('')}
              >
                <div className="whatsapp-flow-board__hint">
                  <MousePointer2 size={14} />
                  Clique para editar. Arraste para organizar.
                </div>

                {canvasEdges.map((edge) => {
                  const sourceNode = canvasNodes.find((node) => node.id === edge.source);
                  const targetNode = canvasNodes.find((node) => node.id === edge.target);
                  if (!sourceNode || !targetNode) return null;
                  const sourceX = Number(sourceNode.x || 0) + 96;
                  const sourceY = Number(sourceNode.y || 0) + 42;
                  const targetX = Number(targetNode.x || 0) + 96;
                  const targetY = Number(targetNode.y || 0) + 42;
                  const left = Math.min(sourceX, targetX);
                  const top = Math.min(sourceY, targetY);
                  const width = Math.abs(targetX - sourceX) || 2;
                  const height = Math.abs(targetY - sourceY) || 2;
                  return (
                    <div
                      key={edge.id}
                      className="whatsapp-flow-edge"
                      style={{
                        left,
                        top,
                        width,
                        height,
                      }}
                    >
                      <span>{edge.label || 'proximo'}</span>
                    </div>
                  );
                })}

                {canvasNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className={`whatsapp-flow-node whatsapp-flow-node--${node.type} ${selectedNode?.id === node.id ? 'active' : ''}`}
                    style={{ left: Number(node.x || 40), top: Number(node.y || 40) }}
                    onClick={() => setSelectedNodeId(node.id)}
                    onPointerDown={(event) => {
                      setSelectedNodeId(node.id);
                      setDraggingNodeId(node.id);
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                    }}
                  >
                    <span>{node.type}</span>
                    <strong>{node.label}</strong>
                    <small>{node.description}</small>
                  </button>
                ))}
              </div>

              <aside className="whatsapp-flow-inspector">
                <div className="whatsapp-panel__subheader">
                  <MessageSquare size={16} />
                  <span>Editar bloco</span>
                </div>

                {selectedNode ? (
                  <>
                    <label className="whatsapp-field">
                      <span>Nome do bloco</span>
                      <input
                        value={selectedNode.label}
                        onChange={(event) => updateCanvasNode(selectedNode.id, { label: event.target.value })}
                      />
                    </label>

                    <label className="whatsapp-field">
                      <span>Tipo</span>
                      <select value={selectedNode.type} onChange={(event) => updateCanvasNode(selectedNode.id, { type: event.target.value })}>
                        <option value="mensagem">Mensagem</option>
                        <option value="decisao">Decisao</option>
                        <option value="imagem">Imagem</option>
                        <option value="link">Link</option>
                        <option value="handoff">Humano</option>
                      </select>
                    </label>

                    <label className="whatsapp-field">
                      <span>Mensagem / acao</span>
                      <textarea
                        value={selectedNode.description}
                        onChange={(event) => updateCanvasNode(selectedNode.id, { description: event.target.value })}
                        rows="5"
                      />
                    </label>

                    <button type="button" className="disconnect-button" onClick={() => deleteCanvasNode(selectedNode.id)}>
                      <Trash2 size={16} />
                      Apagar bloco
                    </button>
                  </>
                ) : (
                  <div className="whatsapp-empty-panel">Nenhum bloco selecionado.</div>
                )}

                <div className="whatsapp-flow-connector">
                  <div className="whatsapp-panel__subheader">
                    <Link2 size={16} />
                    <span>Criar conexao</span>
                  </div>

                  <label className="whatsapp-field">
                    <span>Origem</span>
                    <select value={edgeForm.source} onChange={(event) => setEdgeForm((current) => ({ ...current, source: event.target.value }))}>
                      <option value="">Escolher origem</option>
                      {canvasNodes.map((node) => (
                        <option key={node.id} value={node.id}>{node.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="whatsapp-field">
                    <span>Destino</span>
                    <select value={edgeForm.target} onChange={(event) => setEdgeForm((current) => ({ ...current, target: event.target.value }))}>
                      <option value="">Escolher destino</option>
                      {canvasNodes.map((node) => (
                        <option key={node.id} value={node.id}>{node.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="whatsapp-field">
                    <span>Nome da conexao</span>
                    <input value={edgeForm.label} onChange={(event) => setEdgeForm((current) => ({ ...current, label: event.target.value }))} />
                  </label>

                  <button type="button" className="refresh-button" onClick={addCanvasEdge}>
                    <Plus size={16} />
                    Conectar
                  </button>
                </div>

                <div className="whatsapp-canvas-links">
                  <div className="whatsapp-panel__subheader">
                    <Network size={16} />
                    <span>Conexoes</span>
                  </div>
                  <ul>
                    {canvasEdges.map((edge) => (
                      <li key={edge.id}>
                        <span>{edge.source_label}</span>
                        <span className="whatsapp-canvas-arrow">→</span>
                        <span>{edge.target_label}</span>
                        <button type="button" onClick={() => deleteCanvasEdge(edge.id)} aria-label="Apagar conexao">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
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
