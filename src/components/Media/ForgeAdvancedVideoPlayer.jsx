import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader, Pause, Play, ScanLine } from 'lucide-react';
import {
  MediaOutlet,
  MediaPlayButton,
  MediaPlayer,
  MediaPoster,
  MediaTime,
  MediaTimeSlider,
} from '@vidstack/react';
import './ForgeAdvancedVideoPlayer.css';


function formatTime(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}


function eventNumber(event, key, fallback = 0) {
  const detail = event?.detail;
  if (typeof detail === 'number') return detail;
  const value = detail?.[key] ?? event?.target?.[key] ?? fallback;
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}


export default function ForgeAdvancedVideoPlayer({
  source,
  poster = '',
  title = 'Vídeo selecionado',
  duration: suppliedDuration = 0,
  sceneAnalysis = null,
  onAnalyzeScenes,
}) {
  const playerRef = useRef(null);
  const playbackRangeRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Math.max(0, Number(suppliedDuration) || 0));
  const scenes = useMemo(
    () => (Array.isArray(sceneAnalysis?.scenes) ? sceneAnalysis.scenes : []),
    [sceneAnalysis?.scenes],
  );

  useEffect(() => {
    playbackRangeRef.current = null;
    setCurrentTime(0);
    setDuration(Math.max(0, Number(suppliedDuration) || 0));
  }, [source, suppliedDuration]);

  const playScene = async (scene) => {
    const player = playerRef.current;
    if (!player) return;
    const start = Math.max(0, Number(scene.start_seconds) || 0);
    const end = Math.max(start, Number(scene.end_seconds) || start);
    playbackRangeRef.current = { start, end };
    player.currentTime = start;
    setCurrentTime(start);
    try {
      await player.play();
    } catch {
      // O navegador pode exigir um segundo clique quando o áudio está ativo.
    }
  };

  const handleTimeUpdate = (event) => {
    const next = eventNumber(event, 'currentTime', playerRef.current?.currentTime || 0);
    setCurrentTime(next);
    const range = playbackRangeRef.current;
    if (range && next >= range.end - 0.04) {
      const player = playerRef.current;
      if (!player) return;
      player.pause();
      player.currentTime = range.start;
      setCurrentTime(range.start);
      playbackRangeRef.current = null;
    }
  };

  const status = sceneAnalysis?.status || 'idle';
  const isAnalyzing = ['queued', 'started', 'analyzing'].includes(status);

  return (
    <div className="forge-advanced-video">
      <MediaPlayer
        ref={playerRef}
        className="forge-advanced-player"
        src={source}
        poster={poster || undefined}
        title={title}
        load="visible"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={(event) => setDuration(eventNumber(event, 'duration', suppliedDuration))}
      >
        <MediaOutlet>
          {poster && <MediaPoster src={poster} alt="Prévia do vídeo selecionado" />}
        </MediaOutlet>
        <div className="forge-player-controls">
          <MediaPlayButton className="forge-player-icon-button" aria-label="Reproduzir ou pausar vídeo">
            <Play size={17} slot="play" />
            <Pause size={17} slot="pause" />
          </MediaPlayButton>
          <MediaTimeSlider className="forge-player-time-slider" aria-label="Posição do vídeo">
            <div slot="track" className="forge-player-slider-track" />
            <div slot="track-fill" className="forge-player-slider-fill" />
            <div slot="thumb" className="forge-player-slider-thumb" />
          </MediaTimeSlider>
          <div className="forge-player-time-label">
            <MediaTime type="current" />
            <span>/</span>
            <MediaTime type="duration" />
          </div>
        </div>
      </MediaPlayer>

      <div className="forge-scene-toolbar">
        <div>
          <strong>Timeline de cenas</strong>
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
        <button type="button" onClick={onAnalyzeScenes} disabled={isAnalyzing || !source}>
          {isAnalyzing ? <Loader size={15} className="spinner" /> : <ScanLine size={15} />}
          {isAnalyzing ? 'Analisando cenas...' : scenes.length ? 'Analisar novamente' : 'Detectar cenas'}
        </button>
      </div>

      <div className="forge-scene-track" aria-label="Cenas detectadas no vídeo">
        <span
          className="forge-scene-playhead"
          style={{ left: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
        />
        {scenes.length ? scenes.map((scene, index) => {
          const start = Math.max(0, Number(scene.start_seconds) || 0);
          const end = Math.max(start, Number(scene.end_seconds) || start);
          const width = duration > 0 ? Math.max(1.2, ((end - start) / duration) * 100) : 100 / scenes.length;
          const left = duration > 0 ? (start / duration) * 100 : (index / scenes.length) * 100;
          return (
            <button
              key={scene.id || `${start}-${end}`}
              type="button"
              className="forge-scene-segment"
              style={{ left: `${left}%`, width: `${Math.min(100 - left, width)}%` }}
              onClick={() => playScene(scene)}
              title={`Cena ${index + 1}: ${formatTime(start)} até ${formatTime(end)}`}
              aria-label={`Assistir cena ${index + 1}`}
            >
              <span>{index + 1}</span>
            </button>
          );
        }) : (
          <div className="forge-scene-empty">
            {sceneAnalysis?.status === 'failed'
              ? (sceneAnalysis.error || 'Não foi possível analisar este vídeo.')
              : 'A detecção só começa quando você clicar no botão.'}
          </div>
        )}
      </div>
      {scenes.length > 0 && <small className="forge-scene-hint">Clique em uma cena para assistir somente aquele trecho.</small>}
    </div>
  );
}
