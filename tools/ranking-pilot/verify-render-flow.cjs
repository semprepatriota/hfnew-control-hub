async (page) => {
  const fixture = await (await page.request.get('http://127.0.0.1:4182/api/pilot/state')).json();
  const project = structuredClone(fixture.presets.classic);
  for (const item of project.items) item.clips[0].endFrame = 10;
  await page.evaluate(data => localStorage.setItem('hfnew:ranking-local-pilot:v1:classic', JSON.stringify(data)), project);
  await page.goto('http://127.0.0.1:4182/tools/ranking-pilot/index.html');
  await page.waitForFunction(() => !!window.rankingPilot);
  const response = page.waitForResponse(r => r.url().endsWith('/api/pilot/render') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Renderizar piloto MP4', exact: true }).click();
  const created = await (await response).json();
  if (!created.id) throw new Error('UI render did not create a job');
  await page.waitForFunction(id => document.querySelector('.rp-rendered-stage video')?.src.includes(id), created.id, { timeout: 180000 });
  const rendered = page.locator('.rp-rendered-stage video');
  await rendered.evaluate(video => video.play());
  await page.waitForFunction(() => document.querySelector('.rp-rendered-stage video')?.currentTime > .3);
  await rendered.evaluate(video => video.pause());
  await page.evaluate(() => {
    window.__pilotDownload = {};
    window.showSaveFilePicker = async () => {
      window.__pilotDownload.gesture = navigator.userActivation.isActive;
      return { createWritable: async () => ({
        write: async blob => { window.__pilotDownload.bytes = blob.size;
          const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
          window.__pilotDownload.magic = String.fromCharCode(...header.slice(4, 8)); },
        close: async () => { window.__pilotDownload.closed = true; }, abort: async () => {} }) };
    };
  });
  await page.getByRole('button', { name: 'Baixar MP4', exact: true }).click();
  await page.waitForFunction(() => window.__pilotDownload.closed);
  const download = await page.evaluate(() => window.__pilotDownload);
  if (!download.gesture || download.magic !== 'ftyp' || download.bytes < 1000) throw new Error('Invalid save flow: ' + JSON.stringify(download));
  await page.evaluate(data => localStorage.setItem('hfnew:ranking-local-pilot:v1:classic', JSON.stringify(data)), fixture.presets.classic);
  console.log(JSON.stringify({ renderJob: created.id, playback: 'OK', download }));
}
