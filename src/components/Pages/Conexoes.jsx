import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Settings2,
  X,
} from 'lucide-react';
import { apiUrl } from '../../config/api';
import SourceBadge from '../Branding/SourceBadge';
import './Conexoes.css';

const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';
const PENDING_AUTH_FLOW_KEY = 'alliance_dark_pending_auth_flow';
const OAUTH_ERROR_KEY = 'alliance_dark_oauth_error';
const EMPTY_INTEGRATION_SETTINGS = { tools: [], defaults: {}, destinations: {} };

function connectionErrorMessage(error, fallback = 'Não foi possível concluir a operação.') {
  const message = String(error?.message || error || '').trim();
  if (!message || message === 'Failed to fetch') {
    return fallback;
  }
  return message;
}

async function readResponseData(response) {
  const contentType = response.headers.get('content-type') || '';
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(responseText);
    } catch {
      return {};
    }
  }

  return { detail: responseText };
}

function markSingleActive(items, idField, activeId) {
  return (items || []).map((item) => ({
    ...item,
    is_active: item[idField] === activeId,
  }));
}

function refreshSoon(refreshFn) {
  window.setTimeout(() => {
    refreshFn(true);
  }, 900);
}

function Conexoes({ currentUser }) {
  const isGuest = currentUser?.role === 'guest';
  const [guestUsers, setGuestUsers] = useState([]);
  const [accessCatalog, setAccessCatalog] = useState({ plans: [], modules: [] });
  const [accessAssignments, setAccessAssignments] = useState([]);
  const [accessUpdatingId, setAccessUpdatingId] = useState('');
  const [youtubeStatus, setYoutubeStatus] = useState(null);
  const [integrationSettings, setIntegrationSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsScope, setSettingsScope] = useState('global');
  const [settingsTarget, setSettingsTarget] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  const getAuthHeaders = () => {
    const authToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  };

  const toolCatalog = integrationSettings?.tools || [];
  const defaultTools = integrationSettings?.defaults || {};

  const cloneTools = (tools) => JSON.parse(JSON.stringify(tools || {}));

  const getDestinationSettings = (platform, destinationId, destinationName) => {
    const saved = integrationSettings?.destinations?.[platform]?.[destinationId];
    return {
      destination_name: saved?.destination_name || destinationName || '',
      tools: cloneTools(saved?.tools || defaultTools),
    };
  };

  const checkStatuses = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    if (!window.localStorage.getItem(OAUTH_ERROR_KEY)) {
      setError('');
    }
    try {
      const [youtubeResult, integrationsResult] = await Promise.allSettled([
        fetch(apiUrl(`/api/conexoes/youtube/status${forceRefresh ? '?refresh=1' : ''}`), { headers: getAuthHeaders(), cache: 'no-store' }),
        fetch(apiUrl('/api/integrations/settings'), { headers: getAuthHeaders(), cache: 'no-store' }),
      ]);

      if (!isGuest) {
        const ownerResults = await Promise.allSettled([
          fetch(apiUrl('/api/conexoes/guests'), { headers: getAuthHeaders(), cache: 'no-store' }),
          fetch(apiUrl('/api/workspaces/access/catalog'), { headers: getAuthHeaders(), cache: 'no-store' }),
          fetch(apiUrl('/api/workspaces/access/assignments'), { headers: getAuthHeaders(), cache: 'no-store' }),
        ]);
        const [guestsResult, catalogResult, assignmentsResult] = ownerResults;
        if (guestsResult.status === 'fulfilled' && guestsResult.value.ok) {
          const guestsData = await readResponseData(guestsResult.value);
          setGuestUsers(guestsData.guests || []);
        }
        if (catalogResult.status === 'fulfilled' && catalogResult.value.ok) {
          setAccessCatalog(await readResponseData(catalogResult.value));
        }
        if (assignmentsResult.status === 'fulfilled' && assignmentsResult.value.ok) {
          const assignmentsData = await readResponseData(assignmentsResult.value);
          setAccessAssignments(assignmentsData.items || []);
        }
      }

      const refreshFailures = [];
      let youtubeData = null;

      if (youtubeResult.status === 'fulfilled') {
        if (youtubeResult.value.ok) {
          youtubeData = await readResponseData(youtubeResult.value);
          setYoutubeStatus(youtubeData);
        } else {
          refreshFailures.push('YouTube');
        }
      } else {
        refreshFailures.push('YouTube');
      }

      if (integrationsResult.status === 'fulfilled') {
        const data = await readResponseData(integrationsResult.value);
        if (!integrationsResult.value.ok) {
          throw new Error(data.detail || 'Erro ao carregar integrações');
        }
        setIntegrationSettings(data);
      } else {
        console.warn('Falha ao carregar integrações:', integrationsResult.reason);
        setIntegrationSettings((current) => current || EMPTY_INTEGRATION_SETTINGS);
      }

      if (refreshFailures.length > 0) {
        console.warn('Atualizacao parcial das conexoes:', refreshFailures.join(', '));
      }

      return {
        hasYoutube: Boolean(youtubeData?.channels?.length),
      };
    } catch (err) {
      console.error('Erro ao verificar conexões:', err);
      setError(connectionErrorMessage(err, 'Não foi possível atualizar os status das conexões. Tente atualizar a página.'));
      return {
        hasYoutube: false,
      };
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useEffect(() => {
    checkStatuses().then((statusSnapshot) => {
      const oauthError = window.localStorage.getItem(OAUTH_ERROR_KEY);
      if (oauthError) {
        if (statusSnapshot?.hasYoutube) {
          setError('');
        } else {
          setError(`Falha na autenticação: ${oauthError}`);
        }
        window.localStorage.removeItem(OAUTH_ERROR_KEY);
      }
    });
  }, [checkStatuses]);

  const youtubeChannels = youtubeStatus?.channels || [];
  const hasYoutube = youtubeChannels.length > 0;

  const formatNumber = (value) => Number(value || 0).toLocaleString('pt-BR');

  const assignmentForGuest = (guest) => accessAssignments.find((item) => (
    String(item.owner_email || '').toLowerCase() === String(guest.email || '').toLowerCase()
  ));

  const saveGuestAccess = async (assignment, planCode, moduleOverrides) => {
    if (!assignment?.workspace_id) return;
    setAccessUpdatingId(assignment.workspace_id);
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/workspaces/${encodeURIComponent(assignment.workspace_id)}/access`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          plan_code: planCode,
          module_overrides: moduleOverrides,
        }),
      });
      const data = await readResponseData(response);
      if (!response.ok) {
        throw new Error(data.detail || 'Não foi possível atualizar o acesso do convidado');
      }
      setAccessAssignments((current) => current.map((item) => (
        item.workspace_id === assignment.workspace_id ? data.item : item
      )));
    } catch (err) {
      setError(connectionErrorMessage(err, 'Não foi possível atualizar o plano do convidado.'));
    } finally {
      setAccessUpdatingId('');
    }
  };

  const changeGuestPlan = (assignment, planCode) => {
    saveGuestAccess(assignment, planCode, {});
  };

  const toggleGuestModule = (assignment, moduleKey, enabled) => {
    const plan = accessCatalog.plans.find((item) => item.code === assignment.plan_code);
    const baseEnabled = Boolean(plan?.modules?.includes(moduleKey));
    const nextOverrides = { ...(assignment.access?.overrides || {}) };
    if (enabled === baseEnabled) {
      delete nextOverrides[moduleKey];
    } else {
      nextOverrides[moduleKey] = enabled;
    }
    saveGuestAccess(assignment, assignment.plan_code, nextOverrides);
  };

  const openGlobalSettings = () => {
    setSettingsScope('global');
    setSettingsTarget(null);
    setSettingsDraft(cloneTools(defaultTools));
    setSettingsOpen(true);
  };

  const openDestinationSettings = (platform, target) => {
    const current = getDestinationSettings(platform, target.id, target.name);
    setSettingsScope('destination');
    setSettingsTarget({ platform, ...target });
    setSettingsDraft(cloneTools(current.tools));
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    setSettingsTarget(null);
    setSavingSettings(false);
  };

  const handleConnect = async () => {
    setConnecting('youtube');
    setError('');
    try {
      const authToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
      if (!authToken) {
        throw new Error('Sessão ausente. Entre novamente antes de conectar o canal.');
      }

      window.localStorage.setItem(PENDING_AUTH_FLOW_KEY, 'youtube');
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = apiUrl('/api/conexoes/youtube/login');
      form.style.display = 'none';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'dashboard_token';
      input.value = authToken;
      form.appendChild(input);

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting('');
    }
  };

  const setActiveYoutube = async (channelId) => {
    setUpdatingId(channelId);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/conexoes/youtube/active'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ channel_id: channelId }),
      });
      const data = await readResponseData(response);
      if (!response.ok) throw new Error(data.detail || 'Erro ao selecionar canal');
      window.localStorage.setItem('alliance_forge_library_channel_id', channelId);
      window.dispatchEvent(new CustomEvent('alliance:forge-library-channel-changed', { detail: { channel_id: channelId } }));
      setYoutubeStatus((current) => current ? ({
        ...current,
        active_channel_id: channelId,
        channels: markSingleActive(current.channels, 'channel_id', channelId),
      }) : current);
      refreshSoon(checkStatuses);
    } catch (err) {
      setError(connectionErrorMessage(err, 'Não foi possível iniciar a conexão. Atualize a página e tente novamente.'));
    } finally {
      setUpdatingId('');
    }
  };

  const disconnectYoutube = async (channel) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Desconectar o canal "${channel.channel_name}"?`)) return;
    setUpdatingId(channel.channel_id);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/conexoes/youtube/disconnect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ channel_id: channel.channel_id }),
      });
      const data = await readResponseData(response);
      if (!response.ok) throw new Error(data.detail || 'Erro ao desconectar');
      await checkStatuses(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId('');
    }
  };

  const updateToolField = (toolId, fieldId, value) => {
    setSettingsDraft((current) => ({
      ...current,
      [toolId]: {
        ...(current[toolId] || {}),
        [fieldId]: value,
      },
    }));
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setError('');
    try {
      const endpoint = settingsScope === 'global'
        ? '/api/integrations/settings/global'
        : '/api/integrations/settings/destination';

      const payload = settingsScope === 'global'
        ? { tools: settingsDraft }
        : {
            platform: settingsTarget.platform,
            destination_id: settingsTarget.id,
            destination_name: settingsTarget.name,
            tools: settingsDraft,
          };

      const response = await fetch(apiUrl(endpoint), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await readResponseData(response);
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao salvar preferências');
      }

      await checkStatuses(true);
      closeSettings();
    } catch (err) {
      setError(err.message);
      setSavingSettings(false);
    }
  };

  const renderToolSummary = (platform, destinationId, destinationName) => {
    const current = getDestinationSettings(platform, destinationId, destinationName);
    const enabledTools = toolCatalog.filter((tool) => current.tools?.[tool.id]?.enabled);

    if (enabledTools.length === 0) {
      return null;
    }

    return (
      <div className="provider-pill-row">
        {enabledTools.map((tool) => (
          <span className="provider-pill" key={`${destinationId}-${tool.id}`}>
            {tool.name}
          </span>
        ))}
      </div>
    );
  };

  const renderChannelSettingsButton = (platform, target) => (
    <button
      type="button"
      className="settings-icon-button"
      onClick={() => openDestinationSettings(platform, target)}
      title={`Configurar APIs para ${target.name}`}
    >
      <Settings2 size={15} />
      APIs
    </button>
  );

  return (
    <div className="page-container conexoes-page">
      <div className="page-header conexoes-header">
        <div>
          <h1>Conexões</h1>
          <p>Organize canais autorizados e preferências técnicas por destino.</p>
        </div>
        <button type="button" className="header-settings-button" onClick={openGlobalSettings} title="Configurações gerais de APIs">
          <Settings2 size={16} />
        </button>
      </div>

      {!isGuest && (
        <section className="guest-panel" aria-label="Convidados autorizados">
          <div className="guest-panel__header">
            <strong>Convidados autorizados</strong>
            <span>Dados e canais separados por usuário</span>
          </div>
          <div className="guest-panel__list">
            {guestUsers.length > 0 ? guestUsers.map((guest) => (
              <article className="guest-panel__item" key={guest.email}>
                <div className="guest-panel__guest">
                  <strong>{guest.name || guest.email}</strong>
                  <span>{guest.email}</span>
                </div>
                <div className="guest-panel__channels">
                  {(guest.channels || []).length > 0 ? guest.channels.map((channel) => (
                    <div className={`guest-panel__channel ${channel.is_active ? 'active' : ''}`} key={channel.channel_id || channel.channel_name}>
                      {channel.thumbnail ? <img src={channel.thumbnail} alt="" /> : <Radio size={14} />}
                      <div>
                        <strong>{channel.channel_name || 'Canal sem nome'}</strong>
                        <span>{channel.is_active ? 'Em uso' : 'Conectado'}{channel.needs_reconnect ? ' · reconectar' : ''}</span>
                      </div>
                    </div>
                  )) : <span className="guest-panel__empty">Nenhum canal conectado</span>}
                </div>
                {(() => {
                  const assignment = assignmentForGuest(guest);
                  if (!assignment) {
                    return <span className="guest-panel__access-loading">Carregando plano de acesso...</span>;
                  }
                  const enabledCount = accessCatalog.modules.filter((module) => (
                    assignment.access?.modules?.[module.key] === true
                  )).length;
                  const updating = accessUpdatingId === assignment.workspace_id;
                  return (
                    <div className="guest-panel__access">
                      <label className="guest-panel__plan">
                        <span>Plano de acesso</span>
                        <select
                          value={assignment.plan_code}
                          disabled={updating}
                          onChange={(event) => changeGuestPlan(assignment, event.target.value)}
                        >
                          {accessCatalog.plans.map((plan) => (
                            <option key={plan.code} value={plan.code}>{plan.name}</option>
                          ))}
                        </select>
                      </label>
                      <details className="guest-panel__modules">
                        <summary>
                          Módulos {enabledCount}/{accessCatalog.modules.length}
                          {updating && <Loader size={13} className="spinner" />}
                        </summary>
                        <div>
                          {accessCatalog.modules.map((module) => (
                            <label key={module.key}>
                              <input
                                type="checkbox"
                                checked={assignment.access?.modules?.[module.key] === true}
                                disabled={updating || module.key === 'dashboard'}
                                onChange={(event) => toggleGuestModule(assignment, module.key, event.target.checked)}
                              />
                              <span>{module.label}</span>
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>
                  );
                })()}
              </article>
            )) : <span className="guest-panel__empty">Nenhum convidado cadastrado</span>}
          </div>
        </section>
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="conexoes-grid">
        <div className="conexao-card youtube youtube-wide">
          <div className="card-header">
            <SourceBadge label="YouTube" detail="Conexões" officialAsset />
            <div className="card-title-group">
              <h2>YouTube</h2>
              <span>{hasYoutube ? `${youtubeChannels.length} canal(is) conectado(s)` : 'Nenhum canal conectado'}</span>
            </div>
          </div>

          <div className="card-body">
            {loading ? (
              <div className="loading-state"><Loader size={32} className="spinner" /><p>Verificando...</p></div>
            ) : (
              <>
                <div className={`status-badge ${hasYoutube ? 'connected' : 'disconnected'}`}>
                  {hasYoutube ? <Check size={16} /> : <AlertCircle size={16} />}
                  {hasYoutube ? 'Conectado' : 'Desconectado'}
                </div>

                {hasYoutube && (
                  <div className="channels-list">
                    {youtubeChannels.map((channel) => (
                      <div key={channel.channel_id} className={`channel-row ${channel.is_active ? 'active' : ''}`}>
                        <div className="channel-info compact">
                          <img src={channel.thumbnail} alt={channel.channel_name} className="channel-thumbnail" />
                          <div className="channel-details">
                            <div className="channel-name-line">
                              <h3>{channel.channel_name}</h3>
                              {channel.is_active && <span className="active-channel-badge"><Radio size={12} />Ativo</span>}
                            </div>
                            <p className="channel-id">ID: {channel.channel_id}</p>
                            {renderToolSummary('youtube', channel.channel_id, channel.channel_name)}
                          </div>
                        </div>
                        <div className="channel-stats">
                          <span>{formatNumber(channel.subscriber_count)} inscritos</span>
                          <span>{formatNumber(channel.video_count)} videos</span>
                        </div>
                        <div className="channel-actions">
                          {renderChannelSettingsButton('youtube', { id: channel.channel_id, name: channel.channel_name })}
                          {!channel.is_active && (
                            <button type="button" onClick={() => setActiveYoutube(channel.channel_id)} disabled={updatingId === channel.channel_id} className="active-button">
                              {updatingId === channel.channel_id ? <Loader size={15} className="spinner" /> : <Radio size={15} />} Usar
                            </button>
                          )}
                          <button type="button" onClick={() => disconnectYoutube(channel)} disabled={updatingId === channel.channel_id} className="disconnect-button compact-button">
                            <LogOut size={15} /> Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!hasYoutube && <div className="description"><p>Conecte o YouTube para operar uploads e agenda do canal autorizado.</p></div>}

                <div className="connection-actions">
                  <button onClick={handleConnect} disabled={connecting === 'youtube'} className="connect-button">
                    {connecting === 'youtube' ? <><Loader size={16} className="spinner" />Conectando...</> : <><Plus size={16} />{hasYoutube ? 'Adicionar outro canal' : 'Conectar com Google'}</>}
                  </button>
                  <button onClick={() => checkStatuses(true)} disabled={loading} className="refresh-button" type="button" aria-label="Atualizar conexões do YouTube">
                    <RefreshCw size={16} className={loading ? 'spinner' : ''} />
                    Atualizar YouTube
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {settingsOpen && (
        <div className="settings-overlay" onClick={closeSettings}>
          <aside className="settings-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="settings-drawer__header">
              <div>
                <h2>{settingsScope === 'global' ? 'APIs gerais' : `APIs de ${settingsTarget?.name || ''}`}</h2>
                <p>
                  {settingsScope === 'global'
                    ? 'Defina as ferramentas base do dashboard.'
                    : 'Defina as APIs específicas usadas por este canal.'}
                </p>
              </div>
              <button type="button" className="settings-close" onClick={closeSettings}>
                <X size={18} />
              </button>
            </div>

            <div className="settings-drawer__body">
              {toolCatalog.map((tool) => {
                const toolState = settingsDraft[tool.id] || {};
                return (
                  <section className="tool-settings-card" key={tool.id}>
                    <div className="tool-settings-card__header">
                      <div>
                        <h3>{tool.name}</h3>
                        <p>{tool.description}</p>
                      </div>
                      <label className="tool-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(toolState.enabled)}
                          onChange={(event) => updateToolField(tool.id, 'enabled', event.target.checked)}
                        />
                        <span>{toolState.enabled ? 'Ativo' : 'Inativo'}</span>
                      </label>
                    </div>

                    <div className="tool-settings-fields">
                      {tool.fields.map((field) => (
                        <div className="settings-group" key={`${tool.id}-${field.id}`}>
                          <label>{field.label}</label>
                          {field.type === 'textarea' ? (
                            <textarea
                              value={toolState[field.id] || ''}
                              onChange={(event) => updateToolField(tool.id, field.id, event.target.value)}
                              placeholder={field.placeholder}
                              rows={8}
                            />
                          ) : (
                            <input
                              type={field.type}
                              value={toolState[field.id] || ''}
                              onChange={(event) => updateToolField(tool.id, field.id, event.target.value)}
                              placeholder={field.placeholder}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="tool-env-note">
                      {tool.env_keys.length > 0 ? (
                        <>
                          <strong>Env:</strong> {tool.env_keys.join(', ')}
                        </>
                      ) : (
                        <>
                          <strong>Env:</strong> opcional
                        </>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="settings-drawer__footer">
              <button type="button" className="refresh-button" onClick={closeSettings}>
                <X size={16} />
                Fechar
              </button>
              <button type="button" className="connect-button" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? <Loader size={16} className="spinner" /> : <Save size={16} />}
                Salvar
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default Conexoes;
