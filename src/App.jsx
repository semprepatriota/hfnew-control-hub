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

function TermsPage() {
  return (
    <InfoPage title="Termos de uso">
      <div className="terms-content">
        <section>
          <h2>1. Aceitacao e finalidade</h2>
          <p>Ao acessar ou utilizar o HF New Control Hub, o usuario declara que leu, compreendeu e concorda com estes Termos de Uso. O sistema e uma ferramenta privada de operacao interna para gestao de publicacoes proprias ou autorizadas em canais e contas conectadas pelo proprio usuario ou por administrador autorizado.</p>
        </section>

        <section>
          <h2>2. Acesso restrito e conta autorizada</h2>
          <p>O acesso e restrito a usuarios previamente autorizados pelo operador do sistema. O uso por terceiros nao autorizados, por interposta pessoa ou com compartilhamento indevido de acesso e proibido. O operador pode suspender, limitar ou encerrar acessos a qualquer momento, com ou sem aviso previo, para proteger o sistema, cumprir exigencias legais ou preservar integracoes com plataformas de terceiros.</p>
        </section>

        <section>
          <h2>3. Responsabilidade pelo conteudo e pelas credenciais</h2>
          <p>O usuario e integralmente responsavel pelo conteudo enviado, publicado, programado, editado ou aprovado por meio da plataforma, bem como pela legalidade, titularidade, autorizacao de uso, adequacao editorial e conformidade com as regras das plataformas de destino. O usuario tambem responde pela guarda de suas credenciais, pelo uso da conta conectada e por qualquer ato realizado a partir de acessos autorizados em seu nome.</p>
        </section>

        <section>
          <h2>4. Regras de uso e condutas proibidas</h2>
          <p>E vedado utilizar a plataforma para violar lei, direitos autorais, direitos de personalidade, privacidade, termos de terceiros, politicas de API, regras eleitorais, regras de publicidade, direitos de imagem, ou para praticar fraude, spam, desinformacao, assedio, automacao abusiva, monitoramento ilicito ou qualquer uso que possa causar bloqueio, sancao ou dano a terceiros.</p>
        </section>

        <section>
          <h2>5. Plataformas de terceiros e APIs</h2>
          <p>O sistema depende de servicos, APIs, infraestrutura e politicas de terceiros, incluindo Google, YouTube e outros provedores eventualmente conectados. O uso dessas integracoes tambem se sujeita aos termos e politicas desses terceiros. Ao utilizar funcionalidades relacionadas ao YouTube, o usuario concorda em cumprir os <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">Termos de Servico do YouTube</a> e demais politicas aplicaveis.</p>
        </section>

        <section>
          <h2>6. Disponibilidade, falhas e limites operacionais</h2>
          <p>O sistema e fornecido no estado em que se encontra, podendo sofrer indisponibilidades, falhas, bloqueios, perda de sessao, mudancas de API, limites de cota, recusas de autenticacao, restricoes de plataforma, alteracoes de politicas externas, filas interrompidas, falhas de publicacao ou necessidade de reconfiguracao. Nao ha garantia de disponibilidade ininterrupta, sucesso de publicacao, aprovacao por terceiros, manutencao de quota, permanencia de integracoes, preservacao de alcance, monetizacao ou continuidade de funcionalidades externas.</p>
        </section>

        <section>
          <h2>7. Suspensao, remocao e encerramento</h2>
          <p>O operador do sistema pode limitar, remover, suspender ou encerrar acessos, canais conectados, filas, automacoes, dados operacionais ou funcionalidades sempre que houver suspeita de violacao destes Termos, exigencia tecnica, risco de seguranca, determinacao legal, pedido de autoridade competente, exigencia de auditoria ou necessidade de preservacao da integridade do ambiente.</p>
        </section>

        <section>
          <h2>8. Limitacao de responsabilidade</h2>
          <p>Na extensao permitida pela legislacao aplicavel, o operador do sistema nao responde por danos indiretos, lucros cessantes, perda de receita, perda de oportunidade, bloqueios de conta, suspensao de canal, remocao de conteudo, recusa de upload, sancoes de terceiros, queda de alcance, falhas de API, perda de quota, indisponibilidade de servicos externos, erro de configuracao do usuario, uso indevido por usuario autorizado, ou por decisoes tomadas por plataformas terceiras com base em suas proprias regras.</p>
        </section>

        <section>
          <h2>9. Indenizacao</h2>
          <p>O usuario concorda em defender, indenizar e isentar o operador do sistema de reclamacoes, perdas, custos, danos, despesas e responsabilidades decorrentes de: conteudo enviado pelo usuario; violacao destes Termos; violacao de direitos de terceiros; uso indevido de integracoes; uso nao autorizado de marcas, imagens, musicas, videos ou dados; ou descumprimento das regras de plataformas conectadas.</p>
        </section>

        <section>
          <h2>10. Privacidade, auditoria e revogacao</h2>
          <p>O tratamento de dados relacionados ao uso da plataforma observa a politica de privacidade publicada. O sistema pode manter registros tecnicos e operacionais estritamente necessarios para seguranca, auditoria, rastreabilidade e cumprimento de obrigacoes. O usuario pode revogar acessos concedidos seguindo as instrucoes da pagina <Link to="/revogar-acesso">Revogar acesso</Link>.</p>
        </section>

        <section>
          <h2>11. Alteracoes destes Termos</h2>
          <p>Estes Termos podem ser alterados para refletir mudancas legais, tecnicas, operacionais, contratuais ou de integracoes com terceiros. A continuidade do uso apos a atualizacao representa concordancia com a versao vigente.</p>
        </section>

        <section>
          <h2>12. Lei aplicavel e foro</h2>
          <p>Estes Termos serao interpretados conforme a legislacao aplicavel da Republica Federativa do Brasil, sem prejuizo de normas obrigatorias de protecao ao consumidor e de protecao de dados eventualmente incidentes. Sempre que juridicamente valido, as partes elegem o foro do domicilio do operador do sistema para dirimir controversias relacionadas a este instrumento.</p>
        </section>
      </div>
    </InfoPage>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/sobre-dashboard" element={<InfoPage title="Sobre o dashboard"><p>HF New Control Hub é um painel interno para operação autorizada de conteúdo, com acesso restrito e páginas públicas de suporte e conformidade.</p></InfoPage>} />
      <Route path="/politica-de-privacidade" element={<InfoPage title="Política de privacidade"><p>Esta página descreve, em alto nível, como dados de sessão, conexões e operações internas são tratados no sistema. O acesso é restrito e o usuário pode revogar permissões pela Conta Google.</p></InfoPage>} />
      <Route path="/termos-de-uso" element={<TermsPage />} />
      <Route path="/revogar-acesso" element={<RevokeAccessPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
