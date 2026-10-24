import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import Top10Composition from '../src/modules/top10/Top10Composition';
import { buildTimeline } from '../src/modules/top10/timeline.mjs';

function Preview() {
  const [project,setProject]=useState(null);
  const player=useRef();
  useEffect(()=>{fetch('http://127.0.0.1:9016/api/qa/project').then(r=>r.json()).then(setProject);},[]);
  useEffect(()=>{if(project) window.top10CtaQa={seek:frame=>{player.current.pause();player.current.seekTo(frame);},project:()=>project};},[project]);
  if(!project) return null;
  const timeline=buildTimeline(project,project.config);
  const total=timeline.at(-1).from+timeline.at(-1).frames;
  return <Player ref={player} component={Top10Composition} inputProps={{project,config:project.config}} durationInFrames={total}
    fps={30} compositionWidth={1080} compositionHeight={1920} style={{width:1080,height:1920}} />;
}
createRoot(document.getElementById('root')).render(<Preview/>);
