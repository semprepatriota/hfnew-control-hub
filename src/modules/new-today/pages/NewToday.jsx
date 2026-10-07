import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { CheckCircle2, Download, FileImage, FileVideo2, Loader2, RotateCcw, ScanSearch, ScanText, Upload, Video } from 'lucide-react';
import { NewTodayComposition } from '../remotion/NewTodayComposition';
import { durationForMedia, NEW_TODAY_FPS } from '../remotion/timeline';
import { analyzeNewTodayMaterial, createNewTodayRender, downloadNewTodayRender, loadNewTodayRender, readNewTodayRender } from '../services/newTodayApi';
import { materialSamples, readMediaText } from '../services/readMediaText';
import './new-today.css';

const MAX_VIDEO_SECONDS = 180;
const MAX_FILE_BYTES = 300 * 1024 ** 2;

function fileDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a duração deste vídeo.'));
    };
    video.src = url;
  });
}

export default function NewToday() {
  const pickerRef = useRef(null);
  const playerRef = useRef(null);
  const currentMediaRef = useRef('');
  const analysisRunRef = useRef(0);
  const [file, setFile] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [seconds, setSeconds] = useState(0);
  const [headline, setHeadline] = useState('');
  const [source, setSource] = useState('');
  const [extracted, setExtracted] = useState('');
  const [brand, setBrand] = useState('NEW TODAY');
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [reading, setReading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [renderJob, setRenderJob] = useState(null);
  const [renderedUrl, setRenderedUrl] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const durationInFrames = durationForMedia(mediaType, seconds);

  useEffect(() => () => { if (currentMediaRef.current) URL.revokeObjectURL(currentMediaRef.current); }, []);
  useEffect(() => {
    if (renderJob?.status !== 'completed') return undefined;
    let active = true;
    let url = '';
    loadNewTodayRender(renderJob.id).then((loaded) => {
      if (!active) { URL.revokeObjectURL(loaded); return; }
      url = loaded;
      setRenderedUrl(loaded);
    }).catch((cause) => { if (active) setError(cause.message); });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [renderJob?.id, renderJob?.status]);
  useEffect(() => {
    if (!renderJob?.id || ['completed', 'failed'].includes(renderJob.status)) return undefined;
    const timer = window.setInterval(async () => {
      try { setRenderJob(await readNewTodayRender(renderJob.id)); }
      catch (cause) { setError(cause.message); window.clearInterval(timer); }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [renderJob?.id, renderJob?.status]);

  const props = useMemo(() => ({
    mediaSrc: mediaUrl, mediaType, headline, source, brand, positionX, positionY,
    durationInFrames,
  }), [mediaUrl, mediaType, headline, source, brand, positionX, positionY, durationInFrames]);

  async function extractText(nextFile, nextType, nextSeconds) {
    setReading(true);
    try {
      const text = await readMediaText(nextFile, nextType, nextSeconds);
      setExtracted(text);
      if (!text) setError('Não encontrei texto legível. Informe a manchete e a fonte antes de renderizar.');
    } catch (cause) {
      setError(`Leitura automática indisponível: ${cause.message}`);
    } finally {
      setReading(false);
    }
  }

  async function chooseFile(event) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    analysisRunRef.current += 1;
    setAnalysis(null);
    setAnalyzing(false);
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(nextFile.type)) {
      setError('Selecione JPG, PNG, WebP, MP4 ou WebM.');
      return;
    }
    if (nextFile.size > MAX_FILE_BYTES) {
      setError('Arquivo acima do limite de 300 MB desta fase de testes.');
      return;
    }
    const nextType = nextFile.type.startsWith('video/') ? 'video' : 'image';
    let nextSeconds = 0;
    if (nextType === 'video') {
      try { nextSeconds = await fileDuration(nextFile); }
      catch (cause) { setError(cause.message); return; }
      if (!Number.isFinite(nextSeconds) || nextSeconds <= 0 || nextSeconds > MAX_VIDEO_SECONDS) {
        setError('O vídeo precisa ter até 3 minutos.');
        return;
      }
    }
    if (currentMediaRef.current) URL.revokeObjectURL(currentMediaRef.current);
    const url = URL.createObjectURL(nextFile);
    currentMediaRef.current = url;
    setFile(nextFile);
    setMediaUrl(url);
    setMediaType(nextType);
    setSeconds(nextSeconds);
    setExtracted('');
    setHeadline('');
    setSource('');
    setConfirmed(false);
    setRenderJob(null);
    setRenderedUrl('');
    void extractText(nextFile, nextType, nextSeconds);
  }

  async function analyzeMaterial() {
    if (!file || reading || analyzing) return;
    const run = ++analysisRunRef.current;
    setAnalyzing(true);
    setAnalysis(null);
    setError('');
    try {
      const imageSamples = await materialSamples(file, mediaType, seconds);
      const result = await analyzeNewTodayMaterial({
        extracted_text: extracted.slice(0, 8000),
        source_hint: source.trim(),
        image_samples: imageSamples,
      });
      if (run === analysisRunRef.current) setAnalysis(result);
    } catch (cause) {
      if (run === analysisRunRef.current) setError(`Análise do material: ${cause.message}`);
    } finally {
      if (run === analysisRunRef.current) setAnalyzing(false);
    }
  }

  function applyAnalysis() {
    if (!analysis) return;
    if (analysis.headline) setHeadline(analysis.headline);
    if (analysis.source && !source.trim()) setSource(analysis.source);
    setConfirmed(false);
  }

  async function startRender() {
    if (!file || !headline.trim() || !source.trim() || !confirmed) {
      setError('Confira a manchete e a fonte da notícia e confirme antes de renderizar.');
      return;
    }
    setRendering(true);
    setError('');
    try {
      const result = await createNewTodayRender(file, {
        mediaType, mediaSeconds: seconds, headline: headline.trim(), source: source.trim(), brand: brand.trim(),
        positionX, positionY, durationInFrames,
      });
      setRenderJob(result);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="new-today-page">
      <header className="new-today-header"><h1>NEW TODAY</h1><span>Editor de notícia</span></header>
      {error && <div className="new-today-error" role="alert">{error}</div>}
      <div className="new-today-layout">
        <section className="new-today-editor" aria-label="Mídia e notícia">
          <h2>Mídia</h2>
          <input ref={pickerRef} type="file" accept="image/*,video/*" onChange={chooseFile} hidden />
          <button type="button" className="new-today-upload" onClick={() => pickerRef.current?.click()}>
            {mediaType === 'video' && file ? <FileVideo2 size={21} /> : file ? <FileImage size={21} /> : <Upload size={21} />}
            <span>{file?.name || 'Inserir imagem ou vídeo'}</span>
          </button>
          {file && <p className="new-today-meta">{mediaType === 'video' ? `${seconds.toFixed(1)} s de vídeo` : 'Imagem'} · saída 1080 × 1920</p>}
          <button type="button" className="new-today-analyze-button" onClick={analyzeMaterial} disabled={!file || reading || analyzing || rendering}>
            {reading || analyzing ? <Loader2 size={17} className="new-today-spin" /> : <ScanSearch size={17} />}
            {reading ? 'Lendo texto' : analyzing ? 'Analisando material' : 'Analisar material'}
          </button>
          {analysis && <section className="new-today-analysis" aria-label="Resultado da análise">
            <h3>Análise do material</h3>
            <dl>
              <div><dt>Manchete sugerida</dt><dd>{analysis.headline || 'Não identificada'}</dd></div>
              <div><dt>Fonte</dt><dd>{analysis.source || 'Não identificada'}{analysis.source_status === 'informed' && ' · informada por você'}</dd></div>
            </dl>
            {analysis.evidence?.length > 0 && <div className="new-today-evidence"><strong>Trechos encontrados</strong><ul>{analysis.evidence.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>}
            {analysis.warning && <p className="new-today-analysis-warning">{analysis.warning}</p>}
            <button type="button" onClick={applyAnalysis} disabled={!analysis.headline && !analysis.source}>Usar sugestões</button>
          </section>}
          <div className="new-today-fields">
            <label>Manchete<input value={headline} maxLength={180} onChange={(event) => { setHeadline(event.target.value); setConfirmed(false); }} placeholder="Título da notícia" /></label>
            <label>Fonte<input value={source} maxLength={240} onChange={(event) => { setSource(event.target.value); setAnalysis(null); setConfirmed(false); }} placeholder="Veículo, site ou link da reportagem" /></label>
            <label>Nome na abertura<input value={brand} maxLength={36} onChange={(event) => setBrand(event.target.value)} /></label>
          </div>
          <details className="new-today-text-read">
            <summary><ScanText size={16} /> Texto identificado {reading && <Loader2 size={14} className="new-today-spin" />}</summary>
            <p>Confira o texto antes de usar qualquer informação na manchete.</p>
            <textarea value={extracted} onChange={(event) => { setExtracted(event.target.value); setAnalysis(null); }} placeholder="O texto da imagem ou dos quadros do vídeo aparece aqui." rows={8} />
            <button type="button" onClick={() => { setHeadline(extracted.split(/\r?\n/).find((line) => line.length > 15)?.slice(0, 180) || ''); setConfirmed(false); }} disabled={!extracted}>Usar primeira linha como manchete</button>
            {file && <button type="button" onClick={() => extractText(file, mediaType, seconds)} disabled={reading}><RotateCcw size={14} /> Ler novamente</button>}
          </details>
          <details className="new-today-crop">
            <summary>Enquadramento</summary>
            <label>Horizontal {positionX}%<input type="range" min="0" max="100" value={positionX} onChange={(event) => setPositionX(Number(event.target.value))} /></label>
            <label>Vertical {positionY}%<input type="range" min="0" max="100" value={positionY} onChange={(event) => setPositionY(Number(event.target.value))} /></label>
          </details>
          <label className="new-today-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Confirmei a manchete e a fonte da notícia.</label>
          <button type="button" className="new-today-render" onClick={startRender} disabled={!file || rendering || ['queued', 'running'].includes(renderJob?.status)}>
            {rendering || ['queued', 'running'].includes(renderJob?.status) ? <Loader2 className="new-today-spin" size={18} /> : <Video size={18} />}
            {rendering ? 'Enviando' : renderJob?.status === 'queued' ? 'Na fila' : renderJob?.status === 'running' ? 'Renderizando' : 'Renderizar MP4'}
          </button>
          {renderJob?.status === 'failed' && <p className="new-today-error" role="alert">{renderJob.error || 'Renderização falhou.'}</p>}
        </section>
        <section className="new-today-preview" aria-label="Prévia e vídeo final">
          <div className="new-today-preview-head"><h2>Prévia</h2><span>{(durationInFrames / NEW_TODAY_FPS).toFixed(1)} s</span></div>
          <div className="new-today-player">
            <Player ref={playerRef} component={NewTodayComposition} inputProps={props} compositionWidth={1080} compositionHeight={1920} fps={NEW_TODAY_FPS} durationInFrames={durationInFrames} controls autoPlay={false} style={{ width: '100%', aspectRatio: '9 / 16' }} />
          </div>
          {renderJob?.status === 'completed' && <div className="new-today-final"><div className="new-today-ready"><CheckCircle2 size={18} /> MP4 pronto <button type="button" disabled={!renderedUrl} onClick={() => downloadNewTodayRender(renderedUrl, renderJob.filename)}><Download size={16} /> Baixar MP4</button></div>{renderedUrl ? <video src={renderedUrl} controls playsInline preload="metadata" aria-label="Vídeo final renderizado" /> : <p>Carregando vídeo final...</p>}</div>}
        </section>
      </div>
    </div>
  );
}
