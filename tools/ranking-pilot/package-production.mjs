import { createRequire } from 'node:module';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repo = process.cwd();
const output = 'E:/HFNEW-PILOTOS/ranking-multimidia/production-package';
const runtime = createRequire('E:/HFNEW-PILOTOS/ranking-multimidia/runtime/package.json');
const { bundle } = runtime('@remotion/bundler');
await mkdir(output, { recursive: true });
await cp(path.join(repo, 'deploy/ranking/backend'), path.join(output, 'backend'), { recursive: true });
await cp(path.join(repo, 'deploy/ranking/renderer'), path.join(output, 'renderer'), { recursive: true });
await cp(path.join(repo, 'src/modules/ranking-pilot/timeline.mjs'), path.join(output, 'renderer/timeline.mjs'));
await mkdir(path.join(output, 'renderer/public/fonts'), { recursive: true });
for (const name of ['montserrat-latin-800-normal.woff2', 'LICENSE-Montserrat.txt']) {
  await cp(`E:/HFNEW-PILOTOS/ranking-multimidia/public/fonts/${name}`, path.join(output, 'renderer/public/fonts', name));
}
await bundle({ entryPoint: path.join(repo, 'tools/ranking-pilot/remotion-entry.jsx'),
  publicDir: path.join(output, 'renderer/public'), outDir: path.join(output, 'renderer/bundle') });
await cp(path.join(repo, 'deploy/ranking/install.py'), path.join(output, 'install.py'));
await cp(path.join(repo, 'deploy/ranking/test_ranking.py'), path.join(output, 'test_ranking.py'));
const { readdir } = await import('node:fs/promises');
async function inventory(directory, prefix = '') {
  const result = {};
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name === '__pycache__' || (!prefix && item.name === 'manifest.json')) continue;
    const relative = prefix + item.name;
    if (item.isDirectory()) Object.assign(result, await inventory(path.join(directory, item.name), relative + '/'));
    else result[relative] = createHash('sha256').update(await readFile(path.join(directory, item.name))).digest('hex');
  }
  return result;
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(await inventory(output), null, 2));
execFileSync('tar', ['--exclude=node_modules', '--exclude=__pycache__', '-czf', 'E:/HFNEW-PILOTOS/ranking-multimidia/ranking-production.tar.gz', '-C', output, '.']);
console.log('RANKING_PACKAGE=OK');
