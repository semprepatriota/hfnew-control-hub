import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Clock3, ListVideo, Pause, Play, RotateCcw, Scissors, SkipBack, SkipForward, X } from 'lucide-react';

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function buildClipTransform(clip) {
  if (!clip) return undefined;
  const translateX = clamp(clip.frame_x ?? 0, -1, 1) * 12;
  const translateY = clamp(clip.frame_y ?? 0, -1, 1) * 12;
  const zoom = clamp(clip.frame_zoom ?? 1, 1, 2.5);
  const transforms = [`translate(${translateX}%, ${translateY}%)`, `scale(${zoom})`];
  if (clip.flip_horizontal) transforms.push('scaleX(-1)');
  if (clip.flip_vertical) transforms.push('scaleY(-1)');
  return transforms.join(' ');
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
  onSplitScenes,
}) {
  const totalDuration = clips.reduce((total, clip) => total + (
    Math.max(0, clip.end_seconds - clip.start_seconds) / Math.max(Number(clip.speed || 1), 0.5)
  ), 0);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || clips[0] || null;
  const selectedAsset = assets.find((item) => item.id === selectedClip?.asset_id) || null;
  const [draftStart, setDraftStart] = useState(0);
  const [draftEnd, setDraftEnd] = useState(0);
  const [draftVolume, setDraftVolume] = useState(1);
  const [draftSpeed, setDraftSpeed] = useState(1);
  const [draftFlipHorizontal, setDraftFlipHorizontal] = useState(false);
  const [draftFlipVertical, setDraftFlipVertical] = useState(false);
  const [draftFrameZoom, setDraftFrameZoom] = useState(1);
  const [draftFrameX, setDraftFrameX] = useState(0);
  const [draftFrameY, setDraftFrameY] = useState(0);
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
    setDraftVolume(Number(selectedClip.volume ?? 1));
    setDraftSpeed(Number(selectedClip.speed ?? 1));
    setDraftFlipHorizontal(Boolean(selectedClip.flip_horizontal));
    setDraftFlipVertical(Boolean(selectedClip.flip_vertical));
    setDraftFrameZoom(Number(selectedClip.frame_zoom ?? 1));
    setDraftFrameX(Number(selectedClip.frame_x ?? 0));
    setDraftFrameY(Number(selectedClip.frame_y ?? 0));
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

    player.playbackRate = Math.max(0.5, Math.min(2, Number(previewClip.speed || 1)));
    player.volume = Math.max(0, Math.min(1, Number(previewClip.volume ?? 1)));

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
  }, [previewClip?.id, previewClip?.start_seconds, previewClip?.speed, previewClip?.volume, previewClip?.frame_zoom, previewClip?.frame_x, previewClip?.frame_y, previewAsset?.url]);

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
    onTrim(selectedClip.id, {
      start_seconds: nextStart,
      end_seconds: nextEnd,
      volume: Math.max(0, Math.min(2, Number(draftVolume) || 0)),
      speed: Math.max(0.5, Math.min(2, Number(draftSpeed) || 1)),
      flip_horizontal: draftFlipHorizontal,
      flip_vertical: draftFlipVertical,
      frame_zoom: clamp(draftFrameZoom, 1, 2.5),
      frame_x: clamp(draftFrameX, -1, 1),
      frame_y: clamp(draftFrameY, -1, 1),
    });
  };

  const resetDraftTrim = () => {
    if (!selectedAsset) return;
    setDraftStart(0);
    setDraftEnd(Number(selectedAsset.duration) || 0);
    setDraftVolume(1);
    setDraftSpeed(1);
    setDraftFlipHorizontal(false);
    setDraftFlipVertical(false);
    setDraftFrameZoom(1);
    setDraftFrameX(0);
    setDraftFrameY(0);
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
                  style={{
                    transform: buildClipTransform(previewClip),
                  }}
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
              const clipDuration = Math.max(clip.end_seconds - clip.start_seconds, 0.1) / Math.max(Number(clip.speed || 1), 0.5);
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
                <div className="forge-max-timeline-editor-actions-top">
                  <button type="button" className="forge-max-timeline-reset" onClick={resetDraftTrim} disabled={Boolean(busy)}>
                    <RotateCcw size={14} /> Resetar corte
                  </button>
                  <button type="button" className="forge-max-timeline-scene-button" onClick={onSplitScenes} disabled={Boolean(busy)} title="Detectar mudanças de cena e dividir este clipe">
                    <Scissors size={14} /> Separador de cenas
                  </button>
                </div>
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

              <div className="forge-max-timeline-clip-adjustments">
                <label>
                  <span>Volume {Math.round(Number(draftVolume || 0) * 100)}%</span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={draftVolume}
                    onChange={(event) => setDraftVolume(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>Velocidade {Number(draftSpeed || 1).toFixed(2)}x</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.05"
                    value={draftSpeed}
                    onChange={(event) => setDraftSpeed(Number(event.target.value))}
                  />
                </label>
                <label className="forge-max-timeline-toggle">
                  <input
                    type="checkbox"
                    checked={draftFlipHorizontal}
                    onChange={(event) => setDraftFlipHorizontal(event.target.checked)}
                  />
                  Inverter horizontal
                </label>
                <label className="forge-max-timeline-toggle">
                  <input
                    type="checkbox"
                    checked={draftFlipVertical}
                    onChange={(event) => setDraftFlipVertical(event.target.checked)}
                  />
                  Inverter vertical
                </label>
              </div>

              <div className="forge-max-timeline-framing">
                <div className="forge-max-timeline-framing-title">
                  <strong>Enquadramento do clipe</strong>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftFrameZoom(1);
                      setDraftFrameX(0);
                      setDraftFrameY(0);
                    }}
                    disabled={Boolean(busy)}
                  >
                    Centralizar
                  </button>
                </div>
                <label>
                  <span>Zoom {Math.round(Number(draftFrameZoom || 1) * 100)}%</span>
                  <input type="range" min="1" max="2.5" step="0.01" value={draftFrameZoom} onChange={(event) => setDraftFrameZoom(Number(event.target.value))} />
                </label>
                <label>
                  <span>Posição X {Math.round(Number(draftFrameX || 0) * 100)}</span>
                  <input type="range" min="-1" max="1" step="0.01" value={draftFrameX} onChange={(event) => setDraftFrameX(Number(event.target.value))} />
                </label>
                <label>
                  <span>Posição Y {Math.round(Number(draftFrameY || 0) * 100)}</span>
                  <input type="range" min="-1" max="1" step="0.01" value={draftFrameY} onChange={(event) => setDraftFrameY(Number(event.target.value))} />
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
