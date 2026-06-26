import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
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
  getForge2RenderStatus,
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
  'Gerador FORGE',
  'Fallback local',
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
  { id: 'cinematic_neon', label: 'Cinemático Neon', color: '#eaf7ff', background: '#04101d' },
  { id: 'cinematic_bar', label: 'Tarja Cinemática', color: '#f8fbff', background: '#07111f' },
  { id: 'devotional_orange', label: 'Devocional Laranja', color: '#f7efe5', background: '#1f1612' },
  { id: 'devotional_list', label: 'Lista Devocional', color: '#f5f0e8', background: '#171411' },
  { id: 'verse_gold', label: 'Versículo Dourado', color: '#f7d56a', background: '#131821' },
];

const FORGE2_NEW_TEMPLATE_IDS = ['devotional_orange', 'devotional_list', 'verse_gold'];

const TEXT_THEME_DEFAULTS = {
  devotional_orange: {
    font_family: 'Playfair Display',
    font_size: 30,
    line_height: 1.16,
    letter_spacing: 0,
    color: '#f7efe5',
    shadow: true,
    background_opacity: 0.12,
    position_x: 50,
    position_y: 50,
    box_width: 84,
    box_height: 72,
    align: 'center',
  },
  devotional_list: {
    font_family: 'Playfair Display',
    font_size: 28,
    line_height: 1.16,
    letter_spacing: 0,
    color: '#f5f0e8',
    shadow: true,
    background_opacity: 0.12,
    position_x: 50,
    position_y: 50,
    box_width: 84,
    box_height: 74,
    align: 'left',
  },
  verse_gold: {
    font_family: 'Playfair Display',
    font_size: 30,
    line_height: 1.2,
    letter_spacing: 0,
    color: '#f7d56a',
    shadow: true,
    background_opacity: 0.14,
    position_x: 50,
    position_y: 48,
    box_width: 82,
    box_height: 76,
    align: 'center',
  },
};

const TEXT_ANIMATIONS = [
  { id: 'none', label: 'Sem animação' },
  { id: 'fade', label: 'Aparecer suave' },
  { id: 'slide', label: 'Entrada lateral' },
  { id: 'zoom', label: 'Zoom impacto' },
  { id: 'pulse', label: 'Pulso neon' },
];

