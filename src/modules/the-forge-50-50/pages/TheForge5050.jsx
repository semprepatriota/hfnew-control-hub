import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Download, Eye, EyeOff, Film, Image as ImageIcon, Loader, MousePointer2, Plus, RefreshCw, Search, Scissors, Trash2, Upload, X } from 'lucide-react';
import {
  createForge5050Project,
  deleteForge5050Project,
  deleteForge5050Render,
  forge5050DownloadUrl,
  forge5050FileUrl,
  generateForge5050SocialMetadata,
  getForge5050Project,
  generateForge5050Hook,
  listForge5050Projects,
  renderForge5050,
  saveForge5050Config,
  deleteForge5050Logo,
  uploadForge5050Logo,
  uploadForge5050Video,
} from '../services/forge5050Api';
import '../styles/the-forge-50-50.css';

const headlineStyles = [
  { id: 'purpleGold', label: 'Azul / Branco', sampleText: 'A VERDADE VOLTOU AO CENTRO' },
  { id: 'breakingFlash', label: 'Breaking', sampleText: 'AGORA A CASA CAIU' },
  { id: 'liveHf', label: 'Live HF', sampleText: 'AO VIVO NO CENTRO DO CAOS' },
  { id: 'doubleTicker', label: 'Ticker Duplo', sampleText: 'NINGUÉM CONSEGUE ESCONDER ISSO' },
];
const headlineStyleIds = new Set(headlineStyles.map(({ id }) => id));
const legacyHeadlineStyles = {
  stepOrange: 'purpleGold',
  stepBlue: 'purpleGold',
  stepCoral: 'breakingFlash',
  stepSpectrum: 'doubleTicker',
  blackGold: 'purpleGold',
  redBlack: 'breakingFlash',
  whiteBlack: 'doubleTicker',
};
const socialPlatforms = [
  { id: 'youtube', label: 'YouTube', metadataPlatform: 'youtube_shorts' },
  { id: 'instagram', label: 'Instagram', metadataPlatform: 'instagram' },
  { id: 'tiktok', label: 'TikTok', metadataPlatform: 'tiktok' },
];

const defaultConfig = {
  top_video: '', bottom_video: '', top_start: 0, top_end: 0, bottom_start: 0, bottom_end: 0,
  top_crop_x: 0.5, top_crop_y: 0.5, bottom_crop_x: 0.5, bottom_crop_y: 0.5,
  top_volume: 1, bottom_volume: 0, audio_mode: 'top', top_ratio: 0.5,
  render_mode: 'split', top_flip: 'none', bottom_flip: 'none', bottom_image_format: 'vertical',
  headline_text: '', headline_enabled: false, headline_y: 0.5, headline_position: 'none', headline_ratio: 0.1, headline_font_scale: 1, headline_palette: 'purpleGold',
  logo_enabled: false, logo_filename: '', logo_x: 0.5, logo_y: 0.15, logo_scale: 0.18, logo_opacity: 1,
};

const isImageMedia = (media) => media?.media_type === 'image';

const normalizeForge5050Config = (source = {}) => {
  const next = { ...defaultConfig, ...source };
  next.headline_palette = legacyHeadlineStyles[next.headline_palette] || next.headline_palette;
  if (!headlineStyleIds.has(next.headline_palette)) next.headline_palette = defaultConfig.headline_palette;
  if (typeof source.headline_enabled !== 'boolean') {
    next.headline_enabled = Boolean(source.headline_text?.trim()) && source.headline_position !== 'none';
  }
  if (source.headline_y === undefined) {
    next.headline_y = { top: 0, middle: 0.5, bottom: 1 }[source.headline_position] ?? defaultConfig.headline_y;
  }
  next.headline_y = Math.min(1, Math.max(0, Number(next.headline_y) || 0));
  return next;
};

