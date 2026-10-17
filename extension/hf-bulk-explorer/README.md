# HF Bulk Explorer

Extensao local que coleta e organiza links, miniaturas e metricas publicas
visiveis para o modulo Baixar em Massa do HF New Control Hub.

## Instalar no Chrome ou Edge

1. Extraia o arquivo ZIP.
2. Abra `chrome://extensions` ou `edge://extensions`.
3. Ative o modo de desenvolvedor.
4. Clique em `Carregar sem compactacao`.
5. Selecione a pasta extraida que contem `manifest.json`.

Se a versao da loja ja estiver instalada, desative-a durante o teste manual
para nao executar duas versoes juntas. Para atualizar uma instalacao manual,
substitua os arquivos da mesma pasta e clique em Recarregar na extensao.
Depois atualize a pagina do HUB e a aba do Instagram. Confira a versao 1.6.0.

## Correcao de exportacao - 1.6.0

- Identifica o MP4 nos dados da publicacao mesmo com um player `blob:`.
- Confere o codigo da publicacao antes e depois da leitura: nao troca pelo
  primeiro Reel vizinho, nao aceita um perfil como se fosse um arquivo.
- Reaproveita uma aba da mesma publicacao se ela ja estiver aberta. Somente
  abas temporarias criadas pela extensao sao fechadas ao terminar.
- Cada pedido mantem seu proprio resultado ate o HUB recebe-lo. O HUB cria
  o download e salva o MP4; abrir a publicacao por si so nao indica sucesso.
- Corrige a espera pelo carregamento e a leitura de pedidos recebidos depois
  que o perfil ja abriu. Nao amplia permissoes e nao copia cookies ou senhas.

Quando o Instagram nao disponibilizar uma URL do arquivo da publicacao
escolhida, a extensao informa a falha. Nao contorna login ou conteudo protegido.

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
