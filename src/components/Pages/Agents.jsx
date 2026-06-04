import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, CheckSquare, Loader, MessageSquare, RefreshCw, Send, Sparkles, Square, Trash2 } from 'lucide-react';
import { apiUrl } from '../../config/api';
import './Pages.css';
import './Agents.css';

const AUTH_TOKEN_KEY = 'alliance_dark_auth_token';
const AGENTS_QUEUE_STORAGE_PREFIX = 'alliance_dark_agents_queue_v1';

const DEFAULT_BATCH_PROGRESS = {
  total: 0,
  processed: 0,
  replied: 0,
  skipped: 0,
  errors: 0,
};

function Agents() {
  const [sourcePlatform, setSourcePlatform] = useState('youtube');
  const [channels, setChannels] = useState([]);
  const [instagramProfiles, setInstagramProfiles] = useState([]);
  const [facebookPages, setFacebookPages] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [replyStats, setReplyStats] = useState({
    youtube: 0,
    instagram: 0,
    facebook: 0,
    tiktok: 0,
  });
  const [replyChannelStats, setReplyChannelStats] = useState({
    youtube: [],
  });
  const [commentItem, setCommentItem] = useState(null);
  const [commentQueue, setCommentQueue] = useState([]);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [fetchCount, setFetchCount] = useState(5);
  const [replyIntervalSeconds, setReplyIntervalSeconds] = useState(5);
  const [robotResponderEnabled, setRobotResponderEnabled] = useState(false);
  const [showRobotConfig, setShowRobotConfig] = useState(false);
  const [robotFetchCount, setRobotFetchCount] = useState(20);
  const [robotIntervalSeconds, setRobotIntervalSeconds] = useState(5);
  const [robotAutoRepeatEnabled, setRobotAutoRepeatEnabled] = useState(true);
  const [robotRepeatEvery, setRobotRepeatEvery] = useState(30);
  const [robotRepeatUnit, setRobotRepeatUnit] = useState('minutes');
  const [robotStarting, setRobotStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchingComment, setFetchingComment] = useState(false);
  const [generatingReply, setGeneratingReply] = useState(false);
  const [publishingReply, setPublishingReply] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState(DEFAULT_BATCH_PROGRESS);
  const [savingLead, setSavingLead] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const batchStopRef = useRef(false);
  const batchPollRef = useRef(null);
  const robotRepeatTimeoutRef = useRef(null);
  const previousRunningBatchRef = useRef(false);
  const startRobotResponderRef = useRef(null);
  const hydratedQueueKeyRef = useRef('');
  const selectedCommentId = commentItem?.comment_id || null;

  const clearAgentWorkspace = useCallback(() => {
    setCommentQueue([]);
    setSelectedQueueIds([]);
    setCommentItem(null);
    setReplyText('');
    setError('');
    setSuccessMessage('');
  }, []);

  const sanitizeQueueItems = useCallback((items) => {
    const seenIds = new Set();
    return (Array.isArray(items) ? items : []).filter((item) => {
      const commentId = String(item?.comment_id || '').trim();
      const text = String(item?.text || '').trim();
      const status = String(item?.status || '').toLowerCase();
      if (!commentId || !text || seenIds.has(commentId)) {
        return false;
      }
      if (status === 'done' || status === 'skipped') {
        return false;
      }
      seenIds.add(commentId);
      return true;
    });
  }, []);

  const persistQueueState = useCallback((storageKey, nextState) => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }

    const snapshot = {
      commentQueue: Array.isArray(nextState?.commentQueue) ? nextState.commentQueue : [],
      selectedQueueIds: Array.isArray(nextState?.selectedQueueIds) ? nextState.selectedQueueIds : [],
      selectedCommentId: nextState?.selectedCommentId || null,
      replyText: typeof nextState?.replyText === 'string' ? nextState.replyText : '',
      runningBatch: Boolean(nextState?.runningBatch),
      batchProgress: nextState?.batchProgress || DEFAULT_BATCH_PROGRESS,
      updatedAt: new Date().toISOString(),
    };

    if (
      snapshot.commentQueue.length === 0
      && !snapshot.runningBatch
      && snapshot.selectedQueueIds.length === 0
      && !snapshot.selectedCommentId
    ) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, []);

  const getQueueStorageKey = useCallback((platform, channelId) => {
    if (!platform || !channelId) {
      return '';
    }
    return `${AGENTS_QUEUE_STORAGE_PREFIX}:${platform}:${channelId}`;
  }, []);

  const buildQueueSnapshot = useCallback(() => ({
    commentQueue,
    selectedQueueIds,
    selectedCommentId,
    replyText,
    runningBatch,
    batchProgress,
    updatedAt: new Date().toISOString(),
  }), [batchProgress, commentQueue, replyText, runningBatch, selectedCommentId, selectedQueueIds]);

  const restoreQueueState = useCallback((storageKey) => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }

    hydratedQueueKeyRef.current = storageKey;
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      setCommentQueue([]);
      setSelectedQueueIds([]);
      setCommentItem(null);
      setReplyText('');
      setRunningBatch(false);
      setBatchProgress(DEFAULT_BATCH_PROGRESS);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const restoredQueue = sanitizeQueueItems(parsed.commentQueue);
      const restoredSelection = Array.isArray(parsed.selectedQueueIds)
        ? parsed.selectedQueueIds.filter((id) => restoredQueue.some((item) => item.comment_id === id))
        : restoredQueue.map((item) => item.comment_id);
      const restoredComment = restoredQueue.find((item) => item.comment_id === parsed.selectedCommentId)
        || restoredQueue[0]
        || null;

      setCommentQueue(restoredQueue);
      setSelectedQueueIds(restoredSelection);
      setCommentItem(restoredComment);
      setReplyText(typeof parsed.replyText === 'string' ? parsed.replyText : (restoredComment?.generated_reply || ''));
      setRunningBatch(Boolean(parsed.runningBatch));
      setBatchProgress({
        total: Number(parsed.batchProgress?.total || 0),
        processed: Number(parsed.batchProgress?.processed || 0),
        replied: Number(parsed.batchProgress?.replied || 0),
        skipped: Number(parsed.batchProgress?.skipped || 0),
        errors: Number(parsed.batchProgress?.errors || 0),
      });
      persistQueueState(storageKey, {
        commentQueue: restoredQueue,
        selectedQueueIds: restoredSelection,
        selectedCommentId: restoredComment?.comment_id || null,
        replyText: typeof parsed.replyText === 'string' ? parsed.replyText : (restoredComment?.generated_reply || ''),
        runningBatch: Boolean(parsed.runningBatch),
        batchProgress: {
          total: Number(parsed.batchProgress?.total || 0),
          processed: Number(parsed.batchProgress?.processed || 0),
          replied: Number(parsed.batchProgress?.replied || 0),
          skipped: Number(parsed.batchProgress?.skipped || 0),
          errors: Number(parsed.batchProgress?.errors || 0),
        },
      });
    } catch (err) {
      window.localStorage.removeItem(storageKey);
      setCommentQueue([]);
      setSelectedQueueIds([]);
      setCommentItem(null);
      setReplyText('');
      setRunningBatch(false);
      setBatchProgress(DEFAULT_BATCH_PROGRESS);
    }
  }, [persistQueueState, sanitizeQueueItems]);

  useEffect(() => {
    if (sourcePlatform !== 'youtube' || !selectedChannelId) {
      hydratedQueueKeyRef.current = '';
      return;
    }

    const storageKey = getQueueStorageKey(sourcePlatform, selectedChannelId);
    restoreQueueState(storageKey);
  }, [getQueueStorageKey, restoreQueueState, selectedChannelId, sourcePlatform]);

  useEffect(() => {
    const storageKey = getQueueStorageKey(sourcePlatform, selectedChannelId);
    if (!storageKey || hydratedQueueKeyRef.current !== storageKey || typeof window === 'undefined') {
      return;
    }

    const snapshot = buildQueueSnapshot();
    if (
      snapshot.commentQueue.length === 0
      && !snapshot.runningBatch
      && snapshot.selectedQueueIds.length === 0
      && !snapshot.selectedCommentId
    ) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [buildQueueSnapshot, getQueueStorageKey, selectedChannelId, sourcePlatform]);

  const cleanupQueueBeforeBatch = useCallback(() => {
    const storageKey = getQueueStorageKey(sourcePlatform, selectedChannelId);
    const sanitizedQueue = sanitizeQueueItems(commentQueue);
    const sanitizedSelection = selectedQueueIds.filter((id) => sanitizedQueue.some((item) => item.comment_id === id));
    const nextComment = sanitizedQueue.find((item) => sanitizedSelection.includes(item.comment_id)) || sanitizedQueue[0] || null;
    const nextReplyText = nextComment?.generated_reply || '';
    const changed = (
      sanitizedQueue.length !== commentQueue.length
      || sanitizedSelection.length !== selectedQueueIds.length
      || (commentItem?.comment_id || null) !== (nextComment?.comment_id || null)
    );

    if (changed) {
      setCommentQueue(sanitizedQueue);
      setSelectedQueueIds(sanitizedSelection);
      setCommentItem(nextComment);
      setReplyText(nextReplyText);
      persistQueueState(storageKey, {
        commentQueue: sanitizedQueue,
        selectedQueueIds: sanitizedSelection,
        selectedCommentId: nextComment?.comment_id || null,
        replyText: nextReplyText,
        runningBatch,
        batchProgress,
      });
    }

    return {
      queue: sanitizedQueue,
      selectedIds: sanitizedSelection,
      selectedComment: nextComment,
    };
  }, [
    batchProgress,
    commentItem?.comment_id,
    commentQueue,
    getQueueStorageKey,
    persistQueueState,
    runningBatch,
    sanitizeQueueItems,
    selectedChannelId,
    selectedQueueIds,
    sourcePlatform,
  ]);

  const getAuthHeaders = () => {
    const authToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  };

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [youtubeResponse, instagramResponse, facebookResponse] = await Promise.all([
        fetch(apiUrl('/api/agents/youtube/channels'), { headers: getAuthHeaders() }),
        fetch(apiUrl('/api/instagram/status'), { headers: getAuthHeaders() }),
        fetch(apiUrl('/api/facebook/status'), { headers: getAuthHeaders() }),
      ]);

      const youtubeData = await youtubeResponse.json();
      const instagramData = await instagramResponse.json();
      const facebookData = await facebookResponse.json();

      if (!youtubeResponse.ok) {
        throw new Error(youtubeData.detail || 'Erro ao carregar canais');
      }

      const youtubeItems = youtubeData.items || [];
      const instagramItems = instagramData.profiles || [];
      const facebookItems = facebookData.pages || [];

      setChannels(youtubeItems);
      setInstagramProfiles(instagramItems);
      setFacebookPages(facebookItems);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    const currentItems = sourcePlatform === 'youtube'
      ? channels
      : sourcePlatform === 'instagram'
        ? instagramProfiles
        : facebookPages;
    const idKey = sourcePlatform === 'youtube'
      ? 'channel_id'
      : sourcePlatform === 'instagram'
        ? 'profile_id'
        : 'page_id';

    if (currentItems.length === 0) {
      setSelectedChannelId('');
      return;
    }

    setSelectedChannelId((current) => {
      if (current && currentItems.some((item) => item[idKey] === current)) {
        return current;
      }
      return currentItems.find((item) => item.is_active)?.[idKey] || currentItems[0][idKey];
    });
  }, [sourcePlatform, channels, instagramProfiles, facebookPages]);

  useEffect(() => () => {
    batchStopRef.current = true;
    if (batchPollRef.current) {
      window.clearInterval(batchPollRef.current);
    }
    if (robotRepeatTimeoutRef.current) {
      window.clearTimeout(robotRepeatTimeoutRef.current);
    }
  }, []);

  const loadReplyStats = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/api/agents/reply-stats'), {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao carregar contadores');
      }
      setReplyStats(data.counts || {
        youtube: 0,
        instagram: 0,
        facebook: 0,
        tiktok: 0,
      });
      setReplyChannelStats(data.channels || { youtube: [] });
    } catch (err) {
      // contadores nao devem quebrar o restante da tela
    }
  }, []);

  useEffect(() => {
    loadReplyStats();
  }, [loadReplyStats]);

  const fetchCommentsBatchInternal = async (requestedLimit = fetchCount, shouldAnnounce = true) => {
    if (sourcePlatform !== 'youtube') {
      setError(`Captura de comentarios para ${sourcePlatform === 'instagram' ? 'Instagram' : 'Facebook'} ainda está em preparação.`);
      return [];
    }
    if (!selectedChannelId) {
      setError('Selecione um canal para buscar comentarios');
      return [];
    }

    const storageKey = getQueueStorageKey(sourcePlatform, selectedChannelId);
    if (
      storageKey
      && hydratedQueueKeyRef.current === storageKey
      && Array.isArray(commentQueue)
      && commentQueue.length > 0
    ) {
      const cachedItems = commentQueue.slice(0, Math.max(1, Math.min(requestedLimit, 300)));
      setCommentQueue(cachedItems);
      setCommentItem((current) => (
        current && cachedItems.some((item) => item.comment_id === current.comment_id)
          ? current
          : cachedItems[0] || null
      ));
      setSelectedQueueIds((current) => (
        current.length > 0
          ? current.filter((id) => cachedItems.some((item) => item.comment_id === id))
          : cachedItems.map((item) => item.comment_id)
      ));
      if (shouldAnnounce) {
        setSuccessMessage(`Reutilizando a última busca salva para este canal (${cachedItems.length} comentario(s)).`);
      }
      return cachedItems;
    }

    setFetchingComment(true);
    setError('');
    if (shouldAnnounce) {
      setSuccessMessage('');
    }

    try {
      const response = await fetch(
        apiUrl(
          `/api/agents/youtube/fetch-comments?channel_id=${encodeURIComponent(selectedChannelId)}&limit=${Math.max(1, Math.min(requestedLimit, 300))}&fetch_all=false`,
        ),
        { headers: getAuthHeaders() },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao buscar comentarios');
      }

      const items = (data.items || []).map((item) => ({ ...item, status: 'pending', generated_reply: '' }));
      setCommentQueue(items);
      setCommentItem(items[0] || null);
      setSelectedQueueIds(items.map((item) => item.comment_id));
      setReplyText('');
      if (shouldAnnounce) {
        setSuccessMessage(`${items.length} comentario(s) preparado(s) para o agente.`);
      }
      return items;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setFetchingComment(false);
    }
  };

  const fetchCommentsBatch = async () => {
    await fetchCommentsBatchInternal(fetchCount, true);
  };

  const generateRepliesForTargets = async (targets, shouldAnnounce = true, baseQueue = null) => {
    if (sourcePlatform !== 'youtube') {
      setError(`Geracao de respostas para ${sourcePlatform === 'instagram' ? 'Instagram' : 'Facebook'} ainda está em preparação.`);
      return [];
    }
    if (targets.length === 0) {
      setError('Selecione pelo menos um comentario para gerar resposta');
      return [];
    }

    setGeneratingReply(true);
    setError('');
    if (shouldAnnounce) {
      setSuccessMessage('');
    }

    try {
      const response = await fetch(apiUrl('/api/agents/youtube/generate-replies-batch'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          channel_id: selectedChannelId,
          items: targets.map((target) => ({
            comment_id: target.comment_id,
            comment_text: target.text,
            author_name: target.author_name,
            video_title: target.video_title || '',
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao gerar respostas em lote');
      }

      const repliesMap = new Map((data.items || []).map((item) => [item.comment_id, item.reply_text || '']));
      const sourceQueue = Array.isArray(baseQueue) && baseQueue.length > 0 ? baseQueue : commentQueue;
      const nextQueue = sourceQueue.map((item) => (
        repliesMap.has(item.comment_id)
          ? { ...item, generated_reply: repliesMap.get(item.comment_id) || '' }
          : item
      ));
      setCommentQueue(nextQueue);

      const firstTarget = targets.find((target) => repliesMap.has(target.comment_id));
      if (firstTarget) {
        const resolvedFirst = nextQueue.find((item) => item.comment_id === firstTarget.comment_id) || firstTarget;
        setCommentItem(resolvedFirst);
        setReplyText(repliesMap.get(firstTarget.comment_id) || '');
      }
      if (shouldAnnounce) {
        setSuccessMessage(`Resposta gerada para ${targets.length} comentario(s) selecionado(s).`);
      }
      return nextQueue.filter((item) => targets.some((target) => target.comment_id === item.comment_id));
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setGeneratingReply(false);
    }
  };

  const generateReply = async () => {
    const targets = commentQueue.filter((item) => selectedQueueIds.includes(item.comment_id));
    await generateRepliesForTargets(targets, true);
  };

  const generateRepliesInChunks = async (items, baseQueue = null, chunkSize = 20) => {
    const normalizedItems = Array.isArray(items) ? items : [];
    if (normalizedItems.length === 0) {
      return [];
    }

    let workingQueue = Array.isArray(baseQueue) && baseQueue.length > 0 ? baseQueue : commentQueue;
    const collected = [];

    for (let index = 0; index < normalizedItems.length; index += chunkSize) {
      const chunk = normalizedItems.slice(index, index + chunkSize);
      const generatedChunk = await generateRepliesForTargets(chunk, false, workingQueue);
      const repliesMap = new Map((generatedChunk || []).map((item) => [item.comment_id, item.generated_reply || '']));

      workingQueue = workingQueue.map((item) => (
        repliesMap.has(item.comment_id)
          ? { ...item, generated_reply: repliesMap.get(item.comment_id) || item.generated_reply || '' }
          : item
      ));

      collected.push(...workingQueue.filter((item) => chunk.some((target) => target.comment_id === item.comment_id)));
    }

    if (workingQueue !== commentQueue) {
      setCommentQueue(workingQueue);
    }

    return collected;
  };

  const saveLeadForComment = async (item) => {
    const response = await fetch(apiUrl('/api/agents/youtube/save-lead'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        channel_id: selectedChannelId,
        comment_id: item.comment_id,
        author_name: item.author_name,
        author_handle: item.author_channel_id || '',
        message: item.text,
        video_id: item.video_id || '',
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'Erro ao salvar lead');
    }
    return data;
  };

  const dropMissingCommentFromQueue = useCallback((commentId, message = 'Comentario removido ou indisponivel.') => {
    if (!commentId) return;
    const storageKey = getQueueStorageKey(sourcePlatform, selectedChannelId);
    setCommentQueue((items) => items.filter((item) => item.comment_id !== commentId));
    setSelectedQueueIds((ids) => ids.filter((id) => id !== commentId));
    setBatchProgress((current) => ({
      ...current,
      total: Math.max(0, current.total - 1),
      processed: current.processed + 1,
      skipped: current.skipped + 1,
    }));
    setSuccessMessage(message);
    setError('');
    setCommentItem((current) => {
      if (current?.comment_id === commentId) {
        const nextItem = commentQueue.find((item) => item.comment_id !== commentId) || null;
        setReplyText(nextItem?.generated_reply || '');
        return nextItem;
      }
      return current;
    });
    persistQueueState(storageKey, {
      commentQueue: commentQueue.filter((item) => item.comment_id !== commentId),
      selectedQueueIds: selectedQueueIds.filter((id) => id !== commentId),
      selectedCommentId: commentItem?.comment_id === commentId
        ? (commentQueue.find((item) => item.comment_id !== commentId)?.comment_id || null)
        : (commentItem?.comment_id || null),
      replyText: commentItem?.comment_id === commentId
        ? (commentQueue.find((item) => item.comment_id !== commentId)?.generated_reply || '')
        : replyText,
      runningBatch,
      batchProgress: {
        ...batchProgress,
        total: Math.max(0, batchProgress.total - 1),
        processed: batchProgress.processed + 1,
        skipped: batchProgress.skipped + 1,
      },
    });
  }, [
    batchProgress,
    commentItem?.comment_id,
    commentQueue,
    getQueueStorageKey,
    persistQueueState,
    replyText,
    runningBatch,
    selectedChannelId,
    selectedQueueIds,
    sourcePlatform,
  ]);

  const publishReply = async () => {
    if (sourcePlatform !== 'youtube') {
      setError(`Publicacao de respostas para ${sourcePlatform === 'instagram' ? 'Instagram' : 'Facebook'} ainda está em preparação.`);
      return;
    }
    if (!commentItem || !replyText.trim()) {
      setError('Gere ou escreva uma resposta antes de enviar');
      return;
    }

    setPublishingReply(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch(apiUrl('/api/agents/youtube/publish-reply'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          channel_id: selectedChannelId,
          parent_comment_id: commentItem.comment_id,
          reply_text: replyText.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 404) {
          dropMissingCommentFromQueue(commentItem.comment_id, 'Comentario removido ou indisponivel; item descartado da fila.');
          return;
        }
        throw new Error(data.detail || 'Erro ao publicar resposta');
      }

      await saveLeadForComment(commentItem);
      await loadReplyStats();
      setSuccessMessage(data.message || 'Resposta enviada');
      setCommentQueue((items) => items.filter((item) => item.comment_id !== commentItem.comment_id));
      setCommentItem(null);
      setReplyText('');
    } catch (err) {
      if (String(err.message || '').toLowerCase().includes('comentario removido ou indisponivel')) {
        dropMissingCommentFromQueue(commentItem.comment_id, 'Comentario removido ou indisponivel; item descartado da fila.');
      } else {
        setError(err.message);
      }
    } finally {
      setPublishingReply(false);
    }
  };

  const applyBatchJobState = useCallback((job) => {
    if (!job) {
      setRunningBatch(false);
      return;
    }
    setRunningBatch(Boolean(job.running));
    setBatchProgress({
      total: Number(job.total || 0),
      processed: Number(job.processed || 0),
      replied: Number(job.replied || 0),
      skipped: Number(job.skipped || 0),
      errors: Number(job.errors || 0),
    });
    const jobItems = (job.items || []).map((item) => ({
      ...item,
      generated_reply: item.generated_reply || '',
      status: item.status || 'pending',
    }));
    setCommentQueue(jobItems);
    setSelectedQueueIds(jobItems.filter((item) => item.status !== 'done' && item.status !== 'skipped').map((item) => item.comment_id));
    setCommentItem((current) => {
      if (current && jobItems.some((item) => item.comment_id === current.comment_id)) {
        return jobItems.find((item) => item.comment_id === current.comment_id) || current;
      }
      return jobItems[0] || null;
    });
    if (!job.running && job.message) {
      setSuccessMessage(job.message);
    }
  }, []);

  const loadBatchStatus = useCallback(async (channelId = selectedChannelId) => {
    if (sourcePlatform !== 'youtube' || !channelId) {
      return;
    }
    try {
      const response = await fetch(
        apiUrl(`/api/agents/youtube/batch-status?channel_id=${encodeURIComponent(channelId)}`),
        { headers: getAuthHeaders() },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao consultar lote');
      }
      applyBatchJobState(data.job);
      if (data.job?.running) {
        if (batchPollRef.current) {
          window.clearInterval(batchPollRef.current);
        }
        batchPollRef.current = window.setInterval(() => {
          loadBatchStatus(channelId);
          loadReplyStats();
        }, 2000);
      } else if (batchPollRef.current) {
        window.clearInterval(batchPollRef.current);
        batchPollRef.current = null;
      }
    } catch (err) {
      // polling nao deve derrubar a tela
    }
  }, [applyBatchJobState, loadReplyStats, selectedChannelId, sourcePlatform]);

  useEffect(() => {
    if (sourcePlatform === 'youtube' && selectedChannelId) {
      loadBatchStatus(selectedChannelId);
    }
  }, [loadBatchStatus, selectedChannelId, sourcePlatform]);

  const runBatchReplies = async () => {
    if (sourcePlatform !== 'youtube') {
      setError(`Lote automatico para ${sourcePlatform === 'instagram' ? 'Instagram' : 'Facebook'} ainda está em preparação.`);
      return;
    }
    if (!selectedChannelId) {
      setError('Selecione um canal antes de iniciar o fluxo');
      return;
    }
    const cleaned = cleanupQueueBeforeBatch();
    const queueSnapshot = cleaned.queue.filter((item) => cleaned.selectedIds.includes(item.comment_id));
    if (queueSnapshot.length === 0) {
      setError('Selecione os comentarios que devem ser respondidos em lote');
      return;
    }
    setError('');
    setSuccessMessage('');

    try {
      const missingTargets = queueSnapshot.filter((item) => !item.generated_reply?.trim());
      let finalQueueSnapshot = queueSnapshot;

      if (missingTargets.length > 0) {
        setSuccessMessage(`Gerando respostas para ${missingTargets.length} comentario(s) antes de iniciar o lote...`);
        const generatedItems = await generateRepliesInChunks(missingTargets, queueSnapshot, 20);
        const generatedMap = new Map((generatedItems || []).map((item) => [item.comment_id, item.generated_reply || '']));
        finalQueueSnapshot = queueSnapshot.map((item) => (
          generatedMap.has(item.comment_id)
            ? { ...item, generated_reply: generatedMap.get(item.comment_id) || item.generated_reply || '' }
            : item
        ));
      }

      const readyItems = finalQueueSnapshot.filter((item) => item.generated_reply?.trim());
      if (readyItems.length === 0) {
        throw new Error('Nao foi possivel preparar respostas para o lote.');
      }

      setSuccessMessage(`Iniciando lote com ${readyItems.length} comentario(s) selecionado(s)...`);

      const response = await fetch(apiUrl('/api/agents/youtube/start-batch'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          channel_id: selectedChannelId,
          interval_seconds: Math.max(1, Math.min(Number(replyIntervalSeconds) || 1, 300)),
          items: readyItems.map((item) => ({
            comment_id: item.comment_id,
            text: item.text,
            author_name: item.author_name,
            author_channel_id: item.author_channel_id || '',
            video_id: item.video_id || '',
            video_title: item.video_title || '',
            generated_reply: item.generated_reply,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao iniciar lote');
      }

      applyBatchJobState(data.job);
      persistQueueState(getQueueStorageKey(sourcePlatform, selectedChannelId), {
        commentQueue: readyItems,
        selectedQueueIds: readyItems.map((item) => item.comment_id),
        selectedCommentId: readyItems[0]?.comment_id || null,
        replyText: replyText,
        runningBatch: true,
        batchProgress: data.job || DEFAULT_BATCH_PROGRESS,
      });
      if (batchPollRef.current) {
        window.clearInterval(batchPollRef.current);
      }
      batchPollRef.current = window.setInterval(() => {
        loadBatchStatus(selectedChannelId);
        loadReplyStats();
      }, 2000);
      setSuccessMessage(`Fluxo em lote iniciado com ${readyItems.length} comentario(s). Ele continua rodando mesmo fora desta tela.`);
    } catch (err) {
      setError(err.message || 'Erro no fluxo em lote');
    }
  };

  const clearRobotRepeatTimeout = () => {
    if (robotRepeatTimeoutRef.current) {
      window.clearTimeout(robotRepeatTimeoutRef.current);
      robotRepeatTimeoutRef.current = null;
    }
  };

  const startRobotResponder = async () => {
    if (sourcePlatform !== 'youtube') {
      setError(`ROBO RESPONDER para ${sourcePlatform === 'instagram' ? 'Instagram' : 'Facebook'} ainda está em preparação.`);
      return;
    }
    if (!selectedChannelId) {
      setError('Selecione um canal antes de iniciar o ROBO RESPONDER.');
      return;
    }

    setRobotStarting(true);
    setError('');
    setSuccessMessage('');
    clearRobotRepeatTimeout();

    try {
      const desiredCount = Math.max(1, Math.min(robotFetchCount, 300));
      const desiredInterval = Math.max(1, Math.min(robotIntervalSeconds, 300));
      setFetchCount(desiredCount);
      setReplyIntervalSeconds(desiredInterval);

      const fetchedItems = await fetchCommentsBatchInternal(desiredCount, false);
      if (!fetchedItems.length) {
        setRobotResponderEnabled(false);
        clearRobotRepeatTimeout();
        setSuccessMessage('ROBO RESPONDER pausado automaticamente: nenhum comentário novo encontrado.');
        return;
      }

      const generatedItems = await generateRepliesInChunks(fetchedItems, fetchedItems, 20);
      const readyItems = generatedItems.filter((item) => item.generated_reply?.trim());
      if (!readyItems.length) {
        throw new Error('O ROBO RESPONDER nao conseguiu gerar respostas para o lote.');
      }

      const response = await fetch(apiUrl('/api/agents/youtube/start-batch'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          channel_id: selectedChannelId,
          interval_seconds: desiredInterval,
          items: readyItems.map((item) => ({
            comment_id: item.comment_id,
            text: item.text,
            author_name: item.author_name,
            author_channel_id: item.author_channel_id || '',
            video_id: item.video_id || '',
            video_title: item.video_title || '',
            generated_reply: item.generated_reply,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao iniciar o ROBO RESPONDER');
      }

      setRobotResponderEnabled(true);
      setShowRobotConfig(false);
      applyBatchJobState(data.job);
      persistQueueState(getQueueStorageKey(sourcePlatform, selectedChannelId), {
        commentQueue: readyItems,
        selectedQueueIds: readyItems.map((item) => item.comment_id),
        selectedCommentId: readyItems[0]?.comment_id || null,
        replyText: readyItems[0]?.generated_reply || '',
        runningBatch: true,
        batchProgress: data.job || DEFAULT_BATCH_PROGRESS,
      });
      if (batchPollRef.current) {
        window.clearInterval(batchPollRef.current);
      }
      batchPollRef.current = window.setInterval(() => {
        loadBatchStatus(selectedChannelId);
        loadReplyStats();
      }, 2000);
      setSuccessMessage(`Respostas geradas e lote iniciado com ${readyItems.length} comentario(s) a cada ${desiredInterval}s.`);
    } catch (err) {
      setError(err.message || 'Nao foi possivel iniciar o ROBO RESPONDER.');
      setRobotResponderEnabled(false);
      clearRobotRepeatTimeout();
    } finally {
      setRobotStarting(false);
    }
  };

  useEffect(() => {
    startRobotResponderRef.current = startRobotResponder;
  });

  const stopBatchReplies = async () => {
    if (!selectedChannelId) return;
    batchStopRef.current = true;
    setRobotResponderEnabled(false);
    clearRobotRepeatTimeout();
    try {
      await fetch(apiUrl(`/api/agents/youtube/stop-batch?channel_id=${encodeURIComponent(selectedChannelId)}`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      setSuccessMessage('Parada solicitada para o lote em execução.');
    } catch (err) {
      setError('Nao foi possivel solicitar a parada do lote.');
    }
  };

  const selectQueueItem = (item) => {
    setCommentItem(item);
    setReplyText(item.generated_reply || '');
  };

  const toggleQueueSelection = (commentId) => {
    setSelectedQueueIds((current) => (
      current.includes(commentId)
        ? current.filter((id) => id !== commentId)
        : [...current, commentId]
    ));
  };

  const toggleAllQueueSelection = () => {
    const queueIds = commentQueue.map((item) => item.comment_id);
    const allSelected = queueIds.length > 0 && queueIds.every((id) => selectedQueueIds.includes(id));
    setSelectedQueueIds(allSelected ? [] : queueIds);
  };

  const deleteSelectedQueueItems = () => {
    if (selectedQueueIds.length === 0) {
      setError('Selecione os comentarios que deseja remover da fila.');
      return;
    }

    const remainingItems = commentQueue.filter((item) => !selectedQueueIds.includes(item.comment_id));
    setCommentQueue(remainingItems);
    setSelectedQueueIds([]);
    setCommentItem((current) => (
      current && selectedQueueIds.includes(current.comment_id)
        ? (remainingItems[0] || null)
        : current
    ));
    setReplyText((current) => (
      commentItem && selectedQueueIds.includes(commentItem.comment_id) ? '' : current
    ));
    setSuccessMessage('Comentarios selecionados removidos da fila.');
    setError('');
  };

  const saveLead = async () => {
    if (sourcePlatform !== 'youtube') {
      setError(`Salvar lead automatico para ${sourcePlatform === 'instagram' ? 'Instagram' : 'Facebook'} ainda está em preparação.`);
      return;
    }
    if (!commentItem || !selectedChannelId) {
      setError('Busque um comentario antes de salvar lead');
      return;
    }
    setSavingLead(true);
    setError('');
    setSuccessMessage('');

    try {
      await saveLeadForComment(commentItem);
      setSuccessMessage('Lead salvo na lista geral');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingLead(false);
    }
  };

  const selectedBatchItems = commentQueue.filter((item) => selectedQueueIds.includes(item.comment_id));
  const generatedBatchItems = selectedBatchItems.filter((item) => item.generated_reply?.trim());
  useEffect(() => {
    const wasRunning = previousRunningBatchRef.current;
    if (wasRunning && !runningBatch) {
      if (robotResponderEnabled && robotAutoRepeatEnabled) {
        clearRobotRepeatTimeout();
        const amount = Math.max(1, Number(robotRepeatEvery) || 1);
        const delayMs = robotRepeatUnit === 'hours' ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
        robotRepeatTimeoutRef.current = window.setTimeout(() => {
          startRobotResponderRef.current?.();
        }, delayMs);
        setSuccessMessage(`Lote concluído. ROBO RESPONDER volta em ${robotRepeatEvery} ${robotRepeatUnit === 'hours' ? 'hora(s)' : 'minuto(s)'}.`);
      } else {
        clearRobotRepeatTimeout();
      }
    }
    previousRunningBatchRef.current = runningBatch;
  }, [runningBatch, robotResponderEnabled, robotAutoRepeatEnabled, robotRepeatEvery, robotRepeatUnit]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Agentes</h1>
          <p>Fluxo curto para buscar comentario do canal e gerar resposta com ChatGPT.</p>
        </div>
      </div>

      {error && (
        <div className="agents-banner agents-banner-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="agents-banner agents-banner-success">
          <Sparkles size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {showRobotConfig && (
        <div className="agents-modal-backdrop">
          <div className="agents-modal">
            <div className="agents-modal__header">
              <h2>Configurar ROBO RESPONDER</h2>
              <p>O robô vai puxar o lote, gerar as respostas e iniciar o mesmo fluxo do Responder em lote.</p>
            </div>

            <div className="agents-modal__body">
              <label className="agents-select-group agents-small-field">
                <span>Qtd. comentários puxar</span>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={robotFetchCount}
                  onChange={(event) => setRobotFetchCount(Math.max(1, Math.min(300, Number(event.target.value) || 1)))}
                />
              </label>

              <label className="agents-select-group agents-small-field">
                <span>Segundos entre respostas</span>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={robotIntervalSeconds}
                  onChange={(event) => setRobotIntervalSeconds(Math.max(1, Math.min(300, Number(event.target.value) || 1)))}
                />
              </label>

              <label className="agents-select-group agents-modal-wide">
                <span>Executar novamente sozinho</span>
                <button
                  type="button"
                  className={`agents-robot-toggle agents-robot-toggle-inline ${robotAutoRepeatEnabled ? 'enabled' : 'disabled'}`}
                  onClick={() => setRobotAutoRepeatEnabled((current) => !current)}
                >
                  <span className="agents-robot-toggle__track">
                    <span className="agents-robot-toggle__thumb" />
                  </span>
                  <span className="agents-robot-toggle__label">
                    {robotAutoRepeatEnabled ? 'Ativado' : 'Desativado'}
                  </span>
                </button>
              </label>

              <div className="agents-modal-repeat-row">
                <label className="agents-select-group agents-small-field">
                  <span>Reexecutar a cada</span>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={robotRepeatEvery}
                    onChange={(event) => setRobotRepeatEvery(Math.max(1, Math.min(999, Number(event.target.value) || 1)))}
                    disabled={!robotAutoRepeatEnabled}
                  />
                </label>

                <label className="agents-select-group agents-small-field">
                  <span>Unidade</span>
                  <select
                    value={robotRepeatUnit}
                    onChange={(event) => setRobotRepeatUnit(event.target.value)}
                    disabled={!robotAutoRepeatEnabled}
                  >
                    <option value="minutes">Minutos</option>
                    <option value="hours">Horas</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="agents-modal__actions">
              <button type="button" className="refresh-button" onClick={() => setShowRobotConfig(false)} disabled={robotStarting}>
                Cancelar
              </button>
              <button type="button" className="agents-fetch-button" onClick={startRobotResponder} disabled={robotStarting}>
                {robotStarting ? <Loader size={16} className="spinner" /> : <Bot size={16} />}
                Gerar respostas e iniciar
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="agents-panel">
        <div className="agents-stats-grid">
          <div className="agents-stat-card">
            <div className="agents-stat-card__top">
              <strong>YouTube</strong>
              <span>{replyStats.youtube || 0}</span>
            </div>
            <div className="agents-stat-card__channel-list">
              {(replyChannelStats.youtube || []).length === 0 ? (
                <small>Sem canais respondidos</small>
              ) : (
                replyChannelStats.youtube.map((channel) => (
                  <div key={channel.channel_id} className="agents-stat-card__channel-row">
                    <small>{channel.channel_name}</small>
                    <b>{channel.count}</b>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="agents-stat-card">
            <div className="agents-stat-card__top">
              <strong>Instagram</strong>
              <span>{replyStats.instagram || 0}</span>
            </div>
          </div>
          <div className="agents-stat-card">
            <div className="agents-stat-card__top">
              <strong>Facebook</strong>
              <span>{replyStats.facebook || 0}</span>
            </div>
          </div>
          <div className="agents-stat-card">
            <div className="agents-stat-card__top">
              <strong>TikTok</strong>
              <span>{replyStats.tiktok || 0}</span>
            </div>
          </div>
        </div>

        <div className="agents-toolbar">
          <div className="agents-select-group agents-network-group">
            <label htmlFor="agent-platform">Rede</label>
            <select
              id="agent-platform"
              value={sourcePlatform}
              onChange={(event) => {
                setSourcePlatform(event.target.value);
                clearAgentWorkspace();
              }}
              disabled={loading}
            >
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>

          <div className="agents-select-group">
            <label htmlFor="agent-channel">Canal</label>
            <select
              id="agent-channel"
              value={selectedChannelId}
              onChange={(event) => {
                setSelectedChannelId(event.target.value);
                clearAgentWorkspace();
              }}
              disabled={
                loading
                || (sourcePlatform === 'youtube' && channels.length === 0)
                || (sourcePlatform === 'instagram' && instagramProfiles.length === 0)
                || (sourcePlatform === 'facebook' && facebookPages.length === 0)
              }
            >
              {sourcePlatform === 'youtube' && (
                channels.length === 0 ? (
                  <option value="">Nenhum canal conectado</option>
                ) : (
                  channels.map((channel) => (
                    <option key={channel.channel_id} value={channel.channel_id}>
                      {channel.channel_name}
                    </option>
                  ))
                )
              )}
              {sourcePlatform === 'instagram' && (
                instagramProfiles.length === 0 ? (
                  <option value="">Nenhum perfil conectado</option>
                ) : (
                  instagramProfiles.map((profile) => (
                    <option key={profile.profile_id} value={profile.profile_id}>
                      @{profile.username || profile.profile_name}
                    </option>
                  ))
                )
              )}
              {sourcePlatform === 'facebook' && (
                facebookPages.length === 0 ? (
                  <option value="">Nenhuma página conectada</option>
                ) : (
                  facebookPages.map((page) => (
                    <option key={page.page_id} value={page.page_id}>
                      {page.page_name}
                    </option>
                  ))
                )
              )}
            </select>
          </div>

          <div className="agents-flow-controls">
            <div className="agents-select-group agents-small-field">
              <label htmlFor="agent-fetch-count">Qtd. puxar</label>
              <input
                id="agent-fetch-count"
                type="number"
                min="1"
                max="300"
                value={fetchCount}
                onChange={(event) => setFetchCount(Math.max(1, Math.min(300, Number(event.target.value) || 1)))}
              />
            </div>

            <div className="agents-select-group agents-small-field">
              <label htmlFor="agent-rate">Segundos entre respostas</label>
              <input
                id="agent-rate"
                type="number"
                min="1"
                max="300"
                value={replyIntervalSeconds}
                onChange={(event) => setReplyIntervalSeconds(Math.max(1, Math.min(300, Number(event.target.value) || 1)))}
              />
            </div>
          </div>

          <div className="agents-toolbar-actions">
            <button type="button" className="refresh-button" onClick={loadChannels} disabled={loading}>
              {loading ? <Loader size={16} className="spinner" /> : <RefreshCw size={16} />}
              Atualizar
            </button>
            <button type="button" className="refresh-button agents-fetch-button" onClick={fetchCommentsBatch} disabled={fetchingComment || loading || !selectedChannelId || runningBatch}>
              {fetchingComment ? <Loader size={16} className="spinner" /> : <MessageSquare size={16} />}
              Puxar lote
            </button>
            <button
              type="button"
              className={`agents-robot-toggle ${robotResponderEnabled ? 'enabled' : 'disabled'}`}
              onClick={() => {
                if (robotResponderEnabled) {
                  setRobotResponderEnabled(false);
                  setShowRobotConfig(false);
                  clearRobotRepeatTimeout();
                  return;
                }
                setRobotFetchCount(fetchCount);
                setRobotIntervalSeconds(replyIntervalSeconds);
                setShowRobotConfig(true);
              }}
              disabled={runningBatch || robotStarting}
            >
              <span className="agents-robot-toggle__track">
                <span className="agents-robot-toggle__thumb" />
              </span>
              <span className="agents-robot-toggle__label">ROBO RESPONDER</span>
            </button>
            <button type="button" className="connect-button" onClick={runBatchReplies} disabled={runningBatch || loading || !selectedChannelId || selectedQueueIds.length === 0}>
              {runningBatch ? <Loader size={16} className="spinner" /> : <Bot size={16} />}
              Responder em lote
            </button>
            <button type="button" className="refresh-button" onClick={stopBatchReplies} disabled={!runningBatch}>
              Parar
            </button>
          </div>
        </div>

        <div className="agents-warning">
          {sourcePlatform === 'youtube'
            ? 'O agente varre comentarios elegiveis sem duplicar resposta. Comentarios ja respondidos pelo agente nao entram novamente.'
            : `${sourcePlatform === 'instagram' ? 'Instagram' : 'Facebook'} já aparece no seletor de canais. A automacao de comentarios dessa rede entra na mesma tela em seguida.`}
        </div>

        <section className="agents-batch-panel">
          <div className="agents-batch-panel__header">
            <div>
              <h2>Resposta automática</h2>
              <p>O agente responde um comentário por vez e respeita o intervalo em segundos entre cada envio.</p>
            </div>
            <div className={`agents-batch-status ${runningBatch ? 'running' : ''}`}>
              {runningBatch ? `Em execução · ${Math.max(batchProgress.total - batchProgress.processed, 0)} pendentes` : 'Pronto'}
            </div>
          </div>

          <div className="agents-batch-metrics">
            <div className="agents-batch-metric">
              <strong>Total puxado</strong>
              <span>{batchProgress.total}</span>
            </div>
            <div className="agents-batch-metric">
              <strong>Processados</strong>
              <span>{batchProgress.processed}</span>
            </div>
            <div className="agents-batch-metric">
              <strong>Respondidos</strong>
              <span>{batchProgress.replied}</span>
            </div>
            <div className="agents-batch-metric">
              <strong>Pendentes</strong>
              <span>{Math.max(batchProgress.total - batchProgress.processed, 0)}</span>
            </div>
            <div className="agents-batch-metric">
              <strong>Ignorados / removidos</strong>
              <span>{batchProgress.skipped}</span>
            </div>
            <div className="agents-batch-metric">
              <strong>Erros</strong>
              <span>{batchProgress.errors}</span>
            </div>
          </div>
        </section>

        <div className="agents-grid">
          <article className="agents-card">
            <div className="agents-card__header">
              <MessageSquare size={18} />
              <h2>Fila de comentários</h2>
              <div className="agents-card__header-actions">
                <button type="button" className="refresh-button compact-inline-button" onClick={toggleAllQueueSelection} disabled={commentQueue.length === 0 || runningBatch}>
                  {commentQueue.length > 0 && commentQueue.every((item) => selectedQueueIds.includes(item.comment_id))
                    ? <CheckSquare size={16} />
                    : <Square size={16} />}
                  Selecionar todos
                </button>
                <button type="button" className="refresh-button compact-inline-button" onClick={deleteSelectedQueueItems} disabled={selectedQueueIds.length === 0 || runningBatch}>
                  <Trash2 size={16} />
                  Apagar selecionados
                </button>
                <button type="button" className="agents-primary-button compact-inline-button" onClick={generateReply} disabled={generatingReply || selectedQueueIds.length === 0}>
                  {generatingReply ? <Loader size={16} className="spinner" /> : <Sparkles size={16} />}
                  RESPONDER SELECIONADOS
                </button>
              </div>
            </div>

            {commentQueue.length === 0 ? (
              <div className="agents-empty-state">
                <p>Nenhum comentário em fila. Defina a quantidade e use Buscar lista.</p>
              </div>
            ) : (
              <div className="agents-queue">
                {commentQueue.map((item) => (
                  <div
                    key={item.comment_id}
                    className={`agents-queue-item ${commentItem?.comment_id === item.comment_id ? 'selected' : ''} ${item.status || 'pending'}`}
                  >
                    <button type="button" className="agents-queue-select" onClick={() => toggleQueueSelection(item.comment_id)}>
                      {selectedQueueIds.includes(item.comment_id) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <button type="button" className="agents-queue-content" onClick={() => selectQueueItem(item)}>
                      <div className="agents-queue-item__top">
                        <strong>{item.author_name}</strong>
                        <span>{item.status === 'done' ? 'respondido' : item.status === 'processing' ? 'processando' : item.status === 'error' ? 'erro' : 'pendente'}</span>
                      </div>
                      <p>{item.text}</p>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="agents-card">
            <div className="agents-card__header">
              <Bot size={18} />
              <h2>Respostas do lote selecionado</h2>
            </div>

            {generatedBatchItems.length === 0 ? (
              <div className="agents-empty-state">
                <p>As respostas geradas para os comentários marcados aparecem aqui. Primeiro selecione os itens e use RESPONDER SELECIONADOS.</p>
              </div>
            ) : (
              <div className="agents-generated-list">
                {generatedBatchItems.map((item) => (
                  <div
                    key={item.comment_id}
                    className={`agents-generated-item ${commentItem?.comment_id === item.comment_id ? 'selected' : ''}`}
                  >
                    <button type="button" className="agents-generated-button" onClick={() => selectQueueItem(item)}>
                      <div className="agents-generated-item__top">
                        <strong>{item.author_name}</strong>
                        <span>ID: {item.comment_id}</span>
                      </div>
                      <p className="agents-generated-item__comment">{item.text}</p>
                      <div className="agents-generated-item__reply">
                        <span>Resposta gerada</span>
                        <p>{item.generated_reply}</p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="agents-card">
            <div className="agents-card__header">
              <Sparkles size={18} />
              <h2>Resposta do agente</h2>
            </div>

            <div className="agents-reply-box">
              <textarea
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="A resposta gerada aparece aqui."
                rows="9"
              />
            </div>

            <div className="agents-card__actions">
              <button type="button" className="refresh-button" onClick={saveLead} disabled={savingLead || !commentItem}>
                {savingLead ? <Loader size={16} className="spinner" /> : <MessageSquare size={16} />}
                Salvar como lead
              </button>
              <button type="button" className="connect-button" onClick={publishReply} disabled={publishingReply || !replyText.trim() || !commentItem}>
                {publishingReply ? <Loader size={16} className="spinner" /> : <Send size={16} />}
                Enviar resposta
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default Agents;
