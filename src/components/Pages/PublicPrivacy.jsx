import React from 'react';
import PublicPageShell from './PublicPageShell';

function PublicPrivacy() {
  return (
    <PublicPageShell
      badge="Política de Privacidade"
      title="Política de Privacidade"
      lead="Esta política descreve como o HF New Control Hub e a extensão HF Bulk Explorer tratam dados pessoais, dados de integração e conteúdos públicos solicitados por usuários autorizados."
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
          title: 'HF Bulk Explorer - dados tratados',
          body: 'Quando o usuário inicia uma leitura na extensão ou no módulo Baixar em Massa, o HF Bulk Explorer trata a URL da página aberta e conteúdos públicos visíveis necessários à função solicitada, como links de publicações, endereços de mídia e miniaturas, títulos, datas, métricas públicas, tipo de mídia e ordem de itens de carrossel. A extensão também informa ao painel sua versão e se uma sessão do Instagram aparenta estar ativa. Ela não lê nem coleta senhas, cookies, tokens de autenticação, mensagens privadas, dados de pagamento ou histórico geral de navegação.'
        },
        {
          title: 'HF Bulk Explorer - uso, armazenamento e transmissão',
          body: 'Os resultados da leitura são mantidos temporariamente no armazenamento local do Chrome para comunicação entre a página suportada e o HF New Control Hub. Quando o usuário solicita a organização ou o download das mídias selecionadas, os links e metadados públicos necessários são enviados ao serviço do HF New Control Hub por conexão HTTPS para executar essa solicitação. A extensão não vende os dados, não os utiliza para publicidade, perfil comportamental, análise de crédito ou finalidade diferente da coleta e organização pedidas pelo usuário.'
        },
        {
          title: 'HF Bulk Explorer - controle do usuário',
          body: 'A leitura de conteúdo ocorre em páginas suportadas para uma função iniciada pelo usuário na extensão ou no módulo Baixar em Massa. Os dados locais podem ser removidos ao excluir os dados da extensão no Chrome ou ao desinstalá-la. O acesso da extensão pode ser revogado a qualquer momento nas configurações de extensões do navegador.'
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
          body: 'Dados operacionais e registros técnicos podem ser mantidos pelo tempo necessário para executar a solicitação, segurança, auditoria, suporte, cumprimento legal e exercício regular de direitos. A extensão usa armazenamento local do Chrome e transmite dados ao HF New Control Hub somente por HTTPS. Tokens e credenciais são protegidos e não são exibidos publicamente na interface.'
        },
        {
          title: 'Uso limitado de dados da Chrome Web Store',
          body: 'O uso e a transferência de informações recebidas das APIs do Chrome obedecem à Política de Dados do Usuário da Chrome Web Store, inclusive aos requisitos de Uso Limitado. Esses dados são usados somente para fornecer ou melhorar a finalidade única e visível da extensão, não são usados para publicidade personalizada e não são disponibilizados para leitura humana, salvo mediante consentimento específico do usuário, por necessidade de segurança, para cumprir a lei ou quando agregados e anonimizados para operação interna.'
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
