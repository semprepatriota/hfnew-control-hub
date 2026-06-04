import React, { useState } from 'react';
import { Link2, Send, Loader, Copy, CheckCircle } from 'lucide-react';
import { apiUrl } from '../../../config/api';
import './AILinksTab.css';

function AILinksTab() {
  const [url, setUrl] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const platforms = ['instagram', 'tiktok', 'youtube', 'amazon', 'mercado livre', 'shopee'];

  const handleGenerate = async () => {
    if (!url.trim()) {
      setError('Por favor, insira uma URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/intel/ai-generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          affiliate_link: affiliateLink.trim(),
          platform,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao gerar conteúdo');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
      console.error('AI Generate error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleGenerate();
    }
  };

  return (
    <div className="ai-links-tab">
      {/* Input Section */}
      <div className="input-section">
        <div className="ai-links-header">
          <div>
            <h3>Gerador de Conteúdo com IA</h3>
            <p>Monte rapidamente texto de apoio para links, afiliados e posts de produto ou conteúdo.</p>
          </div>
          <div className="ai-links-output-badge">
            <Link2 size={16} />
            <span>Título, descrição, hashtags e palavras-chave</span>
          </div>
        </div>

        <div className="ai-links-platform-strip">
          {platforms.map((item) => (
            <button
              key={item}
              type="button"
              className={`ai-platform-pill ${platform === item ? 'active' : ''}`}
              onClick={() => setPlatform(item)}
              disabled={loading}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="input-group">
          <label>URL do Conteúdo</label>
          <input
            type="url"
            placeholder="https://instagram.com/p/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            className="input-field"
          />
        </div>

        <div className="input-row">
          <div className="input-group">
            <label>Plataforma</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              disabled={loading}
              className="input-field"
            >
              {platforms.map(p => (
                <option key={p} value={p}>
                  {p === 'mercado livre' ? 'Mercado Livre' : p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Link de Afiliado (Opcional)</label>
            <input
              type="url"
              placeholder="https://seu-link-afiliado.com"
              value={affiliateLink}
              onChange={(e) => setAffiliateLink(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="input-field"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !url.trim()}
          className="generate-button"
        >
          {loading ? (
            <>
              <Loader size={18} className="spinner" />
              Gerando...
            </>
          ) : (
            <>
              <Send size={18} />
              Gerar Conteúdo
            </>
          )}
        </button>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <div className="ai-links-summary-grid">
          <div className="ai-links-summary-card">
            <strong>Fonte</strong>
            <span>{platform === 'mercado livre' ? 'Mercado Livre' : platform}</span>
          </div>
          <div className="ai-links-summary-card">
            <strong>Afiliado</strong>
            <span>{affiliateLink.trim() ? 'Ativo' : 'Opcional'}</span>
          </div>
          <div className="ai-links-summary-card">
            <strong>Saída</strong>
            <span>Texto curto e reutilizável</span>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {result && !loading && (
        <div className="results-section">
          <h3>Conteúdo Gerado</h3>

          {/* Título */}
          <div className="result-field">
            <div className="field-header">
              <label>📝 Título</label>
              <button
                onClick={() => handleCopy(result.titulo, 'titulo')}
                className="copy-button"
              >
                {copied === 'titulo' ? (
                  <CheckCircle size={16} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
            <div className="field-content">{result.titulo}</div>
          </div>

          {/* Descrição */}
          <div className="result-field">
            <div className="field-header">
              <label>📄 Descrição</label>
              <button
                onClick={() => handleCopy(result.descricao, 'descricao')}
                className="copy-button"
              >
                {copied === 'descricao' ? (
                  <CheckCircle size={16} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
            <div className="field-content">{result.descricao}</div>
          </div>

          {/* Descrição com Afiliado */}
          {result.descricao_com_afiliado !== result.descricao && (
            <div className="result-field highlight">
              <div className="field-header">
                <label>🔗 Descrição com Link de Afiliado</label>
                <button
                  onClick={() => handleCopy(result.descricao_com_afiliado, 'afiliado')}
                  className="copy-button"
                >
                  {copied === 'afiliado' ? (
                    <CheckCircle size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              </div>
              <div className="field-content">{result.descricao_com_afiliado}</div>
            </div>
          )}

          {/* Palavras-chave */}
          <div className="result-field">
            <div className="field-header">
              <label>✨ Palavras-chave Visuais</label>
              <button
                onClick={() => handleCopy(result.palavras_chave.join(', '), 'palavras')}
                className="copy-button"
              >
                {copied === 'palavras' ? (
                  <CheckCircle size={16} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
            <div className="keywords-grid">
              {result.palavras_chave.map((palavra, idx) => (
                <div key={idx} className="keyword-tag">
                  {palavra}
                </div>
              ))}
            </div>
          </div>

          {/* Hashtags */}
          <div className="result-field">
            <div className="field-header">
              <label>#️⃣ Hashtags</label>
              <button
                onClick={() => handleCopy(result.hashtags.join(' '), 'hashtags')}
                className="copy-button"
              >
                {copied === 'hashtags' ? (
                  <CheckCircle size={16} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
            <div className="hashtags-container">
              {result.hashtags.map((tag, idx) => (
                <span key={idx} className="hashtag">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && !result && !error && (
        <div className="empty-state">
          <Send size={40} />
          <p>Insira uma URL e clique em "Gerar Conteúdo"</p>
          <span>A IA irá gerar título, descrição, hashtags e palavras-chave</span>
        </div>
      )}
    </div>
  );
}

export default AILinksTab;
