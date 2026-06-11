import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  CircleDot,
  Clapperboard,
  Download,
  ExternalLink,
  Film,
  Image,
  Loader,
  Lock,
  Music,
  Pause,
  Play,
  Redo2,
  Save,
  Scissors,
  Sparkles,
  Subtitles,
  Trash2,
  Undo2,
  UserRound,
  Volume2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { listForge2Projects } from '../../the-forge/services/forge2Api';
import {
  getForgeEasyEditor,
  importForgeEasyYouTube,
  initializeForgeEasyEditor,
  saveForgeEasyTimeline,
} from '../services/forgeEasyEditorApi';
import '../styles/forge-easy-editor.css';

const TRACK_ICONS = {
  main_video: Film,
  broll: Image,
  avatar: UserRound,
  text: Sparkles,
  captions: Subtitles,
  music: Music,
  sfx: Volume2,
};

function formatDuration(seconds = 0) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return h
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function cloneTimeline(timeline) {
  return JSON.parse(JSON.stringify(timeline || { duration: 0, cursor: 0, zoom: 1, tracks: [] }));
}

function clipStyle(clip, duration) {
  const total = Math.max(Number(duration) || 1, 1);
  const start = Math.max(0, Number(clip.start) || 0);
  const end = Math.max(start + 1, Number(clip.end) || start + 1);
  return {
    left: `${Math.min(96, (start / total) * 100)}%`,
    width: `${Math.max(4, Math.min(100, ((end - start) / total) * 100))}%`,
  };
}

