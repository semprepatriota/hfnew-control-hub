import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Download, Film, GripVertical,
  Loader2, Music2, Play, Plus, RotateCcw, Save, Scissors, Trash2, Upload, Volume2, X } from 'lucide-react';
import RankingComposition from './RankingComposition';
import { FPS, WIDTH, HEIGHT, buildTimeline, moveItem } from './timeline.mjs';
import './ranking-pilot.css';
import { createRankingClient } from './client';

const clone = value => JSON.parse(JSON.stringify(value));
const seconds = frames => Number((frames / FPS).toFixed(3));
function Panel({ title, children, initial = true, aside }) {
  const [open, setOpen] = useState(initial);
  return <section className="rp-panel"><header><button className="rp-disclosure" onClick={() => setOpen(!open)} aria-expanded={open}>
    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}<h2>{title}</h2></button>{aside}</header>{open && <div className="rp-panel-body">{children}</div>}</section>;
}
function Icon({ title, onClick, children, disabled = false, danger = false }) {
  return <button type="button" title={title} aria-label={title} className={`rp-icon ${danger ? 'rp-danger' : ''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
function Slider({ title, value, min, max, step = 1, onChange, unit = '' }) {
  return <label className="rp-slider"><span>{title}<output>{Number(value).toFixed(step < 1 ? 2 : 0)}{unit}</output></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}

export default function RankingPilot({ production = false, workspaceId = '' }) {
  const client = useMemo(() => createRankingClient(production), [production]);
  const request = (path, options) => client.request(path.replace(/^\/api\/pilot/, ''), options);
  const key = name => production ? `hfnew:ranking:v1:${workspaceId}:${name}` : `hfnew:ranking-local-pilot:v1:${name}`;
  const mapAsset = asset => ({ ...asset, src: client.media(asset.src), poster: client.media(asset.poster) });
  const mapRender = value => ({ ...value, url: client.media(value.url) });
  const [state, setState] = useState(null);
  const [model, setModel] = useState('classic');
  const [drafts, setDrafts] = useState({});
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const [renders, setRenders] = useState({});
  const [range, setRange] = useState(null);
  const [frame, setFrame] = useState(0);
  const player = useRef(null);
  const upload = useRef(null);
  const target = useRef(null);
  const timer = useRef(null);
  const project = drafts[model];
  const assets = state?.assets ?? {};
  const query = new URLSearchParams(window.location.search);
  const verify = query.has('verify');

  useEffect(() => {
    request('/api/pilot/state').then(data => {
      data.assets = Object.fromEntries(Object.entries(data.assets).map(([id, asset]) => [id, mapAsset(asset)]));
      data.renders = data.renders.map(mapRender);
      const initial = {};
      for (const name of ['classic', 'interludes']) {
        let saved;
        try { saved = JSON.parse(localStorage.getItem(key(name))); buildTimeline(saved, data.assets); } catch { saved = null; }
        initial[name] = saved ?? data.projects?.[name] ?? data.presets[name];
      }
      setState(data); setDrafts(initial);
      setRenders(Object.fromEntries(data.renders.map(render => [render.model, render])));
      if (data.activeJob) { setJob(data.activeJob); pollJob(data.activeJob.id); }
      if (query.get('model') === 'interludes') setModel('interludes');
    }).catch(err => setError(err.message));
    return () => clearTimeout(timer.current);
  }, [production, workspaceId]);
  useEffect(() => {
    if (!project) return;
    try { localStorage.setItem(key(model), JSON.stringify(project)); } catch { setNotice('Não foi possível guardar o rascunho neste navegador.'); }
  }, [project, model]);

  const timelineResult = useMemo(() => {
    try { return { timeline: project ? buildTimeline(project, assets) : null, issue: '' }; }
    catch (err) { return { timeline: null, issue: err.message }; }
  }, [project, assets]);
  const timeline = timelineResult.timeline;
  const current = project?.items.find(item => item.id === selected);
  const render = renders[model];
  const edited = !!render && JSON.stringify(render.project) !== JSON.stringify(project);
  const update = patch => { setDrafts(old => ({ ...old, [model]: { ...old[model], ...patch } })); setNotice(''); setRange(null); };
  const itemUpdate = (id, patch) => update({ items: project.items.map(item => item.id === id ? { ...item, ...patch } : item) });
  const clipUpdate = (id, index, patch) => {
    const item = project.items.find(candidate => candidate.id === id);
    itemUpdate(id, { clips: item.clips.map((clip, n) => n === index ? { ...clip, ...patch } : clip) });
  };
  const safely = action => async () => { setError(''); try { await action(); } catch (err) { setError(err.message); } };

  useEffect(() => {
    const element = player.current;
    if (!element) return;
    const listener = event => {
      setFrame(event.detail.frame);
      if (range && event.detail.frame >= range.end - 1) { element.pause(); setRange(null); }
    };
    element.addEventListener('frameupdate', listener);
    window.rankingPilot = { seek: value => { element.pause(); element.seekTo(value); },
      frame: () => element.getCurrentFrame(), project: () => project, assets: () => assets };
    return () => { element.removeEventListener('frameupdate', listener); delete window.rankingPilot; };
  }, [timeline, range, project, assets, verify]);

  function playItem(item) {
    if (!timeline) return;
    const segments = timeline.segments.filter(segment => segment.itemId === item.id && segment.kind === 'scene');
    if (!segments.length) return;
    setSelected(item.id); setRange({ end: segments.at(-1).from + segments.at(-1).frames });
    player.current.seekTo(segments[0].from); player.current.play();
  }
  function chooseFile(action) { target.current = action; upload.current.accept = action.kind === 'music' ? 'audio/*' : 'video/*'; upload.current.click(); }
  async function receiveFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    setBusy(true); setError('');
    try {
      const asset = mapAsset(await request(`/api/pilot/upload?name=${encodeURIComponent(file.name)}&kind=${target.current.kind === 'interlude' ? 'interlude' : target.current.kind === 'music' ? 'music' : 'scene'}`, { method: 'POST', body: file }));
      setState(old => ({ ...old, assets: { ...old.assets, [asset.id]: asset } }));
      const clip = { assetId: asset.id, startFrame: 0, endFrame: asset.frames, volume: target.current.kind === 'music' ? .18 : .8, x: .5, y: .5, zoom: 1, fit: 'cover' };
      if (target.current.kind === 'music') update({ music: clip });
      else if (target.current.kind === 'interlude') setNotice('Vinheta adicionada à biblioteca.');
      else if (asset.kind === 'music') throw new Error('Escolha um arquivo de vídeo para esta cena.');
      else if (target.current.kind === 'outro') update({ outro: clip });
      else if (target.current.kind === 'new') update({ items: [...project.items, { id: crypto.randomUUID(), label: '', clips: [clip], interlude: null }] });
      else {
        const item = project.items.find(candidate => candidate.id === target.current.itemId);
        itemUpdate(item.id, { clips: target.current.kind === 'append' ? [...item.clips, clip] : [clip] });
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); event.target.value = ''; }
  }
  async function pollJob(id) {
    try {
      const next = await request(`/api/pilot/jobs/${id}`);
      setJob(next);
      if (next.status === 'ready') { setRenders(old => ({ ...old, [next.model]: mapRender(next) })); setJob(null); }
      else if (next.status === 'failed') { setError(next.error); setJob(null); }
      else timer.current = setTimeout(() => pollJob(id), 1000);
    } catch (err) { setError(err.message); setJob(null); }
  }
  async function renderNow() {
    setError('');
    try {
      const created = await request('/api/pilot/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project) });
      setJob({ ...created, progress: 0 });
      await pollJob(created.id);
    } catch (err) { setError(err.message); }
  }
  async function download() {
    if (!render) return;
    setError('');
    try {
      if (!window.showSaveFilePicker) {
        const link = document.createElement('a'); link.href = render.url + (render.url.includes('?') ? '&' : '?') + 'download=1'; link.download = render.filename; link.click(); return;
      }
      const handle = await window.showSaveFilePicker({ suggestedName: render.filename,
        types: [{ description: 'Vídeo MP4', accept: { 'video/mp4': ['.mp4'] } }] });
      const response = await client.download(render.url);
      if (!response.ok || !response.headers.get('content-type')?.includes('video/mp4')) throw new Error('O servidor não entregou um MP4 válido.');
      const blob = await response.blob();
      const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
      if (String.fromCharCode(...header.slice(4, 8)) !== 'ftyp') throw new Error('O arquivo não possui cabeçalho MP4.');
      const writable = await handle.createWritable();
      try { await writable.write(blob); await writable.close(); } catch (err) { await writable.abort(); throw err; }
      setNotice('MP4 salvo no computador.');
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
  }

  if (!state || !project) return <main className="rp-app"><p role="status">{error || 'Carregando piloto…'}</p></main>;
  const stage = <Player key={model} ref={player} component={RankingComposition} inputProps={{ project, assets, fontUrl: client.media(state.fontUrl) }}
    durationInFrames={timeline?.durationInFrames ?? 1} compositionWidth={WIDTH} compositionHeight={HEIGHT} fps={FPS}
    controls={!verify && !!timeline?.count} loop={!range} initialFrame={verify ? Number(query.get('frame') ?? 0) : 0}
    style={{ width: verify ? WIDTH : '100%', aspectRatio: '9 / 16', background: '#000' }} />;
  if (verify) return <div className="rp-verification" data-testid="preview-stage">{stage}</div>;

  return <main className="rp-app">
    <input hidden ref={upload} type="file" onChange={receiveFile} />
    <header className="rp-top"><div><Film size={23} /><h1>Ranking Multimídia</h1>{!production && <span className="rp-local">Piloto local</span>}</div>
      <button className="rp-button" onClick={safely(async () => {
        await request('/api/pilot/project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project) }); setNotice(production ? 'Projeto salvo neste workspace.' : 'Projeto salvo no E:.');
      })}><Save size={16} />Salvar projeto</button></header>
    {(error || timelineResult.issue) && <div className="rp-alert" role="alert">{error || timelineResult.issue}</div>}
    {notice && <div className="rp-notice" role="status"><Check size={15} />{notice}</div>}
    <div className="rp-layout">
      <div className="rp-settings">
        <Panel title="Modelo">
          <div className="rp-models" role="radiogroup" aria-label="Modelo do ranking">
            {['classic', 'interludes'].map(name => <button role="radio" aria-checked={model === name} key={name} className={`rp-model ${model === name ? 'selected' : ''}`}
              onClick={() => { player.current?.pause(); setModel(name); setSelected(null); setRange(null); setError(''); }}>
              <div className={`rp-mini ${name}`} style={{ backgroundImage: assets[state.presets[name].items[0]?.clips[0]?.assetId]?.poster ? `url(${assets[state.presets[name].items[0].clips[0].assetId].poster})` : undefined }}>
                <span className="rp-mini-title">Ranking <b>Melhores</b><br /><em>Momentos</em></span><span className="rp-mini-list">{Array.from({ length: name === 'classic' ? 6 : 5 }, (_, index) => <React.Fragment key={index}>{index+1}.<br /></React.Fragment>)}</span>
              </div><span>{name === 'classic' ? 'Clássico' : 'Com vinhetas'}</span>{model === name && <Check size={16} />}
            </button>)}
          </div>
        </Panel>
        <Panel title="Título e ranking">
          {project.titleLines.map((line, index) => <div className="rp-title-fields" key={index}>
            <label>Linha {index + 1}<input value={line} maxLength={100} onChange={event => update({ titleLines: project.titleLines.map((value, n) => n === index ? event.target.value : value) })} /></label>
            <label>Destaque<input value={project.highlights[index] ?? ''} maxLength={60} onChange={event => update({ highlights: project.highlights.map((value, n) => n === index ? event.target.value : value) })} /></label>
          </div>)}
          <div className="rp-swatches" role="group" aria-label="Cor do destaque">
            {['#A27BFF', '#FF4D79', '#00E7A5', '#36C5FF', '#FFE327', '#FFFFFF'].map(color => <button aria-label={`Cor ${color}`} title={color} key={color}
              aria-pressed={project.accent === color} style={{ background: color }} onClick={() => update({ accent: color })}>{project.accent === color && <Check size={16} color="#111" />}</button>)}
          </div>
          <Slider title="Tamanho do título" value={project.titleSize} min={32} max={90} onChange={value => update({ titleSize: value })} unit=" px" />
          <Slider title="Descrições do ranking" value={project.labelSize} min={24} max={64} onChange={value => update({ labelSize: value })} unit=" px" />
        </Panel>
        <Panel title="Cenas" aside={<span className="rp-count">{timeline?.count ?? 0}/10</span>}>
          <div className="rp-items">
            {project.items.map((item, index) => <article key={item.id} className={`rp-item ${selected === item.id ? 'active' : ''}`}
              onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); update({ items: moveItem(project.items, event.dataTransfer.getData('text/plain'), item.id) }); }}>
              <div className="rp-item-row">
                <button className="rp-grip" title="Arrastar cena" aria-label={`Arrastar cena ${project.items.length-index}`} draggable
                  onDragStart={event => event.dataTransfer.setData('text/plain', item.id)}><GripVertical size={17} /></button>
                <button className="rp-poster" title="Assistir cena" aria-label={`Assistir cena ${project.items.length-index}`} onClick={() => playItem(item)}>
                  {assets[item.clips[0]?.assetId]?.poster && <img src={assets[item.clips[0].assetId].poster} alt="" />}<Play size={16} /></button>
                <div className="rp-item-data"><span>Posição {project.items.length-index}<small>{seconds(item.clips.reduce((sum, clip) => sum + clip.endFrame - clip.startFrame, 0))} s</small></span>
                  <input aria-label={`Descrição posição ${project.items.length-index}`} placeholder="Descrição da cena" maxLength={80} value={item.label} onChange={event => itemUpdate(item.id, { label: event.target.value })} /></div>
                <div className="rp-item-actions">
                  <Icon title={`Ajustar cena ${project.items.length-index}`} onClick={() => setSelected(selected === item.id ? null : item.id)}><Scissors size={15} /></Icon>
                  <Icon title={`Excluir cena ${project.items.length-index}`} danger onClick={() => { update({ items: project.items.filter(candidate => candidate.id !== item.id) }); setSelected(null); }}><X size={15} /></Icon>
                </div>
              </div>
              {selected === item.id && <div className="rp-item-detail">
                <div className="rp-row">
                  <Icon title="Mover para cima" disabled={index === 0} onClick={() => update({ items: moveItem(project.items, item.id, project.items[index-1].id) })}><ArrowUp size={15} /></Icon>
                  <Icon title="Mover para baixo" disabled={index === project.items.length-1} onClick={() => update({ items: moveItem(project.items, item.id, project.items[index+1].id) })}><ArrowDown size={15} /></Icon>
                  <button className="rp-button" disabled={busy} onClick={() => chooseFile({ kind: 'replace', itemId: item.id })}><Upload size={14} />Trocar vídeo</button>
                  <Icon title="Adicionar subtrecho" disabled={busy || item.clips.length >= 12} onClick={() => chooseFile({ kind: 'append', itemId: item.id })}><Plus size={16} /></Icon>
                </div>
                {item.clips.map((clip, n) => <div className="rp-clip" key={`${clip.assetId}-${n}`}>
                  <div className="rp-clip-name"><span>{assets[clip.assetId]?.name}</span>{item.clips.length > 1 && <Icon title={`Excluir subtrecho ${n+1}`} danger onClick={() => itemUpdate(item.id, { clips: item.clips.filter((_, i) => i !== n) })}><X size={13} /></Icon>}</div>
                  <div className="rp-pair">
                    <label>Início (s)<input type="number" min={0} max={seconds(clip.endFrame-1)} step={1/FPS} value={seconds(clip.startFrame)} onChange={event => clipUpdate(item.id, n, { startFrame: Math.min(clip.endFrame-1, Math.max(0, Math.round(Number(event.target.value)*FPS))) })} /></label>
                    <label>Fim (s)<input type="number" min={seconds(clip.startFrame+1)} max={seconds(assets[clip.assetId].frames)} step={1/FPS} value={seconds(clip.endFrame)} onChange={event => clipUpdate(item.id, n, { endFrame: Math.min(assets[clip.assetId].frames, Math.max(clip.startFrame+1, Math.round(Number(event.target.value)*FPS))) })} /></label>
                  </div>
                  <Slider title="Volume da cena" value={Math.round(clip.volume*100)} min={0} max={100} unit="%" onChange={value => clipUpdate(item.id, n, { volume: value/100 })} />
                  <div className="rp-pair"><Slider title="Posição X" value={clip.x} min={0} max={1} step={.01} onChange={value => clipUpdate(item.id, n, { x: value })} /><Slider title="Posição Y" value={clip.y} min={0} max={1} step={.01} onChange={value => clipUpdate(item.id, n, { y: value })} /></div>
                  <Slider title="Zoom" value={clip.zoom} min={1} max={2} step={.01} onChange={value => clipUpdate(item.id, n, { zoom: value })} />
                  <label>Enquadramento<select value={clip.fit} onChange={event => clipUpdate(item.id, n, { fit: event.target.value })}><option value="cover">Preencher</option><option value="contain">Mostrar inteiro</option></select></label>
                </div>)}
                {model === 'interludes' && index < project.items.length-1 && <label>Vinheta após a cena<select value={item.interlude?.assetId ?? ''} onChange={event => {
                  const asset = assets[event.target.value]; itemUpdate(item.id, { interlude: asset ? { assetId: asset.id, startFrame: 0, endFrame: asset.frames, volume: .8, x: .5, y: .5, zoom: 1, fit: 'cover' } : null });
                }}><option value="">Sem vinheta</option>{Object.values(assets).filter(asset => asset.kind === 'interlude').map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>}
              </div>}
            </article>)}
          </div>
          <button className="rp-button rp-add" disabled={busy || project.items.length >= 10} onClick={() => chooseFile({ kind: 'new' })}><Plus size={16} />Adicionar cena</button>
        </Panel>
        <Panel title="Música e encerramento" initial={false}>
          {model === 'interludes' && <button className="rp-button" disabled={busy} onClick={() => chooseFile({ kind: 'interlude' })}><Upload size={15} />Adicionar vinheta</button>}
          <button className="rp-button" disabled={busy} onClick={() => chooseFile({ kind: 'music' })}><Music2 size={16} />Adicionar música</button>
          {project.music && <><div className="rp-clip-name"><span>{assets[project.music.assetId]?.name}</span><Icon title="Remover música" danger onClick={() => update({ music: null })}><X size={15} /></Icon></div>
            <Slider title="Volume da música" value={Math.round(project.music.volume*100)} min={0} max={100} unit="%" onChange={value => update({ music: { ...project.music, volume: value/100 } })} /></>}
          <button className="rp-button" disabled={busy} onClick={() => chooseFile({ kind: 'outro' })}><Upload size={15} />Escolher encerramento</button>
          {project.outro && <div className="rp-clip-name"><span>{assets[project.outro.assetId]?.name}</span><Icon title="Remover encerramento" danger onClick={() => update({ outro: null })}><X size={15} /></Icon></div>}
        </Panel>
        <button className="rp-button rp-reset" onClick={() => { if (window.confirm('Limpar somente a montagem deste modelo? As mídias serão preservadas.')) { setDrafts(old => ({ ...old, [model]: clone(state.presets[model]) })); setSelected(null); } }}><RotateCcw size={14} />{production ? 'Nova montagem' : 'Restaurar demonstração'}</button>
      </div>
      <div className="rp-preview-column">
        <Panel title="Preview de edição" aside={<span className="rp-count">1080 × 1920 · 30 fps</span>}>
          <div className="rp-stage" data-testid="preview-stage">{stage}</div>
          <div className="rp-preview-footer"><span>{seconds(frame)} / {seconds(timeline?.durationInFrames ?? 0)} s</span><span>{timeline?.count ?? 0} posições</span></div>
          <div className="rp-timeline" aria-label="Timeline do ranking">{timeline?.segments.map(segment => <button key={segment.id} title={`${segment.kind} · ${seconds(segment.frames)} s`}
            aria-label={`Ir para ${segment.kind} ${segment.rank ?? 'final'}`} className={segment.kind === 'scene' ? '' : 'interlude'}
            style={{ flexGrow: segment.frames }} onClick={() => { player.current.pause(); player.current.seekTo(segment.from); setRange(null); }}>
            {segment.kind === 'scene' ? segment.rank : '·'}</button>)}</div>
          <button className="rp-button rp-primary rp-render" disabled={busy || !!job || !timeline?.count} onClick={renderNow}>
            {job ? <Loader2 size={17} className="rp-spin" /> : <Film size={17} />}{job ? `${job.status === 'queued' ? 'Na fila' : 'Renderizando'} ${job.progress ?? 0}%` : production ? 'Renderizar MP4' : 'Renderizar piloto MP4'}</button>
          {busy && <p className="rp-status" role="status">Enviando mídia…</p>}
        </Panel>
        <Panel title="Vídeo renderizado" aside={render && <span className="rp-count">{edited ? 'Edição alterada' : 'Último render'}</span>}>
          {render ? <><div className="rp-rendered-stage"><video key={render.id} src={render.url} controls playsInline preload="metadata" /></div>
            <div className="rp-preview-footer"><span>{render.duration.toFixed(2)} s</span><span>MP4 · H.264 / AAC</span></div>
            <button className="rp-button rp-download" onClick={download}><Download size={17} />Baixar MP4</button></> : <div className="rp-empty"><Film size={26} /><span>Nenhum render deste modelo</span></div>}
        </Panel>
      </div>
    </div>
  </main>;
}
