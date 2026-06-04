import React, { useState, useEffect } from 'react';
import { Plus, Hammer } from 'lucide-react';
import ForgeEditor from './ForgeEditor';
import { apiUrl } from '../../config/api';
import './Pages.css';

function Forge() {
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const showEditor = true;

  useEffect(() => {
    fetch(apiUrl('/api/forge/'))
      .then(res => res.json())
      .then(data => {
        setProjetos(data.projetos);
        setLoading(false);
      })
      .catch(err => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🔨 The Forge 70/30</h1>
        <button className="btn-primary">
          <Plus size={20} />
          Novo Projeto
        </button>
      </div>

      {/* Editor Principal */}
      {showEditor && <ForgeEditor />}

      {/* Histórico de Projetos */}
      {loading ? (
        <div className="loading-spinner">Carregando...</div>
      ) : (
        <>
          {projetos.length > 0 && (
            <div className="projects-section">
              <h2>📁 Histórico de Projetos</h2>
              <div className="content-grid">
                {projetos.map(projeto => (
                  <div key={projeto.id} className="content-card forge-card">
                    <div className="card-icon">
                      <Hammer size={20} />
                    </div>
                    <h3>{projeto.nome}</h3>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${projeto.progresso}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">{projeto.progresso}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Forge;
