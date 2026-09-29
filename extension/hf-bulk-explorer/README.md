# HF Bulk Explorer

Extensao local que coleta e organiza links, miniaturas e metricas publicas
visiveis para o modulo Baixar em Massa do HF New Control Hub.

## Instalar no Chrome ou Edge

1. Extraia o arquivo ZIP.
2. Abra `chrome://extensions` ou `edge://extensions`.
3. Ative o modo de desenvolvedor.
4. Clique em `Carregar sem compactacao`.
5. Selecione a pasta `hf-bulk-explorer` extraida.

A extensao nao le senhas, nao exporta cookies e nao acessa tokens do app. Ela
compartilha localmente com o painel apenas links, miniaturas e metricas que ja
estejam visiveis na pagina aberta.

Instagram ativo. TikTok permanece em breve no painel.

## Carrosseis - versao 1.4.0

No Baixar em Massa, escolha Carrosseis e informe o link da publicacao.
A extensao percorre somente as imagens e videos dessa publicacao, comecando
no primeiro item. Aguarde a leitura sem mover as setas da aba aberta.
Escolha todos os itens ou apenas alguns e solicite o ZIP pelo painel.

Os arquivos mantem a ordem original, em uma pasta por publicacao. O ZIP
inclui manifest.json e relatorio.csv. Se uma midia nao estiver disponivel,
o pacote fica INCOMPLETO e indica exatamente o item que falhou.

Esta atualizacao nao amplia as permissoes de acesso da extensao.
Um pacote ja submetido a Chrome Web Store nao e alterado automaticamente.
