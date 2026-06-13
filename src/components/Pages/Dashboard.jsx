import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  CalendarClock,
  Network,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
  Youtube,
  Instagram,
  Facebook,
  MessageCircle,
  Brain,
  Bot,
  KeyRound,
  Mic,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../../config/api';
import './Pages.css';
import './Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const apiPanels = [
    { label: 'YouTube Data API', detail: 'Upload, agendamento, status do vídeo e leitura operacional do canal conectado.', icon: Youtube, tone: 'red' },
    { label: 'Google OAuth', detail: 'Autenticação segura dos usuários e autorização dos canais usados no painel.', icon: KeyRound, tone: 'blue' },
    { label: 'Instagram Graph', detail: 'Publicação, leitura de perfil profissional e integração com ativos da Meta.', icon: Instagram, tone: 'pink' },
    { label: 'Facebook Pages', detail: 'Gerenciamento de páginas, posts e ativos conectados para distribuição social.', icon: Facebook, tone: 'blue' },
    { label: 'WhatsApp Business', detail: 'Webhook, números conectados, automações supervisionadas e atendimento.', icon: MessageCircle, tone: 'green' },
    { label: 'OpenAI / ChatGPT', detail: 'Geração de títulos, descrições, hooks, headlines e apoio editorial.', icon: Brain, tone: 'gold' },
    { label: 'LM Studio', detail: 'Inferência local para roteiro, análise textual e apoio privado sem depender da nuvem.', icon: Bot, tone: 'green' },
    { label: 'Piper / Voz local', detail: 'Síntese local de fala para avatar e narração curta dentro do Forge.', icon: Mic, tone: 'blue' },
  ];

  useEffect(() => {
    fetch(apiUrl('/api/dashboard/stats'))
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => setLoading(false));
  }, []);

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

          <section className="dashboard-checklist dashboard-api-panel">
            <div className="dashboard-operations-header">
              <div>
                <h2>Painel de APIs</h2>
                <p>Visão separada das integrações principais e do papel específico de cada uma dentro do app.</p>
              </div>
              <span>{apiPanels.length} integrações</span>
            </div>

            <div className="dashboard-checklist-grid dashboard-api-grid">
              {apiPanels.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`dashboard-checklist-item dashboard-api-item ${item.tone}`}
                  >
                    <span className="dashboard-checklist-box dashboard-api-icon">
                      <Icon size={18} />
                    </span>
                    <div className="dashboard-checklist-copy">
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <span className="dashboard-checklist-state">
                      Ativa
                    </span>
                  </div>
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
