import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clapperboard,
  FileVideo,
  Film,
  ImagePlus,
  Loader,
  Mic,
  Play,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Subtitles,
  Upload,
  UserRound,
  Wand2,
  X,
} from 'lucide-react';
import {
  analyzeForge2Project,
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
  setForge2PlanItemApproval,
  transcribeForge2Project,
  uploadForge2Source,
} from '../services/forge2Api';
import '../styles/the-forge-2.css';

const STEP_LABELS = {
  draft: 'Projeto criado',
  source_uploaded: 'Vídeo enviado',
  audio_extracted: 'Áudio extraído',
  transcribed: 'Transcrição pronta',
  analyzing: 'Analisando',
  plan_ready: 'Plano pronto',
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

function formatTimestamp(seconds = 0) {
  if (!Number.isFinite(Number(seconds))) return '00:00';
  const safe = Math.max(0, Math.round(Number(seconds)));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function PlanList({ title, icon: Icon, items, section, empty, onDecision, busy }) {
  return (
    <div className="forge2-plan-list">
      <div className="forge2-plan-list-header">
        <Icon size={18} />
        <h3>{title}</h3>
        <span>{items?.length || 0}</span>
      </div>
      {items?.length ? items.map((item, index) => (
        <article key={item.id || index} className={`forge2-plan-item ${item.approved ? 'approved' : ''}`}>
          <div>
            <strong>{item.title || item.prompt || item.script || `Item ${index + 1}`}</strong>
            <span>
              {item.timestamp !== undefined
                ? formatTimestamp(item.timestamp)
                : `${formatTimestamp(item.start)} - ${formatTimestamp(item.end)}`}
            </span>
          </div>
          <p>{item.summary || item.reason || item.description || item.prompt || item.script || 'Sem descrição.'}</p>
          <div className="forge2-plan-actions">
            <button type="button" onClick={() => onDecision(section, item.id || String(index), true)} disabled={busy}>
              <Check size={15} />
              Aprovar
            </button>
            <button type="button" onClick={() => onDecision(section, item.id || String(index), false)} disabled={busy}>
              <X size={15} />
              Rejeitar
            </button>
          </div>
        </article>
      )) : (
        <div className="forge2-plan-empty">{empty}</div>
      )}
    </div>
  );
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
    'plan_ready',
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

  const handleAnalyzePlan = async () => {
    if (!canUseProject || !transcriptText) {
      setError('Gere ou salve uma transcrição antes de analisar o vídeo.');
      return;
    }
    await runAction('analyze', async () => {
      const data = await analyzeForge2Project(project.id);
      setProjectData(data);
      await refreshProjects();
      setMessage(data.edit_plan?.analysis?.source === 'lm_studio'
        ? 'Plano de edição gerado pelo LM Studio.'
        : 'Plano de edição gerado com fallback local.');
    });
  };

  const handlePlanDecision = async (section, itemId, approved) => {
    if (!canUseProject) return;
    await runAction('plan-decision', async () => {
      const data = await setForge2PlanItemApproval(project.id, section, itemId, approved);
      setProjectData(data);
      setMessage(approved ? 'Sugestão aprovada.' : 'Sugestão rejeitada.');
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
            <button type="button" onClick={handleAnalyzePlan} disabled={!transcriptText || Boolean(busyAction)}>
              <Film size={18} />
              Analisar plano
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

          <section className="forge2-panel forge2-plan-board">
            <div className="forge2-panel-header">
              <div>
                <h2>Plano de edição</h2>
                <span className="forge2-panel-subtitle">
                  IA local para resumo, capítulos, cortes, mídia, avatar e trailer.
                </span>
              </div>
              <button type="button" onClick={handleAnalyzePlan} disabled={!transcriptText || Boolean(busyAction)}>
                <Wand2 size={16} />
                Analisar novamente
              </button>
            </div>

            <div className="forge2-summary-box">
              <strong>Resumo</strong>
              <p>{editPlan.summary || 'Execute a análise para gerar o plano do vídeo longo.'}</p>
              {editPlan.analysis?.source && (
                <small>
                  Origem: {editPlan.analysis.source === 'lm_studio' ? 'LM Studio' : 'Fallback local'} · {editPlan.analysis.detail}
                </small>
              )}
            </div>

            <div className="forge2-plan-grid">
              <PlanList
                title="Capítulos"
                icon={Clapperboard}
                items={editPlan.chapters || []}
                section="chapters"
                empty="Nenhum capítulo gerado ainda."
                onDecision={handlePlanDecision}
                busy={Boolean(busyAction)}
              />
              <PlanList
                title="Cortes"
                icon={Scissors}
                items={editPlan.cuts || []}
                section="cuts"
                empty="Nenhum corte sugerido ainda."
                onDecision={handlePlanDecision}
                busy={Boolean(busyAction)}
              />
              <PlanList
                title="Mídias"
                icon={ImagePlus}
                items={editPlan.media_insertions || []}
                section="media_insertions"
                empty="Nenhum ponto de mídia sugerido ainda."
                onDecision={handlePlanDecision}
                busy={Boolean(busyAction)}
              />
              <PlanList
                title="Avatar"
                icon={UserRound}
                items={editPlan.avatar_segments || []}
                section="avatar_segments"
                empty="Nenhum trecho de avatar sugerido ainda."
                onDecision={handlePlanDecision}
                busy={Boolean(busyAction)}
              />
            </div>

            <div className="forge2-trailer-box">
              <div>
                <Film size={18} />
                <strong>{editPlan.trailer_plan?.title || 'Trailer automático'}</strong>
                <span>{editPlan.trailer_plan?.estimated_duration ? `${editPlan.trailer_plan.estimated_duration}s` : 'pendente'}</span>
              </div>
              <p>{editPlan.trailer_plan?.hook || 'O roteiro do trailer aparecerá após a análise.'}</p>
              <div className="forge2-trailer-beats">
                {(editPlan.trailer_plan?.beats || []).map((beat, index) => (
                  <span key={beat.id || index}>
                    {formatTimestamp(beat.start)} - {formatTimestamp(beat.end)} · {beat.description}
                  </span>
                ))}
              </div>
            </div>
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
            <strong>Editor privado</strong>
            <p>Upload, transcrição, SRT, prévia e plano de edição revisável. Timeline avançada e render final completo ficam isolados para a próxima etapa.</p>
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
