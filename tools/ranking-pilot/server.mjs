import { createRequire } from 'node:module';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, rename, unlink, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTimeline, normalizeProject, FPS } from '../../src/modules/ranking-pilot/timeline.mjs';

export const ROOT = 'E:/HFNEW-PILOTOS/ranking-multimidia';
export const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const OUTPUT = path.join(DATA, 'renders');
const run = promisify(execFile);
const shared = globalThis[Symbol.for('hfnew.rankingPilot.jobs')] ??= { jobs: new Map(), active: null };
const jobs = shared.jobs;
const here = path.dirname(fileURLToPath(import.meta.url));
const runtime = createRequire(path.join(ROOT, 'runtime/package.json'));
let bundlePromise;

async function jsonFile(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
async function persist(file, value) {
  const partial = file + '.' + randomUUID() + '.partial';
  await writeFile(partial, JSON.stringify(value, null, 2));
  await rename(partial, file);
}
function reply(res, value, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error('Projeto excede o limite do piloto.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function probe(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { timeout: 30000 });
  return JSON.parse(stdout);
}
async function serveMp4(req, res, file, download = false) {
  const info = await stat(file);
  const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (download) headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
  let start = 0, end = info.size - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    if (!match || +match[1] >= info.size || (match[2] && +match[2] < +match[1])) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return;
    }
    start = +match[1]; end = match[2] ? Math.min(+match[2], end) : end;
    headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(req.headers.range ? 206 : 200, headers);
  const stream = createReadStream(file, { start, end });
  res.on('close', () => stream.destroy());
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}
async function bundleOnce() {
  if (!bundlePromise) {
    const { bundle } = runtime('@remotion/bundler');
    bundlePromise = bundle({ entryPoint: path.join(here, 'remotion-entry.jsx'), publicDir: PUBLIC,
      outDir: path.join(DATA, 'bundles', randomUUID()), onProgress: () => {} }).catch(error => { bundlePromise = null; throw error; });
  }
  return bundlePromise;
}
export async function renderProject(project, assets, job = {}) {
  const { selectComposition, renderMedia } = runtime('@remotion/renderer');
  const validated = normalizeProject(project, assets);
  const timeline = buildTimeline(validated, assets);
  if (!timeline.count) throw new Error('Adicione pelo menos uma cena.');
  const used = new Set(timeline.segments.map(segment => segment.clip.assetId));
  if (validated.music) used.add(validated.music.assetId);
  const selectedAssets = Object.fromEntries([...used].map(id => [id, assets[id]]));
  for (const asset of Object.values(selectedAssets)) {
    if (!/^\/media\/[a-zA-Z0-9-]+\.(mp4|mov|webm|mkv|mp3|wav|m4a|aac)$/.test(asset.src)) throw new Error('Origem de mídia inválida.');
    if (!existsSync(path.join(PUBLIC, asset.src.slice(1)))) throw new Error('Mídia local indisponível.');
  }
  await mkdir(OUTPUT, { recursive: true });
  const id = job.id ?? randomUUID();
  const basename = `ranking-${validated.model}-${id}.mp4`;
  const partial = path.join(OUTPUT, basename + '.partial.mp4');
  const final = path.join(OUTPUT, basename);
  const serveUrl = await bundleOnce();
  const inputProps = { project: validated, assets: selectedAssets };
  const browserExecutable = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  if (!browserExecutable) throw new Error('Chrome ou Edge local não encontrado.');
  const composition = await selectComposition({ serveUrl, id: validated.model === 'classic' ? 'RankingClassic' : 'RankingInterludes', inputProps, browserExecutable });
  try {
    await renderMedia({ serveUrl, composition, inputProps, outputLocation: partial,
      codec: 'h264', audioCodec: 'aac', pixelFormat: 'yuv420p', crf: 18,
      concurrency: 2, offthreadVideoThreads: 1, x264Preset: 'fast', browserExecutable, overwrite: false,
      enforceAudioTrack: true, sampleRate: 48000, colorSpace: 'bt709',
      onProgress: ({ progress }) => { job.progress = Math.round(progress * 100); } });
    const metadata = await probe(partial);
    const video = metadata.streams.find(stream => stream.codec_type === 'video');
    const audio = metadata.streams.find(stream => stream.codec_type === 'audio');
    await persist(path.join(OUTPUT, `probe-${id}.json`), metadata);
    if (video?.codec_name !== 'h264' || video.width !== 1080 || video.height !== 1920 || video.pix_fmt !== 'yuv420p') throw new Error(`MP4 incompatível: ${JSON.stringify(video ? { codec: video.codec_name, width: video.width, height: video.height, pixel: video.pix_fmt } : metadata)}`);
    if (audio?.codec_name !== 'aac' || Number(audio.sample_rate) !== 48000) throw new Error('Áudio exportado fora do padrão AAC/48 kHz.');
    if (Math.abs(Number(metadata.format.duration) - timeline.durationInFrames / FPS) > .15) throw new Error('Duração exportada diferente da timeline.');
    await run('ffmpeg', ['-v', 'error', '-i', partial, '-f', 'null', '-'], { timeout: 180000 });
    await rename(partial, final);
    const result = { id, status: 'ready', progress: 100, model: validated.model,
      duration: timeline.durationInFrames / FPS, url: `/pilot-render/${basename}`,
      filename: basename, project: validated, assets: selectedAssets, metadata, createdAt: new Date().toISOString() };
    await persist(path.join(OUTPUT, `${validated.model}.json`), result);
    return result;
  } catch (error) {
    await unlink(partial).catch(() => {});
    throw error;
  }
}

export function rankingPilotApi() {
  let state;
  async function load() {
    if (!state) {
      state = await jsonFile(path.join(DATA, 'presets.json'));
      if (!state) throw new Error('Execute prepare_media.py antes de abrir o piloto.');
      state.assets = { ...state.assets, ...await jsonFile(path.join(DATA, 'uploads.json'), {}) };
    }
    return state;
  }
  return { name: 'ranking-pilot-local-api', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && req.headers.accept?.includes('text/html') && url.pathname !== '/tools/ranking-pilot/index.html') {
        res.writeHead(302, { Location: '/tools/ranking-pilot/index.html' }); res.end(); return;
      }
      if (!url.pathname.startsWith('/api/pilot/') && !url.pathname.startsWith('/pilot-render/')) return next();
      try {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return reply(res, { error: 'Origem não permitida.' }, 403);
        if (url.pathname.startsWith('/pilot-render/')) {
          const name = url.pathname.slice('/pilot-render/'.length);
          if (req.method !== 'GET' || !/^ranking-(classic|interludes)-[a-f0-9-]+\.mp4$/.test(name)) return reply(res, { error: 'Arquivo inválido.' }, 400);
          return await serveMp4(req, res, path.join(OUTPUT, name), url.searchParams.has('download'));
        }
        const current = await load();
        if (url.pathname === '/api/pilot/state' && req.method === 'GET') {
          const renders = (await Promise.all(['classic', 'interludes'].map(model => jsonFile(path.join(OUTPUT, `${model}.json`), null)))).filter(Boolean);
          const projects = {};
          for (const model of ['classic', 'interludes']) {
            const saved = await jsonFile(path.join(DATA, `saved-${model}.json`), null);
            if (saved) projects[model] = normalizeProject(saved, current.assets);
          }
          return reply(res, { ...current, projects, renders, activeJob: shared.active ? jobs.get(shared.active) : null });
        }
        if (url.pathname === '/api/pilot/project' && req.method === 'POST') {
          const project = normalizeProject(await body(req), current.assets);
          await persist(path.join(DATA, `saved-${project.model}.json`), project);
          return reply(res, { saved: true });
        }
        if (url.pathname === '/api/pilot/upload' && req.method === 'POST') {
          const name = String(url.searchParams.get('name') ?? 'media').slice(0, 160);
          const extension = path.extname(name).toLowerCase();
          if (!['.mp4', '.mov', '.webm', '.mkv', '.mp3', '.wav', '.m4a', '.aac'].includes(extension)) throw new Error('Envie um vídeo ou áudio compatível.');
          const id = randomUUID();
          const target = path.join(PUBLIC, 'media', id + extension);
          const partial = target + '.partial';
          let total = 0;
          try {
            await pipeline(req, new Transform({ transform(chunk, encoding, callback) {
              total += chunk.length;
              callback(total > 200 * 1024 ** 2 ? new Error('Limite local de 200 MB por arquivo.') : null, chunk);
            } }), createWriteStream(partial, { flags: 'wx' }));
            if (!total) throw new Error('Arquivo vazio.');
            const metadata = await probe(partial);
            const video = metadata.streams.find(stream => stream.codec_type === 'video');
            const duration = Number(video?.duration ?? metadata.format.duration);
            if (!duration || duration > 180 || (video && (video.width > 4096 || video.height > 4096))) throw new Error('No piloto, use arquivos de até três minutos e resolução de até 4K.');
            await rename(partial, target);
            const asset = { id, src: `/media/${id}${extension}`, name, frames: Math.floor(duration * FPS),
              width: video?.width ?? 0, height: video?.height ?? 0, kind: video ? 'scene' : 'music' };
            if (video) {
              await run('ffmpeg', ['-v', 'error', '-y', '-i', target, '-frames:v', '1', path.join(PUBLIC, 'media', `${id}.jpg`)], { timeout: 30000 });
              asset.poster = `/media/${id}.jpg`;
            }
            current.assets[id] = asset;
            const uploads = await jsonFile(path.join(DATA, 'uploads.json'), {});
            uploads[id] = asset;
            await persist(path.join(DATA, 'uploads.json'), uploads);
            bundlePromise = null;
            return reply(res, asset);
          } catch (error) {
            await unlink(partial).catch(() => {});
            await unlink(target).catch(() => {});
            await unlink(path.join(PUBLIC, 'media', `${id}.jpg`)).catch(() => {});
            throw error;
          }
        }
        if (url.pathname === '/api/pilot/render' && req.method === 'POST') {
          if (shared.active) return reply(res, { error: 'Já existe uma renderização local em andamento.' }, 409);
          const project = normalizeProject(await body(req), current.assets);
          if (!buildTimeline(project, current.assets).count) throw new Error('Adicione pelo menos uma cena.');
          const job = { id: randomUUID(), status: 'rendering', progress: 0 };
          shared.active = job.id; jobs.set(job.id, job);
          renderProject(project, current.assets, job).then(result => Object.assign(job, result))
            .catch(error => { Object.assign(job, { status: 'failed', error: error.message }); console.error('[ranking-pilot]', error.stack); })
            .finally(() => { shared.active = null; });
          return reply(res, { id: job.id, status: job.status }, 202);
        }
        const jobId = /^\/api\/pilot\/jobs\/([a-f0-9-]+)$/.exec(url.pathname)?.[1];
        if (jobId && req.method === 'GET') return reply(res, jobs.get(jobId) ?? { error: 'Renderização não encontrada.' }, jobs.has(jobId) ? 200 : 404);
        return reply(res, { error: 'Rota local não encontrada.' }, 404);
      } catch (error) {
        if (!res.headersSent) reply(res, { error: error.message }, 400); else res.destroy();
      }
    });
  } };
}
