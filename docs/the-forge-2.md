# The Forge 2.0

Modulo independente para edicao automatizada de videos longos no Projeto 2.

## Fase atual

Implementado nesta fase:

- rota frontend `/the-forge`;
- tela inicial do modulo;
- criacao de projeto;
- upload de video longo;
- leitura de duracao, resolucao, codec, formato e tamanho com FFprobe;
- extracao de audio com FFmpeg;
- transcricao com `faster-whisper`;
- revisao manual da transcricao;
- geracao de SRT;
- criacao de previa simples com legendas;
- status da conexao com LM Studio;
- analise do video com LM Studio quando disponivel;
- fallback local para gerar plano basico quando LM Studio estiver offline;
- geracao de resumo, capitulos, cortes, pontos de midia, avatar e trailer em `edit_plan.json`;
- revisao visual do plano no frontend;
- aprovacao/rejeicao de itens do plano.
- Forge Easy Editor em `/the-forge/editor`;
- timeline simplificada com faixas de video, B-roll, avatar, textos, legendas, musica e SFX;
- estado do editor salvo em `editor_state.json`;
- autosave versionado em `logs/autosave-000000.json`;
- endpoints isolados em `/api/forge2/editor`.
- Forge Easy Editor Fase 2:
  - campo para importar video diretamente por URL do YouTube;
  - confirmacao obrigatoria de direito/autorizacao antes da importacao;
  - download isolado dentro de `storage/forge/projects/{project_id}/source`;
  - atualizacao automatica do video principal do projeto;
  - selecao de clipes na timeline;
  - edicao simples de nome, inicio, fim, origem inicio e origem fim;
  - mover clipe em passos de 1 segundo;
  - dividir clipe no meio;
  - excluir clipe;
  - desfazer/refazer com autosave.
- Ponte The Forge 2.0 -> Forge Easy Editor:
  - botao `Analisar com IA` dentro do Easy Editor;
  - extracao de audio automatica quando ainda nao existir;
  - transcricao automatica quando ainda nao existir;
  - analise com LM Studio ou fallback local;
  - atualizacao de `edit_plan.json`;
  - exibicao de resumo, capitulos, cortes sugeridos e plano de trailer no Easy Editor.

Ainda nao implementado:

- timeline avancada;
- busca automatica de imagens;
- avatar com sincronizacao labial;
- trailer automatico completo;
- renderizacao em nuvem;
- edicao em 4K.

## Backend

Arquivos principais:

```txt
backend/routes/forge2.py
backend/routes/forge_editor.py
backend/models/forge_models.py
backend/services/forge/project_service.py
backend/services/forge/storage_service.py
backend/services/forge/editor_service.py
backend/services/forge/media_service.py
backend/services/forge/ffmpeg_service.py
backend/services/forge/transcription_service.py
backend/services/forge/caption_service.py
backend/services/forge/lm_studio_service.py
backend/services/forge/analysis_service.py
backend/services/forge/render_service.py
backend/services/forge/trailer_service.py
backend/services/forge/avatar_service.py
```

Armazenamento:

```txt
storage/forge/projects/{project_id}/
  project.json
  edit_plan.json
  source/
  audio/
  transcript/
  media/
  avatar/
  previews/
  renders/
```

## Variaveis opcionais

Nao altere `.env` se nao precisar. As variaveis abaixo sao opcionais:

```env
FORGE2_STORAGE_DIR=
FORGE2_MAX_UPLOAD_MB=2048
FORGE2_LM_STUDIO_URL=http://127.0.0.1:1234
FORGE2_WHISPER_MODEL=small
FORGE2_WHISPER_DEVICE=cpu
FORGE2_WHISPER_COMPUTE_TYPE=int8
FORGE2_YTDLP_COOKIES_FILE=
FORGE2_YTDLP_JS_RUNTIME=
FORGE2_YTDLP_PROXY=
FORGE2_YTDLP_GEO_VERIFICATION_PROXY=
FORGE2_YTDLP_XFF_COUNTRY=
```

## Instalar dependencias

No backend:

```bash
pip install -r requirements.txt
```

Dependencia nova:

```txt
faster-whisper>=1.1.1
yt-dlp>=2024.12.13
```

Tambem precisa ter `ffmpeg` e `ffprobe` disponiveis no sistema ou configurados por:

```env
FFMPEG_BIN=ffmpeg
FFPROBE_BIN=ffprobe
```

