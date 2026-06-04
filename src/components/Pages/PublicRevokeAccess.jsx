import React from 'react';
import PublicPageShell from './PublicPageShell';

function PublicRevokeAccess() {
  return (
    <PublicPageShell
      badge="Revogação de acesso"
      title="Revogar acesso"
      lead="Esta página explica como remover permissões concedidas ao HF New Control Hub e o que acontece depois da revogação."
      sections={[
        {
          title: 'Revogação pela Conta Google',
          body: 'A forma principal de interromper o acesso é abrir https://myaccount.google.com/permissions e remover a autorização concedida ao aplicativo. Após a revogação, o sistema deixa de poder usar as credenciais concedidas para novas operações.'
        },
        {
          title: 'Desconexão no painel',
          body: 'Quando a funcionalidade estiver disponível, canais e perfis conectados também podem ser desconectados pelo painel. Essa ação operacional não substitui a revogação na Conta Google quando o objetivo for remover totalmente a permissão OAuth.'
        },
        {
          title: 'Solicitação por suporte',
          body: 'Se o usuário não conseguir concluir a revogação ou desconexão, pode solicitar apoio pelo e-mail de suporte para remoção de acesso, desvinculação de canal, limpeza de vínculo operacional ou orientação sobre direitos relacionados a dados pessoais.'
        },
        {
          title: 'Efeitos da revogação',
          body: 'A revogação impede novas operações com as permissões removidas. Registros técnicos, logs, histórico operacional e dados necessários para segurança, auditoria, obrigação legal ou exercício regular de direitos podem ser mantidos pelo período necessário.'
        }
      ]}
      footerTitle="Página de permissões"
      footerBody="Revogue permissões em https://myaccount.google.com/permissions ou solicite apoio pelo suporte informado nesta página."
    />
  );
}

export default PublicRevokeAccess;
