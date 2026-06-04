import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LogIn, ShieldOff } from 'lucide-react';
import PublicPageShell from './PublicPageShell';
import { apiUrl } from '../../config/api';

const PENDING_AUTH_FLOW_KEY = 'alliance_dark_pending_auth_flow';

function handleGoogleLogin(event) {
  window.localStorage.setItem(PENDING_AUTH_FLOW_KEY, 'dashboard');
  if (event?.currentTarget?.getAttribute('href')) {
    return;
  }
  window.location.href = apiUrl('/api/auth/google/login');
}

function AccessDenied() {
  const isLocalDev = typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const showLocalLogin = isLocalDev && String(import.meta.env.VITE_SHOW_LOCAL_LOGIN ?? 'false').toLowerCase() === 'true';

  const handleLocalLogin = async () => {
    const response = await fetch(apiUrl('/api/auth/local/login'), {
      method: 'POST',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.detail || 'Falha ao abrir login local');
    }

    window.localStorage.setItem('alliance_dark_auth_token', data.auth_token);
    window.localStorage.removeItem(PENDING_AUTH_FLOW_KEY);
    window.location.href = '/painel';
  };

  return (
    <PublicPageShell
      badge="Acesso negado"
      title="Acesso negado"
      lead="O usuario Google conectado nao esta autorizado para usar este dashboard. Apenas emails listados em AUTHORIZED_USERS podem concluir a autenticacao."
      sections={[
        {
          title: 'O que aconteceu',
          body: 'A autenticacao foi recebida, mas o email nao esta na lista permitida ou a sessao expirou.'
        },
        {
          title: 'Como resolver',
          body: 'Use um email autorizado para concluir o login ou peca ao responsavel para incluir seu email em AUTHORIZED_USERS.'
        },
        {
          title: 'Páginas públicas',
          body: 'As paginas institucionais continuam abertas sem login e podem ser consultadas normalmente.'
        }
      ]}
      actions={[
        <a
          key="login"
          className="public-page-shell__button"
          href={apiUrl('/api/auth/google/login')}
          onClick={handleGoogleLogin}
        >
          <LogIn size={16} />
          Entrar com Google
        </a>,
        showLocalLogin ? (
          <button
            key="local"
            type="button"
            className="public-page-shell__button secondary"
            onClick={() => handleLocalLogin().catch(() => {})}
          >
            Entrar localmente
          </button>
        ) : null,
        <Link key="painel" to="/painel" className="public-page-shell__button">
          <ArrowLeft size={16} />
          Voltar ao login
        </Link>,
        <Link key="sobre" to="/sobre-dashboard" className="public-page-shell__button secondary">
          <ShieldOff size={16} />
          Ver paginas publicas
        </Link>
      ]}
      footerTitle="Referencia"
      footerBody="Se o acesso deveria funcionar, revise a variavel AUTHORIZED_USERS e o login usado no Google."
    />
  );
}

export default AccessDenied;
