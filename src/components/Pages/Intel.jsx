import React from 'react';
import { Activity } from 'lucide-react';
import YouTubeAnalyticsTab from './Tabs/YouTubeAnalyticsTab';
import './Pages.css';
import './Intel.css';

function Intel() {
  return (
    <div className="page-container intel-monitor-page">
      <div className="page-header intel-monitor-page__header">
        <div>
          <span className="intel-monitor-page__eyebrow">
            <Activity size={16} />
            Monitoramento de canal
          </span>
          <h1>Alliance Intel</h1>
          <p>Acompanhe cada canal conectado, os vídeos recentes e as mudanças registradas.</p>
        </div>
      </div>

      <YouTubeAnalyticsTab />
    </div>
  );
}

export default Intel;
