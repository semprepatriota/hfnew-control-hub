import React, { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Bot,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Download,
  Film,
  FolderOpen,
  ImagePlus,
  Loader,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Tags,
  Trash2,
  Type,
  Upload,
  Video,
  Wand2,
} from 'lucide-react';
import {
  createForge2Project,
  deleteForge2Project,
  forge2FileUrl,
  getForge2CopyAgentConfig,
  getForge2Health,
  getForge2Project,
  getForge2StudioConfig,
  listForge2Projects,
  saveForge2CopyAgentConfig,
  saveForge2StudioConfig,
  uploadForge2BaseVideo,
  uploadForge2Gif,
  uploadForge2Music,
  removeForge2Asset,
  generateForge2Copy,
  generateForge2Publication,
  renderForge2Studio,
  scheduleForge2Render,
  publishForge2ToYouTube,
} from '../services/forge2Api';
import '../styles/the-forge-2.css';

const YOUTUBE_CATEGORIES = [
  { value: '1', label: 'Film & Animation' },
  { value: '10', label: 'Music' },
  { value: '15', label: 'Pets & Animals' },
  { value: '17', label: 'Sports' },
  { value: '19', label: 'Travel & Events' },
  { value: '20', label: 'Gaming' },
  { value: '22', label: 'People & Blogs' },
  { value: '23', label: 'Comedy' },
  { value: '24', label: 'Entertainment' },
  { value: '25', label: 'News & Politics' },
  { value: '26', label: 'Howto & Style' },
  { value: '27', label: 'Education' },
  { value: '28', label: 'Science & Technology' },
  { value: '29', label: 'Nonprofits & Activism' },
];

const FORGE2_ITEMS = [
  'Biblioteca 9:16',
  'Biblioteca 1:1',
  'Biblioteca recolhivel',
  'Preview central forte',
  'CRONOS Mestre',
  'Agente específico opcional',
  'GIFs sobrepostos',
  'Musica de fundo',
  'Titulo',
  'Descricao',
  'Hashtags',
  'Categoria do YouTube',
  'Privacidade',
  'Agendamento',
  'Render/publicacao',
];

const TEXT_THEMES = [
  { id: 'classic_dark', label: 'Cinema escuro', color: '#ffffff', background: '#080c14' },
  { id: 'gold_light', label: 'Ouro claro', color: '#101217', background: '#f6d47b' },
  { id: 'blue_focus', label: 'Azul foco', color: '#ffffff', background: '#0b3b8f' },
  { id: 'red_impact', label: 'Vermelho impacto', color: '#ffffff', background: '#a20f18' },
];

function createDefaultStudio() {
  return {
    library_collapsed: false,
    selected_base_asset_id: '',
    output_aspect_ratio: '9:16',
    base_videos_vertical: [],
    base_videos_square: [],
    gif_overlays: [],
    music_tracks: [],
    text_overlay: {
      topic: '',
      style: 'oracao',
      generated_text: '',
      font_family: 'Playfair Display',
      font_size: 58,
      line_height: 1.08,
      letter_spacing: 0,
      color: '#ffffff',
      shadow: true,
      overlay_theme: 'classic_dark',
      background_opacity: 0.5,
      position_x: 50,
      position_y: 32,
      box_width: 70,
      box_height: 48,
      align: 'center',
      animation: 'fade',
    },
    publication: {
      title: '',
      description: '',
      hashtags: [],
      youtube_category: '22',
      privacy_status: 'private',
      schedule_at: '',
    },
    presets: [
      { id: 'preset_1', label: 'Preset 1', gif_asset_id: '', music_asset_id: '', volume: 0.7, text_style: 'oracao' },
      { id: 'preset_2', label: 'Preset 2', gif_asset_id: '', music_asset_id: '', volume: 0.7, text_style: 'frase_dia' },
      { id: 'preset_3', label: 'Preset 3', gif_asset_id: '', music_asset_id: '', volume: 0.7, text_style: 'motivacional' },
    ],
    preview_muted: false,
    preview_loop: true,
  };
}

function assetDurationLabel(asset) {
  if (!asset?.duration) return '-';
  return `${asset.duration.toFixed(1)}s`;
}

function getTextTheme(themeId) {
  return TEXT_THEMES.find((theme) => theme.id === themeId) || TEXT_THEMES[0];
}

