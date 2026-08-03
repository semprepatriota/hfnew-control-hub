import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Download,
  ExternalLink,
  FileArchive,
  Image as ImageIcon,
  Link2,
  Loader2,
  Music2,
  PackageCheck,
  Puzzle,
  RotateCcw,
  Search,
  Square,
  CheckSquare2,
  Trash2,
  Video,
  X
} from 'lucide-react';
import { bulkDownloadApi, saveBulkDownloadFile } from '../services/bulkDownloadApi';
import './bulk-download.css';

const PLATFORM_LABELS = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  kwai: 'Kwai'
};

const ACTIVE_STATUSES = new Set(['queued', 'downloading']);

function readableBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '0 MB';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function readableDuration(seconds) {
  const total = Number(seconds || 0);
  if (!total) return '--:--';
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function readableCount(value) {
  const count = Number(value || 0);
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1)} mi`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(count >= 100_000 ? 0 : 1)} mil`;
  return String(count);
}

function isPlayablePreview(value) {
  return /cdninstagram|fbcdn|tiktokcdn|muscdn|kwai|\.mp4(?:\?|$)/i.test(value || '');
}

function extractUrls(raw) {
  return Array.from(new Set((raw.match(/https?:\/\/[^\s]+/gi) || []).map((url) => url.replace(/[),.;]+$/, ''))));
}

function mergeItems(current, incoming) {
  const merged = new Map(current.map((item) => [item.url, item]));
  incoming.forEach((item) => merged.set(item.url, { ...merged.get(item.url), ...item }));
  return Array.from(merged.values());
}

