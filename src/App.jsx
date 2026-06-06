import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Pages/Dashboard';
import Conexoes from './components/Pages/Conexoes';
import Intel from './components/Pages/Intel';
import Forge from './components/Pages/Forge';
import Vault from './components/Pages/Vault';
import Schedule from './components/Pages/Schedule';
import QuotaMonitor from './components/Pages/QuotaMonitor';
import Agents from './components/Pages/Agents';
import Leads from './components/Pages/Leads';
import OAuthCallback from './components/Pages/OAuthCallback';
import InstagramPublisher from './components/Pages/InstagramPublisher';
import FacebookPublisher from './components/Pages/FacebookPublisher';
import PublicDashboard from './components/Pages/PublicDashboard';
import PublicPrivacy from './components/Pages/PublicPrivacy';
import PublicTerms from './components/Pages/PublicTerms';
import PublicRevokeAccess from './components/Pages/PublicRevokeAccess';
import AccessDenied from './components/Pages/AccessDenied';
import DashboardLogin from './components/Pages/DashboardLogin';
import { apiUrl } from './config/api';
import './App.css';

const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';
const OAUTH_CALLBACK_URL_KEY = 'alliance_dark_oauth_callback_url';
const PUBLIC_ROUTES = ['/sobre-dashboard', '/politica-de-privacidade', '/termos-de-uso', '/revogar-acesso', '/acesso-negado'];
const AUTH_BYPASS_ROUTES = ['/callback'];
const MOBILE_BREAKPOINT = 1024;

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.innerWidth > MOBILE_BREAKPOINT;
  });
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });
  const [apiStatus, setApiStatus] = useState(null);
  const [authStatus, setAuthStatus] = useState({
    checked: false,
    loading: false,
    allowed: false,
    message: '',
    email: '',
    name: ''
  });
  const authRequestStarted = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);
  const isAuthBypassRoute = AUTH_BYPASS_ROUTES.includes(location.pathname);
  const pendingOAuthCallbackUrl = typeof window !== 'undefined'
    ? window.sessionStorage.getItem(OAUTH_CALLBACK_URL_KEY) || ''
    : '';
  const hasPendingOAuthCallback = Boolean(pendingOAuthCallbackUrl);
  const requiresAuth = !isPublicRoute && !isAuthBypassRoute && !hasPendingOAuthCallback;

  useEffect(() => {
    const syncViewport = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobileViewport(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport || isPublicRoute) {
      return;
    }
    setSidebarOpen(false);
  }, [isMobileViewport, isPublicRoute, location.pathname]);

  useEffect(() => {
    if (!pendingOAuthCallbackUrl || location.pathname === '/callback') {
      return;
    }

    try {
      const pendingUrl = new URL(pendingOAuthCallbackUrl);
      const callbackPath = `${pendingUrl.pathname}${pendingUrl.search}${pendingUrl.hash}`;
      navigate(callbackPath, { replace: true });
    } catch (error) {
      window.sessionStorage.removeItem(OAUTH_CALLBACK_URL_KEY);
    }
  }, [location.pathname, navigate, pendingOAuthCallbackUrl]);

  useEffect(() => {
    // Verificar status da API
    fetch(apiUrl('/api/status'))
      .then(res => res.json())
      .then(data => setApiStatus(data))
      .catch(err => console.log('API offline'));
  }, []);

  useEffect(() => {
    async function verifyAccess() {
      if (!requiresAuth || authStatus.checked || authRequestStarted.current) {
        return;
      }

      authRequestStarted.current = true;
      const authToken = window.localStorage.getItem(AUTH_TOKEN_KEY);

      if (!authToken) {
        setAuthStatus({
          checked: true,
          loading: false,
          allowed: false,
          message: 'Autenticacao ausente',
          email: '',
          name: ''
        });
        return;
      }

      setAuthStatus((prev) => ({ ...prev, loading: true }));

      try {
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 5000);
        const response = await fetch(apiUrl('/api/auth/status'), { headers, signal: controller.signal });
        window.clearTimeout(timeoutId);
        const data = await response.json();

        if (!data.authorized && authToken) {
          window.localStorage.removeItem(AUTH_TOKEN_KEY);
        }

        setAuthStatus({
          checked: true,
          loading: false,
          allowed: Boolean(data.authorized),
          message: data.message || '',
          email: data.email || '',
          name: data.name || ''
        });
      } catch (error) {
        setAuthStatus({
          checked: true,
          loading: false,
          allowed: false,
          message: error?.name === 'AbortError'
            ? 'Tempo limite ao validar a sessao do dashboard'
            : 'Falha ao verificar acesso',
          email: '',
          name: ''
        });
      }
    }

    verifyAccess();
  }, [requiresAuth, authStatus.checked]);

  if (requiresAuth && (authStatus.loading || !authStatus.checked)) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-card">
          <p>Verificando acesso...</p>
          <span>Validando sessao do dashboard</span>
        </div>
      </div>
    );
  }

  if (requiresAuth && authStatus.checked && !authStatus.allowed) {
    return <DashboardLogin message={authStatus.message} />;
  }

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem('alliance_dark_pending_auth_flow');
    authRequestStarted.current = false;
    setAuthStatus({
      checked: true,
      loading: false,
      allowed: false,
      message: 'Sessao encerrada',
      email: '',
      name: ''
    });
    navigate('/painel', { replace: true });
  };

  return (
    <div className="alliance-dark-app">
      {!isPublicRoute && (
        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          onLogout={handleLogout}
          currentUser={{
            email: authStatus.email,
            name: authStatus.name
          }}
        />
      )}

      {!isPublicRoute && isMobileViewport && !sidebarOpen && (
        <button
          type="button"
          className="mobile-menu-trigger"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
      )}

      <main className={`main-content ${isPublicRoute ? 'public-page' : (sidebarOpen ? 'sidebar-open' : 'sidebar-closed')}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/painel" element={<Dashboard />} />
          <Route path="/conexoes" element={<Conexoes />} />
          <Route path="/intel" element={<Intel />} />
          <Route path="/forge" element={<Forge />} />
          <Route path="/agenda" element={<Schedule />} />
          <Route path="/monitoramento-cota" element={<QuotaMonitor />} />
          <Route path="/agentes" element={<Agents />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/instagram" element={<InstagramPublisher />} />
          <Route path="/facebook" element={<FacebookPublisher />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/callback" element={<OAuthCallback />} />
          <Route path="/sobre-dashboard" element={<PublicDashboard />} />
          <Route path="/politica-de-privacidade" element={<PublicPrivacy />} />
          <Route path="/termos-de-uso" element={<PublicTerms />} />
          <Route path="/revogar-acesso" element={<PublicRevokeAccess />} />
          <Route path="/acesso-negado" element={<AccessDenied />} />
        </Routes>
      </main>

      {!isPublicRoute && apiStatus && (
        <div className="api-status-indicator">
          <span className={`status-dot ${apiStatus.status === 'operational' ? 'online' : 'offline'}`}></span>
          <span className="status-text">{apiStatus.status === 'operational' ? 'Online' : 'Offline'}</span>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
