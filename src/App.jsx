import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Pages/Dashboard';
import Conexoes from './components/Pages/Conexoes';
import Intel from './components/Pages/Intel';
import BulkDownload from './modules/bulk-download/pages/BulkDownload';
import Forge from './components/Pages/Forge';
import TheForge5050 from './modules/the-forge-50-50/pages/TheForge5050';
import ForgeEasyEditor from './modules/forge-easy-editor/pages/ForgeEasyEditor';
import ForgeMaxExtractor from './modules/forge-max/pages/ForgeMaxExtractor';
import Vault from './components/Pages/Vault';
import Schedule from './components/Pages/Schedule';
import QuotaMonitor from './components/Pages/QuotaMonitor';
import Agents from './components/Pages/Agents';
import Leads from './components/Pages/Leads';
import WhatsAppHub from './modules/whatsapp/pages/WhatsAppHub';
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
const RECENT_AUTH_KEY = 'alliance_dark_recent_auth_at';
const PUBLIC_ROUTES = ['/sobre-dashboard', '/politica-de-privacidade', '/termos-de-uso', '/revogar-acesso', '/acesso-negado'];
const AUTH_BYPASS_ROUTES = ['/callback'];
const MOBILE_BREAKPOINT = 1024;
const RECENT_AUTH_WINDOW_MS = 30000;
const AUTH_STATUS_RETRY_LIMIT = 2;
const AUTH_STATUS_RETRY_DELAY_MS = 1200;

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
  const [authAttempt, setAuthAttempt] = useState(0);
  const [authStatus, setAuthStatus] = useState({
    checked: false,
    loading: false,
    allowed: false,
    message: '',
    email: '',
    name: '',
    role: 'owner',
    scope: ''
  });
  const authRequestStarted = useRef(false);
  const authRetryCount = useRef(0);
  const authRetryTimeout = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);
  const isAuthBypassRoute = AUTH_BYPASS_ROUTES.includes(location.pathname);
  const pendingOAuthCallbackUrl = typeof window !== 'undefined'
    ? window.sessionStorage.getItem(OAUTH_CALLBACK_URL_KEY) || ''
    : '';
  const hasPendingOAuthCallback = Boolean(pendingOAuthCallbackUrl);
  const requiresAuth = !isPublicRoute && !isAuthBypassRoute && !hasPendingOAuthCallback;

  useEffect(() => () => {
    if (authRetryTimeout.current) {
      window.clearTimeout(authRetryTimeout.current);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const requestUrl = typeof input === 'string' ? input : input?.url || '';
      const isApiRequest = requestUrl.includes('/api/');
      const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
      if (!isApiRequest || !token) {
        return nativeFetch(input, init);
      }

      const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return nativeFetch(input, { ...init, headers });
    };
    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    window.scrollTo(0, 0);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, left: 0 });
    }
  }, [location.pathname]);

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
          name: '',
          role: 'owner',
          scope: ''
        });
        return;
      }

      setAuthStatus((prev) => ({ ...prev, loading: true }));

      try {
        const scheduleAuthRetry = () => {
          if (authRetryCount.current >= AUTH_STATUS_RETRY_LIMIT) {
            return false;
          }

          authRetryCount.current += 1;
          authRequestStarted.current = false;
          if (authRetryTimeout.current) {
            window.clearTimeout(authRetryTimeout.current);
          }
          setAuthStatus({
            checked: false,
            loading: true,
            allowed: false,
            message: 'Finalizando validacao do login...',
            email: '',
            name: '',
            role: 'owner',
            scope: ''
          });
          authRetryTimeout.current = window.setTimeout(() => {
            setAuthAttempt((current) => current + 1);
          }, AUTH_STATUS_RETRY_DELAY_MS);
          return true;
        };

        const isHardAuthFailure = (value) => {
          const normalized = String(value || '').toLowerCase();
          return (
            normalized.includes('usuario nao autorizado')
            || normalized.includes('usuário não autorizado')
            || normalized.includes('sessao invalida')
            || normalized.includes('sessão inválida')
            || normalized.includes('expirada')
          );
        };

        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 5000);
        const response = await fetch(apiUrl('/api/auth/status'), { headers, signal: controller.signal });
        window.clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`auth_status_http_${response.status}`);
        }
        const data = await response.json();
        const recentAuthAt = Number(window.localStorage.getItem(RECENT_AUTH_KEY) || '0');
        const hasRecentAuth = recentAuthAt > 0 && (Date.now() - recentAuthAt) <= RECENT_AUTH_WINDOW_MS;
        const hardFailure = isHardAuthFailure(data.message);

        if (data.authorized) {
          authRetryCount.current = 0;
          window.localStorage.removeItem(RECENT_AUTH_KEY);
        } else if (authToken && hasRecentAuth && !hardFailure && scheduleAuthRetry()) {
          return;
        } else if (!data.authorized && authToken && hardFailure) {
          window.localStorage.removeItem(AUTH_TOKEN_KEY);
          window.localStorage.removeItem(RECENT_AUTH_KEY);
        }

        setAuthStatus({
          checked: true,
          loading: false,
          allowed: Boolean(data.authorized),
          message: data.message || '',
          email: data.email || '',
          name: data.name || '',
          role: data.role || 'owner',
          scope: data.scope || ''
        });
      } catch (error) {
        const recentAuthAt = Number(window.localStorage.getItem(RECENT_AUTH_KEY) || '0');
        const hasRecentAuth = recentAuthAt > 0 && (Date.now() - recentAuthAt) <= RECENT_AUTH_WINDOW_MS;

        if (authToken && hasRecentAuth && authRetryCount.current < AUTH_STATUS_RETRY_LIMIT) {
          authRetryCount.current += 1;
          authRequestStarted.current = false;
          if (authRetryTimeout.current) {
            window.clearTimeout(authRetryTimeout.current);
          }
          setAuthStatus({
            checked: false,
            loading: true,
            allowed: false,
            message: 'Finalizando validacao do login...',
            email: '',
            name: '',
            role: 'owner',
            scope: ''
          });
          authRetryTimeout.current = window.setTimeout(() => {
            setAuthAttempt((current) => current + 1);
          }, AUTH_STATUS_RETRY_DELAY_MS);
          return;
        }

        if (authToken) {
          setAuthStatus({
            checked: true,
            loading: false,
            allowed: true,
            message: error?.name === 'AbortError'
              ? 'Sessao local mantida. API demorou para responder.'
              : 'Sessao local mantida. Validacao remota indisponivel.',
            email: '',
            name: '',
            role: 'owner',
            scope: ''
          });
          return;
        }

        setAuthStatus({
          checked: true,
          loading: false,
          allowed: false,
          message: error?.name === 'AbortError'
            ? 'Tempo limite ao validar a sessao do dashboard'
            : 'Falha ao verificar acesso',
            email: '',
            name: '',
            role: 'owner',
            scope: ''
        });
      }
    }

    verifyAccess();
  }, [requiresAuth, authStatus.checked, authAttempt]);

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
    window.localStorage.removeItem(RECENT_AUTH_KEY);
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
            name: authStatus.name,
            role: authStatus.role,
            scope: authStatus.scope
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
          <Route path="/conexoes" element={<Conexoes currentUser={authStatus} />} />
          <Route path="/intel" element={<Intel />} />
          <Route path="/baixar-em-massa" element={<BulkDownload />} />
          <Route path="/forge" element={<Forge />} />
          <Route path="/the-forge" element={<TheForge5050 />} />
          <Route path="/the-forge-50-50" element={<TheForge5050 />} />
          <Route path="/the-forge/editor" element={<ForgeEasyEditor />} />
          <Route path="/forge-max" element={<ForgeMaxExtractor />} />
          <Route path="/agenda" element={<Schedule />} />
          <Route path="/monitoramento-cota" element={<QuotaMonitor />} />
          <Route path="/agentes" element={<Agents />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/whatsapp" element={<WhatsAppHub />} />
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
