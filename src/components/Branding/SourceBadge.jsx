import React from 'react';
import './SourceBadge.css';

function SourceBadge({ label, detail, tone = 'youtube', compact = false, className = '' }) {
  return (
    <div className={`source-badge tone-${tone} ${compact ? 'compact' : ''} ${className}`.trim()}>
      <span>{label}</span>
      {detail ? <strong>{detail}</strong> : null}
    </div>
  );
}

export default SourceBadge;
