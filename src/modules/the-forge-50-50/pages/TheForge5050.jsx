import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Download, Eye, EyeOff, Film, Loader, MousePointer2, Plus, RefreshCw, Search, Scissors, Trash2, Upload, X } from 'lucide-react';
import {
  createForge5050Project,
  deleteForge5050Project,
  deleteForge5050Render,
  forge5050FileUrl,
  generateForge5050SocialMetadata,
  getForge5050Project,
  generateForge5050Hook,
  listForge5050Projects,
  renderForge5050,
  saveForge5050Config,
  uploadForge5050Video,
} from '../services/forge5050Api';
import '../styles/the-forge-50-50.css';

const headlineStyles = [
  ['liveHf', 'Live HF'], ['doubleTicker', 'Ticker duplo'], ['blackGold', 'Preto / ouro'], ['redBlack', 'Vermelho / preto'],
];
const headlineStyleIds = new Set(headlineStyles.map(([id]) => id));
const socialPlatforms = [
  { id: 'youtube', label: 'YouTube', metadataPlatform: 'youtube_shorts' },
  { id: 'instagram', label: 'Instagram', metadataPlatform: 'instagram' },
  { id: 'tiktok', label: 'TikTok', metadataPlatform: 'tiktok' },
];

const defaultConfig = {
  top_video: '', bottom_video: '', top_start: 0, top_end: 0, bottom_start: 0, bottom_end: 0,
  top_crop_x: 0.5, top_crop_y: 0.5, bottom_crop_x: 0.5, bottom_crop_y: 0.5,
  top_volume: 1, bottom_volume: 0, audio_mode: 'top', top_ratio: 0.5,
  headline_text: '', headline_position: 'none', headline_ratio: 0.1, headline_font_scale: 1, headline_palette: 'liveHf',
};

const normalizeForge5050Config = (source = {}) => {
  const next = { ...defaultConfig, ...source };
  if (!headlineStyleIds.has(next.headline_palette)) next.headline_palette = defaultConfig.headline_palette;
  return next;
};

