import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Clock3, Eye, ListPlus, ListVideo, Pause, Play, RotateCcw, Scissors, SkipBack, SkipForward, X } from 'lucide-react';

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

function buildClipPreviewUrl(asset, clip, resolveAssetUrl) {
  const match = String(asset?.url || '').match(/\/api\/forge-max\/projects\/([^/]+)\/files\/library\//);
  if (!match) return '';
  const cacheKey = `${Math.round(Number(clip.start_seconds || 0) * 1000)}-${Math.round(Number(clip.end_seconds || 0) * 1000)}`;
  const path = `/api/forge-max/projects/${encodeURIComponent(match[1])}/files/timeline/clip-preview/${encodeURIComponent(clip.id)}.jpg`;
  const url = resolveAssetUrl(path);
  return `${url}${url.includes('?') ? '&' : '?'}v=${cacheKey}`;
}

function buildScenePreviewUrl(asset, clipId, scene, resolveAssetUrl) {
  const match = String(asset?.url || '').match(/\/api\/forge-max\/projects\/([^/]+)\/files\/library\//);
  if (!match || !clipId) return '';
  const start = Math.round(Number(scene.start_seconds || 0) * 1000);
  const end = Math.round(Number(scene.end_seconds || 0) * 1000);
  const path = `/api/forge-max/projects/${encodeURIComponent(match[1])}/files/timeline/scene-preview/${encodeURIComponent(clipId)}.jpg?start_seconds=${start / 1000}&end_seconds=${end / 1000}`;
  const url = resolveAssetUrl(path);
  return `${url}${url.includes('?') ? '&' : '?'}v=${start}-${end}`;
}

function TimelineClipCard({
  asset,
  clip,
  index,
  canMoveNext,
  selected,
  busy,
  resolveAssetUrl,
  onSelect,
  onMove,
  onRemove,
}) {
  const previewRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const clipDuration = Math.max(clip.end_seconds - clip.start_seconds, 0.1) / Math.max(Number(clip.speed || 1), 0.5);
  const previewImageUrl = buildClipPreviewUrl(asset, clip, resolveAssetUrl);
  const isTimer = clip.segment_type === 'timer';

  const seekToCutStart = async () => {
    const player = previewRef.current;
    if (!player) return;
    if (player.readyState < 1) {
      await new Promise((resolve) => {
        const timer = window.setTimeout(resolve, 900);
        player.addEventListener('loadedmetadata', () => {
          window.clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }
    const requestedStart = Number(clip.start_seconds) || 0;
    const duration = Number.isFinite(player.duration) ? player.duration : requestedStart;
    const start = Math.min(requestedStart, duration);
    if (Math.abs(player.currentTime - start) < 0.03) return;
    await new Promise((resolve) => {
      let complete = false;
      const finish = () => {
        if (complete) return;
        complete = true;
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(finish, 350);
      player.addEventListener('seeked', finish, { once: true });
      player.currentTime = start;
    });
  };

  const togglePreview = async (event) => {
    event.stopPropagation();
    const player = previewRef.current;
    if (!player) return;
    if (player.paused) {
      setPlaying(true);
      await seekToCutStart();
      player.playbackRate = Math.max(0.5, Math.min(2, Number(clip.speed || 1)));
      player.volume = Math.max(0, Math.min(1, Number(clip.volume ?? 1)));
      await player.play().catch(() => setPlaying(false));
      return;
    }
    player.pause();
  };

  const handleTimeUpdate = (event) => {
    const end = Number(clip.end_seconds) || 0;
    if (end > 0 && event.currentTarget.currentTime >= end) {
      event.currentTarget.pause();
      setPlaying(false);
    }
  };

  return (
    <article
      className={`forge-max-timeline-clip ${isTimer ? 'timer' : ''} ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(clip)}
    >
      <div className="forge-max-timeline-clip-preview">
        {!playing && previewImageUrl && (
          <img
            src={previewImageUrl}
            alt={clip.segment_label || `Prévia do corte ${index + 1}`}
            className="forge-max-timeline-clip-image"
            loading="lazy"
          />
        )}
        <video
          ref={previewRef}
          src={resolveAssetUrl(asset.url)}
          preload="metadata"
          playsInline
          className={`forge-max-timeline-clip-video ${playing ? 'playing' : ''}`}
          style={{ transform: buildClipTransform(clip) }}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        <button
          type="button"
          className="forge-max-timeline-clip-play"
          onClick={togglePreview}
          disabled={Boolean(busy)}
          aria-label={playing ? `Pausar clipe ${index + 1}` : `Reproduzir clipe ${index + 1}`}
          title={playing ? 'Pausar este corte' : 'Reproduzir este corte'}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <span className="forge-max-timeline-clip-order">{index + 1}</span>
        <button
          type="button"
          className="forge-max-timeline-clip-delete"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(clip.id);
          }}
          disabled={Boolean(busy)}
          aria-label={`Excluir corte ${index + 1}`}
          title="Excluir este corte"
        >
          <X size={14} />
        </button>
      </div>
      <div className="forge-max-timeline-clip-title">
        <span>{clip.segment_label || `V${index + 1}`}</span>
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
        <button type="button" className={`forge-max-timeline-select ${selected ? 'selected' : ''}`} onClick={() => onSelect(clip)} disabled={Boolean(busy)}>
          <Eye size={14} /> {selected ? 'Selecionado' : 'Selecionar'}
        </button>
        {isTimer ? (
          <span className="forge-max-timeline-timer-lock"><Clock3 size={13} /> Fixo</span>
        ) : (
          <>
            <button type="button" onClick={() => onMove(clip.id, -1)} disabled={index === 0 || Boolean(busy)} aria-label="Mover corte para trás" title="Mover para trás"><ArrowUp size={14} /></button>
            <button type="button" onClick={() => onMove(clip.id, 1)} disabled={!canMoveNext || Boolean(busy)} aria-label="Mover corte para frente" title="Mover para frente"><ArrowDown size={14} /></button>
          </>
        )}
      </div>
    </article>
  );
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
  sceneThreshold = 0.25,
  onSceneThresholdChange,
  sceneSelection,
  selectedSceneIds = [],
  previewSceneId,
  onPreviewScene,
  onToggleScene,
  onCommitScenes,
  onDiscardScenes,
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
  const sceneChoices = sceneSelection?.scenes || [];

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
          <h2>Cortes da Timeline</h2>
          <p>Organize os cortes e a ordem. A área de vídeo única fica acima, em Timeline de Edição.</p>
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
            aria-label={collapsed ? 'Abrir cortes da timeline' : 'Recolher cortes da timeline'}
          >
            {collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
          </button>
        </div>
      </div>

      {!collapsed && sceneChoices.length > 0 && (
        <section className="forge-max-scene-bank">
          <div className="forge-max-scene-bank-header">
            <div>
              <span className="forge-max-section-icon"><Scissors size={16} /></span>
              <h3>Cenas e TIME detectados</h3>
              <p>Os blocos TIME ficam preservados. Selecione somente as cenas de conteúdo que entrarão na timeline.</p>
            </div>
            <div className="forge-max-scene-bank-actions">
              <span>{selectedSceneIds.length}/{sceneChoices.length} selecionada(s)</span>
              <button type="button" className="forge-max-scene-commit" onClick={onCommitScenes} disabled={!selectedSceneIds.length || Boolean(busy)}>
                <ListPlus size={15} /> Puxar {selectedSceneIds.length || ''} corte(s) para timeline
              </button>
              <button type="button" className="forge-max-scene-discard" onClick={onDiscardScenes} disabled={Boolean(busy)} title="Descartar seleção de cenas">
                <X size={15} /> Descartar
              </button>
            </div>
          </div>
          <div className="forge-max-scene-bank-grid">
            {sceneChoices.map((scene) => {
              const selectionOrder = selectedSceneIds.indexOf(scene.id);
              const isSelected = selectionOrder >= 0;
              const isPreviewing = scene.id === previewSceneId;
              const isTimer = scene.segment_type === 'timer';
              const sceneAsset = assets.find((item) => item.id === sceneSelection?.asset_id);
              const previewImageUrl = buildScenePreviewUrl(sceneAsset, sceneSelection?.clip_id, scene, resolveAssetUrl);
              return (
                <article key={scene.id} className={`forge-max-scene-card ${isTimer ? 'timer' : ''} ${isPreviewing ? 'previewing' : ''} ${isSelected ? 'chosen' : ''}`}>
                  <button type="button" className="forge-max-scene-preview" onClick={() => onPreviewScene?.(scene)} disabled={Boolean(busy)}>
                    {previewImageUrl && (
                      <img
                        src={previewImageUrl}
                        alt={`Prévia da cena ${scene.index}`}
                        className="forge-max-scene-thumbnail"
                        loading="lazy"
                      />
                    )}
                    <span>{scene.segment_label || (isTimer ? 'TIME' : `Cena ${String(scene.index).padStart(2, '0')}`)}</span>
                    <strong>{formatDuration(scene.start_seconds)} - {formatDuration(scene.end_seconds)}</strong>
                    <small>{formatDuration(scene.end_seconds - scene.start_seconds)}</small>
                    <Eye size={15} />
                  </button>
                  {isTimer ? (
                    <span className="forge-max-scene-timer-fixed"><Clock3 size={14} /> Mantido entre cenas</span>
                  ) : (
                    <button type="button" className={`forge-max-scene-select ${isSelected ? 'selected' : ''}`} onClick={() => onToggleScene?.(scene)} disabled={Boolean(busy)}>
                      {isSelected ? <><Check size={14} /> Incluída</> : 'Incluir cena'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {collapsed ? null : !clips.length ? (
        <div className="forge-max-timeline-empty">
          <Scissors size={26} />
          <strong>A timeline está vazia</strong>
          <span>Selecione um vídeo da biblioteca, ajuste o corte no preview e use “Puxar corte para timeline”.</span>
        </div>
      ) : (
        <>
          <div className="forge-max-timeline-cuts-header">
            <div>
              <strong>Prévia dos cortes na timeline</strong>
              <span>Clique em um corte para ajustar início, fim, enquadramento ou volume. O play reproduz somente aquele trecho.</span>
            </div>
            <span>{formatDuration(totalDuration)} no total</span>
          </div>
          <div className="forge-max-timeline-track">
            {clips.map((clip, index) => {
              const asset = assets.find((item) => item.id === clip.asset_id);
              if (!asset) return null;
              return (
                <TimelineClipCard
                  key={clip.id}
                  asset={asset}
                  clip={clip}
                  index={index}
                  canMoveNext={index < clips.length - 1}
                  selected={clip.id === selectedClipId}
                  busy={busy}
                  resolveAssetUrl={resolveAssetUrl}
                  onSelect={onSelect}
                  onMove={onMove}
                  onRemove={onRemove}
                />
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
                  <div className="forge-max-scene-split-controls">
                    <label title="Menor valor encontra mais mudanças de cena">
                      <span>Sensibilidade {Number(sceneThreshold).toFixed(2)}</span>
                      <input
                        type="range"
                        min="0.10"
                        max="0.70"
                        step="0.05"
                        value={sceneThreshold}
                        onChange={(event) => onSceneThresholdChange?.(Number(event.target.value))}
                        disabled={Boolean(busy)}
                      />
                    </label>
                    <button type="button" className="forge-max-timeline-scene-button" onClick={onSplitScenes} disabled={Boolean(busy)} title="Detectar e separar todas as mudanças de cena deste trecho">
                      <Scissors size={14} /> Separar cenas
                    </button>
                  </div>
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
