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
```

## Instalar dependencias

No backend:

```bash
pip install -r requirements.txt
```

Dependencia nova:

```txt
faster-whisper>=1.1.1
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

## Seguranca

- Nao usa `shell=True`.
- FFmpeg/FFprobe sao chamados com lista de argumentos.
- IDs de projeto sao validados.
- Caminhos ficam restritos a `storage/forge/projects`.
- Upload bloqueia path traversal.
- Extensoes de video sao validadas.
- Tamanho maximo de upload e configuravel.
- LM Studio deve ficar apenas local.
- O modelo nao pode retornar nem executar comandos de terminal.
- O JSON retornado pela IA e normalizado e validado pelo backend antes de salvar.
