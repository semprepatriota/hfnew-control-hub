import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Download,
  Image,
  Instagram,
  Link as LinkIcon,
  Loader,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Video,
} from 'lucide-react';
import { apiUrl } from '../../config/api';
import {
  VIDEO_EDIT_MAX_DURATION_LABEL,
  buildVideoDurationLimitMessage,
  formatVideoDurationLabel,
  isVideoDurationWithinEditLimit,
} from '../../config/videoLimits';
import './Pages.css';
import './InstagramPublisher.css';

const emptyCarouselItem = () => ({
  media_url: '',
  media_type: 'image',
  preview_url: '',
  source_url: '',
});

const buildLibraryScopeKey = (platform, destinationId) => `alliance_library_scope_${platform}_${destinationId}`;

const readScopedLibrary = (platform, destinationId) => {
  if (!destinationId) return { videos: [], images: [] };
  try {
    const raw = window.localStorage.getItem(buildLibraryScopeKey(platform, destinationId));
    if (!raw) return { videos: [], images: [] };
    const parsed = JSON.parse(raw);
    return {
      videos: Array.isArray(parsed?.videos) ? parsed.videos.filter(Boolean) : [],
      images: Array.isArray(parsed?.images) ? parsed.images.filter(Boolean) : [],
    };
  } catch (error) {
    return { videos: [], images: [] };
  }
};

const writeScopedLibrary = (platform, destinationId, data) => {
  if (!destinationId) return;
  window.localStorage.setItem(buildLibraryScopeKey(platform, destinationId), JSON.stringify(data));
};

