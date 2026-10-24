async (page) => {
  const fixture = await (await page.request.get('http://127.0.0.1:4182/api/pilot/state')).json();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const catalog = Object.fromEntries(Object.entries(fixture.assets).map(([id, asset]) => [id, {
    ...asset, src: 'http://127.0.0.1:4182' + asset.src, poster: asset.poster ? 'http://127.0.0.1:4182' + asset.poster : null,
  }]));
  const presets = Object.fromEntries(['classic', 'interludes'].map(model => [model, { ...fixture.presets[model], items: [], music: null, outro: null }]));
  let saved = false, uploaded = false, renders = 0;
  const handler = async route => {
    const path = new URL(route.request().url()).pathname;
    let value = {};
    if (path === '/api/auth/status') value = { authorized: true, role: 'owner', workspace_id: 'ws_ranking_qa', user_id: 'qa-user', name: 'Teste isolado' };
    else if (path === '/api/workspaces/current') value = { access: { modules: { forge_7030: true } } };
    else if (path === '/api/status') value = { status: 'operational' };
    else if (path === '/api/ranking/state') value = { presets, projects: {}, assets: catalog, renders: [], activeJob: null, fontUrl: 'http://127.0.0.1:4182/fonts/montserrat-latin-800-normal.woff2' };
    else if (path === '/api/ranking/upload') {
      if (!route.request().headers()['authorization']) throw new Error('Upload lacks authentication');
      if (!route.request().postDataBuffer()?.length) throw new Error('Empty upload');
      uploaded = true; value = catalog['classic-scene-1'];
    } else if (path === '/api/ranking/project') { saved = true; value = { saved: true }; }
    else if (path === '/api/ranking/render') { renders++; value = { id: 'qa-job', status: 'queued' }; }
    else if (path === '/api/ranking/jobs/qa-job') {
      value = { id: 'qa-job', status: 'ready', model: 'classic', duration: 12, url: 'http://127.0.0.1:4182' + fixture.renders.find(r => r.model === 'classic').url,
        filename: 'qa.mp4', project: await page.evaluate(() => window.rankingPilot.project()) };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value), headers: { 'Access-Control-Allow-Origin': '*' } });
  };
  await page.route('http://127.0.0.1:9000/api/**', handler);
  try {
    await page.goto('http://127.0.0.1:4183/forge');
    await page.evaluate(() => { localStorage.setItem('alliance_dark_auth_token', 'local-qa-not-a-real-session');
      for (const model of ['classic', 'interludes']) localStorage.removeItem(`hfnew:ranking:v1:ws_ranking_qa:${model}`); });
    await page.reload();
    await page.getByRole('heading', { name: 'Ranking Multimídia', exact: true }).waitFor();
    if (await page.getByText('Piloto local', { exact: true }).count()) throw new Error('Production renders the local badge');
    await page.getByRole('link', { name: 'Ranking Multimídia', exact: true }).waitFor();
    // The CLI suspends scripts at native file choosers; supply a real file through the input.
    await page.evaluate(() => document.querySelector('input[type=file]').click = () => {});
    await page.getByRole('button', { name: 'Adicionar cena', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles('E:/HFNEW-PILOTOS/ranking-multimidia/public/media/classic-scene-1.mp4');
    await page.waitForFunction(() => window.rankingPilot?.project().items.length === 1);
    await page.getByRole('button', { name: 'Salvar projeto', exact: true }).click();
    await page.getByText('Projeto salvo neste workspace.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Renderizar MP4', exact: true }).click();
    await page.locator('.rp-rendered-stage video').waitFor();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { document.querySelector('.main-content')?.scrollTo(0, 0); window.scrollTo(0, 0); });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Overflow at ' + width);
      await page.screenshot({ path: `E:/HFNEW-PILOTOS/ranking-multimidia/data/hub-${width}.png`, fullPage: true });
    }
    if (!saved || !uploaded || renders !== 1 || errors.length) throw new Error(JSON.stringify({ saved, uploaded, renders, errors }));
    console.log('HUB_RANKING_UI=OK');
  } finally {
    await page.evaluate(() => localStorage.removeItem('alliance_dark_auth_token'));
    await page.unroute('http://127.0.0.1:9000/api/**', handler);
  }
}
