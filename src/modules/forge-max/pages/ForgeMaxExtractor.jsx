import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  Film,
  Loader2,
  Magnet,
  Pause,
  Play,
  RefreshCw,
  ScanLine,
  Scissors,
  Trash2,
  Upload,
  Video,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import {
  analyzeForgeMaxScenes,
  cancelForgeMaxTask,
  deleteForgeMaxClip,
  deleteForgeMaxVideo,
  extractForgeMaxClip,
  forgeMaxClipsArchiveUrl,
  forgeMaxMediaUrl,
  forgeMaxThumbnailUrl,
  getForgeMaxHealth,
  getForgeMaxVideo,
  listForgeMaxVideos,
  retryForgeMaxTask,
  uploadForgeMaxVideo,
} from '../services/forgeMaxApi';
import { clampTimelineValue, snapTimelineTime, uploadPercent } from '../services/forgeMaxTimeline';
import './forge-max-extractor.css';

const POLL_INTERVAL_MS = 3000;

function clamp(value, minimum, maximum) {
  return clampTimelineValue(value, minimum, maximum);
}

function formatTime(value, compact = false) {
  const seconds = Math.max(0, Number(value) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  if (compact) {
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
      : `${minutes}:${String(remainder).padStart(2, '0')}`;
  }
  return `${hours > 0 ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[unit]}`;
}

function statusLabel(video) {
  if (video?.status === 'preparing') return video.prepare_task?.state === 'queued' ? 'Prévia na fila' : `Preparando prévia · ${video.prepare_progress || 0}%`;
  if (video?.status === 'cancelled') return 'Prévia cancelada';
  if (video?.status === 'error') return 'Falha na prévia';
  if (video?.analysis_status === 'running') return video.analysis_task?.state === 'queued' ? 'Cenas na fila' : `Detectando cenas · ${video.analysis_progress || 0}%`;
  if (video?.analysis_status === 'cancelled') return 'Detecção cancelada';
  if (video?.analysis_status === 'error') return 'Falha nas cenas';
  return 'Pronto';
}

function ForgeMaxExtractor() {
  const playerRef = useRef(null);
  const timelineTrackRef = useRef(null);
  const timelineViewportRef = useRef(null);
  const dragRef = useRef(null);
  const playbackRangeRef = useRef(null);
  const resumableUploadRef = useRef(null);
  const [health, setHealth] = useState(null);
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadPaused, setUploadPaused] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [clipsOpen, setClipsOpen] = useState(true);
  const [threshold, setThreshold] = useState(0.30);
  const [sceneMode, setSceneMode] = useState('adaptive');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(2.2);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [clipTitle, setClipTitle] = useState('Reportagem extraída');
  const [playing, setPlaying] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState('');

  const duration = Number(activeVideo?.duration) || 0;
  const scenes = activeVideo?.scenes || [];
  const clips = activeVideo?.clips || [];
  const playbackUrl = forgeMaxMediaUrl(activeVideo?.playback_url);
  const waveformUrl = forgeMaxMediaUrl(activeVideo?.waveform_url);
  const timelineWidth = Math.max(900, duration * zoom);
  const selectedDuration = Math.max(0, selectionEnd - selectionStart);

  const clearNotice = useCallback(() => {
    setMessage('');
    setError('');
  }, []);

  const snapTime = useCallback((value) => {
    return snapTimelineTime(value, duration, scenes, snapEnabled, zoom);
  }, [duration, scenes, snapEnabled, zoom]);

  const refreshList = useCallback(async (preferredId = '') => {
    const payload = await listForgeMaxVideos();
    const nextVideos = payload.videos || [];
    setVideos(nextVideos);
    const targetId = preferredId || activeVideo?.id || nextVideos[0]?.id || '';
    const target = nextVideos.find((item) => item.id === targetId) || nextVideos[0] || null;
    setActiveVideo(target);
    return target;
  }, [activeVideo?.id]);

  const refreshActive = useCallback(async () => {
    if (!activeVideo?.id) return null;
    const updated = await getForgeMaxVideo(activeVideo.id);
    setActiveVideo(updated);
    setVideos((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    return updated;
  }, [activeVideo?.id]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getForgeMaxHealth(), listForgeMaxVideos()])
      .then(([healthPayload, videoPayload]) => {
        if (cancelled) return;
        const nextVideos = videoPayload.videos || [];
        setHealth(healthPayload);
        setVideos(nextVideos);
        setActiveVideo(nextVideos[0] || null);
      })
      .catch((caught) => !cancelled && setError(caught.message));
    return () => { cancelled = true; };
  }, []);

  const needsPolling = Boolean(
    activeVideo
    && (
      activeVideo.status === 'preparing'
      || activeVideo.analysis_status === 'running'
      || clips.some((clip) => clip.status === 'extracting')
    )
  );

  useEffect(() => {
    if (!needsPolling) return undefined;
    const interval = window.setInterval(() => {
      refreshActive().catch((caught) => setError(caught.message));
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [needsPolling, refreshActive]);

  useEffect(() => {
    const nextEnd = Math.min(duration, Math.max(1, duration));
    setCurrentTime(0);
    setSelectionStart(0);
    setSelectionEnd(nextEnd);
    setPlaying(false);
    setSelectedSceneId('');
    setSceneMode(activeVideo?.scene_mode || 'adaptive');
    setThreshold(Number(activeVideo?.scene_threshold) || 0.30);
    playbackRangeRef.current = null;
  }, [activeVideo?.id, duration]);

  useEffect(() => {
    function handleShortcut(event) {
      if (!activeVideo || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        const player = playerRef.current;
        if (player?.paused) player.play().catch(() => {});
        else player?.pause();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const step = event.shiftKey ? 1 : 0.04;
        seekTo(currentTime + (direction * step));
      } else if (event.key.toLowerCase() === 'i') {
        setSelectedSceneId('');
        playbackRangeRef.current = null;
        setSelectionStart(Math.min(snapTime(currentTime), selectionEnd - 0.05));
      } else if (event.key.toLowerCase() === 'o') {
        setSelectedSceneId('');
        playbackRangeRef.current = null;
        setSelectionEnd(Math.max(snapTime(currentTime), selectionStart + 0.05));
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [activeVideo, currentTime, duration, selectionEnd, selectionStart, snapTime]);

  useEffect(() => {
    function onPointerMove(event) {
      if (!dragRef.current || !timelineTrackRef.current || !duration) return;
      const bounds = timelineTrackRef.current.getBoundingClientRect();
      const nextTime = snapTime(((event.clientX - bounds.left) / bounds.width) * duration);
      if (dragRef.current === 'start') {
        setSelectionStart(Math.min(nextTime, selectionEnd - 0.05));
      } else {
        setSelectionEnd(Math.max(nextTime, selectionStart + 0.05));
      }
      setSelectedSceneId('');
      playbackRangeRef.current = null;
    }
    function onPointerUp() {
      dragRef.current = null;
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [duration, selectionEnd, selectionStart, snapTime]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearNotice();
    setUploadBusy(true);
    setUploadPaused(false);
    setUploadProgress(0);
    try {
      const uploaded = await uploadForgeMaxVideo(file, {
        onUploadReady: (upload) => { resumableUploadRef.current = upload; },
        onProgress: (uploadedBytes, totalBytes) => {
          setUploadProgress(uploadPercent(uploadedBytes, totalBytes));
        },
      });
      setVideos((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)]);
      setActiveVideo(uploaded);
      setMessage('Vídeo recebido. A prévia leve está sendo preparada em segundo plano.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      resumableUploadRef.current = null;
      setUploadBusy(false);
      setUploadPaused(false);
    }
  }

  async function pauseUpload() {
    if (!resumableUploadRef.current || uploadPaused) return;
    await resumableUploadRef.current.abort();
    setUploadPaused(true);
  }

  function resumeUpload() {
    if (!resumableUploadRef.current || !uploadPaused) return;
    resumableUploadRef.current.start();
    setUploadPaused(false);
  }

  async function cancelUpload() {
    if (!resumableUploadRef.current) return;
    await resumableUploadRef.current.abort(true);
    resumableUploadRef.current = null;
    setUploadBusy(false);
    setUploadPaused(false);
    setUploadProgress(0);
    setMessage('Envio cancelado. O arquivo parcial foi removido.');
  }

  async function handleDeleteVideo(videoId) {
    if (!window.confirm('Excluir este vídeo e todos os trechos extraídos dele?')) return;
    clearNotice();
    setBusyAction(`delete-${videoId}`);
    try {
      await deleteForgeMaxVideo(videoId);
      const remaining = videos.filter((item) => item.id !== videoId);
      setVideos(remaining);
      setActiveVideo((current) => (current?.id === videoId ? remaining[0] || null : current));
      setMessage('Vídeo excluído do extrator.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusyAction('');
    }
  }

  async function handleAnalyze() {
    if (!activeVideo?.id) return;
    clearNotice();
    setBusyAction('analyze');
    try {
      const updated = await analyzeForgeMaxScenes(activeVideo.id, Number(threshold), sceneMode);
      setActiveVideo(updated);
      setVideos((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage('Detecção iniciada. A timeline será atualizada automaticamente.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusyAction('');
    }
  }

  async function handleTaskAction(action, taskType, clipId = '') {
    if (!activeVideo?.id) return;
    clearNotice();
    const actionKey = `${action}-${taskType}-${clipId}`;
    setBusyAction(actionKey);
    try {
      const updated = action === 'cancel'
        ? await cancelForgeMaxTask(activeVideo.id, taskType, clipId)
        : await retryForgeMaxTask(activeVideo.id, taskType, clipId);
      setActiveVideo(updated);
      setVideos((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(action === 'cancel' ? 'Processamento cancelado.' : 'Processamento colocado novamente na fila.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusyAction('');
    }
  }

  function seekTo(seconds, shouldPlay = false, playbackRange = null) {
    const next = clamp(seconds, 0, duration);
    playbackRangeRef.current = playbackRange;
    setCurrentTime(next);
    const player = playerRef.current;
    if (!player) return;
    const applySeek = () => {
      player.currentTime = next;
      if (shouldPlay) player.play().catch(() => {});
    };
    if (player.readyState >= 1) applySeek();
    else player.addEventListener('loadedmetadata', applySeek, { once: true });
  }

  function selectScene(scene) {
    const start = clamp(Number(scene.start_seconds) || 0, 0, duration);
    const end = clamp(Number(scene.end_seconds) || start + Number(scene.duration || 0), start, duration);
    setSelectionStart(start);
    setSelectionEnd(end);
    setSelectedSceneId(scene.id);
    seekTo(start, true, { start, end });
  }

  function handleTimelinePointer(event) {
    if (!timelineTrackRef.current || event.target.closest('.forge-max-extractor-handle')) return;
    const bounds = timelineTrackRef.current.getBoundingClientRect();
    setSelectedSceneId('');
    seekTo(((event.clientX - bounds.left) / bounds.width) * duration);
  }

  function previewSelection() {
    if (selectedDuration <= 0) return;
    seekTo(selectionStart, true, { start: selectionStart, end: selectionEnd });
  }

  function handlePlayerTimeUpdate(event) {
    const player = event.currentTarget;
    const next = player.currentTime;
    const range = playbackRangeRef.current;
    if (range && next >= range.end - 0.035) {
      player.pause();
      player.currentTime = range.end;
      setCurrentTime(range.end);
      return;
    }
    setCurrentTime(next);
  }

  function togglePlayback() {
    const player = playerRef.current;
    if (!player) return;
    const range = playbackRangeRef.current;
    if (player.paused && range && (player.currentTime < range.start || player.currentTime >= range.end - 0.035)) {
      seekTo(range.start, true, range);
    } else if (player.paused) player.play().catch(() => {});
    else player.pause();
  }

  async function handleExtract() {
    if (!activeVideo?.id || selectedDuration < 0.25) return;
    clearNotice();
    setBusyAction('extract');
    try {
      await extractForgeMaxClip(activeVideo.id, {
        title: clipTitle.trim() || 'Reportagem extraída',
        start_seconds: selectionStart,
        end_seconds: selectionEnd,
        mode: 'precise',
      });
      await refreshActive();
      setClipsOpen(true);
      setMessage('Trecho enviado para extração precisa.');
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusyAction('');
    }
  }

  async function handleDeleteClip(clipId) {
    if (!window.confirm('Excluir este trecho extraído?')) return;
    clearNotice();
    setBusyAction(`clip-${clipId}`);
    try {
      await deleteForgeMaxClip(activeVideo.id, clipId);
      await refreshActive();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusyAction('');
    }
  }

  function handleDownloadAllClips() {
    clearNotice();
    if (!clips.length) {
      setError('Extraia pelo menos uma cena antes de baixar todas.');
      return;
    }
    const processing = clips.filter((clip) => clip.status === 'extracting').length;
    const failed = clips.filter((clip) => clip.status === 'error').length;
    if (processing) {
      setError(`Aguarde ${processing} cena(s) terminar(em) a extração.`);
      return;
    }
    if (failed) {
      setError(`Existem ${failed} cena(s) com falha. Exclua ou extraia novamente antes do ZIP.`);
      return;
    }
    const archiveUrl = forgeMaxClipsArchiveUrl(activeVideo);
    if (!archiveUrl) {
      setError('Não foi possível preparar o endereço do ZIP.');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = archiveUrl;
    anchor.download = `forge_max_cenas_${activeVideo.id.slice(-8)}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setMessage(`${clips.length} cena(s) pronta(s) para download em um único ZIP.`);
  }

  const tickMarks = useMemo(() => {
    if (!duration) return [];
    const desiredTicks = Math.max(8, Math.min(60, Math.round(timelineWidth / 140)));
    const rawStep = duration / desiredTicks;
    const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const step = candidates.find((value) => value >= rawStep) || 900;
    const marks = [];
    for (let value = 0; value <= duration; value += step) marks.push(value);
    return marks;
  }, [duration, timelineWidth]);

  return (
    <div className="forge-max-extractor-page">
      <header className="forge-max-extractor-header">
        <div>
          <span className="forge-max-extractor-kicker"><Scissors size={15} /> EXTRATOR DE REPORTAGENS</span>
          <h1>Forge Max 3.0</h1>
          <p>Vídeos longos, cenas visíveis e cortes precisos sem alterar o conteúdo original.</p>
        </div>
        <div className="forge-max-extractor-health">
          <span className={health?.status === 'operational' ? 'online' : ''} />
          <div><strong>{health?.status === 'operational' ? 'Operacional' : 'Verificando'}</strong><small>até {Math.round((health?.max_duration_seconds || 12000) / 60)} minutos</small></div>
        </div>
      </header>

      {(message || error) && (
        <div className={`forge-max-extractor-notice ${error ? 'error' : 'success'}`}>
          {error ? error : message}
          <button type="button" onClick={clearNotice} aria-label="Fechar aviso">×</button>
        </div>
      )}

      <section className={`forge-max-extractor-panel forge-max-extractor-library ${libraryOpen ? '' : 'collapsed'}`}>
        <button type="button" className="forge-max-extractor-panel-heading" onClick={() => setLibraryOpen((value) => !value)}>
          <span><Video size={18} /><strong>Vídeos para extração</strong><small>{videos.length} arquivo(s)</small></span>
          {libraryOpen ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
        </button>
        {libraryOpen && (
          <div className="forge-max-extractor-library-body">
            <div className="forge-max-extractor-upload-stack">
              <label className={`forge-max-extractor-upload ${uploadBusy ? 'busy' : ''}`}>
                {uploadBusy ? <Loader2 className="spin" size={22} /> : <Upload size={22} />}
                <span><strong>{uploadPaused ? 'Envio pausado' : uploadBusy ? `Enviando vídeo · ${uploadProgress}%` : 'Adicionar vídeo longo'}</strong><small>MP4, MOV, M4V, MKV, WEBM ou AVI · máximo 200 minutos</small></span>
                <input type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/x-matroska,video/webm,video/x-msvideo" onChange={handleUpload} disabled={uploadBusy} />
              </label>
              {uploadBusy && (
                <div className="forge-max-extractor-upload-status">
                  <div><span style={{ width: `${uploadProgress}%` }} /></div>
                  <strong>{uploadProgress}%</strong>
                  <button type="button" onClick={uploadPaused ? resumeUpload : pauseUpload}>{uploadPaused ? <Play size={15} /> : <Pause size={15} />}{uploadPaused ? 'Continuar' : 'Pausar'}</button>
                  <button type="button" className="danger" onClick={cancelUpload}><XCircle size={15} />Cancelar</button>
                </div>
              )}
            </div>
            <div className="forge-max-extractor-video-list">
              {videos.map((video) => (
                <article key={video.id} className={`forge-max-extractor-video-card ${activeVideo?.id === video.id ? 'active' : ''}`}>
                  <button type="button" className="forge-max-extractor-video-select" onClick={() => setActiveVideo(video)}>
                    <Film size={21} />
                    <span><strong>{video.original_name}</strong><small>{formatTime(video.duration, true)} · {video.width}×{video.height} · {formatBytes(video.size_bytes)}</small></span>
                    <em className={video.status === 'error' || video.analysis_status === 'error' ? 'error' : ''}>{statusLabel(video)}</em>
                  </button>
                  <button type="button" className="forge-max-extractor-delete" onClick={() => handleDeleteVideo(video.id)} disabled={busyAction === `delete-${video.id}`} title="Excluir vídeo">
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
              {!videos.length && <p className="forge-max-extractor-empty">Nenhum vídeo enviado.</p>}
            </div>
          </div>
        )}
      </section>

      {activeVideo ? (
        <>
          <section className="forge-max-extractor-workspace">
            <div className="forge-max-extractor-player-panel">
              <div className="forge-max-extractor-panel-title">
                <span><Play size={17} /><strong>Prévia do vídeo</strong></span>
                <button type="button" onClick={() => refreshActive().catch((caught) => setError(caught.message))} title="Atualizar status"><RefreshCw size={16} /></button>
              </div>
              <div className="forge-max-extractor-player-shell">
                {activeVideo.status === 'preparing' && <div className="forge-max-extractor-processing"><Loader2 className="spin" size={28} /><strong>Preparando prévia leve · {activeVideo.prepare_progress || 0}%</strong><span>{activeVideo.prepare_task?.state === 'queued' ? `Fila: posição ${activeVideo.prepare_task.queue_position}` : 'O original permanece intacto.'}</span><button type="button" onClick={() => handleTaskAction('cancel', 'prepare')}>Cancelar</button></div>}
                {['error', 'cancelled'].includes(activeVideo.status) && <div className="forge-max-extractor-processing error"><XCircle size={28} /><strong>{activeVideo.status_detail || 'Falha na prévia'}</strong><span>{activeVideo.error || 'Você pode tentar novamente.'}</span><button type="button" onClick={() => handleTaskAction('retry', 'prepare')}>Tentar novamente</button></div>}
                {playbackUrl && (
                  <video
                    ref={playerRef}
                    key={playbackUrl}
                    src={playbackUrl}
                    preload="metadata"
                    controls
                    onTimeUpdate={handlePlayerTimeUpdate}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onLoadedMetadata={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
                  />
                )}
              </div>
              <div className="forge-max-extractor-player-readout">
                <button type="button" onClick={togglePlayback}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
                <strong>{formatTime(currentTime)}</strong><span>/ {formatTime(duration)}</span>
              </div>
            </div>

            <aside className="forge-max-extractor-cut-panel">
              <div className="forge-max-extractor-panel-title"><span><Scissors size={17} /><strong>Trecho selecionado</strong></span></div>
              <label className="forge-max-extractor-title-field">Nome do trecho<input value={clipTitle} onChange={(event) => setClipTitle(event.target.value)} maxLength={120} /></label>
              <div className="forge-max-extractor-time-grid">
                <label>Início<input type="number" min="0" max={duration} step="0.001" value={selectionStart.toFixed(3)} onChange={(event) => { setSelectedSceneId(''); playbackRangeRef.current = null; setSelectionStart(Math.min(snapTime(Number(event.target.value)), selectionEnd - 0.05)); }} /></label>
                <label>Fim<input type="number" min="0" max={duration} step="0.001" value={selectionEnd.toFixed(3)} onChange={(event) => { setSelectedSceneId(''); playbackRangeRef.current = null; setSelectionEnd(Math.max(snapTime(Number(event.target.value)), selectionStart + 0.05)); }} /></label>
              </div>
              <div className="forge-max-extractor-mark-actions">
                <button type="button" onClick={() => { setSelectedSceneId(''); playbackRangeRef.current = null; setSelectionStart(Math.min(snapTime(currentTime), selectionEnd - 0.05)); }}>Marcar início</button>
                <button type="button" onClick={() => { setSelectedSceneId(''); playbackRangeRef.current = null; setSelectionEnd(Math.max(snapTime(currentTime), selectionStart + 0.05)); }}>Marcar fim</button>
              </div>
              <div className="forge-max-extractor-duration"><Clock3 size={17} /><span>Duração selecionada</span><strong>{formatTime(selectedDuration)}</strong></div>
              <small className="forge-max-extractor-precision">Corte preciso: início e fim respeitados, áudio preservado e MP4 compatível.</small>
              <button type="button" className="forge-max-extractor-extract" onClick={handleExtract} disabled={busyAction === 'extract' || selectedDuration < 0.25}>
                {busyAction === 'extract' ? <Loader2 className="spin" size={16} /> : <Scissors size={16} />}
                Extrair MP4
              </button>
            </aside>
          </section>

          <section className="forge-max-extractor-panel forge-max-extractor-timeline-panel">
            <div className="forge-max-extractor-timeline-toolbar">
              <div><span><ScanLine size={18} /><strong>Timeline de cenas</strong></span><small>{scenes.length ? `${scenes.length} cenas detectadas` : 'Analise o vídeo para separar as mudanças de cena'}</small></div>
              <div className="forge-max-extractor-timeline-selected-actions">
                <button type="button" className="forge-max-extractor-preview-selection" onClick={previewSelection} disabled={selectedDuration <= 0}>
                  <Play size={16} /> Assistir trecho
                </button>
                <button type="button" className="forge-max-extractor-download-all" onClick={handleDownloadAllClips} disabled={!clips.length} title="Baixar todos os trechos extraídos em um ZIP">
                  <Download size={16} /> Baixar Todas Cenas
                </button>
              </div>
              <div className="forge-max-extractor-timeline-actions">
                <div className="forge-max-extractor-mode" aria-label="Modo de detecção">
                  <button type="button" className={sceneMode === 'adaptive' ? 'active' : ''} onClick={() => setSceneMode('adaptive')} title="Melhor equilíbrio para vídeos variados">Adaptativo</button>
                  <button type="button" className={sceneMode === 'fast' ? 'active' : ''} onClick={() => setSceneMode('fast')} title="Mudanças diretas e processamento mais simples">Rápido</button>
                  <button type="button" className={sceneMode === 'fade' ? 'active' : ''} onClick={() => setSceneMode('fade')} title="Transições com escurecimento e clareamento">Fades</button>
                </div>
                <label title="Menor valor encontra mais cortes; maior valor encontra apenas mudanças fortes.">Sensibilidade da detecção <input type="range" min="0.12" max="0.75" step="0.01" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /><strong>{threshold.toFixed(2)}</strong></label>
                {activeVideo.analysis_status === 'running' ? (
                  <button type="button" className="danger" onClick={() => handleTaskAction('cancel', 'analysis')} disabled={busyAction.startsWith('cancel-analysis')}>
                    <XCircle size={17} /> Cancelar · {activeVideo.analysis_progress || 0}%
                  </button>
                ) : (
                  <button type="button" onClick={['error', 'cancelled'].includes(activeVideo.analysis_status) ? () => handleTaskAction('retry', 'analysis') : handleAnalyze} disabled={busyAction === 'analyze' || activeVideo.status === 'preparing'}>
                  {activeVideo.analysis_status === 'running' ? <Loader2 className="spin" size={17} /> : <ScanLine size={17} />}
                    {['error', 'cancelled'].includes(activeVideo.analysis_status) ? 'Tentar novamente' : scenes.length ? 'Analisar novamente' : 'Detectar cenas'}
                  </button>
                )}
              </div>
            </div>
            <div className="forge-max-extractor-zoom"><ZoomIn size={16} /><span>Zoom da timeline</span><input type="range" min="0.5" max="8" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><strong>{zoom.toFixed(1)}×</strong><button type="button" className={snapEnabled ? 'active' : ''} onClick={() => setSnapEnabled((value) => !value)} title="Encaixar o corte nas cenas e nos quadros"><Magnet size={15} />Encaixe</button></div>
            <div
              ref={timelineViewportRef}
              className="forge-max-extractor-timeline-viewport"
              onWheel={(event) => {
                if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                  timelineViewportRef.current.scrollLeft += event.deltaY;
                  event.preventDefault();
                }
              }}
            >
              <div ref={timelineTrackRef} className="forge-max-extractor-timeline-track" style={{ width: timelineWidth }} onPointerDown={handleTimelinePointer}>
                <div className="forge-max-extractor-ruler">
                  {tickMarks.map((tick) => <span key={tick} style={{ left: `${(tick / duration) * 100}%` }}>{formatTime(tick, true)}</span>)}
                </div>
                {waveformUrl && <img className="forge-max-extractor-waveform" src={waveformUrl} alt="Forma de onda do áudio" />}
                <div className="forge-max-extractor-scenes">
                  {(scenes.length ? scenes : [{ id: 'whole', index: 1, label: 'Vídeo completo', start_seconds: 0, end_seconds: duration, duration }]).map((scene) => {
                    const left = duration ? (scene.start_seconds / duration) * 100 : 0;
                    const width = duration ? Math.max(0.15, (scene.duration / duration) * 100) : 100;
                    return (
                      <button
                        type="button"
                        key={scene.id}
                        className={`forge-max-extractor-scene ${selectedSceneId === scene.id ? 'active' : ''}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        onClick={(event) => { event.stopPropagation(); selectScene(scene); }}
                        title={`${scene.label}: ${formatTime(scene.start_seconds)} até ${formatTime(scene.end_seconds)}`}
                      >
                        {activeVideo.media_key && <img loading="lazy" src={forgeMaxThumbnailUrl(activeVideo, scene.start_seconds + Math.min(0.25, scene.duration / 2))} alt="" />}
                        <span>{scene.index}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="forge-max-extractor-selection" style={{ left: `${duration ? (selectionStart / duration) * 100 : 0}%`, width: `${duration ? (selectedDuration / duration) * 100 : 0}%` }}>
                  <button type="button" className="forge-max-extractor-handle start" onPointerDown={(event) => { event.stopPropagation(); dragRef.current = 'start'; }} title="Arrastar início" />
                  <span>{formatTime(selectedDuration, true)}</span>
                  <button type="button" className="forge-max-extractor-handle end" onPointerDown={(event) => { event.stopPropagation(); dragRef.current = 'end'; }} title="Arrastar fim" />
                </div>
                <div className="forge-max-extractor-playhead" style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
              </div>
            </div>
            <p className="forge-max-extractor-timeline-help">Clique em uma cena para assistir o trecho. Arraste as bordas verdes. Atalhos: Espaço reproduz, I marca o início, O marca o fim e as setas avançam quadro a quadro.</p>
          </section>

          <section className={`forge-max-extractor-panel forge-max-extractor-clips ${clipsOpen ? '' : 'collapsed'}`}>
            <button type="button" className="forge-max-extractor-panel-heading" onClick={() => setClipsOpen((value) => !value)}>
              <span><CheckCircle2 size={18} /><strong>Trechos extraídos</strong><small>{clips.length} arquivo(s)</small></span>
              {clipsOpen ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
            </button>
            {clipsOpen && (
              <div className="forge-max-extractor-clips-grid">
                {clips.map((clip) => (
                  <article key={clip.id} className="forge-max-extractor-clip-card">
                    <div className="forge-max-extractor-clip-preview">
                      {clip.status === 'ready' ? <video src={forgeMaxMediaUrl(clip.preview_url)} controls preload="metadata" /> : <div>{clip.status === 'extracting' ? <Loader2 className="spin" size={25} /> : <XCircle size={25} />}<span>{clip.status === 'error' ? 'Falha na extração' : clip.status === 'cancelled' ? 'Extração cancelada' : `${clip.status_detail || 'Extraindo trecho'} · ${clip.progress || 0}%`}</span></div>}
                    </div>
                    <div className="forge-max-extractor-clip-info"><strong>{clip.title}</strong><small>{formatTime(clip.start_seconds)} → {formatTime(clip.end_seconds)} · {formatTime(clip.duration, true)}</small>{clip.error && <em>{clip.error}</em>}</div>
                    <div className="forge-max-extractor-clip-actions">
                      {clip.status === 'ready' && <a href={forgeMaxMediaUrl(clip.download_url)} download><Download size={16} /> Baixar MP4</a>}
                      {clip.status === 'extracting' && <button type="button" onClick={() => handleTaskAction('cancel', 'clip', clip.id)} disabled={busyAction === `cancel-clip-${clip.id}`} title="Cancelar extração"><XCircle size={16} /></button>}
                      {['error', 'cancelled'].includes(clip.status) && <button type="button" onClick={() => handleTaskAction('retry', 'clip', clip.id)} disabled={busyAction === `retry-clip-${clip.id}`} title="Tentar novamente"><RefreshCw size={16} /></button>}
                      <button type="button" onClick={() => handleDeleteClip(clip.id)} disabled={clip.status === 'extracting' || busyAction === `clip-${clip.id}`} title="Excluir trecho"><Trash2 size={16} /></button>
                    </div>
                  </article>
                ))}
                {!clips.length && <p className="forge-max-extractor-empty">Os trechos extraídos aparecerão aqui para prévia e download.</p>}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="forge-max-extractor-panel forge-max-extractor-welcome"><Film size={36} /><h2>Adicione o primeiro vídeo</h2><p>A timeline será montada assim que a prévia ficar pronta.</p></section>
      )}
    </div>
  );
}

export default ForgeMaxExtractor;
