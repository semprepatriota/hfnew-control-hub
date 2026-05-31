import React from 'react';
import { Navigate, Route, Routes, Link } from 'react-router-dom';

const showLocalLogin = String(import.meta.env.VITE_SHOW_LOCAL_LOGIN ?? 'false').toLowerCase() === 'true';
const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || '';

function PageShell({ title, children }) {
  return (
    <main className="dashboard-login-page">
      <div className="dashboard-login-shell">
        <div className="dashboard-login-brand">
          <div className="dashboard-login-mark">HF</div>
          <strong>HF New Control Hub</strong>
          <span>Dashboard interno para publicação autorizada no YouTube</span>
        </div>

        <section className="dashboard-login-card page-panel">
          <div className="dashboard-login-copy">
            <h1>{title}</h1>
          </div>
          <div className="copy-block">{children}</div>
          <div className="page-links">
            <Link to="/">Voltar à entrada</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function LoginPage() {
  return (
    <main className="dashboard-login-page">
      <div className="dashboard-login-shell">
        <div className="dashboard-login-brand">
          <div className="dashboard-login-mark">HF</div>
          <strong>HF New Control Hub</strong>
          <span>Dashboard interno para publicação autorizada no YouTube</span>
        </div>

        <section className="dashboard-login-card">
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
            <div className="dashboard-login-status-mark">OK</div>
            <div>
              <strong>Status: aguardando autenticação Google.</strong>
              <span>Google OAuth 2.0</span>
            </div>
          </div>

          <button className="dashboard-login-button" type="button">Entrar com Google</button>

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

        <div className="dashboard-login-limited">
          <span>★</span>
          <div>
            <strong>Uso interno autorizado</strong>
            <small>Este dashboard é privado e usado apenas para gerenciar publicações próprias ou autorizadas em canais conectados do YouTube.</small>
          </div>
          <b>{showLocalLogin ? '>' : '>'}</b>
        </div>
      </div>
    </main>
  );
}

function InfoPage({ title, children }) {
  return (
    <PageShell title={title}>
      {children}
    </PageShell>
  );
}

function RevokeAccessPage() {
  return (
    <InfoPage title="Revogar acesso">
      <p>Para revogar o acesso, remova a permissão desta aplicação na sua Conta Google, desconecte o canal no painel se essa opção estiver disponível, ou solicite a remoção pelo suporte.</p>
      <ul>
        <li>Conta Google: página de permissões da conta</li>
        <li>Painel interno: desconectar canal vinculado</li>
        <li>Suporte: solicitar remoção do acesso</li>
      </ul>
    </InfoPage>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/sobre-dashboard" element={<InfoPage title="Sobre o dashboard"><p>HF New Control Hub é um painel interno para operação autorizada de conteúdo, com acesso restrito e páginas públicas de suporte e conformidade.</p></InfoPage>} />
      <Route path="/politica-de-privacidade" element={<InfoPage title="Política de privacidade"><p>Esta página descreve, em alto nível, como dados de sessão, conexões e operações internas são tratados no sistema. O acesso é restrito e o usuário pode revogar permissões pela Conta Google.</p></InfoPage>} />
      <Route path="/termos-de-uso" element={<InfoPage title="Termos de uso"><p>O uso deste painel é restrito a usuários autorizados. O conteúdo publicado deve ser próprio ou autorizado, e o acesso pode ser revogado pelo administrador do sistema.</p></InfoPage>} />
      <Route path="/revogar-acesso" element={<RevokeAccessPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
