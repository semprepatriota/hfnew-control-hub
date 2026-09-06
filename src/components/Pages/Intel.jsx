import React from 'react';
import { Radar } from 'lucide-react';
import YouTubeAnalyticsTab from './Tabs/YouTubeAnalyticsTab';
import './Pages.css';
import './Intel.css';

function Intel() {
  return (
    <div className="page-container intel-monitor-page">
      <div className="page-header intel-monitor-page__header">
        <div>
          <span className="intel-monitor-page__eyebrow">
            <Radar size={16} />
            Inteligência de canal
          </span>
          <h1>YouTube Radar</h1>
          <p>Monitore desempenho, frequência e oportunidades nos seus canais conectados.</p>
        </div>
      </div>

      <YouTubeAnalyticsTab />
    </div>
  );
}

export default Intel;
