import React from 'react';
import { Navigate, Route, Routes, Link } from 'react-router-dom';

const showLocalLogin = String(import.meta.env.VITE_SHOW_LOCAL_LOGIN ?? 'false').toLowerCase() === 'true';
const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || '';

function PageShell({ title, children }) {
  return (
    <main className="page-shell">
      <div className="brand-row">
        <div className="brand-mark">HF</div>
        <div>
          <div className="brand-name">HF New Control Hub</div>
          <div className="brand-sub">Dashboard interno para publicação autorizada no YouTube</div>
        </div>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h1>{title}</h1>
        </div>
        {children}
      </section>
    </main>
  );
}

function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-badge">HF</div>
          <div>
            <h1>HF New Control Hub</h1>
            <p>Dashboard interno para publicação autorizada no YouTube</p>
          </div>
        </div>

        <div className="login-copy">
          <h2>Acessar</h2>
          <p>Entre com uma conta Google autorizada para acessar o painel interno.</p>
        </div>

        <div className="info-grid">
          <article className="info-card">
            <span className="info-label">Conta autorizada</span>
            <p>Somente e-mails previamente autorizados podem acessar este sistema.</p>
          </article>
          <article className="info-card">
            <span className="info-label">Autenticação</span>
            <p>Login seguro via Google OAuth 2.0.</p>
          </article>
        </div>

        <div className="status-card">
          <span className="status-dot" />
          <p>Status: aguardando autenticação Google.</p>
        </div>

        <div className="actions">
          <button className="primary-btn" type="button">Entrar com Google</button>
          {showLocalLogin ? (
            <button className="secondary-btn" type="button">Uso interno autorizado</button>
          ) : null}
        </div>

        <p className="supporting-copy">
          Acesso restrito a usuários autorizados pelo administrador do sistema.
        </p>

        <div className="usage-card">
          <div className="usage-icon">★</div>
          <div>
            <strong>Uso interno autorizado</strong>
            <p>Este dashboard é privado e usado apenas para gerenciar publicações próprias ou autorizadas em canais conectados do YouTube.</p>
          </div>
        </div>

        {supportEmail ? <p className="support-email">Suporte: {supportEmail}</p> : null}

        <footer className="footer-links">
          <Link to="/sobre-dashboard">Sobre o dashboard</Link>
          <span>|</span>
          <Link to="/politica-de-privacidade">Política de privacidade</Link>
          <span>|</span>
          <Link to="/termos-de-uso">Termos de serviço</Link>
          <span>|</span>
          <Link to="/revogar-acesso">Revogar acesso</Link>
        </footer>
      </section>
    </main>
  );
}

function InfoPage({ title, children }) {
  return (
    <PageShell title={title}>
      <div className="copy-block">{children}</div>
      <div className="page-links">
        <Link to="/">Voltar à entrada</Link>
      </div>
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
