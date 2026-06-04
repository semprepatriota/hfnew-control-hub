import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Download,
  Facebook,
  Image,
  Link as LinkIcon,
  Loader,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Type,
  Video,
} from 'lucide-react';
import { apiUrl } from '../../config/api';
import './Pages.css';
import './InstagramPublisher.css';
import './FacebookPublisher.css';

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

function FacebookPublisher() {
  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState('');
  const [selectedPageId, setSelectedPageId] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [metadataTitle, setMetadataTitle] = useState('');
  const [message, setMessage] = useState('');
  const [metadataHashtags, setMetadataHashtags] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
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
  const [loadingPages, setLoadingPages] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [generatingMetadata, setGeneratingMetadata] = useState(false);
  const [capturingImage, setCapturingImage] = useState(false);
  const [capturingCarouselIndex, setCapturingCarouselIndex] = useState(null);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedPage = useMemo(
    () => pages.find((page) => page.page_id === selectedPageId),
    [pages, selectedPageId],
  );

  const loadPages = useCallback(async () => {
    setLoadingPages(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/facebook/status'));
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao carregar páginas Facebook');
      }

      const nextPages = data.pages || [];
      setPages(nextPages);
      setActivePageId(data.active_page_id || '');

      const preferredPageId = selectedPageId || data.active_page_id || nextPages[0]?.page_id || '';
      setSelectedPageId(preferredPageId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPages(false);
    }
  }, [selectedPageId]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

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
    setScopedLibrary(readScopedLibrary('facebook', selectedPageId));
  }, [selectedPageId]);

  const parseHashtags = (value) => value
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));

  const composeMessage = () => {
    const hashtags = parseHashtags(metadataHashtags);
    return [message.trim(), hashtags.join(' ')].filter(Boolean).join('\n\n');
  };

  const getMetadataImagePaths = () => {
    if (mediaType === 'image' && imagePreviewUrl) return [imagePreviewUrl];
    if (mediaType === 'carousel') {
      return carouselItems.map((item) => item.preview_url).filter(Boolean);
    }
    return [];
  };

  const buildPayload = () => {
    const cleanedMessage = composeMessage();

    if (!selectedPageId) {
      throw new Error('Selecione uma página Facebook conectada');
    }

    if (mediaType === 'link') {
      if (!linkUrl.trim()) throw new Error('Informe a URL pública do link');
      return {
        page_id: selectedPageId,
        media_type: 'link',
        message: cleanedMessage,
        link_url: linkUrl.trim(),
      };
    }

    if (mediaType === 'image') {
      if (!imageUrl.trim()) throw new Error('Informe a URL pública da imagem');
      return {
        page_id: selectedPageId,
        media_type: 'image',
        message: cleanedMessage,
        image_url: imageUrl.trim(),
      };
    }

    if (mediaType === 'video') {
      if (!videoUrl.trim()) throw new Error('Informe a URL pública do vídeo');
      return {
        page_id: selectedPageId,
        media_type: 'video',
        message: cleanedMessage,
        video_url: videoUrl.trim(),
      };
    }

    if (mediaType === 'carousel') {
      const cleanedItems = carouselItems
        .map((item) => ({ media_url: item.media_url.trim(), media_type: 'image' }))
        .filter((item) => item.media_url);

      if (cleanedItems.length < 2) {
        throw new Error('Carrossel Facebook precisa ter pelo menos 2 imagens');
      }

      return {
        page_id: selectedPageId,
        media_type: 'carousel',
        message: cleanedMessage,
        carousel_items: cleanedItems.map(({ media_url, media_type }) => ({ media_url, media_type })),
      };
    }

    if (!cleanedMessage) {
      throw new Error('Escreva o texto da publicação');
    }

    return {
      page_id: selectedPageId,
      media_type: 'text',
      message: cleanedMessage,
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
          platform: 'facebook',
          media_type: mediaType,
          image_paths: getMetadataImagePaths(),
          title_hint: metadataTitle,
          description_hint: message,
          source_url: imageUrl || videoUrl || linkUrl || carouselItems.find((item) => item.media_url)?.media_url || '',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao gerar com GPT');
      }

      setMetadataTitle(data.title || '');
      setMessage(data.description || '');
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
      setError('Cole o link da imagem do carrossel primeiro');
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
      setSuccess('Imagem do carrossel capturada para preview.');
    } catch (err) {
      setError(err.message);
    } finally {
      setCapturingCarouselIndex(null);
    }
  };

  const downloadVideoForEditing = async () => {
    if (!videoUrl.trim()) {
      setError('Cole o link público do vídeo primeiro');
      return;
    }
    setDownloadingVideo(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(apiUrl('/api/forge/download-social-video'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_url: videoUrl.trim(),
          title: message.trim().slice(0, 80) || 'Facebook Video',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao baixar vídeo');
      }
      setDownloadedVideo(data);
      setVideoPreviewUrl(apiUrl(data.preview_url || data.video_url));
      if (selectedPageId && data.filename) {
        const nextScope = {
          ...scopedLibrary,
          videos: Array.from(new Set([data.filename, ...(scopedLibrary.videos || [])])),
        };
        setScopedLibrary(nextScope);
        writeScopedLibrary('facebook', selectedPageId, nextScope);
      }
      setSuccess(`Vídeo baixado para edição: ${data.filename}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingVideo(false);
    }
  };

  const applyLibraryVideo = (video) => {
    const previewUrl = apiUrl(`/api/forge/play-video/${encodeURIComponent(video.filename)}`);
    setSelectedLibraryVideo(video.filename);
    setVideoPreviewUrl(previewUrl);
    setDownloadedVideo({
      filename: video.filename,
      preview_url: previewUrl,
      local_only: true,
    });
    if (selectedPageId && video.filename) {
      const nextScope = {
        ...scopedLibrary,
        videos: Array.from(new Set([video.filename, ...(scopedLibrary.videos || [])])),
      };
      setScopedLibrary(nextScope);
      writeScopedLibrary('facebook', selectedPageId, nextScope);
    }
    setSuccess(`Vídeo da biblioteca selecionado para preview: ${video.filename}`);
  };

  const removeScopedVideo = (filename) => {
    if (!selectedPageId) return;
    const nextScope = {
      ...scopedLibrary,
      videos: (scopedLibrary.videos || []).filter((item) => item !== filename),
    };
    setScopedLibrary(nextScope);
    writeScopedLibrary('facebook', selectedPageId, nextScope);
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
      const response = await fetch(apiUrl('/api/facebook/publish'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao publicar no Facebook');
      }
      setSuccess(`Publicado no Facebook. ID: ${data.facebook_post_id || 'confirmado'}`);
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
      const title = metadataTitle.trim() || message.trim().slice(0, 80) || `Facebook ${mediaType}`;
      const response = await fetch(apiUrl('/api/schedule/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: `facebook_${Date.now()}`,
          title,
          description: composeMessage(),
          scheduled_at: scheduledAt,
          platform: 'facebook',
          facebook_page_id: payload.page_id,
          facebook_page_name: selectedPage?.page_name || '',
          facebook_media_type: payload.media_type,
          link_url: payload.link_url || '',
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
      setSuccess('Publicação do Facebook enviada para a agenda.');
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
    if (mediaType === 'video') {
      return {
        type: 'video',
        url: videoPreviewUrl || videoUrl,
        label: downloadedVideo?.filename || 'Vídeo',
      };
    }
    if (mediaType === 'image') {
      return {
        type: 'image',
        url: imagePreviewUrl || imageUrl,
        label: 'Imagem',
      };
    }
    if (mediaType === 'carousel') {
      return {
        type: 'carousel',
        items: carouselItems.filter((item) => item.preview_url || item.media_url),
        label: `${carouselItems.filter((item) => item.preview_url || item.media_url).length} imagem(ns)`,
      };
    }
    return {
      type: 'text',
      url: '',
      label: mediaType === 'link' ? linkUrl : 'Texto',
    };
  }, [carouselItems, downloadedVideo, imagePreviewUrl, imageUrl, linkUrl, mediaType, videoPreviewUrl, videoUrl]);

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
    <div className="page-container instagram-publisher-page facebook-publisher-page">
      <div className="page-header">
        <div>
          <h1>Facebook</h1>
          <p>Operacao editorial e agendamento para paginas, separado do YouTube e Instagram.</p>
        </div>

        <button className="btn-primary" type="button" onClick={loadPages} disabled={loadingPages}>
          {loadingPages ? <Loader size={18} className="instagram-spin" /> : <RefreshCw size={18} />}
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
          <Facebook size={18} />
          {success}
        </div>
      )}

      <div className="instagram-workspace">
        <section className="instagram-panel">
          <div className="panel-title">
            <Facebook size={20} />
            <h2>Página</h2>
          </div>

          {loadingPages ? (
            <div className="instagram-loading">Carregando páginas...</div>
          ) : pages.length === 0 ? (
            <div className="instagram-empty">
              <p>Nenhuma página Facebook conectada.</p>
              <a href="/conexoes">Abrir Conexões</a>
            </div>
          ) : (
            <>
              <label className="instagram-field">
                <span>Página conectada</span>
                <select value={selectedPageId} onChange={(event) => setSelectedPageId(event.target.value)}>
                  {pages.map((page) => (
                    <option value={page.page_id} key={page.page_id}>
                      {page.page_name}
                      {page.page_id === activePageId ? ' - ativa' : ''}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPage && (
                <div className="profile-summary">
                  <strong>{selectedPage.page_name}</strong>
                  <span>{selectedPage.category || selectedPage.page_id}</span>
                </div>
              )}
            </>
          )}

          <div className="instagram-note">
            Imagem e vídeo precisam estar em URL pública acessível pela Meta.
          </div>

          {(mediaType === 'video') && (
            <div className="social-library-box">
              <div className="social-library-header">
                <h3>Biblioteca local</h3>
                <button type="button" className="refresh-button" onClick={loadLibrary} disabled={loadingLibrary}>
                  {loadingLibrary ? <Loader size={15} className="instagram-spin" /> : <RefreshCw size={15} />}
                  Atualizar
                </button>
              </div>
              {localVideos.length === 0 ? (
                <div className="social-library-empty">Nenhum vídeo local encontrado.</div>
              ) : (
                <>
                  <div className="social-library-section">
                    <div className="social-library-section-head">
                      <strong>Biblioteca desta página</strong>
                      <span>{selectedPage?.page_name || 'página atual'}</span>
                    </div>
                    {scopedVideos.length === 0 ? (
                      <div className="social-library-empty">Ainda não há vídeos separados para esta página.</div>
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
                      <span>Selecionar aqui adiciona o vídeo a esta página</span>
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

          <div className="media-type-tabs facebook-tabs">
            <button className={mediaType === 'text' ? 'active' : ''} type="button" onClick={() => setMediaType('text')}>
              Texto
            </button>
            <button className={mediaType === 'link' ? 'active' : ''} type="button" onClick={() => setMediaType('link')}>
              Link
            </button>
            <button className={mediaType === 'image' ? 'active' : ''} type="button" onClick={() => setMediaType('image')}>
              Imagem
            </button>
            <button className={mediaType === 'video' ? 'active' : ''} type="button" onClick={() => setMediaType('video')}>
              Vídeo
            </button>
            <button className={mediaType === 'carousel' ? 'active' : ''} type="button" onClick={() => setMediaType('carousel')}>
              Carrossel
            </button>
          </div>

          {mediaType === 'link' && (
            <label className="instagram-field">
              <span>URL do link</span>
              <input type="url" value={linkUrl} placeholder="https://..." onChange={(event) => setLinkUrl(event.target.value)} />
            </label>
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

          {mediaType === 'video' && (
            <div className="single-media-import">
              <label className="instagram-field">
                <span>Link do vídeo</span>
                <div className="media-url-input">
                  <LinkIcon size={15} />
                  <input
                    type="url"
                    value={videoUrl}
                    placeholder="Cole link público do vídeo"
                    onChange={(event) => setVideoUrl(event.target.value)}
                    onBlur={() => {
                      if (videoUrl.trim() && !downloadedVideo && !downloadingVideo) downloadVideoForEditing();
                    }}
                  />
                </div>
              </label>
              <button className="add-media-button" type="button" onClick={downloadVideoForEditing} disabled={downloadingVideo || !videoUrl.trim()}>
                {downloadingVideo ? <Loader size={16} className="instagram-spin" /> : <Download size={16} />}
                Baixar vídeo
              </button>
            </div>
          )}

          {mediaType === 'carousel' && (
            <div className="carousel-editor">
              {carouselItems.map((item, index) => (
                <div className="media-link-card" key={`facebook-carousel-${index}`}>
                  <div className="media-link-preview">
                    {item.preview_url || item.media_url ? (
                      <img src={item.preview_url || item.media_url} alt={`Carrossel ${index + 1}`} />
                    ) : (
                      <Image size={22} />
                    )}
                  </div>
                  <div className="media-link-fields">
                    <div className="carousel-row facebook-carousel-row">
                      <span className="carousel-number">{index + 1}</span>
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
                Adicionar imagem
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
            <span>Descrição / texto da publicação</span>
            <textarea
              value={message}
              rows={8}
              maxLength={63206}
              placeholder="Texto editorial, contexto, CTA e hashtags..."
              onChange={(event) => setMessage(event.target.value)}
            />
            <small>{message.length}/63206</small>
          </label>

          <label className="instagram-field">
            <span>Hashtags</span>
            <input
              type="text"
              value={metadataHashtags}
              placeholder="#conteudo #facebook #post"
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
            <button type="button" className="publish-button" onClick={publishNow} disabled={publishing || scheduling || pages.length === 0}>
              {publishing ? <Loader size={18} className="instagram-spin" /> : <Send size={18} />}
              Publicar agora
            </button>

            <button type="button" className="schedule-button" onClick={schedulePost} disabled={publishing || scheduling || pages.length === 0}>
              {scheduling ? <Loader size={18} className="instagram-spin" /> : <CalendarClock size={18} />}
              Agendar
            </button>
          </div>

          <div className="instagram-format-box">
            {mediaType === 'text' && <Type size={18} />}
            {mediaType === 'link' && <LinkIcon size={18} />}
            {mediaType === 'image' && <Image size={18} />}
            {mediaType === 'video' && <Video size={18} />}
            {mediaType === 'carousel' && <Image size={18} />}
            <div>
              <strong>{mediaType === 'carousel' ? 'Carrossel' : 'Formato'}</strong>
              <span>O agendamento usa a mesma esteira automática e remove do painel após publicar.</span>
            </div>
          </div>

          <div className="youtube-style-preview facebook-preview">
            <div className="youtube-preview-media">
              {previewMedia.type === 'video' && previewMedia.url ? (
                <video src={previewMedia.url} controls muted playsInline />
              ) : previewMedia.type === 'image' && previewMedia.url ? (
                <img src={previewMedia.url} alt="Preview" />
              ) : previewMedia.type === 'carousel' && previewMedia.items.length > 0 ? (
                <div className="carousel-preview-grid">
                  {previewMedia.items.slice(0, 4).map((item, index) => (
                    <div key={`facebook-preview-${index}`}>
                      <img src={item.preview_url || item.media_url} alt={`Preview ${index + 1}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="youtube-preview-empty">
                  {mediaType === 'link' ? <LinkIcon size={28} /> : <Facebook size={28} />}
                </div>
              )}
            </div>
            <div className="youtube-preview-meta">
              <strong>{metadataTitle.trim() || message.trim().slice(0, 90) || `Facebook ${mediaType}`}</strong>
              <span>{selectedPage ? selectedPage.page_name : 'Página Facebook'}</span>
              <p>{previewMedia.label}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default FacebookPublisher;
