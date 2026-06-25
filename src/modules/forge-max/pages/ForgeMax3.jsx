import React, { useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  ChevronDown,
  ChevronUp,
  Download,
  Film,
  FolderOpen,
  Layers3,
  Loader,
  Music4,
  Scissors,
  Plus,
  Play,
  RefreshCw,
  Trash,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  createForgeMaxProject,
  deleteForgeMaxMusic,
  deleteForgeMaxProject,
  deleteForgeMaxVideo,
  forgeMaxFileUrl,
  getForgeMaxHealth,
  getForgeMaxProject,
  listForgeMaxProjects,
  renderForgeMaxTimeline,
  updateForgeMaxMusic,
  uploadForgeMaxMusic,
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
  const [musicCollapsed, setMusicCollapsed] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const inputRef = useRef(null);
  const musicInputRef = useRef(null);
  const previewVideoRef = useRef(null);

  const assets = project?.assets || [];
  const musicTracks = project?.music_tracks || [];
  const musicConfig = project?.music || { active_music_id: '', volume: 0.35 };
  const selectedAsset = assets.find((item) => item.id === selectedAssetId) || null;
  const timelineClips = project?.timeline?.clips || [];
  const lastRender = project?.last_render || null;
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
    const nextSelectedTimelineClipId = data.timeline?.clips?.[0]?.id || '';
    const nextSelectedAssetId = nextSelectedTimelineClipId
      ? (data.timeline?.clips?.[0]?.asset_id || data.assets[0]?.id || '')
      : (data.assets[0]?.id || '');
    setProject(data);
    setSelectedTimelineClipId((current) => (
      data.timeline?.clips?.some((clip) => clip.id === current)
        ? current
        : nextSelectedTimelineClipId
    ));
    setSelectedAssetId((current) => (
      data.assets.some((asset) => asset.id === current)
        ? current
        : nextSelectedAssetId
    ));
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

  useEffect(() => {
    const player = previewVideoRef.current;
    if (!player || !previewAsset) return;

    const syncClipPreview = () => {
      if (selectedTimelineClip) {
        const nextTime = Math.min(selectedTimelineClip.start_seconds, player.duration || selectedTimelineClip.start_seconds || 0);
        player.currentTime = nextTime;
        setPreviewCurrentTime(nextTime);
        return;
      }
      player.currentTime = 0;
      setPreviewCurrentTime(0);
    };

    if (player.readyState >= 1) {
      syncClipPreview();
      return;
    }

    player.addEventListener('loadedmetadata', syncClipPreview, { once: true });
    return () => player.removeEventListener('loadedmetadata', syncClipPreview);
  }, [previewAsset?.url, selectedTimelineClip?.id, selectedTimelineClip?.start_seconds]);

  const previewRangeMin = selectedTimelineClip ? Number(selectedTimelineClip.start_seconds) || 0 : 0;
  const previewRangeMax = selectedTimelineClip
    ? Math.max(Number(selectedTimelineClip.end_seconds) || 0, previewRangeMin + 0.1)
    : Math.max(Number(previewAsset?.duration) || 0, 0.1);

  const seekPreview = (nextTime) => {
    const player = previewVideoRef.current;
    if (!player) return;
    const bounded = Math.max(previewRangeMin, Math.min(previewRangeMax, Number(nextTime) || 0));
    player.currentTime = bounded;
    setPreviewCurrentTime(bounded);
  };

  const markPreviewBoundary = async (boundary) => {
    if (!selectedTimelineClip) {
      setError('Selecione um clipe da timeline antes de marcar o corte no preview.');
      return;
    }
    const current = Math.max(previewRangeMin, Math.min(previewRangeMax, Number(previewCurrentTime) || previewRangeMin));
    if (boundary === 'start') {
      await updateTimelineClip(selectedTimelineClip.id, { start_seconds: current });
      return;
    }
    await updateTimelineClip(selectedTimelineClip.id, { end_seconds: current });
  };

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

  const handleMusicFiles = async (event) => {
    const incoming = Array.from(event.target.files || []).filter((file) => (
      file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)
    ));
    if (!incoming.length || !project?.project?.id) return;
    event.target.value = '';
    await runAction('upload-music', async () => {
      let updated = project;
      for (const file of incoming) {
        updated = await uploadForgeMaxMusic(project.project.id, file);
      }
      setProject(updated);
      setMessage(`${incoming.length} faixa(s) salva(s) no projeto.`);
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
    const nextClips = [
      ...timelineClips,
      { asset_id: selectedAsset.id, start_seconds: 0, end_seconds: selectedAsset.duration },
    ];
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
      const newestClip = updated.timeline?.clips?.[updated.timeline.clips.length - 1];
      setSelectedTimelineClipId(newestClip?.id || updated.timeline?.clips?.[0]?.id || '');
      setSelectedAssetId(selectedAsset.id);
      setMessage('Vídeo adicionado à timeline.');
    });
  };

  const handleRenderTimeline = async () => {
    if (!project?.project?.id) return;
    await runAction('render-timeline', async () => {
      const render = await renderForgeMaxTimeline(project.project.id);
      await loadProject(project.project.id);
      setMessage(`Render concluído com ${render.clip_count || 0} clipes.`);
    });
  };

  const handleDeleteProject = async () => {
    if (!project?.project?.id) return;
    const confirmed = window.confirm(`Excluir o projeto "${project.project.title}"? Esta ação remove biblioteca e timeline.`);
    if (!confirmed) return;
    await runAction('delete-project', async () => {
      await deleteForgeMaxProject(project.project.id);
      const nextProjects = await refreshProjects();
      const nextProjectId = nextProjects[0]?.project?.id || '';
      if (nextProjectId) {
        await loadProject(nextProjectId);
      } else {
        setProject(null);
        setSelectedAssetId('');
        setSelectedTimelineClipId('');
      }
      setMessage('Projeto Forge Max excluído.');
    });
  };

  const handleMusicConfigChange = async (nextConfig) => {
    if (!project?.project?.id) return;
    await runAction('save-music', async () => {
      const updated = await updateForgeMaxMusic(project.project.id, {
        active_music_id: nextConfig.active_music_id ?? musicConfig.active_music_id ?? '',
        volume: nextConfig.volume ?? musicConfig.volume ?? 0.35,
      });
      setProject(updated);
      setMessage('Trilha de música atualizada.');
    });
  };

  const handleDeleteMusic = async (musicId) => {
    if (!project?.project?.id) return;
    await runAction('delete-music', async () => {
      const updated = await deleteForgeMaxMusic(project.project.id, musicId);
      setProject(updated);
      setMessage('Faixa removida do projeto.');
    });
  };

  const updateTimelineClip = async (clipId, values) => {
    const clip = timelineClips.find((item) => item.id === clipId);
    const asset = assets.find((item) => item.id === clip?.asset_id);
    if (!clip || !asset) return;

    const nextStartRaw = values.start_seconds !== undefined ? Number(values.start_seconds) : clip.start_seconds;
    const nextEndRaw = values.end_seconds !== undefined ? Number(values.end_seconds) : clip.end_seconds;
    const durationMax = Number(asset.duration) || 0;

    let nextStart = Number.isFinite(nextStartRaw) ? nextStartRaw : clip.start_seconds;
    let nextEnd = Number.isFinite(nextEndRaw) ? nextEndRaw : clip.end_seconds;
    nextStart = Math.max(0, Math.min(durationMax, nextStart));
    nextEnd = Math.max(0.1, Math.min(durationMax || nextEnd, nextEnd));
    if (nextEnd <= nextStart) {
      if (values.start_seconds !== undefined) {
        nextEnd = Math.min(durationMax || nextStart + 0.1, nextStart + 0.1);
      } else {
        nextStart = Math.max(0, nextEnd - 0.1);
      }
    }

    await saveTimeline(
      timelineClips.map((item) => (item.id === clipId ? {
        ...item,
        start_seconds: nextStart,
        end_seconds: nextEnd,
      } : item)),
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
    if (!selectedTimelineClip) {
      event.currentTarget.currentTime = 0;
      setPreviewCurrentTime(0);
      return;
    }
    const nextTime = Math.min(selectedTimelineClip.start_seconds, event.currentTarget.duration || 0);
    event.currentTarget.currentTime = nextTime;
    setPreviewCurrentTime(nextTime);
  };

  const handlePreviewTimeUpdate = (event) => {
    const current = event.currentTarget.currentTime;
    setPreviewCurrentTime(current);
    if (!selectedTimelineClip || current < selectedTimelineClip.end_seconds) return;
    event.currentTarget.pause();
    event.currentTarget.currentTime = selectedTimelineClip.start_seconds;
    setPreviewCurrentTime(selectedTimelineClip.start_seconds);
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
        <button type="button" className="forge-max-delete-project" onClick={handleDeleteProject} disabled={!project?.project?.id || Boolean(busy)} aria-label="Excluir projeto ativo">
          <Trash size={16} />
        </button>
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
              <>
                <video
                  ref={previewVideoRef}
                  src={forgeMaxFileUrl(previewAsset.url)}
                  controls
                  playsInline
                  className="forge-max-preview-video"
                  onLoadedMetadata={handlePreviewLoaded}
                  onTimeUpdate={handlePreviewTimeUpdate}
                />
                <div className="forge-max-preview-scrubber">
                  <div className="forge-max-preview-scrubber-meta">
                    <strong>{selectedTimelineClip ? 'Corte direto no preview' : 'Navegação do preview'}</strong>
                    <span>
                      {formatDuration(previewCurrentTime)} / {formatDuration(previewRangeMax)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={previewRangeMin}
                    max={previewRangeMax}
                    step="0.1"
                    value={Math.max(previewRangeMin, Math.min(previewRangeMax, previewCurrentTime))}
                    onChange={(event) => seekPreview(event.target.value)}
                  />
                  {selectedTimelineClip && (
                    <div className="forge-max-preview-cut-actions">
                      <button type="button" onClick={() => markPreviewBoundary('start')} disabled={Boolean(busy)}>
                        <Scissors size={14} /> Marcar início aqui
                      </button>
                      <button type="button" onClick={() => markPreviewBoundary('end')} disabled={Boolean(busy)}>
                        <Scissors size={14} /> Marcar fim aqui
                      </button>
                    </div>
                  )}
                </div>
              </>
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

      <section className={`forge-max-panel forge-max-music-panel ${musicCollapsed ? 'collapsed' : ''}`}>
        <div className="forge-max-panel-header">
          <div>
            <span className="forge-max-section-icon"><Music4 size={17} /></span>
            <h2>Trilha de Música</h2>
            <p>Selecione uma faixa extra para misturar no render final da timeline.</p>
          </div>
          <div className="forge-max-panel-actions">
            <label className={`forge-max-upload ${project ? '' : 'disabled'}`}>
              <Upload size={16} />
              Adicionar músicas
              <input
                ref={musicInputRef}
                type="file"
                accept="audio/*"
                multiple
                disabled={!project || Boolean(busy)}
                onChange={handleMusicFiles}
              />
            </label>
            <button type="button" className="forge-max-collapse" onClick={() => setMusicCollapsed((current) => !current)} aria-label={musicCollapsed ? 'Abrir trilha de música' : 'Recolher trilha de música'}>
              {musicCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
            </button>
          </div>
        </div>

        {!musicCollapsed && (
          <div className="forge-max-music-body">
            <div className="forge-max-music-config">
              <label>
                <span>Faixa ativa</span>
                <select
                  value={musicConfig.active_music_id || ''}
                  onChange={(event) => handleMusicConfigChange({ active_music_id: event.target.value })}
                  disabled={Boolean(busy) || !musicTracks.length}
                >
                  <option value="">Sem música extra</option>
                  {musicTracks.map((track) => (
                    <option key={track.id} value={track.id}>{track.filename}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Volume da música {Math.round((musicConfig.volume ?? 0.35) * 100)}%</span>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={musicConfig.volume ?? 0.35}
                  onChange={(event) => setProject((current) => current ? ({
                    ...current,
                    music: {
                      ...(current.music || {}),
                      volume: Number(event.target.value),
                    },
                  }) : current)}
                  onMouseUp={(event) => handleMusicConfigChange({ volume: Number(event.target.value) })}
                  onTouchEnd={(event) => handleMusicConfigChange({ volume: Number(event.target.value) })}
                  disabled={Boolean(busy)}
                />
              </label>
            </div>

            {!musicTracks.length ? (
              <div className="forge-max-music-empty">
                <strong>Nenhuma faixa adicionada</strong>
                <span>Suba MP3, WAV, M4A, AAC, OGG ou FLAC para usar música no render da timeline.</span>
              </div>
            ) : (
              <div className="forge-max-music-list">
                {musicTracks.map((track) => (
                  <article key={track.id} className={`forge-max-music-card ${track.id === musicConfig.active_music_id ? 'selected' : ''}`}>
                    <div className="forge-max-music-meta">
                      <strong title={track.filename}>{track.filename}</strong>
                      <span>{formatDuration(track.duration)} · {track.audio_codec || 'audio'}</span>
                    </div>
                    <audio controls preload="none" src={forgeMaxFileUrl(track.url)} className="forge-max-music-player" />
                    <div className="forge-max-music-actions">
                      <button type="button" onClick={() => handleMusicConfigChange({ active_music_id: track.id })} disabled={Boolean(busy)}>
                        {track.id === musicConfig.active_music_id ? 'Ativa' : 'Usar no render'}
                      </button>
                      <button type="button" className="forge-max-music-delete" onClick={() => handleDeleteMusic(track.id)} disabled={Boolean(busy)} aria-label={`Excluir ${track.filename}`}>
                        <X size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <ForgeMaxTimeline
        assets={assets}
        clips={timelineClips}
        selectedClipId={selectedTimelineClipId}
        busy={busy}
        onSelect={selectTimelineClip}
        onMove={moveTimelineClip}
        onRemove={removeTimelineClip}
        onTrim={updateTimelineClip}
      />

      <section className="forge-max-render-panel">
        <div className="forge-max-render-header">
          <div>
            <span className="forge-max-section-icon"><Clapperboard size={17} /></span>
            <h2>Render da Timeline</h2>
            <p>Primeiro núcleo da Fase 4: une os clipes da timeline em um MP4 vertical 9:16.</p>
          </div>
          <button
            type="button"
            className="forge-max-render-button"
            onClick={handleRenderTimeline}
            disabled={!project?.project?.id || !timelineClips.length || Boolean(busy)}
          >
            {busy === 'render-timeline' ? <Loader size={16} className="forge-max-spin" /> : <Clapperboard size={16} />}
            Renderizar timeline
          </button>
        </div>

        {lastRender ? (
          <div className="forge-max-render-result">
            <div className="forge-max-render-stage">
              <video
                src={forgeMaxFileUrl(lastRender.url)}
                controls
                playsInline
                className="forge-max-render-video"
              />
            </div>
            <div className="forge-max-render-meta">
              <strong>{lastRender.filename}</strong>
              <span>{lastRender.width}×{lastRender.height} · {formatDuration(lastRender.duration)} · {lastRender.clip_count || 0} clipes</span>
              <div className="forge-max-render-actions">
                <a href={forgeMaxFileUrl(lastRender.url)} target="_blank" rel="noreferrer" className="forge-max-download-link">
                  <Download size={15} /> Abrir MP4
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="forge-max-render-empty">
            <strong>Nenhum render ainda</strong>
            <span>Monte a timeline e rode o primeiro render para validar cortes e união de clipes.</span>
          </div>
        )}
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
