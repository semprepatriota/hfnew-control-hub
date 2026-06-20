import React, { useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  ChevronDown,
  ChevronUp,
  Film,
  FolderOpen,
  Layers3,
  Loader,
  Plus,
  Play,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  createForgeMaxProject,
  deleteForgeMaxVideo,
  forgeMaxFileUrl,
  getForgeMaxHealth,
  getForgeMaxProject,
  listForgeMaxProjects,
  uploadForgeMaxVideo,
  updateForgeMaxTimeline,
} from '../services/forgeMaxApi';
import ForgeMaxTimeline from '../components/ForgeMaxTimeline';
import './forge-max-3.css';

const MAX_LIBRARY_ITEMS = 20;

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Carregando...';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function ForgeMax3() {
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [newProjectTitle, setNewProjectTitle] = useState('Projeto Forge Max');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedTimelineClipId, setSelectedTimelineClipId] = useState('');
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [structureCollapsed, setStructureCollapsed] = useState(false);
  const inputRef = useRef(null);
  const previewVideoRef = useRef(null);

  const assets = project?.assets || [];
  const selectedAsset = assets.find((item) => item.id === selectedAssetId) || null;
  const timelineClips = project?.timeline?.clips || [];
  const selectedTimelineClip = timelineClips.find((item) => item.id === selectedTimelineClipId) || null;
  const previewAsset = selectedTimelineClip
    ? assets.find((item) => item.id === selectedTimelineClip.asset_id) || selectedAsset
    : selectedAsset;
  const maxLibraryItems = health?.max_library_assets || MAX_LIBRARY_ITEMS;
  const availableSlots = Math.max(maxLibraryItems - assets.length, 0);

  const runAction = async (label, action) => {
    setBusy(label);
    setError('');
    setMessage('');
    try {
      return await action();
    } catch (err) {
      setError(err.message || 'Falha no Forge Max 3.0');
      return null;
    } finally {
      setBusy('');
    }
  };

  const loadProject = async (projectId) => {
    if (!projectId) return;
    const data = await getForgeMaxProject(projectId);
    setProject(data);
    setSelectedAssetId((current) => data.assets.some((asset) => asset.id === current) ? current : (data.assets[0]?.id || ''));
    setSelectedTimelineClipId((current) => data.timeline?.clips?.some((clip) => clip.id === current) ? current : '');
  };

  const refreshProjects = async () => {
    const data = await listForgeMaxProjects();
    setProjects(data.projects || []);
    return data.projects || [];
  };

  useEffect(() => {
    runAction('bootstrap', async () => {
      const [healthData, projectList] = await Promise.all([getForgeMaxHealth(), refreshProjects()]);
      setHealth(healthData);
      if (projectList[0]?.project?.id) {
        await loadProject(projectList[0].project.id);
      }
    });
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return;
    await runAction('create-project', async () => {
      const created = await createForgeMaxProject(newProjectTitle.trim());
      setProject(created);
      setSelectedAssetId('');
      setSelectedTimelineClipId('');
      await refreshProjects();
      setMessage('Projeto Forge Max criado. Agora envie até 20 vídeos para a biblioteca.');
    });
  };

  const handleFiles = async (event) => {
    const incoming = Array.from(event.target.files || []).filter((file) => (
      file.type.startsWith('video/') || /\.(mp4|mov|m4v|mkv|webm|avi)$/i.test(file.name)
    ));
    if (!incoming.length || !availableSlots || !project?.project?.id) return;
    event.target.value = '';
    await runAction('upload-library', async () => {
      let updated = project;
      for (const file of incoming.slice(0, availableSlots)) {
        updated = await uploadForgeMaxVideo(project.project.id, file);
      }
      setProject(updated);
      setSelectedAssetId((current) => current || updated.assets[0]?.id || '');
      await refreshProjects();
      setMessage(`${incoming.slice(0, availableSlots).length} vídeo(s) salvo(s) na biblioteca do projeto.`);
    });
  };

  const removeAsset = async (assetId) => {
    if (!project?.project?.id) return;
    await runAction('delete-asset', async () => {
      const updated = await deleteForgeMaxVideo(project.project.id, assetId);
      setProject(updated);
      setSelectedAssetId((current) => (current === assetId ? (updated.assets[0]?.id || '') : current));
      setSelectedTimelineClipId((current) => updated.timeline?.clips?.some((clip) => clip.id === current) ? current : '');
      await refreshProjects();
      setMessage('Vídeo removido da biblioteca do projeto.');
    });
  };

  const saveTimeline = async (nextClips, successMessage) => {
    if (!project?.project?.id) return;
    await runAction('save-timeline', async () => {
      const updated = await updateForgeMaxTimeline(
        project.project.id,
        nextClips.map((clip) => ({
          id: clip.id,
          asset_id: clip.asset_id,
          start_seconds: Number(clip.start_seconds) || 0,
          end_seconds: Number(clip.end_seconds) || 0,
        })),
      );
      setProject(updated);
      setSelectedTimelineClipId((current) => updated.timeline?.clips?.some((clip) => clip.id === current)
        ? current
        : (updated.timeline?.clips?.[0]?.id || ''));
      setMessage(successMessage);
    });
  };

  const addSelectedToTimeline = async () => {
    if (!selectedAsset) {
      setError('Selecione um vídeo da biblioteca antes de adicionar à timeline.');
      return;
    }
    await saveTimeline([
      ...timelineClips,
      { asset_id: selectedAsset.id, start_seconds: 0, end_seconds: selectedAsset.duration },
    ], 'Vídeo adicionado à timeline.');
  };

  const updateTimelineClip = async (clipId, values) => {
    await saveTimeline(
      timelineClips.map((clip) => (clip.id === clipId ? { ...clip, ...values } : clip)),
      'Corte da timeline salvo.',
    );
  };

  const moveTimelineClip = async (clipId, direction) => {
    const index = timelineClips.findIndex((clip) => clip.id === clipId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= timelineClips.length) return;
    const next = [...timelineClips];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    await saveTimeline(next, 'Ordem da timeline atualizada.');
  };

  const removeTimelineClip = async (clipId) => {
    await saveTimeline(timelineClips.filter((clip) => clip.id !== clipId), 'Clipe removido da timeline.');
  };

  const selectTimelineClip = (clip) => {
    setSelectedTimelineClipId(clip.id);
    setSelectedAssetId(clip.asset_id);
  };

  const handlePreviewLoaded = (event) => {
    if (!selectedTimelineClip) return;
    event.currentTarget.currentTime = Math.min(selectedTimelineClip.start_seconds, event.currentTarget.duration || 0);
  };

  const handlePreviewTimeUpdate = (event) => {
    if (!selectedTimelineClip || event.currentTarget.currentTime < selectedTimelineClip.end_seconds) return;
    event.currentTarget.pause();
    event.currentTarget.currentTime = selectedTimelineClip.start_seconds;
  };

  const handleHoverStart = (event) => {
    event.currentTarget.play().catch(() => {});
  };

  const handleHoverEnd = (event) => {
    event.currentTarget.pause();
    event.currentTarget.currentTime = 0;
  };

  return (
    <div className="forge-max-page">
      <header className="forge-max-header">
        <div>
          <span className="forge-max-kicker">EDITOR AVANÇADO · FASE 1</span>
          <h1>Forge Max 3.0</h1>
          <p>Biblioteca de alta resolução e preview vertical isolado dos outros módulos de edição.</p>
        </div>
        <div className="forge-max-header-status">
          <span>Biblioteca</span>
          <strong>{assets.length}/{maxLibraryItems}</strong>
          <small>vídeos no projeto</small>
        </div>
      </header>

      <section className="forge-max-project-bar">
        <label>
          <span>Projeto ativo</span>
          <select value={project?.project?.id || ''} onChange={(event) => runAction('load-project', () => loadProject(event.target.value))} disabled={Boolean(busy)}>
            <option value="">Selecione um projeto</option>
            {projects.map((item) => <option key={item.project.id} value={item.project.id}>{item.project.title}</option>)}
          </select>
        </label>
        <label className="forge-max-new-project">
          <span>Novo projeto</span>
          <input value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} maxLength={140} />
        </label>
        <button type="button" onClick={handleCreateProject} disabled={!newProjectTitle.trim() || Boolean(busy)}><Plus size={16} /> Criar projeto</button>
        <button type="button" className="forge-max-refresh" onClick={() => runAction('refresh-projects', refreshProjects)} disabled={Boolean(busy)} aria-label="Atualizar projetos"><RefreshCw size={16} /></button>
      </section>

      <section className="forge-max-workspace">
        <section className={`forge-max-panel forge-max-library-panel ${libraryCollapsed ? 'collapsed' : ''}`}>
          <div className="forge-max-panel-header">
            <div>
              <span className="forge-max-section-icon"><FolderOpen size={17} /></span>
              <h2>Biblioteca de Vídeos</h2>
              <p>Até {maxLibraryItems} clipes. Passe o mouse para revisar antes de selecionar.</p>
            </div>
            <div className="forge-max-panel-actions">
              <label className={`forge-max-upload ${availableSlots && project ? '' : 'disabled'}`}>
                <Upload size={16} />
                Adicionar vídeos
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  disabled={!availableSlots || !project || Boolean(busy)}
                  onChange={handleFiles}
                />
              </label>
              <button type="button" className="forge-max-collapse" onClick={() => setLibraryCollapsed((current) => !current)} aria-label={libraryCollapsed ? 'Abrir biblioteca' : 'Recolher biblioteca'}>
                {libraryCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
              </button>
            </div>
          </div>

          {!libraryCollapsed && (
            !assets.length ? (
              <div className="forge-max-library-empty">
                <Film size={30} />
                <strong>Nenhum vídeo selecionado</strong>
                <span>Adicione vídeos para montar a biblioteca do projeto.</span>
              </div>
            ) : (
              <div className="forge-max-library-grid">
                {assets.map((asset, index) => (
                  <article key={asset.id} className={`forge-max-library-card ${asset.id === selectedAssetId ? 'selected' : ''}`}>
                    <button type="button" className="forge-max-library-preview" onClick={() => {
                      setSelectedAssetId(asset.id);
                      setSelectedTimelineClipId('');
                    }}>
                      <video
                        src={forgeMaxFileUrl(asset.url)}
                        muted
                        playsInline
                        preload="metadata"
                        onMouseEnter={handleHoverStart}
                        onMouseLeave={handleHoverEnd}
                      />
                      <span className="forge-max-card-index">{String(index + 1).padStart(2, '0')}</span>
                      {asset.id === selectedAssetId && <span className="forge-max-card-selected">Selecionado</span>}
                      <span className="forge-max-card-play"><Play size={15} fill="currentColor" /></span>
                    </button>
                    <div className="forge-max-card-meta">
                      <strong title={asset.filename}>{asset.filename}</strong>
                      <span>{asset.width ? `${asset.width}×${asset.height}` : 'Detectando'} · {formatDuration(asset.duration)}</span>
                    </div>
                    <button type="button" className="forge-max-card-delete" onClick={() => removeAsset(asset.id)} disabled={Boolean(busy)} aria-label={`Excluir ${asset.filename}`} title="Excluir da biblioteca">
                      <X size={15} />
                    </button>
                  </article>
                ))}
              </div>
            )
          )}
        </section>

        <section className="forge-max-panel forge-max-preview-panel">
          <div className="forge-max-panel-header">
            <div>
              <span className="forge-max-section-icon"><Clapperboard size={17} /></span>
              <h2>Preview de Edição</h2>
              <p>Palco fixo 9:16, igual ao The Forge 2.0.</p>
            </div>
            <span className="forge-max-vertical-badge">9:16 vertical</span>
          </div>

          <div className="forge-max-preview-stage">
            {previewAsset ? (
              <video
                ref={previewVideoRef}
                src={forgeMaxFileUrl(previewAsset.url)}
                controls
                playsInline
                className="forge-max-preview-video"
                onLoadedMetadata={handlePreviewLoaded}
                onTimeUpdate={handlePreviewTimeUpdate}
              />
            ) : (
              <div className="forge-max-preview-empty">
                <Layers3 size={38} />
                <strong>Selecione um vídeo da biblioteca</strong>
                <span>O corte, a timeline e os overlays entram nas próximas fases.</span>
              </div>
            )}
          </div>
          <div className="forge-max-preview-caption">
            <span>{selectedTimelineClip ? `Trecho ${formatDuration(selectedTimelineClip.start_seconds)} - ${formatDuration(selectedTimelineClip.end_seconds)}` : 'Prévia vertical protegida'}</span>
            <strong>{previewAsset?.filename || 'Nenhum clipe selecionado'}</strong>
          </div>
          <button type="button" className="forge-max-add-timeline" onClick={addSelectedToTimeline} disabled={!selectedAsset || Boolean(busy)}>
            <Plus size={16} /> Adicionar selecionado à timeline
          </button>
        </section>

        <section className={`forge-max-panel forge-max-roadmap-panel ${structureCollapsed ? 'collapsed' : ''}`}>
          <div className="forge-max-panel-header">
            <div>
              <span className="forge-max-section-icon"><Layers3 size={17} /></span>
              <h2>Estrutura da Edição</h2>
              <p>Esta fase não altera renderização nem APIs existentes.</p>
            </div>
            <button type="button" className="forge-max-collapse" onClick={() => setStructureCollapsed((current) => !current)} aria-label={structureCollapsed ? 'Abrir estrutura de edição' : 'Recolher estrutura de edição'}>
              {structureCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
            </button>
          </div>
          {!structureCollapsed && (
            <>
              <div className="forge-max-track-list">
                <span><b>V1</b> Vídeos principais</span>
                <span><b>V2</b> União de clipes</span>
                <span><b>V3</b> Imagens e B-roll</span>
                <span><b>V4</b> GIFs e overlays</span>
                <span><b>TXT</b> Títulos e textos</span>
                <span><b>SUB</b> Legendas sincronizadas</span>
                <span><b>A1</b> Áudio original</span>
                <span><b>A2</b> Música de fundo</span>
              </div>
              <div className="forge-max-phase-note">
                <Trash2 size={16} />
                <span>Nada é enviado ou renderizado nesta fase. A biblioteca é visual e local ao navegador.</span>
              </div>
            </>
          )}
        </section>
      </section>

      {(busy || error || message) && (
        <div className={`forge-max-toast ${error ? 'error' : ''}`}>
          {busy && <Loader size={16} className="forge-max-spin" />}
          <span>{error || message || 'Processando...'}</span>
        </div>
      )}
    </div>
  );
}

export default ForgeMax3;
