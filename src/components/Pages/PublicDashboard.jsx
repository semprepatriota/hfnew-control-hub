import React from 'react';
import PublicPageShell from './PublicPageShell';

function PublicDashboard() {
  return (
    <PublicPageShell
      badge="Dashboard interno"
      title="HF New Control Hub"
      lead="Dashboard interno para publicação autorizada no YouTube. Este sistema é privado e usado apenas para gerenciar publicações próprias ou autorizadas em canais conectados."
      sections={[
        {
          title: 'O que este dashboard faz',
          body: 'Centraliza captura, organização de ativos, edição, renderização, metadados, revisão, agendamento, fila e publicação de conteúdo autorizado.'
        },
        {
          title: 'Uso interno autorizado',
          body: 'O acesso é restrito a contas previamente autorizadas. O dashboard não é uma ferramenta pública aberta a terceiros e não deve ser usado para automação abusiva, spam ou manipulação artificial de alcance.'
        },
        {
          title: 'Integração com YouTube',
          body: 'As integrações com Google e YouTube usam OAuth 2.0 e YouTube Data API v3 para ações autorizadas pelo usuário, como leitura de canais, upload, gerenciamento e publicação.'
        },
        {
          title: 'Controle e revogação',
          body: 'Usuários autorizados podem revogar permissões pela Conta Google, solicitar suporte ou desconectar canais quando a funcionalidade estiver disponível no painel.'
        },
        {
          title: 'Posicionamento do produto',
          body: 'O produto é apresentado como dashboard editorial e operacional, não como serviço de distribuição em massa, ferramenta de spam ou mecanismo de crescimento artificial.'
        }
      ]}
      footerTitle="Canal de suporte"
      footerBody="Para duvidas de acesso, conformidade ou revisao documental, use o contato configurado no ambiente."
    />
  );
}

export default PublicDashboard;
