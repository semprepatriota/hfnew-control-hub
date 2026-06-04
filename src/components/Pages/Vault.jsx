import React, { useState, useEffect } from 'react';
import { Plus, Lock } from 'lucide-react';
import { apiUrl } from '../../config/api';
import './Pages.css';

function Vault() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/vault/'))
      .then(res => res.json())
      .then(data => {
        setItems(data.items);
        setLoading(false);
      })
      .catch(err => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>The Vault</h1>
        <button className="btn-primary">
          <Plus size={20} />
          Novo Item
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner">Carregando...</div>
      ) : (
        <div className="content-grid">
          {items.length === 0 ? (
            <div className="empty-state">
              <Lock size={48} />
              <h3>Cofre Vazio</h3>
              <p>Faça upload de seus arquivos importantes</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="content-card vault-card">
                <div className="card-icon">
                  <Lock size={20} />
                </div>
                <h3>{item.nome}</h3>
                <p className="card-type">{item.tipo}</p>
                <span className="file-size">{item.tamanho}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Vault;