function BulkDownload() {
  const [links, setLinks] = useState('');
  const [profilePlatform, setProfilePlatform] = useState('instagram');
  const [profileName, setProfileName] = useState('');
  const [profileLimit, setProfileLimit] = useState(25);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [jobs, setJobs] = useState([]);
  const [outputFormat, setOutputFormat] = useState('video');
  const [quality, setQuality] = useState('1080');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pairingKey, setPairingKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(true);
  const [health, setHealth] = useState(null);

  const activeCount = useMemo(() => jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length, [jobs]);
  const completedCount = useMemo(() => jobs.filter((job) => job.status === 'completed').length, [jobs]);

  const loadJobs = useCallback(async (silent = false) => {
    try {
      const payload = await bulkDownloadApi.jobs();
      setJobs(payload.jobs || []);
    } catch (loadError) {
      if (!silent) setError(loadError.message);
    }
  }, []);

  const loadInbox = useCallback(async (silent = false) => {
    try {
      const payload = await bulkDownloadApi.extensionInbox();
      const incoming = payload.items || [];
      if (incoming.length) {
        setItems((current) => mergeItems(current, incoming));
      }
    } catch (loadError) {
      if (!silent) setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    Promise.all([bulkDownloadApi.health(), bulkDownloadApi.jobs(), bulkDownloadApi.extensionInbox()])
      .then(([healthPayload, jobPayload, inboxPayload]) => {
        setHealth(healthPayload);
        setJobs(jobPayload.jobs || []);
        setItems(inboxPayload.items || []);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    if (!activeCount) return undefined;
    const interval = window.setInterval(() => loadJobs(true), 2200);
    return () => window.clearInterval(interval);
  }, [activeCount, loadJobs]);

  useEffect(() => {
    const interval = window.setInterval(() => loadInbox(true), 10000);
    return () => window.clearInterval(interval);
  }, [loadInbox]);

  const analyzeLinks = async () => {
    const urls = extractUrls(links);
    if (!urls.length) {
      setError('Cole pelo menos um link completo, com https://.');
      return;
    }
    setBusy('inspect');
    setError('');
    setNotice('');
    try {
      const payload = await bulkDownloadApi.inspect(urls.slice(0, 50));
      const incoming = payload.items || [];
      setItems((current) => mergeItems(current, incoming));
      setSelected((current) => {
        const next = new Set(current);
        incoming.forEach((item) => next.add(item.url));
        return next;
      });
      const failed = payload.errors?.length || 0;
      setNotice(`${incoming.length} conteúdo(s) encontrado(s)${failed ? ` · ${failed} link(s) não abriram` : ''}.`);
    } catch (analyzeError) {
      setError(analyzeError.message);
    } finally {
      setBusy('');
    }
  };

  const analyzeProfile = async () => {
    if (!profileName.trim()) {
      setError('Digite o @ ou nome do perfil.');
      return;
    }
    setBusy('profile');
    setError('');
    setNotice('');
    try {
      const payload = await bulkDownloadApi.inspectProfile(profilePlatform, profileName.trim(), Number(profileLimit));
      const incoming = payload.items || [];
      setItems((current) => mergeItems(current, incoming));
      setSelected((current) => {
        const next = new Set(current);
        incoming.forEach((item) => next.add(item.url));
        return next;
      });
      setNotice(`${incoming.length} vídeo(s) carregado(s) do perfil.`);
    } catch (profileError) {
      setError(profileError.message);
    } finally {
      setBusy('');
    }
  };

  const toggleItem = (url) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((current) => (
      current.size === items.length ? new Set() : new Set(items.map((item) => item.url))
    ));
  };

  const queueSelected = async () => {
    const chosen = items.filter((item) => selected.has(item.url));
    if (!chosen.length) {
      setError('Selecione pelo menos um conteúdo.');
      return;
    }
    setBusy('queue');
    setError('');
    try {
      const payload = await bulkDownloadApi.createJobs(chosen, outputFormat, quality);
      setJobs((current) => [...(payload.jobs || []).reverse(), ...current]);
      setNotice(`${payload.total} download(s) colocado(s) na fila.`);
      setQueueOpen(true);
    } catch (queueError) {
      setError(queueError.message);
    } finally {
      setBusy('');
    }
  };

  const queueSingle = async (item) => {
    setBusy(`save:${item.url}`);
    setError('');
    try {
      const payload = await bulkDownloadApi.createJobs([item], outputFormat, quality);
      setJobs((current) => [...(payload.jobs || []).reverse(), ...current]);
      setNotice('Vídeo colocado na fila para salvar.');
      setQueueOpen(true);
    } catch (queueError) {
      setError(queueError.message);
    } finally {
      setBusy('');
    }
  };

  const removeResult = (url) => {
    setItems((current) => current.filter((item) => item.url !== url));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(url);
      return next;
    });
  };

  const generatePairing = async () => {
    setBusy('pair');
    setError('');
    try {
      const payload = await bulkDownloadApi.pairExtension();
      setPairingKey(payload.extension_key || '');
    } catch (pairError) {
      setError(pairError.message);
    } finally {
      setBusy('');
    }
  };

  const copyPairing = async () => {
    await navigator.clipboard.writeText(pairingKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const retryJob = async (jobId) => {
    setError('');
    try {
      await bulkDownloadApi.retry(jobId);
      await loadJobs(true);
    } catch (retryError) {
      setError(retryError.message);
    }
  };

  const removeJob = async (jobId) => {
    setError('');
    try {
      await bulkDownloadApi.remove(jobId);
      setJobs((current) => current.filter((job) => job.id !== jobId));
    } catch (removeError) {
      setError(removeError.message);
    }
  };

  const saveFile = async (job) => {
    setError('');
    try {
      await saveBulkDownloadFile(job);
      setNotice(`Arquivo salvo: ${job.filename}`);
    } catch (downloadError) {
      if (downloadError?.name !== 'AbortError') setError(downloadError.message);
    }
  };

  const clearResults = async () => {
    setItems([]);
    setSelected(new Set());
    setLinks('');
    setNotice('');
    await bulkDownloadApi.clearExtensionInbox().catch(() => null);
  };

  return (
    <div className="bulk-page">
      <header className="bulk-header">
        <div>
          <span className="bulk-eyebrow">FERRAMENTA DE MÍDIA</span>
          <h1>Baixar em Massa</h1>
          <p>Links públicos, seleção organizada e fila isolada por usuário.</p>
        </div>
        <div className={`bulk-health ${health ? 'online' : ''}`}>
          <span />
          {health ? `${health.workers} downloads simultâneos` : 'Verificando serviço'}
        </div>
      </header>

      {(error || notice) && (
        <div className={`bulk-banner ${error ? 'error' : 'success'}`}>
          {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{error || notice}</span>
          <button type="button" onClick={() => { setError(''); setNotice(''); }} aria-label="Fechar aviso"><X size={16} /></button>
        </div>
      )}

      <section className="bulk-extension-panel bulk-extension-first">
        <button type="button" className="bulk-collapse-button" onClick={() => setExtensionOpen((value) => !value)}>
          <span><Puzzle size={18} /> HF Bulk Explorer <b>EXTENSÃO</b></span>
          {extensionOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
        {extensionOpen && (
          <div className="bulk-extension-body">
            <div>
              <strong>Conexão da extensão</strong>
              <p>Use para perfis que exigem login. Ela lê os vídeos visíveis sem compartilhar sua senha.</p>
            </div>
            <div className="bulk-pairing-row">
              <a className="bulk-button ghost" href="/downloads/hf-bulk-explorer.zip" download>
                <Download size={16} />
                Baixar extensão
              </a>
              <button type="button" className="bulk-button secondary" onClick={generatePairing} disabled={busy === 'pair'}>
                {busy === 'pair' ? <Loader2 className="spin" size={16} /> : <Puzzle size={16} />}
                Gerar chave
              </button>
              {pairingKey && (
                <>
                  <code>{pairingKey}</code>
                  <button type="button" className="bulk-icon-button" onClick={copyPairing} title="Copiar chave" aria-label="Copiar chave">
                    {copied ? <Check size={17} /> : <Clipboard size={17} />}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="bulk-source-panel bulk-profile-panel">
        <div className="bulk-section-heading">
          <div>
            <h2><Search size={18} /> Buscar vídeos de um perfil</h2>
            <p>Digite apenas @perfil ou o nome do perfil.</p>
          </div>
        </div>
        <div className="bulk-profile-form">
          <select value={profilePlatform} onChange={(event) => setProfilePlatform(event.target.value)} aria-label="Rede social">
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="@nome_do_perfil" onKeyDown={(event) => { if (event.key === 'Enter') analyzeProfile(); }} />
          <select value={profileLimit} onChange={(event) => setProfileLimit(Number(event.target.value))} aria-label="Quantidade de vídeos">
            {[10, 25, 50, 75, 100].map((value) => <option key={value} value={value}>{value} vídeos</option>)}
          </select>
          <button type="button" className="bulk-button primary" onClick={analyzeProfile} disabled={busy === 'profile'}>
            {busy === 'profile' ? <Loader2 className="spin" size={17} /> : <Search size={17} />}
            Puxar vídeos
          </button>
        </div>
      </section>

      <section className="bulk-source-panel">
        <div className="bulk-section-heading">
          <div>
            <h2><Link2 size={18} /> Links para analisar</h2>
            <p>Até 50 links públicos, um por linha.</p>
          </div>
          <div className="bulk-platforms">
            {Object.values(PLATFORM_LABELS).map((label) => <span key={label}>{label}</span>)}
          </div>
        </div>

        <textarea
          value={links}
          onChange={(event) => setLinks(event.target.value)}
          placeholder={'https://www.instagram.com/reel/...\nhttps://www.tiktok.com/@perfil/video/...\nhttps://www.facebook.com/reel/...'}
          rows={5}
        />

        <div className="bulk-actions-row">
          <button type="button" className="bulk-button primary" onClick={analyzeLinks} disabled={busy === 'inspect'}>
            {busy === 'inspect' ? <Loader2 className="spin" size={17} /> : <Search size={17} />}
            Analisar links
          </button>
          <button type="button" className="bulk-icon-button" onClick={clearResults} title="Limpar resultados" aria-label="Limpar resultados"><Trash2 size={17} /></button>
        </div>
      </section>

      <section className="bulk-results-section">
        <div className="bulk-section-heading results-heading">
          <div>
            <h2><FileArchive size={18} /> Conteúdos encontrados</h2>
            <p>{items.length} encontrado(s) · {selected.size} selecionado(s)</p>
          </div>
          <button type="button" className="bulk-button ghost" onClick={toggleAll} disabled={!items.length}>
            {items.length && selected.size === items.length ? <CheckSquare2 size={17} /> : <Square size={17} />}
            {items.length && selected.size === items.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        </div>

        {!items.length ? (
          <div className="bulk-empty"><Search size={30} /><strong>Nenhum conteúdo analisado</strong></div>
        ) : (
          <div className="bulk-result-grid">
            {items.map((item) => {
              const checked = selected.has(item.url);
              return (
                <article className={`bulk-media-card ${checked ? 'selected' : ''}`} key={`${item.url}-${item.id || ''}`}>
                  <button type="button" className="bulk-card-select" onClick={() => toggleItem(item.url)} aria-label={checked ? 'Desmarcar' : 'Selecionar'}>
                    {checked ? <CheckSquare2 size={19} /> : <Square size={19} />}
                  </button>
                  <button type="button" className="bulk-card-remove" onClick={() => removeResult(item.url)} title="Remover da lista" aria-label="Remover da lista"><X size={15} /></button>
                  <div className="bulk-thumbnail">
                    {isPlayablePreview(item.preview_url) ? (
                      <video src={item.preview_url} poster={item.thumbnail || undefined} controls preload="metadata" />
                    ) : item.thumbnail ? <img src={item.thumbnail} alt="" referrerPolicy="no-referrer" /> : <Video size={30} />}
                    <span>{readableDuration(item.duration)}</span>
                  </div>
                  <div className="bulk-card-body">
                    <div className="bulk-card-meta">
                      <span className={`platform ${item.platform}`}>{PLATFORM_LABELS[item.platform] || item.platform}</span>
                      <span>{item.media_type === 'image' ? <ImageIcon size={13} /> : <Video size={13} />}{item.media_type}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <div className="bulk-card-stats"><strong>{readableCount(item.view_count)} visualizações</strong><span>{readableCount(item.like_count)} curtidas</span></div>
                    <div className="bulk-card-footer">
                      <a href={item.url} target="_blank" rel="noreferrer">Abrir origem <ExternalLink size={12} /></a>
                      <button type="button" onClick={() => queueSingle(item)} disabled={busy === `save:${item.url}`}>
                        {busy === `save:${item.url}` ? <Loader2 className="spin" size={13} /> : <Download size={13} />} Salvar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="bulk-download-bar">
          <div className="bulk-segmented" aria-label="Formato">
            {[['video', Video, 'MP4'], ['audio', Music2, 'MP3'], ['original', PackageCheck, 'Original']].map(([value, Icon, label]) => (
              <button type="button" key={value} className={outputFormat === value ? 'active' : ''} onClick={() => setOutputFormat(value)}><Icon size={15} />{label}</button>
            ))}
          </div>
          {outputFormat === 'video' && (
            <select value={quality} onChange={(event) => setQuality(event.target.value)} aria-label="Qualidade do vídeo">
              <option value="best">Melhor disponível</option>
              <option value="1080">Até 1080p</option>
              <option value="720">Até 720p</option>
              <option value="480">Até 480p</option>
            </select>
          )}
          <button type="button" className="bulk-button download" onClick={queueSelected} disabled={!selected.size || busy === 'queue'}>
            {busy === 'queue' ? <Loader2 className="spin" size={17} /> : <Download size={17} />}
            Baixar selecionados ({selected.size})
          </button>
        </div>
      </section>

      <section className="bulk-queue-section">
        <button type="button" className="bulk-collapse-button" onClick={() => setQueueOpen((value) => !value)}>
          <span><Download size={18} /> Fila e histórico <b>{activeCount ? `${activeCount} ativo(s)` : `${completedCount} concluído(s)`}</b></span>
          {queueOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
        {queueOpen && (
          <div className="bulk-job-list">
            {!jobs.length && <div className="bulk-empty compact"><PackageCheck size={24} />Nenhum download iniciado.</div>}
            {jobs.map((job) => (
              <div className={`bulk-job ${job.status}`} key={job.id}>
                <div className="bulk-job-icon">
                  {job.status === 'downloading' || job.status === 'queued' ? <Loader2 className="spin" size={18} /> : job.status === 'completed' ? <Check size={18} /> : <AlertCircle size={18} />}
                </div>
                <div className="bulk-job-main">
                  <div className="bulk-job-title"><strong>{job.title}</strong><span>{PLATFORM_LABELS[job.platform] || job.platform} · {job.output_format}</span></div>
                  <div className="bulk-progress"><span style={{ width: `${job.progress || 0}%` }} /></div>
                  <div className="bulk-job-detail">
                    <span>{job.status === 'failed' ? job.error : `${job.progress || 0}% · ${readableBytes(job.downloaded_bytes)}`}</span>
                    {job.status === 'completed' && <span>{readableBytes(job.size_bytes)}</span>}
                  </div>
                </div>
                <div className="bulk-job-actions">
                  {job.status === 'completed' && <button type="button" className="bulk-icon-button success" onClick={() => saveFile(job)} title="Salvar arquivo" aria-label="Salvar arquivo"><Download size={17} /></button>}
                  {job.status === 'failed' && <button type="button" className="bulk-icon-button" onClick={() => retryJob(job.id)} title="Tentar novamente" aria-label="Tentar novamente"><RotateCcw size={17} /></button>}
                  {!ACTIVE_STATUSES.has(job.status) && <button type="button" className="bulk-icon-button danger" onClick={() => removeJob(job.id)} title="Excluir" aria-label="Excluir"><Trash2 size={17} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default BulkDownload;
