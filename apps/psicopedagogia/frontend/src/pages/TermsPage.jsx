import PublicPageShell from './PublicPageShell';

export default function TermsPage() {
  return (
    <PublicPageShell eyebrow="Informacoes legais" title="Termos de uso">
      <p>O HF Psicopedagogia e uma ferramenta de organizacao de registros para profissionais habilitados.</p>
      <h2>Uso permitido</h2>
      <p>Use o sistema apenas para finalidades profissionais, com consentimento e observancia das normas aplicaveis de protecao de dados.</p>
      <h2>Interpretacao dos resultados</h2>
      <p>O sistema nao diagnostica, nao substitui manuais oficiais e nao define condutas automaticamente. A profissional deve revisar respostas, pontuacao, contexto e limitacoes.</p>
      <h2>Conteudo dos instrumentos</h2>
      <p>Itens, estimulos, gabaritos e normas devem ser utilizados somente de acordo com fontes autorizadas e qualificacao profissional.</p>
      <h2>Disponibilidade</h2>
      <p>Os registros ficam no navegador utilizado e podem ser perdidos quando os dados locais forem removidos. Mantenha os documentos exportados em local seguro.</p>
    </PublicPageShell>
  );
}
