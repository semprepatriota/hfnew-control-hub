import { readFile, writeFile } from 'node:fs/promises';
import { renderProject, ROOT } from './server.mjs';
const state = JSON.parse(await readFile(`${ROOT}/data/presets.json`, 'utf8'));
for (const model of ['classic', 'interludes']) {
  if (process.argv.includes('--quick') && model !== 'classic') continue;
  const project = structuredClone(state.presets[model]);
  if (process.argv.includes('--quick')) { project.items = [project.items[0]]; project.items[0].clips[0].endFrame = 30; project.outro = null; }
  let previous = -1;
  const job = {};
  Object.defineProperty(job, 'progress', { set(value) {
    if (Math.floor(value / 10) !== previous) { previous = Math.floor(value / 10); console.log(`${model}: ${value}%`); }
  } });
  console.log(`RENDER_START=${model}`);
  const result = await renderProject(project, state.assets, job);
  console.log(`RENDER_READY=${model} FILE=${result.filename} DURATION=${result.duration}`);
}
if (!process.argv.includes('--quick')) await writeFile(`${ROOT}/data/render-smoke-ok.txt`, 'BOTH_MODELS_RENDERED=OK\n');
