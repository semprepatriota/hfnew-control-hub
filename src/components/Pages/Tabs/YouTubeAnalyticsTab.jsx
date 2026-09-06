import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TrendingDown,
  TrendingUp,
  Users,
  Video,
  WifiOff,
} from 'lucide-react';
import SourceBadge from '../../Branding/SourceBadge';
import { apiFetch, apiUrl } from '../../../config/api';
import {
  buildTrendBars,
  filterRadarVideos,
  formatRelativeTime,
  PERFORMANCE_LABELS,
  VIDEO_FILTERS,
} from './youtubeRadarUtils';
import './YouTubeAnalyticsTab.css';

const PERIOD_OPTIONS = [7, 30, 90];

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

const fallbackPeriod = (days) => ({
  days,
  video_count: 0,
  views: 0,
  likes: 0,
  comments: 0,
  average_views: 0,
  engagement_rate: 0,
});

function PerformanceIcon({ status }) {
  if (status === 'above') return <TrendingUp size={15} />;
  if (status === 'below') return <TrendingDown size={15} />;
  return <BarChart3 size={15} />;
}

function YouTubeAnalyticsTab() {
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState(null);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [videoFilter, setVideoFilter] = useState('all');
  const [periodDays, setPeriodDays] = useState(30);
  const [clock, setClock] = useState(Date.now());

  const channel = monitor?.selected_channel || {};
  const videos = channel.recent_videos || [];
  const visibleVideos = useMemo(
    () => filterRadarVideos(videos, videoFilter, clock),
    [clock, videoFilter, videos],
  );
  const trendBars = useMemo(
    () => buildTrendBars(videos, periodDays, 18, clock),
    [clock, periodDays, videos],
  );
  const period = channel.periods?.[String(periodDays)] || fallbackPeriod(periodDays);

  const loadMonitor = useCallback(async (channelId = '', force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (channelId) params.set('channel_id', channelId);
      if (force) params.set('refresh', 'true');
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const response = await apiFetch(apiUrl(`/api/intel/youtube-monitor${suffix}`), {
        retries: force ? 0 : 1,
        timeoutMs: 30000,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'Não foi possível carregar o monitoramento do YouTube.');
      }
      setMonitor(payload);
      setSelectedChannelId(payload.selected_channel_id || channelId || '');
      setClock(Date.now());
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

  useEffect(() => {
    const intervalId = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const selectChannel = (channelId) => {
    if (!channelId || channelId === selectedChannelId) return;
    setSelectedChannelId(channelId);
    setVideoFilter('all');
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
        <strong>Falha ao carregar o YouTube Radar</strong>
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

  const deltas = monitor.deltas;
  const activeChannelSummary = monitor.channels.find((item) => item.channel_id === selectedChannelId) || {};

  return (
    <div className="youtube-monitor">
      <section className="intel-toolbar">
        <div className="intel-toolbar__source">
          <SourceBadge label="YouTube" tone="youtube" officialAsset compact />
          <strong>{monitor.stale ? 'Exibindo a última leitura disponível' : formatRelativeTime(monitor.generated_at, clock)}</strong>
          <span>{monitor.cached ? 'Cache protegido de 5 min' : formatDate(monitor.generated_at, true)}</span>
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

      {error && (
        <div className="intel-inline-error" role="alert">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <section className="intel-channel-switcher" aria-label="Canal monitorado">
        <div className="intel-channel-switcher__identity">
          {channel.thumbnail ? <img src={channel.thumbnail} alt="" /> : <Video size={26} />}
          <div>
            <span>Canal monitorado</span>
            <strong>{channel.channel_name || 'Canal do YouTube'}</strong>
          </div>
        </div>
        <label>
          <span>Trocar canal</span>
          <select value={selectedChannelId} onChange={(event) => selectChannel(event.target.value)}>
            {monitor.channels.map((item) => (
              <option key={item.channel_id} value={item.channel_id}>
                {item.channel_name || 'Canal sem nome'}
              </option>
            ))}
          </select>
        </label>
        <div className={`intel-channel-switcher__status ${activeChannelSummary.needs_reconnect ? 'warning' : ''}`}>
          {activeChannelSummary.needs_reconnect ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {activeChannelSummary.needs_reconnect ? 'Reconexão necessária' : 'Conectado'}
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
          <small>{channel.short_count || 0} Shorts · {channel.long_video_count || 0} longos na leitura</small>
        </article>
        <article className="intel-kpi">
          <BarChart3 size={21} />
          <span>Média dos recentes</span>
          <strong>{formatNumber(channel.average_views)}</strong>
          <small>base de {channel.recent_video_count || 0} vídeos</small>
        </article>
      </section>

      <section className="intel-period-panel">
        <div className="intel-section-heading">
          <div>
            <h3>Desempenho por período</h3>
            <p>Leitura dos vídeos publicados entre os 50 mais recentes do canal.</p>
          </div>
          <div className="intel-period-tabs" aria-label="Período da análise">
            {PERIOD_OPTIONS.map((days) => (
              <button
                type="button"
                key={days}
                className={periodDays === days ? 'active' : ''}
                onClick={() => setPeriodDays(days)}
              >
                {days} dias
              </button>
            ))}
          </div>
        </div>

        <div className="intel-performance-band">
          <div>
            <Video size={17} />
            <span>Publicações</span>
            <strong>{period.video_count || 0}</strong>
          </div>
          <div>
            <Eye size={17} />
            <span>Views</span>
            <strong>{formatNumber(period.views)}</strong>
          </div>
          <div>
            <ThumbsUp size={17} />
            <span>Curtidas</span>
            <strong>{formatNumber(period.likes)}</strong>
          </div>
          <div>
            <MessageCircle size={17} />
            <span>Comentários</span>
            <strong>{formatNumber(period.comments)}</strong>
          </div>
          <div>
            <TrendingUp size={17} />
            <span>Engajamento</span>
            <strong>{formatPercent(period.engagement_rate)}</strong>
          </div>
        </div>

        <div className="intel-trend-chart" aria-label={`Visualizações das publicações nos últimos ${periodDays} dias`}>
          {trendBars.length ? trendBars.map((video) => (
            <a
              key={video.video_id}
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className={`intel-trend-bar performance-${video.performance_status || 'normal'}`}
              title={`${video.title}: ${formatNumber(video.views)} visualizações`}
            >
              <span style={{ height: `${video.bar_percent}%` }} />
            </a>
          )) : <span className="intel-trend-empty">Sem publicações nesse período.</span>}
        </div>
      </section>

      <section className="intel-activity-strip">
        <div>
          <CalendarClock size={17} />
          <span>Intervalo médio</span>
          <strong>{channel.posting_cadence_days ? `${channel.posting_cadence_days} dias` : 'Sem base'}</strong>
        </div>
        <div>
          <Video size={17} />
          <span>Última publicação</span>
          <strong>{channel.days_since_upload === null || channel.days_since_upload === undefined ? 'Sem registro' : `${channel.days_since_upload} dia${channel.days_since_upload === 1 ? '' : 's'}`}</strong>
        </div>
        <div>
          <Eye size={17} />
          <span>Views nos 50 recentes</span>
          <strong>{formatNumber(channel.recent_views)}</strong>
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
        <div className="intel-section-heading intel-video-heading">
          <div>
            <h3>Vídeos recentes</h3>
            <p>Compare cada publicação com a média atual do canal.</p>
          </div>
          <span>{visibleVideos.length} de {videos.length}</span>
        </div>

        <div className="intel-video-filters" aria-label="Filtrar vídeos">
          {VIDEO_FILTERS.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={videoFilter === filter.id ? 'active' : ''}
              onClick={() => setVideoFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {visibleVideos.length ? (
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
                  <th>Comparação</th>
                  <th aria-label="Abrir vídeo" />
                </tr>
              </thead>
              <tbody>
                {visibleVideos.map((video) => {
                  const performanceStatus = video.performance_status || 'normal';
                  const performanceWidth = Math.min(100, Math.max(5, Number(video.performance_ratio || 0) * 50));
                  return (
                    <tr key={video.video_id}>
                      <td data-label="Vídeo">
                        <div className="intel-video-title">
                          <div className="intel-video-thumb">
                            {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <Video size={20} />}
                            <span>{formatDuration(video.duration_seconds)}</span>
                          </div>
                          <div>
                            <strong title={video.title}>{video.title}</strong>
                            <small>{video.is_short ? 'Short' : 'Vídeo longo'}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Publicado">{formatDate(video.published_at)}</td>
                      <td data-label="Views">{formatNumber(video.views)}</td>
                      <td data-label="Curtidas">{formatNumber(video.likes)}</td>
                      <td data-label="Comentários">{formatNumber(video.comments)}</td>
                      <td data-label="Engajamento">{formatPercent(video.engagement_rate)}</td>
                      <td data-label="Comparação">
                        <div className={`intel-performance performance-${performanceStatus}`}>
                          <span><PerformanceIcon status={performanceStatus} />{PERFORMANCE_LABELS[performanceStatus]}</span>
                          <div><i style={{ width: `${performanceWidth}%` }} /></div>
                        </div>
                      </td>
                      <td data-label="Abrir">
                        <a href={video.url} target="_blank" rel="noreferrer" title="Abrir no YouTube">
                          <ExternalLink size={16} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="intel-empty-videos">Nenhum vídeo encontrado neste filtro.</div>
        )}
      </section>
    </div>
  );
}

export default YouTubeAnalyticsTab;
