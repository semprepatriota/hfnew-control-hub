import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectComposition, renderMedia, ensureBrowser } from '@remotion/renderer';
import { normalizeProject, buildTimeline, FPS } from './timeline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
const project = normalizeProject(input.project, input.assets);
const timeline = buildTimeline(project, input.assets);
if (!timeline.count) throw new Error('No scenes');
const allowed = new Map(Object.entries(input.assets).map(([id, asset]) => [`/${id}`, asset.path]));
const server = createServer(async (req, res) => {
  try {
    const file = allowed.get(req.url);
    if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end(); return; }
    const info = await stat(file);
    let start = 0, end = info.size - 1;
    const headers = { 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*',
      'Content-Type': /\.(mp3|wav|m4a|aac)$/.test(file) ? 'audio/' + (file.endsWith('.mp3') ? 'mpeg' : file.split('.').at(-1)) : file.endsWith('.webm') ? 'video/webm' : 'video/mp4' };
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!match || +match[1] >= info.size || (match[2] && +match[2] < +match[1])) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return;
      }
      start = +match[1]; end = match[2] ? Math.min(+match[2], end) : end;
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end-start+1;
    res.writeHead(req.headers.range ? 206 : 200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file, { start, end });
    res.on('close', () => stream.destroy()); stream.on('error', () => res.destroy()); stream.pipe(res);
  } catch { res.destroy(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const assets = Object.fromEntries(Object.entries(input.assets).map(([id, asset]) => [id, { ...asset, src: `${base}/${id}` }]));
  const serveUrl = path.join(here, 'bundle');
  const inputProps = { project, assets };
  const installed = await ensureBrowser({ chromeMode: 'headless-shell', browserExecutable: process.env.RANKING_BROWSER || null });
  if (!installed.path) throw new Error('Render browser unavailable');
  const browserExecutable = installed.path;
  const composition = await selectComposition({ serveUrl, id: project.model === 'classic' ? 'RankingClassic' : 'RankingInterludes', inputProps, browserExecutable });
  if (composition.durationInFrames !== timeline.durationInFrames) throw new Error('Timeline mismatch');
  await renderMedia({ serveUrl, composition, inputProps, outputLocation: input.output, codec: 'h264',
    audioCodec: 'aac', pixelFormat: 'yuv420p', crf: 18, concurrency: 1, offthreadVideoThreads: 1,
    x264Preset: 'fast', enforceAudioTrack: true, sampleRate: 48000, colorSpace: 'bt709',
    browserExecutable, overwrite: false, chromiumOptions: { gl: 'swangle' },
    onProgress: ({ progress }) => { if (Math.round(progress*100)%10 === 0) process.stdout.write(`PROGRESS=${Math.round(progress*100)}\n`); } });
  process.stdout.write(`RANKING_RENDER=OK\nDURATION=${timeline.durationInFrames/FPS}\n`);
} finally { await new Promise(resolve => server.close(resolve)); }
