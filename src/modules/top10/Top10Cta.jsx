import React from 'react';
import { Img } from 'remotion';
import { ctaStyle } from './cta.mjs';
import subscribe from './assets/subscribe-short-button.png';
import like from './assets/subscribe-short-like.png';

export default function Top10Cta({ frame, duration, fps, perScene = false }) {
  const style = ctaStyle(frame, duration, fps, perScene);
  if (!style.visible) return null;
  return <div data-top10-cta style={{ position: 'absolute', inset: 0, opacity: style.opacity, pointerEvents: 'none' }}>
    <Img src={subscribe} alt="Inscreva-se" style={{ position: 'absolute', ...style.button }} />
    <Img src={like} alt="Deixe seu like" style={{ position: 'absolute', ...style.like }} />
  </div>;
}