## Iniciar backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 9000
```

No Windows PowerShell:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --host 127.0.0.1 --port 9000
```

## Iniciar frontend

```bash
cd hfnew-control-hub
npm install
npm run dev
```

A rota do modulo fica em:

```txt
/the-forge
/the-forge/editor
```

## Iniciar LM Studio

No LM Studio:

1. Abra um modelo local.
2. Ative o servidor local OpenAI-compatible.
3. Mantenha o endpoint em:

```txt
http://127.0.0.1:1234
```

Teste:

```bash
curl http://127.0.0.1:9000/api/forge2/lm-studio/status
```

## Testar fluxo

Criar projeto:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/projects \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Teste Forge 2\"}"
```

Upload de video:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/projects/PROJECT_ID/upload-source \
  -F "file=@/caminho/video.mp4"
```

Extrair audio:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/projects/PROJECT_ID/extract-audio
```

Transcrever:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/projects/PROJECT_ID/transcribe
```

Gerar SRT:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/projects/PROJECT_ID/captions/srt
```

Analisar com LM Studio ou fallback local:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/projects/PROJECT_ID/analyze
```

Aprovar ou rejeitar um item do plano:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/projects/PROJECT_ID/plan/cuts/cut_1/approval \
  -H "Content-Type: application/json" \
  -d "{\"approved\":true,\"note\":\"Usar no corte curto\"}"
```

Gerar previa:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/projects/PROJECT_ID/preview
```

Inicializar o Forge Easy Editor:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/editor/projects/PROJECT_ID/initialize
```

Consultar estado do editor:

```bash
curl http://127.0.0.1:9000/api/forge2/editor/projects/PROJECT_ID
```

Importar video do YouTube para o projeto:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/editor/projects/PROJECT_ID/youtube-import \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://www.youtube.com/watch?v=VIDEO_ID\",\"confirm_rights\":true}"
```

Analisar o projeto pelo Forge Easy Editor:

```bash
curl -X POST http://127.0.0.1:9000/api/forge2/editor/projects/PROJECT_ID/analyze
```

Esse endpoint prepara o projeto para edicao assistida:

```txt
video principal
  -> audio
  -> transcricao
  -> analise LM Studio/fallback
  -> edit_plan.json
  -> painel do Forge Easy Editor
```

Se o YouTube retornar `Sign in to confirm you're not a bot`, configure um arquivo `cookies.txt` exportado do navegador da conta autorizada:

```env
FORGE2_YTDLP_COOKIES_FILE=/root/ALLIANCE-DARK/backend/storage/forge/youtube_cookies.txt
```

Se o `yt-dlp` pedir runtime JavaScript, instale/configure um runtime suportado e informe:

```env
FORGE2_YTDLP_JS_RUNTIME=deno
```

Se o YouTube bloquear por pais/regiao, use um video sem restricao regional ou configure um proxy/VPN autorizado em um pais permitido:

```env
FORGE2_YTDLP_PROXY=http://usuario:senha@host:porta
FORGE2_YTDLP_GEO_VERIFICATION_PROXY=http://usuario:senha@host:porta
FORGE2_YTDLP_XFF_COUNTRY=BR
```

Atualizar timeline pelo editor:

```bash
curl -X PUT http://127.0.0.1:9000/api/forge2/editor/projects/PROJECT_ID/timeline \
  -H "Content-Type: application/json" \
  -d @editor_timeline.json
```

## Seguranca

- Nao usa `shell=True`.
- FFmpeg/FFprobe sao chamados com lista de argumentos.
- IDs de projeto sao validados.
- Caminhos ficam restritos a `storage/forge/projects`.
- Upload bloqueia path traversal.
- Extensoes de video sao validadas.
- Tamanho maximo de upload e configuravel.
- Importacao por YouTube exige confirmacao de direito/autorizacao antes de baixar.
- `yt-dlp` e executado via `python -m yt_dlp`, sem `shell=True`.
- O download do YouTube aceita apenas dominios oficiais do YouTube.
- Cookies do YouTube ficam em arquivo local na VPS e nao devem ser commitados no Git.
- Proxy do YouTube deve ficar somente no `.env` da VPS e nao deve ser commitado no Git.
- LM Studio deve ficar apenas local.
- O modelo nao pode retornar nem executar comandos de terminal.
- O JSON retornado pela IA e normalizado e validado pelo backend antes de salvar.
