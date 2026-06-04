import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Save,
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
  const [backgroundMode, setBackgroundMode] = useState('pexels'); // 'pexels' ou 'local'
  const [keywords, setKeywords] = useState(''); // Palavras-chave para buscar
  const [screenshotPath, setScreenshotPath] = useState('');
  const [selectedImagePaths, setSelectedImagePaths] = useState([]);
  const [selectedImageUploadPaths, setSelectedImageUploadPaths] = useState([]);
  const [libraryChannelId, setLibraryChannelId] = useState(() => localStorage.getItem('alliance_forge_library_channel_id') || '');
  const [slideshowMode, setSlideshowMode] = useState(false);
  const [slideshowStyle, setSlideshowStyle] = useState('pure');
  const [socialImageUrl, setSocialImageUrl] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [downloadingSocialImage, setDownloadingSocialImage] = useState(false);
  const [downloadingVideoId, setDownloadingVideoId] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [deletingVideoFile, setDeletingVideoFile] = useState(null);
  const [deletingAudioFile, setDeletingAudioFile] = useState(null);
  const [croppingImage, setCroppingImage] = useState(false);
  const libraryRequestRef = useRef(0);
  const audioLibraryRequestRef = useRef(0);
  const ratioLockRef = useRef({ top: 70, bottom: 30 });
  const restoredDraftKeyRef = useRef('');

  // Estados de dados
  const [pexelsVideos, setPexelsVideos] = useState([]);
  const [localVideos, setLocalVideos] = useState([]);
  const [localAudios, setLocalAudios] = useState([]);
  const [searching, setSearching] = useState(false);
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
  const [metadataCategory, setMetadataCategory] = useState('22');
  const [metadataPrivacyStatus, setMetadataPrivacyStatus] = useState('private');
  const [scheduleDateTime, setScheduleDateTime] = useState('');

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

  const loadLocalVideos = useCallback(async (channelId = libraryChannelId || localStorage.getItem('alliance_forge_library_channel_id') || '') => {
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

  const loadLocalAudios = useCallback(async (channelId = libraryChannelId || localStorage.getItem('alliance_forge_library_channel_id') || '') => {
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
    loadLocalVideos(localStorage.getItem('alliance_forge_library_channel_id') || '');
    loadLocalAudios(localStorage.getItem('alliance_forge_library_channel_id') || '');
    const capturedImage = localStorage.getItem('forge_selected_image');
    if (capturedImage) {
      setScreenshotPath(capturedImage);
      localStorage.removeItem('forge_selected_image');
    }
  }, [loadLocalAudios, loadLocalVideos]);

  useEffect(() => {
    const syncActiveLibraryChannel = async () => {
      const storedChannelId = localStorage.getItem('alliance_forge_library_channel_id') || '';
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
          localStorage.setItem('alliance_forge_library_channel_id', activeChannelId);
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
      const nextChannelId = localStorage.getItem('alliance_forge_library_channel_id') || '';
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
      const channelId = video.channel_id || libraryChannelId || localStorage.getItem('alliance_forge_library_channel_id') || '';
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
      const channelId = audio.channel_id || libraryChannelId || localStorage.getItem('alliance_forge_library_channel_id') || '';
      const query = channelId ? `?channel_id=${encodeURIComponent(channelId)}` : '';
      return apiUrl(`/api/forge/play-audio/${encodeURIComponent(filename)}${query}`);
    }
    return '';
  };

  const getDraftKey = useCallback((channelId) => {
    const resolvedChannelId = channelId || libraryChannelId || localStorage.getItem('alliance_forge_library_channel_id') || 'default';
    return `${FORGE_DRAFT_KEY_PREFIX}${resolvedChannelId}`;
  }, [libraryChannelId]);

  const topGuidePercent = Math.max(0, Math.min(40, imageCropX));
  const bottomGuidePercent = Math.max(0, Math.min(40, imageCropY));
  const verticalCenterPercent = Math.max(
    0,
    Math.min(100, (topGuidePercent + (100 - bottomGuidePercent)) / 2)
  );

  useEffect(() => {
    const draftKey = getDraftKey();
    if (!draftKey || restoredDraftKeyRef.current === draftKey) {
      return;
    }

    restoredDraftKeyRef.current = draftKey;

    try {
      const rawDraft = localStorage.getItem(draftKey);
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
      setBackgroundMode(draft.backgroundMode || 'pexels');
      setKeywords(draft.keywords || '');
      setScreenshotPath(draft.screenshotPath || '');
      setSelectedImagePaths(Array.isArray(draft.selectedImagePaths) ? draft.selectedImagePaths : []);
      setSelectedImageUploadPaths(Array.isArray(draft.selectedImageUploadPaths) ? draft.selectedImageUploadPaths : []);
      setSlideshowMode(Boolean(draft.slideshowMode));
      setSlideshowStyle(draft.slideshowStyle || 'pure');
      setSocialImageUrl(draft.socialImageUrl || '');
      setSelectedVideo(draft.selectedVideo || null);
      setSelectedAudio(draft.selectedAudio || null);
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
      renderResult ||
      metadataTitle ||
      metadataDescription ||
      metadataHashtags ||
      scheduleDateTime ||
      scheduleMessage
    );

    if (!hasDraftContent) {
      localStorage.removeItem(draftKey);
      return;
    }

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
      keywords,
      screenshotPath: safeScreenshotPath,
      selectedImagePaths: safeImagePaths.length ? safeImagePaths : selectedImageUploadPaths,
      selectedImageUploadPaths,
      slideshowMode,
      slideshowStyle,
      socialImageUrl,
      selectedVideo,
      selectedAudio,
      renderResult,
      metadataTitle,
      metadataDescription,
      metadataHashtags,
      metadataCategory,
      metadataPrivacyStatus,
      scheduleDateTime,
      scheduleMessage,
    };

    localStorage.setItem(draftKey, JSON.stringify(draftPayload));
  }, [
    backgroundMode,
    bottomRatio,
    getDraftKey,
    imageCropX,
    imageCropY,
    imageFit,
    keywords,
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
    selectedVideo,
    slideshowMode,
    slideshowStyle,
    socialImageUrl,
    topRatio,
    videoFit,
  ]);

  const clearForgeDraft = useCallback(() => {
    const draftKey = getDraftKey();
    if (draftKey) {
      localStorage.removeItem(draftKey);
    }
  }, [getDraftKey]);

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setUploadingImage(true);
    setError('');

    try {
      if (slideshowMode) {
        const imageFiles = files.filter((file) => file.type.startsWith('image/')).slice(0, 6);
        if (imageFiles.length < 2) {
          throw new Error('Selecione de 2 a 6 imagens para o modo sequência');
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
        setSelectedVideo({
          filename: data.filename,
          path: data.filepath,
          url: apiUrl(data.video_url || `/api/forge/play-video/${data.filename}`),
          thumbnail: videoPreviewUrl,
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao baixar imagem do link');
      }

      const data = await response.json();
      setScreenshotPath(apiUrl(data.image_url));
      setSocialImageUrl('');
      setRenderResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingSocialImage(false);
    }
  };

  const handleDownloadVideo = async (video) => {
    setDownloadingVideoId(video.id);
    setError('');
    const channelId = libraryChannelId || localStorage.getItem('alliance_forge_library_channel_id') || '';

    try {
      const response = await fetch(apiUrl('/api/forge/download-video'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: video.url,
          video_id: video.id,
          channel_id: channelId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao baixar vídeo');
      }

      const data = await response.json();
      alert(`✅ Vídeo baixado com sucesso!\nSalvo em: ${data.filename}`);

      // Recarregar lista de vídeos locais
      loadLocalVideos(channelId);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingVideoId(null);
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
    const channelId = libraryChannelId || localStorage.getItem('alliance_forge_library_channel_id') || '';

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

      // Recarregar lista de vídeos locais
      loadLocalVideos(channelId);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingVideo(false);
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
    const channelId = libraryChannelId || localStorage.getItem('alliance_forge_library_channel_id') || '';

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
    const channelId = selectedVideo?.channel_id || libraryChannelId || localStorage.getItem('alliance_forge_library_channel_id') || '';

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

  const handleDeleteAudio = async (filename) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Tem certeza que quer deletar este áudio?\n${filename}`)) {
      return;
    }

    setDeletingAudioFile(filename);
    setError('');
    const channelId = selectedAudio?.channel_id || libraryChannelId || localStorage.getItem('alliance_forge_library_channel_id') || '';

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

  const handleSearchPexels = async () => {
    if (!keywords.trim()) {
      setError('Digite palavras-chave para buscar');
      return;
    }

    setSearching(true);
    setError('');

    try {
      const response = await fetch(
        apiUrl(`/api/forge/search-pexels/${encodeURIComponent(keywords)}`)
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar vídeos');
      }

      const data = await response.json();
      setPexelsVideos(data.videos || []);

      if (data.videos.length === 0) {
        setError('Nenhum vídeo encontrado com essas palavras-chave');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
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

  const shortVideoName = (filename = '') => {
    if (filename.length <= 26) return filename;
    return `${filename.slice(0, 12)}...${filename.slice(-10)}`;
  };

  const getUploadedImageName = () => {
    const renderSource = slideshowMode
      ? (selectedImageUploadPaths[0] || screenshotPath || '')
      : (screenshotPath || '');

    if (!renderSource) return '';
    if (renderSource.includes('/api/forge/uploaded/')) {
      return renderSource.split('/api/forge/uploaded/')[1];
    }
    if (renderSource.includes('uploads/')) {
      return renderSource.split('uploads/')[1];
    }
    return renderSource;
  };

  const getUploadedImageNames = () => {
    const resolved = slideshowMode
      ? selectedImageUploadPaths
      : (screenshotPath ? [screenshotPath] : []);
    return resolved
      .map((path) => {
        if (!path) return '';
        if (path.includes('/api/forge/uploaded/')) {
          return path.split('/api/forge/uploaded/')[1];
        }
        if (path.includes('uploads/')) {
          return path.split('uploads/')[1];
        }
        return path;
      })
      .filter(Boolean);
  };

  const activePreviewImage = screenshotPath || selectedImagePaths[0] || '';
  const hasPreviewImage = Boolean(activePreviewImage);

  const reorderSlideshowImage = (index, direction) => {
    setSelectedImagePaths((prev) => {
      if (!prev.length) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;

      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
    setSelectedImageUploadPaths((prev) => {
      if (!prev.length) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;

      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  const makeSlideshowFirstImage = (index) => {
    setSelectedImagePaths((prev) => {
      if (!prev.length || index <= 0 || index >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      return next;
    });
    setSelectedImageUploadPaths((prev) => {
      if (!prev.length || index <= 0 || index >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      return next;
    });
  };

  const handleRender = async () => {
    if (!hasPreviewImage) {
      setError('Selecione uma screenshot da captura universal');
      return;
    }

    if (slideshowMode && getUploadedImageNames().length < 2) {
      setError('Selecione de 2 a 6 imagens para o modo sequência');
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
    setRenderResult(null);
    setMetadataTitle('');
    setMetadataDescription('');
    setMetadataHashtags('');
    setScheduleDateTime('');
    setScheduleMessage('');

    const ratioSnapshot = {
      top: ratioLockRef.current.top ?? topRatio,
      bottom: ratioLockRef.current.bottom ?? bottomRatio,
    };

    try {
      // Extrair apenas o nome do arquivo
      const imagePath = getUploadedImageName();
      const imagePaths = getUploadedImageNames();

      const renderPayload = {
        screenshot_path: imagePath,
        background_mode: backgroundMode,
        background_video: backgroundMode === 'local'
          ? (selectedVideo?.path || selectedVideo?.filename || '')
          : (selectedVideo?.url || selectedVideo?.filename || ''),
        background_audio: selectedAudio?.filename || '',
        image_paths: slideshowMode ? imagePaths : [],
        top_ratio: topRatio / 100,
        bottom_ratio: bottomRatio / 100,
        render_mode: slideshowMode
          ? 'slideshow'
          : (bottomRatio === 0 && selectedVideo ? 'post_overlay' : (bottomRatio === 0 || !selectedVideo ? 'image_only' : 'stack')),
        post_scale: postScale / 100,
        post_y: postY / 100,
        image_fit: imageFit,
        image_crop_x: 0.5,
        image_crop_y: verticalCenterPercent / 100,
        video_fit: videoFit,
        slideshow_seconds_per_image: 3,
        slideshow_intro_seconds: 1.5,
        slideshow_style: slideshowStyle
      };

      const response = await fetch(apiUrl('/api/forge/render'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(renderPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao renderizar');
      }

      const data = await response.json();
      setRenderResult(data);
      setTopRatio(ratioSnapshot.top);
      setBottomRatio(ratioSnapshot.bottom);
      setMetadataPrivacyStatus('private');
      setScheduleDateTime(getDefaultScheduleDateTime());
    } catch (err) {
      setError(err.message);
    } finally {
      setTopRatio(ratioSnapshot.top);
      setBottomRatio(ratioSnapshot.bottom);
      setRendering(false);
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
          video_id: renderResult.video_id || renderResult.id,
          platform: 'youtube_shorts',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao gerar com ChatGPT');
      }

      const data = await response.json();
      setMetadataTitle(data.title || '');
      setMetadataDescription(data.description || '');
      setMetadataHashtags((data.hashtags || []).join(' '));
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
      setScreenshotPath(nextImageUrl);
      setImageFit('cover');
      setRenderResult(null);

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

  return (
    <div className="forge-editor-container">
      <div className="forge-header">
        <h1>🔨 The Forge 70/30</h1>
        <p>Renderizador de Vídeos Vertical com IA e Controle Avançado</p>
      </div>

      <div className="forge-grid">
        {/* Coluna 1: Controles */}
        <div className="forge-controls">
          {/* Section 1: Screenshot Upload */}
          <div className="control-section upload-section-full">
            <h3>📸 Imagem da Biblioteca</h3>

            <div className="mode-toggle media-mode-toggle">
              <button
                type="button"
                onClick={() => {
                  setSlideshowMode(false);
                  setSlideshowStyle('pure');
                  setSelectedImagePaths((prev) => prev.slice(0, 1));
                  setSelectedImageUploadPaths((prev) => prev.slice(0, 1));
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
                Sequência até 6 imagens
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
                    Baixar imagem
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
                        <p>Clique para selecionar {slideshowMode ? 'até 6 imagens' : 'imagem ou vídeo'}</p>
                        <span className="upload-hint">
                          {slideshowMode ? 'Somente imagens para criar a sequência' : 'JPG, PNG, MP4, MOV e similares'}
                        </span>
                      </>
                    )}
                  </div>
                </label>
              </div>
            ) : (
              <div className="image-preview-container">
                <div className="screenshot-preview-large">
                  {hasPreviewImage ? (
                    <img src={activePreviewImage} alt="Preview da imagem" />
                  ) : selectedVideo ? (
                    <video src={getSelectedVideoSource(selectedVideo)} controls className="rendered-video" style={{ width: '100%', aspectRatio: '9/16', objectFit: 'contain' }} />
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
                    if (slideshowMode) {
                      setSelectedVideo(null);
                    }
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
                    <img src={path} alt={`Slide ${index + 1}`} />
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Background Mode */}
          <div className="control-section">
            <h3>🎬 Modo de Fundo</h3>

            <div className="mode-toggle">
              <button
                onClick={() => setBackgroundMode('pexels')}
                className={`mode-button ${backgroundMode === 'pexels' ? 'active' : ''}`}
              >
                <span className="icon">🤖</span>
                IA Automática (Pexels)
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

          {/* Section 3: Video Selection */}
          <div className="control-section">
            {backgroundMode === 'pexels' ? (
              <>
                <h3>🔍 Buscar Vídeo (Pexels)</h3>
                <div className="search-group">
                  <input
                    type="text"
                    placeholder="Ex: nature, sunset, abstract..."
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchPexels()}
                    className="input-field"
                    disabled={searching}
                  />
                  <button
                    onClick={handleSearchPexels}
                    disabled={searching || !keywords.trim()}
                    className="search-button"
                  >
                    {searching ? (
                      <Loader size={16} className="spinner" />
                    ) : (
                      <Search size={16} />
                    )}
                    {searching ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>

                <div className="videos-grid-10">
                  {pexelsVideos.map((video) => (
                    <div key={video.id} className="video-card-with-checkbox">
                      <img src={video.thumbnail} alt={video.id} className="video-thumbnail" />
                      <div className="checkbox-wrapper">
                        <input
                          type="radio"
                          name="selected-video"
                          id={`video-${video.id}`}
                          checked={selectedVideo?.id === video.id}
                          onChange={() => setSelectedVideo(video)}
                          className="video-checkbox"
                        />
                        <label htmlFor={`video-${video.id}`} className="checkbox-label">
                          ⏱️ {video.duration}s
                        </label>
                      </div>
                      <button
                        onClick={() => handleDownloadVideo(video)}
                        disabled={downloadingVideoId === video.id}
                        className="download-video-button"
                        title="Salvar na biblioteca"
                      >
                        {downloadingVideoId === video.id ? (
                          <>
                            <Loader size={14} className="spinner" />
                          </>
                        ) : (
                          <>
                            <Save size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
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
                <div className="videos-grid-10">
                  {localVideos.map((video) => (
                    <div
                      key={video.filename}
                      className={`video-card-with-checkbox local-video-card ${selectedVideo?.filename === video.filename ? 'selected' : ''}`}
                      onClick={() => setSelectedVideo(video)}
                      title={video.filename}
                    >
                      <div className="local-video-preview-wrap">
                        <video
                          src={getSelectedVideoSource(video)}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          className="local-video-preview"
                          onMouseEnter={playLocalPreview}
                          onMouseLeave={resetLocalPreview}
                        />
                        <div className="local-video-overlay">
                          <span className="local-video-duration">{video.duration.toFixed(1)}s</span>
                          <span className={`local-video-ratio ${video.aspect_ratio === '9:16' ? 'vertical' : 'other'}`}>
                            {video.aspect_ratio === '9:16' ? '9:16' : 'OUTRO'}
                          </span>
                          <strong>{shortVideoName(video.filename)}</strong>
                        </div>
                        {selectedVideo?.filename === video.filename && (
                          <div className="local-selected-mark">
                            <Check size={14} />
                          </div>
                        )}
                        {selectedVideo?.filename === video.filename && (
                          <button
                            type="button"
                            className="local-selected-clear"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedVideo(null);
                            }}
                            title="Desmarcar vídeo"
                            aria-label="Desmarcar vídeo selecionado"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <div className="checkbox-wrapper">
                        <input
                          type="radio"
                          name="selected-video"
                          id={`local-video-${video.filename}`}
                          checked={selectedVideo?.filename === video.filename}
                          onChange={() => setSelectedVideo(video)}
                          onClick={(event) => event.stopPropagation()}
                          className="video-checkbox"
                        />
                        <label htmlFor={`local-video-${video.filename}`} className="checkbox-label">
                          Selecionar
                        </label>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteVideo(video.filename);
                        }}
                        disabled={deletingVideoFile === video.filename}
                        className="delete-video-button"
                        title="Deletar vídeo"
                      >
                        {deletingVideoFile === video.filename ? (
                          <Loader size={14} className="spinner" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Preview Thumbnail do Vídeo Selecionado */}
                {selectedVideo && backgroundMode === 'local' && (
                  <div className="video-selected-preview-small">
                    <video
                      src={getSelectedVideoSource(selectedVideo)}
                      controls
                      className="video-thumb"
                    />
                    <span className="selected-video-name">✓ {shortVideoName(selectedVideo.filename)}</span>
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
                    <span>Envie um vídeo acima ou baixe dos Pexels</span>
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
              (slideshowMode && selectedImagePaths.length < 2) ||
              (slideshowMode && slideshowStyle === 'mixed' && !selectedVideo)
            }
            className="render-button"
          >
            {rendering ? (
              <>
                <Loader size={18} className="spinner" />
                Renderizando... (pode levar até 2 min)
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
                  <h4>Dados editoriais</h4>
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
                      onClick={() => setImageFit('contain')}
                    >
                      Inteira
                    </button>
                    <button
                      type="button"
                      className={imageFit === 'cover' ? 'active' : ''}
                      onClick={() => setImageFit('cover')}
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
                            onInput={(e) => setImageCropX(parseInt(e.target.value, 10))}
                            onChange={(e) => setImageCropX(parseInt(e.target.value, 10))}
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
                            onInput={(e) => setImageCropY(parseInt(e.target.value, 10))}
                            onChange={(e) => setImageCropY(parseInt(e.target.value, 10))}
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

            <div className="preview-container">
              <div className="preview-frame">
                {hasPreviewImage && bottomRatio === 0 && selectedVideo ? (
                    <div className="post-overlay-preview">
                    {getSelectedVideoSource(selectedVideo) ? (
                      <video
                        src={getSelectedVideoSource(selectedVideo)}
                        className="post-background"
                        style={{ width: '100%', height: '100%', objectFit: videoFit }}
                      />
                    ) : selectedVideo?.thumbnail ? (
                      <img src={selectedVideo.thumbnail} alt="Video" className="post-background" style={{ objectFit: videoFit }} />
                    ) : null}

                    <img
                      src={screenshotPath}
                      alt="Post centralizado"
                      className="post-foreground"
                      style={{
                        width: `${postScale}%`,
                        top: `${postY}%`,
                      }}
                    />
                    <span className="label">Post sobre vídeo</span>
                  </div>
                ) : hasPreviewImage ? (
                    <>
                    <div className="frame-screenshot" style={{ height: `${topRatio}%` }}>
                      <img
                        src={activePreviewImage}
                        alt="Screenshot"
                        style={{
                          objectFit: imageFit,
                          objectPosition: `50% ${verticalCenterPercent}%`,
                        }}
                      />
                      {imageFit === 'cover' && (
                        <div className="image-guide-overlay" aria-hidden="true">
                          <div className="image-guide-line top" style={{ top: `${topGuidePercent}%` }} />
                          <div className="image-guide-line bottom" style={{ bottom: `${bottomGuidePercent}%` }} />
                        </div>
                      )}
                      <span className="label">{bottomRatio === 0 ? 'Imagem inteira' : 'Screenshot'} ({topRatio}%)</span>
                    </div>

                    {bottomRatio > 0 && selectedVideo && (
                      <div className="frame-video" style={{ height: `${bottomRatio}%` }}>
                        {getSelectedVideoSource(selectedVideo) ? (
                          <video
                            src={getSelectedVideoSource(selectedVideo)}
                            className="video-preview"
                            style={{ width: '100%', height: '100%', objectFit: videoFit }}
                          />
                        ) : selectedVideo?.thumbnail ? (
                          <img src={selectedVideo.thumbnail} alt="Video" style={{ objectFit: videoFit }} />
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
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ForgeEditor;
