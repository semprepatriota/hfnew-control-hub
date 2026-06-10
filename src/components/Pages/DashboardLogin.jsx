import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { apiUrl } from '../../config/api';
import './DashboardLogin.css';

const PENDING_AUTH_FLOW_KEY = 'alliance_dark_pending_auth_flow';
const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';
const RECENT_AUTH_KEY = 'alliance_dark_recent_auth_at';
const OAUTH_ERROR_KEY = 'alliance_dark_oauth_error';
const OAUTH_CALLBACK_URL_KEY = 'alliance_dark_oauth_callback_url';

function DashboardLogin({ message = '' }) {
  const isLocalDev = typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const showLocalLogin = isLocalDev && String(import.meta.env.VITE_SHOW_LOCAL_LOGIN ?? 'false').toLowerCase() === 'true';
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'contato@hfnew.com.br';
  const [localLoginError, setLocalLoginError] = useState('');

  const handleGoogleLogin = (event) => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(RECENT_AUTH_KEY);
    window.localStorage.removeItem(OAUTH_ERROR_KEY);
    window.sessionStorage.removeItem(OAUTH_CALLBACK_URL_KEY);
    window.localStorage.setItem(PENDING_AUTH_FLOW_KEY, 'dashboard');
    if (event?.currentTarget?.getAttribute('href')) {
      return;
    }
    window.location.href = apiUrl('/api/auth/google/login');
  };

  const handleLocalLogin = async () => {
    setLocalLoginError('');
    try {
      const response = await fetch(apiUrl('/api/auth/local/login'), {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || 'Falha ao abrir login local');
      }

      window.localStorage.setItem(AUTH_TOKEN_KEY, data.auth_token);
      window.localStorage.setItem(RECENT_AUTH_KEY, String(Date.now()));
      window.localStorage.removeItem(PENDING_AUTH_FLOW_KEY);
      window.location.href = '/painel';
    } catch (error) {
      setLocalLoginError(error?.message || 'Nao foi possivel falar com o backend local');
    }
  };

  const normalizedMessage = String(localLoginError || message || '').toLowerCase();
  const statusText = (() => {
    if (localLoginError) {
      return `Status: ${localLoginError}`;
    }

    if (!message || normalizedMessage.includes('autenticacao ausente') || normalizedMessage.includes('sessao encerrada')) {
      return 'Status: aguardando autenticação Google.';
    }

    if (normalizedMessage.includes('nao autorizado') || normalizedMessage.includes('não autorizado') || normalizedMessage.includes('negad')) {
      return 'Status: acesso negado — conta não autorizada.';
    }

    if (normalizedMessage.includes('autorizad') || normalizedMessage.includes('validado') || normalizedMessage.includes('allowed')) {
      return 'Status: acesso autorizado.';
    }

    return message.startsWith('Status:') ? message : `Status: ${message}`;
  })();

  return (
    <main className="dashboard-login-page">
      <div className="dashboard-login-shell">
        <div className="dashboard-login-brand">
          <div className="dashboard-login-mark">
            <ShieldCheck size={28} />
          </div>
          <strong>HF New Control Hub</strong>
          <span>Dashboard interno para publicação autorizada no YouTube</span>
        </div>

        <section className="dashboard-login-card" aria-label="Login do dashboard">
          <div className="dashboard-login-copy">
            <h1>Acessar</h1>
            <p>Entre com uma conta Google autorizada para acessar o painel interno.</p>
          </div>

          <div className="dashboard-login-field">
            <span>Conta autorizada</span>
            <strong>Somente e-mails previamente autorizados podem acessar este sistema.</strong>
          </div>

          <div className="dashboard-login-field">
            <span>Autenticação</span>
            <strong>Login seguro via Google OAuth 2.0.</strong>
          </div>

          <div className="dashboard-login-status">
            <ShieldCheck size={24} />
            <div>
              <strong>{statusText}</strong>
              <span>Google OAuth 2.0</span>
            </div>
          </div>

          <a
            className="dashboard-login-button"
            href={apiUrl('/api/auth/google/login')}
            onClick={handleGoogleLogin}
          >
            <ArrowRight size={17} />
            Entrar com Google
          </a>

          {showLocalLogin && (
            <button type="button" className="dashboard-login-local" onClick={handleLocalLogin}>
              Entrar localmente
            </button>
          )}

          <div className="dashboard-login-note">
            Acesso restrito a usuários autorizados pelo administrador do sistema.
          </div>

          <div className="dashboard-login-links" aria-label="Links publicos obrigatorios">
            <Link to="/sobre-dashboard">Sobre o dashboard</Link>
            <Link to="/politica-de-privacidade">Política de privacidade</Link>
            <Link to="/termos-de-uso">Termos de serviço</Link>
            <Link to="/revogar-acesso">Revogar acesso</Link>
          </div>

          {supportEmail ? (
            <a className="dashboard-login-support" href={`mailto:${supportEmail}`}>
              Suporte: {supportEmail}
            </a>
          ) : null}
        </section>

        {showLocalLogin ? (
          <button
            type="button"
            className="dashboard-login-limited dashboard-login-limited--button"
            onClick={handleLocalLogin}
            aria-label="Uso interno autorizado"
            title="Uso interno autorizado"
          >
            <span>
              <Sparkles size={17} />
            </span>
            <div>
              <strong>Uso interno autorizado</strong>
              <small>Este dashboard é privado e usado apenas para gerenciar publicações próprias ou autorizadas em canais conectados do YouTube.</small>
            </div>
            <ArrowRight size={17} />
          </button>
        ) : (
          <a className="dashboard-login-limited" href="/acesso-negado">
            <span>
              <Sparkles size={17} />
            </span>
            <div>
              <strong>Uso interno autorizado</strong>
              <small>Este dashboard é privado e usado apenas para gerenciar publicações próprias ou autorizadas em canais conectados do YouTube.</small>
            </div>
            <ArrowRight size={17} />
          </a>
        )}
      </div>
    </main>
  );
}

export default DashboardLogin;
