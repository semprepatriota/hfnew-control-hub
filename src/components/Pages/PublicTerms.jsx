import React from 'react';
import PublicPageShell from './PublicPageShell';

function PublicTerms() {
  return (
    <PublicPageShell
      badge="Termos de Uso"
      title="Termos de Uso"
      lead="Estes termos regulam o uso do HF New Control Hub, um dashboard privado para operação editorial, gerenciamento de ativos e publicação própria ou autorizada em canais conectados."
      sections={[
        {
          title: 'Acesso restrito',
          body: 'O acesso é permitido somente a usuários previamente autorizados pelo administrador do sistema. O uso por terceiros não autorizados, compartilhamento indevido de acesso ou tentativa de burlar controles de autenticação é proibido.'
        },
        {
          title: 'Responsabilidade pelo conteúdo',
          body: 'O usuário é integralmente responsável por conteúdos enviados, gerados, renderizados, publicados, agendados ou aprovados no sistema, incluindo direitos autorais, direitos de imagem, licenças, titularidade, adequação editorial e conformidade com regras das plataformas de destino.'
        },
        {
          title: 'Condutas proibidas',
          body: 'É proibido usar o sistema para spam, fraude, automação abusiva, violação de direitos de terceiros, distribuição não autorizada, conteúdo ilícito, manipulação artificial de alcance, descumprimento de políticas de API ou qualquer uso que possa causar bloqueio, sanção ou dano.'
        },
        {
          title: 'Plataformas de terceiros',
          body: 'O sistema depende de APIs, serviços e políticas de terceiros, incluindo Google e YouTube. O uso de funcionalidades relacionadas ao YouTube também está sujeito aos Termos de Serviço do YouTube e demais políticas aplicáveis.'
        },
        {
          title: 'Disponibilidade e limitações',
          body: 'O sistema pode sofrer falhas, indisponibilidades, alterações de API, perda de sessão, limites de quota, recusas de autenticação, falhas de publicação e mudanças de políticas externas. Não há garantia de disponibilidade ininterrupta ou sucesso de publicação.'
        },
        {
          title: 'Suspensão e encerramento',
          body: 'O operador pode limitar, suspender ou encerrar acessos, canais conectados, filas, automações ou funcionalidades quando houver risco de segurança, violação destes termos, determinação legal, exigência de auditoria ou necessidade de preservar a integridade do ambiente.'
        },
        {
          title: 'Limitação de responsabilidade',
          body: 'Na extensão permitida pela legislação aplicável, o operador não responde por danos indiretos, perda de receita, bloqueios de conta, remoção de conteúdo, sanções de terceiros, falhas de API, indisponibilidade de serviços externos ou uso indevido por usuário autorizado.'
        }
      ]}
      footerTitle="Privacidade e revogação"
      footerBody="O tratamento de dados observa a política de privacidade publicada, e o usuário pode revogar permissões pela página pública de revogação."
    />
  );
}

export default PublicTerms;
