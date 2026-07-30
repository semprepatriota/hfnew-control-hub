import PublicPageShell from './PublicPageShell';

export default function PrivacyPage() {
  return (
    <PublicPageShell eyebrow="Informacoes legais" title="Politica de privacidade">
      <p>Este aplicativo organiza registros de avaliacao neuropsicopedagogica para uso profissional.</p>
      <h2>Dados tratados</h2>
      <p>Podem ser registrados dados cadastrais do adolescente, responsavel, escola, aplicacoes, respostas, observacoes e relatorios.</p>
      <h2>Armazenamento atual</h2>
      <p>Nesta versao, os registros ficam armazenados localmente no navegador utilizado. Eles nao sao sincronizados automaticamente entre dispositivos.</p>
      <h2>Acesso restrito</h2>
      <p>O acesso utiliza uma conta profissional provisionada no backend do aplicativo. A senha e armazenada somente como hash seguro no servidor, e a sessao usa cookie HttpOnly, Secure e SameSite.</p>
      <h2>Responsabilidade profissional</h2>
      <p>O acesso deve ser protegido pela profissional. Nao compartilhe o navegador ou a sessao com pessoas nao autorizadas e nao use o sistema como substituto de prontuario, manual tecnico ou avaliacao clinica.</p>
    </PublicPageShell>
  );
}
