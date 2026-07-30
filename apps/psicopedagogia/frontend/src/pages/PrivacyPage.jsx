import PublicPageShell from './PublicPageShell';

export default function PrivacyPage() {
  return (
    <PublicPageShell eyebrow="Informacoes legais" title="Politica de privacidade">
      <p>Este aplicativo organiza registros de avaliacao neuropsicopedagogica para uso profissional.</p>
      <h2>Dados tratados</h2>
      <p>Podem ser registrados dados cadastrais do adolescente, responsavel, escola, aplicacoes, respostas, observacoes e relatorios.</p>
      <h2>Armazenamento atual</h2>
      <p>Nesta versao, os registros ficam armazenados localmente no navegador utilizado. Eles nao sao sincronizados automaticamente entre dispositivos.</p>
      <h2>Leitura de documentos</h2>
      <p>Quando a profissional escolhe importar PDF, Word .docx ou imagem, a leitura e realizada no proprio navegador apenas para sugerir o preenchimento da ficha. Os arquivos nao sao enviados ou guardados pelo servidor deste aplicativo e a ficha so e salva depois da revisao e confirmacao manual.</p>
      <h2>Acesso e seguranca local</h2>
      <p>Esta versao abre diretamente no navegador e nao utiliza login, cookies de sessao, tokens ou integracao com o HF New Control Hub.</p>
      <h2>Responsabilidade profissional</h2>
      <p>Use o aplicativo somente em computador controlado pela profissional. Nao compartilhe o navegador com pessoas nao autorizadas e nao use o sistema como substituto de prontuario, manual tecnico ou avaliacao clinica.</p>
    </PublicPageShell>
  );
}
