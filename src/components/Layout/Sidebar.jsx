import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  Brain,
  Hammer,
  Lock,
  CalendarClock,
  Activity,
  Bot,
  Users,
  ChevronRight,
  Facebook,
  Instagram,
  Menu,
  LogOut,
  X
} from 'lucide-react';
import './Sidebar.css';

function Sidebar({ isOpen, setIsOpen, onLogout, currentUser }) {
  const location = useLocation();
  const handleNavigate = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 767) {
      setIsOpen(false);
    }
  };

  const menuItems = [
    {
      id: 1,
      label: 'Painel',
      path: '/painel',
      icon: LayoutDashboard,
      color: 'neon-green'
    },
    {
      id: 2,
      label: 'Conexões',
      path: '/conexoes',
      icon: Zap,
      color: 'neon-blue'
    },
    {
      id: 3,
      label: 'Alliance Intel',
      path: '/intel',
      icon: Brain,
      color: 'neon-gold'
    },
    {
      id: 4,
      label: 'The Forge 70/30',
      path: '/forge',
      icon: Hammer,
      color: 'neon-red'
    },
    {
      id: 5,
      label: 'Agenda',
      path: '/agenda',
      icon: CalendarClock,
      color: 'neon-blue'
    },
    {
      id: 6,
      label: 'Monitoramento de Cota',
      path: '/monitoramento-cota',
      icon: Activity,
      color: 'neon-blue'
    },
    {
      id: 7,
      label: 'Agentes',
      path: '/agentes',
      icon: Bot,
      color: 'neon-green'
    },
    {
      id: 8,
      label: 'Leads',
      path: '/leads',
      icon: Users,
      color: 'neon-gold'
    },
    {
      id: 9,
      label: 'Instagram',
      path: '/instagram',
      icon: Instagram,
      color: 'neon-red'
    },
    {
      id: 10,
      label: 'Facebook',
      path: '/facebook',
      icon: Facebook,
      color: 'neon-blue'
    },
    {
      id: 11,
      label: 'The Vault',
      path: '/vault',
      icon: Lock,
      color: 'neon-green'
    }
  ];

  const isActive = (path) => location.pathname === path;

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
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.id}
                to={item.path}
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
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {isOpen && (currentUser?.email || currentUser?.name) && (
            <div className="sidebar-user">
              <span className="sidebar-user-name">{currentUser.name || 'Usuario autorizado'}</span>
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
