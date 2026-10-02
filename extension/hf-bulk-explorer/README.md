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
compartilha com o painel links, miniaturas e metricas visiveis. Ao salvar um
Reel, tambem consulta o endereco do MP4 na pagina do Instagram e envia esse
endereco ao painel para a VPS baixar o arquivo. O link pode expirar ou ser
recusado pelo Instagram; nesse caso a fila informa a falha.

Instagram ativo. TikTok permanece em breve no painel.

## Carrosseis - versao 1.4.1

No Baixar em Massa, escolha Carrosseis e informe o link da publicacao.
A extensao percorre somente as imagens e videos dessa publicacao, comecando
no primeiro item. Aguarde a leitura sem mover as setas da aba aberta.
Escolha todos os itens ou apenas alguns e solicite o ZIP pelo painel.

Os arquivos mantem a ordem original, em uma pasta por publicacao. O ZIP
inclui manifest.json e relatorio.csv. Se uma midia nao estiver disponivel,
o pacote fica INCOMPLETO e indica exatamente o item que falhou.

Esta atualizacao nao amplia as permissoes de acesso da extensao.
Um pacote ja submetido a Chrome Web Store nao e alterado automaticamente.
