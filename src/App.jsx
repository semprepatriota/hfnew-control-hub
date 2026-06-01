import React from 'react';
import { Navigate, Route, Routes, Link } from 'react-router-dom';

const showLocalLogin = String(import.meta.env.VITE_SHOW_LOCAL_LOGIN ?? 'false').toLowerCase() === 'true';
const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || 'contato@hfnew.com.br';
const localGoogleLoginUrl = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://127.0.0.1:9000/api/auth/google/login'
  : '';
const googleLoginUrl = import.meta.env.VITE_GOOGLE_LOGIN_URL?.trim() || localGoogleLoginUrl;

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
          <a className="dashboard-login-support" href={`mailto:${supportEmail}`}>
            Suporte: {supportEmail}
          </a>
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

          {googleLoginUrl ? (
            <a className="dashboard-login-button" href={googleLoginUrl}>
              Entrar com Google
            </a>
          ) : (
            <button
              className="dashboard-login-button dashboard-login-button--disabled"
              type="button"
              disabled
              title="Login Google ainda nao configurado neste deploy"
            >
              Entrar com Google
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
  const revokeContact = supportEmail || 'contato@hfnew.com.br';

  return (
    <InfoPage title="Revogar acesso">
      <div className="revoke-content">
        <section>
          <h2>1. Revogacao pela Conta Google</h2>
          <p>O usuario pode revogar a permissao concedida ao aplicativo diretamente na pagina de permissoes da Conta Google. Esse e o caminho principal para interromper o acesso concedido por meio do Google OAuth 2.0.</p>
          <p><a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Abrir pagina de permissoes da Conta Google</a></p>
        </section>

        <section>
          <h2>2. Desconexao operacional no painel</h2>
          <p>Quando essa funcionalidade estiver disponivel no ambiente operacional, o usuario tambem pode solicitar ou executar a desconexao de canais e contas vinculadas dentro do proprio painel. A desconexao operacional nao substitui a revogacao da permissao na Conta Google quando o objetivo for interromper totalmente o acesso do aplicativo.</p>
        </section>

        <section>
          <h2>3. Solicitacao por suporte</h2>
          <p>Se o usuario nao conseguir concluir a revogacao ou a desconexao por conta propria, pode solicitar apoio pelo canal de suporte informado nesta pagina. O pedido pode envolver remocao de acesso, desvinculacao de canal, exclusao de vinculos operacionais ou orientacao para exercicio de direitos relacionados a dados pessoais.</p>
          <p><a href={`mailto:${revokeContact}`}>Contato de suporte: {revokeContact}</a></p>
        </section>

        <section>
          <h2>4. O que acontece depois da revogacao</h2>
          <p>Apos a revogacao na Conta Google, o aplicativo deixa de poder utilizar as credenciais concedidas para novas operacoes autorizadas. Dependendo do estado da sessao, da fila ou de caches operacionais, pode haver necessidade de renovacao manual do estado interno ou limpeza de vinculacoes tecnicas. A revogacao nao obriga a exclusao imediata de registros que precisem ser mantidos por obrigacao legal, seguranca, auditoria, prevencao a fraude ou exercicio regular de direitos, conforme a politica de privacidade e a legislacao aplicavel.</p>
        </section>

        <section>
          <h2>5. Exclusao de dados e outras solicitacoes</h2>
          <p>Pedidos relacionados a confirmacao de tratamento, acesso, correcao, anonimização, bloqueio, eliminacao quando cabivel ou outras medidas ligadas a LGPD devem ser encaminhados ao suporte. O atendimento pode depender de verificacao de identidade, analise tecnica e observancia de limitacoes legais ou operacionais.</p>
        </section>

        <section>
          <h2>6. Integracoes e plataformas de terceiros</h2>
          <p>Se o usuario tambem concedeu autorizacoes adicionais a outras plataformas ou ferramentas integradas, a revogacao no Google pode nao ser suficiente para encerrar acessos concedidos em outros ambientes. Nesses casos, o usuario deve revisar separadamente as permissoes e acessos ativos em cada provedor conectado.</p>
        </section>
      </div>
    </InfoPage>
  );
}

function PrivacyPage() {
  const privacyContact = supportEmail || 'contato@hfnew.com.br';

  return (
    <InfoPage title="Política de privacidade">
      <div className="policy-content">
        <section>
          <h2>1. Objetivo desta politica</h2>
          <p>Esta Politica de Privacidade descreve como o HF New Control Hub trata dados pessoais e dados operacionais relacionados ao uso do sistema. O objetivo e informar, de forma clara, quais dados podem ser coletados, como sao utilizados, por quanto tempo podem ser mantidos, com quem podem ser compartilhados e como o titular pode exercer seus direitos, em conformidade com a Lei Geral de Protecao de Dados Pessoais (LGPD) e com as politicas aplicaveis do Google e do YouTube.</p>
        </section>

        <section>
          <h2>2. Quem controla o tratamento e contato</h2>
          <p>O tratamento dos dados relacionados ao uso do sistema e realizado pelo operador do HF New Control Hub, no contexto de operacao interna e acesso restrito. Para duvidas, solicitacoes sobre dados pessoais, revogacao de acesso ou exercicio de direitos do titular, o contato indicado e <a href={`mailto:${privacyContact}`}>{privacyContact}</a>.</p>
        </section>

        <section>
          <h2>3. Quais dados podem ser coletados</h2>
          <p>Dependendo da funcionalidade utilizada, o sistema pode tratar: dados de autenticacao e identificacao de conta Google, como nome, e-mail e identificador da conta; dados de canais e contas conectadas, como nome do canal, identificador do canal, permissao concedida e status da conexao; metadados de publicacao, como titulo, descricao, hashtags, categoria, status de privacidade, horarios de agendamento e registros de publicacao; dados operacionais e tecnicos, como logs minimos de acesso, historico de acoes, status de integracoes, respostas resumidas de erro, trilhas de auditoria e informacoes estritamente necessarias para suporte e seguranca.</p>
        </section>

        <section>
          <h2>4. Dados que nao buscamos coletar</h2>
          <p>O sistema nao foi projetado para solicitar senha da conta Google, numero de cartao, credenciais bancarias ou dados pessoais sensiveis alem do estritamente necessario para autenticacao, operacao das integracoes autorizadas e suporte tecnico. O acesso aos dados segue os escopos de permissao efetivamente concedidos pelo usuario no fluxo de autorizacao.</p>
        </section>

        <section>
          <h2>5. Fontes dos dados</h2>
          <p>Os dados podem ser obtidos diretamente do usuario, do administrador responsavel pela autorizacao de acesso, do Google OAuth 2.0, de APIs do YouTube e de registros tecnicos gerados durante o uso do sistema. O sistema tambem pode tratar informacoes inseridas pelo proprio usuario no processo de publicacao, edicao, agendamento ou monitoramento.</p>
        </section>

        <section>
          <h2>6. Finalidades do tratamento</h2>
          <p>Os dados sao utilizados para: autenticar usuarios autorizados; conectar e operar canais e contas vinculadas; permitir publicacao, agendamento, atualizacao de metadados e monitoramento de status; manter trilha de auditoria e seguranca; atender solicitacoes de suporte; cumprir obrigacoes legais ou regulatórias; investigar incidentes; prevenir fraude, abuso ou uso nao autorizado; e preservar a integridade tecnica e operacional do sistema.</p>
        </section>

        <section>
          <h2>7. Bases legais</h2>
          <p>O tratamento pode se fundamentar, conforme o caso concreto, em consentimento do titular, execucao de procedimentos preliminares e servicos solicitados pelo usuario, cumprimento de obrigacao legal ou regulatoria, exercicio regular de direitos, e legitimo interesse para seguranca, auditoria, prevencao a fraude, suporte tecnico e administracao do ambiente, observados os limites da legislacao aplicavel.</p>
        </section>

        <section>
          <h2>8. Google OAuth, YouTube API e Limited Use</h2>
          <p>Quando o usuario conecta uma conta Google ou um canal do YouTube, o sistema pode acessar dados autorizados por meio do Google OAuth 2.0 e das APIs correspondentes, exclusivamente para finalidades compativeis com a operacao interna da plataforma. Dados recebidos de Google APIs nao sao vendidos a terceiros. O uso desses dados e limitado ao necessario para fornecer, manter, proteger e auditar as funcionalidades solicitadas pelo usuario, em linha com a Google API Services User Data Policy e, quando aplicavel, com os requisitos de Limited Use.</p>
        </section>

        <section>
          <h2>9. Compartilhamento de dados</h2>
          <p>Os dados podem ser compartilhados com provedores e plataformas estritamente necessarios para a execucao do servico, como Google, YouTube e infraestrutura tecnica utilizada para hospedagem, autenticacao, logs e entrega do sistema. O compartilhamento tambem pode ocorrer quando exigido por lei, ordem judicial, autoridade competente ou para defesa de direitos. Fora dessas hipoteses, nao ha compartilhamento deliberado de dados pessoais com terceiros sem base legal adequada.</p>
        </section>

        <section>
          <h2>10. Armazenamento, retencao e descarte</h2>
          <p>Os dados sao mantidos pelo tempo necessario para cumprir as finalidades informadas nesta politica, atender obrigacoes legais, preservar trilhas de auditoria e resolver incidentes operacionais. Dados de sessao, historico, filas, registros tecnicos e vinculacoes podem ser removidos, anonimizados, desvinculados ou descartados quando deixarem de ser necessarios, ressalvadas hipoteses legais de conservacao. O tempo exato pode variar conforme a natureza da informacao e a necessidade tecnica ou juridica associada.</p>
        </section>

        <section>
          <h2>11. Seguranca e controles internos</h2>
          <p>Medidas tecnicas e organizacionais razoaveis sao adotadas para restringir acesso, reduzir risco de divulgacao indevida, evitar tratamento nao autorizado e preservar a integridade do ambiente. Ainda assim, nenhum sistema conectado a internet e absolutamente imune a falhas, acessos indevidos, vulnerabilidades, indisponibilidades de terceiros ou eventos fora do controle do operador. O usuario tambem deve adotar boas praticas de seguranca na propria conta Google e nos canais conectados.</p>
        </section>

        <section>
          <h2>12. Cookies, logs e identificadores tecnicos</h2>
          <p>O sistema pode utilizar cookies tecnicos, armazenamento local do navegador, identificadores de sessao e logs minimos para autenticacao, navegacao, seguranca, continuidade de fluxo, preservacao de configuracoes e auditoria operacional. Esses mecanismos nao devem ser utilizados para finalidades ocultas ou incompatíveis com o funcionamento declarado da plataforma.</p>
        </section>

        <section>
          <h2>13. Transferencia internacional</h2>
          <p>Em razao do uso de provedores globais e APIs de terceiros, alguns dados podem ser processados em infraestrutura localizada fora do Brasil. Nessas situacoes, o tratamento busca observar bases legais adequadas, protecoes contratuais, medidas tecnicas razoaveis e requisitos aplicaveis das plataformas envolvidas.</p>
        </section>

        <section>
          <h2>14. Direitos do titular</h2>
          <p>Nos termos da LGPD e da legislacao aplicavel, o titular pode solicitar confirmacao de tratamento, acesso, correcao de dados incompletos, inexatos ou desatualizados, anonimizacao, bloqueio ou eliminacao quando cabivel, informacao sobre compartilhamento, portabilidade quando juridicamente aplicavel, revogacao de consentimento e revisao de decisoes que se enquadrem nas hipoteses legais. Solicitações podem ser encaminhadas para <a href={`mailto:${privacyContact}`}>{privacyContact}</a>, observadas as limitacoes tecnicas, obrigacoes legais e necessidade de verificacao de identidade.</p>
        </section>

        <section>
          <h2>15. Revogacao de acesso e desconexao</h2>
          <p>O usuario pode revogar permissoes concedidas ao aplicativo diretamente pela pagina de permissoes da Conta Google. Dependendo da funcionalidade disponivel e do contexto operacional, tambem pode solicitar a desconexao de canais ou contas conectadas no proprio painel ou por meio do suporte. As instrucoes publicas estao disponiveis em <Link to="/revogar-acesso">Revogar acesso</Link>.</p>
        </section>

        <section>
          <h2>16. Menores de idade</h2>
          <p>O sistema nao e destinado ao uso autonomo por menores de idade sem supervisao e base legal adequada. Caso seja identificado tratamento inadequado de dados de menor em desconformidade com a legislacao aplicavel, o operador pode adotar medidas de restricao, remocao ou interrupcao do acesso.</p>
        </section>

        <section>
          <h2>17. Alteracoes desta politica</h2>
          <p>Esta politica pode ser atualizada para refletir mudancas legais, regulatórias, tecnicas, operacionais ou relacionadas a integracoes com terceiros. A versao vigente sera a publicada nesta pagina, com producao de efeitos a partir da respectiva disponibilizacao.</p>
        </section>
      </div>
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
      <Route path="/politica-de-privacidade" element={<PrivacyPage />} />
      <Route path="/termos-de-uso" element={<TermsPage />} />
      <Route path="/revogar-acesso" element={<RevokeAccessPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
