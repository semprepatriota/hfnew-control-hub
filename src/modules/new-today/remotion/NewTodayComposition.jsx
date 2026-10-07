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

const NEWS_FONT = 'Arial, sans-serif';

function NewsText({ headline, summary, source, showHeadline = true, titleColor = '#fff', bodyColor = '#e7edf6', sourceColor = '#abbccf', titleSize = 54, bodySize = 34, style = {} }) {
  const title = String(headline || 'Manchete da notícia').trim();
  const body = String(summary || '').trim();
  const adjustedTitle = title.length > 65 ? titleSize * 0.76 : title.length > 42 ? titleSize * 0.88 : titleSize;
  const adjustedBody = body.length > 100 ? bodySize * 0.85 : body.length > 75 ? bodySize * 0.92 : bodySize;
  return <div style={{ fontFamily: NEWS_FONT, minWidth: 0, overflow: 'hidden', ...style }}>
    {showHeadline && <div style={{ color: titleColor, fontSize: adjustedTitle, fontWeight: 900, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{title}</div>}
    {body && <div style={{ color: bodyColor, marginTop: showHeadline ? 21 : 0, fontSize: adjustedBody, fontWeight: 500, lineHeight: 1.22, overflowWrap: 'anywhere' }}>{body}</div>}
    {source && <div style={{ color: sourceColor, marginTop: 20, fontSize: 23, fontWeight: 700, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>FONTE: {source}</div>}
  </div>;
}

function AlertStory(props) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: '#03254c', fontFamily: NEWS_FONT }}>
    <Img src={staticFile('new-today-globe.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.13 }} />
    <div style={{ position: 'absolute', top: 30, left: 20, width: 250, height: 190, opacity: 0.9, backgroundImage: 'radial-gradient(#fff 5px, transparent 6px)', backgroundSize: '31px 31px' }} />
    <div style={{ position: 'absolute', top: 104, left: 188, width: 715, height: 116, transform: 'skewX(-17deg)', background: '#c80820', boxShadow: '14px 10px 0 #143a63' }} />
    <div style={{ position: 'absolute', top: 121, left: 220, width: 620, color: WHITE, fontSize: 65, fontWeight: 900, textAlign: 'center' }}>ALERTA</div>
    <div style={{ position: 'absolute', top: 300, left: 94, width: 892, height: 1080, overflow: 'hidden', background: '#061524', opacity: enter }}><AtlasMedia {...props} frame={frame} /></div>
    <div style={{ position: 'absolute', top: 1450, left: 48, width: 984, height: 135, background: WHITE, display: 'flex', alignItems: 'center', boxShadow: '0 8px 0 #ab0922' }}>
      <div style={{ width: 190, height: 135, background: '#d20720', transform: 'skewX(-17deg)', marginLeft: -10, flexShrink: 0 }} />
      <div style={{ position: 'absolute', left: 164, top: 24, width: 18, height: 86, transform: 'skewX(-17deg)', background: '#d20720' }} />
      <span style={{ marginLeft: 25, width: 765, maxHeight: 122, color: '#162345', fontSize: String(props.headline || '').length > 55 ? 34 : 40, fontWeight: 900, lineHeight: 1.07, overflow: 'hidden', overflowWrap: 'anywhere' }}>{props.headline || 'Manchete da notícia'}</span>
    </div>
    <NewsText showHeadline={false} summary={props.summary} source={props.source} bodySize={32} style={{ position: 'absolute', top: 1640, left: 90, width: 900, maxHeight: 245 }} />
  </AbsoluteFill>;
}

function BreakingStory(props) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: WHITE, fontFamily: NEWS_FONT }}>
    <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 1440, overflow: 'hidden', background: '#101b2b' }}><AtlasMedia {...props} frame={frame} /></div>
    <div style={{ position: 'absolute', top: 55, left: 44, padding: '11px 25px', color: '#fff', background: '#c9081b', fontSize: 30, fontWeight: 850 }}>NEW ATLAS</div>
    <div style={{ position: 'absolute', top: 1378, left: 0, width: 600, height: 95, transform: 'skewX(-13deg)', transformOrigin: 'bottom left', background: '#c50018' }} />
    <div style={{ position: 'absolute', top: 1396, left: 22, color: WHITE, fontSize: 55, fontWeight: 900 }}>ÚLTIMAS NOTÍCIAS</div>
    <div style={{ position: 'absolute', top: 1508, left: 36, width: 1008, height: 325, overflow: 'hidden' }}>
      <NewsText headline={props.headline} summary={props.summary} source={props.source} titleColor="#172044" bodyColor="#25304b" sourceColor="#64718d" titleSize={49} bodySize={29} />
    </div>
    <BreakingTicker top={1850} frame={frame} />
  </AbsoluteFill>;
}

function FieldStory(props) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: '#071329', fontFamily: NEWS_FONT }}>
    <AbsoluteFill><AtlasMedia {...props} frame={frame} /></AbsoluteFill>
    <AbsoluteFill style={{ background: 'linear-gradient(to bottom, transparent 34%, rgba(1, 6, 28, 0.35) 49%, #020b2a 76%, #020b2a 100%)' }} />
    <div style={{ position: 'absolute', top: 52, left: 70, color: WHITE, fontSize: 41, fontWeight: 700, textShadow: '0 2px 8px #101827' }}>NEW ATLAS</div>
    <div style={{ position: 'absolute', top: 1160, left: 75, width: 925, minHeight: 550, paddingLeft: 35, borderLeft: '12px solid #d20721', overflow: 'hidden' }}>
      <NewsText headline={props.headline} summary={props.summary} source={props.source} titleSize={72} bodySize={37} />
    </div>
    <BreakingTicker top={1848} frame={frame} />
  </AbsoluteFill>;
}

function TemplateStory(props) {
  if (props.template === 'bulletin') return <BulletinStory {...props} />;
  if (props.template === 'brief') return <BriefStory {...props} />;
  if (props.template === 'alert') return <AlertStory {...props} />;
  if (props.template === 'breaking') return <BreakingStory {...props} />;
  if (props.template === 'field') return <FieldStory {...props} />;
  return <Story {...props} />;
}

function AnimatedAtlasLogo({ template }) {
  const classic = template !== 'bulletin' && template !== 'brief';
  const size = classic ? 136 : 156;
  return (
    <div style={{ position: 'absolute', top: template === 'bulletin' ? 104 : classic ? 4 : 26, right: 42, width: size, height: size, pointerEvents: 'none' }}>
      <Video src={staticFile('new-atlas-logo-alpha.webm')} loop muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}

export function NewTodayComposition(props) {
  const { durationInFrames } = useVideoConfig();
  const contentFrames = contentFramesFor(durationInFrames);
  return (
    <AbsoluteFill style={{ background: '#020720' }}>
      <RadarBackground />
      <Sequence from={0} durationInFrames={NEW_TODAY_INTRO_FRAMES}><Intro brand={props.brand} /></Sequence>
      <Sequence from={NEW_TODAY_INTRO_FRAMES} durationInFrames={contentFrames}><TemplateStory {...props} contentFrames={contentFrames} /></Sequence>
      <AnimatedAtlasLogo template={props.template} />
    </AbsoluteFill>
  );
}
