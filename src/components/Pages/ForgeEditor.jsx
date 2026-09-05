import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Sliders,
  Play,
  Download,
  CalendarClock,
  Loader,
  Check,
  Search,
  Upload,
  X,
  Trash2,
  PanelBottom,
  Maximize2,
  LayoutPanelTop,
  Link
} from 'lucide-react';
import { apiUrl } from '../../config/api';
import {
  VIDEO_EDIT_MAX_DURATION_LABEL,
  buildVideoDurationLimitMessage,
  isVideoDurationWithinEditLimit,
} from '../../config/videoLimits';
import './ForgeEditor.css';

const FORGE_DRAFT_KEY_PREFIX = 'alliance_forge_draft_';
const FORGE_7030_IMAGE_TABLE_KEY = 'alliance_forge_7030_image_table_v1';
const FORGE_LOCAL_VIDEO_LABELS_KEY = 'alliance_forge_local_video_labels_v1';
const DEFAULT_HEADLINE_POSITION = 'middle';
// Headline pack travado em 2026-06-17.
// Ordem/base visual aprovada:
// 1. Azul / Branco
// 2. Breaking
// 3. Live HF
// 4. Ticker Duplo
// Não alterar estrutura/ordem desses quatro modelos sem pedido explícito.

const normalizeHeadlinePositionClient = (position, headlineText = '') => {
  if (position === 'none') {
    return 'none';
  }
  if (['top', 'middle', 'bottom'].includes(position)) {
    return position;
  }
  return (headlineText || '').trim() ? DEFAULT_HEADLINE_POSITION : 'none';
};

const createDefaultSlideshowSetting = () => ({
  fit: 'contain',
  top_percent: 10,
  bottom_percent: 10,
});

const normalizeSlideshowSettingsClient = (settings, count) => {
  const source = Array.isArray(settings) ? settings : [];
  return Array.from({ length: count }, (_, index) => {
    const current = source[index] || {};
    const defaults = createDefaultSlideshowSetting();
    const fit = current.fit === 'cover' ? 'cover' : 'contain';
    const top = Number.isFinite(Number(current.top_percent)) ? Number(current.top_percent) : defaults.top_percent;
    const bottom = Number.isFinite(Number(current.bottom_percent)) ? Number(current.bottom_percent) : defaults.bottom_percent;
    return {
      fit,
      top_percent: Math.max(0, Math.min(40, top)),
      bottom_percent: Math.max(0, Math.min(40, bottom)),
    };
  });
};

const getSlideshowObjectPosition = (setting) => {
  const top = Math.max(0, Math.min(40, Number(setting?.top_percent) || 0));
  const bottom = Math.max(0, Math.min(40, Number(setting?.bottom_percent) || 0));
  const center = Math.max(0, Math.min(100, (top + (100 - bottom)) / 2));
  return `50% ${center}%`;
};

const moveArrayItem = (items, fromIndex, toIndex) => {
  if (!Array.isArray(items) || !items.length) return items;
  if (toIndex < 0 || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const safeStorageGet = (key, fallback = '') => {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch (error) {
    console.warn(`Nao foi possivel ler ${key}:`, error);
    return fallback;
  }
};

const safeStorageRemove = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Nao foi possivel remover ${key}:`, error);
  }
};

const pruneForgeDraftStorage = () => {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(FORGE_DRAFT_KEY_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn('Nao foi possivel limpar rascunhos do Forge:', error);
  }
};

const safeStorageSet = (key, value, { pruneDrafts = false } = {}) => {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Nao foi possivel salvar ${key}:`, error);
    if (pruneDrafts) {
      pruneForgeDraftStorage();
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch (retryError) {
        console.warn(`Falha ao salvar ${key} apos limpeza:`, retryError);
      }
    }
    return false;
  }
};

const normalizeForge7030ImageTable = (items) => {
  const source = Array.isArray(items) ? items : [];
  return source
    .filter((item) => item?.image_url)
    .slice(0, 60)
    .map((item, index) => ({
      id: item.id || `forge7030_item_${Date.now()}_${index}`,
      slot: index + 1,
      image_url: item.image_url,
      filename: item.filename || `Imagem ${index + 1}`,
      headline_palette: item.headline_palette || 'purpleGold',
      video_filename: item.video_filename || '',
      status: item.status || 'pendente',
    }));
};

const readApiError = async (response, fallbackMessage) => {
  const fallback = `${fallbackMessage} (HTTP ${response.status})`;

  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      return payload?.detail || payload?.message || fallback;
    }

    const message = (await response.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return message || fallback;
  } catch (error) {
    console.warn('Nao foi possivel interpretar o erro da API:', error);
    return fallback;
  }
};

const extractForgeUploadedFilename = (value) => {
  if (!value) return '';

  let path = String(value);
  try {
    const parsed = new URL(path, window.location.origin);
    path = parsed.pathname;
  } catch (error) {
    path = path.split('?')[0].split('#')[0];
  }

  if (path.includes('/api/forge/uploaded/')) {
    path = path.split('/api/forge/uploaded/')[1] || '';
  } else if (path.includes('uploads/')) {
    path = path.split('uploads/')[1] || '';
  }

  try {
    return decodeURIComponent(path.split('/').pop() || '');
  } catch (error) {
    return path.split('/').pop() || '';
  }
};

function ForgeCropGuides({ active }) {
  if (!active) return null;
  return (
    <div className="image-guide-overlay" aria-hidden="true">
      <div className="image-guide-line top" />
      <div className="image-guide-line bottom" />
    </div>
  );
}

function ForgeHeadlineBand({ styleId, text, fontSize, compact = false }) {
  const safeText = (text || 'Headline').trim() || 'Headline';

  if (styleId === 'breakingFlash') {
    return (
      <div className={`headline-style-content style-breaking-flash ${compact ? 'compact' : ''}`}>
        <span className="headline-accent headline-accent-left" />
        <strong style={{ fontSize }}>{safeText}</strong>
        <span className="headline-accent headline-accent-right" />
      </div>
    );
  }

  if (styleId === 'liveHf') {
    return (
      <div className={`headline-style-content style-live-hf ${compact ? 'compact' : ''}`}>
        <div className="headline-live-badge">
          <span>LIVE</span>
        </div>
        <strong style={{ fontSize }}>{safeText}</strong>
      </div>
    );
  }

  if (styleId === 'doubleTicker') {
    return (
      <div className={`headline-style-content style-double-ticker ${compact ? 'compact' : ''}`}>
        <strong style={{ fontSize }}>{safeText}</strong>
      </div>
    );
  }

  return (
    <div className={`headline-style-content style-blue-live ${compact ? 'compact' : ''}`}>
      <div className="headline-live-badge">
        <span>LIVE</span>
      </div>
      <strong style={{ fontSize }}>{safeText}</strong>
    </div>
  );
}

