import React from 'react';
import { Composition, registerRoot } from 'remotion';
import RankingComposition from '../../src/modules/ranking-pilot/RankingComposition';
import { buildTimeline } from '../../src/modules/ranking-pilot/timeline.mjs';

function Root() {
  return <>
    <Composition id="RankingClassic" component={RankingComposition} width={1080} height={1920}
      fps={30} durationInFrames={360}
      defaultProps={{ project: { model: 'classic', titleLines: ['', ''], highlights: ['', ''], titleSize: 64, labelSize: 38, items: [] }, assets: {} }}
      calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.project, props.assets).durationInFrames })} />
    <Composition id="RankingInterludes" component={RankingComposition} width={1080} height={1920}
      fps={30} durationInFrames={405}
      defaultProps={{ project: { model: 'interludes', titleLines: ['', ''], highlights: ['', ''], titleSize: 64, labelSize: 38, items: [] }, assets: {} }}
      calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.project, props.assets).durationInFrames })} />
  </>;
}
registerRoot(Root);