function Forge5050HeadlineBand({ styleId, text, fontSize, compact = false }) {
  const safeText = (text || 'Headline').trim() || 'Headline';

  if (styleId === 'breakingFlash') {
    return <div className={`forge5050-headline-style style-breaking-flash ${compact ? 'compact' : ''}`}>
      <span className="forge5050-headline-accent accent-left" />
      <strong style={{ fontSize }}>{safeText}</strong>
      <span className="forge5050-headline-accent accent-right" />
    </div>;
  }

  if (styleId === 'liveHf') {
    return <div className={`forge5050-headline-style style-live-hf ${compact ? 'compact' : ''}`}>
      <div className="forge5050-live-badge"><span>LIVE</span></div>
      <strong style={{ fontSize }}>{safeText}</strong>
    </div>;
  }

  if (styleId === 'doubleTicker') {
    return <div className={`forge5050-headline-style style-double-ticker ${compact ? 'compact' : ''}`}>
      <strong style={{ fontSize }}>{safeText}</strong>
    </div>;
  }

  return <div className={`forge5050-headline-style style-blue-live ${compact ? 'compact' : ''}`}>
    <div className="forge5050-live-badge"><span>LIVE</span></div>
    <strong style={{ fontSize }}>{safeText}</strong>
  </div>;
}

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
  const [downloadingRender, setDownloadingRender] = useState(false);

  const videos = project?.videos || [];
  const videoOnlyOptions = useMemo(() => videos.filter((item) => !isImageMedia(item)), [videos]);
  const topVideo = useMemo(() => videos.find((item) => item.filename === config.top_video), [videos, config.top_video]);
  const bottomVideo = useMemo(() => videos.find((item) => item.filename === config.bottom_video), [videos, config.bottom_video]);
  const bottomIsImage = isImageMedia(bottomVideo);
  const renderTopOnly = config.render_mode === 'top_only';

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

  const changeAudioMode = (value) => setConfig((current) => ({
    ...current,
    audio_mode: value,
    top_volume: value === 'top' || value === 'both' ? (Number(current.top_volume) > 0 ? current.top_volume : 1) : current.top_volume,
    bottom_volume: value === 'bottom' || value === 'both' ? (Number(current.bottom_volume) > 0 ? current.bottom_volume : 1) : current.bottom_volume,
  }));

  const changeRenderMode = (value) => {
    setConfig((current) => ({
      ...current,
      render_mode: value,
      audio_mode: value === 'top_only' && current.audio_mode !== 'none' ? 'top' : current.audio_mode,
    }));
    if (value === 'top_only') {
      setCropEditingSlot('top');
      setCropMode(false);
      setShowCombinedPreview(Boolean(topVideo));
    }
  };

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
      setError(`Selecione a mídia ${slot === 'top' ? '1' : '2'} antes de ajustar o corte.`);
      return;
    }
    setCropEditingSlot(slot);
    setShowCombinedPreview(false);
    setCropMode(false);
  };

  const downloadRender = async () => {
    if (!render?.url) {
      setError('Renderize o vídeo antes de baixar o MP4 final.');
      return;
    }

    const filename = render.filename || 'forge5050-render.mp4';
    let fileHandle = null;

    // Deve ser chamado diretamente no clique para o navegador liberar o seletor nativo.
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Vídeo MP4', accept: { 'video/mp4': ['.mp4'] } }],
        });
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setError(err.message || 'Não foi possível abrir o seletor de pasta.');
        return;
      }
    }

    setDownloadingRender(true);
    setError('');
    try {
      const response = await fetch(forge5050DownloadUrl(render.url), { cache: 'no-store', headers: { Accept: 'video/mp4' } });
      if (!response.ok) throw new Error('Falha ao preparar o arquivo MP4 para download.');
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType && !contentType.includes('video/mp4') && !contentType.includes('application/octet-stream')) {
        throw new Error('O servidor não retornou um arquivo MP4 válido.');
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const signature = new TextDecoder().decode(bytes.slice(4, 8));
      if (signature !== 'ftyp') {
        throw new Error('O arquivo recebido não contém uma estrutura MP4 válida.');
      }

      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        try {
          await writable.write(bytes);
        } finally {
          await writable.close();
        }
        return;
      }

      const blob = new Blob([bytes], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      setError(err.message || 'Não foi possível salvar o vídeo MP4.');
    } finally {
      setDownloadingRender(false);
    }
  };

  const activateCropVideo = (slot) => {
    selectCropVideo(slot);
    setCropMode(true);
  };

  const joinVideos = async () => {
    if (!config.top_video || !config.bottom_video) {
      setError('Selecione o Vídeo 1 e a mídia inferior antes de unir o preview.');
      return;
    }
    const nextConfig = { ...config, render_mode: 'split', top_ratio: 0.5 };
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
    if (!config.top_video || (!renderTopOnly && !config.bottom_video)) {
      setError(renderTopOnly ? 'Selecione o Vídeo 1 antes de gerar o hook.' : 'Selecione as duas mídias antes de gerar o hook.');
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
    if (!project || !config.top_video || (!renderTopOnly && !config.bottom_video)) {
      setError(renderTopOnly ? 'Adicione o Vídeo 1 antes de renderizar.' : 'Adicione e selecione as duas mídias antes de renderizar.'); return;
    }
    setBusy(true); setError(''); setRender(null);
    try {
      const saved = await save(config);
      if (!saved) return;
      const data = await renderForge5050(project.id, config);
      const rendered = data?.url && data?.filename ? data : data?.render || data?.last_render;
      if (!rendered?.url || !rendered?.filename) {
        throw new Error('A API concluiu o render, mas não retornou o arquivo MP4 para o preview.');
      }
      setRender(rendered);
      setProject((current) => current ? {
        ...current,
        config: saved.config || config,
        last_render: rendered,
      } : current);
      setSocialMetadata({});
      setShowCombinedPreview(true);
      refresh().catch(() => {});
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const uploadLogo = async (file) => {
    if (!file || !project) return;
    setBusy(true); setError('');
    try {
      const data = await uploadForge5050Logo(project.id, file);
      setProject(data);
      setConfig(normalizeForge5050Config(data.config));
      setRender(null);
      setJoinedPreview(false);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const removeLogo = async () => {
    if (!project || !project.logo || !window.confirm('Excluir a logo deste projeto?')) return;
    setBusy(true); setError('');
    try {
      const data = await deleteForge5050Logo(project.id);
      setProject(data);
      setConfig(normalizeForge5050Config(data.config));
      setRender(null);
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
      const descriptionHint = renderTopOnly
        ? 'Vídeo vertical usando somente o Vídeo 1 para publicação em rede social.'
        : `Vídeo vertical 50/50 com Vídeo 1 e ${bottomIsImage ? 'imagem inferior' : 'vídeo inferior'} para publicação em rede social.`;
      const data = await generateForge5050SocialMetadata(item.metadataPlatform, titleHint, descriptionHint);
      setSocialMetadata((current) => ({ ...current, [platform]: data }));
    } catch (err) { setError(err.message); } finally { setGeneratingMetadataFor(''); }
  };

  if (loading) return <main className="forge5050-page"><div className="forge5050-loading"><Loader className="forge5050-spin" /> Carregando The Forge 50/50...</div></main>;

  return <main className="forge5050-page">
    <header className="forge5050-header">
      <div><span className="forge5050-kicker">EDITOR VERTICAL</span><h1>The Forge 50/50</h1><p>Una vídeo com vídeo ou imagem em 1080 × 1920, com áudio e headline.</p></div>
      <div className="forge5050-actions"><button className="forge5050-button primary" onClick={createProject} disabled={busy}><Plus size={16} /> Novo projeto</button><button className="forge5050-button ghost" onClick={() => refresh().catch((err) => setError(err.message))}><RefreshCw size={15} /> Atualizar</button></div>
    </header>
    {error && <div className="forge5050-error">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

    <Panel title="Projetos 50/50" open={open.projects} onToggle={() => setOpen((v) => ({ ...v, projects: !v.projects }))}>
      <div className="forge5050-projects">{projects.map((item) => <button key={item.id} className={`forge5050-project ${item.id === project?.id ? 'active' : ''}`} onClick={() => openProject(item.id)}><Film size={15} /> {item.title}</button>)}{!projects.length && <span className="forge5050-muted">Crie o primeiro projeto para começar.</span>}{project && <button className="forge5050-delete" onClick={removeProject} disabled={busy}><Trash2 size={14} /> Excluir projeto atual</button>}</div>
      {project && <LogoControls project={project} config={config} update={update} busy={busy} onUpload={uploadLogo} onRemove={removeLogo} />}
    </Panel>

    {project && <>
      <Panel title="Biblioteca de mídias" open={open.library} onToggle={() => setOpen((v) => ({ ...v, library: !v.library }))}>
        <div className="forge5050-library">{['top', 'bottom'].map((slot) => <VideoSlot key={slot} slot={slot} video={slot === 'top' ? topVideo : bottomVideo} busy={busy} onUpload={upload} config={config} update={update} onSelect={() => activateCropVideo(slot)} />)}</div>
      </Panel>

      <div className="forge5050-grid">
        <section className="forge5050-panel forge5050-preview-panel">
          <h2>Preview de edição 50/50</h2>
          <div className="forge5050-preview-toolbar" role="group" aria-label="Selecionar vídeo para corte">
            <span>Cortar no preview:</span>
            <button type="button" className={cropEditingSlot === 'top' ? 'active' : ''} onClick={() => selectCropVideo('top')} disabled={!topVideo}>Vídeo 1</button>
            <button type="button" className={cropEditingSlot === 'bottom' ? 'active' : ''} onClick={() => selectCropVideo('bottom')} disabled={!bottomVideo}>Mídia 2</button>
            <button type="button" className="preview-eye" onClick={() => setShowCombinedPreview((current) => !current)} disabled={!topVideo || (!renderTopOnly && !bottomVideo)} title={showCombinedPreview ? 'Mostrar corte individual' : 'Ver prévia final'} aria-label={showCombinedPreview ? 'Mostrar corte individual' : 'Ver prévia final'}>
              {showCombinedPreview ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button type="button" className="join" onClick={joinVideos} disabled={busy || !topVideo || !bottomVideo}><Check size={14} /> Unir mídias</button>
          </div>
          <div className={`forge5050-preview ${showCombinedPreview ? 'combined' : 'single'} ${renderTopOnly ? 'top-only' : ''}`} style={{ '--top': `${renderTopOnly ? 100 : config.top_ratio * 100}%` }}>
            {showCombinedPreview ? <div className="forge5050-combined-stage">
              <PreviewVideo video={topVideo} className="top" cropX={config.top_crop_x} cropY={config.top_crop_y} trimStart={config.top_start} trimEnd={config.top_end} flip={config.top_flip} />
              {!renderTopOnly && <PreviewVideo video={bottomVideo} className={`bottom ${bottomIsImage ? `image-${config.bottom_image_format}` : ''}`} cropX={config.bottom_crop_x} cropY={config.bottom_crop_y} trimStart={config.bottom_start} trimEnd={config.bottom_end} flip={config.bottom_flip} />}
              {project.logo && config.logo_enabled && config.logo_filename && <LogoOverlay logo={project.logo} config={config} update={update} />}
              {config.headline_enabled && config.headline_text.trim() && <div
                className="forge5050-headline"
                style={{
                  '--headline-top': `${((1 - config.headline_ratio) * config.headline_y * 100).toFixed(3)}%`,
                  '--headline-band-height': `${Math.round(config.headline_ratio * 100)}%`,
                  '--headline-font-size-width': `${(10 * config.headline_font_scale).toFixed(3)}cqw`,
                  '--headline-font-size-height': `${(110.222 * config.headline_ratio * config.headline_font_scale).toFixed(3)}cqw`,
                }}
              ><Forge5050HeadlineBand styleId={config.headline_palette} text={config.headline_text} /></div>}
            </div> : <PreviewVideo video={cropEditingSlot === 'top' ? topVideo : bottomVideo} className={`solo ${cropEditingSlot} ${cropEditingSlot === 'bottom' && bottomIsImage ? `image-${config.bottom_image_format}` : ''}`} cropActive={cropMode} whole={!cropMode} cropX={config[`${cropEditingSlot}_crop_x`]} cropY={config[`${cropEditingSlot}_crop_y`]} trimStart={config[`${cropEditingSlot}_start`]} trimEnd={config[`${cropEditingSlot}_end`]} flip={config[`${cropEditingSlot}_flip`]} />}
          </div>
          <p className="forge5050-note">Selecione cada mídia para ajustar separadamente. O olho mostra o resultado final antes da renderização.</p>
          <button className="forge5050-button primary wide" onClick={renderVideo} disabled={busy}><Film size={16} /> {busy ? 'Renderizando...' : renderTopOnly ? 'Renderizar somente Vídeo 1' : 'Renderizar vídeo 50/50'}</button>
        </section>

        <div className="forge5050-editor-controls">
          <Panel title="Ajustes dos vídeos" open={open.controls} onToggle={() => setOpen((v) => ({ ...v, controls: !v.controls }))} className="forge5050-panel">
            <div className="forge5050-render-mode" role="group" aria-label="Modo de renderização">
              <button type="button" className={!renderTopOnly ? 'active' : ''} onClick={() => changeRenderMode('split')}><Film size={15} /> 50/50</button>
              <button type="button" className={renderTopOnly ? 'active' : ''} onClick={() => changeRenderMode('top_only')}><Film size={15} /> Somente Vídeo 1</button>
            </div>
            <div className="forge5050-control-grid"><Select label="Vídeo de cima" value={config.top_video} options={videoOnlyOptions} onChange={(value) => update('top_video', value)} /><Select label="Mídia de baixo" value={config.bottom_video} options={videos} onChange={(value) => update('bottom_video', value)} disabled={renderTopOnly} /></div>
            {!renderTopOnly && <label className="forge5050-label">Divisão {Math.round(config.top_ratio * 100)}/{100 - Math.round(config.top_ratio * 100)}<input type="range" min="0.3" max="0.7" step="0.01" value={config.top_ratio} onChange={(e) => update('top_ratio', Number(e.target.value))} /></label>}
            <div className="forge5050-control-grid"><Trim title="Vídeo de cima" active={cropEditingSlot === 'top'} onSelect={() => selectCropVideo('top')} />{!renderTopOnly && <Trim title={bottomIsImage ? 'Imagem de baixo' : 'Vídeo de baixo'} active={cropEditingSlot === 'bottom'} onSelect={() => selectCropVideo('bottom')} />}</div>
            <div className="forge5050-control-grid"><Range label="Volume de cima" value={config.top_volume} min="0" max="2" step="0.05" onChange={(value) => update('top_volume', value)} />{!renderTopOnly && !bottomIsImage && <Range label="Volume de baixo" value={config.bottom_volume} min="0" max="2" step="0.05" onChange={(value) => update('bottom_volume', value)} />}</div>
            <div className="forge5050-control-grid"><Select label="Girar/inverter Vídeo 1" value={config.top_flip} options={[{ value: 'none', original_name: 'Normal' }, { value: 'horizontal', original_name: 'Horizontal' }, { value: 'vertical', original_name: 'Vertical' }]} onChange={(value) => update('top_flip', value)} />{!renderTopOnly && <Select label="Girar/inverter mídia inferior" value={config.bottom_flip} options={[{ value: 'none', original_name: 'Normal' }, { value: 'horizontal', original_name: 'Horizontal' }, { value: 'vertical', original_name: 'Vertical' }]} onChange={(value) => update('bottom_flip', value)} />}</div>
            {!renderTopOnly && bottomIsImage && <div className="forge5050-image-format" role="group" aria-label="Formato da imagem inferior"><span>Formato da imagem inferior</span><button type="button" className={config.bottom_image_format === 'vertical' ? 'active' : ''} onClick={() => update('bottom_image_format', 'vertical')}><ImageIcon size={15} /> Vertical 9:16</button><button type="button" className={config.bottom_image_format === 'square' ? 'active' : ''} onClick={() => update('bottom_image_format', 'square')}><ImageIcon size={15} /> Quadrada 1:1</button></div>}
            <CropInspector cropEditingSlot={cropEditingSlot} config={config} update={update} cropMode={cropMode} setCropMode={setCropMode} setShowCombinedPreview={setShowCombinedPreview} topVideo={topVideo} bottomVideo={bottomVideo} joinedPreview={joinedPreview} onSelect={() => selectCropVideo(cropEditingSlot)} />
            <Select label="Áudio usado" value={(renderTopOnly || bottomIsImage) && config.audio_mode !== 'none' ? 'top' : config.audio_mode} options={renderTopOnly || bottomIsImage ? [{ value: 'top', original_name: 'Somente Vídeo 1' }, { value: 'none', original_name: 'Sem áudio' }] : [{ value: 'top', original_name: 'Somente vídeo de cima' }, { value: 'bottom', original_name: 'Somente vídeo de baixo' }, { value: 'both', original_name: 'Os dois vídeos' }, { value: 'none', original_name: 'Sem áudio' }]} onChange={changeAudioMode} />
            <button className="forge5050-button secondary" onClick={save} disabled={busy}><Check size={15} /> Salvar ajustes</button>
          </Panel>

          <Panel title="Headline" open={open.headline} onToggle={() => setOpen((v) => ({ ...v, headline: !v.headline }))} className="forge5050-headline-panel">
            <label className="forge5050-label">Texto da headline<input value={config.headline_text} maxLength={120} onChange={(e) => update('headline_text', e.target.value)} placeholder="Digite a headline" /></label>
            <button type="button" className="forge5050-button hook" onClick={generateHook} disabled={generatingHook || busy || !topVideo || (!renderTopOnly && !bottomVideo)}>
              {generatingHook ? <><Loader size={15} className="forge5050-spin" /> Gerando hook...</> : <><Search size={15} /> Gerar hook + CTA com ChatGPT</>}
            </button>
            <label className="forge5050-headline-toggle"><input type="checkbox" checked={Boolean(config.headline_enabled)} onChange={(e) => update('headline_enabled', e.target.checked)} /> Usar headline</label>
            <div className="forge5050-control-grid"><Range label={`Altura da faixa ${Math.round(config.headline_ratio * 100)}%`} value={config.headline_ratio} min="0.06" max="0.20" step="0.01" onChange={(value) => update('headline_ratio', value)} /><Range label={`Posição vertical ${Math.round(config.headline_y * 100)}%`} value={config.headline_y} min="0" max="1" step="0.01" onChange={(value) => update('headline_y', value)} /><Range label={`Tamanho ${config.headline_font_scale.toFixed(2)}x`} value={config.headline_font_scale} min="0.7" max="1.8" step="0.05" onChange={(value) => update('headline_font_scale', value)} /></div>
            <div className="forge5050-style-grid">{headlineStyles.map(({ id, label, sampleText }) => <button key={id} className={config.headline_palette === id ? 'selected' : ''} onClick={() => update('headline_palette', id)}><span className="forge5050-swatch"><Forge5050HeadlineBand styleId={id} text={sampleText} compact /></span>{label}</button>)}</div>
          </Panel>
        </div>
      </div>

      {render && <section className="forge5050-panel forge5050-platform-results"><h2>Vídeo renderizado</h2><video key={`${render.filename}-${render.created_at || ''}`} src={`${forge5050FileUrl(render.url)}${String(render.url || '').includes('?') ? '&' : '?'}render=${encodeURIComponent(render.created_at || render.filename)}`} controls className="forge5050-rendered" /><button type="button" className="forge5050-button secondary" onClick={downloadRender} disabled={downloadingRender}><Download size={16} /> {downloadingRender ? 'Salvando MP4...' : 'Baixar vídeo MP4'}</button><div className="forge5050-social-generator"><h3>Gerar publicação para uma rede social</h3><Select label="Rede social" value={selectedMetadataPlatform} options={socialPlatforms.map((item) => ({ value: item.id, original_name: item.label }))} onChange={setSelectedMetadataPlatform} /><button type="button" className="forge5050-button metadata-button" onClick={() => generateSocialMetadata(selectedMetadataPlatform)} disabled={generatingMetadataFor !== ''}>{generatingMetadataFor === selectedMetadataPlatform ? <><Loader size={15} className="forge5050-spin" /> Gerando...</> : <><Search size={15} /> Gerar título, descrição e hashtags</>}</button>{socialMetadata[selectedMetadataPlatform]?.title && <div className="forge5050-metadata"><label>Título<input value={socialMetadata[selectedMetadataPlatform].title} readOnly /></label><label>Descrição<textarea value={socialMetadata[selectedMetadataPlatform].description || ''} readOnly rows={5} /></label><label>Hashtags<input value={(socialMetadata[selectedMetadataPlatform].hashtags || []).join(' ')} readOnly /></label></div>}</div><button type="button" className="forge5050-button delete-render" onClick={removeRender} disabled={busy}><Trash2 size={15} /> Excluir vídeo renderizado</button></section>}
    </>}
  </main>;
}

function Panel({ title, open, onToggle, children, className = '' }) { return <section className={`forge5050-panel ${className}`}><button className="forge5050-panel-title" onClick={onToggle}><span>{title}</span>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>{open && children}</section>; }
function LogoControls({ project, config, update, busy, onUpload, onRemove }) {
  return <div className="forge5050-logo-controls">
    <div className="forge5050-logo-heading"><div><strong>Logo do projeto</strong><span>{project.logo ? project.logo.original_name : 'Nenhuma logo enviada'}</span></div><label className="forge5050-headline-toggle"><input type="checkbox" checked={Boolean(config.logo_enabled)} onChange={(event) => update('logo_enabled', event.target.checked)} disabled={!project.logo || busy} /> Usar logo</label></div>
    <div className="forge5050-logo-actions">
      <label className="forge5050-upload forge5050-logo-upload"><Upload size={15} /> {project.logo ? 'Trocar logo' : 'Adicionar logo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { onUpload(event.target.files?.[0]); event.currentTarget.value = ''; }} disabled={busy} /></label>
      {project.logo && <button type="button" className="forge5050-logo-delete" onClick={onRemove} disabled={busy}><Trash2 size={14} /> Excluir</button>}
    </div>
    {project.logo && <>
      <div className="forge5050-logo-thumb-wrap"><img className="forge5050-logo-thumb" src={forge5050FileUrl(project.logo.url)} alt="Prévia da logo" /><span>Arraste a logo no preview unido para escolher qualquer posição.</span></div>
      <div className="forge5050-control-grid forge5050-logo-grid">
        <Range label={`Tamanho ${Math.round(Number(config.logo_scale || 0.18) * 100)}%`} value={config.logo_scale} min="0.04" max="0.60" step="0.01" onChange={(value) => update('logo_scale', value)} />
        <Range label={`Opacidade ${Math.round(Number(config.logo_opacity ?? 1) * 100)}%`} value={config.logo_opacity} min="0" max="1" step="0.01" onChange={(value) => update('logo_opacity', value)} />
      </div>
    </>}
  </div>;
}
function LogoOverlay({ logo, config, update }) {
  const dragRef = useRef(null);
  const x = Math.min(1, Math.max(0, Number(config.logo_x) || 0.5));
  const y = Math.min(1, Math.max(0, Number(config.logo_y) || 0.15));
  const scale = Math.min(0.6, Math.max(0.04, Number(config.logo_scale) || 0.18));
  const opacity = Math.min(1, Math.max(0, Number(config.logo_opacity ?? 1)));
  const move = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const nextX = Math.min(1, Math.max(0, drag.x + (event.clientX - drag.startX) / drag.rect.width));
    const nextY = Math.min(1, Math.max(0, drag.y + (event.clientY - drag.startY) / drag.rect.height));
    update('logo_x', Number(nextX.toFixed(4)));
    update('logo_y', Number(nextY.toFixed(4)));
  };
  const stop = () => { dragRef.current = null; };
  return <img
    className="forge5050-logo-overlay"
    src={forge5050FileUrl(logo.url)}
    alt="Logo sobre o vídeo"
    draggable="false"
    style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${scale * 100}%`, opacity }}
    onDragStart={(event) => event.preventDefault()}
    onPointerDown={(event) => {
      const stage = event.currentTarget.closest('.forge5050-combined-stage');
      if (!stage) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = { startX: event.clientX, startY: event.clientY, x, y, rect: stage.getBoundingClientRect() };
    }}
    onPointerMove={move}
    onPointerUp={stop}
    onPointerCancel={stop}
  />;
}
function PreviewVideo({ video, className, cropActive = false, whole = false, cropX = 0.5, cropY = 0.5, trimStart = 0, trimEnd = 0, flip = 'none' }) {
  const videoRef = useRef(null);
  const start = Math.max(0, Number(trimStart) || 0);
  const end = Math.max(0, Number(trimEnd) || 0);
  const source = video ? forge5050FileUrl(video.url) : '';

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !source) return undefined;
    const seekToTrimStart = () => {
      if (start > 0 && Number.isFinite(element.duration)) {
        element.currentTime = Math.min(start, Math.max(0, element.duration - 0.05));
      }
    };
    element.addEventListener('loadedmetadata', seekToTrimStart);
    if (element.readyState >= 1) seekToTrimStart();
    return () => element.removeEventListener('loadedmetadata', seekToTrimStart);
  }, [source, start]);

  const keepPlaybackInsideTrim = (event) => {
    const element = event.currentTarget;
    if (end > start + 0.05 && element.currentTime >= end - 0.02) {
      element.currentTime = start;
    }
  };
  const transforms = [];
  if (cropActive) transforms.push('scale(1.35)');
  if (flip === 'horizontal') transforms.push('scaleX(-1)');
  if (flip === 'vertical') transforms.push('scaleY(-1)');
  const mediaStyle = {
    objectFit: whole ? 'contain' : 'cover',
    objectPosition: `${cropX * 100}% ${cropY * 100}%`,
    transform: transforms.length ? transforms.join(' ') : 'none',
    transformOrigin: `${cropX * 100}% ${cropY * 100}%`,
  };
  return <div className={`forge5050-preview-video ${className} ${cropActive ? 'crop-active' : ''}`}>
    {video && isImageMedia(video) ? <img src={source} alt={video.original_name || 'Imagem inferior'} style={mediaStyle} /> : video ? <video ref={videoRef} src={source} controls onLoadedMetadata={() => {
      const element = videoRef.current;
      if (element && start > 0) element.currentTime = Math.min(start, Math.max(0, element.duration - 0.05));
    }} onTimeUpdate={keepPlaybackInsideTrim} style={mediaStyle} /> : <Film size={26} />}
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
  const image = isImageMedia(video);
  const bottom = slot === 'bottom';

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
    <div className="forge5050-slot-title"><strong>{slot === 'top' ? 'Vídeo de cima' : 'Mídia de baixo'}</strong><span>{video ? `${video.width}×${video.height}${image ? ' · imagem' : ` · ${duration.toFixed(1)}s`}` : bottom ? 'Vídeo ou imagem' : 'Aguardando vídeo'}</span></div>
    {video ? image ? <img className="forge5050-thumb forge5050-thumb-image" src={forge5050FileUrl(video.url)} alt={video.original_name || 'Imagem inferior'} /> : <video className="forge5050-thumb" src={forge5050FileUrl(video.url)} controls /> : <div className="forge5050-empty">{bottom ? <ImageIcon size={24} /> : <Film size={24} />} {bottom ? 'Escolha vídeo ou imagem' : 'Escolha um vídeo'}</div>}
    <label className="forge5050-upload"><Upload size={15} /> {video ? 'Trocar mídia' : bottom ? 'Adicionar vídeo ou imagem' : 'Adicionar vídeo'}<input type="file" accept={bottom ? 'video/*,image/png,image/jpeg,image/webp' : 'video/*'} onChange={(e) => { onUpload(slot, e.target.files?.[0]); e.currentTarget.value = ''; }} disabled={busy} /></label>
    {video && !image && <div className="forge5050-slot-trim">
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
function Select({ label, value, options, onChange, disabled = false }) { return <label className={`forge5050-label ${disabled ? 'disabled' : ''}`}>{label}<select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}><option value="">Selecione</option>{options.map((option) => { const optionValue = option.value ?? option.filename; return <option key={optionValue} value={optionValue}>{option.original_name || option.label || optionValue}</option>; })}</select></label>; }
function Range({ label, value, min, max, step, onChange }) { return <label className="forge5050-label">{label}<input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>; }
function Trim({ prefix, title, active, onSelect }) { return <div className={`forge5050-trim ${active ? 'active' : ''}`}><div className="forge5050-trim-heading"><h3>{title}</h3><button type="button" onClick={onSelect}>{active ? 'Selecionado no preview' : 'Selecionar no preview'}</button></div></div>; }
function CropInspector({ cropEditingSlot, config, update, cropMode, setCropMode, setShowCombinedPreview, topVideo, bottomVideo, joinedPreview, onSelect }) {
  const selectedVideo = cropEditingSlot === 'top' ? topVideo : bottomVideo;
  const prefix = cropEditingSlot === 'top' ? 'top' : 'bottom';
  return <div className="forge5050-crop-inspector">
    <div className="forge5050-crop-inspector-heading"><strong>Enquadramento {cropEditingSlot === 'top' ? 'do Vídeo 1 · cima' : isImageMedia(selectedVideo) ? 'da imagem · baixo' : 'do Vídeo 2 · baixo'}</strong><div className="forge5050-crop-actions"><button type="button" className="forge5050-select-button" onClick={() => { setShowCombinedPreview(false); setCropMode(false); onSelect(); }} disabled={!selectedVideo}><MousePointer2 size={13} /> Selecionar mídia</button><button type="button" className="forge5050-cut-button" onClick={() => { setShowCombinedPreview(false); setCropMode(true); }} disabled={!selectedVideo}><Scissors size={14} /> Cortar/enquadrar</button></div></div>
    <span>{cropMode ? 'As linhas verdes estão ativas no vídeo selecionado. Ajuste X e Y e confira o resultado no preview.' : 'Selecione o vídeo e clique em Cortar vídeo para ativar as linhas verdes.'}</span>
    <div className="forge5050-control-grid">
      <Range label={`Ajuste lateral ${Math.round((config[`${prefix}_crop_x`] || 0.5) * 100)}%`} value={config[`${prefix}_crop_x`]} min="0" max="1" step="0.01" onChange={(value) => update(`${prefix}_crop_x`, value)} />
      <Range label={`Ajuste vertical ${Math.round((config[`${prefix}_crop_y`] || 0.5) * 100)}%`} value={config[`${prefix}_crop_y`]} min="0" max="1" step="0.01" onChange={(value) => update(`${prefix}_crop_y`, value)} />
    </div>
    {joinedPreview && <small className="forge5050-joined-note"><Check size={13} /> Vídeos unidos no enquadramento 50/50.</small>}
  </div>;
}

export default TheForge5050;
