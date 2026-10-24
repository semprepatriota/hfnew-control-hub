# Ranking Multimidia: piloto isolado

Os comandos deste diretorio executam o piloto local isolado. A integracao
autorizada em 24/10/2026 esta documentada em `deploy/ranking/README.md` e usa
um servico separado: nao envia automaticamente os rascunhos ou midias do E:.

## Abrir

Execute `start-pilot.ps1` nesta pasta. URL local:

http://127.0.0.1:4182/tools/ranking-pilot/index.html

O servidor escuta somente em 127.0.0.1. Nao e a publicacao do site online.

## Separacao

- Codigo visual: `src/modules/ranking-pilot/`.
- Entrada, servidor local e verificacoes: `tools/ranking-pilot/`.
- Runtime, fontes e midias: `E:\HFNEW-PILOTOS\ranking-multimidia`.
- Nenhuma chamada a APIs de IA e necessaria ou implementada neste piloto.
- Nenhum servico da VPS e reiniciado por estes comandos.
- Nem o pacote de dependencias nem os componentes dos outros modulos foram alterados.

## Preparar novamente

O runtime isolado tem seu proprio package.json e package-lock.json no E:.
As versoes do Remotion foram fixadas em 4.0.530, iguais as do Player do HUB.
Para reinstalar somente esse runtime, execute `npm ci` na pasta runtime do E:.

Use o Python do backend local para executar `prepare_media.py`. Ele gera
trechos curtos a partir das referencias fornecidas pelo usuario, recortando
uma regiao interna para nao duplicar os titulos e as listas ja embutidos.
Esses enquadramentos sao midia de demonstracao; nao sao a restauracao dos
videos originais sem textos. Os originais em Downloads nao sao sobrescritos.

A fonte Montserrat inclui sua licenca OFL em public/fonts. Nao foi copiada
uma fonte proprietaria do Windows para o projeto.

## Modelos

- Classico: seis cenas de dois segundos, sem vinhetas; piloto de 12 segundos.
- Com vinhetas: cinco cenas, quatro intervalos e encerramento; 13,5 segundos.
- Numeros sempre visiveis, descricoes progressivas e persistentes.
- Varias cenas ou subtrechos, sem exigir dez posicoes preenchidas.
- Titulo, destaques, tamanho, descricoes, cortes, volume e enquadramento editaveis.
- Escolha/remocao de vinheta por intervalo, musica opcional e encerramento opcional.
- Ordem por arrastar ou botoes, exclusao sem buracos na numeracao.
- Rascunhos separados por modelo; salvamento adicional no E:.

O limite de seguranca deste piloto e 200 MB por upload, ate tres minutos por
arquivo e por montagem, e fonte de video de ate 4K. Isso nao altera os limites
do Forge Max nem de nenhum outro modulo.

## Render e validacao

O Player e o renderizador importam o MESMO RankingComposition.jsx e o mesmo
contrato temporal em quadros inteiros a 30 fps. Os arquivos de fontes sao os
mesmos nos dois caminhos. Nao ha uma segunda implementacao CSS/FFmpeg do texto.

Os MP4s sao validados antes do status ready: H.264, 1080x1920, yuv420p,
AAC/48 kHz, duracao da timeline e decodificacao completa com FFmpeg.

`render-pilots.mjs` gera os dois pilotos. A opcao `--quick` gera apenas um
teste curto; ela nao registra sucesso dos dois modelos.

`verify-ui.cjs` testa edicao, cortes, ordem, reproducao de uma cena isolada,
vinhetas e tela mobile. Execute pelo Playwright CLI com run-code --filename.

`capture-parity.cjs` captura o Player em 1080x1920 nos quadros 15, 90, 150 e
359 do classico e 15, 72, 99 e 404 do modelo com vinhetas.
`compare_frames.py` compara esses quadros com o MP4 e salva os pares visuais
e as metricas no E:. Diferencas pequenas de compressao H.264 sao esperadas;
nao se afirma igualdade binaria dos pixels de um MP4 com um PNG.

`verify-render-flow.cjs` testa o botao real de renderizar com uma montagem
curta, reproducao do resultado e a ordem gesto -> escolha de destino ->
escrita do MP4. O seletor de pasta e simulado nesse teste automatizado; o
download HTTP completo tambem deve ser conferido fisicamente e por hash.

## Validacao de producao

- `verify-hub.cjs`: interface no HUB com sessao e respostas da API simuladas.
- `test-production-render.mjs`: MP4 dos dois modelos pelo worker de producao.
- `deploy/ranking/test_ranking.py`: isolamento, assinaturas, cortes e autenticacao HTTP.
- O instalador remoto valida MP4, worker RQ, protecao 401 e hashes dos outros Forge.
- Requisitos de licenciamento comercial continuam sendo responsabilidade do negocio.
- A troca autorizada preserva projetos e bibliotecas antigos, sem backup extra solicitado.

Os testes locais nao comprovam um deploy ou o funcionamento autenticado na VPS.