function hexToRgba(hex, opacity) {
  const value = (hex || '#000000').replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map((item) => item + item).join('')
    : value.padEnd(6, '0').slice(0, 6);
  const r = Number.parseInt(normalized.slice(0, 2), 16) || 0;
  const g = Number.parseInt(normalized.slice(2, 4), 16) || 0;
  const b = Number.parseInt(normalized.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(opacity, 1))})`;
}

function clampPercent(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function ProjectCard({ item, active, onClick, onDelete }) {
  return (
    <div className={`forge2-project-card ${active ? 'active' : ''}`}>
      <button type="button" className="forge2-project-card-main" onClick={onClick}>
        <strong>{item.title}</strong>
        <span>{item.status}</span>
        <small>{item.resolution || item.id}</small>
      </button>
      <button type="button" className="forge2-project-delete" onClick={onDelete}>
        <Trash2 size={14} />
        Excluir
      </button>
    </div>
  );
}

function LibraryAssetCard({ asset, selected, onSelect, onDelete }) {
  return (
    <div className={`forge2-library-card ${selected ? 'selected' : ''}`}>
      <button type="button" className="forge2-library-select" onClick={onSelect}>
        <video src={forge2FileUrl(asset.url)} muted playsInline preload="metadata" />
        <div>
          <strong>{asset.filename}</strong>
          <span>{asset.width ? `${asset.width}x${asset.height}` : asset.aspect_ratio}</span>
          <small>{assetDurationLabel(asset)}</small>
        </div>
      </button>
      <div className="forge2-library-card-actions">
        <button type="button" onClick={onSelect}>{selected ? 'Desselecionar' : 'Selecionar'}</button>
        <button type="button" className="danger" onClick={onDelete}>
          <Trash2 size={14} />
          Excluir
        </button>
      </div>
    </div>
  );
}

function TheForge2() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [project, setProject] = useState(null);
  const [studio, setStudio] = useState(createDefaultStudio());
  const [copyAgent, setCopyAgent] = useState({
    provider: 'central_cronos',
    model: 'gpt-4.1-mini',
    configured: false,
    api_key_masked: '',
    api_key: '',
  });
  const [newProjectTitle, setNewProjectTitle] = useState('Forge 2.0 Curto');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [libraryTab, setLibraryTab] = useState('9:16');
  const [baseUploadFile, setBaseUploadFile] = useState(null);
  const [gifUploadFile, setGifUploadFile] = useState(null);
  const [musicUploadFile, setMusicUploadFile] = useState(null);
  const [lastRender, setLastRender] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [apiHealth, setApiHealth] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [textControlsCollapsed, setTextControlsCollapsed] = useState(false);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const previewStageRef = useRef(null);

  const runAction = async (label, action) => {
    setBusyAction(label);
    setError('');
    setMessage('');
    try {
      return await action();
    } catch (err) {
      setError(err.message || 'Falha no Forge 2.0');
      return null;
    } finally {
      setBusyAction('');
    }
  };

  const refreshProjects = async () => {
    const data = await listForge2Projects();
    setProjects(data.projects || []);
    return data.projects || [];
  };

  const loadProject = async (projectId) => {
    if (!projectId) return;
    const [projectData, studioData, agentData] = await Promise.all([
      getForge2Project(projectId),
      getForge2StudioConfig(projectId),
      getForge2CopyAgentConfig(projectId),
    ]);
    setSelectedProjectId(projectId);
    setProject(projectData.project || null);
    setLastRender(projectData.edit_plan?.render_settings?.studio_last_render || null);
    setStudio(studioData.studio || createDefaultStudio());
    setCopyAgent((current) => ({
      ...current,
      ...agentData,
      api_key: '',
    }));
  };

  useEffect(() => {
    const bootstrap = async () => {
      await runAction('bootstrap', async () => {
        const health = await getForge2Health();
        setApiHealth(health);
        const list = await refreshProjects();
        if (list[0]?.id) {
          await loadProject(list[0].id);
        }
      });
    };
    bootstrap();
  }, []);

  const persistStudio = async (nextStudio, successMessage = 'Configuração do estúdio salva.') => {
    if (!selectedProjectId) return;
    const data = await saveForge2StudioConfig(selectedProjectId, nextStudio);
    setStudio(data.studio);
    setMessage(successMessage);
  };

  const selectedBaseAsset = [...(studio.base_videos_vertical || []), ...(studio.base_videos_square || [])]
    .find((item) => item.id === studio.selected_base_asset_id);

  const activeGif = (studio.gif_overlays || []).find((item) => item.enabled);
  const activeMusic = (studio.music_tracks || []).find((item) => item.enabled);
  const hashtagsText = (studio.publication?.hashtags || []).join(' ');
  const textTheme = getTextTheme(studio.text_overlay?.overlay_theme);
  const overlayTextColor = studio.text_overlay?.overlay_theme === 'classic_dark' && ['#111111', '#000000'].includes((studio.text_overlay?.color || '').toLowerCase())
    ? textTheme.color
    : (studio.text_overlay?.color || textTheme.color);
  const overlayPreviewText = studio.text_overlay.generated_text || 'A frase gerada vai aparecer aqui em cima do vídeo.';
  const overlayPreviewLines = overlayPreviewText.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  const handleCreateProject = async () => {
    await runAction('create-project', async () => {
      const data = await createForge2Project({
        title: newProjectTitle,
        description: newProjectDescription,
      });
      await refreshProjects();
      await loadProject(data.project.id);
      setMessage('Projeto do Forge 2.0 criado.');
    });
  };

  const handleDeleteProject = async (projectId) => {
    if (!projectId) return;
    await runAction('delete-project', async () => {
      await deleteForge2Project(projectId);
      const list = await refreshProjects();
      if (selectedProjectId === projectId) {
        const nextProjectId = list[0]?.id || '';
        if (nextProjectId) {
          await loadProject(nextProjectId);
        } else {
          setSelectedProjectId('');
          setProject(null);
          setStudio(createDefaultStudio());
          setCopyAgent({
            provider: 'central_cronos',
            model: 'gpt-4.1-mini',
            configured: false,
            api_key_masked: '',
            api_key: '',
          });
          setLastRender(null);
        }
      }
      setMessage('Projeto excluído.');
    });
  };

  const handleSaveAgent = async () => {
    if (!selectedProjectId) return;
    await runAction('save-agent', async () => {
      const data = await saveForge2CopyAgentConfig(selectedProjectId, {
        provider: copyAgent.provider,
        model: copyAgent.model,
        api_key: copyAgent.api_key,
      });
      setCopyAgent((current) => ({ ...current, ...data, api_key: '' }));
      setMessage('Configuração de agente salva.');
    });
  };

  const handleDeleteSpecificAgent = async () => {
    if (!selectedProjectId) return;
    await runAction('delete-copy-agent', async () => {
      const data = await saveForge2CopyAgentConfig(selectedProjectId, {
        provider: 'central_cronos',
        model: 'gpt-4.1-mini',
        api_key: '',
      });
      setCopyAgent((current) => ({ ...current, ...data, api_key: '' }));
      setMessage('Agente específico removido. CRONOS Mestre selecionado.');
    });
  };

  const handleGenerateCopy = async () => {
    if (!selectedProjectId) return;
    if (!studio.text_overlay.topic.trim()) {
      setError('Informe um tema para gerar a frase.');
      return;
    }
    await runAction('generate-copy', async () => {
      const assetDuration = Number(selectedBaseAsset?.duration || 0);
      const targetSeconds = Math.max(18, Math.min(45, Math.round(assetDuration || 24)));
      const data = await generateForge2Copy(selectedProjectId, {
        topic: studio.text_overlay.topic,
        style: studio.text_overlay.style,
        target_seconds: targetSeconds,
      });
      setStudio(data.studio);
      setMessage(`Texto gerado via ${data.generated.source} com alvo de ${targetSeconds}s.`);
    });
  };

  const handleGeneratePublication = async () => {
    if (!selectedProjectId) return;
    await runAction('generate-publication', async () => {
      const saved = await saveForge2StudioConfig(selectedProjectId, studio);
      const data = await generateForge2Publication(selectedProjectId, saved.studio);
      setStudio(data.studio);
      setMessage('Publicação gerada com CRONOS Mestre.');
    });
  };

  const handleBaseUpload = async () => {
    if (!selectedProjectId || !baseUploadFile) return;
    await runAction('upload-base', async () => {
      const data = await uploadForge2BaseVideo(selectedProjectId, baseUploadFile, libraryTab);
      setStudio(data.studio);
      setBaseUploadFile(null);
      setMessage('Vídeo base adicionado à biblioteca.');
    });
  };

  const handleGifUpload = async () => {
    if (!selectedProjectId || !gifUploadFile) return;
    await runAction('upload-gif', async () => {
      const data = await uploadForge2Gif(selectedProjectId, gifUploadFile);
      setStudio(data.studio);
      setGifUploadFile(null);
      setMessage('GIF adicionado ao projeto.');
    });
  };

  const handleMusicUpload = async () => {
    if (!selectedProjectId || !musicUploadFile) return;
    await runAction('upload-music', async () => {
      const data = await uploadForge2Music(selectedProjectId, musicUploadFile);
      setStudio(data.studio);
      setMusicUploadFile(null);
      setMessage('Faixa de música adicionada.');
    });
  };

  const updateStudioLocal = (updater) => {
    setStudio((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return next;
    });
  };

  const toggleLibrary = () => {
    updateStudioLocal((current) => ({ ...current, library_collapsed: !current.library_collapsed }));
  };

  const selectBaseAsset = (asset, aspectRatio) => {
    updateStudioLocal((current) => ({
      ...current,
      selected_base_asset_id: current.selected_base_asset_id === asset.id ? '' : asset.id,
      output_aspect_ratio: aspectRatio,
    }));
  };

  const removeAsset = async (assetKind, assetId) => {
    if (!selectedProjectId || !assetId) return;
    await runAction('remove-asset', async () => {
      const data = await removeForge2Asset(selectedProjectId, assetKind, assetId);
      setStudio(data.studio);
      setLastRender(null);
      setMessage('Item removido da biblioteca.');
    });
  };

  const toggleGifEnabled = (assetId) => {
    updateStudioLocal((current) => ({
      ...current,
      gif_overlays: current.gif_overlays.map((item) => ({
        ...item,
        enabled: item.id === assetId ? !item.enabled : false,
      })),
    }));
  };

  const updateActiveGif = (patch) => {
    if (!activeGif) return;
    updateStudioLocal((current) => ({
      ...current,
      gif_overlays: current.gif_overlays.map((item) => (
        item.id === activeGif.id
          ? {
              ...item,
              ...patch,
              overlay_x: patch.overlay_x === undefined ? item.overlay_x : clampPercent(patch.overlay_x, 2, 98),
              overlay_y: patch.overlay_y === undefined ? item.overlay_y : clampPercent(patch.overlay_y, 2, 98),
              overlay_scale: patch.overlay_scale === undefined ? item.overlay_scale : Math.max(0.2, Math.min(3, Number(patch.overlay_scale) || 1)),
            }
          : item
      )),
    }));
  };

  const handleGifPointerDown = (event) => {
    if (!activeGif || !previewStageRef.current) return;
    event.preventDefault();
    const rect = previewStageRef.current.getBoundingClientRect();

    const moveGif = (moveEvent) => {
      const x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const y = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      updateActiveGif({ overlay_x: x, overlay_y: y });
    };

    const stopMove = () => {
      window.removeEventListener('pointermove', moveGif);
      window.removeEventListener('pointerup', stopMove);
    };

    window.addEventListener('pointermove', moveGif);
    window.addEventListener('pointerup', stopMove);
  };

  const toggleMusicEnabled = (assetId) => {
    updateStudioLocal((current) => ({
      ...current,
      music_tracks: current.music_tracks.map((item) => ({
        ...item,
        enabled: item.id === assetId ? !item.enabled : false,
      })),
    }));
  };

  const savePresetSlot = (presetId) => {
    updateStudioLocal((current) => ({
      ...current,
      presets: (current.presets || []).map((preset) => (
        preset.id === presetId
          ? {
              ...preset,
              gif_asset_id: current.gif_overlays.find((item) => item.enabled)?.id || '',
              music_asset_id: current.music_tracks.find((item) => item.enabled)?.id || '',
              volume: current.music_tracks.find((item) => item.enabled)?.volume || 0.7,
              text_style: current.text_overlay.style,
            }
          : preset
      )),
    }));
    setMessage('Preset de mídia atualizado.');
  };

  const applyPresetSlot = (presetId) => {
    const preset = (studio.presets || []).find((item) => item.id === presetId);
    if (!preset) return;
    updateStudioLocal((current) => ({
      ...current,
      gif_overlays: current.gif_overlays.map((item) => ({
        ...item,
        enabled: preset.gif_asset_id ? item.id === preset.gif_asset_id : false,
      })),
      music_tracks: current.music_tracks.map((item) => ({
        ...item,
        enabled: preset.music_asset_id ? item.id === preset.music_asset_id : false,
        volume: preset.music_asset_id && item.id === preset.music_asset_id ? (preset.volume || item.volume) : item.volume,
      })),
      text_overlay: {
        ...current.text_overlay,
        style: preset.text_style || current.text_overlay.style,
      },
    }));
    setMessage(`${preset.label} aplicado.`);
  };

  const handleDownloadRenderMp4 = async () => {
    if (!lastRender?.download_url) {
      setError('Renderize o vídeo antes de baixar o MP4 final.');
      return;
    }
    await runAction('download-render', async () => {
      const filename = lastRender.filename || 'forge2-render.mp4';
      const response = await fetch(forge2FileUrl(lastRender.download_url), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Falha ao preparar o arquivo MP4 para download.');
      }

      const blob = await response.blob();
      const picker = window.showSaveFilePicker;
      if (typeof picker === 'function') {
        const handle = await picker({
          suggestedName: filename,
          types: [
            {
              description: 'Vídeo MP4',
              accept: { 'video/mp4': ['.mp4'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setMessage('Vídeo MP4 salvo no local escolhido.');
        return;
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setMessage('Download do render MP4 iniciado.');
    });
  };

  const handleRenderVideo = async () => {
    await runAction('render-forge2', async () => {
      await saveForge2StudioConfig(selectedProjectId, studio);
      const data = await renderForge2Studio(selectedProjectId);
      setStudio(data.studio || studio);
      setProject(data.project || project);
      setLastRender(data.render);
      setMessage('Render final do Forge 2.0 concluído.');
    });
  };

  const handleScheduleRender = async () => {
    if (!lastRender) {
      setError('Renderize o vídeo antes de programar na agenda.');
      return;
    }
    await runAction('schedule-forge2', async () => {
      await saveForge2StudioConfig(selectedProjectId, studio);
      const data = await scheduleForge2Render(selectedProjectId);
      setMessage(`Vídeo programado: ${data.schedule?.item?.scheduled_at || studio.publication.schedule_at}`);
    });
  };

  const handlePublishYouTube = async () => {
    if (!lastRender) {
      setError('Renderize o vídeo antes de publicar no YouTube.');
      return;
    }
    await runAction('publish-forge2', async () => {
      await saveForge2StudioConfig(selectedProjectId, studio);
      const data = await publishForge2ToYouTube(selectedProjectId);
      setMessage(`Publicado no YouTube: ${data.youtube?.short_url || data.youtube?.url || 'concluído'}`);
    });
  };

  const handleResetRender = () => {
    setLastRender(null);
    setMessage('Estado de render limpo para uma nova rodada.');
    setError('');
  };

  const renderAspectClass = studio.output_aspect_ratio === '1:1' ? 'square' : 'vertical';
  const activeLibrary = libraryTab === '9:16' ? studio.base_videos_vertical || [] : studio.base_videos_square || [];

  return (
    <div className="forge2-page forge2-page-rebuilt">
      <header className="forge2-header forge2-header-rebuilt">
        <div>
          <span className="forge2-kicker">Forge 2.0 · estúdio curto</span>
          <h1>The Forge 2.0</h1>
          <p>Vídeo base, frase sobreposta, GIF, música e publicação em um fluxo separado do Forge principal.</p>
        </div>
        <div className="forge2-status-card">
          <span>API</span>
          <strong>{apiHealth?.status || 'carregando'}</strong>
          <small>{FORGE2_ITEMS.length} itens fechados no escopo</small>
        </div>
      </header>

      <section className="forge2-scope-strip">
        {FORGE2_ITEMS.map((item, index) => (
          <span key={item}><strong>{index + 1}.</strong> {item}</span>
        ))}
      </section>

      <section className={`forge2-panel forge2-agent-top-panel ${agentPanelOpen ? 'open' : 'collapsed'}`}>
        <div className="forge2-panel-header">
          <div className="forge2-section-title">
            <Bot size={16} />
            <h2>Agente Mestre e agente específico</h2>
          </div>
          <button type="button" onClick={() => setAgentPanelOpen((current) => !current)}>
            {agentPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {agentPanelOpen ? 'Minimizar' : 'Abrir'}
          </button>
        </div>
        {agentPanelOpen && (
          <div className="forge2-agent-box forge2-agent-box-top">
            <label>
              <span>Agente ativo</span>
              <select value={copyAgent.provider} onChange={(event) => setCopyAgent((current) => ({ ...current, provider: event.target.value }))}>
                <option value="central_cronos">CRONOS Mestre</option>
                <option value="custom_openai">Agente específico deste projeto</option>
                <option value="local_fallback">Fallback local</option>
              </select>
            </label>
            <label>
              <span>Modelo</span>
              <input value={copyAgent.model} onChange={(event) => setCopyAgent((current) => ({ ...current, model: event.target.value }))} />
            </label>
            <label>
              <span>API do agente específico</span>
              <input
                type="password"
                value={copyAgent.api_key}
                placeholder={copyAgent.api_key_masked || 'Cole a chave somente se usar agente específico'}
                onChange={(event) => setCopyAgent((current) => ({ ...current, api_key: event.target.value }))}
                disabled={copyAgent.provider !== 'custom_openai'}
              />
            </label>
            <div className="forge2-agent-actions">
              <button type="button" onClick={handleSaveAgent} disabled={!selectedProjectId || Boolean(busyAction)}>
                <Save size={16} />
                Salvar agente
              </button>
              <button type="button" className="danger" onClick={handleDeleteSpecificAgent} disabled={!selectedProjectId || Boolean(busyAction)}>
                <Trash2 size={16} />
                Deletar agente específico
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="forge2-shell">
        <aside className="forge2-left-rail">
          <section className="forge2-panel">
            <div className="forge2-panel-header">
              <h2>Projetos</h2>
              <button type="button" onClick={() => runAction('refresh-projects', refreshProjects)} disabled={Boolean(busyAction)}>
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="forge2-create-box">
              <input value={newProjectTitle} onChange={(event) => setNewProjectTitle(event.target.value)} placeholder="Nome do projeto" />
              <textarea value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} placeholder="Descrição do projeto" rows={3} />
              <button type="button" onClick={handleCreateProject} disabled={!newProjectTitle.trim() || Boolean(busyAction)}>
                <Plus size={16} />
                Criar projeto
              </button>
            </div>
            <div className="forge2-project-list">
              {projects.map((item) => (
                <ProjectCard
                  key={item.id}
                  item={item}
                  active={item.id === selectedProjectId}
                  onClick={() => runAction('load-project', () => loadProject(item.id))}
                  onDelete={() => handleDeleteProject(item.id)}
                />
              ))}
            </div>
          </section>

          <section className={`forge2-text-controls forge2-text-controls-side ${textControlsCollapsed ? 'collapsed' : ''}`}>
            <div className="forge2-text-controls-header">
              <strong>Ajustes da frase</strong>
              <button type="button" onClick={() => setTextControlsCollapsed((current) => !current)}>
                {textControlsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>
            {!textControlsCollapsed && (
              <>
                <div className="forge2-slider-grid forge2-preview-sliders">
                  <label><span>Fonte {studio.text_overlay.font_size}px</span><input type="range" min="24" max="150" value={studio.text_overlay.font_size} onChange={(event) => updateStudioLocal((current) => ({ ...current, text_overlay: { ...current.text_overlay, font_size: Number(event.target.value) } }))} /></label>
                  <label><span>Altura da caixa {studio.text_overlay.box_height}%</span><input type="range" min="18" max="88" value={studio.text_overlay.box_height} onChange={(event) => updateStudioLocal((current) => ({ ...current, text_overlay: { ...current.text_overlay, box_height: Number(event.target.value) } }))} /></label>
                  <label><span>Largura da caixa {studio.text_overlay.box_width}%</span><input type="range" min="35" max="95" value={studio.text_overlay.box_width} onChange={(event) => updateStudioLocal((current) => ({ ...current, text_overlay: { ...current.text_overlay, box_width: Number(event.target.value) } }))} /></label>
                  <label><span>Posição Y {studio.text_overlay.position_y}%</span><input type="range" min="5" max="88" value={studio.text_overlay.position_y} onChange={(event) => updateStudioLocal((current) => ({ ...current, text_overlay: { ...current.text_overlay, position_y: Number(event.target.value) } }))} /></label>
                  <label><span>Transparência {Math.round((studio.text_overlay.background_opacity ?? 0.5) * 100)}%</span><input type="range" min="0" max="100" value={Math.round((studio.text_overlay.background_opacity ?? 0.5) * 100)} onChange={(event) => updateStudioLocal((current) => ({ ...current, text_overlay: { ...current.text_overlay, background_opacity: Number(event.target.value) / 100 } }))} /></label>
                </div>

                <div className="forge2-theme-grid">
                  {TEXT_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      className={studio.text_overlay.overlay_theme === theme.id ? 'active' : ''}
                      onClick={() => updateStudioLocal((current) => ({
                        ...current,
                        text_overlay: {
                          ...current.text_overlay,
                          overlay_theme: theme.id,
                          color: theme.color,
                        },
                      }))}
                    >
                      <span style={{ background: theme.background, color: theme.color }}>Aa</span>
                      <strong>{theme.label}</strong>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="forge2-panel forge2-media-panel">
            <div className="forge2-panel-header">
              <div className="forge2-section-title">
                <ImagePlus size={16} />
                <h2>GIFs e música</h2>
              </div>
            </div>

            <div className="forge2-inline-upload compact-stack">
              <label className="forge2-file-input compact">
                <ImagePlus size={16} />
                <span>{gifUploadFile ? gifUploadFile.name : 'Adicionar GIF'}</span>
                <input type="file" accept=".gif,.webp,.png" onChange={(event) => setGifUploadFile(event.target.files?.[0] || null)} />
              </label>
              <button type="button" onClick={handleGifUpload} disabled={!selectedProjectId || !gifUploadFile || Boolean(busyAction)}>Enviar GIF</button>
            </div>

            <div className="forge2-asset-mini-list">
              {(studio.gif_overlays || []).map((asset) => (
                <div key={asset.id} className={`forge2-asset-mini-card ${asset.enabled ? 'active' : ''}`}>
                  <button type="button" className="forge2-asset-mini-select" onClick={() => toggleGifEnabled(asset.id)}>
                    <img src={forge2FileUrl(asset.url)} alt="" />
                    <div><strong>{asset.filename}</strong><span>{asset.enabled ? 'Ativo no preview' : 'Clique para usar'}</span></div>
                  </button>
                  <button
                    type="button"
                    className="forge2-asset-mini-delete"
                    aria-label={`Excluir ${asset.filename}`}
                    onClick={() => removeAsset('gif', asset.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {activeGif && (
              <label className="forge2-volume-slider">
                <span>Tamanho do GIF {Math.round((activeGif.overlay_scale || 1) * 100)}%</span>
                <input
                  type="range"
                  min="20"
                  max="300"
                  value={Math.round((activeGif.overlay_scale || 1) * 100)}
                  onChange={(event) => updateActiveGif({ overlay_scale: Number(event.target.value) / 100 })}
                />
              </label>
            )}

            <div className="forge2-inline-upload compact-stack">
              <label className="forge2-file-input compact">
                <AudioLines size={16} />
                <span>{musicUploadFile ? musicUploadFile.name : 'Adicionar música'}</span>
                <input type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*" onChange={(event) => setMusicUploadFile(event.target.files?.[0] || null)} />
              </label>
              <button type="button" onClick={handleMusicUpload} disabled={!selectedProjectId || !musicUploadFile || Boolean(busyAction)}>Enviar áudio</button>
            </div>

            <div className="forge2-asset-mini-list audio">
              {(studio.music_tracks || []).map((asset) => (
                <div key={asset.id} className={`forge2-asset-mini-card ${asset.enabled ? 'active' : ''}`}>
                  <button type="button" className="forge2-asset-mini-select" onClick={() => toggleMusicEnabled(asset.id)}>
                    <div><strong>{asset.filename}</strong><span>{assetDurationLabel(asset)}</span></div>
                  </button>
                  <button
                    type="button"
                    className="forge2-asset-mini-delete"
                    aria-label={`Excluir ${asset.filename}`}
                    onClick={() => removeAsset('music', asset.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {activeMusic && (
              <label className="forge2-volume-slider">
                <span>Volume da faixa {Math.round((activeMusic.volume || 0) * 100)}%</span>
                <input
                  type="range"
                  min="0"
                  max="120"
                  value={Math.round((activeMusic.volume || 0) * 100)}
                  onChange={(event) => updateStudioLocal((current) => ({
                    ...current,
                    music_tracks: current.music_tracks.map((item) => (
                      item.id === activeMusic.id
                        ? { ...item, volume: Number(event.target.value) / 100 }
                        : item
                    )),
                  }))}
                />
              </label>
            )}

            <div className="forge2-presets-block">
              <div className="forge2-presets-header">
                <strong>Combinações salvas</strong>
                <button type="button" onClick={() => persistStudio(studio, 'Ajustes de mídia salvos.')} disabled={!selectedProjectId || Boolean(busyAction)}>
                  <Save size={16} />
                  Salvar
                </button>
              </div>
              <div className="forge2-presets-grid">
                {(studio.presets || []).map((preset) => (
                  <div key={preset.id} className="forge2-preset-card">
                    <strong>{preset.label}</strong>
                    <span>{preset.text_style || 'sem estilo'}</span>
                    <div className="forge2-preset-actions">
                      <button type="button" onClick={() => applyPresetSlot(preset.id)}>Aplicar</button>
                      <button type="button" onClick={() => savePresetSlot(preset.id)}>Salvar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </aside>

        <main className="forge2-main-stage">
          <section className={`forge2-panel forge2-library-panel ${studio.library_collapsed ? 'collapsed' : ''}`}>
            <div className="forge2-panel-header">
              <div className="forge2-library-title">
                <FolderOpen size={16} />
                <h2>Biblioteca base recolhível</h2>
              </div>
              <button type="button" onClick={toggleLibrary}>
                {studio.library_collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>

            {!studio.library_collapsed && (
              <div className="forge2-library-body">
                <div className="forge2-library-tabs">
                  <button type="button" className={libraryTab === '9:16' ? 'active' : ''} onClick={() => setLibraryTab('9:16')}>9:16</button>
                  <button type="button" className={libraryTab === '1:1' ? 'active' : ''} onClick={() => setLibraryTab('1:1')}>1:1</button>
                </div>

                <div className="forge2-library-upload">
                  <label className="forge2-file-input compact">
                    <Upload size={16} />
                    <span>{baseUploadFile ? baseUploadFile.name : `Adicionar vídeo base ${libraryTab}`}</span>
                    <input type="file" accept="video/*" onChange={(event) => setBaseUploadFile(event.target.files?.[0] || null)} />
                  </label>
                  <button type="button" onClick={handleBaseUpload} disabled={!selectedProjectId || !baseUploadFile || Boolean(busyAction)}>
                    Enviar
                  </button>
                </div>

                <div className="forge2-library-grid">
                  {activeLibrary.map((asset) => (
                    <LibraryAssetCard
                      key={asset.id}
                      asset={asset}
                      selected={studio.selected_base_asset_id === asset.id}
                      onSelect={() => selectBaseAsset(asset, libraryTab)}
                      onDelete={() => removeAsset('base-video', asset.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="forge2-editor-grid">
            <section className="forge2-panel forge2-preview-panel">
              <div className="forge2-panel-header">
                <div>
                  <h2>Preview de edição MP4</h2>
                  <span className="forge2-panel-subtitle">
                    Vídeo base selecionado + frase + GIF + música
                  </span>
                </div>
                <button type="button" onClick={() => persistStudio(studio, 'Estúdio salvo.')} disabled={!selectedProjectId || Boolean(busyAction)}>
                  <Save size={16} />
                  Salvar estúdio
                </button>
              </div>

              <div ref={previewStageRef} className={`forge2-preview-stage ${renderAspectClass}`}>
                {selectedBaseAsset ? (
                  <>
                    <video
                      key={selectedBaseAsset.id}
                      src={forge2FileUrl(selectedBaseAsset.url)}
                      controls
                      muted={studio.preview_muted}
                      loop={studio.preview_loop}
                      playsInline
                      className="forge2-preview-base-video"
                    />
                    <div
                      className={`forge2-preview-copy align-${studio.text_overlay.align}`}
                      style={{
                        left: `${studio.text_overlay.position_x}%`,
                        top: `${studio.text_overlay.position_y}%`,
                        width: `${studio.text_overlay.box_width}%`,
                        minHeight: `${studio.text_overlay.box_height}%`,
                        color: overlayTextColor,
                        fontFamily: studio.text_overlay.font_family,
                        fontSize: `${studio.text_overlay.font_size}px`,
                        lineHeight: studio.text_overlay.line_height,
                        letterSpacing: `${studio.text_overlay.letter_spacing}px`,
                        backgroundColor: hexToRgba(textTheme.background, studio.text_overlay.background_opacity ?? 0.5),
                        textShadow: studio.text_overlay.shadow ? '0 2px 18px rgba(0,0,0,0.38)' : 'none',
                      }}
                    >
                      <strong className="forge2-preview-copy-title">{overlayPreviewLines[0]}</strong>
                      {overlayPreviewLines.slice(1).map((line, index) => (
                        <span key={`${line}-${index}`} className="forge2-preview-copy-line">{line}</span>
                      ))}
                    </div>
                    {activeGif && (
                      <img
                        src={forge2FileUrl(activeGif.url)}
                        alt=""
                        className="forge2-preview-gif"
                        draggable={false}
                        onPointerDown={handleGifPointerDown}
                        style={{
                          left: `${activeGif.overlay_x}%`,
                          top: `${activeGif.overlay_y}%`,
                          width: `${18 * activeGif.overlay_scale}%`,
                        }}
                      />
                    )}
                  </>
                ) : (
                  <div className="forge2-empty-preview">
                    <Clapperboard size={36} />
                    <span>Selecione um vídeo base para iniciar o preview.</span>
                  </div>
                )}
              </div>

              <div className="forge2-preview-toggles">
                <label><input type="checkbox" checked={studio.preview_muted} onChange={(event) => updateStudioLocal((current) => ({ ...current, preview_muted: event.target.checked }))} /> Preview mudo</label>
                <label><input type="checkbox" checked={studio.preview_loop} onChange={(event) => updateStudioLocal((current) => ({ ...current, preview_loop: event.target.checked }))} /> Loop</label>
              </div>

              <div className="forge2-preview-action-bar">
                <button type="button" className="forge2-primary-action" onClick={handleGenerateCopy} disabled={!selectedProjectId || Boolean(busyAction)}>
                  <Sparkles size={16} />
                  Gerar frase
                </button>
                <button type="button" className="forge2-primary-action" onClick={handleRenderVideo} disabled={!selectedProjectId || !selectedBaseAsset || Boolean(busyAction)}>
                  <Clapperboard size={16} />
                  Renderizar vídeo
                </button>
                <button type="button" onClick={handleDownloadRenderMp4} disabled={!lastRender}>
                  <Download size={16} />
                  Baixar vídeo MP4
                </button>
              </div>

              {lastRender && (
                <div className="forge2-render-result">
                  <strong>Último render</strong>
                  <span>{lastRender.filename} · {lastRender.width}x{lastRender.height} · {(lastRender.duration || 0).toFixed(1)}s</span>
                </div>
              )}

              <section className="forge2-panel forge2-copy-panel">
                <div className="forge2-panel-header">
                  <div className="forge2-section-title">
                    <Type size={16} />
                    <h2>Frase e enquadramento</h2>
                  </div>
                  <span className="forge2-panel-subtitle">Texto maior, enquadramento e leitura mais limpa</span>
                </div>

                <div className="forge2-form-grid">
                  <label>
                    <span>Tema</span>
                    <textarea
                      rows={3}
                      value={studio.text_overlay.topic}
                      onChange={(event) => updateStudioLocal((current) => ({
                        ...current,
                        text_overlay: { ...current.text_overlay, topic: event.target.value },
                      }))}
                    />
                  </label>
                  <label>
                    <span>Estilo</span>
                    <select
                      value={studio.text_overlay.style}
                      onChange={(event) => updateStudioLocal((current) => ({
                        ...current,
                        text_overlay: { ...current.text_overlay, style: event.target.value },
                      }))}
                    >
                      <option value="oracao">Oracao</option>
                      <option value="frase_dia">Frase do dia</option>
                      <option value="historia_motivacional">Historia motivacional</option>
                      <option value="motivacional">Motivacional</option>
                    </select>
                  </label>
                  <label>
                    <span>Texto final</span>
                    <textarea
                      rows={8}
                      value={studio.text_overlay.generated_text}
                      onChange={(event) => updateStudioLocal((current) => ({
                        ...current,
                        text_overlay: { ...current.text_overlay, generated_text: event.target.value },
                      }))}
                    />
                  </label>
                </div>
              </section>
            </section>

          </section>
        </main>

        <aside className="forge2-right-rail">
          <section className="forge2-panel">
            <div className="forge2-panel-header">
              <div className="forge2-section-title">
                <Wand2 size={16} />
                <h2>Publicação</h2>
              </div>
              <div className="forge2-publication-header-actions">
                <button
                  type="button"
                  className="forge2-publication-generate"
                  onClick={handleGeneratePublication}
                  disabled={!selectedProjectId || Boolean(busyAction)}
                >
                  <Sparkles size={16} />
                  Gerar com CRONOS Mestre
                </button>
                <Film size={16} />
              </div>
            </div>

            <div className="forge2-form-grid">
              <label>
                <span>Título</span>
                <input value={studio.publication.title} onChange={(event) => updateStudioLocal((current) => ({ ...current, publication: { ...current.publication, title: event.target.value } }))} />
              </label>
              <label>
                <span>Descrição</span>
                <textarea rows={6} value={studio.publication.description} onChange={(event) => updateStudioLocal((current) => ({ ...current, publication: { ...current.publication, description: event.target.value } }))} />
              </label>
              <label>
                <span>Hashtags</span>
                <input value={hashtagsText} onChange={(event) => updateStudioLocal((current) => ({ ...current, publication: { ...current.publication, hashtags: event.target.value.split(/\s+/).filter(Boolean) } }))} placeholder="#oracao #frasedodia #shorts" />
              </label>
              <label>
                <span>Categoria do YouTube</span>
                <select value={studio.publication.youtube_category} onChange={(event) => updateStudioLocal((current) => ({ ...current, publication: { ...current.publication, youtube_category: event.target.value } }))}>
                  {YOUTUBE_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status de privacidade</span>
                <select value={studio.publication.privacy_status} onChange={(event) => updateStudioLocal((current) => ({ ...current, publication: { ...current.publication, privacy_status: event.target.value } }))}>
                  <option value="private">Privado</option>
                  <option value="public">Publico</option>
                  <option value="unlisted">Nao listado</option>
                </select>
              </label>
              <label>
                <span>Programar para postar</span>
                <input type="datetime-local" value={studio.publication.schedule_at} onChange={(event) => updateStudioLocal((current) => ({ ...current, publication: { ...current.publication, schedule_at: event.target.value } }))} />
              </label>
            </div>

            <div className="forge2-publication-actions">
              <button type="button" className="forge2-save-publication" onClick={handleScheduleRender} disabled={!selectedProjectId || !lastRender || Boolean(busyAction)}>
                <CalendarClock size={16} />
                Programar na agenda
              </button>
              <button type="button" onClick={handleDownloadRenderMp4} disabled={!lastRender}>
                <Download size={16} />
                Baixar vídeo MP4
              </button>
              <button type="button" onClick={handlePublishYouTube} disabled={!selectedProjectId || !lastRender || Boolean(busyAction)}>
                <Upload size={16} />
                Publicar no YouTube
              </button>
              <button type="button" onClick={handleResetRender}>
                <Plus size={16} />
                Criar novo render
              </button>
            </div>
          </section>

          <section className="forge2-panel forge2-phase-card">
            <div className="forge2-section-title">
              <Lock size={16} />
              <h2>Primeira fase entregue</h2>
            </div>
            <p>
              Biblioteca recolhível, preview central responsivo, gerador de frases com agente separado, GIFs,
              música e metadados de publicação já persistidos no projeto.
            </p>
            <div className="forge2-phase-pills">
              <span><Video size={14} /> Base MP4</span>
              <span><Type size={14} /> Overlay</span>
              <span><Tags size={14} /> SEO</span>
            </div>
          </section>
        </aside>
      </section>

      {(busyAction || error || message) && (
        <div className={`forge2-toast ${error ? 'error' : ''}`}>
          {busyAction ? <Loader size={16} className="spinner" /> : null}
          <span>{error || message || 'Processando...'}</span>
        </div>
      )}
    </div>
  );
}

export default TheForge2;
