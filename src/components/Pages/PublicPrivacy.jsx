import React from 'react';
import PublicPageShell from './PublicPageShell';

function PublicPrivacy() {
  return (
    <PublicPageShell
      badge="Política de Privacidade"
      title="Política de Privacidade"
      lead="Esta política descreve como o HF New Control Hub trata dados pessoais e dados de integração quando usuários autorizados acessam o dashboard por Google OAuth 2.0 e utilizam recursos ligados à YouTube Data API v3."
      sections={[
        {
          title: 'Dados coletados ou acessados',
          body: 'O sistema pode tratar dados básicos da conta Google autorizada, como nome, e-mail e identificadores de perfil, além de informações de canais conectados, vídeos, metadados, status de publicação, filas, registros operacionais e tokens necessários para executar ações autorizadas.'
        },
        {
          title: 'Finalidades do tratamento',
          body: 'Os dados são usados para autenticação, controle de acesso, gerenciamento de canais autorizados, upload, agendamento, publicação, revisão de conteúdo, manutenção de sessão, auditoria operacional, segurança e suporte técnico.'
        },
        {
          title: 'Base legal e acesso restrito',
          body: 'O tratamento ocorre para execução de funcionalidades solicitadas pelo usuário autorizado, cumprimento de obrigações legais ou regulatórias, legítimo interesse operacional e segurança do ambiente. O acesso é restrito a usuários previamente autorizados pelo administrador do sistema.'
        },
        {
          title: 'Compartilhamento com terceiros',
          body: 'Os dados não são vendidos. O compartilhamento pode ocorrer apenas com provedores necessários ao funcionamento da aplicação, como Google/YouTube, infraestrutura de hospedagem, serviços técnicos e ferramentas de segurança, sempre limitado à finalidade operacional autorizada.'
        },
        {
          title: 'Retenção, descarte e segurança',
          body: 'Dados operacionais e registros técnicos podem ser mantidos pelo tempo necessário para segurança, auditoria, suporte, cumprimento legal e exercício regular de direitos. Tokens e credenciais devem ser protegidos e não são exibidos publicamente na interface.'
        },
        {
          title: 'Direitos do titular',
          body: 'O usuário pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação quando cabível, informação sobre compartilhamento e revogação de consentimento, observadas limitações legais, técnicas e necessidade de verificação de identidade.'
        },
        {
          title: 'Revogação de acesso',
          body: 'O usuário pode revogar permissões diretamente na página de permissões da Conta Google em https://myaccount.google.com/permissions, desconectar canais pelo painel quando disponível ou solicitar apoio pelo e-mail de suporte.'
        }
      ]}
      footerTitle="Suporte"
      footerBody="Solicitações relacionadas a privacidade, LGPD, revogação, correção ou exclusão de dados devem ser encaminhadas ao suporte."
    />
  );
}

export default PublicPrivacy;
