import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Clock3, ListVideo, Pause, Play, RotateCcw, Scissors, SkipBack, SkipForward, X } from 'lucide-react';

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function ForgeMaxTimeline({
  assets,
  clips,
  selectedClipId,
  busy,
  collapsed = false,
  onToggleCollapse,
  resolveAssetUrl,
  onSelect,
  onMove,
  onRemove,
  onTrim,
}) {
  const totalDuration = clips.reduce((total, clip) => total + Math.max(0, clip.end_seconds - clip.start_seconds), 0);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || clips[0] || null;
  const selectedAsset = assets.find((item) => item.id === selectedClip?.asset_id) || null;
  const [draftStart, setDraftStart] = useState(0);
  const [draftEnd, setDraftEnd] = useState(0);
  const [previewClipIndex, setPreviewClipIndex] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const timelinePreviewRef = useRef(null);

  const previewClip = clips[previewClipIndex] || null;
  const previewAsset = assets.find((item) => item.id === previewClip?.asset_id) || null;

  useEffect(() => {
    if (!selectedClip) {
      setDraftStart(0);
      setDraftEnd(0);
      return;
    }
    setDraftStart(Number(selectedClip.start_seconds) || 0);
    setDraftEnd(Number(selectedClip.end_seconds) || 0);
  }, [selectedClip?.id, selectedClip?.start_seconds, selectedClip?.end_seconds]);

  useEffect(() => {
    if (!clips.length) {
      setPreviewClipIndex(0);
      return;
    }
    if (!selectedClipId) return;
    const nextIndex = clips.findIndex((clip) => clip.id === selectedClipId);
    if (nextIndex >= 0) {
      setPreviewClipIndex(nextIndex);
    }
  }, [clips, selectedClipId]);

  useEffect(() => {
    const player = timelinePreviewRef.current;
    if (!player || !previewClip) return;

    const syncPreview = () => {
      const nextTime = Math.min(previewClip.start_seconds, player.duration || previewClip.start_seconds || 0);
      player.currentTime = nextTime;
    };

    if (player.readyState >= 1) {
      syncPreview();
      return;
    }

    player.addEventListener('loadedmetadata', syncPreview, { once: true });
    return () => player.removeEventListener('loadedmetadata', syncPreview);
  }, [previewClip?.id, previewClip?.start_seconds, previewAsset?.url]);

  const timelineRuler = useMemo(() => {
    if (!clips.length || totalDuration <= 0) return [];
    const steps = Math.min(Math.max(Math.ceil(totalDuration), 2), 12);
    return Array.from({ length: steps + 1 }, (_, index) => {
      const seconds = (totalDuration / steps) * index;
      return {
        key: `mark-${index}`,
        seconds,
        left: `${(index / steps) * 100}%`,
      };
    });
  }, [clips.length, totalDuration]);

  const applyDraftTrim = () => {
    if (!selectedClip || !selectedAsset) return;
    const durationMax = Number(selectedAsset.duration) || 0;
    let nextStart = Math.max(0, Math.min(durationMax, Number(draftStart) || 0));
    let nextEnd = Math.max(0.1, Math.min(durationMax || Number(draftEnd) || 0, Number(draftEnd) || 0));
    if (nextEnd <= nextStart) {
      nextEnd = Math.min(durationMax || nextStart + 0.1, nextStart + 0.1);
    }
    onTrim(selectedClip.id, { start_seconds: nextStart, end_seconds: nextEnd });
  };

  const resetDraftTrim = () => {
    if (!selectedAsset) return;
    setDraftStart(0);
    setDraftEnd(Number(selectedAsset.duration) || 0);
  };

  const stepPreviewClip = (direction) => {
    if (!clips.length) return;
    setPreviewClipIndex((current) => {
      const nextIndex = Math.max(0, Math.min(clips.length - 1, current + direction));
      return nextIndex;
    });
    setPreviewPlaying(false);
  };

  const toggleTimelinePreviewPlayback = async () => {
    const player = timelinePreviewRef.current;
    if (!player || !previewClip) return;
    if (player.paused) {
      await player.play().catch(() => {});
      setPreviewPlaying(true);
      return;
    }
    player.pause();
    setPreviewPlaying(false);
  };

  const handleTimelinePreviewTimeUpdate = (event) => {
    if (!previewClip) return;
    const current = event.currentTarget.currentTime;
    if (current < previewClip.end_seconds) return;
    const nextIndex = previewClipIndex + 1;
    if (nextIndex < clips.length) {
      setPreviewClipIndex(nextIndex);
      setPreviewPlaying(true);
      return;
    }
    event.currentTarget.pause();
    event.currentTarget.currentTime = previewClip.start_seconds;
    setPreviewPlaying(false);
  };

  const handleTimelinePreviewLoaded = (event) => {
    if (!previewClip) return;
    event.currentTarget.currentTime = Math.min(previewClip.start_seconds, event.currentTarget.duration || previewClip.start_seconds || 0);
    if (previewPlaying) {
      event.currentTarget.play().catch(() => {});
    }
  };

  return (
    <section className={`forge-max-timeline-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="forge-max-timeline-header">
        <div>
          <span className="forge-max-section-icon"><ListVideo size={17} /></span>
          <h2>Timeline de Edição</h2>
          <p>Organize a ordem e os cortes. Cada alteração é salva no projeto atual.</p>
        </div>
        <div className="forge-max-timeline-header-actions">
          <div className="forge-max-timeline-summary">
            <Clock3 size={15} />
            <strong>{clips.length} clipes</strong>
            <span>{formatDuration(totalDuration)}</span>
          </div>
          <button
            type="button"
            className="forge-max-collapse"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Abrir timeline de edição' : 'Recolher timeline de edição'}
          >
            {collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
          </button>
        </div>
      </div>

      {collapsed ? null : !clips.length ? (
        <div className="forge-max-timeline-empty">
          <Scissors size={26} />
          <strong>A timeline está vazia</strong>
          <span>Selecione um vídeo da biblioteca, ajuste o corte no preview e use “Puxar corte para timeline”.</span>
        </div>
      ) : (
        <>
          {previewClip && previewAsset && (
            <div className="forge-max-timeline-preview-panel">
              <div className="forge-max-timeline-preview-header">
                <div>
                  <strong>Preview da união dos cortes</strong>
                  <span>
                    Clipe {previewClipIndex + 1}/{clips.length} · {previewAsset.filename}
                    {' '}· {formatDuration(previewClip.start_seconds)} - {formatDuration(previewClip.end_seconds)}
                  </span>
                </div>
                <div className="forge-max-timeline-preview-actions">
                  <button type="button" onClick={() => stepPreviewClip(-1)} disabled={previewClipIndex === 0 || Boolean(busy)} title="Clipe anterior">
                    <SkipBack size={14} />
                  </button>
                  <button type="button" onClick={toggleTimelinePreviewPlayback} disabled={Boolean(busy)} title={previewPlaying ? 'Pausar preview' : 'Reproduzir preview'}>
                    {previewPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button type="button" onClick={() => stepPreviewClip(1)} disabled={previewClipIndex === clips.length - 1 || Boolean(busy)} title="Próximo clipe">
                    <SkipForward size={14} />
                  </button>
                </div>
              </div>
              <div className="forge-max-timeline-preview-stage">
                <video
                  ref={timelinePreviewRef}
                  src={resolveAssetUrl(previewAsset.url)}
                  controls
                  playsInline
                  className="forge-max-timeline-preview-video"
                  onLoadedMetadata={handleTimelinePreviewLoaded}
                  onTimeUpdate={handleTimelinePreviewTimeUpdate}
                  onPlay={() => setPreviewPlaying(true)}
                  onPause={() => setPreviewPlaying(false)}
                />
              </div>
            </div>
          )}

          <div className="forge-max-timeline-ruler">
            {timelineRuler.map((mark) => (
              <span key={mark.key} className="forge-max-timeline-ruler-mark" style={{ left: mark.left }}>
                {formatDuration(mark.seconds)}
              </span>
            ))}
          </div>
          <div className="forge-max-timeline-track">
            {clips.map((clip, index) => {
              const asset = assets.find((item) => item.id === clip.asset_id);
              if (!asset) return null;
              const clipDuration = Math.max(clip.end_seconds - clip.start_seconds, 0.1);
              const widthPercent = totalDuration > 0 ? `${(clipDuration / totalDuration) * 100}%` : '100%';
              return (
                <article
                  key={clip.id}
                  className={`forge-max-timeline-clip ${clip.id === selectedClipId ? 'selected' : ''}`}
                  style={{ width: widthPercent, flexGrow: Math.max(clipDuration, 1) }}
                  onClick={() => onSelect(clip)}
                >
                  <div className="forge-max-timeline-clip-title">
                    <span>V{index + 1}</span>
                    <strong title={asset.filename}>{asset.filename}</strong>
                  </div>
                  <div className="forge-max-timeline-clip-meta">
                    <span>{formatDuration(clip.start_seconds)} - {formatDuration(clip.end_seconds)}</span>
                    <span>{formatDuration(clipDuration)}</span>
                  </div>
                  <div className="forge-max-timeline-clip-bar">
                    <div className="forge-max-timeline-clip-fill" />
                  </div>
                  <div className="forge-max-timeline-controls" onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => onMove(clip.id, -1)} disabled={index === 0 || Boolean(busy)} aria-label="Mover clipe para cima" title="Mover para cima"><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => onMove(clip.id, 1)} disabled={index === clips.length - 1 || Boolean(busy)} aria-label="Mover clipe para baixo" title="Mover para baixo"><ArrowDown size={14} /></button>
                    <button type="button" className="forge-max-timeline-remove" onClick={() => onRemove(clip.id)} disabled={Boolean(busy)} aria-label="Remover da timeline" title="Remover da timeline"><X size={14} /></button>
                  </div>
                </article>
              );
            })}
          </div>

          {selectedClip && selectedAsset && (
            <div className="forge-max-timeline-editor">
              <div className="forge-max-timeline-editor-header">
                <div>
                  <strong>{selectedAsset.filename}</strong>
                  <span>
                    Trecho atual: {formatDuration(selectedClip.start_seconds)} - {formatDuration(selectedClip.end_seconds)}
                    {' '}de {formatDuration(selectedAsset.duration)}
                  </span>
                </div>
                <button type="button" className="forge-max-timeline-reset" onClick={resetDraftTrim} disabled={Boolean(busy)}>
                  <RotateCcw size={14} /> Resetar corte
                </button>
              </div>

              <div className="forge-max-timeline-slider-group">
                <label>
                  <span>Início</span>
                  <input
                    type="range"
                    min="0"
                    max={selectedAsset.duration}
                    step="0.1"
                    value={Math.min(draftStart, Math.max(draftEnd - 0.1, 0))}
                    onChange={(event) => setDraftStart(Number(event.target.value))}
                  />
                  <input
                    type="number"
                    min="0"
                    max={selectedAsset.duration}
                    step="0.1"
                    value={draftStart}
                    onChange={(event) => setDraftStart(Number(event.target.value))}
                  />
                </label>

                <label>
                  <span>Fim</span>
                  <input
                    type="range"
                    min="0.1"
                    max={selectedAsset.duration}
                    step="0.1"
                    value={Math.max(draftEnd, Math.min(draftStart + 0.1, selectedAsset.duration))}
                    onChange={(event) => setDraftEnd(Number(event.target.value))}
                  />
                  <input
                    type="number"
                    min="0.1"
                    max={selectedAsset.duration}
                    step="0.1"
                    value={draftEnd}
                    onChange={(event) => setDraftEnd(Number(event.target.value))}
                  />
                </label>
              </div>

              <div className="forge-max-timeline-editor-actions">
                <button type="button" onClick={applyDraftTrim} disabled={Boolean(busy)}>
                  <Scissors size={14} /> Aplicar corte
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default ForgeMaxTimeline;
