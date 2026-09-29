# HF Bulk Explorer 1.4.1 - Chrome Web Store

## Resumo curto

Coleta e organiza links, miniaturas, mídias e métricas públicas para o módulo Baixar em Massa do HF New Control Hub.

## Descrição detalhada

HF Bulk Explorer auxilia usuários do HF New Control Hub a coletar e organizar conteúdos públicos que já estejam visíveis na página aberta.

A coleta começa quando o usuário clica em Escanear página na extensão ou inicia uma leitura no módulo Baixar em Massa. Os resultados ficam temporariamente no armazenamento local do Chrome e são enviados ao HF New Control Hub somente quando o usuário solicita a organização ou o download.

O fluxo manual da extensão reconhece páginas suportadas do Instagram, TikTok, Facebook, Pinterest e Kwai. A integração automática do módulo Baixar em Massa é limitada ao domínio do HF New Control Hub e ao Instagram.

A extensão não lê senhas, cookies, mensagens privadas, dados de pagamento ou tokens de autenticação. Ela não é afiliada, patrocinada ou endossada pelas redes suportadas.

## Categoria e idioma

- Categoria: Produtividade
- Idioma: Português (Brasil)

## URLs

- Política de privacidade: https://app.hfnew.com.br/politica-de-privacidade/
- Página inicial: https://app.hfnew.com.br/suporte/
- Suporte: https://app.hfnew.com.br/suporte/

## Finalidade única

Permitir que o usuário, por ação explícita, colete e organize conteúdos públicos visíveis de páginas suportadas para o fluxo de download em massa do HF New Control Hub.

## Justificativas de permissões

- `activeTab`: conceder acesso temporário somente à aba ativa depois que o usuário clicar em Escanear página.
- `scripting`: executar o coletor empacotado na extensão na aba ativa após a ação direta do usuário.
- `storage`: guardar temporariamente no Chrome o estado, as solicitações e os resultados, permitindo a comunicação entre a página suportada e o módulo Baixar em Massa.
- `https://app.hfnew.com.br/*`: permitir que o módulo Baixar em Massa detecte a extensão, inicie uma solicitação escolhida pelo usuário e receba os resultados.
- `https://www.instagram.com/*`: permitir que a integração do módulo leia o perfil ou carrossel solicitado pelo usuário e informe se a sessão aparenta estar ativa, sem acessar senhas, cookies ou tokens.

## Código remoto

Não. Todo o código executável está incluído no pacote. A extensão acessa apenas recursos e dados públicos necessários ao conteúdo solicitado; nenhum conteúdo remoto é executado como código.

## Dados declarados em Práticas de privacidade

- Conteúdo de sites: sim. Links de publicações, endereços de mídia e miniaturas, títulos, datas, métricas públicas, tipo de mídia e ordem do carrossel.
- Atividade de navegação: sim. URL da página suportada envolvida na ação solicitada; nenhum histórico geral é monitorado.
- Informações de autenticação: não.
- Comunicações pessoais: não.
- Informações financeiras: não.
- Localização: não.
- Conteúdo gerado pelo usuário: não, salvo se a loja classificar publicações públicas visíveis de terceiros nessa categoria; nesse caso, declarar também essa categoria para evitar subdeclaração.

Os dados são usados somente para a finalidade principal, não são vendidos, não são usados para publicidade personalizada e não são transferidos para análise de crédito ou empréstimos. Certificar conformidade com Uso Limitado.

## Instruções para revisão

1. Instale a extensão.
2. Abra uma página pública suportada com publicações visíveis.
3. Clique no ícone da extensão, escolha a quantidade e clique em Escanear página.
4. Confirme que o contador mostra os conteúdos públicos encontrados.
5. O botão Enviar ao painel guarda os resultados no armazenamento local do Chrome para o HF New Control Hub.
6. A conta autorizada no HF New Control Hub é necessária somente para validar a integração completa e não é necessária para testar a coleta manual.

## Antes de reenviar

- Copiar o motivo e o código exatos da rejeição exibidos na aba Status.
- Confirmar que o ZIP contém `manifest.json` na raiz e versão `1.4.1`.
- Atualizar a descrição, a finalidade única, as justificativas e as declarações de dados acima.
- Confirmar que a política de privacidade publicada contém a seção HF Bulk Explorer.
- Só então enviar para nova revisão.
