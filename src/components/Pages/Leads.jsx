import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronUp, Database, Download, FolderUp, Loader, RefreshCw, Save, Send, Square, Trash2, Users, Wand2 } from 'lucide-react';
import { apiUrl } from '../../config/api';
import './Pages.css';
import './Leads.css';

const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';
const LEAD_MESSAGE_TEMPLATES_KEY = 'alliance_dark_lead_message_templates';
const DEFAULT_RESPONDER_AGENT_CONFIG = {
  enabled: true,
  assistant_name: 'CRONOS Responder',
  api_key: '',
  model: 'gpt-4o-mini',
  usage: 'Leads e mensagens',
  system_prompt: '',
};

function Leads() {
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storageMode, setStorageMode] = useState('local');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [busyAction, setBusyAction] = useState('');
  const [mergeFoldersUntilLimit, setMergeFoldersUntilLimit] = useState(true);
  const [openedFolderId, setOpenedFolderId] = useState('');
  const [folderMessage, setFolderMessage] = useState('');
  const [folderImageUrl, setFolderImageUrl] = useState('');
  const [folderAudioUrl, setFolderAudioUrl] = useState('');
  const [folderVideoUrl, setFolderVideoUrl] = useState('');
  const [folderCustomLink, setFolderCustomLink] = useState('');
  const [folderLocalAssets, setFolderLocalAssets] = useState({
    image: null,
    audio: null,
        video: null,
  });
  const [folderSelectedLeadIds, setFolderSelectedLeadIds] = useState([]);
  const [folderGeneratedMessages, setFolderGeneratedMessages] = useState({});
  const [folderLeadStatuses, setFolderLeadStatuses] = useState({});
  const [folderSendIntervalSeconds, setFolderSendIntervalSeconds] = useState(3);
  const [folderBatchRunning, setFolderBatchRunning] = useState(false);
  const [folderBatchProgress, setFolderBatchProgress] = useState({
    total: 0,
    processed: 0,
    sent: 0,
    errors: 0,
  });
  const [folderBatchNotice, setFolderBatchNotice] = useState('');
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [masterMessageGenerating, setMasterMessageGenerating] = useState(false);
  const [responderAgentOpen, setResponderAgentOpen] = useState(false);
  const [responderAgentSaving, setResponderAgentSaving] = useState(false);
  const [responderAgentConfig, setResponderAgentConfig] = useState(DEFAULT_RESPONDER_AGENT_CONFIG);
  const [integrationDefaults, setIntegrationDefaults] = useState({});
  const folderBatchStopRef = useRef(false);

  const getAuthHeaders = () => {
    const authToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  };

  const loadResponderAgentConfig = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/integrations/settings'), {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao carregar CRONOS Responder');
      }
      setIntegrationDefaults(data.defaults || {});
      setResponderAgentConfig({
        ...DEFAULT_RESPONDER_AGENT_CONFIG,
        ...(data.defaults?.cronos_responder_agent || {}),
      });
    } catch (err) {
      setError(err.message || 'Erro ao carregar CRONOS Responder');
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = selectedPlatform !== 'all' ? `?platform=${encodeURIComponent(selectedPlatform)}` : '';
      const response = await fetch(apiUrl(`/api/leads/${query}`), {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao carregar leads');
      }
      setItems(data.items || []);
      setStorageMode(data.storage || 'local');
      setSelectedIds((current) => current.filter((id) => (data.items || []).some((item) => item.id === id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedPlatform]);

  const loadFolders = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/leads/folders'), {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao carregar pastas');
      }
      setFolders(data.items || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadResponderAgentConfig();
  }, [loadResponderAgentConfig]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LEAD_MESSAGE_TEMPLATES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setMessageTemplates(Array.isArray(parsed) ? parsed : []);
    } catch (err) {
      setMessageTemplates([]);
    }
  }, []);

  const groupedLeads = useMemo(() => {
    const groups = new Map();
    items.forEach((item) => {
      const key = `${item.platform}:${item.source_account_id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          platform: item.platform,
          sourceAccountName: item.source_account_name,
          sourceAccountId: item.source_account_id,
          items: [],
        });
      }
      groups.get(key).items.push(item);
    });
    return Array.from(groups.values());
  }, [items]);

  const openedFolder = useMemo(
    () => folders.find((folder) => folder.id === openedFolderId) || null,
    [folders, openedFolderId],
  );

  const toggleLead = (leadId) => {
    setSelectedIds((current) => (
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId]
    ));
  };

  const toggleGroup = (group) => {
    const groupIds = group.items.map((item) => item.id);
    const allSelected = groupIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => (
      allSelected
        ? current.filter((id) => !groupIds.includes(id))
        : Array.from(new Set([...current, ...groupIds]))
    ));
  };

  const applySelection = async (selected) => {
    if (selectedIds.length === 0) return;
    setBusyAction(selected ? 'select' : 'unselect');
    setError('');
    try {
      const response = await fetch(apiUrl('/api/leads/bulk-selection'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ ids: selectedIds, selected }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao marcar seleção');
      }
      await loadLeads();
      await loadFolders();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAction('');
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Remover ${selectedIds.length} lead(s)?`)) return;

    setBusyAction('delete');
    setError('');
    try {
      const response = await fetch(apiUrl('/api/leads/bulk-delete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao remover leads');
      }
      setSelectedIds([]);
      await loadLeads();
      await loadFolders();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAction('');
    }
  };

  const archiveSelected = async () => {
    if (selectedIds.length === 0) return;
    setBusyAction('archive');
    setError('');
    try {
      const response = await fetch(apiUrl('/api/leads/archive-selection'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ ids: selectedIds, merge_until_limit: mergeFoldersUntilLimit }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao salvar pasta');
      }
      setSelectedIds([]);
      await Promise.all([loadLeads(), loadFolders()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAction('');
    }
  };

  const restoreFolder = async (folder) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Voltar os leads da pasta "${folder.name}" para a lista ativa?`)) return;

    setBusyAction(`restore_${folder.id}`);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/leads/restore-folder'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ folder_id: folder.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao voltar a pasta');
      }
      if (openedFolderId === folder.id) {
        setOpenedFolderId('');
      }
      await Promise.all([loadLeads(), loadFolders()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAction('');
    }
  };

  const openFolder = (folder) => {
    setOpenedFolderId(folder.id);
    setFolderMessage((current) => (
      current
      || 'Ola, vi seu comentario e estou entrando em contato com uma mensagem direta. Se quiser, me responda aqui.'
    ));
    setFolderImageUrl('');
    setFolderAudioUrl('');
    setFolderVideoUrl('');
    setFolderCustomLink('');
    setFolderLocalAssets({
      image: null,
      audio: null,
      video: null,
    });
    setFolderSelectedLeadIds([]);
    setFolderGeneratedMessages({});
    setFolderLeadStatuses({});
    setFolderBatchProgress({
      total: 0,
      processed: 0,
      sent: 0,
      errors: 0,
    });
    setFolderBatchNotice('');
    setSelectedTemplateId('');
    setCopySuccess('');
  };

  const persistTemplates = (templates) => {
    setMessageTemplates(templates);
    window.localStorage.setItem(LEAD_MESSAGE_TEMPLATES_KEY, JSON.stringify(templates));
  };

  const saveMessageTemplate = () => {
    const templateName = window.prompt('Nome do modelo:');
    if (!templateName || !templateName.trim()) return;

    const nextTemplate = {
      id: `template_${Date.now()}`,
      name: templateName.trim(),
      message: folderMessage,
      imageUrl: folderImageUrl,
      audioUrl: folderAudioUrl,
      videoUrl: folderVideoUrl,
      customLink: folderCustomLink,
      createdAt: new Date().toISOString(),
    };

    const nextTemplates = [nextTemplate, ...messageTemplates].slice(0, 30);
    persistTemplates(nextTemplates);
    setSelectedTemplateId(nextTemplate.id);
    setCopySuccess('Modelo salvo.');
    window.setTimeout(() => setCopySuccess(''), 2000);
  };

  const applyMessageTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    const template = messageTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setFolderMessage(template.message || '');
    setFolderImageUrl(template.imageUrl || '');
    setFolderAudioUrl(template.audioUrl || '');
    setFolderVideoUrl(template.videoUrl || '');
    setFolderCustomLink(template.customLink || '');
    setCopySuccess('Modelo aplicado.');
    window.setTimeout(() => setCopySuccess(''), 2000);
  };

  const generateMasterLeadMessage = async () => {
    if (!openedFolder) {
      setError('Abra uma pasta de leads antes de gerar a mensagem.');
      return;
    }

    const selectedLeads = (openedFolder.items || []).filter((item) => folderSelectedLeadIds.includes(item.id));
    const contextLeads = selectedLeads.length > 0 ? selectedLeads : (openedFolder.items || []).slice(0, 10);

    setMasterMessageGenerating(true);
    setError('');
    setCopySuccess('');
    try {
      const response = await fetch(apiUrl('/api/leads/generate-master-message'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          folder_name: openedFolder.name || '',
          platform: openedFolder.platform || '',
          source_account_name: openedFolder.source_account_name || '',
          base_instruction: folderMessage || 'Gerar uma mensagem de acompanhamento para contatos que comentaram no video.',
          selected_leads: contextLeads,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao gerar mensagem com CRONOS Mestre');
      }
      setFolderMessage(data.message || '');
      setCopySuccess('Mensagem gerada com CRONOS Mestre.');
      window.setTimeout(() => setCopySuccess(''), 2500);
    } catch (err) {
      setError(err.message || 'Erro ao gerar mensagem com CRONOS Mestre');
    } finally {
      setMasterMessageGenerating(false);
    }
  };

  const copyFolderMessage = async () => {
    if (!folderMessage.trim()) return;
    const finalParts = [folderMessage.trim()];
    if (folderImageUrl.trim()) {
      finalParts.push(`Imagem: ${folderImageUrl.trim()}`);
    } else if (folderLocalAssets.image?.name) {
      finalParts.push(`Imagem: arquivo local (${folderLocalAssets.image.name})`);
    }
    if (folderAudioUrl.trim()) {
      finalParts.push(`Audio: ${folderAudioUrl.trim()}`);
    } else if (folderLocalAssets.audio?.name) {
      finalParts.push(`Audio: arquivo local (${folderLocalAssets.audio.name})`);
    }
    if (folderVideoUrl.trim()) {
      finalParts.push(`Video: ${folderVideoUrl.trim()}`);
    } else if (folderLocalAssets.video?.name) {
      finalParts.push(`Video: arquivo local (${folderLocalAssets.video.name})`);
    }
    if (folderCustomLink.trim()) {
      finalParts.push(`Link: ${folderCustomLink.trim()}`);
    }
    const finalMessage = finalParts.join('\n\n');
    try {
      await navigator.clipboard.writeText(finalMessage);
      setCopySuccess('Mensagem copiada.');
      window.setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      setError('Nao foi possivel copiar a mensagem.');
    }
  };

  const buildLeadMessage = (lead) => {
    const finalParts = [
      `Ola ${lead.author_name},`,
      folderMessage.trim(),
    ].filter(Boolean);

    if (folderImageUrl.trim()) {
      finalParts.push(`Imagem: ${folderImageUrl.trim()}`);
    }
    if (folderAudioUrl.trim()) {
      finalParts.push(`Audio: ${folderAudioUrl.trim()}`);
    }
    if (folderVideoUrl.trim()) {
      finalParts.push(`Video: ${folderVideoUrl.trim()}`);
    }
    if (folderCustomLink.trim()) {
      finalParts.push(`Link: ${folderCustomLink.trim()}`);
    }

    return finalParts.join('\n\n');
  };

  const toggleFolderLead = (leadId) => {
    setFolderSelectedLeadIds((current) => (
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId]
    ));
  };

  const toggleAllFolderLeads = () => {
    if (!openedFolder?.items?.length) return;
    const leadIds = openedFolder.items.map((item) => item.id);
    const allSelected = leadIds.every((id) => folderSelectedLeadIds.includes(id));
    setFolderSelectedLeadIds(allSelected ? [] : leadIds);
  };

  const generateFolderMessages = () => {
    if (!openedFolder || folderSelectedLeadIds.length === 0) {
      setError('Selecione pelo menos um lead da pasta para gerar as mensagens.');
      return;
    }
    if (!folderMessage.trim()) {
      setError('Escreva a mensagem base antes de gerar o lote.');
      return;
    }

    const nextMessages = {};
    openedFolder.items
      .filter((item) => folderSelectedLeadIds.includes(item.id))
      .forEach((lead) => {
        nextMessages[lead.id] = buildLeadMessage(lead);
      });

    setFolderGeneratedMessages((current) => ({
      ...current,
      ...nextMessages,
    }));
    setFolderBatchNotice(`${Object.keys(nextMessages).length} mensagem(ns) preparada(s) para envio.`);
    setError('');
  };

  const wait = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

  const runFolderBatch = async () => {
    if (!openedFolder || folderSelectedLeadIds.length === 0) {
      setError('Selecione os leads da pasta antes de iniciar o envio em lote.');
      return;
    }

    const selectedLeads = openedFolder.items.filter((item) => folderSelectedLeadIds.includes(item.id));
    const missingMessages = selectedLeads.some((lead) => !folderGeneratedMessages[lead.id]?.trim());
    if (missingMessages) {
      setError('Gere as mensagens dos leads selecionados antes de iniciar o lote.');
      return;
    }

    const safeIntervalSeconds = Math.max(1, Math.min(Number(folderSendIntervalSeconds) || 1, 300));
    const intervalMs = safeIntervalSeconds * 1000;

    setError('');
    setFolderBatchNotice('');
    setFolderBatchRunning(true);
    folderBatchStopRef.current = false;
    setFolderBatchProgress({
      total: selectedLeads.length,
      processed: 0,
      sent: 0,
      errors: 0,
    });

    for (let index = 0; index < selectedLeads.length; index += 1) {
      if (folderBatchStopRef.current) {
        break;
      }

      const lead = selectedLeads[index];
      setFolderLeadStatuses((current) => ({
        ...current,
        [lead.id]: 'sending',
      }));

      try {
        await wait(250);
        setFolderLeadStatuses((current) => ({
          ...current,
          [lead.id]: 'sent',
        }));
        setFolderBatchProgress((current) => ({
          ...current,
          processed: current.processed + 1,
          sent: current.sent + 1,
        }));
      } catch (err) {
        setFolderLeadStatuses((current) => ({
          ...current,
          [lead.id]: 'error',
        }));
        setFolderBatchProgress((current) => ({
          ...current,
          processed: current.processed + 1,
          errors: current.errors + 1,
        }));
      }

      if (index < selectedLeads.length - 1 && !folderBatchStopRef.current) {
        await wait(intervalMs);
      }
    }

    setFolderBatchRunning(false);
    setFolderBatchNotice(folderBatchStopRef.current ? 'Envio em lote interrompido.' : 'Envio em lote concluido.');
  };

  const stopFolderBatch = () => {
    folderBatchStopRef.current = true;
    setFolderBatchRunning(false);
  };

  const triggerAssetDownload = async (url, fallbackName) => {
    if (!url.trim()) return;
    try {
      const response = await fetch(url.trim());
      if (!response.ok) {
        throw new Error('download_failed');
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fallbackName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(url.trim(), '_blank', 'noopener,noreferrer');
    }
  };

  const getMediaPreviewType = (url) => {
    const normalized = (url || '').trim().toLowerCase();
    if (!normalized) return '';
    if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/.test(normalized)) return 'image';
    if (/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/.test(normalized)) return 'audio';
    if (/\.(mp4|webm|mov|m4v)(\?.*)?$/.test(normalized)) return 'video';
    return 'link';
  };

  const handleLocalAssetPick = (assetKey, file) => {
    if (!file) return;
    const objectUrl = window.URL.createObjectURL(file);
    setFolderLocalAssets((current) => {
      if (current[assetKey]?.previewUrl) {
        window.URL.revokeObjectURL(current[assetKey].previewUrl);
      }
      return {
        ...current,
        [assetKey]: {
          name: file.name,
          previewUrl: objectUrl,
          type: file.type || '',
        },
      };
    });
  };

  const renderAssetField = ({ id, label, value, onChange, placeholder, fallbackName, assetKey = '' }) => {
    const previewType = getMediaPreviewType(value);
    const localAsset = assetKey ? folderLocalAssets[assetKey] : null;
    const localPreviewType = localAsset?.type?.startsWith('image/')
      ? 'image'
      : localAsset?.type?.startsWith('audio/')
        ? 'audio'
        : localAsset?.type?.startsWith('video/')
          ? 'video'
          : '';
    return (
      <div className="lead-folder-detail__field lead-folder-detail__field-compact">
        <label htmlFor={id}>{label}</label>
        <div className="lead-folder-detail__field-row">
          <input
            id={id}
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
          />
          <div className="lead-folder-detail__field-buttons">
            <button
              type="button"
              className="refresh-button lead-folder-detail__download-button"
              onClick={() => triggerAssetDownload(value, fallbackName)}
              disabled={!value.trim()}
              title="Baixar"
              aria-label="Baixar"
            >
              <Download size={15} />
            </button>
            {assetKey ? (
              <>
                <input
                  id={`${id}-file`}
                  type="file"
                  className="lead-folder-detail__file-input"
                  accept={
                    assetKey === 'audio'
                      ? 'audio/*'
                      : assetKey === 'image'
                        ? 'image/*'
                        : assetKey === 'video'
                          ? 'video/*'
                          : 'image/*,video/*'
                  }
                  onChange={(event) => handleLocalAssetPick(assetKey, event.target.files?.[0])}
                />
                <label
                  htmlFor={`${id}-file`}
                  className="refresh-button lead-folder-detail__download-button lead-folder-detail__download-label"
                  title="Da maquina"
                  aria-label="Da maquina"
                >
                  <FolderUp size={15} />
                </label>
              </>
            ) : null}
          </div>
        </div>

        {previewType === 'image' ? (
          <div className="lead-folder-detail__preview">
            <img src={value} alt={label} />
          </div>
        ) : null}

        {previewType === 'audio' ? (
          <div className="lead-folder-detail__preview">
            <audio controls preload="none" src={value}>
              Seu navegador não suporta áudio.
            </audio>
          </div>
        ) : null}

        {previewType === 'video' ? (
          <div className="lead-folder-detail__preview">
            <video controls preload="metadata" src={value} />
          </div>
        ) : null}

        {previewType === 'link' && value.trim() ? (
          <div className="lead-folder-detail__link-preview">
            <a href={value.trim()} target="_blank" rel="noreferrer">
              {value.trim()}
            </a>
          </div>
        ) : null}

        {!value.trim() && localAsset?.previewUrl && localPreviewType === 'image' ? (
          <div className="lead-folder-detail__preview">
            <img src={localAsset.previewUrl} alt={label} />
          </div>
        ) : null}

        {!value.trim() && localAsset?.previewUrl && localPreviewType === 'audio' ? (
          <div className="lead-folder-detail__preview">
            <audio controls preload="none" src={localAsset.previewUrl}>
              Seu navegador não suporta áudio.
            </audio>
          </div>
        ) : null}

        {!value.trim() && localAsset?.previewUrl && localPreviewType === 'video' ? (
          <div className="lead-folder-detail__preview">
            <video controls preload="metadata" src={localAsset.previewUrl} />
          </div>
        ) : null}

        {!value.trim() && localAsset?.name ? (
          <div className="lead-folder-detail__link-preview">
            <span>{localAsset.name}</span>
          </div>
        ) : null}
      </div>
    );
  };

  const saveResponderAgentConfig = async () => {
    setResponderAgentSaving(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/integrations/settings/global'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          tools: {
            ...integrationDefaults,
            cronos_responder_agent: responderAgentConfig,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao salvar CRONOS Responder');
      }
      setIntegrationDefaults(data.defaults || {});
      setResponderAgentConfig({
        ...DEFAULT_RESPONDER_AGENT_CONFIG,
        ...(data.defaults?.cronos_responder_agent || responderAgentConfig),
      });
      setCopySuccess('CRONOS Responder salvo.');
      window.setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      setError(err.message || 'Erro ao salvar CRONOS Responder');
    } finally {
      setResponderAgentSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          <p>Lista geral separada por rede e conta de origem, sem misturar os contatos de cada canal.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <section className={`leads-config-card ${responderAgentOpen ? 'open' : ''}`}>
        <div className="leads-config-card__header">
          <div>
            <h2>CRONOS Responder</h2>
            <p>Agente separado do CRONOS central. Uso exclusivo do módulo Leads.</p>
          </div>
          <button type="button" className="refresh-button" onClick={() => setResponderAgentOpen((current) => !current)}>
            {responderAgentOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {responderAgentOpen ? 'Minimizar' : 'Abrir'}
          </button>
        </div>

        {responderAgentOpen && (
          <div className="leads-config-card__body">
            <div className="leads-config-grid">
              <label className="leads-filter leads-config-field">
                <span>Nome do agente</span>
                <input
                  type="text"
                  value={responderAgentConfig.assistant_name || ''}
                  onChange={(event) => setResponderAgentConfig((current) => ({ ...current, assistant_name: event.target.value }))}
                />
              </label>
              <label className="leads-filter leads-config-field">
                <span>Modelo</span>
                <input
                  type="text"
                  value={responderAgentConfig.model || ''}
                  onChange={(event) => setResponderAgentConfig((current) => ({ ...current, model: event.target.value }))}
                />
              </label>
              <label className="leads-filter leads-config-field">
                <span>Uso</span>
                <input
                  type="text"
                  value={responderAgentConfig.usage || ''}
                  onChange={(event) => setResponderAgentConfig((current) => ({ ...current, usage: event.target.value }))}
                />
              </label>
              <label className="leads-filter leads-config-field">
                <span>API do GBT</span>
                <input
                  type="password"
                  value={responderAgentConfig.api_key || ''}
                  placeholder="sk-proj-..."
                  onChange={(event) => setResponderAgentConfig((current) => ({ ...current, api_key: event.target.value }))}
                />
              </label>
              <label className="leads-filter leads-config-field leads-config-field--full">
                <span>Prompt do agente</span>
                <textarea
                  value={responderAgentConfig.system_prompt || ''}
                  onChange={(event) => setResponderAgentConfig((current) => ({ ...current, system_prompt: event.target.value }))}
                  rows={8}
                />
              </label>
            </div>
            <div className="leads-config-card__actions">
              <button type="button" className="connect-button" onClick={saveResponderAgentConfig} disabled={responderAgentSaving}>
                {responderAgentSaving ? <Loader size={16} className="spinner" /> : <Save size={16} />}
                Salvar CRONOS Responder
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="leads-toolbar">
        <div className="leads-toolbar__left">
          <div className="leads-filter">
            <label htmlFor="platform-filter">Rede</label>
            <select id="platform-filter" value={selectedPlatform} onChange={(event) => setSelectedPlatform(event.target.value)}>
              <option value="all">Todas</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
            </select>
          </div>

          <div className="leads-storage-badge">
            <Database size={15} />
            <span>{storageMode === 'supabase' ? 'Supabase' : 'Local'}</span>
          </div>
        </div>

        <div className="leads-toolbar__actions">
          <label className="leads-merge-toggle">
            <input
              type="checkbox"
              checked={mergeFoldersUntilLimit}
              onChange={(event) => setMergeFoldersUntilLimit(event.target.checked)}
            />
            <span>Agrupar até 200</span>
          </label>
          <button type="button" className="refresh-button" onClick={loadLeads} disabled={loading}>
            {loading ? <Loader size={16} className="spinner" /> : <RefreshCw size={16} />}
            Atualizar
          </button>
          <button type="button" className="refresh-button" onClick={() => applySelection(true)} disabled={busyAction === 'select' || selectedIds.length === 0}>
            {busyAction === 'select' ? <Loader size={16} className="spinner" /> : <CheckSquare size={16} />}
            Marcar
          </button>
          <button type="button" className="refresh-button" onClick={() => applySelection(false)} disabled={busyAction === 'unselect' || selectedIds.length === 0}>
            {busyAction === 'unselect' ? <Loader size={16} className="spinner" /> : <Square size={16} />}
            Desmarcar
          </button>
          <button type="button" className="refresh-button" onClick={archiveSelected} disabled={busyAction === 'archive' || selectedIds.length === 0}>
            {busyAction === 'archive' ? <Loader size={16} className="spinner" /> : <Database size={16} />}
            Salvar em pasta
          </button>
          <button type="button" className="disconnect-button" onClick={deleteSelected} disabled={busyAction === 'delete' || selectedIds.length === 0}>
            {busyAction === 'delete' ? <Loader size={16} className="spinner" /> : <Trash2 size={16} />}
            Remover
          </button>
        </div>
      </section>

      <section className="leads-folders">
        <div className="leads-folders__header">
          <div>
            <h2>Pastas de leads</h2>
            <p>Ao atingir 200 leads ativos por canal, o sistema cria uma pasta automaticamente com data, hora e separação interna por origem. No salvamento manual, você pode agrupar na mesma pasta até 200.</p>
          </div>
        </div>

        {folders.length === 0 ? (
          <div className="leads-folders__empty">Nenhuma pasta salva ainda.</div>
        ) : (
          <div className="leads-folders__grid">
            {folders.map((folder) => (
              <article className="lead-folder-card" key={folder.id}>
                <div className="lead-folder-card__top">
                  <strong>{folder.name}</strong>
                  <span>{folder.lead_count} leads</span>
                </div>
                <div className="lead-folder-card__meta">
                  <span>{folder.auto_created ? 'automatica' : 'manual'}</span>
                  <span>{folder.created_at}</span>
                </div>
                <div className="lead-folder-card__badges">
                  {folder.source_account_name ? <span className="lead-folder-card__badge">{folder.source_account_name}</span> : null}
                  {folder.lead_gender ? <span className="lead-folder-card__badge lead-folder-card__badge--gender">{folder.lead_gender}</span> : null}
                </div>
                <div className="lead-folder-card__items">
                  {(folder.items || []).slice(0, 3).map((item) => (
                    <div className="lead-folder-card__item" key={item.id}>
                      <strong>{item.author_name}</strong>
                      <p>{item.message}</p>
                    </div>
                  ))}
                  {(folder.items || []).length > 3 ? (
                    <span className="lead-folder-card__more">+{folder.items.length - 3} itens</span>
                  ) : null}
                </div>
                <div className="lead-folder-card__actions">
                  <button type="button" className="refresh-button" onClick={() => openFolder(folder)}>
                    Abrir pasta
                  </button>
                  <button type="button" className="refresh-button" onClick={() => restoreFolder(folder)} disabled={busyAction === `restore_${folder.id}`}>
                    {busyAction === `restore_${folder.id}` ? <Loader size={16} className="spinner" /> : 'Voltar leads'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {openedFolder ? (
        <section className="lead-folder-detail">
          <div className="lead-folder-detail__header">
            <div>
              <h2>{openedFolder.name}</h2>
              <p>{openedFolder.lead_count} lead(s) salvos nesta pasta.</p>
            </div>
            <button type="button" className="refresh-button" onClick={() => setOpenedFolderId('')}>
              Fechar
            </button>
          </div>

          <div className="lead-folder-detail__grid">
            <article className="lead-folder-detail__panel">
              <h3>Leads da pasta</h3>
              <div className="lead-folder-detail__toolbar">
                <span className="lead-folder-detail__selected-count">
                  Selecionados: {folderSelectedLeadIds.length}
                </span>
                <button type="button" className="refresh-button" onClick={toggleAllFolderLeads}>
                  {(openedFolder.items || []).length > 0 && openedFolder.items.every((item) => folderSelectedLeadIds.includes(item.id))
                    ? <CheckSquare size={16} />
                    : <Square size={16} />}
                  Selecionar todos
                </button>
              </div>
              <div className="lead-folder-detail__list">
                {(openedFolder.items || []).map((item) => (
                  <label className={`lead-folder-detail__item ${folderSelectedLeadIds.includes(item.id) ? 'selected' : ''}`} key={item.id}>
                    <input
                      type="checkbox"
                      checked={folderSelectedLeadIds.includes(item.id)}
                      onChange={() => toggleFolderLead(item.id)}
                    />
                    <div className="lead-folder-detail__item-body">
                      <div className="lead-folder-detail__item-top">
                        <strong>{item.author_name}</strong>
                        <span>{folderLeadStatuses[item.id] || item.platform}</span>
                      </div>
                      <div className="lead-folder-detail__badges">
                        <span className="lead-folder-detail__badge">{item.source_account_name || 'canal'}</span>
                        <span className="lead-folder-detail__badge lead-folder-detail__badge--gender">
                          {item.lead_gender || openedFolder.lead_gender || 'indefinido'}
                        </span>
                      </div>
                      <p>{item.message}</p>
                      <div className="lead-folder-detail__meta">
                        {item.author_handle ? <span>{item.author_handle}</span> : null}
                        <span>{item.created_at}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </article>

            <article className="lead-folder-detail__panel">
              <h3>Mensagem para envio</h3>
              <p className="lead-folder-detail__helper">
                Crie a mensagem base e prepare os anexos ou links que vao junto no envio desta pasta.
              </p>
              <div className="lead-folder-template-row">
                <div className="lead-folder-template-field">
                  <label htmlFor="lead-message-template">Modelo salvo</label>
                  <select
                    id="lead-message-template"
                    value={selectedTemplateId}
                    onChange={(event) => applyMessageTemplate(event.target.value)}
                  >
                    <option value="">Selecionar modelo</option>
                    {messageTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="lead-folder-batch">
                <div className="lead-folder-batch__header">
                  <strong>Envio em lote</strong>
                  <span>
                    {folderBatchRunning
                      ? `Em execucao · ${Math.max(folderBatchProgress.total - folderBatchProgress.processed, 0)} restantes`
                      : 'Pronto'}
                  </span>
                </div>
                <div className="lead-folder-batch__metrics">
                  <span>Selecionados: {folderSelectedLeadIds.length}</span>
                  <span>Enviados: {folderBatchProgress.sent}</span>
                  <span>Erros: {folderBatchProgress.errors}</span>
                </div>
                <div className="lead-folder-batch__controls">
                  <div className="lead-folder-batch__field">
                    <label htmlFor="lead-folder-interval">Segundos entre envios</label>
                    <input
                      id="lead-folder-interval"
                      type="number"
                      min="1"
                      max="300"
                      value={folderSendIntervalSeconds}
                      onChange={(event) => setFolderSendIntervalSeconds(Math.max(1, Math.min(300, Number(event.target.value) || 1)))}
                    />
                  </div>
                  <div className="lead-folder-batch__actions">
                    <button type="button" className="refresh-button" onClick={generateFolderMessages} disabled={folderSelectedLeadIds.length === 0}>
                      Gerar para selecionados
                    </button>
                    <button type="button" className="connect-button" onClick={runFolderBatch} disabled={folderBatchRunning || folderSelectedLeadIds.length === 0}>
                      <Send size={16} />
                      Enviar em lote
                    </button>
                    <button type="button" className="refresh-button" onClick={stopFolderBatch} disabled={!folderBatchRunning}>
                      Parar
                    </button>
                  </div>
                </div>
                {folderBatchNotice ? <div className="lead-folder-batch__notice">{folderBatchNotice}</div> : null}
              </div>
              <textarea
                value={folderMessage}
                onChange={(event) => setFolderMessage(event.target.value)}
                placeholder="Escreva aqui a mensagem para enviar aos leads desta pasta."
                rows="10"
              />
              <div className="lead-folder-detail__agent-actions">
                <button type="button" className="connect-button" onClick={generateMasterLeadMessage} disabled={masterMessageGenerating || !openedFolder}>
                  {masterMessageGenerating ? <Loader size={16} className="spinner" /> : <Wand2 size={16} />}
                  Gerar MSG com CRONOS Mestre
                </button>
                <span>
                  Usa os leads selecionados como contexto. Se nada estiver selecionado, usa uma amostra da pasta.
                </span>
              </div>
              <div className="lead-folder-detail__fields">
                {renderAssetField({
                  id: 'lead-folder-image',
                  label: 'Enviar imagem',
                  value: folderImageUrl,
                  onChange: (event) => setFolderImageUrl(event.target.value),
                  placeholder: 'URL ou referencia da imagem',
                  fallbackName: 'imagem',
                  assetKey: 'image',
                })}
                {renderAssetField({
                  id: 'lead-folder-audio',
                  label: 'Enviar audio',
                  value: folderAudioUrl,
                  onChange: (event) => setFolderAudioUrl(event.target.value),
                  placeholder: 'URL ou referencia do audio',
                  fallbackName: 'audio',
                  assetKey: 'audio',
                })}
                {renderAssetField({
                  id: 'lead-folder-video',
                  label: 'Enviar video',
                  value: folderVideoUrl,
                  onChange: (event) => setFolderVideoUrl(event.target.value),
                  placeholder: 'URL ou referencia do video',
                  fallbackName: 'video',
                  assetKey: 'video',
                })}
                {renderAssetField({
                  id: 'lead-folder-link',
                  label: 'Link personalizado',
                  value: folderCustomLink,
                  onChange: (event) => setFolderCustomLink(event.target.value),
                  placeholder: 'https://...',
                  fallbackName: 'link',
                })}
              </div>
              <div className="lead-folder-detail__actions">
                <button type="button" className="refresh-button" onClick={copyFolderMessage} disabled={!folderMessage.trim()}>
                  Copiar mensagem
                </button>
                <button type="button" className="refresh-button" onClick={saveMessageTemplate} disabled={!folderMessage.trim()}>
                  Salvar modelo
                </button>
                {copySuccess ? <span className="lead-folder-detail__success">{copySuccess}</span> : null}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="loading-spinner">Carregando leads...</div>
      ) : groupedLeads.length === 0 ? (
        <div className="empty-state">
          <Users size={42} />
          <h3>Nenhum lead salvo</h3>
          <p>Os leads do YouTube, Instagram e Facebook vão aparecer aqui separados por origem.</p>
        </div>
      ) : (
        <div className="leads-groups">
          {groupedLeads.map((group) => {
            const groupIds = group.items.map((item) => item.id);
            const allSelected = groupIds.every((id) => selectedIds.includes(id));
            return (
              <section className="leads-group" key={group.key}>
                <div className="leads-group__header">
                  <div>
                    <h2>{group.sourceAccountName}</h2>
                    <span>{group.platform} · {group.sourceAccountId}</span>
                  </div>
                  <button type="button" className="refresh-button" onClick={() => toggleGroup(group)}>
                    {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    Selecionar grupo
                  </button>
                </div>

                <div className="leads-list">
                  {group.items.map((item) => (
                    <label className={`lead-row ${selectedIds.includes(item.id) ? 'selected' : ''}`} key={item.id}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleLead(item.id)}
                      />
                      <div className="lead-row__content">
                        <div className="lead-row__top">
                          <strong>{item.author_name}</strong>
                          <span>{item.status}</span>
                        </div>
                        <p>{item.message}</p>
                        <div className="lead-row__meta">
                          {item.author_handle ? <span>{item.author_handle}</span> : null}
                          <span>{item.created_at}</span>
                          {item.selected ? <span>marcado</span> : null}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Leads;