const TEXT_ANIMATION_SPEEDS = [
  { id: 'slow', label: 'Lenta' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Rápida' },
];

function createDefaultStudio() {
  return {
    projects_collapsed: false,
    library_collapsed: false,
    media_collapsed: false,
    publication_collapsed: false,
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
      font_size: 36,
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
      text_animation: 'none',
      text_animation_speed: 'normal',
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
    production_table_collapsed: true,
    production_import_text: '',
    production_items: createEmptyProductionItems(),
    production_active_slot: 0,
    render_counter_events: [],
    render_count_24h: 0,
    preview_muted: false,
    preview_loop: true,
  };
}

function createEmptyProductionItems() {
  return Array.from({ length: 90 }, (_, index) => ({
    slot: index + 1,
    title: '',
    raw_text: '',
    treated_text: '',
    topic: '',
    status: 'vazio',
    base_video: '',
    style: 'oracao',
    schedule_at: '',
  }));
}

function normalizeProductionItems(items = []) {
  const bySlot = new Map((items || []).map((item) => [Number(item.slot), item]));
  return createEmptyProductionItems().map((empty) => ({
    ...empty,
    ...(bySlot.get(empty.slot) || {}),
    slot: empty.slot,
  }));
}

function normalizeStudio(studio) {
  const defaults = createDefaultStudio();
  const next = studio || defaults;
  return {
    ...defaults,
    ...next,
    text_overlay: {
      ...defaults.text_overlay,
      ...(next.text_overlay || {}),
    },
    publication: {
      ...defaults.publication,
      ...(next.publication || {}),
    },
    presets: next.presets || defaults.presets,
    production_items: normalizeProductionItems(next.production_items),
    production_import_text: next.production_import_text || '',
    projects_collapsed: Boolean(next.projects_collapsed),
    production_table_collapsed: Boolean(next.production_table_collapsed),
    media_collapsed: Boolean(next.media_collapsed),
    publication_collapsed: Boolean(next.publication_collapsed),
  };
}

function assetDurationLabel(asset) {
  if (!asset?.duration) return '-';
  return `${asset.duration.toFixed(1)}s`;
}

function getTextTheme(themeId) {
  return TEXT_THEMES.find((theme) => theme.id === themeId) || TEXT_THEMES[0];
}

function getForge2NewTemplateThemes() {
  return TEXT_THEMES.filter((theme) => FORGE2_NEW_TEMPLATE_IDS.includes(theme.id));
}

function applyTextThemeDefaults(currentOverlay, themeId) {
  const theme = getTextTheme(themeId);
  const overrides = TEXT_THEME_DEFAULTS[themeId] || {};
  return {
    ...currentOverlay,
    ...overrides,
    overlay_theme: themeId,
    color: overrides.color || theme.color,
  };
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

function limitText(value, maxLength = 600) {
  return String(value || '').trim().slice(0, maxLength);
}

function inferProductionStyle(text) {
  const value = (text || '').toLowerCase();
  if (value.includes('oração') || value.includes('oracao') || value.includes('amém') || value.includes('amem')) {
    return 'oracao';
  }
  if (value.includes('história') || value.includes('historia')) {
    return 'historia_motivacional';
  }
  if (value.includes('motiv')) {
    return 'motivacional';
  }
  return 'frase_dia';
}

function parseProductionImportText(text) {
  const source = (text || '').replace(/\r\n/g, '\n').trim();
  if (!source) return [];
  const matches = [...source.matchAll(/(?:^|\n)\s*(\d{1,3})[.)-]\s+(.+?)(?=\n\s*\d{1,3}[.)-]\s+|\s*$)/gs)];
  const blocks = matches.length
    ? matches.map((match) => ({ slot: Number(match[1]), content: match[2].trim() }))
    : source.split(/\n{2,}/).map((content, index) => ({ slot: index + 1, content: content.trim() }));

  return blocks
    .filter((block) => block.content)
    .slice(0, 90)
    .map((block, index) => {
      const lines = block.content.split('\n').map((line) => line.trim()).filter(Boolean);
      const title = (lines[0] || `Publicação ${index + 1}`).replace(/^[#*\s-]+/, '').slice(0, 180);
      const normalizeTitle = (value) => (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/gi, '')
        .toLowerCase();
      const bodyLines = lines.slice(1);
      if (bodyLines.length && normalizeTitle(bodyLines[0]) === normalizeTitle(title)) {
        bodyLines.shift();
      }
      const rawText = bodyLines.join('\n\n') || title;
      const fullText = `${title}\n\n${rawText}`.trim();
      return {
        slot: block.slot >= 1 && block.slot <= 90 ? block.slot : index + 1,
        title,
        raw_text: rawText,
        treated_text: rawText,
        topic: title,
        status: 'pronto',
        base_video: '',
        style: inferProductionStyle(fullText),
        schedule_at: '',
      };
    });
}

function productionItemText(item) {
  return [item?.title, item?.treated_text || item?.raw_text]
    .filter(Boolean)
    .join('\n\n')
    .trim();
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

const LibraryAssetCard = memo(function LibraryAssetCard({ asset, selected, onSelect, onDelete }) {
  return (
    <div className={`forge2-library-card ${selected ? 'selected' : ''}`}>
      <button type="button" className="forge2-library-select" onClick={onSelect}>
        <video src={forge2FileUrl(asset.url)} muted playsInline preload="none" />
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
});

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
  const [copyPanelCollapsed, setCopyPanelCollapsed] = useState(false);
  const [templatePanelCollapsed, setTemplatePanelCollapsed] = useState(false);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const previewStageRef = useRef(null);
  const productionScrollTopRef = useRef(null);
  const productionTableWrapRef = useRef(null);

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
    setStudio((current) => ({
      ...normalizeStudio(studioData.studio || createDefaultStudio()),
      production_table_collapsed: true,
    }));
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
    setStudio(normalizeStudio(data.studio));
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
  const overlayBodyLines = overlayPreviewLines.slice(1);
  const newTemplateThemes = getForge2NewTemplateThemes();

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
      setStudio(normalizeStudio(data.studio));
      setMessage(`Texto gerado via ${data.generated.source} com alvo de ${targetSeconds}s.`);
    });
  };

  const handleGeneratePublication = async () => {
    if (!selectedProjectId) return;
    await runAction('generate-publication', async () => {
      const saved = await saveForge2StudioConfig(selectedProjectId, studio);
      const data = await generateForge2Publication(selectedProjectId, saved.studio);
      setStudio(normalizeStudio(data.studio));
      setMessage('Publicação gerada com Gerador FORGE.');
    });
  };

  const handleBaseUpload = async () => {
    if (!selectedProjectId || !baseUploadFile) return;
    await runAction('upload-base', async () => {
      const data = await uploadForge2BaseVideo(selectedProjectId, baseUploadFile, libraryTab);
      setStudio(normalizeStudio(data.studio));
      setBaseUploadFile(null);
      setMessage('Vídeo base adicionado à biblioteca.');
    });
  };

  const handleGifUpload = async () => {
    if (!selectedProjectId || !gifUploadFile) return;
    await runAction('upload-gif', async () => {
      const data = await uploadForge2Gif(selectedProjectId, gifUploadFile);
      setStudio(normalizeStudio(data.studio));
      setGifUploadFile(null);
      setMessage('GIF adicionado ao projeto.');
    });
  };

  const handleMusicUpload = async () => {
    if (!selectedProjectId || !musicUploadFile) return;
    await runAction('upload-music', async () => {
      const data = await uploadForge2Music(selectedProjectId, musicUploadFile);
      setStudio(normalizeStudio(data.studio));
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

  const toggleProjectsPanel = () => {
    updateStudioLocal((current) => ({ ...current, projects_collapsed: !current.projects_collapsed }));
  };

  const toggleMediaPanel = () => {
    updateStudioLocal((current) => ({ ...current, media_collapsed: !current.media_collapsed }));
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
      setStudio(normalizeStudio(data.studio));
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
    const filename = lastRender.filename || 'forge2-render.mp4';
    const picker = window.showSaveFilePicker;
    let fileHandle = null;
    if (typeof picker === 'function') {
      try {
        fileHandle = await picker({
          suggestedName: filename,
          types: [
            {
              description: 'Vídeo MP4',
              accept: { 'video/mp4': ['.mp4'] },
            },
          ],
        });
      } catch (err) {
        if (err?.name === 'AbortError') {
          return;
        }
        setError(err.message || 'Não foi possível abrir o seletor de arquivo.');
        return;
      }
    }
    await runAction('download-render', async () => {
      const response = await fetch(forge2FileUrl(lastRender.download_url), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Falha ao preparar o arquivo MP4 para download.');
      }

      const blob = await response.blob();
      if (fileHandle) {
        const writable = await fileHandle.createWritable();
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
      const jobId = data.job?.id;
      if (!jobId) {
        throw new Error('A fila de renderização não retornou um identificador de trabalho.');
      }

      setMessage(data.job?.message || 'Render enviado para a fila exclusiva do Forge 2.0.');
      let completedJob = null;
      for (let attempt = 1; attempt <= 390; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const statusData = await getForge2RenderStatus(selectedProjectId);
        const job = statusData.job || {};
        if (job.id && job.id !== jobId && ['queued', 'running'].includes(job.status)) {
          throw new Error('Outro render do Forge 2.0 assumiu a fila deste projeto.');
        }
        if (job.status === 'completed') {
          completedJob = job;
          break;
        }
        if (job.status === 'failed') {
          throw new Error(job.message || 'O render do Forge 2.0 falhou.');
        }
        setMessage(job.message || `Render do Forge 2.0 em andamento. Verificação ${attempt}.`);
      }

      if (!completedJob?.render) {
        throw new Error('A renderização excedeu o tempo de acompanhamento. O trabalho foi preservado; atualize a página para consultar o status.');
      }

      const [studioData, projectData] = await Promise.all([
        getForge2StudioConfig(selectedProjectId),
        getForge2Project(selectedProjectId),
      ]);
      setStudio(normalizeStudio(studioData.studio || studio));
      setProject(projectData.project || project);
      setLastRender(completedJob.render);
      setMessage(completedJob.render.gif_applied
        ? 'Render final concluído com GIF aplicado.'
        : 'Render final do Forge 2.0 concluído.');
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
  const activeLibraryCards = useMemo(() => activeLibrary.map((asset) => (
    <LibraryAssetCard
      key={asset.id}
      asset={asset}
      selected={studio.selected_base_asset_id === asset.id}
      onSelect={() => selectBaseAsset(asset, libraryTab)}
      onDelete={() => removeAsset('base-video', asset.id)}
    />
  )), [activeLibrary, libraryTab, studio.selected_base_asset_id]);
  const productionItems = normalizeProductionItems(studio.production_items);
  const nextProductionPullItem = productionItems.find((item) => (
    productionItemText(item) && !['em_edicao', 'gerando', 'gerado', 'renderizado', 'agendado'].includes(item.status)
  )) || productionItems.find((item) => productionItemText(item));
  const nextProductionPullSlot = nextProductionPullItem?.slot || 1;

  const syncProductionScroll = (source) => {
    const top = productionScrollTopRef.current;
    const table = productionTableWrapRef.current;
    if (!top || !table) return;
    if (source === 'top') {
      table.scrollLeft = top.scrollLeft;
    } else {
      top.scrollLeft = table.scrollLeft;
    }
  };

  const updateProductionItem = (slot, patch) => {
    updateStudioLocal((current) => ({
      ...current,
      production_items: normalizeProductionItems(current.production_items).map((item) => (
        item.slot === slot ? { ...item, ...patch } : item
      )),
    }));
  };

  const applyProductionItemToStudio = (current, item) => ({
    ...current,
    text_overlay: {
      ...current.text_overlay,
      topic: limitText(item.topic || item.title, 600),
      style: item.style || current.text_overlay.style,
      generated_text: item.treated_text || item.raw_text,
    },
    publication: {
      ...current.publication,
      title: item.title || current.publication.title,
      schedule_at: item.schedule_at || current.publication.schedule_at,
    },
    production_items: normalizeProductionItems(current.production_items).map((entry) => (
      entry.slot === item.slot ? { ...entry, status: 'em_edicao' } : entry
    )),
    production_active_slot: item.slot,
  });

  const handleImportProductionTable = async () => {
    const parsed = parseProductionImportText(studio.production_import_text);
    if (!parsed.length) {
      setError('Cole as publicações enumeradas antes de inserir na tabela.');
      return;
    }
    await runAction('import-production-table', async () => {
      const importedBySlot = new Map(parsed.map((item, index) => [item.slot || index + 1, { ...item, slot: item.slot || index + 1 }]));
      const nextStudio = {
        ...studio,
        production_items: createEmptyProductionItems().map((empty) => importedBySlot.get(empty.slot) || empty),
      };
      await persistStudio(nextStudio, `${parsed.length} publicações inseridas na tabela.`);
    });
  };

  const handleUseProductionItem = (item) => {
    const text = productionItemText(item);
    if (!text) {
      setError('Essa linha ainda não tem conteúdo.');
      return;
    }
    updateStudioLocal((current) => applyProductionItemToStudio(current, item));
    setMessage(`Publicação ${item.slot} enviada para Frase e enquadramento.`);
  };

  const handlePullNextProductionItem = async () => {
    const item = nextProductionPullItem;
    if (!item || !productionItemText(item)) {
      setError('Nenhuma publicação preenchida na tabela para puxar.');
      return;
    }
    const nextStudio = applyProductionItemToStudio(studio, item);
    if (selectedProjectId) {
      await runAction('pull-next-production-item', async () => {
        await persistStudio(nextStudio, `Publicação ${item.slot}/90 puxada para o preview.`);
      });
    } else {
      setStudio(nextStudio);
      setMessage(`Publicação ${item.slot}/90 puxada para o preview.`);
    }
  };

  const handleDeleteProductionItem = async (slot) => {
    const currentItems = normalizeProductionItems(studio.production_items);
    const item = currentItems.find((entry) => entry.slot === slot);
    if (!item || !productionItemText(item)) {
      setError('Essa linha já está vazia.');
      return;
    }
    const compactItems = currentItems
      .filter((entry) => entry.slot !== slot)
      .filter((entry) => productionItemText(entry))
      .map((entry, index) => ({ ...entry, slot: index + 1 }));
    const nextItems = createEmptyProductionItems().map((empty, index) => compactItems[index] || empty);
    const nextStudio = {
      ...studio,
      production_items: nextItems,
    };
    if (selectedProjectId) {
      await runAction(`delete-production-${slot}`, async () => {
        await persistStudio(nextStudio, `Publicação ${slot} excluída. As linhas abaixo subiram automaticamente.`);
      });
    } else {
      setStudio(nextStudio);
      setMessage(`Publicação ${slot} excluída. As linhas abaixo subiram automaticamente.`);
    }
  };

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

      <section className={`forge2-panel forge2-production-panel ${studio.production_table_collapsed ? 'collapsed' : ''}`}>
        <div className="forge2-panel-header">
          <div>
            <h2>Tabela de Produção</h2>
            <span className="forge2-panel-subtitle">90 espaços para organizar publicações e enviar direto ao Forge.</span>
          </div>
          <div className="forge2-production-header-actions">
            <button type="button" onClick={() => persistStudio(studio, 'Tabela de produção salva.')} disabled={!selectedProjectId || Boolean(busyAction)}>
              <Save size={16} />
              Salvar tabela
            </button>
            <button
              type="button"
              onClick={() => updateStudioLocal((current) => ({ ...current, production_table_collapsed: !current.production_table_collapsed }))}
            >
              {studio.production_table_collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        {!studio.production_table_collapsed && (
          <div className="forge2-production-body">
            <div className="forge2-production-import">
              <label>
                <span>Colar publicações enumeradas</span>
                <textarea
                  rows={7}
                  value={studio.production_import_text || ''}
                  placeholder={'14. Oração a São Peregrino\n\nORAÇÃO A SÃO PEREGRINO\n\nÓ glorioso São Peregrino...'}
                  onChange={(event) => updateStudioLocal((current) => ({
                    ...current,
                    production_import_text: event.target.value,
                  }))}
                />
              </label>
              <button type="button" className="forge2-primary-action" onClick={handleImportProductionTable} disabled={Boolean(busyAction)}>
                <Sparkles size={16} />
                Inserir na tabela
              </button>
            </div>

            <div
              className="forge2-production-scroll-top"
              ref={productionScrollTopRef}
              onScroll={() => syncProductionScroll('top')}
            >
              <div className="forge2-production-scroll-spacer" />
            </div>

            <div
              className="forge2-production-table-wrap"
              ref={productionTableWrapRef}
              onScroll={() => syncProductionScroll('table')}
            >
              <table className="forge2-production-table">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Título</th>
                    <th>Texto bruto</th>
                    <th>Tema</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {productionItems.map((item) => (
                    <tr key={item.slot} className={productionItemText(item) ? 'filled' : ''}>
                      <td>
                        <div className="forge2-production-index">
                          <button
                            type="button"
                            className="forge2-production-delete"
                            onClick={() => handleDeleteProductionItem(item.slot)}
                            disabled={!productionItemText(item) || Boolean(busyAction)}
                            aria-label={`Excluir publicação ${item.slot}`}
                            title="Excluir publicação e subir as próximas"
                          >
                            X
                          </button>
                          <span>{item.slot}</span>
                        </div>
                      </td>
                      <td>
                        <input value={item.title} onChange={(event) => updateProductionItem(item.slot, { title: event.target.value, topic: event.target.value })} />
                      </td>
                      <td>
                        <textarea rows={4} value={item.raw_text} onChange={(event) => updateProductionItem(item.slot, { raw_text: event.target.value })} />
                      </td>
                      <td>
                        <input value={item.topic} onChange={(event) => updateProductionItem(item.slot, { topic: event.target.value })} />
                      </td>
                      <td>
                        <select value={item.status} onChange={(event) => updateProductionItem(item.slot, { status: event.target.value })}>
                          <option value="vazio">Vazio</option>
                          <option value="pronto">Pronto</option>
                          <option value="em_edicao">Em edição</option>
                          <option value="gerando">Gerando</option>
                          <option value="gerado">Gerado</option>
                          <option value="renderizado">Renderizado</option>
                          <option value="agendado">Agendado</option>
                        </select>
                      </td>
                      <td>
                        <div className="forge2-production-actions">
                          <button type="button" onClick={() => handleUseProductionItem(item)} disabled={!productionItemText(item)}>
                            Usar no Forge
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="forge2-shell">
        <aside className="forge2-left-rail">
          <section className={`forge2-panel forge2-projects-panel ${studio.projects_collapsed ? 'collapsed' : ''}`}>
            <div className="forge2-panel-header">
              <h2>Projetos</h2>
              <div className="forge2-panel-header-actions">
                <button type="button" onClick={() => runAction('refresh-projects', refreshProjects)} disabled={Boolean(busyAction)}>
                  <RefreshCw size={16} />
                </button>
                <button type="button" onClick={toggleProjectsPanel}>
                  {studio.projects_collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
            </div>
            {!studio.projects_collapsed && (
              <>
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
              </>
            )}
          </section>

          <section className={`forge2-panel forge2-media-panel ${studio.media_collapsed ? 'collapsed' : ''}`}>
            <div className="forge2-panel-header">
              <div className="forge2-section-title">
                <ImagePlus size={16} />
                <h2>GIFs e música</h2>
              </div>
              <button type="button" onClick={toggleMediaPanel}>
                {studio.media_collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>

            {!studio.media_collapsed && (
              <>
                <div className="forge2-fine-controls">
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

                <div className="forge2-fine-controls">
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
                </div>

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
              </>
            )}
          </section>
        </aside>

        <main className="forge2-main-stage">
          <section className={`forge2-panel forge2-library-panel ${studio.library_collapsed ? 'collapsed' : ''}`}>
            <div className="forge2-panel-header">
              <div className="forge2-library-title">
                <FolderOpen size={16} />
                <h2>Biblioteca base recolhível</h2>
              </div>
              <div className="forge2-library-header-actions">
                <button
                  type="button"
                  className="forge2-pull-table-button"
                  onClick={handlePullNextProductionItem}
                  disabled={!nextProductionPullItem || Boolean(busyAction)}
                >
                  <Sparkles size={15} />
                  Puxar da Tabela {nextProductionPullSlot}/90
                </button>
                <div
                  className="forge2-render-counter"
                  title="Vídeos renderizados nas últimas 24 horas"
                  aria-label={`${studio.render_count_24h || 0} vídeos renderizados nas últimas 24 horas`}
                >
                  {Math.min(Number(studio.render_count_24h) || 0, 100)}
                </div>
                <button type="button" onClick={toggleLibrary}>
                  {studio.library_collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
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

                <div className="forge2-library-grid">{activeLibraryCards}</div>
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
                      className={[
                        'forge2-preview-copy',
                        `align-${studio.text_overlay.align}`,
                        `theme-${studio.text_overlay.overlay_theme}`,
                        `animation-${studio.text_overlay.text_animation || 'none'}`,
                        `speed-${studio.text_overlay.text_animation_speed || 'normal'}`,
                      ].join(' ')}
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
                      <div className="forge2-preview-copy-body">
                        {overlayBodyLines.map((line, index) => (
                          <span
                            key={`${line}-${index}`}
                            className={[
                              'forge2-preview-copy-line',
                              index === overlayBodyLines.length - 1 ? 'is-last' : '',
                            ].filter(Boolean).join(' ')}
                          >
                            {line}
                          </span>
                        ))}
                      </div>
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

              <section className={`forge2-text-controls ${textControlsCollapsed ? 'collapsed' : ''}`}>
                <div className="forge2-text-controls-header">
                  <strong>Ajustes da frase</strong>
                  <button type="button" onClick={() => setTextControlsCollapsed((current) => !current)}>
                    {textControlsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>
                {!textControlsCollapsed && (
                  <div className="forge2-slider-grid forge2-preview-sliders">
                    <label><span>Fonte {studio.text_overlay.font_size}px</span><input type="range" min="12" max="120" value={studio.text_overlay.font_size} onChange={(event) => updateStudioLocal((current) => ({ ...current, text_overlay: { ...current.text_overlay, font_size: Number(event.target.value) } }))} /></label>
                    <label><span>Altura da caixa {studio.text_overlay.box_height}%</span><input type="range" min="18" max="88" value={studio.text_overlay.box_height} onChange={(event) => updateStudioLocal((current) => ({ ...current, text_overlay: { ...current.text_overlay, box_height: Number(event.target.value) } }))} /></label>
                    <label><span>Largura da caixa {studio.text_overlay.box_width}%</span><input type="range" min="35" max="95" value={studio.text_overlay.box_width} onChange={(event) => updateStudioLocal((current) => ({ ...current, text_overlay: { ...current.text_overlay, box_width: Number(event.target.value) } }))} /></label>
                    <label><span>Posição Y {studio.text_overlay.position_y}%</span><input type="range" min="5" max="88" value={studio.text_overlay.position_y} onChange={(event) => updateStudioLocal((current) => ({ ...current, text_overlay: { ...current.text_overlay, position_y: Number(event.target.value) } }))} /></label>
                    <label><span>Transparência {Math.round((studio.text_overlay.background_opacity ?? 0.5) * 100)}%</span><input type="range" min="0" max="100" value={Math.round((studio.text_overlay.background_opacity ?? 0.5) * 100)} onChange={(event) => updateStudioLocal((current) => ({ ...current, text_overlay: { ...current.text_overlay, background_opacity: Number(event.target.value) / 100 } }))} /></label>
                  </div>
                )}
              </section>

              <section className={`forge2-panel forge2-template-panel ${templatePanelCollapsed ? 'collapsed' : ''}`}>
                <div className="forge2-panel-header">
                  <div className="forge2-section-title">
                    <Type size={16} />
                    <h2>Templates novos</h2>
                  </div>
                  <button type="button" onClick={() => setTemplatePanelCollapsed((current) => !current)}>
                    {templatePanelCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>
                {!templatePanelCollapsed && (
                  <div className="forge2-template-grid">
                    {newTemplateThemes.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        className={`forge2-template-card ${studio.text_overlay.overlay_theme === theme.id ? 'active' : ''}`}
                        onClick={() => updateStudioLocal((current) => ({
                          ...current,
                          text_overlay: {
                            ...applyTextThemeDefaults(current.text_overlay, theme.id),
                          },
                        }))}
                      >
                        <div className={`forge2-template-mini theme-${theme.id}`}>
                          <strong className="forge2-template-mini-title">Exemplo</strong>
                          <span className="forge2-template-mini-line">Prévia visual</span>
                        </div>
                        <em>{theme.label}</em>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="forge2-panel forge2-render-preview-panel">
                <div className="forge2-panel-header">
                  <div>
                    <h2>Preview do vídeo renderizado</h2>
                    <span className="forge2-panel-subtitle">Comparação direta com o preview de edição acima</span>
                  </div>
                </div>
                {lastRender?.download_url || lastRender?.url ? (
                  <>
                    <div className={`forge2-render-preview-stage ${renderAspectClass}`}>
                      <video
                        key={lastRender.id || lastRender.filename}
                        src={forge2FileUrl(lastRender.url || lastRender.download_url)}
                        controls
                        playsInline
                        className="forge2-render-preview-video"
                      />
                    </div>
                    <div className="forge2-render-result compact">
                      <strong>Último MP4</strong>
                      <span>{lastRender.filename} · {lastRender.width}x{lastRender.height} · {(lastRender.duration || 0).toFixed(1)}s</span>
                    </div>
                  </>
                ) : (
                  <div className="forge2-render-preview-empty">
                    <Film size={28} />
                    <span>Renderize um vídeo para comparar aqui.</span>
                  </div>
                )}
              </section>

              <section className={`forge2-panel forge2-copy-panel ${copyPanelCollapsed ? 'collapsed' : ''}`}>
                <div className="forge2-panel-header">
                  <div className="forge2-section-title">
                    <Type size={16} />
                    <h2>Frase e enquadramento</h2>
                  </div>
                  <div className="forge2-copy-header-actions">
                    <span className="forge2-panel-subtitle">Texto maior, enquadramento e leitura mais limpa</span>
                    <button type="button" onClick={() => setCopyPanelCollapsed((current) => !current)}>
                      {copyPanelCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>
                </div>

                {!copyPanelCollapsed && (
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
                )}
              </section>
            </section>

          </section>
        </main>

        <aside className="forge2-right-rail">
          <section className={`forge2-panel ${studio.publication_collapsed ? 'collapsed' : ''}`}>
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
                  Gerador FORGE
                </button>
                <button
                  type="button"
                  className="forge2-icon-toggle"
                  onClick={() => updateStudioLocal((current) => ({ ...current, publication_collapsed: !current.publication_collapsed }))}
                  aria-label={studio.publication_collapsed ? 'Expandir publicação' : 'Recolher publicação'}
                >
                  {studio.publication_collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
                <Film size={16} />
              </div>
            </div>

            {!studio.publication_collapsed && (
              <>
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
              </>
            )}
          </section>

          <section className="forge2-panel forge2-cinematic-style-panel">
            <div className="forge2-panel-header">
              <div className="forge2-section-title">
                <Type size={16} />
                <h2>Estilos Cinematográficos</h2>
              </div>
            </div>

            <div className="forge2-cinematic-style-grid">
              {TEXT_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={studio.text_overlay.overlay_theme === theme.id ? 'active' : ''}
                  onClick={() => updateStudioLocal((current) => ({
                    ...current,
                    text_overlay: {
                      ...applyTextThemeDefaults(current.text_overlay, theme.id),
                    },
                  }))}
                >
                  <span className={`forge2-style-swatch theme-${theme.id}`}>
                    <strong>Aa</strong>
                  </span>
                  <em>{theme.label}</em>
                </button>
              ))}
            </div>

            <div className="forge2-form-grid">
              <label>
                <span>Animação do texto</span>
                <select
                  value={studio.text_overlay.text_animation || 'none'}
                  onChange={(event) => updateStudioLocal((current) => ({
                    ...current,
                    text_overlay: { ...current.text_overlay, text_animation: event.target.value },
                  }))}
                >
                  {TEXT_ANIMATIONS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Velocidade</span>
                <select
                  value={studio.text_overlay.text_animation_speed || 'normal'}
                  onChange={(event) => updateStudioLocal((current) => ({
                    ...current,
                    text_overlay: { ...current.text_overlay, text_animation_speed: event.target.value },
                  }))}
                >
                  {TEXT_ANIMATION_SPEEDS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
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
