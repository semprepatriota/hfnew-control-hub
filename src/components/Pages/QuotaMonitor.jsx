import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Filter, Loader, Radio, RefreshCcw, Search, Zap } from 'lucide-react';
import { apiUrl } from '../../config/api';
import './Pages.css';
import './QuotaMonitor.css';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'custom', label: 'Período personalizado' },
];

function formatDateTime(value) {
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
}

function statusLabel(status) {
  return status === 'success' ? 'Sucesso' : 'Falha';
}

function statusClass(status) {
  return status === 'success' ? 'success' : 'failed';
}

const SAMPLE_EVENTS = [
  {
    id: 'sample_1',
    timestamp: '2026-05-28T14:30:00',
    channel_name: 'HF News',
    action: 'Upload de vídeo',
    method: 'videos.insert',
    estimated_cost: 1600,
    status: 'success',
    message: 'Vídeo publicado',
  },
  {
    id: 'sample_2',
    timestamp: '2026-05-28T14:31:00',
    channel_name: 'HF News',
    action: 'Atualizar metadados',
    method: 'videos.update',
    estimated_cost: 50,
    status: 'success',
    message: 'Metadados atualizados',
  },
  {
    id: 'sample_3',
    timestamp: '2026-05-28T15:10:00',
    channel_name: 'Canal Teste',
    action: 'Upload de vídeo',
    method: 'videos.insert',
    estimated_cost: 1600,
    status: 'failed',
    message: 'Credencial expirada',
  },
];

function QuotaMonitor() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('today');
  const [channelId, setChannelId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchOverview = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('period', period);
      params.set('channel_id', channelId);
      if (period === 'custom') {
        if (startDate) params.set('start_date', `${startDate}T00:00:00`);
        if (endDate) params.set('end_date', `${endDate}T23:59:59`);
      }

      const response = await fetch(apiUrl(`/api/quota-monitor/overview?${params.toString()}`));
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail || 'Falha ao carregar monitoramento');
      }

      const payload = await response.json();
      setData(payload);
    } catch (err) {
      setError(err.message || 'Falha ao carregar monitoramento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, channelId]);

  const events = useMemo(() => {
    if (!data?.events?.length) return SAMPLE_EVENTS;
    return data.events;
  }, [data]);

  const channels = data?.filters?.channels || [];
  const cards = data?.cards || {
    estimated_quota_used: 0,
    uploads_today: 0,
    active_channels: 0,
    failures_today: 0,
    queue_publications: 0,
  };
  const channelSummary = data?.channel_summary || [];

  return (
    <div className="page-container quota-monitor-page">
      <div className="page-header">
        <div>
          <h1>Monitoramento de Cota</h1>
          <p>Painel interno para análise operacional e compliance de consumo estimado da YouTube Data API.</p>
        </div>
        <button type="button" className="btn-primary" onClick={fetchOverview} disabled={loading}>
          {loading ? <Loader size={16} className="spin" /> : <RefreshCcw size={16} />}
          Atualizar
        </button>
      </div>

      {error && <div className="quota-monitor-error">{error}</div>}

      <section className="quota-cards">
        <article className="quota-card">
          <Zap size={16} />
          <span>Cota estimada usada hoje</span>
          <strong>{cards.estimated_quota_used}</strong>
        </article>
        <article className="quota-card">
          <CheckCircle2 size={16} />
          <span>Total de uploads hoje</span>
          <strong>{cards.uploads_today}</strong>
        </article>
        <article className="quota-card">
          <Radio size={16} />
          <span>Canais ativos</span>
          <strong>{cards.active_channels}</strong>
        </article>
        <article className="quota-card">
          <AlertTriangle size={16} />
          <span>Falhas hoje</span>
          <strong>{cards.failures_today}</strong>
        </article>
        <article className="quota-card">
          <CalendarDays size={16} />
          <span>Publicações em fila</span>
          <strong>{cards.queue_publications}</strong>
        </article>
      </section>

      <section className="quota-filters">
        <div className="quota-filter-group">
          <label htmlFor="period">Período</label>
          <div className="filter-inline">
            <Filter size={14} />
            <select id="period" value={period} onChange={(event) => setPeriod(event.target.value)}>
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="quota-filter-group">
          <label htmlFor="channel">Canal</label>
          <div className="filter-inline">
            <Search size={14} />
            <select id="channel" value={channelId} onChange={(event) => setChannelId(event.target.value)}>
              <option value="all">Todos os canais</option>
              {channels.map((channel) => (
                <option key={channel.channel_id} value={channel.channel_id}>
                  {channel.channel_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {period === 'custom' && (
          <>
            <div className="quota-filter-group">
              <label htmlFor="start-date">Data inicial</label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="quota-filter-group">
              <label htmlFor="end-date">Data final</label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <button type="button" className="quota-apply-button" onClick={fetchOverview} disabled={loading}>
              Aplicar período
            </button>
          </>
        )}
      </section>

      <section className="quota-table-panel">
        <h2>Eventos da API</h2>
        <div className="quota-table-wrap">
          <table className="quota-table">
            <thead>
              <tr>
                <th>Data/hora</th>
                <th>Canal</th>
                <th>Ação</th>
                <th>Método/API</th>
                <th>Custo estimado</th>
                <th>Status</th>
                <th>Mensagem curta</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{formatDateTime(event.timestamp)}</td>
                  <td>{event.channel_name || '-'}</td>
                  <td>{event.action || '-'}</td>
                  <td>{event.method || '-'}</td>
                  <td>{event.estimated_cost ?? 0}</td>
                  <td>
                    <span className={`quota-status ${statusClass(event.status)}`}>
                      {statusLabel(event.status)}
                    </span>
                  </td>
                  <td>{event.message || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="quota-summary-panel">
        <h2>Resumo por canal</h2>
        <div className="quota-table-wrap">
          <table className="quota-table">
            <thead>
              <tr>
                <th>Canal</th>
                <th>Uploads no período</th>
                <th>Cota estimada usada</th>
                <th>Sucessos</th>
                <th>Falhas</th>
                <th>Última publicação</th>
                <th>Status da conexão</th>
              </tr>
            </thead>
            <tbody>
              {channelSummary.length === 0 ? (
                <tr>
                  <td colSpan={7}>Sem dados para o período selecionado.</td>
                </tr>
              ) : (
                channelSummary.map((row) => (
                  <tr key={row.channel_id}>
                    <td>{row.channel_name || '-'}</td>
                    <td>{row.uploads || 0}</td>
                    <td>{row.estimated_quota || 0}</td>
                    <td>{row.successes || 0}</td>
                    <td>{row.failures || 0}</td>
                    <td>{formatDateTime(row.last_publication)}</td>
                    <td>{row.connection_status || 'Desconhecido'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="quota-compliance-note">
          {data?.compliance_note || 'Sistema usa projeto Google Cloud/OAuth Client único e rastreia consumo estimado por canal internamente.'}
        </p>
      </section>
    </div>
  );
}

export default QuotaMonitor;
