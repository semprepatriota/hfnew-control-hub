import React, { useEffect, useRef, useState } from 'react';
import {
  Clapperboard,
  Film,
  FolderOpen,
  Layers3,
  Play,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import './forge-max-3.css';

const MAX_LIBRARY_ITEMS = 20;

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Carregando...';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function ForgeMax3() {
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const inputRef = useRef(null);
  const assetUrlsRef = useRef(new Set());

  const selectedAsset = assets.find((item) => item.id === selectedAssetId) || null;
  const availableSlots = Math.max(MAX_LIBRARY_ITEMS - assets.length, 0);

  useEffect(() => () => {
    assetUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    assetUrlsRef.current.clear();
  }, []);

  const handleFiles = (event) => {
    const incoming = Array.from(event.target.files || []).filter((file) => file.type.startsWith('video/'));
    if (!incoming.length || !availableSlots) return;

    const additions = incoming.slice(0, availableSlots).map((file) => {
      const url = URL.createObjectURL(file);
      assetUrlsRef.current.add(url);
      return {
        id: `max_${crypto.randomUUID()}`,
        name: file.name,
        url,
        duration: 0,
        width: 0,
        height: 0,
      };
    });

    setAssets((current) => [...current, ...additions]);
    setSelectedAssetId((current) => current || additions[0]?.id || '');
    event.target.value = '';
  };

  const handleAssetMetadata = (assetId, event) => {
    const video = event.currentTarget;
    setAssets((current) => current.map((asset) => (
      asset.id === assetId
        ? { ...asset, duration: video.duration, width: video.videoWidth, height: video.videoHeight }
        : asset
    )));
  };

  const removeAsset = (assetId) => {
    setAssets((current) => {
      const item = current.find((asset) => asset.id === assetId);
      if (item) {
        URL.revokeObjectURL(item.url);
        assetUrlsRef.current.delete(item.url);
      }
      return current.filter((asset) => asset.id !== assetId);
    });
    setSelectedAssetId((current) => (current === assetId ? '' : current));
  };

  const handleHoverStart = (event) => {
    event.currentTarget.play().catch(() => {});
  };

  const handleHoverEnd = (event) => {
    event.currentTarget.pause();
    event.currentTarget.currentTime = 0;
  };

  return (
    <div className="forge-max-page">
      <header className="forge-max-header">
        <div>
          <span className="forge-max-kicker">EDITOR AVANÇADO · FASE 1</span>
          <h1>Forge Max 3.0</h1>
          <p>Biblioteca de alta resolução e preview vertical isolado dos outros módulos de edição.</p>
        </div>
        <div className="forge-max-header-status">
          <span>Biblioteca</span>
          <strong>{assets.length}/{MAX_LIBRARY_ITEMS}</strong>
          <small>vídeos nesta sessão</small>
        </div>
      </header>

      <section className="forge-max-workspace">
        <section className="forge-max-panel forge-max-library-panel">
          <div className="forge-max-panel-header">
            <div>
              <span className="forge-max-section-icon"><FolderOpen size={17} /></span>
              <h2>Biblioteca de Vídeos</h2>
              <p>Até 20 clipes. Passe o mouse para revisar antes de selecionar.</p>
            </div>
            <label className={`forge-max-upload ${availableSlots ? '' : 'disabled'}`}>
              <Upload size={16} />
              Adicionar vídeos
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                multiple
                disabled={!availableSlots}
                onChange={handleFiles}
              />
            </label>
          </div>

          {!assets.length ? (
            <div className="forge-max-library-empty">
              <Film size={30} />
              <strong>Nenhum vídeo selecionado</strong>
              <span>Adicione vídeos para montar a biblioteca do projeto.</span>
            </div>
          ) : (
            <div className="forge-max-library-grid">
              {assets.map((asset, index) => (
                <article key={asset.id} className={`forge-max-library-card ${asset.id === selectedAssetId ? 'selected' : ''}`}>
                  <button type="button" className="forge-max-library-preview" onClick={() => setSelectedAssetId(asset.id)}>
                    <video
                      src={asset.url}
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(event) => handleAssetMetadata(asset.id, event)}
                      onMouseEnter={handleHoverStart}
                      onMouseLeave={handleHoverEnd}
                    />
                    <span className="forge-max-card-index">{String(index + 1).padStart(2, '0')}</span>
                    {asset.id === selectedAssetId && <span className="forge-max-card-selected">Selecionado</span>}
                    <span className="forge-max-card-play"><Play size={15} fill="currentColor" /></span>
                  </button>
                  <div className="forge-max-card-meta">
                    <strong title={asset.name}>{asset.name}</strong>
                    <span>{asset.width ? `${asset.width}×${asset.height}` : 'Detectando'} · {formatDuration(asset.duration)}</span>
                  </div>
                  <button type="button" className="forge-max-card-delete" onClick={() => removeAsset(asset.id)} aria-label={`Excluir ${asset.name}`} title="Excluir da biblioteca">
                    <X size={15} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="forge-max-panel forge-max-preview-panel">
          <div className="forge-max-panel-header">
            <div>
              <span className="forge-max-section-icon"><Clapperboard size={17} /></span>
              <h2>Preview de Edição</h2>
              <p>Palco fixo 9:16, igual ao The Forge 2.0.</p>
            </div>
            <span className="forge-max-vertical-badge">9:16 vertical</span>
          </div>

          <div className="forge-max-preview-stage">
            {selectedAsset ? (
              <video src={selectedAsset.url} controls playsInline className="forge-max-preview-video" />
            ) : (
              <div className="forge-max-preview-empty">
                <Layers3 size={38} />
                <strong>Selecione um vídeo da biblioteca</strong>
                <span>O corte, a timeline e os overlays entram nas próximas fases.</span>
              </div>
            )}
          </div>
          <div className="forge-max-preview-caption">
            <span>Prévia vertical protegida</span>
            <strong>{selectedAsset?.name || 'Nenhum clipe selecionado'}</strong>
          </div>
        </section>

        <section className="forge-max-panel forge-max-roadmap-panel">
          <div className="forge-max-panel-header">
            <div>
              <span className="forge-max-section-icon"><Layers3 size={17} /></span>
              <h2>Estrutura da Edição</h2>
              <p>Esta fase não altera renderização nem APIs existentes.</p>
            </div>
          </div>
          <div className="forge-max-track-list">
            <span><b>V1</b> Vídeos principais</span>
            <span><b>V2</b> União de clipes</span>
            <span><b>V3</b> Imagens e B-roll</span>
            <span><b>V4</b> GIFs e overlays</span>
            <span><b>TXT</b> Títulos e textos</span>
            <span><b>SUB</b> Legendas sincronizadas</span>
            <span><b>A1</b> Áudio original</span>
            <span><b>A2</b> Música de fundo</span>
          </div>
          <div className="forge-max-phase-note">
            <Trash2 size={16} />
            <span>Nada é enviado ou renderizado nesta fase. A biblioteca é visual e local ao navegador.</span>
          </div>
        </section>
      </section>
    </div>
  );
}

export default ForgeMax3;