function InstagramPublisher() {
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [mediaType, setMediaType] = useState('carousel');
  const [metadataTitle, setMetadataTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [metadataHashtags, setMetadataHashtags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [downloadedVideo, setDownloadedVideo] = useState(null);
  const [carouselItems, setCarouselItems] = useState([emptyCarouselItem()]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [localVideos, setLocalVideos] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [selectedLibraryVideo, setSelectedLibraryVideo] = useState('');
  const [scopedLibrary, setScopedLibrary] = useState({ videos: [], images: [] });
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [generatingMetadata, setGeneratingMetadata] = useState(false);
  const [capturingImage, setCapturingImage] = useState(false);
  const [capturingCarouselIndex, setCapturingCarouselIndex] = useState(null);
  const [downloadingReel, setDownloadingReel] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.profile_id === selectedProfileId),
    [profiles, selectedProfileId],
  );

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/instagram/status'));
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao carregar perfis Instagram');
      }

      const nextProfiles = data.profiles || [];
      setProfiles(nextProfiles);
      setActiveProfileId(data.active_profile_id || '');

      const preferredProfileId = selectedProfileId || data.active_profile_id || nextProfiles[0]?.profile_id || '';
      setSelectedProfileId(preferredProfileId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingProfiles(false);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const response = await fetch(apiUrl('/api/forge/library'));
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao carregar biblioteca');
      }
      setLocalVideos(data.videos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    setScopedLibrary(readScopedLibrary('instagram', selectedProfileId));
  }, [selectedProfileId]);

  const parseHashtags = (value) => value
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));

  const composeCaption = () => {
    const hashtags = parseHashtags(metadataHashtags);
    return [caption.trim(), hashtags.join(' ')].filter(Boolean).join('\n\n');
  };

  const getMetadataImagePaths = () => {
    if (mediaType === 'image' && imagePreviewUrl) return [imagePreviewUrl];
    if (mediaType === 'carousel') {
      return carouselItems.map((item) => item.preview_url).filter(Boolean);
    }
    return [];
  };

  const buildPayload = () => {
    const cleanedCaption = composeCaption();

    if (!selectedProfileId) {
      throw new Error('Selecione um perfil Instagram conectado');
    }

    if (mediaType === 'carousel') {
      const cleanedItems = carouselItems
        .map((item) => ({
          media_url: item.media_url.trim(),
          media_type: item.media_type,
        }))
        .filter((item) => item.media_url);

      if (cleanedItems.length < 2) {
        throw new Error('Carrossel precisa ter pelo menos 2 mídias');
      }

      return {
        profile_id: selectedProfileId,
        media_type: 'carousel',
        caption: cleanedCaption,
        carousel_items: cleanedItems.map(({ media_url, media_type }) => ({ media_url, media_type })),
      };
    }

    if (mediaType === 'reel') {
      if (!videoUrl.trim()) {
        throw new Error('Informe a URL pública do vídeo para Reel');
      }

      return {
        profile_id: selectedProfileId,
        media_type: 'reel',
        caption: cleanedCaption,
        video_url: videoUrl.trim(),
      };
    }

    if (!imageUrl.trim()) {
      throw new Error('Informe a URL pública da imagem');
    }

    return {
      profile_id: selectedProfileId,
      media_type: 'image',
      caption: cleanedCaption,
      image_url: imageUrl.trim(),
    };
  };

  const generateMetadata = async () => {
    setGeneratingMetadata(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(apiUrl('/api/forge/generate-social-metadata'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'instagram',
          media_type: mediaType,
          image_paths: getMetadataImagePaths(),
          title_hint: metadataTitle,
          description_hint: caption,
          source_url: imageUrl || videoUrl || carouselItems.find((item) => item.media_url)?.media_url || '',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao gerar com GPT');
      }

      setMetadataTitle(data.title || '');
      setCaption(data.description || '');
      setMetadataHashtags((data.hashtags || []).join(' '));
      setSuccess('Metadados gerados com GPT.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingMetadata(false);
    }
  };

  const captureImageFromLink = async (sourceUrl) => {
    const response = await fetch(apiUrl('/api/forge/download-image'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_url: sourceUrl }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Erro ao capturar imagem');
    }
    return apiUrl(data.image_url);
  };

  const downloadImageAsset = async (sourceUrl) => {
    const response = await fetch(apiUrl('/api/forge/download-image'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_url: sourceUrl }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Erro ao baixar post');
    }
    return data;
  };

  const captureMainImage = async () => {
    if (!imageUrl.trim()) {
      setError('Cole o link da imagem ou post primeiro');
      return;
    }
    setCapturingImage(true);
    setError('');
    setSuccess('');
    try {
      const previewUrl = await captureImageFromLink(imageUrl.trim());
      setImagePreviewUrl(previewUrl);
      setSuccess('Imagem capturada para preview e edição.');
    } catch (err) {
      setError(err.message);
    } finally {
      setCapturingImage(false);
    }
  };

  const downloadMainPost = async () => {
    if (!imageUrl.trim()) {
      setError('Cole o link da imagem ou post primeiro');
      return;
    }
    setCapturingImage(true);
    setError('');
    setSuccess('');
    try {
      const data = await downloadImageAsset(imageUrl.trim());
      setImagePreviewUrl(apiUrl(data.image_url));
      setSuccess(`Post salvo localmente: ${data.filename}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCapturingImage(false);
    }
  };

  const captureCarouselImage = async (index) => {
    const sourceUrl = carouselItems[index]?.media_url?.trim();
    if (!sourceUrl) {
      setError('Cole o link da mídia do carrossel primeiro');
      return;
    }
    setCapturingCarouselIndex(index);
    setError('');
    setSuccess('');
    try {
      const previewUrl = await captureImageFromLink(sourceUrl);
      updateCarouselItem(index, {
        preview_url: previewUrl,
        source_url: sourceUrl,
      });
      setSuccess('Item do carrossel capturado para preview.');
    } catch (err) {
      setError(err.message);
    } finally {
      setCapturingCarouselIndex(null);
    }
  };

  const downloadReelForEditing = async () => {
    if (!videoUrl.trim()) {
      setError('Cole o link público do Reel ou vídeo primeiro');
      return;
    }
    setDownloadingReel(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(apiUrl('/api/forge/download-social-video'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_url: videoUrl.trim(),
          title: caption.trim().slice(0, 80) || 'Instagram Reel',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao baixar Reel');
      }
      if (Number(data.duration || 0) > 0 && !isVideoDurationWithinEditLimit(data.duration)) {
        throw new Error(`Instagram para edição aceita vídeos de até ${VIDEO_EDIT_MAX_DURATION_LABEL}.`);
      }
      setDownloadedVideo(data);
      setVideoPreviewUrl(apiUrl(data.preview_url || data.video_url));
      if (selectedProfileId && data.filename) {
        const nextScope = {
          ...scopedLibrary,
          videos: Array.from(new Set([data.filename, ...(scopedLibrary.videos || [])])),
        };
        setScopedLibrary(nextScope);
        writeScopedLibrary('instagram', selectedProfileId, nextScope);
      }
      setSuccess(`Reel baixado para edição: ${data.filename}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingReel(false);
    }
  };

  const applyLibraryVideo = (video) => {
    if (Number(video?.duration || 0) > 0 && !isVideoDurationWithinEditLimit(video.duration)) {
      setError(`Instagram para edição aceita vídeos de até ${VIDEO_EDIT_MAX_DURATION_LABEL}.`);
      return;
    }
    const previewUrl = apiUrl(`/api/forge/play-video/${encodeURIComponent(video.filename)}`);
    setSelectedLibraryVideo(video.filename);
    setVideoPreviewUrl(previewUrl);
    setDownloadedVideo({
      filename: video.filename,
      preview_url: previewUrl,
      local_only: true,
    });
    if (selectedProfileId && video.filename) {
      const nextScope = {
        ...scopedLibrary,
        videos: Array.from(new Set([video.filename, ...(scopedLibrary.videos || [])])),
      };
      setScopedLibrary(nextScope);
      writeScopedLibrary('instagram', selectedProfileId, nextScope);
    }
    setSuccess(`Vídeo da biblioteca selecionado para preview: ${video.filename}`);
  };

  const removeScopedVideo = (filename) => {
    if (!selectedProfileId) return;
    const nextScope = {
      ...scopedLibrary,
      videos: (scopedLibrary.videos || []).filter((item) => item !== filename),
    };
    setScopedLibrary(nextScope);
    writeScopedLibrary('instagram', selectedProfileId, nextScope);
  };

  const scopedVideos = useMemo(() => {
    const order = new Map((scopedLibrary.videos || []).map((filename, index) => [filename, index]));
    return localVideos
      .filter((video) => order.has(video.filename))
      .sort((left, right) => (order.get(left.filename) ?? 9999) - (order.get(right.filename) ?? 9999));
  }, [localVideos, scopedLibrary.videos]);

  const generalVideos = useMemo(
    () => localVideos.filter((video) => !scopedLibrary.videos?.includes(video.filename)),
    [localVideos, scopedLibrary.videos],
  );

  const publishNow = async () => {
    setPublishing(true);
    setError('');
    setSuccess('');

    try {
      const payload = buildPayload();
      const response = await fetch(apiUrl('/api/instagram/publish'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao publicar no Instagram');
      }
      setSuccess(`Publicado no Instagram. ID: ${data.instagram_media_id || 'confirmado'}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const schedulePost = async () => {
    setScheduling(true);
    setError('');
    setSuccess('');

    try {
      if (!scheduledAt) {
        throw new Error('Escolha dia e hora para agendar');
      }

      const payload = buildPayload();
      const title = metadataTitle.trim() || caption.trim().slice(0, 80) || `Instagram ${mediaType}`;
      const response = await fetch(apiUrl('/api/schedule/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: `instagram_${Date.now()}`,
          title,
          description: composeCaption(),
          scheduled_at: scheduledAt,
          platform: 'instagram',
          instagram_profile_id: payload.profile_id,
          instagram_profile_name: selectedProfile?.username || selectedProfile?.profile_name || '',
          instagram_media_type: payload.media_type,
          image_url: payload.image_url || '',
          video_url: payload.video_url || '',
          carousel_items: payload.carousel_items || [],
          hashtags: [],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao agendar publicação');
      }
      setSuccess('Publicação do Instagram enviada para a agenda.');
    } catch (err) {
      setError(err.message);
    } finally {
      setScheduling(false);
    }
  };

  const updateCarouselItem = (index, patch) => {
    setCarouselItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  };

  const previewMedia = useMemo(() => {
    if (mediaType === 'reel') {
      return {
        type: 'video',
        url: videoPreviewUrl || videoUrl,
        label: downloadedVideo?.filename || 'Reel / vídeo',
      };
    }
    if (mediaType === 'image') {
      return {
        type: 'image',
        url: imagePreviewUrl || imageUrl,
        label: 'Imagem',
      };
    }
    return {
      type: 'carousel',
      items: carouselItems.filter((item) => item.preview_url || item.media_url),
      label: `${carouselItems.filter((item) => item.preview_url || item.media_url).length} mídia(s)`,
    };
  }, [carouselItems, downloadedVideo, imagePreviewUrl, imageUrl, mediaType, videoPreviewUrl, videoUrl]);

  const addCarouselItem = () => {
    setCarouselItems((current) => {
      if (current.length >= 10) return current;
      return [...current, emptyCarouselItem()];
    });
  };

  const removeCarouselItem = (index) => {
    setCarouselItems((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  return (
    <div className="page-container instagram-publisher-page">
      <div className="page-header">
        <div>
          <h1>Instagram</h1>
          <p>Operacao editorial e agendamento para imagem, Reel e carrossel.</p>
        </div>

        <button className="btn-primary" type="button" onClick={loadProfiles} disabled={loadingProfiles}>
          {loadingProfiles ? <Loader size={18} className="instagram-spin" /> : <RefreshCw size={18} />}
          Atualizar
        </button>
      </div>

      {error && (
        <div className="instagram-alert error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="instagram-alert success">
          <Instagram size={18} />
          {success}
        </div>
      )}

      <div className="instagram-workspace">
        <section className="instagram-panel">
          <div className="panel-title">
            <Instagram size={20} />
            <h2>Perfil</h2>
          </div>

          {loadingProfiles ? (
            <div className="instagram-loading">Carregando perfis...</div>
          ) : profiles.length === 0 ? (
            <div className="instagram-empty">
              <p>Nenhum perfil Instagram conectado.</p>
              <a href="/conexoes">Abrir Conexões</a>
            </div>
          ) : (
            <>
              <label className="instagram-field">
                <span>Perfil conectado</span>
                <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
                  {profiles.map((profile) => (
                    <option value={profile.profile_id} key={profile.profile_id}>
                      @{profile.username || profile.profile_name}
                      {profile.profile_id === activeProfileId ? ' - ativo' : ''}
                    </option>
                  ))}
                </select>
              </label>

              {selectedProfile && (
                <div className="profile-summary">
                  <strong>@{selectedProfile.username || selectedProfile.profile_name}</strong>
                  <span>{selectedProfile.facebook_page_name || selectedProfile.facebook_page_id}</span>
                </div>
              )}
            </>
          )}

          <div className="instagram-note">
            A Meta precisa acessar a mídia por URL pública. Arquivos locais e localhost não são aceitos pela API.
          </div>

          {(mediaType === 'reel') && (
            <div className="social-library-box">
              <div className="social-library-header">
                <h3>Biblioteca local</h3>
                <button type="button" className="refresh-button" onClick={loadLibrary} disabled={loadingLibrary}>
                  {loadingLibrary ? <Loader size={15} className="instagram-spin" /> : <RefreshCw size={15} />}
                  Atualizar
                </button>
              </div>
              <div className="social-library-note">{buildVideoDurationLimitMessage('Instagram para edição')}</div>
              {localVideos.length === 0 ? (
                <div className="social-library-empty">Nenhum vídeo local encontrado.</div>
              ) : (
                <>
                  <div className="social-library-section">
                    <div className="social-library-section-head">
                      <strong>Biblioteca deste perfil</strong>
                      <span>@{selectedProfile?.username || selectedProfile?.profile_name || 'perfil atual'}</span>
                    </div>
                    {scopedVideos.length === 0 ? (
                      <div className="social-library-empty">Ainda não há vídeos separados para este perfil.</div>
                    ) : (
                      <div className="social-library-grid">
                        {scopedVideos.slice(0, 6).map((video) => {
                          const previewSrc = apiUrl(`/api/forge/play-video/${encodeURIComponent(video.filename)}`);
                          return (
                            <div
                              key={video.filename}
                              className={`social-library-card ${selectedLibraryVideo === video.filename ? 'selected' : ''}`}
                              title={video.filename}
                            >
                              <button type="button" className="social-library-main" onClick={() => applyLibraryVideo(video)}>
                                <div className="social-library-thumb">
                                  <video src={previewSrc} muted playsInline preload="metadata" />
                                </div>
                                <span>{video.filename}</span>
                                <small>{formatVideoDurationLabel(video.duration)}</small>
                              </button>
                              <button type="button" className="social-library-remove" onClick={() => removeScopedVideo(video.filename)}>
                                Tirar
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="social-library-section">
                    <div className="social-library-section-head">
                      <strong>Biblioteca geral</strong>
                      <span>Selecionar aqui adiciona o vídeo a este perfil</span>
                    </div>
                    {generalVideos.length === 0 ? (
                      <div className="social-library-empty">Sem outros vídeos disponíveis na biblioteca geral.</div>
                    ) : (
                      <div className="social-library-grid">
                        {generalVideos.slice(0, 6).map((video) => {
                          const previewSrc = apiUrl(`/api/forge/play-video/${encodeURIComponent(video.filename)}`);
                          return (
                            <button
                              type="button"
                              key={video.filename}
                              className={`social-library-card ${selectedLibraryVideo === video.filename ? 'selected' : ''}`}
                              onClick={() => applyLibraryVideo(video)}
                              title={video.filename}
                            >
                              <div className="social-library-thumb">
                                <video src={previewSrc} muted playsInline preload="metadata" />
                              </div>
                              <span>{video.filename}</span>
                              <small>{formatVideoDurationLabel(video.duration)}</small>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <section className="instagram-panel">
          <div className="panel-title">
            <Image size={20} />
            <h2>Conteúdo</h2>
          </div>

          <div className="media-type-tabs">
            <button className={mediaType === 'carousel' ? 'active' : ''} type="button" onClick={() => setMediaType('carousel')}>
              Carrossel
            </button>
            <button className={mediaType === 'image' ? 'active' : ''} type="button" onClick={() => setMediaType('image')}>
              Imagem
            </button>
            <button className={mediaType === 'reel' ? 'active' : ''} type="button" onClick={() => setMediaType('reel')}>
              Reel
            </button>
          </div>

          {mediaType === 'carousel' && (
            <div className="carousel-editor">
              {carouselItems.map((item, index) => (
                <div className="media-link-card" key={`carousel-${index}`}>
                  <div className="media-link-preview">
                    {item.media_type === 'video' ? (
                      <video src={item.preview_url || item.media_url} muted playsInline />
                    ) : item.preview_url || item.media_url ? (
                      <img src={item.preview_url || item.media_url} alt={`Carrossel ${index + 1}`} />
                    ) : (
                      <Image size={22} />
                    )}
                  </div>
                  <div className="media-link-fields">
                    <div className="carousel-row">
                      <span className="carousel-number">{index + 1}</span>
                      <select value={item.media_type} onChange={(event) => updateCarouselItem(index, { media_type: event.target.value })}>
                        <option value="image">Imagem</option>
                        <option value="video">Vídeo</option>
                      </select>
                      <div className="media-url-input">
                        <LinkIcon size={15} />
                        <input
                          type="url"
                          value={item.media_url}
                          placeholder="Cole link público ou post"
                          onChange={(event) => updateCarouselItem(index, { media_url: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') captureCarouselImage(index);
                          }}
                        />
                      </div>
                    </div>
                    <div className="media-link-actions">
                      <button type="button" onClick={() => captureCarouselImage(index)} disabled={capturingCarouselIndex === index || !item.media_url.trim()}>
                        {capturingCarouselIndex === index ? <Loader size={15} className="instagram-spin" /> : <Download size={15} />}
                        Capturar preview
                      </button>
                      <button type="button" onClick={() => removeCarouselItem(index)} disabled={carouselItems.length <= 1}>
                        <Trash2 size={15} />
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <button className="add-media-button" type="button" onClick={addCarouselItem} disabled={carouselItems.length >= 10}>
                <Plus size={16} />
                Adicionar mídia
              </button>
            </div>
          )}

          {mediaType === 'image' && (
            <div className="single-media-import">
              <label className="instagram-field">
                <span>Link da imagem ou post</span>
                <div className="media-url-input">
                  <LinkIcon size={15} />
                  <input
                    type="url"
                    value={imageUrl}
                    placeholder="Cole link público ou post"
                    onChange={(event) => setImageUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') captureMainImage();
                    }}
                  />
                  </div>
                </label>
              <div className="media-import-actions">
                <button className="add-media-button" type="button" onClick={captureMainImage} disabled={capturingImage || !imageUrl.trim()}>
                  {capturingImage ? <Loader size={16} className="instagram-spin" /> : <Image size={16} />}
                  Capturar preview
                </button>
                <button className="add-media-button" type="button" onClick={downloadMainPost} disabled={capturingImage || !imageUrl.trim()}>
                  {capturingImage ? <Loader size={16} className="instagram-spin" /> : <Download size={16} />}
                  Baixar post
                </button>
              </div>
            </div>
          )}

          {mediaType === 'reel' && (
            <div className="single-media-import">
              <label className="instagram-field">
                <span>Link do Reel ou vídeo</span>
                <div className="media-url-input">
                  <LinkIcon size={15} />
                  <input
                    type="url"
                    value={videoUrl}
                    placeholder="Cole link público do Reel ou vídeo"
                    onChange={(event) => setVideoUrl(event.target.value)}
                    onBlur={() => {
                      if (videoUrl.trim() && !downloadedVideo && !downloadingReel) downloadReelForEditing();
                    }}
                  />
                </div>
              </label>
              <button className="add-media-button" type="button" onClick={downloadReelForEditing} disabled={downloadingReel || !videoUrl.trim()}>
                {downloadingReel ? <Loader size={16} className="instagram-spin" /> : <Download size={16} />}
                Baixar vídeo
              </button>
            </div>
          )}

          <div className="metadata-editor-header">
            <h4>Metadados</h4>
            <button type="button" className="generate-gpt-button" onClick={generateMetadata} disabled={generatingMetadata}>
              {generatingMetadata ? <><Loader size={16} className="instagram-spin" />Gerando...</> : <><Search size={16} />Gerar com ChatGPT</>}
            </button>
          </div>

          <label className="instagram-field">
            <span>Título</span>
            <input
              type="text"
              value={metadataTitle}
              maxLength={100}
              placeholder="Título gerado ou manual"
              onChange={(event) => setMetadataTitle(event.target.value)}
            />
          </label>

          <label className="instagram-field">
            <span>Descrição / legenda</span>
            <textarea
              value={caption}
              rows={8}
              maxLength={2200}
              placeholder="Texto editorial, contexto, CTA e observacoes da publicacao..."
              onChange={(event) => setCaption(event.target.value)}
            />
            <small>{caption.length}/2200</small>
          </label>

          <label className="instagram-field">
            <span>Hashtags</span>
            <input
              type="text"
              value={metadataHashtags}
              placeholder="#editorial #instagram #canal"
              onChange={(event) => setMetadataHashtags(event.target.value)}
            />
          </label>
        </section>

        <section className="instagram-panel action-panel">
          <div className="panel-title">
            <CalendarClock size={20} />
            <h2>Publicação</h2>
          </div>

          <label className="instagram-field">
            <span>Dia e hora para agenda</span>
            <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          </label>

          <div className="instagram-actions">
            <button type="button" className="publish-button" onClick={publishNow} disabled={publishing || scheduling || profiles.length === 0}>
              {publishing ? <Loader size={18} className="instagram-spin" /> : <Send size={18} />}
              Publicar agora
            </button>

            <button type="button" className="schedule-button" onClick={schedulePost} disabled={publishing || scheduling || profiles.length === 0}>
              {scheduling ? <Loader size={18} className="instagram-spin" /> : <CalendarClock size={18} />}
              Agendar
            </button>
          </div>

          <div className="instagram-format-box">
            <Video size={18} />
            <div>
              <strong>Carrossel</strong>
              <span>2 a 10 mídias públicas. Pode misturar imagem e vídeo, conforme aceito pela Meta.</span>
            </div>
          </div>

          <div className="platform-media-preview">
            <div className="platform-preview-media">
              {previewMedia.type === 'video' && previewMedia.url ? (
                <video src={previewMedia.url} controls muted playsInline />
              ) : previewMedia.type === 'image' && previewMedia.url ? (
                <img src={previewMedia.url} alt="Preview" />
              ) : previewMedia.type === 'carousel' && previewMedia.items.length > 0 ? (
                <div className="carousel-preview-grid">
                  {previewMedia.items.slice(0, 4).map((item, index) => (
                    <div key={`preview-${index}`}>
                      {item.media_type === 'video' ? (
                        <video src={item.preview_url || item.media_url} muted playsInline />
                      ) : (
                        <img src={item.preview_url || item.media_url} alt={`Preview ${index + 1}`} />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="platform-preview-empty">
                  <Image size={28} />
                </div>
              )}
            </div>
            <div className="platform-preview-meta">
              <strong>{metadataTitle.trim() || caption.trim().slice(0, 90) || `Instagram ${mediaType}`}</strong>
              <span>{selectedProfile ? `@${selectedProfile.username || selectedProfile.profile_name}` : 'Perfil Instagram'}</span>
              <p>{previewMedia.label}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default InstagramPublisher;
