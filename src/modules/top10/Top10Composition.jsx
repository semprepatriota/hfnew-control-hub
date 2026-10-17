import React from "react";
import {
  Audio,
  Img,
  Sequence,
  Video,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { counterUrl, mediaUrl } from "./api";
import { buildTimeline } from "./timeline.mjs";
import { headlineImage, headlineStyle } from './headline.mjs';

function Fill({ style, children }) {
  return <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", ...style }}>{children}</div>;
}

export default function Top10Composition({ project, config }) {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const items = buildTimeline(project, config);
  const duration = items.length ? items.at(-1).from + items.at(-1).frames : 1;
  const logo = project.assets[project.logo];
  const music = project.assets[project.music];
  return (
    <Fill style={{ backgroundColor: "#000" }}>
      {items.map((item) => (
        <Sequence
          key={`${item.kind}-${item.slot}`}
          from={item.from}
          durationInFrames={item.frames}
          premountFor={fps}
        >
          {item.kind === "counter" ? (
            <Video
              src={counterUrl(config.model, item.rank)}
              volume={config.counter_volume}
              style={{ width: "100%", height: "100%" }}
            />
          ) : item.asset ? (
            <>
              <Fill style={{ overflow: "hidden" }}>
                <Video
                  src={mediaUrl(item.asset.url)}
                  startFrom={Math.round(item.scene.start * fps)}
                  volume={item.scene.volume}
                  style={{
                    position: "absolute",
                    width: `${item.scene.zoom * 100}%`,
                    height: `${item.scene.zoom * 100}%`,
                    left: `${(1 - item.scene.zoom) * item.scene.x * 100}%`,
                    top: `${(1 - item.scene.zoom) * item.scene.y * 100}%`,
                    objectFit: "cover",
                    objectPosition: `${item.scene.x * 100}% ${item.scene.y * 100}%`,
                  }}
                />
              </Fill>
              {headlineImage(project, item.slot, item.scene) && <Img src={mediaUrl(headlineImage(project, item.slot, item.scene).url)} style={headlineStyle(item.scene.headline, true)} />}
              {!(item.scene.headline?.enabled && item.scene.headline.text?.trim()) && config.title_enabled && project.title_image_url && (
                <Img
                  src={mediaUrl(project.title_image_url)}
                  style={{
                    position: "absolute",
                    width: 1080,
                    left: 0,
                    top: Math.round(1920 * config.title_y),
                  }}
                />
              )}
            </>
          ) : (
            <Fill
              style={{
                justifyContent: "center",
                alignItems: "center",
                color: "#a6b5c3",
                fontFamily: "Arial",
                fontSize: 58,
              }}
            >
              Cena {item.rank}
            </Fill>
          )}
        </Sequence>
      ))}
      {logo && config.logo_enabled && (
        <Img
          src={mediaUrl(logo.url)}
          style={{
            position: "absolute",
            width: Math.round(1080 * config.logo_size),
            left: Math.min(
              Math.max(
                0,
                Math.round(
                  config.logo_x * 1080 -
                    Math.round(1080 * config.logo_size) / 2,
                ),
              ),
              1080 - Math.round(1080 * config.logo_size),
            ),
            top: Math.min(
              Math.max(
                0,
                Math.round(
                  config.logo_y * 1920 -
                    Math.round(
                      (1080 * config.logo_size * logo.height) / logo.width,
                    ) /
                      2,
                ),
              ),
              1920 -
                Math.round(
                  (1080 * config.logo_size * logo.height) / logo.width,
                ),
            ),
            opacity: config.logo_opacity,
          }}
        />
      )}
      {music && config.music_volume > 0 && (
        <Audio
          src={mediaUrl(music.url)}
          loop
          volume={() =>
            config.music_volume *
            Math.min(1, Math.max(0, (duration - frame) / (fps * 0.5)))
          }
        />
      )}
    </Fill>
  );
}
