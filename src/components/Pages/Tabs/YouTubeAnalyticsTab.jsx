import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Eye,
  Loader2,
  MessageCircle,
  RefreshCcw,
  ThumbsUp,
  TrendingUp,
  Users,
  Video,
  WifiOff,
} from 'lucide-react';
import SourceBadge from '../../Branding/SourceBadge';
import { apiUrl } from '../../../config/api';
import './YouTubeAnalyticsTab.css';

const formatNumber = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', {
    notation: number >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(number);
};

const formatPercent = (value) => `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

const formatDate = (value, includeTime = false) => {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return date.toLocaleString('pt-BR', includeTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' });
};

const formatDuration = (seconds) => {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = Math.floor(total % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${minutes}:${String(remaining).padStart(2, '0')}`;
};

const formatDelta = (value) => {
  if (value === null || value === undefined) return 'Aguardando histórico';
  const number = Number(value || 0);
  return `${number > 0 ? '+' : ''}${formatNumber(number)}`;
};

function YouTubeAnalyticsTab() {
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState(null);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadMonitor = useCallback(async (channelId = '', force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (channelId) params.set('channel_id', channelId);
      if (force) params.set('refresh', 'true');
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(apiUrl(`/api/intel/youtube-monitor${suffix}`));
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Não foi possível carregar o monitoramento do YouTube.');
      }
      setMonitor(payload);
      setSelectedChannelId(payload.selected_channel_id || channelId || '');
    } catch (requestError) {
      setError(requestError.message || 'Falha ao carregar o monitoramento.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMonitor();
  }, [loadMonitor]);

  const selectChannel = (channelId) => {
    if (!channelId || channelId === selectedChannelId) return;
    setSelectedChannelId(channelId);
    loadMonitor(channelId);
  };

  if (loading && !monitor) {
    return (
      <div className="intel-monitor-state">
        <Loader2 size={38} className="intel-spin" />
        <span>Consultando o canal conectado...</span>
      </div>
    );
  }

  if (error && !monitor) {
    return (
      <div className="intel-monitor-state error">
        <AlertCircle size={38} />
        <strong>Falha ao carregar o Alliance Intel</strong>
        <span>{error}</span>
        <button type="button" className="intel-primary-button" onClick={() => loadMonitor(selectedChannelId, true)}>
          <RefreshCcw size={16} />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!monitor?.channels?.length) {
    return (
      <div className="intel-monitor-state disconnected">
        <WifiOff size={40} />
        <strong>Nenhum canal conectado</strong>
        <span>Conecte um canal do YouTube para iniciar o monitoramento.</span>
        <button type="button" className="intel-primary-button" onClick={() => navigate('/conexoes')}>
          Abrir conexões
        </button>
      </div>
    );
  }

  const channel = monitor.selected_channel || {};
  const videos = channel.recent_videos || [];
  const deltas = monitor.deltas;

  return (
    <div className="youtube-monitor">
      <section className="intel-toolbar">
        <div className="intel-toolbar__source">
          <SourceBadge label="Dados do canal" tone="youtube" officialAsset compact />
          <span>
            {monitor.stale ? 'Última leitura disponível' : `Atualizado em ${formatDate(monitor.generated_at, true)}`}
          </span>
          {monitor.cached && <em>cache de 5 min</em>}
        </div>
        <button
          type="button"
          className="intel-primary-button"
          onClick={() => loadMonitor(selectedChannelId, true)}
          disabled={refreshing}
        >
          <RefreshCcw size={16} className={refreshing ? 'intel-spin' : ''} />
          {refreshing ? 'Atualizando' : 'Atualizar dados'}
        </button>
      </section>

      <section className="intel-channel-selector" aria-label="Canais conectados">
        {monitor.channels.map((item) => (
          <button
            type="button"
            key={item.channel_id}
            className={`intel-channel-option ${item.channel_id === selectedChannelId ? 'active' : ''}`}
            onClick={() => selectChannel(item.channel_id)}
          >
            {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <Video size={22} />}
            <span>
              <strong>{item.channel_name || 'Canal sem nome'}</strong>
              <small>{formatNumber(item.subscriber_count)} inscritos</small>
            </span>
            {item.is_active && <em>Em uso</em>}
          </button>
        ))}
      </section>

      <section className="intel-channel-heading">
        <div className="intel-channel-heading__identity">
          {channel.thumbnail ? <img src={channel.thumbnail} alt="" /> : <Video size={28} />}
          <div>
            <span>Canal monitorado</span>
            <h2>{channel.channel_name || 'Canal do YouTube'}</h2>
          </div>
        </div>
        <div className="intel-channel-heading__status">
          <CheckCircle2 size={16} />
          Conectado
        </div>
      </section>

      <section className="intel-kpi-grid">
        <article className="intel-kpi">
          <Users size={21} />
          <span>Inscritos</span>
          <strong>{formatNumber(channel.subscriber_count)}</strong>
          <small>{formatDelta(deltas?.subscriber_count)} desde a referência</small>
        </article>
        <article className="intel-kpi">
          <Eye size={21} />
          <span>Visualizações totais</span>
          <strong>{formatNumber(channel.view_count)}</strong>
          <small>{formatDelta(deltas?.view_count)} desde a referência</small>
        </article>
        <article className="intel-kpi">
          <Video size={21} />
          <span>Vídeos publicados</span>
          <strong>{formatNumber(channel.video_count)}</strong>
          <small>{formatDelta(deltas?.video_count)} desde a referência</small>
        </article>
        <article className="intel-kpi">
          <BarChart3 size={21} />
          <span>Média dos recentes</span>
          <strong>{formatNumber(channel.average_views)}</strong>
          <small>últimos {channel.recent_video_count || 0} vídeos</small>
        </article>
      </section>

      <section className="intel-performance-band">
        <div>
          <Eye size={17} />
          <span>Views recentes</span>
          <strong>{formatNumber(channel.recent_views)}</strong>
        </div>
        <div>
          <ThumbsUp size={17} />
          <span>Curtidas</span>
          <strong>{formatNumber(channel.recent_likes)}</strong>
        </div>
        <div>
          <MessageCircle size={17} />
          <span>Comentários</span>
          <strong>{formatNumber(channel.recent_comments)}</strong>
        </div>
        <div>
          <TrendingUp size={17} />
          <span>Engajamento</span>
          <strong>{formatPercent(channel.recent_engagement_rate)}</strong>
        </div>
        <div>
          <CalendarClock size={17} />
          <span>Intervalo médio</span>
          <strong>{channel.posting_cadence_days ? `${channel.posting_cadence_days} dias` : 'Sem base'}</strong>
        </div>
      </section>

      <section className="intel-alerts" aria-label="Diagnóstico do canal">
        {(monitor.alerts || []).map((alert, index) => (
          <div key={`${alert.level}-${index}`} className={`intel-alert level-${alert.level}`}>
            {alert.level === 'ok' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
            <span>{alert.message}</span>
          </div>
        ))}
      </section>

      <section className="intel-videos-section">
        <div className="intel-section-heading">
          <div>
            <h3>Vídeos recentes</h3>
            <p>Desempenho individual das últimas publicações encontradas.</p>
          </div>
          <span>{videos.length} vídeos</span>
        </div>

        {videos.length ? (
          <div className="intel-video-table-wrap">
            <table className="intel-video-table">
              <thead>
                <tr>
                  <th>Vídeo</th>
                  <th>Publicado</th>
                  <th>Views</th>
                  <th>Curtidas</th>
                  <th>Comentários</th>
                  <th>Engajamento</th>
                  <th aria-label="Abrir vídeo" />
                </tr>
              </thead>
              <tbody>
                {videos.map((video) => (
                  <tr key={video.video_id}>
                    <td data-label="Vídeo">
                      <div className="intel-video-title">
                        <div className="intel-video-thumb">
                          {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <Video size={20} />}
                          <span>{formatDuration(video.duration_seconds)}</span>
                        </div>
                        <div>
                          <strong title={video.title}>{video.title}</strong>
                          <small>{video.is_short ? 'Short' : 'Vídeo'}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Publicado">{formatDate(video.published_at)}</td>
                    <td data-label="Views">{formatNumber(video.views)}</td>
                    <td data-label="Curtidas">{formatNumber(video.likes)}</td>
                    <td data-label="Comentários">{formatNumber(video.comments)}</td>
                    <td data-label="Engajamento">{formatPercent(video.engagement_rate)}</td>
                    <td>
                      <a href={video.url} target="_blank" rel="noreferrer" title="Abrir no YouTube">
                        <ExternalLink size={16} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="intel-empty-videos">Nenhum vídeo recente encontrado.</div>
        )}
      </section>
    </div>
  );
}

export default YouTubeAnalyticsTab;
