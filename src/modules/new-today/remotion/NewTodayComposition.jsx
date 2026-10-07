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
  const name = String(brand || 'NEW ATLAS').trim().split(/\s+/);
  const first = name.slice(0, -1).join(' ') || name[0];
  const last = name.length > 1 ? name.at(-1) : 'ATLAS';
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

function AtlasMedia({ mediaSrc, mediaType, positionX = 50, positionY = 50, frame, contentFrames }) {
  const resolvedMedia = mediaSrc?.startsWith('/new-today-media/') ? staticFile(mediaSrc.slice(1)) : mediaSrc;
  if (!resolvedMedia) return null;
  const style = {
    width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${positionX}% ${positionY}%`,
    transform: mediaType === 'image' ? `scale(${1 + (frame / Math.max(1, contentFrames)) * 0.035})` : undefined,
  };
  return mediaType === 'video' ? <Video src={resolvedMedia} style={style} /> : <Img src={resolvedMedia} style={style} />;
}

function BreakingTicker({ top, frame }) {
  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, height: 62, overflow: 'hidden', background: '#ae0010', borderTop: '2px solid #e43237', borderBottom: '2px solid #650009' }}>
      <div style={{ display: 'flex', gap: 44, width: 'max-content', height: '100%', alignItems: 'center', transform: `translateX(${-((frame * 1.6) % 430)}px)` }}>
        {Array.from({ length: 9 }, (_, index) => <span key={index} style={{ color: WHITE, fontFamily: 'Arial, sans-serif', fontSize: 36, fontWeight: 700, whiteSpace: 'nowrap' }}>BREAKING NEWS</span>)}
      </div>
    </div>
  );
}

function AtlasMark({ top, compact = false, brand }) {
  const words = String(brand || 'NEW ATLAS').trim().split(/\s+/);
  const main = words.slice(0, -1).join(' ') || words[0];
  const tag = words.length > 1 ? words.at(-1) : 'ATLAS';
  const plateHeight = compact ? 180 : 190;
  return (
    <div style={{ position: 'absolute', top, left: compact ? 56 : 160, width: compact ? 760 : 760, height: plateHeight + 78 }}>
      <div style={{ height: plateHeight, background: '#b60012', clipPath: 'polygon(7% 0, 100% 0, 93% 100%, 0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontFamily: 'Arial, sans-serif', fontSize: main.length > 10 ? 65 : main.length > 6 ? 88 : compact ? 110 : 116, fontWeight: 900, fontStyle: 'italic' }}>{main}</div>
      <div style={{ position: 'absolute', top: plateHeight - 19, left: 46, minWidth: 325, height: 96, padding: '0 24px', boxSizing: 'border-box', background: WHITE, clipPath: 'polygon(7% 0, 100% 0, 93% 100%, 0 100%)', color: '#a9000c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif', fontSize: tag.length > 8 ? 48 : tag.length > 5 ? 60 : 72, fontWeight: 900, fontStyle: 'italic' }}>{tag}</div>
    </div>
  );
}

function BulletinStory(props) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 15], [0.2, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <RadarBackground />
      <div style={{ position: 'absolute', top: 88, left: 50, width: 980, height: 1395, overflow: 'hidden', background: '#06101b', opacity: enter }}>
        <AtlasMedia {...props} frame={frame} />
      </div>
      <BreakingTicker top={25} frame={frame} />
      <div style={{ position: 'absolute', top: 1483, left: 0, right: 0, height: 10, background: WHITE }} />
      <BreakingTicker top={1518} frame={frame} />
      <AtlasMark top={1607} brand={props.brand} />
    </AbsoluteFill>
  );
}

function BriefStory(props) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 15], [0.2, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const headline = String(props.headline || 'Manchete da notícia').trim();
  const summary = String(props.summary || '').trim();
  const titleSize = headline.length > 65 ? 40 : headline.length > 40 ? 47 : 56;
  const summarySize = summary.length > 100 ? 26 : summary.length > 70 ? 29 : 33;
  return (
    <AbsoluteFill>
      <RadarBackground />
      <BreakingTicker top={223} frame={frame} />
      <div style={{ position: 'absolute', top: 287, left: 0, width: 1080, height: 700, overflow: 'hidden', background: '#06101b', opacity: enter }}>
        <AtlasMedia {...props} frame={frame} />
      </div>
      <BreakingTicker top={986} frame={frame} />
      <div style={{ position: 'absolute', top: 1288, left: 0, right: 0, height: 12, background: WHITE }} />
      <AtlasMark top={1122} compact brand={props.brand} />
      <div style={{ position: 'absolute', top: 1405, left: 96, width: 888, height: 320, paddingLeft: 36, boxSizing: 'border-box', borderLeft: '8px solid #d00016', color: WHITE, fontFamily: 'Arial, sans-serif', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: titleSize, fontWeight: 850, lineHeight: 1.08, overflowWrap: 'anywhere' }}>{headline}</div>
        <div style={{ marginTop: 14, fontSize: summarySize, lineHeight: 1.18, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{summary}</div>
      </div>
      {props.source && <div style={{ position: 'absolute', top: 1730, left: 135, width: 830, color: '#d4e6f1', fontFamily: 'Arial, sans-serif', fontSize: 22, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>FONTE: {props.source}</div>}
      {props.callout && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 158, background: '#ad0011', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 866, height: 70, background: WHITE, clipPath: 'polygon(4% 0, 100% 0, 96% 100%, 0 100%)', color: '#a80010', fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{props.callout}</div>
      </div>}
    </AbsoluteFill>
  );
}

function TemplateStory(props) {
  if (props.template === 'bulletin') return <BulletinStory {...props} />;
  if (props.template === 'brief') return <BriefStory {...props} />;
  return <Story {...props} />;
}

export function NewTodayComposition(props) {
  const { durationInFrames } = useVideoConfig();
  const contentFrames = contentFramesFor(durationInFrames);
  return (
    <AbsoluteFill style={{ background: '#020720' }}>
      <RadarBackground />
      <Sequence from={0} durationInFrames={NEW_TODAY_INTRO_FRAMES}><Intro brand={props.brand} /></Sequence>
      <Sequence from={NEW_TODAY_INTRO_FRAMES} durationInFrames={contentFrames}><TemplateStory {...props} contentFrames={contentFrames} /></Sequence>
    </AbsoluteFill>
  );
}
