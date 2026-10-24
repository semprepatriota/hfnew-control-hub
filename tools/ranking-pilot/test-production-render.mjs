import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const base = 'E:/HFNEW-PILOTOS/ranking-multimidia';
const state = JSON.parse(await readFile(`${base}/data/presets.json`, 'utf8'));
for (const model of ['classic', 'interludes']) {
  const project = structuredClone(state.presets[model]);
  project.items = project.items.slice(0, 1);
  project.items[0].clips[0].endFrame = 30;
  project.items[0].interlude = null;
  project.outro = null;
  const id = project.items[0].clips[0].assetId;
  const asset = state.assets[id];
  const output = `${base}/data/production-worker-${model}-${Date.now()}.mp4`;
  const invocation = `${base}/data/production-worker-${model}.json`;
  await writeFile(invocation, JSON.stringify({ project, assets: { [id]: { ...asset, path: `${base}/public${asset.src}` } }, output }));
  execFileSync('node', [`${base}/production-package/renderer/render.mjs`, invocation], {
    cwd: `${base}/production-package/renderer`, timeout: 240000, stdio: 'inherit',
    env: { ...process.env, RANKING_BROWSER: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
  });
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output]));
  const video = info.streams.find(stream => stream.codec_type === 'video');
  const audio = info.streams.find(stream => stream.codec_type === 'audio');
  if (video.codec_name !== 'h264' || video.width !== 1080 || video.height !== 1920 || video.pix_fmt !== 'yuv420p' || audio.codec_name !== 'aac' || audio.sample_rate !== '48000' || Math.abs(+info.format.duration - 1) > .15) throw new Error('Incompatible export');
  execFileSync('ffmpeg', ['-v', 'error', '-i', output, '-f', 'null', '-'], { timeout: 60000 });
  console.log(`PRODUCTION_WORKER_${model.toUpperCase()}=OK\nOUTPUT=${output}`);
}
