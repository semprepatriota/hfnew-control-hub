import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  CircleDot,
  Clapperboard,
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
  Undo2,
  UserRound,
  Volume2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { listForge2Projects } from '../../the-forge/services/forge2Api';
import {
  getForgeEasyEditor,
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
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const project = payload?.project || null;
  const editor = payload?.editor || null;
  const timeline = editor?.timeline || null;
  const duration = timeline?.duration || project?.source_video?.duration || 0;

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

  const loadProjects = async () => {
    const data = await listForge2Projects();
    const nextProjects = data.projects || [];
    setProjects(nextProjects);
    if (!projectId && nextProjects[0]?.id) {
      setProjectId(nextProjects[0].id);
      await loadEditor(nextProjects[0].id);
    }
  };

  const loadEditor = async (nextProjectId) => {
    if (!nextProjectId) return;
    const data = await getForgeEasyEditor(nextProjectId);
    setPayload(data);
  };

  useEffect(() => {
    runAction('initial-load', loadProjects);
  }, []);

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
      setMessage('Timeline inicial criada.');
    });
  };

  const handleAutosave = async () => {
    if (!projectId || !timeline) return;
    await runAction('autosave', async () => {
      const data = await saveForgeEasyTimeline(projectId, {
        timeline,
        mode: editor?.mode || 'assistido',
        preset: editor?.preset || 'documentario',
      });
      setPayload(data);
      setMessage('Autosave concluido.');
    });
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
          <button type="button" disabled>
            <Undo2 size={16} />
          </button>
          <button type="button" disabled>
            <Redo2 size={16} />
          </button>
        </div>
      </header>

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
            <input type="range" min="0" max={Math.max(1, duration)} value={timeline?.cursor || 0} readOnly />
          </div>
        </main>

        <aside className="easy-editor-properties">
          <div className="easy-panel-title">
            <Sparkles size={17} />
            <span>Propriedades</span>
          </div>
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
        </aside>
      </section>

      <section className="easy-editor-tools">
        <button type="button" disabled><Scissors size={16} /> Cortar</button>
        <button type="button" disabled><Subtitles size={16} /> Legenda</button>
        <button type="button" disabled><Sparkles size={16} /> IA</button>
        <button type="button" disabled><Clapperboard size={16} /> Trailer</button>
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
                  <button key={clip.id} type="button" className="easy-clip" style={clipStyle(clip, duration)}>
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
