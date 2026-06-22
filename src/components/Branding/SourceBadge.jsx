import React from 'react';
import './SourceBadge.css';
import youtubeIconOfficial from '../../assets/brands/youtube/youtube-icon-official.png';

function SourceBadge({
  label,
  detail,
  tone = 'youtube',
  compact = false,
  className = '',
  officialAsset = false,
}) {
  return (
    <div className={`source-badge tone-${tone} ${compact ? 'compact' : ''} ${className}`.trim()}>
      {officialAsset && tone === 'youtube' ? (
        <img
          src={youtubeIconOfficial}
          alt="YouTube"
          className="source-badge__official-icon"
          loading="lazy"
        />
      ) : null}
      <span>{label}</span>
      {detail ? <strong>{detail}</strong> : null}
    </div>
  );
}

export default SourceBadge;
