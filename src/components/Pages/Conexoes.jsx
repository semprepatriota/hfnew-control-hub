import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Facebook,
  Instagram,
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
  const [youtubeStatus, setYoutubeStatus] = useState(null);
  const [instagramStatus, setInstagramStatus] = useState(null);
  const [facebookStatus, setFacebookStatus] = useState(null);
  const [metaDiagnostics, setMetaDiagnostics] = useState({ instagram: null, facebook: null });
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
      const [
        youtubeResult,
        instagramResult,
        facebookResult,
        integrationsResult,
        instagramDiagnosticsResult,
        facebookDiagnosticsResult,
      ] = await Promise.allSettled([
        fetch(apiUrl(`/api/conexoes/youtube/status${forceRefresh ? '?refresh=1' : ''}`), { headers: getAuthHeaders(), cache: 'no-store' }),
        fetch(apiUrl('/api/instagram/status'), { headers: getAuthHeaders(), cache: 'no-store' }),
        fetch(apiUrl('/api/facebook/status'), { headers: getAuthHeaders(), cache: 'no-store' }),
        fetch(apiUrl('/api/integrations/settings'), { headers: getAuthHeaders(), cache: 'no-store' }),
        fetch(apiUrl('/api/instagram/diagnostics'), { headers: getAuthHeaders(), cache: 'no-store' }),
        fetch(apiUrl('/api/facebook/diagnostics'), { headers: getAuthHeaders(), cache: 'no-store' }),
      ]);

      const refreshFailures = [];
      let youtubeData = null;
      let instagramData = null;
      let facebookData = null;

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

      if (instagramResult.status === 'fulfilled') {
        if (instagramResult.value.ok) {
          instagramData = await readResponseData(instagramResult.value);
          setInstagramStatus(instagramData);
        } else {
          refreshFailures.push('Instagram');
        }
      } else {
        refreshFailures.push('Instagram');
      }

      if (facebookResult.status === 'fulfilled') {
        if (facebookResult.value.ok) {
          facebookData = await readResponseData(facebookResult.value);
          setFacebookStatus(facebookData);
        } else {
          refreshFailures.push('Facebook');
        }
      } else {
        refreshFailures.push('Facebook');
      }

      if (integrationsResult.status === 'fulfilled') {
        const data = await readResponseData(integrationsResult.value);
        if (!integrationsResult.value.ok) {
          throw new Error(data.detail || 'Erro ao carregar integrações');
        }
        setIntegrationSettings(data);
      } else {
        throw integrationsResult.reason;
      }

      const instagramDiagnostics = instagramDiagnosticsResult.status === 'fulfilled' && instagramDiagnosticsResult.value.ok
        ? await readResponseData(instagramDiagnosticsResult.value)
        : instagramData?.diagnostic
          ? { last_diagnostic: instagramData.diagnostic }
          : null;
      const facebookDiagnostics = facebookDiagnosticsResult.status === 'fulfilled' && facebookDiagnosticsResult.value.ok
        ? await readResponseData(facebookDiagnosticsResult.value)
        : facebookData?.diagnostic
          ? { last_diagnostic: facebookData.diagnostic }
          : null;
      setMetaDiagnostics({ instagram: instagramDiagnostics, facebook: facebookDiagnostics });

      if (refreshFailures.length > 0) {
        console.warn('Atualizacao parcial das conexoes:', refreshFailures.join(', '));
      }

      return {
        hasYoutube: Boolean(youtubeData?.channels?.length),
        hasInstagram: Boolean(instagramData?.profiles?.length),
        hasFacebook: Boolean(facebookData?.pages?.length),
      };
    } catch (err) {
      setError(err.message || 'Erro ao verificar conexões');
      return {
        hasYoutube: false,
        hasInstagram: false,
        hasFacebook: false,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatuses().then((statusSnapshot) => {
      const oauthError = window.localStorage.getItem(OAUTH_ERROR_KEY);
      if (oauthError) {
        if (statusSnapshot?.hasYoutube || statusSnapshot?.hasInstagram || statusSnapshot?.hasFacebook) {
          setError('');
        } else {
          setError(`Falha na autenticação: ${oauthError}`);
        }
        window.localStorage.removeItem(OAUTH_ERROR_KEY);
      }
    });
  }, [checkStatuses]);

  const youtubeChannels = youtubeStatus?.channels || [];
  const instagramProfiles = instagramStatus?.profiles || [];
  const facebookPages = facebookStatus?.pages || [];
  const hasYoutube = youtubeChannels.length > 0;
  const hasInstagram = instagramProfiles.length > 0;
  const hasFacebook = facebookPages.length > 0;

  const formatNumber = (value) => Number(value || 0).toLocaleString('pt-BR');

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

  const handleConnect = async (provider) => {
    setConnecting(provider);
    setError('');
    try {
      let endpoint = '/api/conexoes/youtube/auth-url';
      if (provider === 'instagram') endpoint = '/api/instagram/auth-url';
      if (provider === 'facebook') endpoint = '/api/facebook/auth-url';
      const response = await fetch(apiUrl(endpoint), { headers: getAuthHeaders() });
      const data = await readResponseData(response);
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao obter URL de autenticação');
      }
      window.localStorage.setItem(PENDING_AUTH_FLOW_KEY, provider);
      window.location.href = data.auth_url;
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
      setError(err.message);
    } finally {
      setUpdatingId('');
    }
  };

  const setActiveInstagram = async (profileId) => {
    setUpdatingId(profileId);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/instagram/active'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ profile_id: profileId }),
      });
      const data = await readResponseData(response);
      if (!response.ok) throw new Error(data.detail || 'Erro ao selecionar perfil');
      setInstagramStatus((current) => current ? ({
        ...current,
        active_profile_id: profileId,
        profiles: markSingleActive(current.profiles, 'profile_id', profileId),
      }) : current);
      refreshSoon(checkStatuses);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId('');
    }
  };

  const setActiveFacebook = async (pageId) => {
    setUpdatingId(pageId);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/facebook/active'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ page_id: pageId }),
      });
      const data = await readResponseData(response);
      if (!response.ok) throw new Error(data.detail || 'Erro ao selecionar página');
      setFacebookStatus((current) => current ? ({
        ...current,
        active_page_id: pageId,
        pages: markSingleActive(current.pages, 'page_id', pageId),
      }) : current);
      refreshSoon(checkStatuses);
    } catch (err) {
      setError(err.message);
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

  const disconnectInstagram = async (profile) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Remover o perfil Instagram "${profile.username || profile.profile_name}"?`)) return;
    setUpdatingId(profile.profile_id);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/instagram/disconnect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ profile_id: profile.profile_id }),
      });
      const data = await readResponseData(response);
      if (!response.ok) throw new Error(data.detail || 'Erro ao remover perfil');
      await checkStatuses(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId('');
    }
  };

  const disconnectFacebook = async (page) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Remover a página Facebook "${page.page_name}"?`)) return;
    setUpdatingId(page.page_id);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/facebook/disconnect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ page_id: page.page_id }),
      });
      const data = await readResponseData(response);
      if (!response.ok) throw new Error(data.detail || 'Erro ao remover página');
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

  const renderMetaDiagnostic = (provider) => {
    const diagnostic = metaDiagnostics[provider];
    const status = provider === 'instagram' ? instagramStatus : facebookStatus;
    const last = diagnostic?.last_diagnostic || status?.diagnostic;
    const title = provider === 'instagram' ? 'Diagnóstico Instagram' : 'Diagnóstico Facebook';
    const requiredShape = diagnostic?.required_account_shape || (
      provider === 'instagram'
        ? 'Instagram Profissional vinculado a uma Página Facebook administrada pelo usuário Meta.'
        : 'Conta Meta que administra pelo menos uma Página Facebook autorizada no login.'
    );

    if (!diagnostic && !last) {
      return (
        <div className="meta-diagnostic">
          <div className="meta-diagnostic__header">
            <strong>{title}</strong>
            <span>Sem erro registrado</span>
          </div>
          <p>{requiredShape}</p>
        </div>
      );
    }

    return (
      <div className="meta-diagnostic">
        <div className="meta-diagnostic__header">
          <strong>{title}</strong>
          <span>{diagnostic?.configured ? 'Configurado' : 'Configuração pendente'}</span>
        </div>
        <div className="meta-diagnostic__grid">
          <span>App ID</span>
          <code>{diagnostic?.app_id || last?.app_id || 'ausente'}</code>
          <span>Redirect</span>
          <code>{diagnostic?.redirect_uri || last?.instagram_redirect_uri || last?.facebook_redirect_uri || 'ausente'}</code>
          <span>Fluxo</span>
          <code>{diagnostic?.current_flow || last?.stage || 'facebook_oauth'}</code>
        </div>
        {Array.isArray(diagnostic?.scopes) && diagnostic.scopes.length > 0 && (
          <p className="meta-diagnostic__scopes">{diagnostic.scopes.join(', ')}</p>
        )}
        {last?.detail && (
          <div className="meta-diagnostic__error">
            <AlertCircle size={15} />
            <span>{last.detail}</span>
          </div>
        )}
        {last?.extra?.pages_found !== undefined && (
          <p>Paginas retornadas pela Meta: {last.extra.pages_found}</p>
        )}
        <p>{requiredShape}</p>
      </div>
    );
  };

  return (
    <div className="page-container conexoes-page">
      <div className="page-header conexoes-header">
        <div>
          <h1>Conexões</h1>
          <p>Organize canais autorizados e preferências técnicas por destino.</p>
        </div>
        {!isGuest && (
          <button type="button" className="header-settings-button" onClick={openGlobalSettings} title="Configurações gerais de APIs">
            <Settings2 size={16} />
          </button>
        )}
      </div>

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
                          {!isGuest && renderChannelSettingsButton('youtube', { id: channel.channel_id, name: channel.channel_name })}
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
                  <button onClick={() => handleConnect('youtube')} disabled={connecting === 'youtube'} className="connect-button">
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

        {!isGuest && <div className="conexao-card instagram instagram-wide">
          <div className="card-header">
            <div className="icon-container instagram-icon"><Instagram size={32} /></div>
            <div className="card-title-group">
              <h2>Instagram</h2>
              <span>{hasInstagram ? `${instagramProfiles.length} perfil(is) conectado(s)` : 'Nenhum perfil conectado'}</span>
            </div>
          </div>

          <div className="card-body">
            {loading ? (
              <div className="loading-state"><Loader size={32} className="spinner" /><p>Verificando...</p></div>
            ) : (
              <>
                <div className={`status-badge ${hasInstagram ? 'connected' : 'disconnected'}`}>
                  {hasInstagram ? <Check size={16} /> : <AlertCircle size={16} />}
                  {hasInstagram ? 'Conectado' : 'Desconectado'}
                </div>

                {instagramStatus?.requires_config && (
                  <div className="warning-banner">Configure `META_APP_ID` e `META_APP_SECRET` no backend/.env antes de conectar.</div>
                )}

                {hasInstagram && (
                  <div className="channels-list">
                    {instagramProfiles.map((profile) => (
                      <div key={profile.profile_id} className={`channel-row ${profile.is_active ? 'active' : ''}`}>
                        <div className="channel-info compact">
                          {profile.picture ? (
                            <img src={profile.picture} alt={profile.username} className="channel-thumbnail" />
                          ) : (
                            <div className="channel-thumbnail fallback-avatar"><Instagram size={22} /></div>
                          )}
                          <div className="channel-details">
                            <div className="channel-name-line">
                              <h3>@{profile.username || profile.profile_name}</h3>
                              {profile.is_active && <span className="active-channel-badge"><Radio size={12} />Ativo</span>}
                            </div>
                            <p className="channel-id">IG ID: {profile.profile_id}</p>
                            <p className="channel-id">Pagina: {profile.facebook_page_name || profile.facebook_page_id}</p>
                            {renderToolSummary('instagram', profile.profile_id, profile.username || profile.profile_name)}
                          </div>
                        </div>
                        <div className="channel-actions">
                          {renderChannelSettingsButton('instagram', { id: profile.profile_id, name: profile.username || profile.profile_name })}
                          {!profile.is_active && (
                            <button type="button" onClick={() => setActiveInstagram(profile.profile_id)} disabled={updatingId === profile.profile_id} className="active-button">
                              {updatingId === profile.profile_id ? <Loader size={15} className="spinner" /> : <Radio size={15} />} Usar
                            </button>
                          )}
                          <button type="button" onClick={() => disconnectInstagram(profile)} disabled={updatingId === profile.profile_id} className="disconnect-button compact-button">
                            <LogOut size={15} /> Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!hasInstagram && <div className="description"><p>Conecte perfis profissionais do Instagram para posts, Reels e carrossel.</p></div>}

                {renderMetaDiagnostic('instagram')}

                <div className="connection-actions">
                  <button onClick={() => handleConnect('instagram')} disabled={connecting === 'instagram' || instagramStatus?.requires_config} className="connect-button instagram-connect">
                    {connecting === 'instagram' ? <><Loader size={16} className="spinner" />Conectando...</> : <><Plus size={16} />{hasInstagram ? 'Adicionar outro perfil' : 'Conectar com Meta'}</>}
                  </button>
                  <button onClick={() => checkStatuses(true)} disabled={loading} className="refresh-button" type="button" aria-label="Atualizar conexões do Instagram">
                    <RefreshCw size={16} className={loading ? 'spinner' : ''} />
                    Atualizar Instagram
                  </button>
                </div>
              </>
            )}
          </div>
        </div>}

        {!isGuest && <div className="conexao-card facebook facebook-wide">
          <div className="card-header">
            <div className="icon-container facebook-icon"><Facebook size={32} /></div>
            <div className="card-title-group">
              <h2>Facebook</h2>
              <span>{hasFacebook ? `${facebookPages.length} pagina(s) conectada(s)` : 'Nenhuma pagina conectada'}</span>
            </div>
          </div>

          <div className="card-body">
            {loading ? (
              <div className="loading-state"><Loader size={32} className="spinner" /><p>Verificando...</p></div>
            ) : (
              <>
                <div className={`status-badge ${hasFacebook ? 'connected' : 'disconnected'}`}>
                  {hasFacebook ? <Check size={16} /> : <AlertCircle size={16} />}
                  {hasFacebook ? 'Conectado' : 'Desconectado'}
                </div>

                {facebookStatus?.requires_config && (
                  <div className="warning-banner">Configure `META_APP_ID`, `META_APP_SECRET` e `FACEBOOK_REDIRECT_URI` no backend/.env antes de conectar.</div>
                )}

                {hasFacebook && (
                  <div className="channels-list">
                    {facebookPages.map((page) => (
                      <div key={page.page_id} className={`channel-row ${page.is_active ? 'active' : ''}`}>
                        <div className="channel-info compact">
                          {page.picture ? (
                            <img src={page.picture} alt={page.page_name} className="channel-thumbnail" />
                          ) : (
                            <div className="channel-thumbnail fallback-avatar facebook-avatar"><Facebook size={22} /></div>
                          )}
                          <div className="channel-details">
                            <div className="channel-name-line">
                              <h3>{page.page_name}</h3>
                              {page.is_active && <span className="active-channel-badge"><Radio size={12} />Ativo</span>}
                            </div>
                            <p className="channel-id">Pagina ID: {page.page_id}</p>
                            {page.category && <p className="channel-id">Categoria: {page.category}</p>}
                            {renderToolSummary('facebook', page.page_id, page.page_name)}
                          </div>
                        </div>
                        <div className="channel-actions">
                          {renderChannelSettingsButton('facebook', { id: page.page_id, name: page.page_name })}
                          {!page.is_active && (
                            <button type="button" onClick={() => setActiveFacebook(page.page_id)} disabled={updatingId === page.page_id} className="active-button">
                              {updatingId === page.page_id ? <Loader size={15} className="spinner" /> : <Radio size={15} />} Usar
                            </button>
                          )}
                          <button type="button" onClick={() => disconnectFacebook(page)} disabled={updatingId === page.page_id} className="disconnect-button compact-button">
                            <LogOut size={15} /> Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!hasFacebook && <div className="description"><p>Conecte paginas do Facebook para posts, imagens, videos e carrossel.</p></div>}

                {renderMetaDiagnostic('facebook')}

                <div className="connection-actions">
                  <button onClick={() => handleConnect('facebook')} disabled={connecting === 'facebook' || facebookStatus?.requires_config} className="connect-button facebook-connect">
                    {connecting === 'facebook' ? <><Loader size={16} className="spinner" />Conectando...</> : <><Plus size={16} />{hasFacebook ? 'Adicionar outra pagina' : 'Conectar com Meta'}</>}
                  </button>
                  <button onClick={() => checkStatuses(true)} disabled={loading} className="refresh-button" type="button" aria-label="Atualizar conexões do Facebook">
                    <RefreshCw size={16} className={loading ? 'spinner' : ''} />
                    Atualizar Facebook
                  </button>
                </div>
              </>
            )}
          </div>
        </div>}
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
                    : 'Defina as APIs específicas usadas por este canal ou perfil.'}
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
