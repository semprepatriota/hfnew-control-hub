import React, { useEffect, useState } from 'react';
import { Audio, OffthreadVideo, Sequence, cancelRender, continueRender,
  delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { buildTimeline, previewSeekTime, safeFontSize } from './timeline.mjs';

const fontLoads = new Map();
function Fill({ style, children, ...props }) {
  return <div {...props} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', ...style }}>{children}</div>;
}
function useRankingFont(fontUrl) {
  const [handle] = useState(() => delayRender('Fonte do ranking'));
  useEffect(() => {
    const url = fontUrl || staticFile('fonts/montserrat-latin-800-normal.woff2');
    if (!fontLoads.has(url)) {
      const font = new FontFace('RankingMontserrat', `url("${url}")`, { weight: '800' });
      fontLoads.set(url, font.load().then(loaded => { document.fonts.add(loaded); }));
    }
    fontLoads.get(url).then(() => continueRender(handle)).catch(cancelRender);
  }, [handle, fontUrl]);
}

const mediaSource = src => /^https?:\/\//.test(src) ? src : staticFile(src.replace(/^\//, ''));

function Highlight({ text, term, color }) {
  const index = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  return index < 0 ? text : <>{text.slice(0, index)}<span style={{ color }}>{text.slice(index, index + term.length)}</span>{text.slice(index + term.length)}</>;
}

function Clip({ segment, assets }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clip = segment.clip;
  const vignette = segment.kind !== 'scene';
  const fade = Math.min(Math.round(fps * .13), Math.floor((segment.frames - 1) / 3));
  const opacity = vignette && fade > 0
    ? interpolate(frame, [0, fade, segment.frames - 1 - fade, segment.frames - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
  return <Fill style={{ overflow: 'hidden', opacity }}>
    <OffthreadVideo src={mediaSource(assets[clip.assetId].src)}
      startFrom={clip.startFrame} endAt={clip.endFrame} volume={clip.volume}
      onSeeked={event => {
        const video = event.currentTarget;
        // HTML media seeks can land infinitesimally before a rational frame timestamp.
        const corrected = previewSeekTime(video.currentTime, video.duration, video.paused, fps);
        if (corrected !== video.currentTime) video.currentTime = corrected;
      }}
      style={{ width: '100%', height: '100%', objectFit: clip.fit ?? 'cover',
        objectPosition: `${(clip.x ?? .5) * 100}% ${(clip.y ?? .5) * 100}%`,
        transform: `scale(${clip.zoom ?? 1})`, transformOrigin: `${(clip.x ?? .5) * 100}% ${(clip.y ?? .5) * 100}%` }} />
  </Fill>;
}

export default function RankingComposition({ project, assets, fontUrl }) {
  useRankingFont(fontUrl);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeline = buildTimeline(project, assets);
  const classic = project.model === 'classic';
  const header = classic ? 232 : 237;
  const bottom = classic ? 231 : 0;
  const listTop = classic ? 465 : 355;
  const listBottom = classic ? 1240 : 1160;
  const gap = timeline.count > 1 ? (listBottom - listTop) / (timeline.count - 1) : 0;
  const colors = ['#FF333D', '#27C6FF', '#FFE327'];
  return <Fill data-ranking-stage style={{ background: '#000', color: '#FFF',
    fontFamily: 'RankingMontserrat, sans-serif', fontWeight: 800, letterSpacing: 0 }}>
    <div data-layer="media" style={{ position: 'absolute', left: 0, right: 0, top: header,
      height: 1920 - header - bottom, overflow: 'hidden', background: '#000' }}>
      {timeline.segments.map(segment => <Sequence key={segment.id} from={segment.from}
        durationInFrames={segment.frames} premountFor={fps} name={`${segment.kind} ${segment.rank ?? ''}`}>
        <Clip segment={segment} assets={assets} />
      </Sequence>)}
    </div>
    <div data-layer="title" style={{ position: 'absolute', top: 0, left: 42, right: 42, height: header,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      {project.titleLines.map((line, index) => <div key={index} style={{ fontSize: safeFontSize(line, project.titleSize, 990),
        lineHeight: 1.16, textAlign: 'center', whiteSpace: 'nowrap' }}>
        <Highlight text={line} term={project.highlights?.[index]} color={index ? project.accent : '#FFE327'} />
      </div>)}
    </div>
    <div data-layer="ranking">
      {Array.from({ length: timeline.count }, (_, index) => {
        const rank = index + 1;
        const row = timeline.reveals.find(reveal => reveal.rank === rank);
        const visible = row && frame >= row.from;
        return <div data-rank={rank} data-revealed={String(!!visible)} key={rank}
          style={{ position: 'absolute', left: 78, top: listTop + index * gap,
            display: 'flex', gap: 12, alignItems: 'center', minHeight: 90 }}>
          <span style={{ fontSize: rank > 9 ? 56 : 72, lineHeight: 1, width: 82, flexShrink: 0,
            color: classic ? colors[index] ?? '#FFF' : '#FFF',
            WebkitTextStroke: classic ? '3px #FFF' : '3px #111', paintOrder: 'stroke fill',
            textShadow: classic ? '0 0 4px #000, 2px 2px 1px #000, -2px -2px 1px #000' : '0 0 12px #000, 2px 4px 6px #000' }}>{rank}.</span>
          <span data-rank-label style={{ visibility: visible ? 'visible' : 'hidden', maxWidth: 735,
            fontSize: safeFontSize(row?.label ?? '', project.labelSize, 735), lineHeight: 1.2,
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
            WebkitTextStroke: '3px #0A0A0A', paintOrder: 'stroke fill', textShadow: '0 1px 2px #000' }}>{row?.label}</span>
        </div>;
      })}
    </div>
    {project.music && <Sequence from={0} durationInFrames={timeline.durationInFrames} premountFor={fps}>
      <Audio src={mediaSource(assets[project.music.assetId].src)} loop
        startFrom={project.music.startFrame} endAt={project.music.endFrame} volume={project.music.volume} />
    </Sequence>}
  </Fill>;
}
