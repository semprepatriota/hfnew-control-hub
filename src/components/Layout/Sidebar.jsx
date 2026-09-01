import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  Hammer,
  Clapperboard,
  LayoutPanelLeft,
  Lock,
  CalendarClock,
  Activity,
  DownloadCloud,
  Search,
  Bot,
  Users,
  MessageCircle,
  ChevronRight,
  Menu,
  LogOut,
  X
} from 'lucide-react';
import './Sidebar.css';

function Sidebar({ isOpen, setIsOpen, onLogout, currentUser, moduleAccess }) {
  const location = useLocation();
  const handleNavigate = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 767) {
      setIsOpen(false);
    }
  };

  const menuItems = [
    {
      id: 1,
      module: 'dashboard',
      label: 'Painel',
      path: '/painel',
      icon: LayoutDashboard,
      color: 'neon-green'
    },
    {
      id: 2,
      module: 'connections',
      label: 'Conexões',
      path: '/conexoes',
      icon: Zap,
      color: 'neon-blue'
    },
    {
      id: 3,
      module: 'intelligence',
      label: 'Alliance Intel',
      path: '/intel',
      icon: Activity,
      color: 'neon-gold'
    },
    {
      id: 'bulk-download',
      module: 'bulk_download',
      label: 'Baixar em Massa',
      path: '/baixar-em-massa',
      icon: DownloadCloud,
      color: 'neon-blue'
    },
    {
      id: 4,
      module: 'forge_7030',
      label: 'The Forge 70/30',
      path: '/forge',
      icon: Hammer,
      color: 'neon-red'
    },
    {
      id: 5,
      module: 'forge_5050',
      label: 'The Forge 50/50',
      path: '/the-forge',
      icon: Clapperboard,
      color: 'neon-gold'
    },
    {
      id: 6,
      module: 'forge_max',
      label: 'Forge Max 3.0',
      path: '/forge-max',
      icon: LayoutPanelLeft,
      color: 'neon-green'
    },
    {
      id: 'research-studio',
      module: 'research_studio',
      label: 'HF Research Studio',
      path: '/research-studio',
      icon: Search,
      color: 'neon-blue'
    },
    {
      id: 7,
      module: 'schedule',
      label: 'Agenda',
      path: '/agenda',
      icon: CalendarClock,
      color: 'neon-blue'
    },
    {
      id: 8,
      module: 'quota_monitor',
      label: 'Monitoramento de Cota',
      path: '/monitoramento-cota',
      icon: Activity,
      color: 'neon-blue'
    },
    {
      id: 9,
      module: 'agents',
      label: 'Agentes',
      path: '/agentes',
      icon: Bot,
      color: 'neon-green'
    },
    {
      id: 10,
      module: 'leads',
      label: 'Leads',
      path: '/leads',
      icon: Users,
      color: 'neon-gold'
    },
    {
      id: 11,
      module: 'whatsapp',
      label: 'WHATSAPP HUB',
      path: '/whatsapp',
      icon: MessageCircle,
      color: 'neon-green'
    },
    {
      id: 14,
      module: 'vault',
      label: 'The Vault',
      path: '/vault',
      icon: Lock,
      color: 'neon-green'
    }
  ];

  const isActive = (path) => location.pathname === path;
  const visibleMenuItems = menuItems.filter((item) => (
    !moduleAccess || moduleAccess[item.module] === true
  ));

  return (
    <>
      {/* Overlay móvel */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">
              <span className="brand-text">HF</span>
            </div>
            {isOpen && <span className="brand-name">HF New Control Hub</span>}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            const itemProps = item.external
              ? { href: item.path, target: '_blank', rel: 'noopener noreferrer' }
              : { to: item.path };
            const ItemComponent = item.external ? 'a' : Link;

            return (
              <ItemComponent
                key={item.id}
                {...itemProps}
                className={`nav-item ${active ? 'active' : ''} ${item.color}`}
                title={!isOpen ? item.label : ''}
                onClick={handleNavigate}
              >
                <div className="nav-item-icon">
                  <Icon size={20} />
                </div>

                {isOpen && (
                  <>
                    <span className="nav-item-label">{item.label}</span>
                    <ChevronRight
                      size={16}
                      className={`nav-item-arrow ${active ? 'visible' : ''}`}
                    />
                  </>
                )}

                {active && <div className="nav-item-glow"></div>}
                </ItemComponent>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {isOpen && (currentUser?.email || currentUser?.name) && (
            <div className="sidebar-user">
              <span className="sidebar-user-name">{currentUser.name || 'Usuario autorizado'}{currentUser.role === 'guest' ? ' · Convidado' : ''}</span>
              {currentUser.workspaceName && (
                <span className="sidebar-user-workspace">{currentUser.workspaceName}</span>
              )}
              <span className="sidebar-user-email">{currentUser.email}</span>
            </div>
          )}
          <div className="footer-badge">
            <span className="status-indicator"></span>
            {isOpen && <span className="status-label">Ativo</span>}
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={onLogout}
            title={!isOpen ? 'Sair' : ''}
          >
            <LogOut size={16} />
            {isOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
