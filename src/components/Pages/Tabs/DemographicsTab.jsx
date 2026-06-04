import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Loader, AlertCircle, RefreshCcw, TrendingUp } from 'lucide-react';
import { apiUrl } from '../../../config/api';
import './DemographicsTab.css';

function DemographicsTab() {
  const [demographics, setDemographics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    fetchDemographics();
  }, []);

  const fetchDemographics = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/intel/youtube-demographics'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao carregar dados demográficos');
      }

      const data = await response.json();
      setDemographics(data);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err.message);
      console.error('Demographics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const dominantMarket = useMemo(() => {
    if (!demographics) return '';
    const entries = [
      { label: 'Brasil', value: demographics.brasil || 0 },
      { label: 'Estados Unidos', value: demographics.eua || 0 },
      { label: 'Resto do Mundo', value: demographics.resto_mundo || 0 },
    ];
    return entries.sort((a, b) => b.value - a.value)[0]?.label || '';
  }, [demographics]);

  const countryRegions = useMemo(() => {
    if (!demographics?.country_regions?.Brasil) return [];
    return demographics.country_regions.Brasil;
  }, [demographics]);

  if (loading) {
    return (
      <div className="demographics-tab loading-state">
        <Loader size={40} className="spinner" />
        <p>Carregando dados demográficos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="demographics-tab error-state">
        <AlertCircle size={40} />
        <p>Erro ao carregar dados demográficos</p>
        <span>{error}</span>
        <button onClick={fetchDemographics} className="retry-button">
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="demographics-tab">
      <div className="demographics-topbar">
        <div>
          <h3>Leitura geográfica do público</h3>
          <p>Entenda concentração regional, mercados dominantes e expansão internacional.</p>
        </div>
        <button onClick={fetchDemographics} className="retry-button demographics-refresh-button">
          <RefreshCcw size={16} />
          Atualizar
        </button>
      </div>

      <div className="demographics-highlight">
        <strong>Mercado dominante</strong>
        <span>{dominantMarket || 'Sem leitura disponível'}</span>
        <em>{lastUpdated ? `Atualizado em ${new Date(lastUpdated).toLocaleString('pt-BR')}` : 'Sem atualização registrada'}</em>
      </div>

      {/* Main Distribution Chart */}
      <div className="distribution-section compact">
        <h3>Distribuição Global de Público</h3>

        <div className="main-chart">
          {/* Brasil */}
          <div className="chart-segment brasil">
            <div
              className="segment-bar"
              style={{ height: `${demographics.brasil}%` }}
            >
              <div className="segment-label">
                <span className="flag">🇧🇷</span>
                <span className="percentage">{demographics.brasil.toFixed(1)}%</span>
              </div>
            </div>
            <span className="region-name">Brasil</span>
          </div>

          {/* EUA */}
          <div className="chart-segment eua">
            <div
              className="segment-bar"
              style={{ height: `${demographics.eua}%` }}
            >
              <div className="segment-label">
                <span className="flag">🇺🇸</span>
                <span className="percentage">{demographics.eua.toFixed(1)}%</span>
              </div>
            </div>
            <span className="region-name">EUA</span>
          </div>

          {/* Resto do Mundo */}
          <div className="chart-segment mundo">
            <div
              className="segment-bar"
              style={{ height: `${demographics.resto_mundo}%` }}
            >
              <div className="segment-label">
                <span className="flag">🌍</span>
                <span className="percentage">{demographics.resto_mundo.toFixed(1)}%</span>
              </div>
            </div>
            <span className="region-name">Resto do Mundo</span>
          </div>
        </div>
      </div>

      <div className="regions-section">
        <h3>Estados e regiões do Brasil</h3>
        <div className="regions-grid">
          <div className="regions-card">
            <div className="regions-card__header">
              <strong>Brasil</strong>
              <span>{countryRegions.length} estados/regiões</span>
            </div>

            <div className="regions-list">
              {countryRegions.map((region) => (
                <div key={`Brasil-${region.region}`} className="region-row">
                  <div className="region-row__meta">
                    <span>{region.region}</span>
                    <em>{region.percentual.toFixed(1)}%</em>
                  </div>
                  <div className="region-row__bar">
                    <div
                      className="region-row__fill"
                      style={{ width: `${Math.min(region.percentual * 4.5, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Countries */}
      <div className="top-countries-section">
        <h3>
          <Globe size={18} />
          Top Países por Tráfego
        </h3>

        <div className="countries-grid">
          {demographics.top_paises.map((pais, index) => {
            // Determinar cor base por país
            let colorClass = 'default';
            if (pais.pais === 'Brasil') colorClass = 'brasil';
            else if (pais.pais === 'Estados Unidos') colorClass = 'eua';

            return (
              <div key={index} className={`country-card ${colorClass}`}>
                <div className="country-header">
                  <span className="country-rank">#{index + 1}</span>
                  <span className="country-name">{pais.pais}</span>
                </div>

                <div className="country-bar-container">
                  <div
                    className="country-bar"
                    style={{
                      width: `${pais.percentual}%`,
                      animation: `expandWidth 0.8s ease-out ${index * 0.1}s backwards`
                    }}
                  >
                    <span className="bar-percentage">{pais.percentual.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="country-stats">
                  <div className="stat">
                    <span className="stat-label">Visualizações</span>
                    <span className="stat-value">{(pais.views / 1000).toFixed(0)}K</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-section">
        <h3>Resumo Geográfico</h3>

        <div className="summary-cards">
          {/* Brasil */}
          <div className="summary-card brasil">
            <div className="card-header">
              <span className="flag-large">🇧🇷</span>
              <div className="card-title">
                <h4>Brasil</h4>
                <span className="subtitle">Mercado Principal</span>
              </div>
            </div>
            <div className="card-stats">
              <div className="card-stat">
                <span className="stat-icon">📊</span>
                <div>
                  <p>{demographics.brasil.toFixed(1)}%</p>
                  <span>do público</span>
                </div>
              </div>
            </div>
          </div>

          {/* EUA */}
          <div className="summary-card eua">
            <div className="card-header">
              <span className="flag-large">🇺🇸</span>
              <div className="card-title">
                <h4>Estados Unidos</h4>
                <span className="subtitle">Mercado Secundário</span>
              </div>
            </div>
            <div className="card-stats">
              <div className="card-stat">
                <span className="stat-icon">📊</span>
                <div>
                  <p>{demographics.eua.toFixed(1)}%</p>
                  <span>do público</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resto do Mundo */}
          <div className="summary-card mundo">
            <div className="card-header">
              <span className="flag-large">🌍</span>
              <div className="card-title">
                <h4>Resto do Mundo</h4>
                <span className="subtitle">Mercado Global</span>
              </div>
            </div>
            <div className="card-stats">
              <div className="card-stat">
                <span className="stat-icon">📊</span>
                <div>
                  <p>{demographics.resto_mundo.toFixed(1)}%</p>
                  <span>do público</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="insights-section">
        <h3>
          <TrendingUp size={18} />
          Insights & Recomendações
        </h3>

        <div className="insights-list">
          {demographics.brasil > demographics.eua ? (
            <div className="insight-card">
              <span className="insight-icon">🎯</span>
              <div className="insight-content">
                <p className="insight-title">Mercado Brasileiro Dominante</p>
                <span className="insight-text">
                  Brasil representa {demographics.brasil.toFixed(1)}% do seu público. Considere criar conteúdo específico em português brasileiro.
                </span>
              </div>
            </div>
          ) : (
            <div className="insight-card">
              <span className="insight-icon">🌐</span>
              <div className="insight-content">
                <p className="insight-title">Público Internacional Forte</p>
                <span className="insight-text">
                  EUA representa {demographics.eua.toFixed(1)}% do seu público. Considere dublagem ou legendas em inglês.
                </span>
              </div>
            </div>
          )}

          {demographics.resto_mundo > 30 && (
            <div className="insight-card">
              <span className="insight-icon">🌍</span>
              <div className="insight-content">
                <p className="insight-title">Alcance Global Significativo</p>
                <span className="insight-text">
                  {demographics.resto_mundo.toFixed(1)}% do público vem de outros países. Você tem uma audiência verdadeiramente global.
                </span>
              </div>
            </div>
          )}

          <div className="insight-card">
            <span className="insight-icon">📈</span>
            <div className="insight-content">
              <p className="insight-title">Oportunidade de Crescimento</p>
              <span className="insight-text">
                Diversifique seu conteúdo para atrair mais audiência de regiões com menor penetração.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemographicsTab;