function TheForge5050() {
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [config, setConfig] = useState(defaultConfig);
  const [open, setOpen] = useState({ projects: true, library: true, controls: true, headline: true });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [render, setRender] = useState(null);
  const [cropEditingSlot, setCropEditingSlot] = useState('top');
  const [joinedPreview, setJoinedPreview] = useState(false);
  const [showCombinedPreview, setShowCombinedPreview] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [generatingHook, setGeneratingHook] = useState(false);
  const [socialMetadata, setSocialMetadata] = useState({});
  const [selectedMetadataPlatform, setSelectedMetadataPlatform] = useState('youtube');
  const [generatingMetadataFor, setGeneratingMetadataFor] = useState('');

  const videos = project?.videos || [];
  const topVideo = useMemo(() => videos.find((item) => item.filename === config.top_video), [videos, config.top_video]);
  const bottomVideo = useMemo(() => videos.find((item) => item.filename === config.bottom_video), [videos, config.bottom_video]);

  const refresh = async () => {
    const result = await listForge5050Projects();
    setProjects(result.projects || []);
    return result.projects || [];
  };

  const openProject = async (id) => {
    const data = await getForge5050Project(id);
    setProject(data);
    setConfig(normalizeForge5050Config(data.config));
    setRender(data.last_render || null);
    setSocialMetadata({});
  };

  useEffect(() => {
    refresh().then((items) => (items[0] ? openProject(items[0].id) : null)).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const update = (key, value) => setConfig((current) => ({ ...current, [key]: value }));

  const createProject = async () => {
    setBusy(true); setError('');
    try {
      const data = await createForge5050Project(`The Forge 50/50 - ${new Date().toLocaleDateString('pt-BR')}`);
      await refresh(); await openProject(data.id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const removeProject = async () => {
    if (!project || !window.confirm(`Excluir “${project.title}”?`)) return;
    setBusy(true); setError('');
    try {
      await deleteForge5050Project(project.id);
      const items = await refresh();
      setProject(null); setRender(null);
      if (items[0]) await openProject(items[0].id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const upload = async (slot, file) => {
    if (!file || !project) return;
    setBusy(true); setError('');
    try {
      const data = await uploadForge5050Video(project.id, slot, file);
      setProject(data); setConfig(normalizeForge5050Config(data.config)); setRender(null); setJoinedPreview(false); setShowCombinedPreview(false); setCropMode(false);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const save = async (nextConfig = config) => {
    if (!project) return;
    setError('');
    try {
      const data = await saveForge5050Config(project.id, nextConfig);
      setProject(data); setConfig(normalizeForge5050Config(data.config));
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const selectCropVideo = (slot) => {
    if (!config[`${slot}_video`]) {
      setError(`Selecione o vídeo ${slot === 'top' ? '1' : '2'} antes de ajustar o corte.`);
      return;
    }
    setCropEditingSlot(slot);
    setShowCombinedPreview(false);
    setCropMode(false);
  };

  const activateCropVideo = (slot) => {
    selectCropVideo(slot);
    setCropMode(true);
  };

  const joinVideos = async () => {
    if (!config.top_video || !config.bottom_video) {
      setError('Selecione os dois vídeos antes de unir o preview.');
      return;
    }
    const nextConfig = { ...config, top_ratio: 0.5 };
    setBusy(true);
    setError('');
    try {
      const data = await saveForge5050Config(project.id, nextConfig);
      setProject(data);
      setConfig(normalizeForge5050Config(data.config));
      setJoinedPreview(true);
      setShowCombinedPreview(true);
      setCropMode(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const generateHook = async () => {
    if (!config.top_video || !config.bottom_video) {
      setError('Selecione os dois vídeos antes de gerar o hook.');
      return;
    }
    setGeneratingHook(true);
    setError('');
    try {
      const context = [
        topVideo?.original_name ? `Vídeo 1: ${topVideo.original_name}` : '',
        bottomVideo?.original_name ? `Vídeo 2: ${bottomVideo.original_name}` : '',
        'Crie uma headline curta em português do Brasil para a união desses dois vídeos.',
      ].filter(Boolean).join('\n');
      const data = await generateForge5050Hook(context, config.headline_text);
      if (!data.headline) throw new Error(data.detail || 'O gerador não retornou um hook.');
      update('headline_text', data.headline);
      if (data.error) setError(data.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingHook(false);
    }
  };

  const renderVideo = async () => {
    if (!project || !config.top_video || !config.bottom_video) {
      setError('Adicione e selecione os dois vídeos antes de renderizar.'); return;
    }
    setBusy(true); setError(''); setRender(null);
    try {
      const saved = await save(config);
      if (!saved) return;
      const data = await renderForge5050(project.id, config);
      setRender(data);
      await openProject(project.id);
      setRender(data);
      setSocialMetadata({});
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const removeRender = async () => {
    if (!project || !render || !window.confirm('Excluir os três vídeos renderizados?')) return;
    setBusy(true); setError('');
    try {
      await deleteForge5050Render(project.id);
      setRender(null);
      setSocialMetadata({});
      setProject((current) => current ? { ...current, last_render: null } : current);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const generateSocialMetadata = async (platform) => {
    setGeneratingMetadataFor(platform);
    setError('');
    try {
      const item = socialPlatforms.find((entry) => entry.id === platform);
      const titleHint = [
        config.headline_text ? `Headline: ${config.headline_text}` : '',
        topVideo?.original_name ? `Vídeo 1: ${topVideo.original_name}` : '',
        bottomVideo?.original_name ? `Vídeo 2: ${bottomVideo.original_name}` : '',
      ].filter(Boolean).join('\n');
      const descriptionHint = 'Vídeo vertical 50/50 com dois vídeos unidos para publicação em rede social.';
      const data = await generateForge5050SocialMetadata(item.metadataPlatform, titleHint, descriptionHint);
      setSocialMetadata((current) => ({ ...current, [platform]: data }));
    } catch (err) { setError(err.message); } finally { setGeneratingMetadataFor(''); }
  };

  if (loading) return <main className="forge5050-page"><div className="forge5050-loading"><Loader className="forge5050-spin" /> Carregando The Forge 50/50...</div></main>;

  return <main className="forge5050-page">
    <header className="forge5050-header">
      <div><span className="forge5050-kicker">EDITOR DE DOIS VÍDEOS</span><h1>The Forge 50/50</h1><p>Una dois vídeos em um quadro vertical 1080 × 1920, com áudio e headline.</p></div>
      <div className="forge5050-actions"><button className="forge5050-button primary" onClick={createProject} disabled={busy}><Plus size={16} /> Novo projeto</button><button className="forge5050-button ghost" onClick={() => refresh()}><RefreshCw size={15} /> Atualizar</button></div>
    </header>
    {error && <div className="forge5050-error">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

    <Panel title="Projetos 50/50" open={open.projects} onToggle={() => setOpen((v) => ({ ...v, projects: !v.projects }))}>
      <div className="forge5050-projects">{projects.map((item) => <button key={item.id} className={`forge5050-project ${item.id === project?.id ? 'active' : ''}`} onClick={() => openProject(item.id)}><Film size={15} /> {item.title}</button>)}{!projects.length && <span className="forge5050-muted">Crie o primeiro projeto para começar.</span>}{project && <button className="forge5050-delete" onClick={removeProject} disabled={busy}><Trash2 size={14} /> Excluir projeto atual</button>}</div>
    </Panel>

    {project && <>
      <Panel title="Biblioteca de dois vídeos" open={open.library} onToggle={() => setOpen((v) => ({ ...v, library: !v.library }))}>
        <div className="forge5050-library">{['top', 'bottom'].map((slot) => <VideoSlot key={slot} slot={slot} video={slot === 'top' ? topVideo : bottomVideo} busy={busy} onUpload={upload} config={config} update={update} onSelect={() => activateCropVideo(slot)} />)}</div>
      </Panel>

      <div className="forge5050-grid">
        <section className="forge5050-panel forge5050-preview-panel">
          <h2>Preview de edição 50/50</h2>
          <div className="forge5050-preview-toolbar" role="group" aria-label="Selecionar vídeo para corte">
            <span>Cortar no preview:</span>
            <button type="button" className={cropEditingSlot === 'top' ? 'active' : ''} onClick={() => selectCropVideo('top')} disabled={!topVideo}>Vídeo 1</button>
            <button type="button" className={cropEditingSlot === 'bottom' ? 'active' : ''} onClick={() => selectCropVideo('bottom')} disabled={!bottomVideo}>Vídeo 2</button>
            <button type="button" className="preview-eye" onClick={() => setShowCombinedPreview((current) => !current)} disabled={!topVideo || !bottomVideo} title={showCombinedPreview ? 'Mostrar corte individual' : 'Ver prévia unida'} aria-label={showCombinedPreview ? 'Mostrar corte individual' : 'Ver prévia unida'}>
              {showCombinedPreview ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button type="button" className="join" onClick={joinVideos} disabled={busy || !topVideo || !bottomVideo}><Check size={14} /> Unir vídeos</button>
          </div>
          <div className={`forge5050-preview ${showCombinedPreview ? 'combined' : 'single'}`} style={{ '--top': `${config.top_ratio * 100}%` }}>
            {showCombinedPreview ? <div className="forge5050-combined-stage">
              <PreviewVideo video={topVideo} className="top" cropX={config.top_crop_x} cropY={config.top_crop_y} />
              <PreviewVideo video={bottomVideo} className="bottom" cropX={config.bottom_crop_x} cropY={config.bottom_crop_y} />
              {config.headline_text && config.headline_position !== 'none' && <div
                className={`forge5050-headline ${config.headline_position} palette-${config.headline_palette}`}
                style={{
                  '--headline-band-height': `${Math.round(config.headline_ratio * 100)}%`,
                  '--headline-font-size-width': `${(10 * config.headline_font_scale).toFixed(3)}cqw`,
                  '--headline-font-size-height': `${(110.222 * config.headline_ratio * config.headline_font_scale).toFixed(3)}cqw`,
                }}
              >{config.headline_text}</div>}
            </div> : <PreviewVideo video={cropEditingSlot === 'top' ? topVideo : bottomVideo} className={`solo ${cropEditingSlot}`} cropActive={cropMode} whole={!cropMode} cropX={config[`${cropEditingSlot}_crop_x`]} cropY={config[`${cropEditingSlot}_crop_y`]} />}
          </div>
          <p className="forge5050-note">Selecione Vídeo 1 ou Vídeo 2 para cortar separadamente. O botão “Unir vídeos” fixa a divisão automática em 50/50.</p>
          <button className="forge5050-button primary wide" onClick={renderVideo} disabled={busy}><Film size={16} /> {busy ? 'Renderizando...' : 'Renderizar vídeo 50/50'}</button>
        </section>

        <div className="forge5050-editor-controls">
          <Panel title="Ajustes dos vídeos" open={open.controls} onToggle={() => setOpen((v) => ({ ...v, controls: !v.controls }))} className="forge5050-panel">
            <div className="forge5050-control-grid"><Select label="Vídeo de cima" value={config.top_video} options={videos} onChange={(value) => update('top_video', value)} /><Select label="Vídeo de baixo" value={config.bottom_video} options={videos} onChange={(value) => update('bottom_video', value)} /></div>
            <label className="forge5050-label">Divisão {Math.round(config.top_ratio * 100)}/{100 - Math.round(config.top_ratio * 100)}<input type="range" min="0.3" max="0.7" step="0.01" value={config.top_ratio} onChange={(e) => update('top_ratio', Number(e.target.value))} /></label>
            <div className="forge5050-control-grid"><Trim prefix="top" config={config} update={update} title="Vídeo de cima" active={cropEditingSlot === 'top'} onSelect={() => selectCropVideo('top')} /><Trim prefix="bottom" config={config} update={update} title="Vídeo de baixo" active={cropEditingSlot === 'bottom'} onSelect={() => selectCropVideo('bottom')} /></div>
            <div className="forge5050-control-grid"><Range label="Volume de cima" value={config.top_volume} min="0" max="2" step="0.05" onChange={(value) => update('top_volume', value)} /><Range label="Volume de baixo" value={config.bottom_volume} min="0" max="2" step="0.05" onChange={(value) => update('bottom_volume', value)} /></div>
            <CropInspector cropEditingSlot={cropEditingSlot} config={config} update={update} cropMode={cropMode} setCropMode={setCropMode} setShowCombinedPreview={setShowCombinedPreview} topVideo={topVideo} bottomVideo={bottomVideo} joinedPreview={joinedPreview} onSelect={() => selectCropVideo(cropEditingSlot)} />
            <Select label="Áudio usado" value={config.audio_mode} options={[{ value: 'top', original_name: 'Somente vídeo de cima' }, { value: 'bottom', original_name: 'Somente vídeo de baixo' }, { value: 'both', original_name: 'Os dois vídeos' }, { value: 'none', original_name: 'Sem áudio' }]} onChange={(value) => update('audio_mode', value)} />
            <button className="forge5050-button secondary" onClick={save} disabled={busy}><Check size={15} /> Salvar ajustes</button>
          </Panel>

          <Panel title="Headline" open={open.headline} onToggle={() => setOpen((v) => ({ ...v, headline: !v.headline }))} className="forge5050-headline-panel">
            <label className="forge5050-label">Texto da headline<input value={config.headline_text} maxLength={120} onChange={(e) => update('headline_text', e.target.value)} placeholder="Digite a headline" /></label>
            <button type="button" className="forge5050-button hook" onClick={generateHook} disabled={generatingHook || busy || !topVideo || !bottomVideo}>
              {generatingHook ? <><Loader size={15} className="forge5050-spin" /> Gerando hook...</> : <><Search size={15} /> Gerar hook + CTA com ChatGPT</>}
            </button>
            <div className="forge5050-control-grid"><Select label="Posição" value={config.headline_position} options={[{ value: 'none', original_name: 'Sem headline' }, { value: 'top', original_name: 'Topo' }, { value: 'middle', original_name: 'Meio' }, { value: 'bottom', original_name: 'Embaixo' }]} onChange={(value) => update('headline_position', value)} /><Range label={`Altura da faixa ${Math.round(config.headline_ratio * 100)}%`} value={config.headline_ratio} min="0.06" max="0.20" step="0.01" onChange={(value) => update('headline_ratio', value)} /><Range label={`Tamanho ${config.headline_font_scale.toFixed(2)}x`} value={config.headline_font_scale} min="0.7" max="1.8" step="0.05" onChange={(value) => update('headline_font_scale', value)} /></div>
            <div className="forge5050-style-grid">{headlineStyles.map(([id, label]) => <button key={id} className={config.headline_palette === id ? 'selected' : ''} onClick={() => update('headline_palette', id)}><span className={`forge5050-swatch palette-${id}`} />{label}</button>)}</div>
          </Panel>
        </div>
      </div>

      {render && <section className="forge5050-panel forge5050-platform-results"><h2>Vídeo renderizado</h2><video src={forge5050FileUrl(render.url)} controls className="forge5050-rendered" /><a className="forge5050-button secondary" href={forge5050FileUrl(render.url)} download><Download size={16} /> Baixar vídeo MP4</a><div className="forge5050-social-generator"><h3>Gerar publicação para uma rede social</h3><Select label="Rede social" value={selectedMetadataPlatform} options={socialPlatforms.map((item) => ({ value: item.id, original_name: item.label }))} onChange={setSelectedMetadataPlatform} /><button type="button" className="forge5050-button metadata-button" onClick={() => generateSocialMetadata(selectedMetadataPlatform)} disabled={generatingMetadataFor !== ''}>{generatingMetadataFor === selectedMetadataPlatform ? <><Loader size={15} className="forge5050-spin" /> Gerando...</> : <><Search size={15} /> Gerar título, descrição e hashtags</>}</button>{socialMetadata[selectedMetadataPlatform]?.title && <div className="forge5050-metadata"><label>Título<input value={socialMetadata[selectedMetadataPlatform].title} readOnly /></label><label>Descrição<textarea value={socialMetadata[selectedMetadataPlatform].description || ''} readOnly rows={5} /></label><label>Hashtags<input value={(socialMetadata[selectedMetadataPlatform].hashtags || []).join(' ')} readOnly /></label></div>}</div><button type="button" className="forge5050-button delete-render" onClick={removeRender} disabled={busy}><Trash2 size={15} /> Excluir vídeo renderizado</button></section>}
    </>}
  </main>;
}

function Panel({ title, open, onToggle, children, className = '' }) { return <section className={`forge5050-panel ${className}`}><button className="forge5050-panel-title" onClick={onToggle}><span>{title}</span>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>{open && children}</section>; }
function PreviewVideo({ video, className, cropActive = false, whole = false, cropX = 0.5, cropY = 0.5 }) {
  const videoStyle = {
    objectFit: whole ? 'contain' : 'cover',
    objectPosition: `${cropX * 100}% ${cropY * 100}%`,
    transform: cropActive ? 'scale(1.35)' : 'none',
    transformOrigin: `${cropX * 100}% ${cropY * 100}%`,
  };
  return <div className={`forge5050-preview-video ${className} ${cropActive ? 'crop-active' : ''}`}>
    {video ? <video src={forge5050FileUrl(video.url)} controls style={videoStyle} /> : <Film size={26} />}
    {video && cropActive && <VideoCropGuides />}
  </div>;
}
function VideoCropGuides() { return <div className="forge5050-video-guides" aria-hidden="true"><div className="top" /><div className="bottom" /></div>; }
function VideoSlot({ slot, video, busy, onUpload, config, update, onSelect }) {
  const prefix = slot;
  const duration = Math.max(0, Number(video?.duration || 0));
  const rawStart = Number(config?.[`${prefix}_start`] || 0);
  const rawEnd = Number(config?.[`${prefix}_end`] || 0);
  const start = duration ? Math.min(Math.max(rawStart, 0), Math.max(duration - 0.1, 0)) : 0;
  const end = duration ? Math.min(Math.max(rawEnd || duration, start + 0.1), duration) : 0;
  const selectedDuration = duration ? Math.max(0.1, end - start) : 0;
  const hasTrim = Boolean(duration && (start > 0.05 || end < duration - 0.05));

  const updateStart = (value) => {
    if (!duration) return;
    const next = Math.min(Math.max(Number(value) || 0, 0), Math.max(end - 0.1, 0));
    update(`${prefix}_start`, Number(next.toFixed(2)));
  };
  const updateEnd = (value) => {
    if (!duration) return;
    const next = Math.min(Math.max(Number(value) || duration, start + 0.1), duration);
    update(`${prefix}_end`, next >= duration - 0.05 ? 0 : Number(next.toFixed(2)));
  };
  const resetTrim = () => {
    update(`${prefix}_start`, 0);
    update(`${prefix}_end`, 0);
  };

  return <div className={`forge5050-slot ${video ? 'filled' : ''}`}>
    <div className="forge5050-slot-title"><strong>{slot === 'top' ? 'Vídeo de cima' : 'Vídeo de baixo'}</strong><span>{video ? `${video.width}×${video.height} · ${duration.toFixed(1)}s` : 'Aguardando vídeo'}</span></div>
    {video ? <video className="forge5050-thumb" src={forge5050FileUrl(video.url)} controls /> : <div className="forge5050-empty"><Film size={24} /> Escolha um vídeo</div>}
    <label className="forge5050-upload"><Upload size={15} /> {video ? 'Trocar vídeo' : 'Adicionar vídeo'}<input type="file" accept="video/*" onChange={(e) => onUpload(slot, e.target.files?.[0])} disabled={busy} /></label>
    {video && <div className="forge5050-slot-trim">
      <div className="forge5050-slot-trim-heading"><strong>Corte de duração separado</strong><span>{hasTrim ? `${selectedDuration.toFixed(1)}s selecionados` : 'Vídeo inteiro'}</span></div>
      <div className="forge5050-trim-duration">
        <label>Início (s)<input type="number" min="0" max={Math.max(duration - 0.1, 0)} step="0.1" value={start.toFixed(1)} onChange={(e) => updateStart(e.target.value)} /></label>
        <label>Fim (s)<input type="number" min={Math.min(duration, start + 0.1)} max={duration} step="0.1" value={end.toFixed(1)} onChange={(e) => updateEnd(e.target.value)} /></label>
      </div>
      <div className="forge5050-trim-range" aria-label={`Ajuste de duração do ${slot === 'top' ? 'vídeo 1' : 'vídeo 2'}`}>
        <input type="range" min="0" max={Math.max(duration - 0.1, 0)} step="0.1" value={start} onChange={(e) => updateStart(e.target.value)} aria-label="Início do corte" />
        <input type="range" min={Math.min(duration, start + 0.1)} max={duration} step="0.1" value={end} onChange={(e) => updateEnd(e.target.value)} aria-label="Fim do corte" />
      </div>
      <div className="forge5050-slot-trim-actions">
        <button type="button" onClick={onSelect}><MousePointer2 size={13} /> Ajustar enquadramento</button>
        <button type="button" onClick={resetTrim} disabled={!hasTrim}><RefreshCw size={13} /> Vídeo inteiro</button>
      </div>
    </div>}
  </div>;
}
function Select({ label, value, options, onChange }) { return <label className="forge5050-label">{label}<select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.original_name || option.label || option.value}</option>)}</select></label>; }
function Range({ label, value, min, max, step, onChange }) { return <label className="forge5050-label">{label}<input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>; }
function Trim({ prefix, title, active, onSelect }) { return <div className={`forge5050-trim ${active ? 'active' : ''}`}><div className="forge5050-trim-heading"><h3>{title}</h3><button type="button" onClick={onSelect}>{active ? 'Selecionado no preview' : 'Selecionar no preview'}</button></div></div>; }
function CropInspector({ cropEditingSlot, config, update, cropMode, setCropMode, setShowCombinedPreview, topVideo, bottomVideo, joinedPreview, onSelect }) {
  const selectedVideo = cropEditingSlot === 'top' ? topVideo : bottomVideo;
  const prefix = cropEditingSlot === 'top' ? 'top' : 'bottom';
  return <div className="forge5050-crop-inspector">
    <div className="forge5050-crop-inspector-heading"><strong>Enquadramento do Vídeo {cropEditingSlot === 'top' ? '1 · cima' : '2 · baixo'}</strong><div className="forge5050-crop-actions"><button type="button" className="forge5050-select-button" onClick={() => { setShowCombinedPreview(false); setCropMode(false); onSelect(); }} disabled={!selectedVideo}><MousePointer2 size={13} /> Selecionar vídeo</button><button type="button" className="forge5050-cut-button" onClick={() => { setShowCombinedPreview(false); setCropMode(true); }} disabled={!selectedVideo}><Scissors size={14} /> Cortar vídeo</button></div></div>
    <span>{cropMode ? 'As linhas verdes estão ativas no vídeo selecionado. Ajuste X e Y e confira o resultado no preview.' : 'Selecione o vídeo e clique em Cortar vídeo para ativar as linhas verdes.'}</span>
    <div className="forge5050-control-grid">
      <Range label={`Ajuste lateral ${Math.round((config[`${prefix}_crop_x`] || 0.5) * 100)}%`} value={config[`${prefix}_crop_x`]} min="0" max="1" step="0.01" onChange={(value) => update(`${prefix}_crop_x`, value)} />
      <Range label={`Ajuste vertical ${Math.round((config[`${prefix}_crop_y`] || 0.5) * 100)}%`} value={config[`${prefix}_crop_y`]} min="0" max="1" step="0.01" onChange={(value) => update(`${prefix}_crop_y`, value)} />
    </div>
    {joinedPreview && <small className="forge5050-joined-note"><Check size={13} /> Vídeos unidos no enquadramento 50/50.</small>}
  </div>;
}

export default TheForge5050;
