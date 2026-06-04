import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, CalendarClock, Network, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../../config/api';
import './Pages.css';
import './Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const checklistKey = 'alliance_dark_meta_checklist';
  const checklistItems = useMemo(() => ([
    { id: 'meta_app', label: 'Criar app Meta', detail: 'Abrir o app no Meta for Developers e deixar em modo correto.' },
    { id: 'facebook_login', label: 'Ativar Facebook Login', detail: 'Habilitar login para gerar token e callback.' },
    { id: 'instagram_graph', label: 'Ativar Instagram Graph API', detail: 'Usar para publicar e ler dados do Instagram profissional.' },
    { id: 'valid_redirect', label: 'Cadastrar redirect URI', detail: 'Salvar o callback do painel sem divergencia.' },
    { id: 'connect_page', label: 'Conectar pagina ao Instagram', detail: 'Vincular a conta profissional a uma pagina Facebook.' },
    { id: 'pixel_id', label: 'Preencher Pixel ID', detail: 'Registrar o Pixel para rastreio futuro.' },
    { id: 'ad_account_id', label: 'Preencher Ad Account ID', detail: 'Guardar a conta de anuncios usada pelo projeto.' },
    { id: 'app_review', label: 'Revisar permissões', detail: 'Separar o que precisa de App Review e o que já pode testar.' },
  ]), []);
  const [checklistState, setChecklistState] = useState({});

  useEffect(() => {
    fetch(apiUrl('/api/dashboard/stats'))
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(checklistKey);
      if (raw) {
        setChecklistState(JSON.parse(raw));
      }
    } catch (error) {
      setChecklistState({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(checklistKey, JSON.stringify(checklistState));
  }, [checklistState]);

  const completedCount = checklistItems.filter((item) => checklistState[item.id]).length;
  const checklistProgress = Math.round((completedCount / checklistItems.length) * 100);

  const toggleChecklistItem = (itemId) => {
    setChecklistState((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }));
  };

  const statCards = [
    {
      label: 'Conexões Ativas',
      value: stats?.total_conexoes || 0,
      icon: Network,
      tone: 'green',
    },
    {
      label: 'Alliance Intels',
      value: stats?.total_intels || 0,
      icon: TrendingUp,
      tone: 'gold',
    },
    {
      label: 'Projetos Ativos',
      value: stats?.total_projetos || 0,
      icon: BarChart3,
      tone: 'blue',
    },
  ];

  const shortcuts = [
    { label: 'Conexões', path: '/conexoes', icon: Zap, tone: 'blue' },
    { label: 'Forge', path: '/forge', icon: Sparkles, tone: 'red' },
    { label: 'Agenda', path: '/agenda', icon: CalendarClock, tone: 'green' },
  ];

  return (
    <div className="page-container dashboard-page">
      {loading ? (
        <div className="loading-spinner">Carregando...</div>
      ) : (
        <>
          <section className="dashboard-hero">
            <div className="dashboard-hero-content">
              <div className="dashboard-kicker">
                <ShieldCheck size={15} />
                <span>Dashboard editorial interno</span>
              </div>

              <div>
                <h1>Painel de Controle</h1>
                <p>
                  Operação, canais, fila e publicação em uma visão limpa para trabalhar rápido sem perder controle.
                </p>
              </div>

              <div className="dashboard-hero-actions">
                {shortcuts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link className={`dashboard-shortcut ${item.tone}`} to={item.path} key={item.path}>
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

          </section>

          <div className="dashboard-stats-grid">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div className={`dashboard-stat-card ${card.tone}`} key={card.label}>
                  <div className="dashboard-stat-icon">
                    <Icon size={23} />
                  </div>
                  <div className="dashboard-stat-content">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </div>
                </div>
              );
            })}
          </div>

          <section className="dashboard-operations">
            <div className="dashboard-operations-header">
              <div>
                <h2>Atividade operacional</h2>
                <p>Status recente do painel e atalhos de produção.</p>
              </div>
              <span>Online</span>
            </div>

            <div className="dashboard-activity-row">
              <div className="dashboard-activity-item active">
                <div className="dashboard-activity-pulse"></div>
                <div>
                  <strong>Sistema Inicializado</strong>
                  <span>Agora mesmo</span>
                </div>
              </div>

              <div className="dashboard-mini-panel">
                <span>Fluxo editorial</span>
                <div className="dashboard-flow-bars">
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-checklist">
            <div className="dashboard-operations-header">
              <div>
                <h2>Checklist Meta</h2>
                <p>Use este bloco para marcar a estrutura do Instagram e Facebook sem perder a ordem.</p>
              </div>
              <span>{completedCount}/{checklistItems.length} pronto</span>
            </div>

            <div className="dashboard-checklist-progress">
              <div className="dashboard-checklist-track">
                <div
                  className="dashboard-checklist-fill"
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>
              <strong>{checklistProgress}%</strong>
            </div>

            <div className="dashboard-checklist-grid">
              {checklistItems.map((item, index) => {
                const checked = Boolean(checklistState[item.id]);
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`dashboard-checklist-item ${checked ? 'checked' : ''}`}
                    onClick={() => toggleChecklistItem(item.id)}
                  >
                    <span className="dashboard-checklist-box">
                      <span className="dashboard-checklist-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </span>
                    <div className="dashboard-checklist-copy">
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <span className="dashboard-checklist-state">
                      {checked ? 'Marcado' : 'Pendente'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Dashboard;
