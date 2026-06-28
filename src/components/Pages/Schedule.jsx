import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Facebook,
  History,
  Instagram,
  Loader,
  RefreshCcw,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { apiUrl } from '../../config/api';
import SourceBadge from '../Branding/SourceBadge';
import './Pages.css';
import './Schedule.css';

function Schedule() {
  const [items, setItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [savingTimeId, setSavingTimeId] = useState(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [scheduleTimes, setScheduleTimes] = useState({});
  const [destinationMaps, setDestinationMaps] = useState({
    youtube: {},
    instagram: {},
    facebook: {},
  });
  const [error, setError] = useState('');

  const toLocalDateTimeValue = useCallback((value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(0, 16);

    const pad = (part) => String(part).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }, []);

  const syncScheduleTimes = useCallback((nextItems) => {
    const nextTimes = {};
    nextItems.forEach((item) => {
      nextTimes[item.id] = toLocalDateTimeValue(item.scheduled_at);
    });
    setScheduleTimes(nextTimes);
  }, [toLocalDateTimeValue]);

  const loadSchedule = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');

    try {
      const [
        scheduleResult,
        historyResult,
        youtubeStatusResult,
        instagramStatusResult,
        facebookStatusResult,
      ] = await Promise.allSettled([
        fetch(apiUrl('/api/schedule/')),
        fetch(apiUrl('/api/schedule/published-history')),
        fetch(apiUrl(`/api/conexoes/youtube/status${forceRefresh ? '?refresh=1' : ''}`)),
        fetch(apiUrl('/api/instagram/status')),
        fetch(apiUrl('/api/facebook/status')),
      ]);

      if (scheduleResult.status !== 'fulfilled' || !scheduleResult.value.ok) {
        throw new Error('Erro ao carregar agenda');
      }

      const data = await scheduleResult.value.json();
      setItems(data.items || []);
      syncScheduleTimes(data.items || []);

      if (historyResult.status === 'fulfilled' && historyResult.value.ok) {
        const historyData = await historyResult.value.json();
        setHistoryItems(historyData.items || []);
      } else {
        setHistoryItems([]);
      }

      const nextMaps = { youtube: {}, instagram: {}, facebook: {} };
      if (youtubeStatusResult.status === 'fulfilled' && youtubeStatusResult.value.ok) {
        const youtubeData = await youtubeStatusResult.value.json();
        (youtubeData.channels || []).forEach((channel) => {
          nextMaps.youtube[channel.channel_id] = channel.channel_name;
        });
      }
      if (instagramStatusResult.status === 'fulfilled' && instagramStatusResult.value.ok) {
        const instagramData = await instagramStatusResult.value.json();
        (instagramData.profiles || []).forEach((profile) => {
          nextMaps.instagram[profile.profile_id] = profile.username || profile.profile_name;
        });
      }
      if (facebookStatusResult.status === 'fulfilled' && facebookStatusResult.value.ok) {
        const facebookData = await facebookStatusResult.value.json();
        (facebookData.pages || []).forEach((page) => {
          nextMaps.facebook[page.page_id] = page.page_name;
        });
      }
      setDestinationMaps(nextMaps);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [syncScheduleTimes]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const deleteItem = async (id) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Remover este vídeo da agenda?')) {
      return;
    }

    setDeletingId(id);
    setError('');

    try {
      const response = await fetch(apiUrl(`/api/schedule/${id}`), {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Erro ao remover agendamento');
      }

      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const clearPublishedHistory = async () => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Apagar todo o histórico publicado?')) {
      return;
    }

    setClearingHistory(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/schedule/published-history'), {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Erro ao apagar histórico');
      }

      setHistoryItems([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearingHistory(false);
    }
  };

  const retryItem = async (id) => {
    setRetryingId(id);
    setError('');

    try {
      const response = await fetch(apiUrl(`/api/schedule/${id}/retry`), {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Erro ao reenfileirar vídeo');
      }

      const data = await response.json();
      setItems((current) => current.map((item) => (item.id === id ? data.item : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setRetryingId(null);
    }
  };

  const updateScheduleTime = async (id) => {
    const scheduledAt = scheduleTimes[id];
    if (!scheduledAt) {
      setError('Escolha uma data e hora para salvar');
      return;
    }

    setSavingTimeId(id);
    setError('');

    try {
      const response = await fetch(apiUrl(`/api/schedule/${id}/time`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scheduled_at: scheduledAt }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Erro ao alterar horário');
      }

      const data = await response.json();
      setItems((current) => current
        .map((item) => (item.id === id ? data.item : item))
        .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at))));
      setScheduleTimes((current) => ({
        ...current,
        [id]: toLocalDateTimeValue(data.item.scheduled_at),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTimeId(null);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getPlatformConfig = (platform = 'youtube') => {
    if (platform === 'instagram') {
      return { label: 'Instagram', icon: Instagram, className: 'instagram', showIcon: true };
    }
    if (platform === 'facebook') {
      return { label: 'Facebook', icon: Facebook, className: 'facebook', showIcon: true };
    }
    return { label: 'YouTube', icon: null, className: 'youtube', showIcon: false };
  };

  const getDestinationInfo = useCallback((item) => {
    const platform = item.platform || 'youtube';
    if (platform === 'instagram') {
      const id = item.instagram_profile_id || '';
      return {
        id,
        label: item.instagram_profile_name || destinationMaps.instagram[id] || (id ? `Perfil ${id}` : 'Perfil Instagram ativo'),
      };
    }
    if (platform === 'facebook') {
      const id = item.facebook_page_id || '';
      return {
        id,
        label: item.facebook_page_name || destinationMaps.facebook[id] || (id ? `Página ${id}` : 'Página Facebook ativa'),
      };
    }

    const id = item.channel_id || '';
    return {
      id,
      label: item.channel_name || destinationMaps.youtube[id] || (id ? `Canal ${id}` : 'Canal ativo do YouTube'),
    };
  }, [destinationMaps]);

  const publishedHistory = useMemo(() => historyItems.slice(0, 10), [historyItems]);

  const getPublishedLink = (item) => (
    item.youtube_short_url ||
    item.youtube_url ||
    item.link_url ||
    item.video_url ||
    item.image_url ||
    ''
  );

  const getStatusInfo = useCallback((status = '') => {
    const normalized = String(status || '').toLowerCase();
    const map = {
      ready_to_post: { label: 'Pronto para enviar', className: 'ready-to-post' },
      scheduled: { label: 'Agendado', className: 'scheduled' },
      publishing: { label: 'Enviando', className: 'publishing' },
      published: { label: 'Publicado', className: 'published' },
      publish_failed: { label: 'Precisa revisão', className: 'publish-failed' },
      failed: { label: 'Precisa revisão', className: 'publish-failed' },
    };

    return map[normalized] || { label: normalized || 'Sem status', className: 'unknown' };
  }, []);

  const getSchedulePreview = useCallback((item) => {
    if (item.filename) {
      return {
        type: 'video',
        src: apiUrl(`/api/forge/play-video/${encodeURIComponent(item.filename)}`),
      };
    }

    if (item.video_url) {
      return {
        type: 'video',
        src: item.video_url,
      };
    }

    if (item.image_url) {
      return {
        type: 'image',
        src: item.image_url,
      };
    }

    if (item.output_path && String(item.output_path).startsWith('/api/')) {
      return {
        type: 'video',
        src: apiUrl(item.output_path),
      };
    }

    return null;
  }, []);

  const groupedItems = useMemo(() => {
    const groups = new Map();

    items.forEach((item) => {
      const platformConfig = getPlatformConfig(item.platform);
      const destination = getDestinationInfo(item);
      const key = `${item.platform || 'youtube'}:${destination.id || destination.label}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          platform: item.platform || 'youtube',
          platformLabel: platformConfig.label,
          platformClass: platformConfig.className,
          destinationLabel: destination.label,
          destinationId: destination.id,
          items: [],
        });
      }

      groups.get(key).items.push(item);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at))),
      }))
      .sort((a, b) => {
        const firstA = a.items[0]?.scheduled_at || '';
        const firstB = b.items[0]?.scheduled_at || '';
        return firstA.localeCompare(firstB);
      });
  }, [getDestinationInfo, items]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Agenda</h1>
          <p>Vídeos renderizados e prontos para postar no horário escolhido.</p>
        </div>

        <button className="btn-primary" onClick={() => loadSchedule(true)} disabled={loading}>
          {loading ? <Loader size={18} className="schedule-spin" /> : <RefreshCcw size={18} />}
          Atualizar
        </button>
      </div>

      {error && <div className="schedule-error">{error}</div>}

      <div className="schedule-stats">
        <div className="schedule-stat">
          <CalendarClock size={22} />
          <span>{items.length}</span>
          <strong>Na agenda</strong>
        </div>

        <div className="schedule-stat">
          <Clock size={22} />
          <span>{items.filter((item) => item.status === 'ready_to_post').length}</span>
          <strong>Prontos</strong>
        </div>

        <div className="schedule-stat">
          <CheckCircle2 size={22} />
          <span>{historyItems.length}</span>
          <strong>Historico</strong>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">Carregando agenda...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <CalendarClock size={42} />
          <h3>Nenhum vídeo programado</h3>
          <p>Renderize um vídeo no Forge e escolha o horário para ele aparecer aqui.</p>
        </div>
      ) : (
        <div className="schedule-groups">
          {groupedItems.map((group) => {
            const platformConfig = getPlatformConfig(group.platform);
            const PlatformIcon = platformConfig.icon;
            return (
              <section className={`schedule-group ${group.platformClass}`} key={group.key}>
                <div className="schedule-group-header">
                  <div className="schedule-group-title">
                    {platformConfig.showIcon && PlatformIcon ? <PlatformIcon size={20} /> : null}
                    <div>
                      <h2>{group.platformLabel}</h2>
                      <span>{group.destinationLabel}</span>
                    </div>
                  </div>
                  <strong>{group.items.length} agendado(s)</strong>
                </div>

                <div className="schedule-list">
                  {group.items.map((item) => {
                    const itemConfig = getPlatformConfig(item.platform);
                    const ItemIcon = itemConfig.icon;
                    const destination = getDestinationInfo(item);
                    return (
            <div className="schedule-item" key={item.id}>
              <div className="schedule-time">
                <div className="schedule-time-current">
                  <Clock size={18} />
                  <span>{formatDateTime(item.scheduled_at)}</span>
                </div>

                <div className="schedule-time-edit">
                  <input
                    type="datetime-local"
                    value={scheduleTimes[item.id] || ''}
                    onChange={(event) => setScheduleTimes((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))}
                    disabled={item.status === 'publishing' || item.status === 'published'}
                  />
                  <button
                    onClick={() => updateScheduleTime(item.id)}
                    disabled={
                      savingTimeId === item.id ||
                      item.status === 'publishing' ||
                      item.status === 'published' ||
                      scheduleTimes[item.id] === toLocalDateTimeValue(item.scheduled_at)
                    }
                    title="Salvar novo dia e horário"
                  >
                    {savingTimeId === item.id ? (
                      <Loader size={15} className="schedule-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                  </button>
                </div>
              </div>

              <div className="schedule-preview">
                {(() => {
                  const preview = getSchedulePreview(item);
                  if (!preview) {
                    return (
                      <div className="schedule-preview-empty">
                        Sem preview
                      </div>
                    );
                  }

                  if (preview.type === 'image') {
                    return (
                      <div className="schedule-preview-media">
                        <span className={`schedule-preview-status ${getStatusInfo(item.status).className}`}>
                          {getStatusInfo(item.status).label}
                        </span>
                        <img src={preview.src} alt={item.title} loading="lazy" />
                      </div>
                    );
                  }

                  return (
                    <div className="schedule-preview-media">
                      <span className={`schedule-preview-status ${getStatusInfo(item.status).className}`}>
                        {getStatusInfo(item.status).label}
                      </span>
                      <video
                        src={preview.src}
                        muted
                        playsInline
                        preload="none"
                      />
                    </div>
                  );
                })()}
              </div>

                <div className="schedule-main">
                  <div className="schedule-title-row">
                  {itemConfig.showIcon && ItemIcon ? <ItemIcon size={18} /> : null}
                  <h3>{item.title}</h3>
                </div>

                  <SourceBadge
                    label={itemConfig.label}
                    detail={destination.label}
                    tone={group.platformClass}
                    compact
                    officialAsset={itemConfig.label === 'YouTube'}
                  />

                {item.description && <p>{item.description}</p>}
                {(item.attempts || item.failed_at) && (
                  <div className="schedule-inline-meta">
                    {item.attempts ? <span>{item.attempts} tentativa(s)</span> : null}
                    {item.failed_at ? <span>Ultima falha em {formatDateTime(item.failed_at)}</span> : null}
                  </div>
                )}
                {item.last_error && <p className="schedule-last-error">{item.last_error}</p>}

                <div className="schedule-tags">
                  {(item.hashtags || []).slice(0, 8).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>

              <div className="schedule-actions">
                <span className={`schedule-status ${getStatusInfo(item.status).className}`}>
                  {getStatusInfo(item.status).label}
                </span>
                {item.status === 'publish_failed' && (
                  <button
                    className="schedule-retry"
                    onClick={() => retryItem(item.id)}
                    disabled={retryingId === item.id}
                    title="Tentar publicar novamente"
                  >
                    {retryingId === item.id ? (
                      <Loader size={16} className="schedule-spin" />
                    ) : (
                      <RotateCcw size={16} />
                    )}
                  </button>
                )}
                <button
                  className="schedule-delete"
                  onClick={() => deleteItem(item.id)}
                  disabled={deletingId === item.id}
                  title="Remover da agenda"
                >
                  {deletingId === item.id ? (
                    <Loader size={16} className="schedule-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!loading && (
        <section className="schedule-history-panel">
        <div className="schedule-history-panel__header">
          <div>
            <h2>Historico interno recente de publicacao</h2>
            <p>Itens publicados saem da fila, continuam registrados para revisao operacional e expiram automaticamente após 50 minutos.</p>
          </div>
          <div className="schedule-history-panel__actions">
            <div className="schedule-history-panel__badge">
              <History size={16} />
              <span>{historyItems.length} registrado(s)</span>
            </div>
            <button
              type="button"
              className="schedule-history-clear"
              onClick={clearPublishedHistory}
              disabled={clearingHistory || historyItems.length === 0}
              title="Apagar histórico publicado"
            >
              {clearingHistory ? <Loader size={15} className="schedule-spin" /> : <Trash2 size={15} />}
              Apagar histórico
            </button>
          </div>
        </div>

        {publishedHistory.length === 0 ? (
          <div className="empty-state schedule-history-empty">
            <History size={36} />
            <h3>Sem historico publicado</h3>
            <p>Assim que a esteira concluir uma postagem, ela aparecera nesta trilha interna e sera limpa automaticamente depois de 50 minutos.</p>
          </div>
        ) : (
          <div className="schedule-history-list">
            {publishedHistory.map((item) => {
              const itemConfig = getPlatformConfig(item.platform);
              const ItemIcon = itemConfig.icon;
              const destination = getDestinationInfo(item);
              const publishedLink = getPublishedLink(item);

              return (
                <article className="schedule-history-item" key={item.id}>
                  <div className="schedule-history-item__main">
                    <div className="schedule-title-row">
                      {itemConfig.showIcon && ItemIcon ? <ItemIcon size={18} /> : null}
                      <h3>{item.title}</h3>
                    </div>

                     <SourceBadge
                        label={itemConfig.label}
                        detail={destination.label}
                        tone={itemConfig.className}
                        compact
                        officialAsset={itemConfig.label === 'YouTube'}
                      />

                    <div className={`schedule-history-status ${getStatusInfo(item.status).className}`}>
                      {getStatusInfo(item.status).label}
                    </div>

                    {item.description && <p>{item.description}</p>}

                    <div className="schedule-history-meta">
                      <span>
                        <Clock size={14} />
                        Publicado em {formatDateTime(item.published_at || item.updated_at)}
                      </span>
                      <span>
                        <CheckCircle2 size={14} />
                        {item.status}
                      </span>
                      <span>
                        <RotateCcw size={14} />
                        {item.attempts || 1} tentativa(s)
                      </span>
                    </div>

                    {(item.hashtags || []).slice(0, 6).length > 0 && (
                      <div className="schedule-tags">
                        {(item.hashtags || []).slice(0, 6).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="schedule-history-item__side">
                    {publishedLink ? (
                      <a href={publishedLink} target="_blank" rel="noreferrer" className="schedule-history-link">
                        <ExternalLink size={15} />
                        Abrir publicado
                      </a>
                    ) : (
                      <div className="schedule-history-link muted">
                        <AlertTriangle size={15} />
                        Sem link publico
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        </section>
      )}
    </div>
  );
}

export default Schedule;
