import React from 'react';
import PublicPageShell from './PublicPageShell';

function PublicSupport() {
  return (
    <PublicPageShell
      badge="Suporte"
      title="Suporte HF Bulk Explorer"
      lead="Canal oficial de suporte da extensao HF Bulk Explorer e do modulo Baixar em Massa do HF New Control Hub."
      sections={[
        {
          title: 'Contato de suporte',
          body: 'Para suporte tecnico, problemas de instalacao, uso da extensao, privacidade ou solicitacoes relacionadas ao HF Bulk Explorer, entre em contato pelo e-mail informado nesta pagina.'
        },
        {
          title: 'Finalidade da extensao',
          body: 'A extensao coleta links, miniaturas e metricas publicas visiveis somente quando o usuario aciona o comando de escanear pagina. Ela nao coleta senhas, cookies, mensagens privadas, dados de pagamento ou tokens de autenticacao.'
        },
        {
          title: 'Atendimento',
          body: 'As solicitacoes recebidas sao analisadas pelo operador do HF New Control Hub. Inclua no contato o navegador usado, a pagina em que ocorreu o problema e uma descricao objetiva do erro.'
        }
      ]}
      footerTitle="E-mail de suporte"
      footerBody="Use este canal para relatar falhas, solicitar remocao de dados locais, tirar duvidas de uso ou tratar assuntos de privacidade."
    />
  );
}

export default PublicSupport;
