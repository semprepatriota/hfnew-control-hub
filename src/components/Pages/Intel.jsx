import React, { useState, useEffect } from 'react';
import { Plus, Brain, Search } from 'lucide-react';
import UniversalCapture from './UniversalCapture';
import IntelTabs from './IntelTabs';
import { apiUrl } from '../../config/api';
import './Pages.css';

function Intel() {
  const [intels, setIntels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch(apiUrl('/api/intel/'))
      .then(res => res.json())
      .then(data => {
        setIntels(data.intels);
        setLoading(false);
      })
      .catch(err => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Alliance Intel</h1>
        <button className="btn-primary">
          <Plus size={20} />
          Nova Intel
        </button>
      </div>

      {/* Seção de Captura Universal */}
      <UniversalCapture />

      {/* Sistema Avançado de Sub-abas */}
      <IntelTabs />

      <div className="search-box">
        <Search size={20} />
        <input
          type="text"
          placeholder="Buscar intels..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-spinner">Carregando...</div>
      ) : (
        <div className="content-grid">
          {intels.length === 0 ? (
            <div className="empty-state">
              <Brain size={48} />
              <h3>Nenhuma intel criada</h3>
              <p>Compartilhe conhecimento com o sistema</p>
            </div>
          ) : (
            intels.map(intel => (
              <div key={intel.id} className="content-card intel-card">
                <div className="card-icon">
                  <Brain size={20} />
                </div>
                <h3>{intel.titulo}</h3>
                <p className="card-category">{intel.categoria}</p>
                <span className="priority-badge" data-priority={intel.prioridade}>
                  {intel.prioridade}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Intel;
