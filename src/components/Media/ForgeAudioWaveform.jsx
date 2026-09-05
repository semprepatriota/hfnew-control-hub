import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';
import './ForgeAudioWaveform.css';


export default function ForgeAudioWaveform({ source, fallbackDuration = 0 }) {
  const containerRef = useRef(null);
  const waveRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Math.max(0, Number(fallbackDuration) || 0));

  useEffect(() => {
    let active = true;
    let instance = null;
    setReady(false);
    setFailed(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(Math.max(0, Number(fallbackDuration) || 0));

    if (!source || !containerRef.current) return undefined;

    import('wavesurfer.js').then(({ default: WaveSurfer }) => {
      if (!active || !containerRef.current) return;
      instance = WaveSurfer.create({
        container: containerRef.current,
        url: source,
        height: 64,
        waveColor: '#386d54',
        progressColor: '#39e58c',
        cursorColor: '#ffffff',
        cursorWidth: 2,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        normalize: true,
        dragToSeek: true,
      });
      waveRef.current = instance;
      instance.setVolume(volume);
      instance.on('ready', (seconds) => {
        if (!active) return;
        setReady(true);
        setDuration(Number(seconds) || fallbackDuration || 0);
      });
      instance.on('timeupdate', (seconds) => active && setCurrentTime(Number(seconds) || 0));
      instance.on('play', () => active && setPlaying(true));
      instance.on('pause', () => active && setPlaying(false));
      instance.on('finish', () => active && setPlaying(false));
      instance.on('error', () => active && setFailed(true));
    }).catch(() => active && setFailed(true));

    return () => {
      active = false;
      waveRef.current = null;
      instance?.destroy();
    };
  }, [source, fallbackDuration]);

  const handleVolume = (value) => {
    const next = Math.max(0, Math.min(1, Number(value) || 0));
    setVolume(next);
    waveRef.current?.setVolume(next);
  };

  return (
    <div className="forge-audio-waveform">
      <div className="forge-audio-waveform-heading">
        <strong>Timeline real do áudio</strong>
        <span>{currentTime.toFixed(1)}s / {duration.toFixed(1)}s</span>
      </div>
      <div ref={containerRef} className={`forge-audio-waveform-canvas ${ready ? 'ready' : ''}`} />
      {failed && <audio src={source} controls preload="metadata" className="audio-preview selected" />}
      <div className="forge-audio-waveform-controls">
        <button type="button" onClick={() => waveRef.current?.playPause()} disabled={!ready || failed} title={playing ? 'Pausar áudio' : 'Reproduzir áudio'}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <label>
          <Volume2 size={15} />
          <span>Volume da prévia</span>
          <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => handleVolume(event.target.value)} />
        </label>
      </div>
    </div>
  );
}
