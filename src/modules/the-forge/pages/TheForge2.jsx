import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clapperboard,
  FileVideo,
  Loader,
  Mic,
  Play,
  Plus,
  RefreshCw,
  Save,
  Subtitles,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  createForge2Project,
  extractForge2Audio,
  forge2FileUrl,
  generateForge2Preview,
  generateForge2Srt,
  getForge2Health,
  getForge2Project,
  getLMStudioStatus,
  listForge2Projects,
  saveForge2Transcript,
  transcribeForge2Project,
  uploadForge2Source,
} from '../services/forge2Api';
import '../styles/the-forge-2.css';

const STEP_LABELS = {
  draft: 'Projeto criado',
  source_uploaded: 'Vídeo enviado',
  audio_extracted: 'Áudio extraído',
  transcribed: 'Transcrição pronta',
  captioned: 'SRT gerado',
  preview_ready: 'Prévia pronta',
  error: 'Erro',
};

function formatBytes(value = 0) {
  if (!value) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(seconds = 0) {
  if (!seconds) return '-';
  const safe = Math.round(seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function TheForge2() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectData, setProjectData] = useState(null);
  const [title, setTitle] = useState('Novo vídeo longo');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [srtText, setSrtText] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [lmStatus, setLmStatus] = useState(null);
  const [apiHealth, setApiHealth] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const project = projectData?.project || null;
  const editPlan = projectData?.edit_plan || {};
  const sourceVideo = project?.source_video || null;
  const canUseProject = Boolean(project?.id);

  const statusSteps = useMemo(() => [
    'draft',
    'source_uploaded',
    'audio_extracted',
    'transcribed',
    'captioned',
    'preview_ready',
  ], []);

  const currentStepIndex = Math.max(0, statusSteps.indexOf(project?.status || 'draft'));

  const runAction = async (label, action) => {
    setBusyAction(label);
    setError('');
    setMessage('');
    try {
      const result = await action();
      return result;
    } catch (err) {
      setError(err.message || 'Falha no The Forge 2.0');
      return null;
    } finally {
      setBusyAction('');
    }
  };

  const refreshProjects = async () => {
    const data = await listForge2Projects();
    setProjects(data.projects || []);
    return data.projects || [];
  };

  const loadProject = async (projectId) => {
    if (!projectId) return;
    const data = await getForge2Project(projectId);
    setSelectedProjectId(projectId);
    setProjectData(data);
    setTranscriptText(data.edit_plan?.transcript?.text || '');
    setPreviewUrl(data.project?.preview_path
      ? forge2FileUrl(`/api/forge2/projects/${projectId}/files/previews/${data.project.preview_path.split(/[\\/]/).pop()}`)
      : '');
  };

  useEffect(() => {
    const loadInitial = async () => {
      await runAction('initial-load', async () => {
        const [health, lm, list] = await Promise.all([
          getForge2Health(),
          getLMStudioStatus(),
          refreshProjects(),
        ]);
        setApiHealth(health);
        setLmStatus(lm);
        if (list[0]?.id) {
          await loadProject(list[0].id);
        }
      });
    };

    loadInitial();
  }, []);

  const handleCreateProject = async () => {
    await runAction('create', async () => {
      const data = await createForge2Project({ title, description });
      setProjectData(data);
      setSelectedProjectId(data.project.id);
      setTranscriptText('');
      setSrtText('');
      setPreviewUrl('');
      await refreshProjects();
      setMessage('Projeto criado no The Forge 2.0');
    });
  };

  const handleUpload = async () => {
    if (!canUseProject || !selectedFile) {
      setError('Crie um projeto e selecione um vídeo longo primeiro.');
      return;
    }
    await runAction('upload', async () => {
      const data = await uploadForge2Source(project.id, selectedFile);
      setProjectData({ project: data.project, edit_plan: editPlan });
      await loadProject(project.id);
      await refreshProjects();
      setMessage('Vídeo enviado e analisado com FFprobe.');
    });
  };

  const handleExtractAudio = async () => {
    if (!canUseProject) return;
    await runAction('audio', async () => {
      const data = await extractForge2Audio(project.id);
      setProjectData((current) => ({ ...current, project: data.project }));
      await refreshProjects();
      setMessage('Áudio extraído com FFmpeg.');
    });
  };

  const handleTranscribe = async () => {
    if (!canUseProject) return;
    await runAction('transcribe', async () => {
      const data = await transcribeForge2Project(project.id);
      setProjectData((current) => ({
        ...current,
        project: data.project,
        edit_plan: {
          ...(current?.edit_plan || {}),
          transcript: data.transcript,
          captions: data.transcript?.segments || [],
        },
      }));
      setTranscriptText(data.transcript?.text || '');
      await refreshProjects();
      setMessage('Transcrição gerada com faster-whisper.');
    });
  };

  const handleSaveTranscript = async () => {
    if (!canUseProject) return;
    await runAction('save-transcript', async () => {
      const data = await saveForge2Transcript(project.id, transcriptText);
      setProjectData((current) => ({
        ...current,
        project: data.project,
        edit_plan: {
          ...(current?.edit_plan || {}),
          transcript: data.transcript,
          captions: data.transcript?.segments || [],
        },
      }));
      setMessage('Transcrição revisada e salva.');
    });
  };

  const handleGenerateSrt = async () => {
    if (!canUseProject) return;
    await runAction('srt', async () => {
      const data = await generateForge2Srt(project.id);
      setProjectData((current) => ({ ...current, project: data.project }));
      setSrtText(data.srt || '');
      await refreshProjects();
      setMessage('Arquivo SRT gerado.');
    });
  };

  const handleGeneratePreview = async () => {
    if (!canUseProject) return;
    await runAction('preview', async () => {
      const data = await generateForge2Preview(project.id);
      setProjectData((current) => ({ ...current, project: data.project }));
      setPreviewUrl(forge2FileUrl(data.preview_url));
      await refreshProjects();
      setMessage('Prévia legendada criada.');
    });
  };

  const refreshLMStudio = async () => {
    await runAction('lm-status', async () => {
      setLmStatus(await getLMStudioStatus());
    });
  };

  return (
    <div className="forge2-page">
      <header className="forge2-header">
        <div>
          <span className="forge2-kicker">Editor privado de vídeos longos</span>
          <h1>The Forge 2.0</h1>
          <p>Fluxo isolado para vídeo longo, transcrição, legendas, análise por IA local e prévia renderizada.</p>
        </div>
        <div className="forge2-status-card">
          <span>API</span>
          <strong>{apiHealth?.status === 'operational' ? 'Online' : 'Verificando'}</strong>
          <small>{apiHealth?.phase || 'fase 1'}</small>
        </div>
      </header>

      <section className="forge2-grid">
        <aside className="forge2-panel forge2-projects">
          <div className="forge2-panel-header">
            <h2>Projetos</h2>
            <button type="button" onClick={() => runAction('refresh', refreshProjects)} disabled={Boolean(busyAction)}>
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="forge2-create-box">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nome do projeto" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição opcional" rows={3} />
            <button type="button" onClick={handleCreateProject} disabled={Boolean(busyAction) || !title.trim()}>
              <Plus size={16} />
              Criar projeto
            </button>
          </div>

          <div className="forge2-project-list">
            {projects.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === selectedProjectId ? 'active' : ''}
                onClick={() => runAction('load-project', () => loadProject(item.id))}
              >
                <strong>{item.title}</strong>
                <span>{STEP_LABELS[item.status] || item.status}</span>
                <small>{item.duration ? formatDuration(item.duration) : item.resolution || item.id}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="forge2-workspace">
          <section className="forge2-panel">
            <div className="forge2-panel-header">
              <h2>{project?.title || 'Nenhum projeto selecionado'}</h2>
              <span className={`forge2-badge ${project?.status === 'error' ? 'error' : ''}`}>
                {STEP_LABELS[project?.status] || 'Aguardando'}
              </span>
            </div>

            <div className="forge2-steps">
              {statusSteps.map((step, index) => (
                <div key={step} className={index <= currentStepIndex ? 'done' : ''}>
                  <CheckCircle2 size={16} />
                  <span>{STEP_LABELS[step]}</span>
                </div>
              ))}
            </div>

            <div className="forge2-upload-row">
              <label className="forge2-file-input">
                <FileVideo size={20} />
                <span>{selectedFile ? selectedFile.name : 'Selecionar vídeo longo'}</span>
                <input
                  type="file"
                  accept="video/*,.mp4,.mov,.m4v,.mkv,.webm,.avi"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
              </label>
              <button type="button" onClick={handleUpload} disabled={!canUseProject || !selectedFile || Boolean(busyAction)}>
                <Upload size={16} />
                Enviar vídeo
              </button>
            </div>

            {sourceVideo && (
              <div className="forge2-metadata-grid">
                <div><span>Duração</span><strong>{formatDuration(sourceVideo.duration)}</strong></div>
                <div><span>Resolução</span><strong>{sourceVideo.width}x{sourceVideo.height}</strong></div>
                <div><span>Vídeo</span><strong>{sourceVideo.video_codec || '-'}</strong></div>
                <div><span>Áudio</span><strong>{sourceVideo.audio_codec || '-'}</strong></div>
                <div><span>Tamanho</span><strong>{formatBytes(sourceVideo.size_bytes)}</strong></div>
                <div><span>Formato</span><strong>{sourceVideo.format_name || '-'}</strong></div>
              </div>
            )}
          </section>

          <section className="forge2-action-grid">
            <button type="button" onClick={handleExtractAudio} disabled={!sourceVideo || Boolean(busyAction)}>
              <Mic size={18} />
              Extrair áudio
            </button>
            <button type="button" onClick={handleTranscribe} disabled={!sourceVideo || Boolean(busyAction)}>
              <Wand2 size={18} />
              Transcrever
            </button>
            <button type="button" onClick={handleGenerateSrt} disabled={!transcriptText || Boolean(busyAction)}>
              <Subtitles size={18} />
              Gerar SRT
            </button>
            <button type="button" onClick={handleGeneratePreview} disabled={!transcriptText || Boolean(busyAction)}>
              <Play size={18} />
              Gerar prévia
            </button>
          </section>

          <section className="forge2-panel">
            <div className="forge2-panel-header">
              <h2>Transcrição</h2>
              <button type="button" onClick={handleSaveTranscript} disabled={!transcriptText || Boolean(busyAction)}>
                <Save size={16} />
                Salvar revisão
              </button>
            </div>
            <textarea
              className="forge2-transcript"
              value={transcriptText}
              onChange={(event) => setTranscriptText(event.target.value)}
              placeholder="A transcrição aparecerá aqui após executar faster-whisper."
            />
          </section>

          <section className="forge2-two-columns">
            <div className="forge2-panel">
              <div className="forge2-panel-header">
                <h2>Legenda SRT</h2>
                <span>{project?.srt_path ? 'Gerado' : 'Pendente'}</span>
              </div>
              <pre className="forge2-srt-preview">{srtText || 'Gere o SRT para visualizar as legendas sincronizadas.'}</pre>
            </div>

            <div className="forge2-panel">
              <div className="forge2-panel-header">
                <h2>Prévia</h2>
                <span>{previewUrl ? 'Disponível' : 'Pendente'}</span>
              </div>
              {previewUrl ? (
                <video src={previewUrl} controls className="forge2-preview-video" />
              ) : (
                <div className="forge2-empty-preview">
                  <Clapperboard size={36} />
                  <span>A prévia legendada será exibida aqui.</span>
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="forge2-panel forge2-ai-panel">
          <div className="forge2-panel-header">
            <h2>LM Studio</h2>
            <button type="button" onClick={refreshLMStudio} disabled={Boolean(busyAction)}>
              <RefreshCw size={16} />
            </button>
          </div>
          <div className={`forge2-lm-status ${lmStatus?.online ? 'online' : 'offline'}`}>
            <strong>{lmStatus?.online ? 'Conectado' : 'Offline'}</strong>
            <span>{lmStatus?.configured_url || 'http://127.0.0.1:1234'}</span>
            <small>{lmStatus?.detail || 'Aguardando verificação'}</small>
          </div>
          <div className="forge2-plan-summary">
            <h3>Plano de edição</h3>
            <span>Capítulos: {editPlan.chapters?.length || 0}</span>
            <span>Cortes: {editPlan.cuts?.length || 0}</span>
            <span>Inserções: {editPlan.media_insertions?.length || 0}</span>
            <span>Avatar: {editPlan.avatar_segments?.length || 0}</span>
          </div>
          <div className="forge2-phase-note">
            <strong>Fase 1</strong>
            <p>Upload, FFprobe, áudio, transcrição, SRT e prévia. Timeline, avatar e trailer ficam para a próxima fase.</p>
          </div>
        </aside>
      </section>

      {(busyAction || error || message) && (
        <div className={`forge2-toast ${error ? 'error' : ''}`}>
          {busyAction && <Loader size={16} className="spinner" />}
          <span>{error || message || 'Processando...'}</span>
        </div>
      )}
    </div>
  );
}

export default TheForge2;
