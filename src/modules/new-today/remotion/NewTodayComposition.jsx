import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig, Video } from 'remotion';
import { contentFramesFor, NEW_TODAY_INTRO_FRAMES } from './timeline';

const WHITE = '#f9fbff';

function RadarBackground({ dim = false }) {
  const frame = useCurrentFrame();
  const globeTurn = frame * 0.72;
  const pulse = 0.65 + Math.sin(frame / 13) * 0.15;
  const ring = (size, top, left, angle, opacity, edges) => ({
    position: 'absolute', width: size, height: size, top, left,
    boxSizing: 'border-box', borderRadius: '50%',
    borderTop: edges[0] ? '5px solid #2af0df' : '5px solid transparent',
    borderRight: edges[1] ? '5px solid #2af0df' : '5px solid transparent',
    borderBottom: edges[2] ? '5px solid #2af0df' : '5px solid transparent',
    borderLeft: edges[3] ? '5px solid #2af0df' : '5px solid transparent',
    filter: 'drop-shadow(0 0 9px #12d6d7)', opacity,
    transform: `rotate(${angle}deg)`,
  });
  return (
    <AbsoluteFill style={{ background: '#031139', overflow: 'hidden' }}>
      <Img src={staticFile('new-today-globe.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <Img src={staticFile('new-today-globe-sphere.png')} style={{ position: 'absolute', width: 1320, height: 1320, left: -120, top: 285, objectFit: 'contain', transform: `rotate(${globeTurn}deg) scale(${1 + Math.sin(frame / 24) * 0.012})` }} />
      {dim && <AbsoluteFill style={{ background: 'rgba(2, 5, 21, 0.56)' }} />}
      <div style={ring(1230, 345, -75, frame * 1.05, dim ? 0.28 : pulse, [1, 0, 1, 0])} />
      <div style={ring(1030, 445, 25, -frame * 1.35 + 35, dim ? 0.25 : 0.7, [0, 1, 0, 1])} />
      <div style={ring(1410, 255, -165, frame * 0.72 - 70, dim ? 0.18 : 0.38, [1, 0, 0, 1])} />
    </AbsoluteFill>
  );
}

function Intro({ brand }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 4, 17, 21], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = interpolate(frame, [0, 10, 21], [0.92, 1, 1.05], { extrapolateRight: 'clamp' });
  const name = String(brand || 'NEW TODAY').trim().split(/\s+/);
  const first = name.slice(0, -1).join(' ') || name[0];
  const last = name.length > 1 ? name.at(-1) : 'TODAY';
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity, transform: `scale(${scale})` }}>
      <strong style={{ color: WHITE, fontFamily: 'Arial, sans-serif', fontSize: 151, fontWeight: 900, lineHeight: 1, whiteSpace: 'nowrap' }}>{first}</strong>
      <div style={{ minWidth: 580, marginTop: 30, padding: '22px 45px', background: '#d31925', color: WHITE, fontFamily: 'Arial, sans-serif', fontSize: 65, fontWeight: 700, textAlign: 'center', letterSpacing: 22 }}>{last}</div>
    </AbsoluteFill>
  );
}

function Story({ mediaSrc, mediaType, headline, source, positionX = 50, positionY = 50, contentFrames }) {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [0, 20, 58], [0, 0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoom = interpolate(frame, [0, contentFrames], [1, mediaType === 'image' ? 1.065 : 1], { extrapolateRight: 'clamp' });
  const safeHeadline = String(headline || 'Manchete da notícia').trim();
  const fontSize = safeHeadline.length > 145 ? 37 : safeHeadline.length > 110 ? 44 : safeHeadline.length > 72 ? 52 : 66;
  const resolvedMedia = mediaSrc?.startsWith('/new-today-media/') ? staticFile(mediaSrc.slice(1)) : mediaSrc;

  return (
    <AbsoluteFill>
      <RadarBackground dim />
      <div style={{ position: 'absolute', top: 143, left: 108, width: 864, height: 1150, padding: 14, boxSizing: 'border-box', background: WHITE, opacity: enter, transform: `scale(${0.96 + enter * 0.04})`, overflow: 'hidden' }}>
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#071c32' }}>
          {resolvedMedia && (mediaType === 'video'
            ? <Video src={resolvedMedia} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${positionX}% ${positionY}%` }} />
            : <Img src={resolvedMedia} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${positionX}% ${positionY}%`, transform: `scale(${zoom})` }} />)}
        </div>
      </div>
      {source && <div style={{ position: 'absolute', top: 1310, left: 100, width: 880, color: '#a9d4e1', fontFamily: 'Arial, sans-serif', fontSize: 25, fontWeight: 700, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>FONTE: {source}</div>}
      <div style={{ position: 'absolute', top: 1360, left: 100, width: 880, color: WHITE, fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize, lineHeight: 1.14, textAlign: 'center', overflowWrap: 'anywhere', clipPath: `inset(0 ${100 - reveal}% 0 0)` }}>
        {safeHeadline}
      </div>
    </AbsoluteFill>
  );
}

export function NewTodayComposition(props) {
  const { durationInFrames } = useVideoConfig();
  const contentFrames = contentFramesFor(durationInFrames);
  return (
    <AbsoluteFill style={{ background: '#020720' }}>
      <RadarBackground />
      <Sequence from={0} durationInFrames={NEW_TODAY_INTRO_FRAMES}><Intro brand={props.brand} /></Sequence>
      <Sequence from={NEW_TODAY_INTRO_FRAMES} durationInFrames={contentFrames}><Story {...props} contentFrames={contentFrames} /></Sequence>
    </AbsoluteFill>
  );
}
