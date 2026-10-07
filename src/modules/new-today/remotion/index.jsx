import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { NewTodayComposition } from './NewTodayComposition';
import { NEW_TODAY_FPS, NEW_TODAY_IMAGE_FRAMES } from './timeline';

const Root = () => (
  <Composition
    id="NewToday"
    component={NewTodayComposition}
    width={1080}
    height={1920}
    fps={NEW_TODAY_FPS}
    durationInFrames={NEW_TODAY_IMAGE_FRAMES}
    calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames || NEW_TODAY_IMAGE_FRAMES })}
    defaultProps={{ mediaSrc: '', mediaType: 'image', headline: '', brand: 'NEW ATLAS', template: 'classic', summary: '', callout: 'ATÉ O FIM!!!', positionX: 50, positionY: 50 }}
  />
);

registerRoot(Root);
