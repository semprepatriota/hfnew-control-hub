import React, { useEffect, useState } from 'react';
import {
  Send,
  Loader,
  CheckCircle,
  AlertCircle,
  Camera,
  Copy,
  ExternalLink,
  History,
  Image as ImageIcon,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';
import { apiUrl } from '../../config/api';
import './UniversalCapture.css';

function UniversalCapture() {
  const [url, setUrl] = useState('');
  const [deviceType, setDeviceType] = useState('mobile');
  const [captureMode, setCaptureMode] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectingHistory, setSelectingHistory] = useState(false);
  const [selectedCaptureIds, setSelectedCaptureIds] = useState([]);
  const [deletingHistory, setDeletingHistory] = useState(false);

  const supportedPlatforms = [
    { name: 'Amazon', icon: 'SHOP' },
    { name: 'Mercado Livre', icon: 'ML' },
    { name: 'Shopee', icon: 'SHOP' },
    { name: 'Instagram', icon: 'IG' },
    { name: 'TikTok', icon: 'TT' },
    { name: 'YouTube', icon: 'YT' },
    { name: 'Pinterest', icon: 'PIN' },
    { name: 'Facebook', icon: 'FB' },
    { name: 'X/Twitter', icon: 'X' },
  ];

  useEffect(() => {
    loadCaptureHistory();
  }, []);

  const loadCaptureHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(apiUrl('/api/scraper/history?limit=8'));
      if (response.ok) {
        const data = await response.json();
        setCaptures(data.captures || []);
      }
    } catch (err) {
      console.error('Capture history error:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const imagePathFor = (capture) => capture?.forge_image_path || capture?.screenshot_path || '';
  const imageUrlFor = (capture) => apiUrl(imagePathFor(capture));
  const captureIdFor = (capture) => capture?.id || capture?.filename || '';
  const selectedCount = selectedCaptureIds.length;

  const handleCapture = async () => {
    if (!url.trim()) {
      setError('Por favor, insira uma URL');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setCopied(false);

    try {
      const response = await fetch(apiUrl('/api/scraper/capture'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          device_type: deviceType,
          mode: captureMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || 'Erro ao capturar a imagem'
        );
      }

      const data = await response.json();
      setResult(data);
      setUrl('');
      await loadCaptureHistory();
    } catch (err) {
      setError(err.message || 'Erro ao processar a captura. Verifique a URL e tente novamente.');
      console.error('Capture error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleCapture();
    }
  };

  const handleUseInForge = (capture = result) => {
    const imagePath = capture?.forge_image_path;
    if (!imagePath) {
      setError('Essa captura antiga não está no formato do Forge. Capture novamente para usar no renderizador.');
      return;
    }
    localStorage.setItem('forge_selected_image', apiUrl(imagePath));
    window.location.href = '/forge';
  };

  const handleCopyImage = async (capture = result) => {
    const imagePath = imagePathFor(capture);
    if (!imagePath) return;
    await navigator.clipboard.writeText(apiUrl(imagePath));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const selectHistoryItem = (capture) => {
    if (selectingHistory) {
      toggleHistorySelection(capture);
      return;
    }
    setResult(capture);
    setError('');
    setCopied(false);
  };

  const toggleHistorySelection = (capture) => {
    const captureId = captureIdFor(capture);
    if (!captureId) return;

    setSelectedCaptureIds((current) => (
      current.includes(captureId)
        ? current.filter((id) => id !== captureId)
        : [...current, captureId]
    ));
  };

  const toggleSelectionMode = () => {
    setSelectingHistory((current) => !current);
    setSelectedCaptureIds([]);
  };

  const selectAllHistory = () => {
    setSelectedCaptureIds(captures.map(captureIdFor).filter(Boolean));
  };

  const clearHistorySelection = () => {
    setSelectedCaptureIds([]);
  };

  const deleteSelectedHistory = async () => {
    if (selectedCaptureIds.length === 0) {
      setError('Selecione pelo menos uma captura para deletar');
      return;
    }

    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Deletar ${selectedCaptureIds.length} captura(s) do histórico?`)) {
      return;
    }

    setDeletingHistory(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/scraper/history/delete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: selectedCaptureIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao deletar capturas');
      }

      if (result && selectedCaptureIds.includes(captureIdFor(result))) {
        setResult(null);
      }

      setSelectedCaptureIds([]);
      setSelectingHistory(false);
      await loadCaptureHistory();
    } catch (err) {
      setError(err.message || 'Erro ao deletar capturas');
    } finally {
      setDeletingHistory(false);
    }
  };

  return (
    <div className="universal-capture-container">
      <div className="capture-header">
        <h2>
          <Camera size={24} />
          Captura Universal
        </h2>
        <p>Capture imagem limpa ou print vertical pronto para o The Forge</p>
      </div>

      <div className="supported-platforms">
        {supportedPlatforms.map((platform) => (
          <div key={platform.name} className="platform-badge">
            <span className="platform-emoji">{platform.icon}</span>
            <span className="platform-name">{platform.name}</span>
          </div>
        ))}
      </div>

      <div className="capture-input-section">
        <div className="input-wrapper">
          <input
            type="url"
            placeholder="Cole a URL do post, produto, vídeo ou imagem direta"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="capture-input"
          />
          <button
            onClick={handleCapture}
            disabled={loading || !url.trim()}
            className="capture-button"
          >
            {loading ? (
              <>
                <Loader size={18} className="spinner" />
                Capturando...
              </>
            ) : (
              <>
                <Send size={18} />
                Capturar
              </>
            )}
          </button>
        </div>

        <div className="capture-options">
          <label>
            Modo
            <select
              value={captureMode}
              onChange={(e) => setCaptureMode(e.target.value)}
              disabled={loading}
            >
              <option value="auto">Automático</option>
              <option value="image">Imagem limpa</option>
              <option value="screenshot">Print da página</option>
            </select>
          </label>

          <label>
            Formato
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
              disabled={loading}
            >
              <option value="mobile">Mobile compacto</option>
              <option value="vertical">Vertical 9:16</option>
              <option value="desktop">Desktop</option>
            </select>
          </label>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
      </div>

      <div className="capture-workspace">
        <div className="preview-section">
          <h3>Preview</h3>

          {loading && (
            <div className="preview-frame loading">
              <div className="loading-content">
                <Loader size={40} className="spinner" />
                <p>Processando captura...</p>
                <span className="loading-subtitle">Tentando imagem limpa primeiro, depois print se precisar</span>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="preview-frame success">
              <div className="screenshot-container">
                <img
                  src={imageUrlFor(result)}
                  alt="Captura"
                  className="screenshot-image"
                />
                <div className="screenshot-info">
                  <CheckCircle size={20} className="success-icon" />
                  <div className="info-details">
                    <p className="info-label">
                      {result.platform || 'web'} · {result.source || 'captura'}
                    </p>
                    {result.url && (
                      <a href={result.url} target="_blank" rel="noopener noreferrer" className="info-url">
                        {result.url.length > 70 ? `${result.url.substring(0, 70)}...` : result.url}
                      </a>
                    )}
                    <span className="info-time">
                      {new Date(result.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="capture-actions">
                  <button
                    type="button"
                    onClick={() => handleUseInForge(result)}
                    disabled={!result.forge_image_path}
                    title={!result.forge_image_path ? 'Capture novamente para enviar ao Forge' : 'Usar no Forge'}
                  >
                    <ExternalLink size={16} />
                    Usar no Forge
                  </button>
                  <button type="button" onClick={() => handleCopyImage(result)}>
                    <Copy size={16} />
                    {copied ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && !result && (
            <div className="preview-frame empty">
              <div className="empty-content">
                <Camera size={40} />
                <p>Nenhuma captura realizada</p>
                <span>Cole uma URL acima e clique em Capturar</span>
              </div>
            </div>
          )}
        </div>

        <div className="capture-history">
          <div className="history-title">
            <div className="history-heading">
              <History size={17} />
              <h3>Histórico</h3>
              {historyLoading && <Loader size={15} className="spinner" />}
            </div>
            {captures.length > 0 && (
              <button
                type="button"
                className={`history-select-button ${selectingHistory ? 'active' : ''}`}
                onClick={toggleSelectionMode}
              >
                {selectingHistory ? 'Cancelar' : 'Selecionar'}
              </button>
            )}
          </div>

          {selectingHistory && captures.length > 0 && (
            <div className="history-bulk-actions">
              <button type="button" onClick={selectAllHistory}>
                <CheckSquare size={14} />
                Todos
              </button>
              <button type="button" onClick={clearHistorySelection}>
                <Square size={14} />
                Limpar
              </button>
              <button
                type="button"
                className="history-delete-button"
                onClick={deleteSelectedHistory}
                disabled={deletingHistory || selectedCount === 0}
              >
                {deletingHistory ? (
                  <Loader size={14} className="spinner" />
                ) : (
                  <Trash2 size={14} />
                )}
                Deletar {selectedCount > 0 ? selectedCount : ''}
              </button>
            </div>
          )}

          {captures.length === 0 ? (
            <div className="history-empty">
              <ImageIcon size={24} />
              <span>Sem capturas ainda</span>
            </div>
          ) : (
            <div className="history-grid">
              {captures.map((capture) => (
                <button
                  type="button"
                  key={captureIdFor(capture)}
                  className={`history-card ${selectedCaptureIds.includes(captureIdFor(capture)) ? 'selected' : ''}`}
                  onClick={() => selectHistoryItem(capture)}
                >
                  {selectingHistory && (
                    <span className="history-check">
                      {selectedCaptureIds.includes(captureIdFor(capture)) ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                    </span>
                  )}
                  <img src={imageUrlFor(capture)} alt="Histórico" />
                  <span>{capture.platform || capture.source || 'captura'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UniversalCapture;