function ForgeEasyEditor() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [payload, setPayload] = useState(null);
  const [localTimeline, setLocalTimeline] = useState(null);
  const [selectedClip, setSelectedClip] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [confirmRights, setConfirmRights] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const project = payload?.project || null;
  const editor = payload?.editor || null;
  const timeline = localTimeline || editor?.timeline || null;
  const duration = timeline?.duration || project?.source_video?.duration || 0;
  const selectedClipData = selectedClip && timeline
    ? timeline.tracks
      .find((track) => track.id === selectedClip.trackId)
      ?.clips.find((clip) => clip.id === selectedClip.clipId)
    : null;

  const runAction = async (label, action) => {
    setBusy(label);
    setError('');
    setMessage('');
    try {
      return await action();
    } catch (err) {
      setError(err.message || 'Falha no Forge Easy Editor');
      return null;
    } finally {
      setBusy('');
    }
  };

  const loadEditor = async (nextProjectId) => {
    if (!nextProjectId) return;
    const data = await getForgeEasyEditor(nextProjectId);
    setPayload(data);
    setLocalTimeline(data.editor?.timeline || null);
    setSelectedClip(null);
    setUndoStack([]);
    setRedoStack([]);
  };

  const loadProjects = async () => {
    const data = await listForge2Projects();
    const nextProjects = data.projects || [];
    setProjects(nextProjects);
    if (!projectId && nextProjects[0]?.id) {
      setProjectId(nextProjects[0].id);
      await loadEditor(nextProjects[0].id);
    }
  };

  useEffect(() => {
    runAction('initial-load', loadProjects);
  }, []);

  const persistTimeline = async (nextTimeline, successMessage = 'Autosave concluido.') => {
    if (!projectId || !nextTimeline) return null;
    const data = await saveForgeEasyTimeline(projectId, {
      timeline: nextTimeline,
      mode: editor?.mode || 'assistido',
      preset: editor?.preset || 'documentario',
    });
    setPayload(data);
    setLocalTimeline(data.editor?.timeline || nextTimeline);
    setMessage(successMessage);
    return data;
  };

  const applyTimelineChange = async (updater, successMessage) => {
    if (!timeline) return;
    const previous = cloneTimeline(timeline);
    const next = updater(cloneTimeline(timeline));
    setUndoStack((current) => [...current.slice(-19), previous]);
    setRedoStack([]);
    setLocalTimeline(next);
    await runAction('timeline-change', () => persistTimeline(next, successMessage));
  };

  const updateSelectedClip = async (updates) => {
    if (!selectedClipData) return;
    await applyTimelineChange((draft) => {
      const track = draft.tracks.find((item) => item.id === selectedClip.trackId);
      const clip = track?.clips.find((item) => item.id === selectedClip.clipId);
      if (!clip) return draft;
      Object.assign(clip, updates);
      if (Number(clip.end) <= Number(clip.start)) {
        clip.end = Number(clip.start) + 1;
      }
      return draft;
    }, 'Clipe atualizado.');
  };

  const handleProjectChange = async (event) => {
    const nextProjectId = event.target.value;
    setProjectId(nextProjectId);
    await runAction('load-editor', () => loadEditor(nextProjectId));
  };

  const handleInitialize = async () => {
    if (!projectId) return;
    await runAction('initialize', async () => {
      const data = await initializeForgeEasyEditor(projectId);
      setPayload(data);
      setLocalTimeline(data.editor?.timeline || null);
      setSelectedClip(null);
      setUndoStack([]);
      setRedoStack([]);
      setMessage('Timeline inicial criada.');
    });
  };

  const handleAutosave = async () => {
    if (!projectId || !timeline) return;
    await runAction('autosave', () => persistTimeline(timeline));
  };

  const handleImportYouTube = async () => {
    if (!projectId || !youtubeUrl.trim()) {
      setError('Selecione um projeto e informe a URL do YouTube.');
      return;
    }
    await runAction('youtube-import', async () => {
      const data = await importForgeEasyYouTube(projectId, {
        url: youtubeUrl.trim(),
        confirm_rights: confirmRights,
      });
      setPayload(data);
      setLocalTimeline(data.editor?.timeline || null);
      setSelectedClip(null);
      setYoutubeUrl('');
      setConfirmRights(false);
      await loadProjects();
      setMessage('Video importado do YouTube e timeline atualizada.');
    });
  };

  const handleNumericClipChange = (field, value) => {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;
    updateSelectedClip({ [field]: Number(Math.max(0, nextValue).toFixed(2)) });
  };

  const moveSelectedClip = async (delta) => {
    if (!selectedClipData) return;
    const length = Math.max(1, selectedClipData.end - selectedClipData.start);
    const nextStart = Math.max(0, Math.min(Math.max(0, duration - length), selectedClipData.start + delta));
    await updateSelectedClip({
      start: Number(nextStart.toFixed(2)),
      end: Number((nextStart + length).toFixed(2)),
    });
  };

  const splitSelectedClip = async () => {
    if (!selectedClipData) return;
    const midpoint = Number(((selectedClipData.start + selectedClipData.end) / 2).toFixed(2));
    if (midpoint <= selectedClipData.start || midpoint >= selectedClipData.end) return;
    await applyTimelineChange((draft) => {
      const track = draft.tracks.find((item) => item.id === selectedClip.trackId);
      if (!track) return draft;
      const index = track.clips.findIndex((item) => item.id === selectedClip.clipId);
      if (index < 0) return draft;
      const clip = track.clips[index];
      const left = { ...clip, id: `${clip.id}_a_${Date.now()}`, end: midpoint };
      const right = { ...clip, id: `${clip.id}_b_${Date.now()}`, start: midpoint };
      track.clips.splice(index, 1, left, right);
      setSelectedClip({ trackId: track.id, clipId: left.id });
      return draft;
    }, 'Clipe dividido.');
  };

  const deleteSelectedClip = async () => {
    if (!selectedClipData) return;
    await applyTimelineChange((draft) => {
      const track = draft.tracks.find((item) => item.id === selectedClip.trackId);
      if (!track) return draft;
      track.clips = track.clips.filter((clip) => clip.id !== selectedClip.clipId);
      setSelectedClip(null);
      return draft;
    }, 'Clipe excluido.');
  };

  const restoreTimeline = async (sourceStack, setSourceStack, setTargetStack, successMessage) => {
    if (!sourceStack.length || !timeline) return;
    const previous = sourceStack[sourceStack.length - 1];
    setSourceStack((current) => current.slice(0, -1));
    setTargetStack((current) => [...current.slice(-19), cloneTimeline(timeline)]);
    setLocalTimeline(previous);
    setSelectedClip(null);
    await runAction('history', () => persistTimeline(previous, successMessage));
  };

  const handleCursorChange = async (value) => {
    const nextCursor = Number(value);
    if (!Number.isFinite(nextCursor) || !timeline) return;
    await applyTimelineChange((draft) => {
      draft.cursor = Number(Math.max(0, Math.min(duration || 0, nextCursor)).toFixed(2));
      return draft;
    }, 'Cursor atualizado.');
  };

  const renderClipProperties = () => {
    if (!selectedClipData) {
      return (
        <dl>
          <dt>Modo</dt>
          <dd>{editor?.mode || 'assistido'}</dd>
          <dt>Preset</dt>
          <dd>{editor?.preset || 'documentario'}</dd>
          <dt>Autosave</dt>
          <dd>v{editor?.autosave_version || 0}</dd>
          <dt>Duração</dt>
          <dd>{formatDuration(duration)}</dd>
        </dl>
      );
    }

    return (
      <div className="easy-clip-properties">
        <label>
          Nome
          <input value={selectedClipData.name || ''} onChange={(event) => updateSelectedClip({ name: event.target.value })} />
        </label>
        <label>
          Inicio
          <input type="number" min="0" step="0.1" value={selectedClipData.start} onChange={(event) => handleNumericClipChange('start', event.target.value)} />
        </label>
        <label>
          Fim
          <input type="number" min="0" step="0.1" value={selectedClipData.end} onChange={(event) => handleNumericClipChange('end', event.target.value)} />
        </label>
        <label>
          Origem inicio
          <input type="number" min="0" step="0.1" value={selectedClipData.source_start || 0} onChange={(event) => handleNumericClipChange('source_start', event.target.value)} />
        </label>
        <label>
          Origem fim
          <input type="number" min="0" step="0.1" value={selectedClipData.source_end || 0} onChange={(event) => handleNumericClipChange('source_end', event.target.value)} />
        </label>
        <div className="easy-property-actions">
          <button type="button" onClick={() => moveSelectedClip(-1)} disabled={Boolean(busy)}>Mover -1s</button>
          <button type="button" onClick={() => moveSelectedClip(1)} disabled={Boolean(busy)}>Mover +1s</button>
        </div>
      </div>
    );
  };

  return (
    <div className="easy-editor-page">
      <header className="easy-editor-topbar">
        <div className="easy-editor-title">
          <Link to="/the-forge" className="easy-editor-back">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <span>The Forge 2.0</span>
            <h1>Forge Easy Editor</h1>
          </div>
        </div>

        <div className="easy-editor-actions">
          <select value={projectId} onChange={handleProjectChange}>
            <option value="">Selecionar projeto</option>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
          <button type="button" onClick={handleInitialize} disabled={!projectId || Boolean(busy)}>
            <CircleDot size={16} />
            Inicializar
          </button>
          <button type="button" onClick={handleAutosave} disabled={!timeline || Boolean(busy)}>
            <Save size={16} />
            Salvar
          </button>
          <button type="button" onClick={() => restoreTimeline(undoStack, setUndoStack, setRedoStack, 'Desfeito.')} disabled={!undoStack.length || Boolean(busy)}>
            <Undo2 size={16} />
          </button>
          <button type="button" onClick={() => restoreTimeline(redoStack, setRedoStack, setUndoStack, 'Refeito.')} disabled={!redoStack.length || Boolean(busy)}>
            <Redo2 size={16} />
          </button>
        </div>
      </header>

      <section className="easy-youtube-import">
        <div>
          <Download size={18} />
          <strong>Importar video do YouTube</strong>
        </div>
        <input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
        <label>
          <input type="checkbox" checked={confirmRights} onChange={(event) => setConfirmRights(event.target.checked)} />
          Tenho direito ou autorizacao para usar este video
        </label>
        <button type="button" onClick={handleImportYouTube} disabled={!projectId || !youtubeUrl.trim() || !confirmRights || Boolean(busy)}>
          <Download size={16} />
          Puxar video
        </button>
      </section>

      <section className="easy-editor-shell">
        <aside className="easy-editor-library">
          <div className="easy-panel-title">
            <Clapperboard size={17} />
            <span>Biblioteca</span>
          </div>
          <button type="button" className="easy-library-item active">
            <Film size={18} />
            <span>Video principal</span>
            <small>{project?.source_video?.filename || 'Nenhum video'}</small>
          </button>
          <button type="button" className="easy-library-item">
            <Image size={18} />
            <span>B-roll</span>
            <small>{payload?.edit_plan?.media_insertions?.length || 0} sugestoes</small>
          </button>
          <button type="button" className="easy-library-item">
            <Subtitles size={18} />
            <span>Legendas</span>
            <small>{payload?.edit_plan?.captions?.length || 0} segmentos</small>
          </button>
          <button type="button" className="easy-library-item">
            <UserRound size={18} />
            <span>Avatar</span>
            <small>{payload?.edit_plan?.avatar_segments?.length || 0} trechos</small>
          </button>
        </aside>

        <main className="easy-editor-player">
          <div className="easy-player-stage">
            <div className="easy-player-frame">
              <Film size={42} />
              <strong>{project?.title || 'Selecione um projeto'}</strong>
              <span>{project?.source_video ? `${project.source_video.width}x${project.source_video.height}` : 'Aguardando video principal'}</span>
            </div>
          </div>
          <div className="easy-player-controls">
            <button type="button" disabled><Play size={16} /></button>
            <button type="button" disabled><Pause size={16} /></button>
            <span>{formatDuration(timeline?.cursor || 0)} / {formatDuration(duration)}</span>
            <input type="range" min="0" max={Math.max(1, duration)} value={timeline?.cursor || 0} onChange={(event) => handleCursorChange(event.target.value)} />
          </div>
        </main>

        <aside className="easy-editor-properties">
          <div className="easy-panel-title">
            <Sparkles size={17} />
            <span>{selectedClipData ? 'Clipe selecionado' : 'Propriedades'}</span>
          </div>
          {renderClipProperties()}
        </aside>
      </section>

      <section className="easy-editor-tools">
        <button type="button" onClick={splitSelectedClip} disabled={!selectedClipData || Boolean(busy)}><Scissors size={16} /> Dividir</button>
        <button type="button" onClick={deleteSelectedClip} disabled={!selectedClipData || Boolean(busy)}><Trash2 size={16} /> Excluir</button>
        <button type="button" disabled><Subtitles size={16} /> Legenda</button>
        <button type="button" disabled><Sparkles size={16} /> IA</button>
        <button type="button" disabled><Clapperboard size={16} /> Trailer</button>
        {projectId && (
          <Link className="easy-tool-link" to={`/the-forge?project=${encodeURIComponent(projectId)}`}>
            <ExternalLink size={16} />
            Projeto
          </Link>
        )}
      </section>

      <section className="easy-editor-timeline">
        {(timeline?.tracks || []).map((track) => {
          const Icon = TRACK_ICONS[track.type] || Film;
          return (
            <div key={track.id} className={`easy-track ${track.hidden ? 'hidden' : ''}`}>
              <div className="easy-track-label">
                <Icon size={16} />
                <span>{track.label}</span>
                {track.locked && <Lock size={13} />}
              </div>
              <div className="easy-track-lane">
                {track.clips.map((clip) => (
                  <button
                    key={clip.id}
                    type="button"
                    className={`easy-clip ${selectedClip?.clipId === clip.id ? 'selected' : ''}`}
                    style={clipStyle(clip, duration)}
                    onClick={() => setSelectedClip({ trackId: track.id, clipId: clip.id })}
                  >
                    <span>{clip.name || clip.id}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {(busy || error || message) && (
        <div className={`easy-editor-toast ${error ? 'error' : ''}`}>
          {busy && <Loader size={16} className="easy-spin" />}
          <span>{error || message || 'Processando...'}</span>
        </div>
      )}
    </div>
  );
}

export default ForgeEasyEditor;
