import React, { useState } from 'react';
import { Zap, BarChart3, Globe } from 'lucide-react';
import AILinksTab from './Tabs/AILinksTab';
import YouTubeAnalyticsTab from './Tabs/YouTubeAnalyticsTab';
import DemographicsTab from './Tabs/DemographicsTab';
import './IntelTabs.css';

function IntelTabs() {
  const [activeTab, setActiveTab] = useState('ai-links');

  const tabs = [
    {
      id: 'ai-links',
      label: 'IA & Links',
      icon: Zap,
      color: 'neon-green',
      component: <AILinksTab />
    },
    {
      id: 'analytics',
      label: 'Análise do Canal',
      icon: BarChart3,
      color: 'neon-blue',
      component: <YouTubeAnalyticsTab />
    },
    {
      id: 'demographics',
      label: 'Público por Região',
      icon: Globe,
      color: 'neon-gold',
      component: <DemographicsTab />
    }
  ];

  return (
    <div className="intel-tabs-container">
      <div className="tabs-header">
        <div className="tabs-nav">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''} ${tab.color}`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="tabs-content">
        {tabs.find(t => t.id === activeTab)?.component}
      </div>
    </div>
  );
}

export default IntelTabs;
