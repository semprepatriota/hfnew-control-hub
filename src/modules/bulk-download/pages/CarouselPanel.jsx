import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckSquare2, Download, ExternalLink, Image as ImageIcon, Layers, Loader2, Search, Square, X } from 'lucide-react';
import { bulkDownloadApi } from '../services/bulkDownloadApi';
import { CAROUSEL_EXTENSION_VERSION, carouselItemKey, carouselSelection, normalizeCarouselUrl, supportsCarousels, validateCarousel } from '../services/bulkCarousels';

export default function CarouselPanel({ extensionStatus, serviceReady, onJobs, onError, onNotice }) {
  const [link, setLink] = useState('');
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [reading, setReading] = useState(false);
  const [count, setCount] = useState(0);
  const [queuing, setQueuing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(() => new Set());
  const requestRef = useRef('');
  const timeoutRef = useRef(null);
  const queueRef = useRef(false);
  const ready = supportsCarousels(extensionStatus?.version);

  const cancel = () => {
    if (requestRef.current) window.postMessage({ source: 'HF_NEW_CONTROL_HUB', type: 'HF_BULK_CAROUSEL_CANCEL',
      payload: { requestId: requestRef.current } }, window.location.origin);
    requestRef.current = '';
    window.clearTimeout(timeoutRef.current);
    setReading(false);
  };
  useEffect(() => () => {
    if (requestRef.current) window.postMessage({ source: 'HF_NEW_CONTROL_HUB', type: 'HF_BULK_CAROUSEL_CANCEL',
      payload: { requestId: requestRef.current } }, window.location.origin);
    window.clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    const result = extensionStatus?.lastCarousel;
    if (!requestRef.current || result?.requestId !== requestRef.current) return;
    if (result.status === 'reading') { setCount(result.count || 0); return; }
    requestRef.current = '';
    window.clearTimeout(timeoutRef.current);
    setReading(false);
    if (result.status !== 'success' || !validateCarousel(result.post)) {
      onError(result.message || 'A leitura ficou incompleta. Nenhum carrossel foi confirmado.');
      return;
    }
    const post = result.post;
    setPosts((current) => [...current.filter((item) => item.url !== post.url), post]);
    setSelected((current) => {
      const next = new Set([...current].filter((key) => !key.startsWith(`${post.url}#`)));
      post.children.forEach((item) => next.add(carouselItemKey(post, item)));
      return next;
    });
    setPreviewFailed(new Set());
    onNotice(`${post.total_items} itens do carrossel carregados na ordem original. Nenhum download iniciado.`);
  }, [extensionStatus?.lastCarousel, onError, onNotice]);

  const analyze = () => {
    if (requestRef.current) return;
    const url = normalizeCarouselUrl(link);
    if (!url) { onError('Cole o link completo de uma publicacao do Instagram: https://www.instagram.com/p/.../'); return; }
    if (!ready) { onError(`Atualize e recarregue o HF Bulk Explorer ${CAROUSEL_EXTENSION_VERSION} no Chrome antes de ler carrosseis.`); return; }
    onError('');
    onNotice('');
    const requestId = crypto.randomUUID();
    requestRef.current = requestId;
    setReading(true);
    setCount(0);
    window.postMessage({ source: 'HF_NEW_CONTROL_HUB', type: 'HF_BULK_CAROUSEL_SCAN', payload: { requestId, url } }, window.location.origin);
    window.open(`${url}#hf-carousel=${requestId}`, '_blank', 'noopener,noreferrer');
    timeoutRef.current = window.setTimeout(() => {
      if (requestRef.current !== requestId) return;
      cancel();
      onError('O Instagram nao concluiu a leitura. Confira se a aba abriu e se a publicacao esta acessivel, depois tente novamente.');
    }, 180000);
  };

  const toggle = (key) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const togglePost = (post) => setSelected((current) => {
    const next = new Set(current);
    const keys = post.children.map((item) => carouselItemKey(post, item));
    const all = keys.every((key) => next.has(key));
    keys.forEach((key) => { if (all) next.delete(key); else next.add(key); });
    return next;
  });
  const removePost = (post) => {
    setPosts((current) => current.filter((item) => item.url !== post.url));
    setSelected((current) => new Set([...current].filter((key) => !key.startsWith(`${post.url}#`))));
  };

  const queueZip = async () => {
    if (queueRef.current) return;
    if (!serviceReady) { onError('O servico de carrosseis ainda nao esta disponivel. Atualize a pagina depois da publicacao.'); return; }
    const chosen = carouselSelection(posts, selected);
    if (!chosen.length) return;
    queueRef.current = true;
    setQueuing(true);
    onError('');
    try {
      const result = await bulkDownloadApi.createCarouselJob(chosen, crypto.randomUUID());
      onJobs(result.jobs || []);
      onNotice('Download iniciado. O ZIP ficara disponivel na fila; falhas serao listadas por item.');
    } catch (error) { onError(error.message); }
    finally { queueRef.current = false; setQueuing(false); }
  };

  return <div className="bulk-carousel-panel">
    <section className="bulk-carousel-source">
      <h2><Layers size={18} /> Carrossel do Instagram</h2>
      {!ready && <div className="bulk-carousel-warning" role="status">
        <AlertCircle size={17} /><span>Carross&eacute;is requerem HF Bulk Explorer {CAROUSEL_EXTENSION_VERSION}.</span>
        <a className="bulk-button ghost" href={`/downloads/hf-bulk-explorer.zip?v=${CAROUSEL_EXTENSION_VERSION}`} download><Download size={15} /> Atualizar extens&atilde;o</a>
      </div>}
      <div className="bulk-carousel-form">
        <input aria-label="Link do carrossel" value={link} onChange={(event) => setLink(event.target.value)}
          placeholder="https://www.instagram.com/p/.../" disabled={reading} onKeyDown={(event) => { if (event.key === 'Enter') analyze(); }} />
        <button type="button" className={`bulk-button ${reading ? 'danger' : 'primary'}`} onClick={reading ? cancel : analyze}>
          {reading ? <X size={17} /> : <Search size={17} />}{reading ? `Cancelar (${count} itens)` : 'Analisar carrossel'}
        </button>
      </div>
    </section>
    {!posts.length && <div className="bulk-empty"><Layers size={30} /><strong>Nenhum carrossel analisado</strong></div>}
    {posts.map((post) => {
      const all = post.children.every((child) => selected.has(carouselItemKey(post, child)));
      return <section className="bulk-carousel-post" key={post.url}>
        <header>
          <div><h3>{post.title}</h3><span>{post.children.filter((child) => selected.has(carouselItemKey(post, child))).length}/{post.total_items} selecionados</span></div>
          <div className="bulk-carousel-post-actions">
            <button type="button" className="bulk-button ghost" onClick={() => togglePost(post)}>{all ? <CheckSquare2 size={16} /> : <Square size={16} />}{all ? 'Desmarcar todos' : 'Selecionar todos'}</button>
            <a className="bulk-icon-button" href={post.url} target="_blank" rel="noreferrer" title="Abrir publicacao" aria-label="Abrir publicacao"><ExternalLink size={16} /></a>
            <button type="button" className="bulk-icon-button danger" onClick={() => removePost(post)} title="Remover carrossel" aria-label="Remover carrossel"><X size={17} /></button>
          </div>
        </header>
        <div className="bulk-carousel-grid">
          {[...post.children].sort((a, b) => a.position - b.position).map((item) => {
            const key = carouselItemKey(post, item);
            const checked = selected.has(key);
            return <article className={`bulk-carousel-item ${checked ? 'selected' : ''}`} key={key}>
              <div className="bulk-carousel-media">
                {item.media_type === 'video' && item.preview_url && !previewFailed.has(key)
                  ? <video controls preload="none" src={item.preview_url} poster={item.thumbnail || undefined} onError={() => setPreviewFailed((old) => new Set([...old, key]))} />
                  : item.thumbnail && !previewFailed.has(`${key}:image`) ? <img src={item.thumbnail} alt={`Item ${item.position}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setPreviewFailed((old) => new Set([...old, `${key}:image`]))} />
                    : <div className="bulk-carousel-preview-missing"><ImageIcon size={28} /><span>Pr&eacute;via indispon&iacute;vel</span></div>}
              </div>
              <div className="bulk-carousel-item-footer">
                <label><input type="checkbox" checked={checked} onChange={() => toggle(key)} aria-label={`Selecionar item ${item.position} de ${post.title}`} /><strong>{String(item.position).padStart(2, '0')}</strong></label>
                <span>{item.media_type === 'video' ? 'Video' : 'Imagem'}</span>
              </div>
              {item.capture_error && <small className="bulk-carousel-item-warning">MP4 pendente de verifica&ccedil;&atilde;o</small>}
            </article>;
          })}
        </div>
      </section>;
    })}
    <div className="bulk-carousel-download">
      <span>{selected.size} item(ns) selecionado(s)</span>
      <button type="button" className="bulk-button download" disabled={!selected.size || queuing || reading} onClick={queueZip}>
        {queuing ? <Loader2 className="spin" size={17} /> : <Download size={17} />} Baixar carross&eacute;is em ZIP
      </button>
    </div>
  </div>;
}
