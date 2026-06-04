import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCcw, TrendingUp, Eye, Clock, Users, Loader, AlertCircle, Radio } from 'lucide-react';
import { apiUrl } from '../../../config/api';
import './YouTubeAnalyticsTab.css';

function YouTubeAnalyticsTab() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/intel/youtube-analytics'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao carregar analytics');
      }

      const data = await response.json();
      setAnalytics(data);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err.message);
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const leadChannel = useMemo(() => (analytics?.channels || []).find((channel) => channel.is_active) || (analytics?.channels || [])[0] || null, [analytics]);
  const channelShareBase = analytics?.summary?.total_views || 0;

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) {
    return (
      <div className="youtube-analytics-tab loading-state">
        <Loader size={40} className="spinner" />
        <p>Carregando dados do canal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="youtube-analytics-tab error-state">
        <AlertCircle size={40} />
        <p>Erro ao carregar analytics</p>
        <span>{error}</span>
        <button onClick={fetchAnalytics} className="retry-button">
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="youtube-analytics-tab">
      <div className="analytics-topbar">
        <div>
          <h3>Leitura operacional do canal</h3>
          <p>Visão rápida de desempenho, retenção e ativos com melhor resposta.</p>
        </div>
        <button onClick={fetchAnalytics} className="retry-button analytics-refresh-button">
          <RefreshCcw size={16} />
          Atualizar
        </button>
      </div>

      {/* Metrics Overview */}
      <div className="metrics-grid">
        <div className="metric-card views">
          <div className="metric-icon">
            <Eye size={24} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Visualizações Total</span>
            <span className="metric-value">{formatNumber(analytics.summary.total_views)}</span>
          </div>
          <div className="metric-accent"></div>
        </div>

        <div className="metric-card watch-hours">
          <div className="metric-icon">
            <Clock size={24} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Horas Assistidas</span>
            <span className="metric-value">{formatNumber(analytics.summary.total_watch_hours)}</span>
          </div>
          <div className="metric-accent"></div>
        </div>

        <div className="metric-card retention">
          <div className="metric-icon">
            <TrendingUp size={24} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Taxa Retenção Média</span>
            <span className="metric-value">{analytics.summary.average_retention.toFixed(2)}%</span>
          </div>
          <div className="metric-accent"></div>
        </div>

        <div className="metric-card subscribers">
          <div className="metric-icon">
            <Users size={24} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Inscritos</span>
            <span className="metric-value">{formatNumber(analytics.summary.subscriber_count)}</span>
          </div>
          <div className="metric-accent"></div>
        </div>
      </div>

      {leadChannel && (
        <div className="analytics-highlight">
          <div className="analytics-highlight__meta">
            <strong>Canal em destaque</strong>
            <h4>{leadChannel.channel_name}</h4>
            <p>
              {formatNumber(leadChannel.view_count)} visualizações · {leadChannel.estimated_retention.toFixed(1)}% de retenção estimada · {formatNumber(leadChannel.video_count)} vídeos publicados
            </p>
          </div>
          <div className="analytics-highlight__side">
            <span>{lastUpdated ? `Atualizado em ${new Date(lastUpdated).toLocaleString('pt-BR')}` : 'Sem atualização registrada'}</span>
          </div>
        </div>
      )}

      <div className="top-videos-section compact-channel-section">
        <div className="section-header">
          <h3>
            <Radio size={20} />
            Análise separada por canal
          </h3>
          <span className="video-count">{analytics.channels.length} canais</span>
        </div>

        <div className="videos-list">
          {analytics.channels.map((channel, index) => (
            <div key={channel.channel_id || index} className="video-card compact-channel-card">
              <div className="video-info">
                <div className="channel-title-row">
                  <h4 title={channel.channel_name}>{channel.channel_name}</h4>
                  {channel.is_active && <span className="active-channel-badge">Ativo</span>}
                </div>
                <p className="video-date">Canal {channel.is_active ? 'principal em uso' : 'conectado para leitura separada'}</p>

                <div
                  className="channel-donut"
                  style={{
                    '--channel-share': `${Math.max(4, Math.min(100, channelShareBase ? (channel.view_count / channelShareBase) * 100 : 0))}%`,
                  }}
                >
                  <div className="channel-donut__center">
                    <strong>{channelShareBase ? ((channel.view_count / channelShareBase) * 100).toFixed(1) : '0.0'}%</strong>
                    <span>share</span>
                  </div>
                </div>

                <div className="video-stats">
                  <div className="stat">
                    <Eye size={14} />
                    <span>{formatNumber(channel.view_count)}</span>
                  </div>
                  <div className="stat">
                    <Users size={14} />
                    <span>{formatNumber(channel.subscriber_count)}</span>
                  </div>
                  <div className="stat">
                    <Clock size={14} />
                    <span>{formatNumber(channel.estimated_watch_hours)}h</span>
                  </div>
                  <div className="stat">
                    <TrendingUp size={14} />
                    <span>{channel.estimated_retention.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="video-action">
                <div className="channel-mini-kpis">
                  <div className="channel-kpi-stack">
                    <strong>{formatNumber(channel.video_count)}</strong>
                    <span>vídeos</span>
                  </div>
                  <div className="channel-kpi-stack retention">
                    <strong>{channel.estimated_retention.toFixed(1)}%</strong>
                    <span>retenção</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {analytics.channels.length === 0 && (
          <div className="no-videos">
            <Radio size={40} />
            <p>Nenhum canal conectado encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default YouTubeAnalyticsTab;