const ForgeLibraryCard = React.memo(function ForgeLibraryCard({
  video,
  selected,
  source,
  displayName,
  mediaLabel,
  ratioLabel,
  ratioClassName,
  radioName,
  previewKind = 'video',
  deleting = false,
  editable = false,
  editing = false,
  editingValue = '',
  onSelect,
  onClear,
  onDelete,
  onStartEdit,
  onFinishEdit,
  onChangeEditValue,
  playLocalPreview,
  resetLocalPreview,
}) {
  return (
    <div
      className={`video-card-with-checkbox local-video-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      title={video.filename}
    >
      <div className="local-video-preview-wrap">
        {previewKind === 'image' ? (
          <img
            src={source}
            alt={displayName || 'Avatar'}
            className="local-video-preview"
          />
        ) : (
          <video
            src={source}
            muted
            loop
            playsInline
            preload="none"
            className="local-video-preview"
            onMouseEnter={playLocalPreview}
            onMouseLeave={resetLocalPreview}
          />
        )}
        <div className="local-video-overlay">
          <span className="local-video-duration">{mediaLabel}</span>
          <span className={`local-video-ratio ${ratioClassName}`}>
            {ratioLabel}
          </span>
          <strong>{displayName}</strong>
        </div>
        {selected && (
          <div className="local-selected-mark">
            <Check size={14} />
          </div>
        )}
        {selected && (
          <button
            type="button"
            className="local-selected-clear"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            title="Desmarcar seleção"
            aria-label="Desmarcar item selecionado"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <div className="checkbox-wrapper">
        <input
          type="radio"
          name={radioName}
          id={`${radioName}-${video.filename}`}
          checked={selected}
          onChange={onSelect}
          onClick={(event) => event.stopPropagation()}
          className="video-checkbox"
        />
        <label htmlFor={`${radioName}-${video.filename}`} className="checkbox-label">
          Selecionar
        </label>
      </div>
      {editable && (
        <div className="local-video-name-editor">
          {editing ? (
            <>
              <input
                type="text"
                value={editingValue}
                placeholder="Nome do vídeo"
                maxLength={80}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onChangeEditValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    onFinishEdit();
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFinishEdit();
                }}
              >
                OK
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onStartEdit();
              }}
            >
              Editar nome
            </button>
          )}
        </div>
      )}
      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        disabled={deleting}
        className="delete-video-button"
        title="Deletar item"
      >
        {deleting ? (
          <Loader size={14} className="spinner" />
        ) : (
          <Trash2 size={14} />
        )}
      </button>
    </div>
  );
});

const ForgeVerticalPreview = React.memo(function ForgeVerticalPreview({
  previewRootRef,
  hasPreviewImage,
  layoutPreset,
  selectedVideoSource,
  selectedVideoThumbnail,
  selectedVideoMediaType,
  activeHeadlineClassName,
  activePreviewImage,
  imageFit,
  verticalCenterPercent,
  topRatio,
  headlineRatio,
  bottomRatio,
  headlineFontScale,
  headlineText,
  headlinePosition,
  videoFit,
  postScale,
  postY,
  topGuidePercent,
  bottomGuidePercent,
}) {
  const imageObjectPosition = `50% ${verticalCenterPercent}%`;
  const showImageCropGuides = imageFit === 'cover';
  const previewImageFit = showImageCropGuides ? 'contain' : imageFit;
  const previewImagePosition = showImageCropGuides ? '50% 50%' : '50% var(--forge-image-position-y)';
  const effectiveHeadlinePosition = normalizeHeadlinePositionClient(headlinePosition, headlineText);
  const headlineFontSize = `${Math.max(14, 22 * (headlineFontScale / 100))}px`;
  const showOverlayHeadline =
    ['singleVideo', 'slideshowPure'].includes(layoutPreset) &&
    ['top', 'middle', 'bottom'].includes(effectiveHeadlinePosition) &&
    Boolean((headlineText || '').trim());
  const showBandHeadline =
    layoutPreset === 'classic7030' &&
    ['top', 'middle', 'bottom'].includes(effectiveHeadlinePosition) &&
    Boolean((headlineText || '').trim());

  const postHeadlineRows = (() => {
    if (!showBandHeadline) {
      return [
        { key: 'post', size: topRatio, className: 'pha-post' },
        { key: 'avatar', size: bottomRatio, className: 'pha-avatar' },
      ];
    }
    if (effectiveHeadlinePosition === 'top') {
      return [
        { key: 'headline', size: headlineRatio, className: 'pha-headline' },
        { key: 'post', size: topRatio, className: 'pha-post' },
        { key: 'avatar', size: bottomRatio, className: 'pha-avatar' },
      ];
    }
    if (effectiveHeadlinePosition === 'bottom') {
      return [
        { key: 'post', size: topRatio, className: 'pha-post' },
        { key: 'avatar', size: bottomRatio, className: 'pha-avatar' },
        { key: 'headline', size: headlineRatio, className: 'pha-headline' },
      ];
    }
    return [
      { key: 'post', size: topRatio, className: 'pha-post' },
      { key: 'headline', size: headlineRatio, className: 'pha-headline' },
      { key: 'avatar', size: bottomRatio, className: 'pha-avatar' },
    ];
  })();

  return (
    <div
      className="preview-container"
      ref={previewRootRef}
      style={{
        '--forge-image-position-y': imageObjectPosition.split(' ')[1],
        '--forge-guide-top': `${topGuidePercent}%`,
        '--forge-guide-bottom': `${bottomGuidePercent}%`,
      }}
    >
      <div className="preview-frame">
        {layoutPreset === 'singleVideo' && selectedVideoSource ? (
          <div className="single-video-preview">
            <video
              src={selectedVideoSource}
              className="video-preview"
              style={{ width: '100%', height: '100%', objectFit: videoFit }}
            />
            <span className="label">Vídeo 9:16</span>
          </div>
        ) : hasPreviewImage && layoutPreset === 'slideshowPure' ? (
          <div className={`slideshow-pure-preview forge-crop-guide-host ${showImageCropGuides ? 'cover-active' : ''}`}>
            <img
              src={activePreviewImage}
              alt="Preview do carrossel"
              style={{
                width: '100%',
                height: '100%',
                objectFit: previewImageFit,
                objectPosition: previewImagePosition,
              }}
            />
            <ForgeCropGuides active={showImageCropGuides} />
            <span className="label">Carrossel puro</span>
          </div>
        ) : hasPreviewImage && layoutPreset === 'classic7030' && showBandHeadline ? (
          <div
            className={`post-headline-avatar-preview ${activeHeadlineClassName}`}
            style={{ gridTemplateRows: postHeadlineRows.map((row) => `${row.size}fr`).join(' ') }}
          >
            {postHeadlineRows.map((row) => {
              if (row.key === 'post') {
                return (
                  <div key={row.key} className={`pha-post forge-crop-guide-host ${showImageCropGuides ? 'cover-active' : ''}`}>
                    <img
                      src={activePreviewImage}
                      alt="Imagem do post"
                      style={{
                        objectFit: previewImageFit,
                        objectPosition: previewImagePosition,
                      }}
                    />
                    <ForgeCropGuides active={showImageCropGuides} />
                    <span className="label">Imagem ({topRatio}%)</span>
                  </div>
                );
              }
              if (row.key === 'headline') {
                return (
                  <div key={row.key} className="pha-headline">
                    <ForgeHeadlineBand
                      styleId={activeHeadlineClassName}
                      text={headlineText || 'Headline'}
                      fontSize={headlineFontSize}
                    />
                  </div>
                );
              }
              return (
                <div key={row.key} className="pha-avatar">
                  {selectedVideoMediaType === 'image' ? (
                    <img
                      src={selectedVideoSource}
                      alt="Vídeo de fundo"
                      style={{ width: '100%', height: '100%', objectFit: videoFit }}
                    />
                  ) : selectedVideoSource ? (
                    <video
                      src={selectedVideoSource}
                      className="video-preview"
                      style={{ width: '100%', height: '100%', objectFit: videoFit }}
                    />
                  ) : selectedVideoThumbnail ? (
                    <img src={selectedVideoThumbnail} alt="Vídeo de fundo" style={{ objectFit: videoFit }} />
                  ) : (
                    <div className="video-placeholder-large">
                      <Play size={48} />
                    </div>
                  )}
                  <span className="label">Vídeo ({bottomRatio}%)</span>
                </div>
              );
            })}
          </div>
        ) : hasPreviewImage && bottomRatio === 0 && selectedVideoSource ? (
          <div className="post-overlay-preview">
            {selectedVideoSource ? (
              <video
                src={selectedVideoSource}
                className="post-background"
                style={{ width: '100%', height: '100%', objectFit: videoFit }}
              />
            ) : selectedVideoThumbnail ? (
              <img src={selectedVideoThumbnail} alt="Video" className="post-background" style={{ objectFit: videoFit }} />
            ) : null}

            <div
              className={`post-foreground-frame forge-crop-guide-host ${showImageCropGuides ? 'cover-active' : ''}`}
              style={{
                width: `${postScale}%`,
                top: `${postY}%`,
              }}
            >
              <img
                src={activePreviewImage}
                alt="Post centralizado"
                className="post-foreground"
                style={{
                  objectFit: previewImageFit,
                  objectPosition: previewImagePosition,
                }}
              />
              <ForgeCropGuides active={showImageCropGuides} />
            </div>
            <span className="label">Post sobre vídeo</span>
          </div>
        ) : hasPreviewImage ? (
          <>
            <div
              className={`frame-screenshot forge-crop-guide-host ${showImageCropGuides ? 'cover-active' : ''}`}
              style={{ height: `${topRatio}%` }}
            >
              <img
                src={activePreviewImage}
                alt="Screenshot"
                style={{
                  objectFit: previewImageFit,
                  objectPosition: previewImagePosition,
                }}
              />
              <ForgeCropGuides active={showImageCropGuides} />
              <span className="label">{bottomRatio === 0 ? 'Imagem inteira' : 'Screenshot'} ({topRatio}%)</span>
            </div>

            {bottomRatio > 0 && (
              <div className="frame-video" style={{ height: `${bottomRatio}%` }}>
                {selectedVideoSource ? (
                  <video
                    src={selectedVideoSource}
                    className="video-preview"
                    style={{ width: '100%', height: '100%', objectFit: videoFit }}
                  />
                ) : selectedVideoThumbnail ? (
                  <img src={selectedVideoThumbnail} alt="Video" style={{ objectFit: videoFit }} />
                ) : (
                  <div className="video-placeholder-large">
                    <Play size={48} />
                  </div>
                )}
                <span className="label">Vídeo de Fundo ({bottomRatio}%)</span>
              </div>
            )}
          </>
        ) : (
          <div className="preview-empty">
            <p>{bottomRatio === 0 ? 'Selecione uma imagem para visualizar' : 'Selecione screenshot e vídeo para visualizar'}</p>
          </div>
        )}
        {showOverlayHeadline && (
          <div
            className={`preview-headline-overlay ${activeHeadlineClassName} ${effectiveHeadlinePosition}`}
            style={{ height: `${Math.max(6, Math.min(20, headlineRatio))}%` }}
          >
            <ForgeHeadlineBand
              styleId={activeHeadlineClassName}
              text={headlineText || 'Headline'}
              fontSize={headlineFontSize}
            />
          </div>
        )}
      </div>
    </div>
  );
});

function ForgeEditor() {
  // Estados principales
  const [topRatio, setTopRatio] = useState(70);
  const [bottomRatio, setBottomRatio] = useState(30);
  const [postScale, setPostScale] = useState(88);
  const [postY, setPostY] = useState(50);
  const [imageFit, setImageFit] = useState('contain');
  const [imageCropX, setImageCropX] = useState(10);
  const [imageCropY, setImageCropY] = useState(10);
  const [videoFit, setVideoFit] = useState('contain');
  const [backgroundMode, setBackgroundMode] = useState('local');
  const [layoutPreset, setLayoutPreset] = useState('classic7030');
  const [headlineText, setHeadlineText] = useState('Sua Esperança Renasce');
  const [headlineRatio, setHeadlineRatio] = useState(10);
  const [headlineFontScale, setHeadlineFontScale] = useState(100);
  const [headlinePalette, setHeadlinePalette] = useState('purpleGold');
  const [slideshowHeadlinePosition, setSlideshowHeadlinePosition] = useState(DEFAULT_HEADLINE_POSITION);
  const [generatingHeadline, setGeneratingHeadline] = useState(false);
  const [avatarSpeechText, setAvatarSpeechText] = useState('');
  const [avatarSpeechDurationModel, setAvatarSpeechDurationModel] = useState('30s');
  const [avatarSpeechStyle, setAvatarSpeechStyle] = useState('humor_bizarro');
  const [avatarVoiceProfile, setAvatarVoiceProfile] = useState('');
  const [avatarSpeechTimingNote, setAvatarSpeechTimingNote] = useState('');
  const [generatingAvatarSpeech, setGeneratingAvatarSpeech] = useState(false);
  const [avatarGeneratorStatus, setAvatarGeneratorStatus] = useState(null);
  const [avatarEngineRegistry, setAvatarEngineRegistry] = useState(null);
  const [loadingAvatarEngineRegistry, setLoadingAvatarEngineRegistry] = useState(false);
  const [savingAvatarEngineId, setSavingAvatarEngineId] = useState('');
  const [loadingAvatarEngineDiagnosticsId, setLoadingAvatarEngineDiagnosticsId] = useState('');
  const [avatarEngineDiagnostics, setAvatarEngineDiagnostics] = useState({});
  const [avatarEnginePlan, setAvatarEnginePlan] = useState(null);
  const [buildingAvatarEnginePlan, setBuildingAvatarEnginePlan] = useState(false);
  const [runningAvatarEngine, setRunningAvatarEngine] = useState(false);
  const [avatarEngineRenderResult, setAvatarEngineRenderResult] = useState(null);
  const [savingAvatarEngineRender, setSavingAvatarEngineRender] = useState(false);
  const [showHiddenAvatarProviders, setShowHiddenAvatarProviders] = useState(false);
  const [avatarSpeechCollapsed, setAvatarSpeechCollapsed] = useState(true);
  const [avatarEngineCollapsed, setAvatarEngineCollapsed] = useState(true);
  const [customAvatarProvider, setCustomAvatarProvider] = useState({
    name: '',
    repo_url: '',
    kind: 'avatar_video',
    summary: '',
  });
  const [screenshotPath, setScreenshotPath] = useState('');
  const [selectedImagePaths, setSelectedImagePaths] = useState([]);
  const [selectedImageUploadPaths, setSelectedImageUploadPaths] = useState([]);
  const [slideshowImageSettings, setSlideshowImageSettings] = useState([]);
  const [libraryChannelId, setLibraryChannelId] = useState(() => safeStorageGet('alliance_forge_library_channel_id'));
  const [slideshowMode, setSlideshowMode] = useState(false);
  const [slideshowStyle, setSlideshowStyle] = useState('pure');
  const [socialImageUrl, setSocialImageUrl] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [effectLibrary, setEffectLibrary] = useState(null);
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [effectsMode, setEffectsMode] = useState('assisted');
  const [effectsPreset, setEffectsPreset] = useState('documentary');
  const [transitionFrequency, setTransitionFrequency] = useState('balanced');
  const [effectPreviewOpen, setEffectPreviewOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [downloadingSocialImage, setDownloadingSocialImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAvatarVideo, setUploadingAvatarVideo] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [deletingVideoFile, setDeletingVideoFile] = useState(null);
  const [deletingAvatarFile, setDeletingAvatarFile] = useState(null);
  const [deletingAudioFile, setDeletingAudioFile] = useState(null);
  const [croppingImage, setCroppingImage] = useState(false);
  const libraryRequestRef = useRef(0);
  const avatarLibraryRequestRef = useRef(0);
  const audioLibraryRequestRef = useRef(0);
  const ratioLockRef = useRef({ top: 70, bottom: 30 });
  const restoredDraftKeyRef = useRef('');
  const previewRootRef = useRef(null);

  // Estados de dados
  const [avatarVideos, setAvatarVideos] = useState([]);
  const [localVideos, setLocalVideos] = useState([]);
  const [localAudios, setLocalAudios] = useState([]);
  const [rendering, setRendering] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatingMetadata, setGeneratingMetadata] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState('');
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [renderResult, setRenderResult] = useState(null);
  const [metadataTitle, setMetadataTitle] = useState('');
  const [metadataDescription, setMetadataDescription] = useState('');
  const [metadataHashtags, setMetadataHashtags] = useState('');
  const [metadataGenerateMode, setMetadataGenerateMode] = useState('title_description_hashtags');
  const [metadataCategory, setMetadataCategory] = useState('22');
  const [metadataPrivacyStatus, setMetadataPrivacyStatus] = useState('private');
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [imageProductionCollapsed, setImageProductionCollapsed] = useState(true);
  const [imageProductionItems, setImageProductionItems] = useState(() => {
    try {
      return normalizeForge7030ImageTable(JSON.parse(safeStorageGet(FORGE_7030_IMAGE_TABLE_KEY, '[]')));
    } catch {
      return [];
    }
  });
  const [uploadingImageProduction, setUploadingImageProduction] = useState(false);
  const [imageProductionMessage, setImageProductionMessage] = useState('');
  const [activeImageProductionItemId, setActiveImageProductionItemId] = useState('');
  const [localVideoLabels, setLocalVideoLabels] = useState(() => {
    try {
      return JSON.parse(safeStorageGet(FORGE_LOCAL_VIDEO_LABELS_KEY, '{}'));
    } catch {
      return {};
    }
  });
  const [editingLocalVideoName, setEditingLocalVideoName] = useState('');

  const youtubeCategoryOptions = [
    { value: '1', label: '1 - Film & Animation' },
    { value: '2', label: '2 - Autos & Vehicles' },
    { value: '10', label: '10 - Music' },
    { value: '15', label: '15 - Pets & Animals' },
    { value: '17', label: '17 - Sports' },
    { value: '19', label: '19 - Travel & Events' },
    { value: '20', label: '20 - Gaming' },
    { value: '22', label: '22 - People & Blogs' },
    { value: '23', label: '23 - Comedy' },
    { value: '24', label: '24 - Entertainment' },
    { value: '25', label: '25 - News & Politics' },
    { value: '26', label: '26 - Howto & Style' },
    { value: '27', label: '27 - Education' },
    { value: '28', label: '28 - Science & Technology' },
    { value: '29', label: '29 - Nonprofits & Activism' },
  ];

  const effectModeOptions = [
    { value: 'manual', label: 'Manual' },
    { value: 'assisted', label: 'Assistido' },
    { value: 'automatic', label: 'Automático' },
  ];

  const effectPresetOptions = [
    { value: 'documentary', label: 'Documentário' },
    { value: 'news', label: 'Notícias' },
    { value: 'suspense', label: 'Suspense' },
    { value: 'dynamic', label: 'Dinâmico' },
    { value: 'educational', label: 'Educacional' },
    { value: 'trailer', label: 'Trailer' },
    { value: 'custom', label: 'Personalizado' },
  ];

  const transitionFrequencyOptions = [
    { value: 'minimal', label: 'Mínima' },
    { value: 'balanced', label: 'Equilibrada' },
    { value: 'dynamic', label: 'Dinâmica' },
    { value: 'custom', label: 'Personalizada' },
  ];

  const localVideoFormats = [
    {
      id: 'bottom30',
      label: 'Rodapé 30%',
      detail: 'vídeo embaixo',
      icon: PanelBottom,
      ratio: 70,
    },
    {
      id: 'fullVertical',
      label: 'Fundo vertical',
      detail: 'vídeo inteiro atrás',
      icon: Maximize2,
      ratio: 100,
    },
    {
      id: 'halfSplit',
      label: 'Meio 50%',
      detail: 'imagem e vídeo',
      icon: LayoutPanelTop,
      ratio: 50,
    },
  ];

  // Catálogo fixo do bloco de headline aprovado pelo usuário.
  const headlinePalettes = [
    { id: 'purpleGold', label: 'Azul / Branco', className: 'purpleGold', sampleText: 'A VERDADE VOLTOU AO CENTRO' },
    { id: 'breakingFlash', label: 'Breaking', className: 'breakingFlash', sampleText: 'AGORA A CASA CAIU' },
    { id: 'liveHf', label: 'Live HF', className: 'liveHf', sampleText: 'AO VIVO NO CENTRO DO CAOS' },
    { id: 'doubleTicker', label: 'Ticker Duplo', className: 'doubleTicker', sampleText: 'NINGUÉM CONSEGUE ESCONDER ISSO' },
  ];

  const activeHeadlinePalette = headlinePalettes.find((palette) => palette.id === headlinePalette) || headlinePalettes[0];
  const availableAvatarSpeechStyles = avatarGeneratorStatus?.speech_styles || [];
  const availableAvatarVoiceProfiles = avatarGeneratorStatus?.voice_profiles || [];
  const activeAvatarVoiceProfile = availableAvatarVoiceProfiles.find((item) => item.id === avatarVoiceProfile) || null;
  const normalizedImageProductionItems = normalizeForge7030ImageTable(imageProductionItems);
  const nextImageProductionItem = normalizedImageProductionItems.find((item) => item.status === 'pendente')
    || normalizedImageProductionItems.find((item) => item.status !== 'renderizado')
    || normalizedImageProductionItems[0]
    || null;
  const nextImageProductionSlot = nextImageProductionItem?.slot || 1;

  useEffect(() => {
    const saveTableTimer = window.setTimeout(() => {
      safeStorageSet(
        FORGE_7030_IMAGE_TABLE_KEY,
        JSON.stringify(normalizeForge7030ImageTable(imageProductionItems)),
        { pruneDrafts: true }
      );
    }, 600);

    return () => window.clearTimeout(saveTableTimer);
  }, [imageProductionItems]);

  useEffect(() => {
    safeStorageSet(FORGE_LOCAL_VIDEO_LABELS_KEY, JSON.stringify(localVideoLabels), { pruneDrafts: true });
  }, [localVideoLabels]);

  const applyClassicHeadlineRatio = (nextHeadline) => {
    setHeadlineRatio(Math.min(20, Math.max(6, Number(nextHeadline) || 10)));
  };

  const applyLayoutPreset = () => {
    setLayoutPreset('classic7030');
    setBackgroundMode('local');
    setTopRatio(70);
    setBottomRatio(30);
    ratioLockRef.current = { top: 70, bottom: 30 };
  };

  const loadLocalVideos = useCallback(async (channelId = libraryChannelId || safeStorageGet('alliance_forge_library_channel_id')) => {
    const requestId = ++libraryRequestRef.current;
    try {
      const query = channelId ? `?channel_id=${encodeURIComponent(channelId)}` : '';
      const response = await fetch(apiUrl(`/api/forge/library${query}`), { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (requestId === libraryRequestRef.current && (!data.channel_id || data.channel_id === channelId)) {
          setLocalVideos(data.videos || []);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar vídeos locais:', err);
    }
  }, [libraryChannelId]);

  const loadAvatarVideos = useCallback(async (channelId = libraryChannelId || safeStorageGet('alliance_forge_library_channel_id')) => {
    const requestId = ++avatarLibraryRequestRef.current;
    try {
      const query = channelId ? `?channel_id=${encodeURIComponent(channelId)}` : '';
      const response = await fetch(apiUrl(`/api/forge/avatar-library${query}`), { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (requestId === avatarLibraryRequestRef.current && (!data.channel_id || data.channel_id === channelId)) {
          setAvatarVideos(data.videos || []);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar avatares:', err);
    }
  }, [libraryChannelId]);

  const loadAvatarGeneratorStatus = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/forge/avatar-generator/status'), { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setAvatarGeneratorStatus(data);
        if ((!avatarSpeechStyle || !data.speech_styles?.some((item) => item.id === avatarSpeechStyle)) && data.speech_styles?.length) {
          setAvatarSpeechStyle(data.speech_styles[0].id);
        }
        if ((!avatarVoiceProfile || !data.voice_profiles?.some((item) => item.id === avatarVoiceProfile)) && data.voice_profiles?.length) {
          setAvatarVoiceProfile(data.voice_profiles[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar status do gerador de avatar:', err);
    }
  }, [avatarSpeechStyle, avatarVoiceProfile]);

  const loadAvatarEngineRegistry = useCallback(async () => {
    setLoadingAvatarEngineRegistry(true);
    try {
      const response = await fetch(apiUrl('/api/forge/avatar-engine/providers'), { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setAvatarEngineRegistry(data);
      }
    } catch (err) {
      console.error('Erro ao carregar motores de avatar:', err);
    } finally {
      setLoadingAvatarEngineRegistry(false);
    }
  }, []);

  const loadLocalAudios = useCallback(async (channelId = libraryChannelId || safeStorageGet('alliance_forge_library_channel_id')) => {
    const requestId = ++audioLibraryRequestRef.current;
    try {
      const query = channelId ? `?channel_id=${encodeURIComponent(channelId)}` : '';
      const response = await fetch(apiUrl(`/api/forge/audio-library${query}`), { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (requestId === audioLibraryRequestRef.current && (!data.channel_id || data.channel_id === channelId)) {
          const uniqueAudios = [];
          const seen = new Set();
          for (const audio of data.audios || []) {
            const key = `${audio.filename || ''}`;
            if (!key || seen.has(key)) continue;
            seen.add(key);
            uniqueAudios.push(audio);
          }
          setLocalAudios(uniqueAudios);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar áudios locais:', err);
    }
  }, [libraryChannelId]);

  // Carregar vídeos locais
  useEffect(() => {
    loadLocalVideos(safeStorageGet('alliance_forge_library_channel_id'));
    loadLocalAudios(safeStorageGet('alliance_forge_library_channel_id'));
    const capturedImage = safeStorageGet('forge_selected_image');
    if (capturedImage) {
      setScreenshotPath(capturedImage);
      safeStorageRemove('forge_selected_image');
    }
  }, [loadLocalAudios, loadLocalVideos]);

  useEffect(() => {
    let active = true;

    const loadEffectLibrary = async () => {
      try {
        const response = await fetch(apiUrl('/api/forge/effects/library'), { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          setEffectLibrary(data);
        }
      } catch (err) {
        console.warn('Não foi possível carregar a biblioteca de efeitos do Forge:', err);
      }
    };

    loadEffectLibrary();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncActiveLibraryChannel = async () => {
      const storedChannelId = safeStorageGet('alliance_forge_library_channel_id');
      if (storedChannelId) {
        setLibraryChannelId(storedChannelId);
        setSelectedVideo(null);
        setSelectedAudio(null);
        setLocalVideos([]);
        setLocalAudios([]);
        return;
      }

      try {
        const response = await fetch(apiUrl('/api/conexoes/youtube/channels'));
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const activeChannelId = data.active_channel_id || '';
        if (activeChannelId) {
          safeStorageSet('alliance_forge_library_channel_id', activeChannelId);
          setLibraryChannelId(activeChannelId);
          setSelectedVideo(null);
          setSelectedAudio(null);
          setLocalVideos([]);
          setLocalAudios([]);
          loadLocalVideos(activeChannelId);
          loadLocalAudios(activeChannelId);
        }
      } catch (err) {
        console.warn('Não foi possível sincronizar o canal da biblioteca:', err);
      }
    };

    syncActiveLibraryChannel();
  }, [loadLocalAudios, loadLocalVideos]);

  useEffect(() => {
    const syncLibraryChannel = () => {
      const nextChannelId = safeStorageGet('alliance_forge_library_channel_id');
      setLibraryChannelId(nextChannelId);
      setSelectedVideo(null);
      setSelectedAudio(null);
      setLocalVideos([]);
      setLocalAudios([]);
      loadLocalVideos(nextChannelId);
      loadLocalAudios(nextChannelId);
    };

    window.addEventListener('storage', syncLibraryChannel);
    window.addEventListener('alliance:forge-library-channel-changed', syncLibraryChannel);

    return () => {
      window.removeEventListener('storage', syncLibraryChannel);
      window.removeEventListener('alliance:forge-library-channel-changed', syncLibraryChannel);
    };
  }, [loadLocalAudios, loadLocalVideos]);

  useEffect(() => {
    if (!slideshowMode) return;

    const firstImage = selectedImagePaths[0] || '';
    if (firstImage && firstImage !== screenshotPath) {
      setScreenshotPath(firstImage);
      return;
    }

    if (!firstImage && screenshotPath) {
      setScreenshotPath('');
    }
  }, [slideshowMode, selectedImagePaths, screenshotPath]);

  useEffect(() => {
    if (!slideshowMode || !selectedImagePaths.length) return;
    const firstSetting = normalizeSlideshowSettingsClient(slideshowImageSettings, selectedImagePaths.length)[0];
    if (!firstSetting) return;

    if (imageFit !== firstSetting.fit) {
      setImageFit(firstSetting.fit);
    }
    if (imageCropX !== firstSetting.top_percent) {
      setImageCropX(firstSetting.top_percent);
    }
    if (imageCropY !== firstSetting.bottom_percent) {
      setImageCropY(firstSetting.bottom_percent);
    }
  }, [slideshowMode, selectedImagePaths.length, slideshowImageSettings, imageFit, imageCropX, imageCropY]);

  const toLocalDateTimeValue = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const getDefaultScheduleDateTime = () => {
    const date = new Date(Date.now() + 15 * 60 * 1000);
    date.setSeconds(0, 0);
    return toLocalDateTimeValue(date);
  };

  const getSelectedVideoSource = (video) => {
    if (!video) return '';

    if (video.url) return video.url;
    if (video.path) {
      const filename = video.filename || video.path.split(/[\\/]/).pop() || '';
      if (!filename) return '';
      if (video.path.includes('uploads\\') || video.path.includes('/uploads/')) {
        return apiUrl(`/api/forge/uploaded/${encodeURIComponent(filename)}`);
      }
      const channelId = video.channel_id || libraryChannelId || safeStorageGet('alliance_forge_library_channel_id');
      const query = channelId ? `?channel_id=${encodeURIComponent(channelId)}` : '';
      return apiUrl(`/api/forge/play-video/${encodeURIComponent(filename)}${query}`);
    }
    if (video.thumbnail) return video.thumbnail;
    return '';
  };

  const getSelectedAudioSource = (audio) => {
    if (!audio) return '';
    if (audio.url) return audio.url;
    if (audio.path) {
      const filename = audio.filename || audio.path.split(/[\\/]/).pop() || '';
      if (!filename) return '';
      const channelId = audio.channel_id || libraryChannelId || safeStorageGet('alliance_forge_library_channel_id');
      const query = channelId ? `?channel_id=${encodeURIComponent(channelId)}` : '';
      return apiUrl(`/api/forge/play-audio/${encodeURIComponent(filename)}${query}`);
    }
    return '';
  };

  const getDraftKey = useCallback((channelId) => {
    const resolvedChannelId = channelId || libraryChannelId || safeStorageGet('alliance_forge_library_channel_id') || 'default';
    return `${FORGE_DRAFT_KEY_PREFIX}${resolvedChannelId}`;
  }, [libraryChannelId]);

  const compactSavedMedia = useCallback((media) => {
    if (!media) return null;
    return {
      filename: media.filename || '',
      path: media.path || '',
      url: media.url || '',
      channel_id: media.channel_id || '',
      duration: Number(media.duration || 0),
      aspect_ratio: media.aspect_ratio || '',
      display_name: media.display_name || '',
      media_type: media.media_type || '',
      thumbnail: media.thumbnail || '',
    };
  }, []);

  const topGuidePercent = Math.max(0, Math.min(40, imageCropX));
  const bottomGuidePercent = Math.max(0, Math.min(40, imageCropY));
  const verticalCenterPercent = Math.max(
    0,
    Math.min(100, (topGuidePercent + (100 - bottomGuidePercent)) / 2)
  );

  const applyPreviewCropStyle = useCallback((topValue, bottomValue) => {
    const top = Math.max(0, Math.min(40, Number(topValue) || 0));
    const bottom = Math.max(0, Math.min(40, Number(bottomValue) || 0));
    const center = Math.max(0, Math.min(100, (top + (100 - bottom)) / 2));

    const previewRoot = previewRootRef.current;
    if (previewRoot) {
      previewRoot.style.setProperty('--forge-guide-top', `${top}%`);
      previewRoot.style.setProperty('--forge-guide-bottom', `${bottom}%`);
      previewRoot.style.setProperty('--forge-image-position-y', `${center}%`);
    }
  }, []);

  useEffect(() => {
    applyPreviewCropStyle(topGuidePercent, bottomGuidePercent);
  }, [applyPreviewCropStyle, topGuidePercent, bottomGuidePercent]);

  useEffect(() => {
    const draftKey = getDraftKey();
    if (!draftKey || restoredDraftKeyRef.current === draftKey) {
      return;
    }

    restoredDraftKeyRef.current = draftKey;

    try {
      const rawDraft = safeStorageGet(draftKey);
      if (!rawDraft) {
        return;
      }

      const draft = JSON.parse(rawDraft);
      if (!draft || typeof draft !== 'object') {
        return;
      }

      setTopRatio(draft.topRatio ?? 70);
      setBottomRatio(draft.bottomRatio ?? 30);
      ratioLockRef.current = {
        top: draft.topRatio ?? 70,
        bottom: draft.bottomRatio ?? 30,
      };
      setPostScale(draft.postScale ?? 88);
      setPostY(draft.postY ?? 50);
      setImageFit(draft.imageFit || 'contain');
      setImageCropX(draft.imageCropX ?? 10);
      setImageCropY(draft.imageCropY ?? 10);
      setVideoFit(draft.videoFit || 'contain');
      // O Forge 70/30 possui um unico fluxo ativo. Rascunhos antigos de avatar
      // sao migrados sem reativar o modo removido.
      setBackgroundMode('local');
      setLayoutPreset('classic7030');
      setHeadlineText(draft.headlineText || 'Sua Esperança Renasce');
      setHeadlineRatio(draft.headlineRatio ?? 10);
      setHeadlineFontScale(draft.headlineFontScale ?? 100);
      setHeadlinePalette(['purpleGold', 'breakingFlash', 'liveHf', 'doubleTicker'].includes(draft.headlinePalette) ? draft.headlinePalette : 'purpleGold');
      setSlideshowHeadlinePosition(normalizeHeadlinePositionClient(draft.slideshowHeadlinePosition, draft.headlineText || ''));
      setAvatarSpeechText(draft.avatarSpeechText || '');
      setAvatarSpeechDurationModel(['6s', '10s', '15s', '30s', '60s'].includes(draft.avatarSpeechDurationModel) ? draft.avatarSpeechDurationModel : '30s');
      setAvatarSpeechStyle(draft.avatarSpeechStyle || 'humor_bizarro');
      setAvatarVoiceProfile(draft.avatarVoiceProfile || '');
      setAvatarSpeechTimingNote(draft.avatarSpeechTimingNote || '');
      setAvatarSpeechCollapsed(draft.avatarSpeechCollapsed ?? true);
      setAvatarEngineCollapsed(draft.avatarEngineCollapsed ?? true);
      setScreenshotPath(draft.screenshotPath || '');
      setSelectedImagePaths(Array.isArray(draft.selectedImagePaths) ? draft.selectedImagePaths : []);
      setSelectedImageUploadPaths(Array.isArray(draft.selectedImageUploadPaths) ? draft.selectedImageUploadPaths : []);
      setSlideshowImageSettings(
        normalizeSlideshowSettingsClient(
          draft.slideshowImageSettings,
          Array.isArray(draft.selectedImagePaths) ? draft.selectedImagePaths.length : 0,
        ),
      );
      setSlideshowMode(Boolean(draft.slideshowMode));
      setSlideshowStyle(draft.slideshowStyle || 'pure');
      setSocialImageUrl(draft.socialImageUrl || '');
      setSelectedVideo(draft.backgroundMode === 'avatar' ? null : (draft.selectedVideo || null));
      setSelectedAudio(draft.selectedAudio || null);
      setEffectsEnabled(draft.effectsEnabled ?? true);
      setEffectsMode(draft.effectsMode || 'assisted');
      setEffectsPreset(draft.effectsPreset || 'documentary');
      setTransitionFrequency(draft.transitionFrequency || 'balanced');
      setEffectPreviewOpen(Boolean(draft.effectPreviewOpen));
      setRenderResult(draft.renderResult || null);
      setMetadataTitle(draft.metadataTitle || '');
      setMetadataDescription(draft.metadataDescription || '');
      setMetadataHashtags(draft.metadataHashtags || '');
      setMetadataCategory(draft.metadataCategory || '22');
      setMetadataPrivacyStatus(draft.metadataPrivacyStatus || 'private');
      setScheduleDateTime(draft.scheduleDateTime || '');
      setScheduleMessage(draft.scheduleMessage || '');
    } catch (error) {
      console.warn('Nao foi possivel restaurar rascunho do Forge:', error);
    }
  }, [getDraftKey]);

  useEffect(() => {
    const draftKey = getDraftKey();
    if (!draftKey || restoredDraftKeyRef.current !== draftKey) {
      return;
    }

    const safeImagePaths = selectedImagePaths.filter((path) => typeof path === 'string' && !path.startsWith('blob:'));
    const safeScreenshotPath = typeof screenshotPath === 'string' && !screenshotPath.startsWith('blob:')
      ? screenshotPath
      : (selectedImageUploadPaths[0] || '');

    const hasDraftContent = Boolean(
      safeScreenshotPath ||
      safeImagePaths.length ||
      selectedImageUploadPaths.length ||
      selectedVideo ||
      selectedAudio ||
      avatarSpeechText ||
      avatarSpeechDurationModel !== '30s' ||
      avatarSpeechStyle !== 'humor_bizarro' ||
      avatarVoiceProfile ||
      avatarSpeechTimingNote ||
      avatarSpeechCollapsed !== true ||
      avatarEngineCollapsed !== true ||
      effectsEnabled !== true ||
      effectsMode !== 'assisted' ||
      effectsPreset !== 'documentary' ||
      transitionFrequency !== 'balanced' ||
      renderResult ||
      metadataTitle ||
      metadataDescription ||
      metadataHashtags ||
      scheduleDateTime ||
      scheduleMessage
    );

    if (!hasDraftContent) {
      safeStorageRemove(draftKey);
      return;
    }

    const saveDraftTimer = window.setTimeout(() => {
      const draftPayload = {
        topRatio,
        bottomRatio,
        postScale,
        postY,
        imageFit,
        imageCropX,
        imageCropY,
        videoFit,
        backgroundMode,
        layoutPreset,
        headlineText,
        headlineRatio,
        headlineFontScale,
        headlinePalette,
        slideshowHeadlinePosition: normalizeHeadlinePositionClient(slideshowHeadlinePosition, headlineText),
        avatarSpeechText,
        avatarSpeechDurationModel,
        avatarSpeechStyle,
        avatarVoiceProfile,
        avatarSpeechTimingNote,
        avatarSpeechCollapsed,
        avatarEngineCollapsed,
        screenshotPath: safeScreenshotPath,
        selectedImagePaths: selectedImageUploadPaths.length ? selectedImageUploadPaths : safeImagePaths,
        selectedImageUploadPaths,
        slideshowImageSettings: normalizeSlideshowSettingsClient(
          slideshowImageSettings,
          selectedImageUploadPaths.length || safeImagePaths.length,
        ),
        slideshowMode,
        slideshowStyle,
        socialImageUrl,
        selectedVideo: compactSavedMedia(selectedVideo),
        selectedAudio: compactSavedMedia(selectedAudio),
        effectsEnabled,
        effectsMode,
        effectsPreset,
        transitionFrequency,
        effectPreviewOpen,
        renderResult: null,
        metadataTitle,
        metadataDescription,
        metadataHashtags,
        metadataCategory,
        metadataPrivacyStatus,
        scheduleDateTime,
        scheduleMessage,
      };

      safeStorageSet(draftKey, JSON.stringify(draftPayload), { pruneDrafts: true });
    }, 2200);

    return () => window.clearTimeout(saveDraftTimer);
  }, [
    backgroundMode,
    bottomRatio,
    effectPreviewOpen,
    effectsEnabled,
    effectsMode,
    effectsPreset,
    getDraftKey,
    imageCropX,
    imageCropY,
    imageFit,
    avatarSpeechText,
    avatarSpeechDurationModel,
    avatarSpeechStyle,
    avatarVoiceProfile,
    avatarSpeechTimingNote,
    avatarSpeechCollapsed,
    avatarEngineCollapsed,
      headlineText,
      headlineRatio,
      headlineFontScale,
      headlinePalette,
      slideshowHeadlinePosition,
    layoutPreset,
    metadataCategory,
    metadataDescription,
    metadataHashtags,
    metadataPrivacyStatus,
    metadataTitle,
    postScale,
    postY,
    renderResult,
    scheduleDateTime,
    scheduleMessage,
    screenshotPath,
    selectedAudio,
    selectedImagePaths,
    selectedImageUploadPaths,
    slideshowImageSettings,
    selectedVideo,
    slideshowMode,
    slideshowStyle,
    socialImageUrl,
    topRatio,
    transitionFrequency,
    videoFit,
    compactSavedMedia,
  ]);

  const clearForgeDraft = useCallback(() => {
    const draftKey = getDraftKey();
    if (draftKey) {
      safeStorageRemove(draftKey);
    }
  }, [getDraftKey]);

  const updateImageProductionItem = (itemId, patch) => {
    setImageProductionItems((current) => normalizeForge7030ImageTable(
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    ));
  };

  const handleImageProductionUpload = async (event) => {
    const files = Array.from(event.target.files || [])
      .filter((file) => file.type.startsWith('image/'));
    event.target.value = '';
    if (!files.length) return;

    const freeSlots = Math.max(0, 60 - normalizedImageProductionItems.length);
    const imageFiles = files.slice(0, freeSlots);
    if (!imageFiles.length) {
      setError('A tabela 70/30 já está com 60 imagens.');
      return;
    }

    setUploadingImageProduction(true);
    setError('');
    setImageProductionMessage('');

    try {
      const uploadedItems = [];
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(apiUrl('/api/forge/upload-media'), {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `Erro ao enviar ${file.name}`);
        }

        const data = await response.json();
        const imageUrl = apiUrl(data.image_url || data.preview_image_url || data.preview_url || '');
        if (imageUrl) {
          uploadedItems.push({
            id: `forge7030_item_${Date.now()}_${uploadedItems.length}`,
            image_url: imageUrl,
            filename: data.filename || file.name,
            headline_palette: headlinePalette,
            video_filename: selectedVideo?.filename || '',
            status: 'pendente',
          });
        }
      }

      setImageProductionItems((current) => normalizeForge7030ImageTable([...current, ...uploadedItems]));
      setImageProductionMessage(`${uploadedItems.length} imagens adicionadas à tabela 70/30.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingImageProduction(false);
    }
  };

  const deleteImageProductionItem = (itemId) => {
    setImageProductionItems((current) => normalizeForge7030ImageTable(
      current.filter((item) => item.id !== itemId)
    ));
  };

  const pullImageProductionItem = (item = nextImageProductionItem) => {
    if (!item?.image_url) {
      setError('Nenhuma imagem pendente na tabela 70/30.');
      return;
    }

    const tableVideo = localVideos.find((video) => video.filename === item.video_filename);

    setSlideshowMode(false);
    setSlideshowStyle('pure');
    setSelectedImagePaths([item.image_url]);
    setSelectedImageUploadPaths([item.image_url]);
    setSlideshowImageSettings(normalizeSlideshowSettingsClient([], 1));
    setScreenshotPath(item.image_url);
    setHeadlinePalette(item.headline_palette || 'purpleGold');
    setLayoutPreset('classic7030');
    setSlideshowHeadlinePosition((current) => normalizeHeadlinePositionClient(current, headlineText));
    if (tableVideo) {
      setSelectedVideo(tableVideo);
      setBackgroundMode('local');
    }
    setRenderResult(null);
    setImageProductionItems((current) => normalizeForge7030ImageTable(
      current
        .filter((entry) => entry.status !== 'renderizado' || entry.id === item.id)
        .map((entry) => (entry.id === item.id ? { ...entry, status: 'em_edicao' } : entry))
    ));
    setActiveImageProductionItemId(item.id);
    setImageProductionMessage(`Imagem ${item.slot}/60 puxada para o Forge 70/30.`);
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setUploadingImage(true);
    setError('');

    try {
      if (slideshowMode) {
        const imageFiles = files.filter((file) => file.type.startsWith('image/')).slice(0, 10);
        if (imageFiles.length < 1) {
          throw new Error('Selecione de 1 a 10 imagens para o modo sequência');
        }

        const previousPreviewPaths = selectedImagePaths || [];
        previousPreviewPaths.forEach((path) => {
          if (typeof path === 'string' && path.startsWith('blob:')) {
            URL.revokeObjectURL(path);
          }
        });

        const previewPaths = [];
        const uploadedPaths = [];
        for (const file of imageFiles) {
          const previewUrl = URL.createObjectURL(file);
          previewPaths.push(previewUrl);

          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch(apiUrl('/api/forge/upload-media'), {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao fazer upload');
          }

          const data = await response.json();
          const mediaUrl = apiUrl(data.image_url || data.preview_image_url || data.preview_url || '');
          if (mediaUrl) {
            uploadedPaths.push(mediaUrl);
          }
        }

        setSelectedImagePaths(previewPaths);
        setSelectedImageUploadPaths(uploadedPaths);
        setSlideshowImageSettings(normalizeSlideshowSettingsClient([], uploadedPaths.length));
        setScreenshotPath(previewPaths[0] || '');
        setRenderResult(null);
        return;
      }

      const file = files[0];
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        throw new Error('Por favor, selecione um arquivo de imagem ou vídeo válido');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(apiUrl('/api/forge/upload-media'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao fazer upload');
      }

      const data = await response.json();

      if (data.media_type === 'video' || data.video_url) {
        const videoPreviewUrl = apiUrl(data.preview_image_url || data.preview_url || '');
        setScreenshotPath(videoPreviewUrl);
        setSelectedImagePaths([]);
        setSelectedImageUploadPaths([]);
        setSlideshowImageSettings([]);
        setSelectedVideo({
          filename: data.filename,
          path: data.filepath,
          url: apiUrl(data.video_url || `/api/forge/play-video/${data.filename}`),
          thumbnail: videoPreviewUrl,
          media_type: 'video',
          source_role: 'single_upload',
        });
        setBackgroundMode('local');
        setRenderResult(null);
      } else {
        const fullImageUrl = apiUrl(data.image_url || data.preview_image_url || data.preview_url || '');
        if (screenshotPath && screenshotPath.startsWith('blob:')) {
          URL.revokeObjectURL(screenshotPath);
        }
        setScreenshotPath(fullImageUrl);
        setSelectedImagePaths([fullImageUrl]);
        setSelectedImageUploadPaths([fullImageUrl]);
        setSlideshowImageSettings(normalizeSlideshowSettingsClient([], 1));
        setRenderResult(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDownloadSocialImage = async () => {
    if (!socialImageUrl.trim()) {
      setError('Cole um link do YouTube, Instagram, TikTok, Pinterest, Facebook ou imagem direta');
      return;
    }

    setDownloadingSocialImage(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/forge/download-image'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_url: socialImageUrl.trim(),
          prefer_carousel: slideshowMode,
          limit: 10,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao baixar imagem do link');
      }

      const data = await response.json();
      if (slideshowMode && Array.isArray(data.images) && data.images.length > 0) {
        const importedUrls = data.images
          .map((item) => apiUrl(item.image_url || ''))
          .filter(Boolean)
          .slice(0, 10);
        setSelectedImagePaths(importedUrls);
        setSelectedImageUploadPaths(importedUrls);
        setSlideshowImageSettings(normalizeSlideshowSettingsClient([], importedUrls.length));
        setScreenshotPath(importedUrls[0] || '');
      } else {
        setScreenshotPath(apiUrl(data.image_url));
        setSelectedImagePaths([apiUrl(data.image_url)]);
        setSelectedImageUploadPaths([apiUrl(data.image_url)]);
        setSlideshowImageSettings(normalizeSlideshowSettingsClient([], 1));
      }
      setSocialImageUrl('');
      setRenderResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingSocialImage(false);
    }
  };

  const handleVideoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('video/')) {
      setError('Por favor, selecione um arquivo de vídeo válido');
      return;
    }

    setUploadingVideo(true);
    setError('');
    const channelId = libraryChannelId || safeStorageGet('alliance_forge_library_channel_id');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (channelId) {
        formData.append('channel_id', channelId);
      }

      const response = await fetch(apiUrl('/api/forge/upload-video'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const responseText = await response.text();
        let errorMessage = 'Erro ao fazer upload';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          if (response.status === 413) {
            errorMessage = 'Arquivo muito grande para o proxy da API. Aumente client_max_body_size no Nginx da VPS.';
          } else if (responseText.trim()) {
            errorMessage = responseText.trim();
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      alert(`✅ Vídeo enviado com sucesso!\nSalvo em: ${data.filename}`);

      loadLocalVideos(channelId);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingVideo(false);
      event.target.value = '';
    }
  };

  const handleAvatarVideoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Por favor, selecione uma imagem ou vídeo de avatar válido');
      return;
    }

    setUploadingAvatarVideo(true);
    setError('');
    const channelId = libraryChannelId || safeStorageGet('alliance_forge_library_channel_id');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (channelId) {
        formData.append('channel_id', channelId);
      }

      const response = await fetch(apiUrl('/api/forge/upload-avatar-video'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao fazer upload do avatar');
      }

      const data = await response.json();
      alert(`✅ Avatar enviado com sucesso!\nSalvo em: ${data.filename}`);
      setSelectedVideo({
        filename: data.filename,
        path: data.filepath,
        media_type: data.media_type || (file.type.startsWith('image/') ? 'image' : 'video'),
        url: apiUrl(data.video_url || `/api/forge/play-video/${data.filename}`),
        thumbnail: apiUrl(data.preview_url || ''),
        display_name: data.display_name || '',
        category: data.category || 'Geral',
      });
      loadAvatarVideos(channelId);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingAvatarVideo(false);
      event.target.value = '';
    }
  };

  const handleAudioUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setError('Por favor, selecione um arquivo de áudio válido');
      return;
    }

    setUploadingAudio(true);
    setError('');
    const channelId = libraryChannelId || safeStorageGet('alliance_forge_library_channel_id');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (channelId) {
        formData.append('channel_id', channelId);
      }

      const response = await fetch(apiUrl('/api/forge/upload-audio'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const responseText = await response.text();
        let errorMessage = 'Erro ao fazer upload do áudio';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          if (response.status === 413) {
            errorMessage = 'Arquivo muito grande para o proxy da API. Aumente client_max_body_size no Nginx da VPS.';
          } else if (responseText.trim()) {
            errorMessage = responseText.trim();
          }
        }
        throw new Error(errorMessage);
      }

      await response.json();
      loadLocalAudios(channelId);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingAudio(false);
      event.target.value = '';
    }
  };

  const handleDeleteVideo = async (filename) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Tem certeza que quer deletar este vídeo?\n${filename}`)) {
      return;
    }

    setDeletingVideoFile(filename);
    setError('');
    const channelId = selectedVideo?.channel_id || libraryChannelId || safeStorageGet('alliance_forge_library_channel_id');

    try {
      const response = await fetch(apiUrl('/api/forge/delete-video'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, channel_id: channelId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao deletar vídeo');
      }

      alert('✅ Vídeo deletado com sucesso!');

      // Se o vídeo deletado estava selecionado, desselecionar
      if (selectedVideo?.filename === filename) {
        setSelectedVideo(null);
      }

      // Recarregar lista de vídeos locais
      loadLocalVideos(channelId);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingVideoFile(null);
    }
  };

  const handleDeleteAvatarVideo = async (filename) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Tem certeza que quer deletar este avatar?\n${filename}`)) {
      return;
    }

    setDeletingAvatarFile(filename);
    setError('');
    const channelId = selectedVideo?.channel_id || libraryChannelId || safeStorageGet('alliance_forge_library_channel_id');

    try {
      const response = await fetch(apiUrl('/api/forge/delete-avatar-video'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, channel_id: channelId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao deletar avatar');
      }

      if (selectedVideo?.filename === filename) {
        setSelectedVideo(null);
      }

      loadAvatarVideos(channelId);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingAvatarFile(null);
    }
  };

  const handleDeleteAudio = async (filename) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Tem certeza que quer deletar este áudio?\n${filename}`)) {
      return;
    }

    setDeletingAudioFile(filename);
    setError('');
    const channelId = selectedAudio?.channel_id || libraryChannelId || safeStorageGet('alliance_forge_library_channel_id');

    try {
      const response = await fetch(apiUrl('/api/forge/delete-audio'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, channel_id: channelId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao deletar áudio');
      }

      if (selectedAudio?.filename === filename) {
        setSelectedAudio(null);
      }

      loadLocalAudios(channelId);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingAudioFile(null);
    }
  };

  const handleRatioChange = (value) => {
    const newTop = Math.min(100, Math.max(50, Number(value) || 70));
    const newBottom = 100 - newTop;

    ratioLockRef.current = { top: newTop, bottom: newBottom };
    setTopRatio(newTop);
    setBottomRatio(newBottom);
  };

  const applyLocalVideoFormat = (ratio) => {
    handleRatioChange(ratio);
  };

  const playLocalPreview = (event) => {
    event.currentTarget.play().catch(() => {});
  };

  const resetLocalPreview = (event) => {
    event.currentTarget.pause();
    event.currentTarget.currentTime = 0;
  };

  function shortVideoName(filename = '') {
    if (filename.length <= 26) return filename;
    return `${filename.slice(0, 12)}...${filename.slice(-10)}`;
  }

  function getLocalVideoDisplayName(videoOrFilename = '') {
    const filename = typeof videoOrFilename === 'string'
      ? videoOrFilename
      : (videoOrFilename?.filename || '');
    const customName = localVideoLabels[filename];
    return (customName || '').trim() || shortVideoName(filename);
  }

  function updateLocalVideoDisplayName(filename, value) {
    const nextName = value.trim();
    setLocalVideoLabels((current) => {
      const next = { ...current };
      if (nextName) {
        next[filename] = nextName.slice(0, 80);
      } else {
        delete next[filename];
      }
      return next;
    });
  }

  const videoSourcesByFilename = useMemo(() => {
    const map = new Map();
    [...avatarVideos, ...localVideos].forEach((video) => {
      if (video?.filename) {
        map.set(video.filename, getSelectedVideoSource(video));
      }
    });
    return map;
  }, [avatarVideos, localVideos, getSelectedVideoSource]);

  const clearSelectedVideo = useCallback(() => {
    setSelectedVideo(null);
  }, []);

  const avatarLibraryCards = useMemo(() => avatarVideos.map((video) => (
    <ForgeLibraryCard
      key={video.filename}
      video={video}
      selected={selectedVideo?.filename === video.filename}
      source={videoSourcesByFilename.get(video.filename) || ''}
      displayName={video.display_name || shortVideoName(video.filename)}
      mediaLabel={video.media_type === 'image' ? 'IMG' : `${video.duration.toFixed(1)}s`}
      ratioLabel={video.aspect_ratio === '9:16' ? '9:16' : 'OUTRO'}
      ratioClassName={video.aspect_ratio === '9:16' ? 'vertical' : 'other'}
      radioName="selected-avatar-video"
      previewKind={video.media_type === 'image' ? 'image' : 'video'}
      deleting={deletingAvatarFile === video.filename}
      onSelect={() => setSelectedVideo(video)}
      onClear={clearSelectedVideo}
      onDelete={() => handleDeleteAvatarVideo(video.filename)}
      playLocalPreview={playLocalPreview}
      resetLocalPreview={resetLocalPreview}
    />
  )), [avatarVideos, clearSelectedVideo, deletingAvatarFile, handleDeleteAvatarVideo, playLocalPreview, resetLocalPreview, selectedVideo?.filename, videoSourcesByFilename]);

  const localVideoCards = useMemo(() => localVideos.map((video) => (
    <ForgeLibraryCard
      key={video.filename}
      video={video}
      selected={selectedVideo?.filename === video.filename}
      source={videoSourcesByFilename.get(video.filename) || ''}
      displayName={getLocalVideoDisplayName(video)}
      mediaLabel={`${video.duration.toFixed(1)}s`}
      ratioLabel={video.aspect_ratio === '9:16' ? '9:16' : 'OUTRO'}
      ratioClassName={video.aspect_ratio === '9:16' ? 'vertical' : 'other'}
      radioName="selected-local-video"
      deleting={deletingVideoFile === video.filename}
      editable
      editing={editingLocalVideoName === video.filename}
      editingValue={localVideoLabels[video.filename] || ''}
      onSelect={() => setSelectedVideo(video)}
      onClear={clearSelectedVideo}
      onDelete={() => handleDeleteVideo(video.filename)}
      onStartEdit={() => setEditingLocalVideoName(video.filename)}
      onFinishEdit={() => setEditingLocalVideoName('')}
      onChangeEditValue={(value) => updateLocalVideoDisplayName(video.filename, value)}
      playLocalPreview={playLocalPreview}
      resetLocalPreview={resetLocalPreview}
    />
  )), [clearSelectedVideo, deletingVideoFile, editingLocalVideoName, getLocalVideoDisplayName, handleDeleteVideo, localVideoLabels, localVideos, playLocalPreview, resetLocalPreview, selectedVideo?.filename, videoSourcesByFilename]);

  const getUploadedImageName = () => {
    const renderSource = slideshowMode
      ? (selectedImageUploadPaths[0] || screenshotPath || '')
      : (screenshotPath || '');

    if (!renderSource) return '';
    return extractForgeUploadedFilename(renderSource) || renderSource;
  };

  const getUploadedImageNames = () => {
    const resolved = slideshowMode
      ? selectedImageUploadPaths
      : (screenshotPath ? [screenshotPath] : []);
    return resolved
      .map((path) => {
        if (!path) return '';
        return extractForgeUploadedFilename(path) || path;
      })
      .filter(Boolean);
  };

  const activePreviewImage = screenshotPath || selectedImagePaths[0] || '';
  const hasPreviewImage = Boolean(activePreviewImage);
  const hasSingleVideoPreview =
    !slideshowMode &&
    selectedVideo?.source_role === 'single_upload' &&
    selectedImagePaths.length === 0 &&
    selectedImageUploadPaths.length === 0;
  const slideshowPreviewSettings = normalizeSlideshowSettingsClient(slideshowImageSettings, selectedImagePaths.length);
  const selectedVideoSource = selectedVideo ? getSelectedVideoSource(selectedVideo) : '';
  const selectedVideoThumbnail = selectedVideo?.thumbnail || '';
  const selectedVideoMediaType = selectedVideo?.media_type || '';
  const availableSfxCount = (effectLibrary?.sound_effects || []).filter((item) => item.asset_present).length;

  const buildForgeEditPlan = () => ({
    enabled: effectsEnabled,
    mode: effectsMode,
    style_preset: effectsPreset,
    metadata_context: {
      headline_text: headlineText || '',
      layout_preset: layoutPreset,
      render_mode: slideshowMode ? 'slideshow' : 'single',
      image_paths: getUploadedImageNames(),
      background_video_name: selectedVideo?.display_name || selectedVideo?.title || selectedVideo?.filename || '',
      background_audio_name: selectedAudio?.display_name || selectedAudio?.title || selectedAudio?.filename || '',
    },
    transition_frequency: transitionFrequency,
    transitions: [],
    visual_effects: [],
    sound_effects: [],
    audio_ducking: {
      enabled: true,
      music_normal_volume: 0.45,
      music_speech_volume: 0.18,
      fade_in: 0.25,
      fade_out: 0.35,
      sensitivity: 0.5,
      max_sfx_volume: 0.3,
    },
  });

  const reorderSlideshowImage = (index, direction) => {
    setSelectedImagePaths((prev) => moveArrayItem(prev, index, index + direction));
    setSelectedImageUploadPaths((prev) => moveArrayItem(prev, index, index + direction));
    setSlideshowImageSettings((prev) => moveArrayItem(prev, index, index + direction));
  };

  const makeSlideshowFirstImage = (index) => {
    setSelectedImagePaths((prev) => moveArrayItem(prev, index, 0));
    setSelectedImageUploadPaths((prev) => moveArrayItem(prev, index, 0));
    setSlideshowImageSettings((prev) => moveArrayItem(prev, index, 0));
  };

  const updateSlideshowImageSetting = (index, patch) => {
    setSlideshowImageSettings((prev) => {
      const normalized = normalizeSlideshowSettingsClient(prev, Math.max(selectedImagePaths.length, index + 1));
      normalized[index] = {
        ...normalized[index],
        ...patch,
      };
      return normalized;
    });
  };

  const syncMainPreviewCropToFirstSlideshowImage = useCallback((patch = {}) => {
    if (!slideshowMode || !selectedImagePaths.length) return;
    setSlideshowImageSettings((prev) => {
      const normalized = normalizeSlideshowSettingsClient(prev, selectedImagePaths.length);
      normalized[0] = {
        ...normalized[0],
        fit: patch.fit || normalized[0].fit || imageFit,
        top_percent: patch.top_percent ?? normalized[0].top_percent ?? imageCropX,
        bottom_percent: patch.bottom_percent ?? normalized[0].bottom_percent ?? imageCropY,
      };
      return normalized;
    });
  }, [slideshowMode, selectedImagePaths.length, imageFit, imageCropX, imageCropY]);

  const applyFirstThumbnailCropToAll = useCallback(() => {
    if (!slideshowMode || !selectedImagePaths.length) return;
    setSlideshowImageSettings((prev) => {
      const normalized = normalizeSlideshowSettingsClient(prev, selectedImagePaths.length);
      if (!normalized.length) return normalized;
      const first = normalized[0];
      return normalized.map((item) => ({
        ...item,
        fit: first.fit,
        top_percent: first.top_percent,
        bottom_percent: first.bottom_percent,
      }));
    });
    setRenderResult(null);
  }, [slideshowMode, selectedImagePaths.length]);

  const applyMainPreviewCropToAll = useCallback(() => {
    if (!slideshowMode || !selectedImagePaths.length) return;
    const nextFit = imageFit === 'cover' ? 'cover' : 'contain';
    syncMainPreviewCropToFirstSlideshowImage({
      fit: nextFit,
      top_percent: imageCropX,
      bottom_percent: imageCropY,
    });
    setSlideshowImageSettings((prev) => {
      const normalized = normalizeSlideshowSettingsClient(prev, selectedImagePaths.length);
      return normalized.map((item) => ({
        ...item,
        fit: nextFit,
        top_percent: imageCropX,
        bottom_percent: imageCropY,
      }));
    });
    setRenderResult(null);
  }, [slideshowMode, selectedImagePaths.length, imageFit, imageCropX, imageCropY, syncMainPreviewCropToFirstSlideshowImage]);

  const removeSlideshowImageAt = (indexToRemove) => {
    setSelectedImagePaths((prev) => {
      const removed = prev[indexToRemove];
      if (typeof removed === 'string' && removed.startsWith('blob:')) {
        URL.revokeObjectURL(removed);
      }
      const next = prev.filter((_, index) => index !== indexToRemove);
      setScreenshotPath(next[0] || '');
      return next;
    });
    setSelectedImageUploadPaths((prev) => prev.filter((_, index) => index !== indexToRemove));
    setSlideshowImageSettings((prev) => prev.filter((_, index) => index !== indexToRemove));
    setRenderResult(null);
  };

  useEffect(() => {
    setSlideshowImageSettings((prev) => normalizeSlideshowSettingsClient(prev, selectedImagePaths.length));
  }, [selectedImagePaths.length]);

  const handleRender = async () => {
    if (!hasPreviewImage) {
      setError('Selecione uma screenshot da captura universal');
      return;
    }

    if (slideshowMode && getUploadedImageNames().length < 1) {
      setError('Selecione de 1 a 10 imagens para o modo sequência');
      return;
    }

    if (slideshowMode && slideshowStyle === 'mixed' && !selectedVideo) {
      setError('No modo misto, selecione um vídeo de fundo');
      return;
    }

    const renderUsesBackgroundVideo = Boolean(
      selectedVideo && (
        (slideshowMode && slideshowStyle === 'mixed')
        || (!slideshowMode && bottomRatio > 0)
        || (!slideshowMode && bottomRatio === 0)
      )
    );

    if (
      renderUsesBackgroundVideo
      && Number(selectedVideo?.duration || 0) > 0
      && !isVideoDurationWithinEditLimit(selectedVideo.duration)
    ) {
      setError(`O Forge aceita vídeo de fundo de até ${VIDEO_EDIT_MAX_DURATION_LABEL}. Escolha ou recorte um vídeo menor.`);
      return;
    }

    setRendering(true);
    setError('');
    setScheduleMessage('');

    const ratioSnapshot = {
      top: ratioLockRef.current.top ?? topRatio,
      bottom: ratioLockRef.current.bottom ?? bottomRatio,
    };

    try {
      // Extrair apenas o nome do arquivo
      const imagePath = getUploadedImageName();
      const imagePaths = getUploadedImageNames();
      const singleVideoMode = hasSingleVideoPreview;
      const usesHeadlineLayout = layoutPreset === 'classic7030' || slideshowMode || singleVideoMode;
      const resolvedHeadlinePosition = usesHeadlineLayout
        ? normalizeHeadlinePositionClient(slideshowHeadlinePosition, headlineText)
        : 'none';

      const renderPayload = {
        screenshot_path: imagePath,
        background_mode: 'local',
        background_video: selectedVideo?.path || selectedVideo?.filename || selectedVideo?.url || '',
        background_audio: selectedAudio?.filename || '',
        image_paths: slideshowMode ? imagePaths : [],
        top_ratio: topRatio / 100,
        bottom_ratio: bottomRatio / 100,
        render_mode: singleVideoMode
          ? 'single_video'
          : slideshowMode
          ? 'slideshow'
          : (bottomRatio === 0 && selectedVideo ? 'post_overlay' : (bottomRatio === 0 || !selectedVideo ? 'image_only' : 'stack')),
        layout_preset: layoutPreset,
        headline_text: headlineText,
        headline_ratio: usesHeadlineLayout ? headlineRatio / 100 : 0,
        headline_font_scale: headlineFontScale / 100,
        headline_palette: activeHeadlinePalette.id,
        slideshow_headline_position: resolvedHeadlinePosition,
        post_scale: postScale / 100,
        post_y: postY / 100,
        image_fit: imageFit,
        image_crop_x: 0.5,
        image_crop_y: verticalCenterPercent / 100,
        image_crop_top: topGuidePercent,
        image_crop_bottom: bottomGuidePercent,
        video_fit: videoFit,
        slideshow_seconds_per_image: 3,
        slideshow_intro_seconds: 1.5,
        slideshow_style: slideshowStyle,
        slideshow_image_settings: slideshowMode
          ? normalizeSlideshowSettingsClient(slideshowImageSettings, imagePaths.length)
          : [],
        edit_plan: buildForgeEditPlan()
      };

      const response = await fetch(apiUrl('/api/forge/render'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(renderPayload),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Erro ao renderizar'));
      }

      const data = await response.json();
      setRenderResult(data);
      // Economiza chamadas/uso de IA: renderizar nunca deve preencher metadados automaticamente.
      // Titulo, descricao e hashtags so entram quando o usuario clicar no botao de gerar.
      setMetadataTitle('');
      setMetadataDescription('');
      setMetadataHashtags('');
      setMetadataCategory(String(data.category_id || '22'));
      setMetadataPrivacyStatus(String(data.privacy_status || 'private'));
      setTopRatio(ratioSnapshot.top);
      setBottomRatio(ratioSnapshot.bottom);
      setScheduleDateTime(getDefaultScheduleDateTime());
      if (activeImageProductionItemId) {
        setImageProductionItems((current) => normalizeForge7030ImageTable(
          current.map((entry) => (
            entry.id === activeImageProductionItemId
              ? { ...entry, status: 'renderizado' }
              : entry
          ))
        ));
        setImageProductionMessage('Render concluído. Ao puxar o próximo post, a imagem renderizada sai da tabela automaticamente.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTopRatio(ratioSnapshot.top);
      setBottomRatio(ratioSnapshot.bottom);
      setRendering(false);
    }
  };

  const handleGenerateHeadline = async () => {
    if (!hasPreviewImage) {
      setError('Selecione uma imagem antes de gerar a headline');
      return;
    }

    const imagePath = getUploadedImageName();
    if (!imagePath) {
      setError('Imagem ainda não está pronta para gerar headline');
      return;
    }

    setGeneratingHeadline(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/forge/generate-headline'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          screenshot_path: imagePath,
          current_headline: headlineText,
          style: 'hook_cta'
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao gerar headline com ChatGPT');
      }

      setHeadlineText(data.headline || headlineText);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingHeadline(false);
    }
  };

  const handleGenerateAvatarSpeech = async () => {
    if (!hasPreviewImage) {
      setError('Selecione uma imagem antes de gerar a fala do avatar');
      return;
    }

    const imagePath = getUploadedImageName();
    if (!imagePath) {
      setError('Imagem ainda não está pronta para gerar fala do avatar');
      return;
    }

    setGeneratingAvatarSpeech(true);
    setError('');
    const channelId = libraryChannelId || safeStorageGet('alliance_forge_library_channel_id');

    try {
      const response = await fetch(apiUrl('/api/forge/avatar-generator/speech'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          screenshot_path: imagePath,
          headline_text: headlineText,
          current_script: avatarSpeechText,
          duration_model: avatarSpeechDurationModel,
          speech_style: avatarSpeechStyle,
          voice_profile: avatarVoiceProfile,
          channel_id: channelId,
          generate_voice: true
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao gerar fala do avatar');
      }

      setAvatarSpeechText(data.script || avatarSpeechText);
      setAvatarSpeechTimingNote(data.timing_note || '');
      if (data.speech_style) {
        setAvatarSpeechStyle(data.speech_style);
      }
      if (data.voice_profile) {
        setAvatarVoiceProfile(data.voice_profile);
      }
      if (data.audio_filename) {
        const nextAudio = {
          filename: data.audio_filename,
          channel_id: channelId || null,
          url: apiUrl(data.audio_url || `/api/forge/play-audio/${data.audio_filename}`),
        };
        setSelectedAudio(nextAudio);
        loadLocalAudios(channelId);
      }
      if (data.config) {
        setAvatarGeneratorStatus(data.config);
      }
      if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingAvatarSpeech(false);
    }
  };

  const updateAvatarEngineProvider = async (providerId, payload) => {
    setSavingAvatarEngineId(providerId);
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/forge/avatar-engine/providers/${providerId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao atualizar motor de avatar');
      }
      setAvatarEngineRegistry(data);
      loadAvatarGeneratorStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAvatarEngineId('');
    }
  };

  const handleDeleteAvatarEngineProvider = async (provider) => {
    const actionLabel = provider.custom ? 'excluir' : 'ocultar';
    if (!confirm(`Tem certeza que deseja ${actionLabel} o provedor ${provider.name}?`)) {
      return;
    }

    setSavingAvatarEngineId(provider.id);
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/forge/avatar-engine/providers/${provider.id}`), {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao remover provedor');
      }
      setAvatarEngineRegistry(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAvatarEngineId('');
    }
  };

  const handleRestoreAvatarEngineProvider = async (providerId) => {
    setSavingAvatarEngineId(providerId);
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/forge/avatar-engine/providers/${providerId}/restore`), {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao restaurar provedor');
      }
      setAvatarEngineRegistry(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAvatarEngineId('');
    }
  };

  const handleDiagnoseAvatarEngineProvider = async (providerId) => {
    setLoadingAvatarEngineDiagnosticsId(providerId);
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/forge/avatar-engine/providers/${providerId}/diagnostics`), {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao diagnosticar motor');
      }
      setAvatarEngineDiagnostics((current) => ({
        ...current,
        [providerId]: data,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAvatarEngineDiagnosticsId('');
    }
  };

  const handleApplyAvatarEnginePreset = async (provider, presetKey = 'vps') => {
    const preset = provider?.presets?.[presetKey];
    if (!preset) {
      setError('Preset não disponível para este motor');
      return;
    }

    await updateAvatarEngineProvider(provider.id, {
      install_path: preset.install_path || provider.install_path || '',
      python_bin: preset.python_bin || provider.python_bin || '',
      entry_script: preset.entry_script || provider.entry_script || '',
      model_path: preset.model_path || provider.model_path || '',
      config_path: preset.config_path || provider.config_path || '',
      notes: preset.notes || provider.notes || '',
    });

    setAvatarEngineDiagnostics((current) => {
      const next = { ...current };
      delete next[provider.id];
      return next;
    });
  };

  const handleCreateCustomAvatarProvider = async () => {
    if (!customAvatarProvider.name.trim()) {
      setError('Informe o nome do provedor customizado');
      return;
    }

    setSavingAvatarEngineId('custom');
    setError('');
    try {
      const response = await fetch(apiUrl('/api/forge/avatar-engine/providers/custom'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...customAvatarProvider,
          capabilities: ['custom', customAvatarProvider.kind],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao criar provedor customizado');
      }
      setAvatarEngineRegistry(data);
      setCustomAvatarProvider({
        name: '',
        repo_url: '',
        kind: 'avatar_video',
        summary: '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAvatarEngineId('');
    }
  };

  const handleBuildAvatarEnginePlan = async () => {
    if (!selectedVideo?.filename || !selectedAudio?.filename) {
      setError('Selecione um avatar e um áudio para montar o plano do motor');
      return;
    }

    setBuildingAvatarEnginePlan(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/forge/avatar-engine/render-plan'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_id: avatarEngineRegistry?.preferred_video_provider || '',
          avatar_filename: selectedVideo.filename,
          audio_filename: selectedAudio.filename,
          channel_id: libraryChannelId || safeStorageGet('alliance_forge_library_channel_id'),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao montar plano do motor');
      }
      setAvatarEnginePlan(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBuildingAvatarEnginePlan(false);
    }
  };

  const handleRunAvatarEngine = async () => {
    if (!selectedVideo?.filename || !selectedAudio?.filename) {
      setError('Selecione um avatar e um áudio antes de executar o motor');
      return;
    }
    if (selectedVideo?.media_type !== 'image') {
      setError('Para gerar o avatar falante, selecione uma imagem de avatar. O vídeo gerado será salvo depois na Biblioteca Avatar.');
      return;
    }

    setRunningAvatarEngine(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/forge/avatar-engine/render'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_id: avatarEngineRegistry?.preferred_video_provider || '',
          avatar_filename: selectedVideo.filename,
          audio_filename: selectedAudio.filename,
          channel_id: libraryChannelId || safeStorageGet('alliance_forge_library_channel_id'),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao executar motor de avatar');
      }
      setAvatarEngineRenderResult(data);

      setSavingAvatarEngineRender(true);
      const channelId = libraryChannelId || safeStorageGet('alliance_forge_library_channel_id');
      const saveResponse = await fetch(apiUrl('/api/forge/avatar-engine/save-to-library'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: data.job_id,
          filename: data.video_filename,
          channel_id: channelId,
          display_name: headlineText ? `Avatar Falando - ${headlineText.slice(0, 42)}` : 'Avatar Falando',
          category: 'Gerado',
        }),
      });
      const saveData = await saveResponse.json();
      if (!saveResponse.ok) {
        throw new Error(saveData.detail || 'O motor gerou o vídeo, mas falhou ao salvar na Biblioteca Avatar');
      }

      if (saveData?.video) {
        setSelectedVideo({
          ...saveData.video,
          url: apiUrl(saveData.video.video_url || `/api/forge/play-video/${saveData.video.filename}`),
          thumbnail: apiUrl(saveData.video.preview_url || `/api/forge/play-video/${saveData.video.filename}`),
        });
        await loadAvatarVideos(channelId);
        setBackgroundMode('avatar');
        setLayoutPreset('postHeadlineAvatar');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningAvatarEngine(false);
      setSavingAvatarEngineRender(false);
    }
  };

  useEffect(() => {
    if (!renderResult) return;
    const lockedTop = ratioLockRef.current.top;
    const lockedBottom = ratioLockRef.current.bottom;
    if (topRatio !== lockedTop) {
      setTopRatio(lockedTop);
    }
    if (bottomRatio !== lockedBottom) {
      setBottomRatio(lockedBottom);
    }
  }, [renderResult, topRatio, bottomRatio]);

  const handleGenerateMetadata = async () => {
    if (!renderResult) {
      setError('Renderize um vídeo antes de gerar os metadados');
      return;
    }

    const generateTitleOnly = metadataGenerateMode === 'title_only';
    const generateTitle = true;
    const generateDescription = !generateTitleOnly;
    const generateHashtags = !generateTitleOnly;

    setGeneratingMetadata(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/forge/generate-image-metadata'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          screenshot_path: getUploadedImageName(),
          image_paths: getUploadedImageNames(),
          headline_text: headlineText || '',
          video_id: renderResult.video_id || renderResult.id,
          platform: 'youtube_shorts',
          generate_title: generateTitle,
          generate_description: generateDescription,
          generate_hashtags: generateHashtags,
          extracted_text: renderResult.extracted_text || '',
          edit_plan: buildForgeEditPlan(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao gerar com ChatGPT');
      }

      const data = await response.json();
      setMetadataTitle(data.title || '');
      if (generateDescription) {
        setMetadataDescription(data.description || '');
      }
      if (generateHashtags) {
        setMetadataHashtags((data.hashtags || []).join(' '));
      }
      setMetadataCategory(String(data.category_id || '22'));
      setMetadataPrivacyStatus('private');
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingMetadata(false);
    }
  };

  const parseHashtags = (value) => {
    return value
      .split(/[\s,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  };

  const handleCropImage = async () => {
    const imagePath = getUploadedImageName();
    if (!imagePath) {
      setError('Selecione uma imagem antes de cortar');
      return;
    }

    setCroppingImage(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/forge/crop-image'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          screenshot_path: imagePath,
          top_percent: topGuidePercent,
          bottom_percent: bottomGuidePercent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao cortar imagem');
      }

      const data = await response.json();
      const nextImageUrl = apiUrl(data.image_url);
      // A API devolve uma nova imagem ja recortada. Zerar as guias evita
      // aplicar o mesmo corte novamente durante a renderizacao final.
      setImageFit('contain');
      setImageCropX(0);
      setImageCropY(0);
      setRenderResult(null);
      syncMainPreviewCropToFirstSlideshowImage({
        fit: 'contain',
        top_percent: 0,
        bottom_percent: 0,
      });
      setScreenshotPath(nextImageUrl);
      setSelectedImagePaths((prev) => {
        if (!prev.length) return [nextImageUrl];
        const next = [...prev];
        next[0] = nextImageUrl;
        return next;
      });
      setSelectedImageUploadPaths((prev) => {
        if (!prev.length) return [nextImageUrl];
        const next = [...prev];
        next[0] = nextImageUrl;
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCroppingImage(false);
    }
  };

  const normalizePrimaryHashtags = (value) => {
    return parseHashtags(value).slice(0, 3);
  };

  const handlePublishYouTube = async () => {
    if (!renderResult) {
      setError('Primeiro renderize um vídeo');
      return;
    }

    if (!metadataTitle.trim() || !metadataDescription.trim()) {
      setError('Preencha ou gere o título e a descrição antes de publicar');
      return;
    }

    setPublishing(true);
    setError('');
    try {
      const uploadPayload = {
        video_path: renderResult.local_path || renderResult.filename || renderResult.output_path,
        title: metadataTitle.trim(),
        description: metadataDescription.trim(),
        hashtags: normalizePrimaryHashtags(metadataHashtags),
        category_id: metadataCategory,
        privacy_status: metadataPrivacyStatus
      };

      const response = await fetch(apiUrl('/api/youtube/upload'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao publicar');
      }

      const data = await response.json();
      alert(`✅ Publicado com sucesso!\n\nURL: ${data.short_url}`);
      clearForgeDraft();
      setRenderResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleScheduleVideo = async () => {
    if (!renderResult) {
      setError('Primeiro renderize um vídeo');
      return;
    }

    if (!metadataTitle.trim()) {
      setError('Preencha ou gere o título antes de programar');
      return;
    }

    if (!scheduleDateTime) {
      setError('Escolha a data e a hora da postagem');
      return;
    }

    setScheduling(true);
    setError('');
    setScheduleMessage('');

    try {
      const response = await fetch(apiUrl('/api/schedule/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: renderResult.video_id || renderResult.id,
          filename: renderResult.filename || '',
          output_path: renderResult.output_path || '',
          local_path: renderResult.local_path || '',
          title: metadataTitle.trim(),
          description: metadataDescription.trim(),
          hashtags: normalizePrimaryHashtags(metadataHashtags),
          category_id: metadataCategory,
          privacy_status: metadataPrivacyStatus,
          scheduled_at: scheduleDateTime,
          platform: 'youtube',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao programar vídeo');
      }

      const data = await response.json();
      setScheduleMessage(`Programado para ${new Date(data.item.scheduled_at).toLocaleString('pt-BR')}`);
      clearForgeDraft();
    } catch (err) {
      setError(err.message);
    } finally {
      setScheduling(false);
    }
  };

  const visibleAvatarProviders = (avatarEngineRegistry?.providers || []).filter((provider) => !provider.hidden);
  const hiddenAvatarProviders = (avatarEngineRegistry?.providers || []).filter((provider) => provider.hidden);
  const preferredAvatarVideoProvider = (avatarEngineRegistry?.providers || []).find(
    (provider) => provider.id === avatarEngineRegistry?.preferred_video_provider
  );
  const preferredAvatarVoiceProvider = (avatarEngineRegistry?.providers || []).find(
    (provider) => provider.id === avatarEngineRegistry?.preferred_voice_provider
  );

  return (
    <div className="forge-editor-container">
      <div className="forge-header">
        <h1>🔨 The Forge 70/30</h1>
        <p>Renderizador de Vídeos Vertical com IA e Controle Avançado</p>
      </div>

      <div className="forge-grid">
        {/* Coluna 1: Controles */}
        <div className="forge-controls">
          <div className={`control-section forge7030-production-panel ${imageProductionCollapsed ? 'collapsed' : ''}`}>
            <div className="forge7030-production-header">
              <div>
                <h3>🗂️ Tabela de produção 70/30</h3>
                <span>{normalizedImageProductionItems.length}/60 imagens prontas para produção</span>
              </div>
              <div className="forge7030-production-actions">
                <label className={`forge7030-upload-button ${uploadingImageProduction ? 'disabled' : ''}`}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageProductionUpload}
                    disabled={uploadingImageProduction || normalizedImageProductionItems.length >= 60}
                  />
                  {uploadingImageProduction ? (
                    <>
                      <Loader size={14} className="spinner" />
                      Enviando
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Adicionar imagens
                    </>
                  )}
                </label>
                <button
                  type="button"
                  className="forge7030-collapse-button"
                  onClick={() => setImageProductionCollapsed((current) => !current)}
                >
                  {imageProductionCollapsed ? 'Abrir' : 'Minimizar'}
                </button>
              </div>
            </div>

            {!imageProductionCollapsed && (
              <div className="forge7030-production-body">
                {imageProductionMessage && (
                  <div className="forge7030-production-message">{imageProductionMessage}</div>
                )}
                {normalizedImageProductionItems.length === 0 ? (
                  <div className="forge7030-production-empty">
                    <Upload size={22} />
                    <span>Adicione até 60 imagens de uma vez. A tabela só prepara a fila; a renderização continua igual.</span>
                  </div>
                ) : (
                  <div className="forge7030-production-grid">
                    {normalizedImageProductionItems.map((item) => (
                      <div key={item.id} className={`forge7030-production-card status-${item.status}`}>
                        <button
                          type="button"
                          className="forge7030-production-delete"
                          onClick={() => deleteImageProductionItem(item.id)}
                          title="Excluir imagem da tabela"
                          aria-label={`Excluir imagem ${item.slot}`}
                        >
                          <X size={12} />
                        </button>
                        <div className="forge7030-production-thumb">
                          <img src={item.image_url} alt={`Imagem ${item.slot}`} />
                          <span>{item.slot}/60</span>
                        </div>
                        <label>
                          Headline
                          <select
                            value={item.headline_palette}
                            onChange={(event) => updateImageProductionItem(item.id, { headline_palette: event.target.value })}
                          >
                            {headlinePalettes.map((palette) => (
                              <option key={palette.id} value={palette.id}>{palette.label}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Vídeo base
                          <select
                            value={item.video_filename}
                            onChange={(event) => updateImageProductionItem(item.id, { video_filename: event.target.value })}
                          >
                            <option value="">Manter atual</option>
                            {localVideos.map((video) => (
                              <option key={video.filename} value={video.filename}>{getLocalVideoDisplayName(video)}</option>
                            ))}
                          </select>
                        </label>
                        <div className="forge7030-production-card-footer">
                          <span>{item.status === 'em_edicao' ? 'Em edição' : item.status === 'renderizado' ? 'Renderizado' : 'Pendente'}</span>
                          <button type="button" onClick={() => pullImageProductionItem(item)}>
                            Usar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 1: Screenshot Upload */}
          <div className="control-section upload-section-full">
            <div className="forge7030-section-title-row">
              <h3>📸 Imagem da Biblioteca</h3>
              <button
                type="button"
                className="forge7030-pull-table-button"
                onClick={() => pullImageProductionItem()}
                disabled={!nextImageProductionItem}
              >
                Puxar da Tabela {nextImageProductionSlot}/60
              </button>
            </div>

            <div className="mode-toggle media-mode-toggle">
              <button
                type="button"
                onClick={() => {
                  setSlideshowMode(false);
                  setSlideshowStyle('pure');
                  setSelectedImagePaths((prev) => prev.slice(0, 1));
                  setSelectedImageUploadPaths((prev) => prev.slice(0, 1));
                  setSlideshowImageSettings((prev) => normalizeSlideshowSettingsClient(prev, 1));
                }}
                className={`mode-button ${!slideshowMode ? 'active' : ''}`}
              >
                <span className="icon">🖼️</span>
                Mídia única
              </button>
              <button
                type="button"
                onClick={() => {
                  setSlideshowMode(true);
                  setSlideshowStyle((current) => current || 'pure');
                }}
                className={`mode-button ${slideshowMode ? 'active' : ''}`}
              >
                <span className="icon">🎞️</span>
                Sequência até 10 imagens
              </button>
            </div>

            {slideshowMode && (
              <div className="mode-toggle media-mode-toggle">
                <button
                  type="button"
                  onClick={() => setSlideshowStyle('pure')}
                  className={`mode-button ${slideshowStyle === 'pure' ? 'active' : ''}`}
                >
                  <span className="icon">🖼️</span>
                  Slideshow puro
                </button>
                <button
                  type="button"
                  onClick={() => setSlideshowStyle('mixed')}
                  className={`mode-button ${slideshowStyle === 'mixed' ? 'active' : ''}`}
                >
                  <span className="icon">🎬</span>
                  Imagem sobre o vídeo
                </button>
              </div>
            )}

            <div className="social-image-import">
              <div className="social-image-input">
                <Link size={16} />
                <input
                  type="url"
                  placeholder="Cole o link: YouTube, Instagram, TikTok, Pinterest, Facebook..."
                  value={socialImageUrl}
                  onChange={(e) => setSocialImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDownloadSocialImage();
                    }
                  }}
                  disabled={downloadingSocialImage}
                />
              </div>
              <button
                type="button"
                onClick={handleDownloadSocialImage}
                disabled={downloadingSocialImage || !socialImageUrl.trim()}
                className="social-image-button"
              >
                {downloadingSocialImage ? (
                  <>
                    <Loader size={15} className="spinner" />
                    Baixando
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    {slideshowMode ? 'Baixar carrossel' : 'Baixar imagem'}
                  </>
                )}
              </button>
            </div>

            {!hasPreviewImage ? (
              <div className="upload-section">
                <label className="upload-label">
                  <input
                    type="file"
                    accept={slideshowMode ? 'image/*' : 'image/*,video/*'}
                    multiple={slideshowMode}
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="file-input"
                  />
                  <div className="upload-box">
                    {uploadingImage ? (
                      <>
                        <Loader size={32} className="spinner" />
                        <p>{slideshowMode ? 'Enviando imagens...' : 'Enviando mídia...'}</p>
                        <span className="upload-hint">Por favor aguarde</span>
                      </>
                    ) : (
                      <>
                        <Upload size={32} />
                        <p>Clique para selecionar {slideshowMode ? 'de 1 a 10 imagens' : 'imagem ou vídeo'}</p>
                        <span className="upload-hint">
                          {slideshowMode ? 'Uma imagem já funciona. Use vídeo no modo misto quando quiser.' : 'JPG, PNG, MP4, MOV e similares'}
                        </span>
                      </>
                    )}
                  </div>
                </label>
              </div>
            ) : (
              <div className="image-preview-container">
                <div className="screenshot-preview-large">
                  {hasSingleVideoPreview ? (
                    <video src={getSelectedVideoSource(selectedVideo)} controls className="rendered-video" style={{ width: '100%', aspectRatio: '9/16', objectFit: 'contain' }} />
                  ) : hasPreviewImage ? (
                    <img src={activePreviewImage} alt="Preview da imagem" />
                  ) : (
                    <div className="preview-empty">
                      <p>Selecione uma imagem ou vídeo para visualizar</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    selectedImagePaths.forEach((path) => {
                      if (typeof path === 'string' && path.startsWith('blob:')) {
                        URL.revokeObjectURL(path);
                      }
                    });
                    setScreenshotPath('');
                    setSelectedImagePaths([]);
                    setSelectedImageUploadPaths([]);
                    setSlideshowImageSettings([]);
                    setSelectedVideo(null);
                  }}
                  className="remove-button-simple"
                >
                  <X size={14} />
                  Trocar
                </button>
              </div>
            )}

            {slideshowMode && selectedImagePaths.length > 0 && (
              <div className="slideshow-preview-strip">
                {selectedImagePaths.map((path, index) => (
                  <div key={`${path}-${index}`} className="slideshow-preview-item">
                    <div className="slideshow-preview-media">
                      <button
                        type="button"
                        className="slideshow-delete-button"
                        onClick={() => removeSlideshowImageAt(index)}
                        title="Excluir imagem"
                        aria-label={`Excluir imagem ${index + 1}`}
                      >
                        <X size={11} />
                      </button>
                      <img
                        src={path}
                        alt={`Slide ${index + 1}`}
                        style={{
                          objectFit: slideshowPreviewSettings[index]?.fit === 'cover' ? 'cover' : 'contain',
                          objectPosition: slideshowPreviewSettings[index]?.fit === 'cover'
                            ? getSlideshowObjectPosition(slideshowPreviewSettings[index])
                            : '50% 50%',
                        }}
                      />
                    </div>
                    <span>{index + 1}</span>
                    <div className="slideshow-order-actions">
                      <button
                        type="button"
                        className="slideshow-order-button"
                        onClick={() => makeSlideshowFirstImage(index)}
                        title="Definir como primeira"
                        aria-label={`Definir imagem ${index + 1} como primeira`}
                      >
                        1º
                      </button>
                      <button
                        type="button"
                        className="slideshow-order-button"
                        onClick={() => reorderSlideshowImage(index, -1)}
                        title="Mover para cima"
                        aria-label={`Mover imagem ${index + 1} para cima`}
                        disabled={index === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="slideshow-order-button"
                        onClick={() => reorderSlideshowImage(index, 1)}
                        title="Mover para baixo"
                        aria-label={`Mover imagem ${index + 1} para baixo`}
                        disabled={index === selectedImagePaths.length - 1}
                      >
                        ↓
                      </button>
                    </div>
                    <div className="slideshow-preview-controls">
                      <div className="slideshow-fit-toggle">
                        <button
                          type="button"
                          className={`slideshow-fit-button ${slideshowPreviewSettings[index]?.fit !== 'cover' ? 'active' : ''}`}
                          onClick={() => updateSlideshowImageSetting(index, { fit: 'contain' })}
                        >
                          Inteira
                        </button>
                        <button
                          type="button"
                          className={`slideshow-fit-button ${slideshowPreviewSettings[index]?.fit === 'cover' ? 'active' : ''}`}
                          onClick={() => updateSlideshowImageSetting(index, { fit: 'cover' })}
                        >
                          Corte
                        </button>
                      </div>
                      {index === 0 && (
                        <button
                          type="button"
                          className="slideshow-apply-all-button"
                          onClick={applyFirstThumbnailCropToAll}
                        >
                          Replicar 1ª em todas
                        </button>
                      )}
                      {slideshowPreviewSettings[index]?.fit === 'cover' && (
                        <div className="slideshow-crop-controls">
                          <label>
                            Topo
                            <input
                              type="range"
                              min="0"
                              max="40"
                              value={slideshowPreviewSettings[index]?.top_percent ?? 10}
                              onChange={(e) => updateSlideshowImageSetting(index, { top_percent: Number(e.target.value) })}
                            />
                          </label>
                          <label>
                            Base
                            <input
                              type="range"
                              min="0"
                              max="40"
                              value={slideshowPreviewSettings[index]?.bottom_percent ?? 10}
                              onChange={(e) => updateSlideshowImageSetting(index, { bottom_percent: Number(e.target.value) })}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="control-section">
            <h3>🎛️ Formato do Vídeo</h3>
            <div className="mode-toggle forge-layout-toggle">
              <button
                type="button"
                onClick={applyLayoutPreset}
                className="mode-button active"
              >
                <span className="icon">▥</span>
                70/30 Clássico + Headline
              </button>
            </div>

            {(layoutPreset === 'classic7030' || slideshowMode) && (
              <div className="headline-preset-panel">
                <label>
                  {slideshowMode ? 'Headline do carrossel' : 'Headline do 70/30'}
                  <input
                    type="text"
                    value={headlineText}
                    onChange={(event) => setHeadlineText(event.target.value)}
                    placeholder="Ex: Sua Esperança Renasce"
                    maxLength={58}
                    className="input-field"
                  />
                </label>
                <button
                  type="button"
                  className="headline-generate-button"
                  onClick={handleGenerateHeadline}
                  disabled={generatingHeadline || !hasPreviewImage}
                >
                  {generatingHeadline ? (
                    <>
                      <Loader size={15} className="spinner" />
                      Gerando com ChatGPT
                    </>
                  ) : (
                    <>
                      <Search size={15} />
                      Gerar hook + CTA com ChatGPT
                    </>
                  )}
                </button>
                <div className="headline-adjust-grid">
                  <label>
                    Altura da headline {headlineRatio}%
                    <div className="range-control">
                      <input
                        type="range"
                        min="6"
                        max="20"
                        step="1"
                        value={headlineRatio}
                        onInput={(event) => applyClassicHeadlineRatio(event.target.value)}
                        onChange={(event) => applyClassicHeadlineRatio(event.target.value)}
                        className="slider"
                        aria-label="Ajustar altura da headline"
                      />
                    </div>
                  </label>

                  <label>
                    Tamanho da fonte {headlineFontScale}%
                    <div className="range-control">
                      <input
                        type="range"
                        min="70"
                        max="130"
                        step="5"
                        value={headlineFontScale}
                        onInput={(event) => setHeadlineFontScale(parseInt(event.target.value, 10))}
                        onChange={(event) => setHeadlineFontScale(parseInt(event.target.value, 10))}
                        className="slider"
                        aria-label="Ajustar tamanho da fonte da headline"
                      />
                    </div>
                  </label>

                  {(slideshowMode || layoutPreset === 'classic7030') && (
                    <label>
                      Posição da headline
                      <select
                        value={slideshowHeadlinePosition}
                        onChange={(event) => setSlideshowHeadlinePosition(event.target.value)}
                        className="input-field"
                      >
                        <option value="none">Sem headline</option>
                        <option value="top">Topo</option>
                        <option value="middle">Meio</option>
                        <option value="bottom">Embaixo</option>
                      </select>
                    </label>
                  )}
                </div>

                <div className="headline-palette-grid" role="group" aria-label="Modelos da headline">
                  {headlinePalettes.map((palette) => (
                    <button
                      key={palette.id}
                      type="button"
                      className={`headline-palette-button ${palette.className} ${activeHeadlinePalette.id === palette.id ? 'active' : ''}`}
                      onClick={() => setHeadlinePalette(palette.id)}
                    >
                      <div className="headline-palette-preview">
                        <ForgeHeadlineBand
                          styleId={palette.className}
                          text={palette.sampleText}
                          compact
                        />
                      </div>
                      <span className="headline-palette-label">{palette.label}</span>
                    </button>
                  ))}
                </div>
                {false && (
                  <>
                <div className={`avatar-speech-panel collapsible-avatar-panel ${avatarSpeechCollapsed ? 'collapsed' : ''}`}>
                  <div className="avatar-speech-header">
                    <strong>Fala do avatar</strong>
                    <div className="avatar-panel-header-actions">
                      <span className={avatarGeneratorStatus?.configured ? 'status-ok' : 'status-warn'}>
                        {avatarGeneratorStatus?.configured ? 'Gerador local conectado' : 'Gerador local offline'}
                      </span>
                      <button
                        type="button"
                        className="avatar-collapse-button"
                        onClick={() => setAvatarSpeechCollapsed((current) => !current)}
                      >
                        {avatarSpeechCollapsed ? 'Abrir' : 'Minimizar'}
                      </button>
                    </div>
                  </div>
                  {avatarSpeechCollapsed ? (
                    <small className="avatar-collapsed-summary">
                      Fala, duração e voz do avatar estão minimizadas.
                    </small>
                  ) : (
                    <>
                  <div className="avatar-speech-duration-grid">
                    <button
                      type="button"
                      className={`avatar-speech-duration-button ${avatarSpeechDurationModel === '6s' ? 'active' : ''}`}
                      onClick={() => setAvatarSpeechDurationModel('6s')}
                    >
                      6 segundos
                    </button>
                    <button
                      type="button"
                      className={`avatar-speech-duration-button ${avatarSpeechDurationModel === '10s' ? 'active' : ''}`}
                      onClick={() => setAvatarSpeechDurationModel('10s')}
                    >
                      10 segundos
                    </button>
                    <button
                      type="button"
                      className={`avatar-speech-duration-button ${avatarSpeechDurationModel === '15s' ? 'active' : ''}`}
                      onClick={() => setAvatarSpeechDurationModel('15s')}
                    >
                      15 segundos
                    </button>
                    <button
                      type="button"
                      className={`avatar-speech-duration-button ${avatarSpeechDurationModel === '30s' ? 'active' : ''}`}
                      onClick={() => setAvatarSpeechDurationModel('30s')}
                    >
                      30 segundos
                    </button>
                    <button
                      type="button"
                      className={`avatar-speech-duration-button ${avatarSpeechDurationModel === '60s' ? 'active' : ''}`}
                      onClick={() => setAvatarSpeechDurationModel('60s')}
                    >
                      60 segundos
                    </button>
                  </div>
                  <div className="avatar-speech-select-grid">
                    <label>
                      Estilo da fala
                      <select
                        value={avatarSpeechStyle}
                        onChange={(event) => setAvatarSpeechStyle(event.target.value)}
                      >
                        {availableAvatarSpeechStyles.length > 0 ? availableAvatarSpeechStyles.map((style) => (
                          <option key={style.id} value={style.id}>{style.label}</option>
                        )) : (
                          <option value="humor_bizarro">Humor bizarro</option>
                        )}
                      </select>
                    </label>
                    <label>
                      Voz
                      <select
                        value={avatarVoiceProfile}
                        onChange={(event) => setAvatarVoiceProfile(event.target.value)}
                      >
                        {availableAvatarVoiceProfiles.length > 0 ? availableAvatarVoiceProfiles.map((voice) => (
                          <option key={voice.id} value={voice.id}>{voice.label}</option>
                        )) : (
                          <option value="">Voz atual do servidor</option>
                        )}
                      </select>
                    </label>
                  </div>
                  <textarea
                    value={avatarSpeechText}
                    onChange={(event) => setAvatarSpeechText(event.target.value)}
                    placeholder="A fala do avatar aparece aqui. Você pode gerar com LM Studio/Piper ou escrever manualmente."
                    rows={4}
                  />
                  {avatarSpeechTimingNote && (
                    <div className="avatar-speech-timing-note">{avatarSpeechTimingNote}</div>
                  )}
                  {activeAvatarVoiceProfile && (
                    <small>
                      Voz ativa: {activeAvatarVoiceProfile.label} ({activeAvatarVoiceProfile.provider}).
                    </small>
                  )}
                  <button
                    type="button"
                    className="headline-generate-button"
                    onClick={handleGenerateAvatarSpeech}
                    disabled={generatingAvatarSpeech || !hasPreviewImage}
                  >
                    {generatingAvatarSpeech ? (
                      <>
                        <Loader size={14} className="spinner" />
                        Gerando fala e voz...
                      </>
                    ) : (
                      'Gerar fala + voz do avatar'
                    )}
                  </button>
                  <small>
                    Cada modo controla o tamanho da fala para reduzir corte e repetição. O áudio gerado fica selecionado na Biblioteca de Áudios.
                  </small>
                    </>
                  )}
                </div>
                <div className={`avatar-engine-panel collapsible-avatar-panel ${avatarEngineCollapsed ? 'collapsed' : ''}`}>
                  <div className="avatar-engine-panel-header">
                    <div>
                      <strong>Avatar Engine</strong>
                      <p>Catálogo isolado com 10 opções grátis e espaço para novos motores.</p>
                    </div>
                    <div className="avatar-panel-header-actions">
                      {!avatarEngineCollapsed && (
                        <button
                          type="button"
                          className="headline-generate-button secondary"
                          onClick={loadAvatarEngineRegistry}
                          disabled={loadingAvatarEngineRegistry}
                        >
                          {loadingAvatarEngineRegistry ? <><Loader size={14} className="spinner" />Atualizando...</> : 'Atualizar catálogo'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="avatar-collapse-button"
                        onClick={() => setAvatarEngineCollapsed((current) => !current)}
                      >
                        {avatarEngineCollapsed ? 'Abrir' : 'Minimizar'}
                      </button>
                    </div>
                  </div>

                  {avatarEngineCollapsed ? (
                    <small className="avatar-collapsed-summary">
                      Motores de avatar, diagnóstico e provedores estão minimizados.
                    </small>
                  ) : (
                    <>
                  <div className="avatar-engine-summary">
                    <span>Vídeo preferido: <strong>{preferredAvatarVideoProvider?.name || 'nenhum'}</strong></span>
                    <span>Voz preferida: <strong>{preferredAvatarVoiceProvider?.name || 'nenhuma'}</strong></span>
                    <span>Roteiro atual: <strong>{avatarGeneratorStatus?.active_script_provider || 'fallback'}</strong></span>
                  </div>

                  <div className="avatar-engine-grid">
                    {visibleAvatarProviders.map((provider) => (
                      <div key={provider.id} className={`avatar-engine-card ${provider.preferred_video || provider.preferred_voice ? 'preferred' : ''}`}>
                        <div className="avatar-engine-card-top">
                          <div>
                            <h4>{provider.name}</h4>
                            <p>{provider.summary}</p>
                          </div>
                          <span className={`avatar-engine-status ${provider.installed ? 'ready' : 'pending'}`}>
                            {provider.installed ? 'Pronto' : 'Pendente'}
                          </span>
                        </div>

                        <div className="avatar-engine-badges">
                          <span>{provider.kind}</span>
                          <span>{provider.runtime}</span>
                          <span>{provider.difficulty}</span>
                        </div>

                        <div className="avatar-engine-capabilities">
                          {(provider.capabilities || []).slice(0, 4).map((capability) => (
                            <small key={`${provider.id}-${capability}`}>{capability}</small>
                          ))}
                        </div>

                        <div className="avatar-engine-paths">
                          <input
                            type="text"
                            value={provider.install_path || ''}
                            onChange={(event) => {
                              const nextProviders = (avatarEngineRegistry?.providers || []).map((item) => (
                                item.id === provider.id ? { ...item, install_path: event.target.value } : item
                              ));
                              setAvatarEngineRegistry((current) => current ? { ...current, providers: nextProviders } : current);
                            }}
                            placeholder="Pasta de instalação (opcional)"
                          />
                          <input
                            type="text"
                            value={provider.python_bin || ''}
                            onChange={(event) => {
                              const nextProviders = (avatarEngineRegistry?.providers || []).map((item) => (
                                item.id === provider.id ? { ...item, python_bin: event.target.value } : item
                              ));
                              setAvatarEngineRegistry((current) => current ? { ...current, providers: nextProviders } : current);
                            }}
                            placeholder="Python / venv do motor"
                          />
                          <input
                            type="text"
                            value={provider.entry_script || ''}
                            onChange={(event) => {
                              const nextProviders = (avatarEngineRegistry?.providers || []).map((item) => (
                                item.id === provider.id ? { ...item, entry_script: event.target.value } : item
                              ));
                              setAvatarEngineRegistry((current) => current ? { ...current, providers: nextProviders } : current);
                            }}
                            placeholder="Script de entrada / API local"
                          />
                          <input
                            type="text"
                            value={provider.model_path || ''}
                            onChange={(event) => {
                              const nextProviders = (avatarEngineRegistry?.providers || []).map((item) => (
                                item.id === provider.id ? { ...item, model_path: event.target.value } : item
                              ));
                              setAvatarEngineRegistry((current) => current ? { ...current, providers: nextProviders } : current);
                            }}
                            placeholder="Modelo / checkpoint (quando houver)"
                          />
                          <input
                            type="text"
                            value={provider.config_path || ''}
                            onChange={(event) => {
                              const nextProviders = (avatarEngineRegistry?.providers || []).map((item) => (
                                item.id === provider.id ? { ...item, config_path: event.target.value } : item
                              ));
                              setAvatarEngineRegistry((current) => current ? { ...current, providers: nextProviders } : current);
                            }}
                            placeholder="Arquivo .json / config (quando houver)"
                          />
                        </div>

                        <div className="avatar-engine-actions">
                          <button
                            type="button"
                            className="engine-action-button"
                            onClick={() => updateAvatarEngineProvider(provider.id, {
                              install_path: provider.install_path || '',
                              python_bin: provider.python_bin || '',
                              entry_script: provider.entry_script || '',
                              model_path: provider.model_path || '',
                              config_path: provider.config_path || '',
                            })}
                            disabled={savingAvatarEngineId === provider.id}
                          >
                            Salvar
                          </button>
                          {provider.presets?.vps && (
                            <button
                              type="button"
                              className="engine-action-button"
                              onClick={() => handleApplyAvatarEnginePreset(provider, 'vps')}
                              disabled={savingAvatarEngineId === provider.id}
                            >
                              {provider.presets.vps.label || 'Preset VPS'}
                            </button>
                          )}
                          <button
                            type="button"
                            className={`engine-action-button ${provider.enabled ? 'active' : ''}`}
                            onClick={() => updateAvatarEngineProvider(provider.id, {
                              enabled: !provider.enabled,
                              install_path: provider.install_path || '',
                              python_bin: provider.python_bin || '',
                              entry_script: provider.entry_script || '',
                              model_path: provider.model_path || '',
                              config_path: provider.config_path || '',
                            })}
                            disabled={savingAvatarEngineId === provider.id}
                          >
                            {provider.enabled ? 'Desativar' : 'Ativar'}
                          </button>
                          {provider.supports_video_selection && (
                            <button
                              type="button"
                            className={`engine-action-button ${provider.preferred_video ? 'active' : ''}`}
                            onClick={() => updateAvatarEngineProvider(provider.id, {
                              set_as_preferred_video: true,
                              install_path: provider.install_path || '',
                              python_bin: provider.python_bin || '',
                              entry_script: provider.entry_script || '',
                              model_path: provider.model_path || '',
                              config_path: provider.config_path || '',
                            })}
                            disabled={savingAvatarEngineId === provider.id}
                          >
                              {provider.preferred_video ? 'Vídeo principal' : 'Usar no vídeo'}
                            </button>
                          )}
                          {provider.supports_voice_selection && (
                            <button
                              type="button"
                            className={`engine-action-button ${provider.preferred_voice ? 'active' : ''}`}
                            onClick={() => updateAvatarEngineProvider(provider.id, {
                              set_as_preferred_voice: true,
                              install_path: provider.install_path || '',
                              python_bin: provider.python_bin || '',
                              entry_script: provider.entry_script || '',
                              model_path: provider.model_path || '',
                              config_path: provider.config_path || '',
                            })}
                            disabled={savingAvatarEngineId === provider.id}
                          >
                              {provider.preferred_voice ? 'Voz principal' : 'Usar na voz'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="engine-action-button"
                            onClick={() => handleDiagnoseAvatarEngineProvider(provider.id)}
                            disabled={loadingAvatarEngineDiagnosticsId === provider.id}
                          >
                            {loadingAvatarEngineDiagnosticsId === provider.id ? 'Verificando...' : 'Diagnosticar'}
                          </button>
                          <button
                            type="button"
                            className="engine-action-button"
                            onClick={() => window.open(provider.repo_url, '_blank', 'noopener,noreferrer')}
                          >
                            <Link size={14} />
                            Repositório
                          </button>
                          <button
                            type="button"
                            className="engine-action-button danger"
                            onClick={() => handleDeleteAvatarEngineProvider(provider)}
                            disabled={savingAvatarEngineId === provider.id}
                          >
                            {provider.custom ? 'Excluir' : 'Ocultar'}
                          </button>
                        </div>

                        {avatarEngineDiagnostics[provider.id] && (
                          <div className={`avatar-engine-diagnostic ${avatarEngineDiagnostics[provider.id].ready ? 'ready' : 'pending'}`}>
                            <strong>{avatarEngineDiagnostics[provider.id].ready ? 'Diagnóstico pronto' : 'Diagnóstico pendente'}</strong>
                            <p>{avatarEngineDiagnostics[provider.id].next_step}</p>
                            {avatarEngineDiagnostics[provider.id].missing_items?.length > 0 && (
                              <small>Faltando: {avatarEngineDiagnostics[provider.id].missing_items.join(', ')}</small>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="avatar-engine-custom-form">
                    <h4>Novo motor customizado</h4>
                    <div className="avatar-engine-custom-grid">
                      <input
                        type="text"
                        value={customAvatarProvider.name}
                        onChange={(event) => setCustomAvatarProvider((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Nome do motor"
                      />
                      <input
                        type="url"
                        value={customAvatarProvider.repo_url}
                        onChange={(event) => setCustomAvatarProvider((current) => ({ ...current, repo_url: event.target.value }))}
                        placeholder="URL do repositório"
                      />
                      <select
                        value={customAvatarProvider.kind}
                        onChange={(event) => setCustomAvatarProvider((current) => ({ ...current, kind: event.target.value }))}
                      >
                        <option value="avatar_video">Avatar vídeo</option>
                        <option value="tts">TTS</option>
                        <option value="voice_clone">Clonagem de voz</option>
                        <option value="suite">Suite completa</option>
                      </select>
                      <input
                        type="text"
                        value={customAvatarProvider.summary}
                        onChange={(event) => setCustomAvatarProvider((current) => ({ ...current, summary: event.target.value }))}
                        placeholder="Resumo do que ele faz"
                      />
                    </div>
                    <button
                      type="button"
                      className="headline-generate-button secondary"
                      onClick={handleCreateCustomAvatarProvider}
                      disabled={savingAvatarEngineId === 'custom'}
                    >
                      {savingAvatarEngineId === 'custom' ? <><Loader size={14} className="spinner" />Adicionando...</> : 'Adicionar motor'}
                    </button>
                  </div>

                  {hiddenAvatarProviders.length > 0 && (
                    <div className="avatar-engine-hidden-block">
                      <button
                        type="button"
                        className="engine-action-button"
                        onClick={() => setShowHiddenAvatarProviders((current) => !current)}
                      >
                        {showHiddenAvatarProviders ? 'Esconder ocultos' : `Mostrar ocultos (${hiddenAvatarProviders.length})`}
                      </button>
                      {showHiddenAvatarProviders && (
                        <div className="avatar-engine-hidden-list">
                          {hiddenAvatarProviders.map((provider) => (
                            <div key={provider.id} className="avatar-engine-hidden-item">
                              <span>{provider.name}</span>
                              <button
                                type="button"
                                className="engine-action-button"
                                onClick={() => handleRestoreAvatarEngineProvider(provider.id)}
                                disabled={savingAvatarEngineId === provider.id}
                              >
                                Restaurar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="avatar-engine-plan">
                    <div className="avatar-engine-plan-header">
                      <div>
                        <strong>Plano do motor principal</strong>
                        <p>Monta o plano usando o avatar e o áudio já escolhidos no Forge.</p>
                      </div>
                      <div className="avatar-engine-plan-actions">
                        <button
                          type="button"
                          className="headline-generate-button secondary"
                          onClick={handleBuildAvatarEnginePlan}
                          disabled={buildingAvatarEnginePlan || !selectedVideo || !selectedAudio}
                        >
                          {buildingAvatarEnginePlan ? <><Loader size={14} className="spinner" />Montando...</> : 'Montar plano'}
                        </button>
                        <button
                          type="button"
                          className="headline-generate-button"
                          onClick={handleRunAvatarEngine}
                          disabled={runningAvatarEngine || !selectedVideo || !selectedAudio}
                        >
                          {runningAvatarEngine ? <><Loader size={14} className="spinner" />Gerando avatar...</> : 'Gerar vídeo do avatar'}
                        </button>
                      </div>
                    </div>
                    {avatarEnginePlan && (
                      <div className="avatar-engine-plan-body">
                        <span>Motor: <strong>{avatarEnginePlan.provider_name}</strong></span>
                        <span>Pronto para rodar: <strong>{avatarEnginePlan.runnable ? 'sim' : 'nao'}</strong></span>
                        <span>Saída prevista: <strong>{avatarEnginePlan.output_path}</strong></span>
                        <p>{avatarEnginePlan.notes}</p>
                        {Array.isArray(avatarEnginePlan.command_preview) && avatarEnginePlan.command_preview.length > 0 && (
                          <code>{avatarEnginePlan.command_preview.join(' ')}</code>
                        )}
                      </div>
                    )}
                    {avatarEngineRenderResult && (
                      <div className="avatar-engine-render-result">
                        <span>Último vídeo gerado por <strong>{avatarEngineRenderResult.provider_name}</strong></span>
                        {savingAvatarEngineRender && (
                          <small>Salvando automaticamente na Biblioteca Avatar e preparando para o render final...</small>
                        )}
                        <video
                          src={apiUrl(avatarEngineRenderResult.video_url)}
                          controls
                          className="video-thumb"
                        />
                        <code>{apiUrl(avatarEngineRenderResult.video_url)}</code>
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </div>
                <div className="headline-layout-note">
                  Usa imagem no topo, headline maior no meio e avatar embaixo. O 70/30 continua separado.
                </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Background Mode */}
          {false && (
          <div className="control-section">
            <h3>🎬 Modo de Fundo</h3>

            <div className="mode-toggle">
              <button
                onClick={() => setBackgroundMode('avatar')}
                className={`mode-button ${backgroundMode === 'avatar' ? 'active' : ''}`}
              >
                <span className="icon">🧑</span>
                Biblioteca Avatar
              </button>
              <button
                onClick={() => setBackgroundMode('local')}
                className={`mode-button ${backgroundMode === 'local' ? 'active' : ''}`}
              >
                <span className="icon">📚</span>
                Biblioteca Local
              </button>
            </div>
          </div>
          )}

          {/* Section 3: Video Selection */}
          <div className="control-section">
            {false ? (
              <>
                <h3>🧑 Biblioteca Avatar</h3>

                <div className="video-upload-section">
                  <div className="video-limit-note">Envie imagem de perfil do avatar. Vídeos antigos continuam compatíveis.</div>
                  <label className="upload-video-label">
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp,video/*,.mp4,.mov,.m4v,.webm,.avi,.mkv"
                      onChange={handleAvatarVideoUpload}
                      disabled={uploadingAvatarVideo}
                      className="file-input"
                    />
                    <div className="upload-video-box">
                      {uploadingAvatarVideo ? (
                        <>
                          <Loader size={32} className="spinner" />
                          <p>Enviando avatar...</p>
                        </>
                      ) : (
                        <>
                          <Upload size={32} />
                          <p>Enviar avatar</p>
                          <span className="upload-hint">Imagem de perfil do personagem</span>
                        </>
                      )}
                    </div>
                  </label>
                </div>

                <div className="videos-grid-10">{avatarLibraryCards}</div>

                {selectedVideo && backgroundMode === 'avatar' && (
                  <div className="video-selected-preview-small">
                    {selectedVideo.media_type === 'image' ? (
                      <img
                        src={getSelectedVideoSource(selectedVideo)}
                        alt="Avatar selecionado"
                        className="video-thumb"
                      />
                    ) : (
                      <video
                        src={getSelectedVideoSource(selectedVideo)}
                        controls
                        className="video-thumb"
                      />
                    )}
                    <span className="selected-video-name">✓ Avatar: {selectedVideo.display_name || shortVideoName(selectedVideo.filename)}</span>
                    <span className={`selected-video-ratio ${selectedVideo.aspect_ratio === '9:16' ? 'vertical' : 'other'}`}>
                      {selectedVideo.media_type === 'image' ? 'IMAGEM' : (selectedVideo.aspect_ratio === '9:16' ? '9:16' : 'OUTRO')}
                    </span>

                    <div className="local-format-panel">
                      {localVideoFormats.map((format) => {
                        const Icon = format.icon;
                        const active = topRatio === format.ratio;

                        return (
                          <button
                            key={format.id}
                            type="button"
                            onClick={() => applyLocalVideoFormat(format.ratio)}
                            className={`local-format-button ${active ? 'active' : ''}`}
                            title={`${format.label}: ${format.detail}`}
                          >
                            <Icon size={16} />
                            <span>{format.label}</span>
                            <small>{format.detail}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3>📂 Biblioteca Local de Vídeos</h3>

                {/* Upload de Vídeo */}
                <div className="video-upload-section">
                  <div className="video-limit-note">{buildVideoDurationLimitMessage('O Forge')}</div>
                  <label className="upload-video-label">
                    <input
                      type="file"
                      accept="video/*,.mp4,.mov,.m4v,.webm,.avi,.mkv"
                      onChange={handleVideoUpload}
                      disabled={uploadingVideo}
                      className="file-input"
                    />
                    <div className="upload-video-box">
                      {uploadingVideo ? (
                        <>
                          <Loader size={32} className="spinner" />
                          <p>Enviando vídeo...</p>
                        </>
                      ) : (
                        <>
                          <Upload size={32} />
                          <p>Enviar vídeo</p>
                          <span className="upload-hint">MP4, MOV, M4V, WEBM, AVI, MKV e similares</span>
                        </>
                      )}
                    </div>
                  </label>
                </div>

                {/* Grid de Vídeos */}
                <div className="videos-grid-10">{localVideoCards}</div>

                {/* Preview Thumbnail do Vídeo Selecionado */}
                {selectedVideo && backgroundMode === 'local' && (
                  <div className="video-selected-preview-small">
                    <video
                      src={getSelectedVideoSource(selectedVideo)}
                      controls
                      className="video-thumb"
                    />
                    <span className="selected-video-name">✓ {getLocalVideoDisplayName(selectedVideo)}</span>
                    <span className={`selected-video-ratio ${selectedVideo.aspect_ratio === '9:16' ? 'vertical' : 'other'}`}>
                      {selectedVideo.aspect_ratio === '9:16' ? '9:16' : 'OUTRO'}
                    </span>

                    <div className="local-format-panel">
                      {localVideoFormats.map((format) => {
                        const Icon = format.icon;
                        const active = topRatio === format.ratio;

                        return (
                          <button
                            key={format.id}
                            type="button"
                            onClick={() => applyLocalVideoFormat(format.ratio)}
                            className={`local-format-button ${active ? 'active' : ''}`}
                            title={`${format.label}: ${format.detail}`}
                          >
                            <Icon size={16} />
                            <span>{format.label}</span>
                            <small>{format.detail}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="audio-library-section">
                  <h4>Faixa de Música / Áudio</h4>

                  <div className="audio-upload-section">
                    <label className="upload-video-label">
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                        onChange={handleAudioUpload}
                        disabled={uploadingAudio}
                        className="file-input"
                      />
                      <div className="upload-video-box compact">
                        {uploadingAudio ? (
                          <>
                            <Loader size={24} className="spinner" />
                            <p>Enviando áudio...</p>
                          </>
                        ) : (
                          <>
                            <Upload size={24} />
                            <p>Enviar áudio</p>
                            <span className="upload-hint">MP3, WAV, M4A, AAC, OGG, FLAC</span>
                          </>
                        )}
                      </div>
                    </label>
                  </div>

                  <div className="audio-grid">
                    {localAudios.map((audio) => (
                      <div
                        key={audio.filename}
                        className={`audio-card ${selectedAudio?.filename === audio.filename ? 'selected' : ''}`}
                        onClick={() => setSelectedAudio((current) => (
                          current?.filename === audio.filename ? null : audio
                        ))}
                        title={audio.filename}
                      >
                        <div className="audio-card-header">
                          <strong>{shortVideoName(audio.filename)}</strong>
                          <span>{(audio.duration || 0).toFixed(1)}s</span>
                        </div>
                        <audio
                          src={getSelectedAudioSource(audio)}
                          controls
                          preload="metadata"
                          className="audio-preview"
                          onClick={(event) => event.stopPropagation()}
                        />
                        <div className="audio-card-actions">
                          <label className="checkbox-label audio-select-label">
                            <input
                              type="radio"
                              name="selected-audio"
                              checked={selectedAudio?.filename === audio.filename}
                              onChange={() => setSelectedAudio((current) => (
                                current?.filename === audio.filename ? null : audio
                              ))}
                              onClick={(event) => event.stopPropagation()}
                              className="video-checkbox"
                            />
                            {selectedAudio?.filename === audio.filename ? 'Desselecionar' : 'Selecionar'}
                          </label>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteAudio(audio.filename);
                            }}
                            disabled={deletingAudioFile === audio.filename}
                            className="delete-video-button"
                            title="Deletar áudio"
                          >
                            {deletingAudioFile === audio.filename ? (
                              <Loader size={14} className="spinner" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedAudio && (
                    <div className="selected-audio-preview">
                      <span className="selected-video-name">♪ {shortVideoName(selectedAudio.filename)}</span>
                      <audio
                        src={getSelectedAudioSource(selectedAudio)}
                        controls
                        preload="metadata"
                        className="audio-preview selected"
                      />
                      <button
                        type="button"
                        className="remove-button-simple audio-clear-button"
                        onClick={() => setSelectedAudio(null)}
                      >
                        <X size={14} />
                        Tirar áudio
                      </button>
                    </div>
                  )}
                </div>

                {localVideos.length === 0 && (
                  <div className="empty-library">
                    <p>Nenhum vídeo na biblioteca</p>
                    <span>Envie um vídeo acima para compor o fundo local</span>
                  </div>
                )}
              </>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          {/* Render Button */}
          <button
            onClick={handleRender}
            disabled={
              rendering ||
              !hasPreviewImage ||
              (slideshowMode && selectedImagePaths.length < 1) ||
              (slideshowMode && slideshowStyle === 'mixed' && !selectedVideo)
            }
            className="render-button"
          >
            {rendering ? (
              <>
                <Loader size={18} className="spinner" />
                Renderizando... (pode levar alguns minutos)
              </>
            ) : (
              <>
                <Play size={18} />
                Renderizar Vídeo no Forge
              </>
            )}
          </button>

          {/* Resultado */}
          {renderResult && (
            <div className="result-card success forge-render-result">
              <div className="result-header">
                <Check size={24} />
                <h3>Vídeo Renderizado com Sucesso!</h3>
              </div>

              <div className="video-preview-player">
                <video
                  src={apiUrl(renderResult.output_path)}
                  controls
                  className="rendered-video"
                  style={{ width: '100%', aspectRatio: '9/16', objectFit: 'contain' }}
                />
              </div>

              <div className="metadata-editor">
                <div className="metadata-editor-header">
                  <div className="metadata-editor-heading">
                    <h4>Dados editoriais</h4>
                    <div className="metadata-generate-modes">
                      <button
                        type="button"
                        className={metadataGenerateMode === 'title_only' ? 'active' : ''}
                        onClick={() => setMetadataGenerateMode('title_only')}
                      >
                        Só título
                      </button>
                      <button
                        type="button"
                        className={metadataGenerateMode === 'title_description_hashtags' ? 'active' : ''}
                        onClick={() => setMetadataGenerateMode('title_description_hashtags')}
                      >
                        Título + descrição + hashtags
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateMetadata}
                    disabled={generatingMetadata}
                    className="generate-gpt-button"
                  >
                    {generatingMetadata ? (
                      <>
                        <Loader size={16} className="spinner" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Search size={16} />
                        Gerar
                      </>
                    )}
                  </button>
                </div>

                <label className="metadata-field">
                  <span>Título</span>
                  <input
                    type="text"
                    value={metadataTitle}
                    onChange={(e) => setMetadataTitle(e.target.value)}
                    maxLength={100}
                    placeholder="Digite ou gere um título para o vídeo"
                  />
                </label>

                <label className="metadata-field">
                  <span>Descrição</span>
                  <textarea
                    value={metadataDescription}
                    onChange={(e) => setMetadataDescription(e.target.value)}
                    rows={5}
                    placeholder="Digite ou gere uma descrição para o YouTube"
                  />
                </label>

                <label className="metadata-field">
                  <span>Hashtags</span>
                  <input
                    type="text"
                    value={metadataHashtags}
                    onChange={(e) => setMetadataHashtags(e.target.value)}
                    placeholder="#youtube #editorial #seunicho"
                  />
                </label>

                <label className="metadata-field">
                  <span>Categoria do YouTube</span>
                  <select
                    value={metadataCategory}
                    onChange={(e) => setMetadataCategory(e.target.value)}
                  >
                    {youtubeCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="metadata-field">
                  <span>Status de privacidade</span>
                  <select
                    value={metadataPrivacyStatus}
                    onChange={(e) => setMetadataPrivacyStatus(e.target.value)}
                  >
                    <option value="private">Privado</option>
                    <option value="unlisted">Não listado</option>
                    <option value="public">Público</option>
                  </select>
                </label>
              </div>

              <div className="schedule-editor">
                <div className="metadata-editor-header">
                  <h4>Programar para postar</h4>
                </div>

                <label className="metadata-field">
                  <span>Data e hora</span>
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    min={toLocalDateTimeValue(new Date())}
                  />
                </label>

                {scheduleMessage && (
                  <div className="schedule-success-message">
                    {scheduleMessage}
                  </div>
                )}

                <button
                  onClick={handleScheduleVideo}
                  disabled={scheduling}
                  className="schedule-video-button"
                >
                  {scheduling ? (
                    <>
                      <Loader size={18} className="spinner" />
                      Programando...
                    </>
                  ) : (
                    <>
                      <CalendarClock size={18} />
                      Programar na Agenda
                    </>
                  )}
                </button>
              </div>

              <a
                href={apiUrl(renderResult.output_path)}
                download
                className="download-button"
                onClick={clearForgeDraft}
              >
                <Download size={18} />
                Baixar Vídeo (.mp4)
              </a>

              <button
                onClick={handlePublishYouTube}
                disabled={publishing}
                className="publish-button"
              >
                {publishing ? (
                  <>
                    <Loader size={18} className="spinner" />
                    Publicando...
                  </>
                  ) : (
                    <>
                      <Play size={18} />
                    Publicar no YouTube
                    </>
                  )}
                </button>

              <button
                onClick={() => {
                  clearForgeDraft();
                  setRenderResult(null);
                }}
                className="new-render-button"
              >
                Criar Novo Render
              </button>
            </div>
          )}
        </div>

        {/* Coluna 2: Preview */}
        <div className="forge-preview">
          <div className="preview-card compact-preview-card">
            <h3>Formato vertical e preview</h3>

            <div className="compact-ratio-tools">
              <div className="compact-slider">
                <label>
                  <Sliders size={15} />
                  Proporção vertical
                </label>
                <div className="ratio-readout">
                  <strong>{topRatio}% imagem</strong>
                  <span>{bottomRatio}% vídeo</span>
                </div>
                <div className="range-control">
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={topRatio}
                    onInput={(e) => handleRatioChange(e.target.value)}
                    onChange={(e) => handleRatioChange(e.target.value)}
                    className="slider ratio-slider"
                    aria-label="Ajustar proporção vertical"
                  />
                </div>
              </div>

              <div className="fit-control-grid">
                <div className="fit-control-group">
                  <span>Imagem</span>
                  <div className="fit-toggle" role="group" aria-label="Encaixe da imagem">
                    <button
                      type="button"
                      className={imageFit === 'contain' ? 'active' : ''}
                      onClick={() => {
                        setImageFit('contain');
                        syncMainPreviewCropToFirstSlideshowImage({ fit: 'contain' });
                      }}
                    >
                      Inteira
                    </button>
                    <button
                      type="button"
                      className={imageFit === 'cover' ? 'active' : ''}
                      onClick={() => {
                        setImageFit('cover');
                        syncMainPreviewCropToFirstSlideshowImage({ fit: 'cover' });
                      }}
                    >
                      Cortar laterais
                    </button>
                  </div>
                  {imageFit === 'cover' && (
                    <div className="image-crop-controls-simple">
                      <label>
                        Linha de cima {topGuidePercent}%
                        <div className="range-control">
                          <input
                            type="range"
                            min="0"
                            max="40"
                            step="1"
                            value={imageCropX}
                            onInput={(e) => {
                              const nextValue = parseInt(e.target.value, 10);
                              setImageCropX(nextValue);
                              syncMainPreviewCropToFirstSlideshowImage({ top_percent: nextValue });
                              setRenderResult(null);
                            }}
                            onChange={(e) => {
                              const nextValue = parseInt(e.target.value, 10);
                              setImageCropX(nextValue);
                              syncMainPreviewCropToFirstSlideshowImage({ top_percent: nextValue });
                              setRenderResult(null);
                            }}
                            className="slider"
                            aria-label="Ajustar linha de cima"
                          />
                        </div>
                      </label>

                      <label>
                        Linha de baixo {bottomGuidePercent}%
                        <div className="range-control">
                          <input
                            type="range"
                            min="0"
                            max="40"
                            step="1"
                            value={imageCropY}
                            onInput={(e) => {
                              const nextValue = parseInt(e.target.value, 10);
                              setImageCropY(nextValue);
                              syncMainPreviewCropToFirstSlideshowImage({ bottom_percent: nextValue });
                              setRenderResult(null);
                            }}
                            onChange={(e) => {
                              const nextValue = parseInt(e.target.value, 10);
                              setImageCropY(nextValue);
                              syncMainPreviewCropToFirstSlideshowImage({ bottom_percent: nextValue });
                              setRenderResult(null);
                            }}
                            className="slider"
                            aria-label="Ajustar linha de baixo"
                          />
                        </div>
                      </label>

                      <button
                        type="button"
                        className="image-crop-apply-button"
                        onClick={handleCropImage}
                        disabled={croppingImage}
                      >
                        {croppingImage ? (
                          <>
                            <Loader size={14} className="spinner" />
                            Cortando...
                          </>
                        ) : (
                          'Cortar imagem'
                        )}
                      </button>
                      {slideshowMode && selectedImagePaths.length > 1 && (
                        <button
                          type="button"
                          className="image-crop-apply-button"
                          onClick={applyMainPreviewCropToAll}
                        >
                          Replicar 1° em todas
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="fit-control-group">
                  <span>Vídeo</span>
                  <div className="fit-toggle" role="group" aria-label="Encaixe do vídeo">
                    <button
                      type="button"
                      className={videoFit === 'contain' ? 'active' : ''}
                      onClick={() => setVideoFit('contain')}
                    >
                      Sem cortar
                    </button>
                    <button
                      type="button"
                      className={videoFit === 'cover' ? 'active' : ''}
                      onClick={() => setVideoFit('cover')}
                    >
                      Preencher
                    </button>
                  </div>
                </div>
              </div>

              <div className={`post-overlay-controls ${bottomRatio === 0 ? 'visible' : 'hidden'}`}>
                  <div className="post-overlay-note">
                    {selectedVideo
                      ? 'Post centralizado sobre o vídeo selecionado.'
                      : 'Selecione um vídeo de fundo se quiser movimento atrás do post.'}
                  </div>

                  <label>
                    Tamanho do post {postScale}%
                    <div className="range-control">
                      <input
                        type="range"
                        min="55"
                        max="100"
                        step="5"
                        value={postScale}
                        onInput={(e) => setPostScale(parseInt(e.target.value, 10))}
                        onChange={(e) => setPostScale(parseInt(e.target.value, 10))}
                        className="slider"
                        aria-label="Ajustar tamanho do post"
                      />
                    </div>
                  </label>

                  <label>
                    Posição vertical {postY}%
                    <div className="range-control">
                      <input
                        type="range"
                        min="15"
                        max="85"
                        step="5"
                        value={postY}
                        onInput={(e) => setPostY(parseInt(e.target.value, 10))}
                        onChange={(e) => setPostY(parseInt(e.target.value, 10))}
                        className="slider"
                        aria-label="Ajustar posição vertical do post"
                      />
                    </div>
                  </label>
                </div>
            </div>

            <ForgeVerticalPreview
              previewRootRef={previewRootRef}
              hasPreviewImage={hasPreviewImage}
              layoutPreset={
                slideshowMode && slideshowStyle === 'pure'
                  ? 'slideshowPure'
                  : (hasSingleVideoPreview ? 'singleVideo' : layoutPreset)
              }
              selectedVideoSource={selectedVideoSource}
              selectedVideoThumbnail={selectedVideoThumbnail}
              selectedVideoMediaType={selectedVideoMediaType}
              activeHeadlineClassName={activeHeadlinePalette.className}
              activePreviewImage={activePreviewImage}
              imageFit={imageFit}
              verticalCenterPercent={verticalCenterPercent}
              topRatio={topRatio}
              headlineRatio={headlineRatio}
              bottomRatio={bottomRatio}
              headlineFontScale={headlineFontScale}
              headlineText={headlineText}
              headlinePosition={slideshowHeadlinePosition}
              videoFit={videoFit}
              postScale={postScale}
              postY={postY}
              topGuidePercent={topGuidePercent}
              bottomGuidePercent={bottomGuidePercent}
            />
          </div>

        </div>
      </div>
    </div>
  );
}

export default ForgeEditor;
