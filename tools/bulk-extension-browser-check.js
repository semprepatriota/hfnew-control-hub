async (page) => {
  if (page.url() !== 'about:blank') throw Error('Use an isolated blank QA session');
  const repo = 'C:/Users/User/Documents/Codex/2026-05-25/chat-estou-criando-um-app-pra/_bulk_direct_media_release';
  const extension = `${repo}/extension/hf-bulk-explorer`;
  const video = 'E:/HFNEW-TOP10-TOOLS/verification/top10-full-smoke.mp4';
  const mediaUrl = 'https://scontent.cdninstagram.com/qa-selected.mp4?signature=preserved';
  const postUrl = 'https://www.instagram.com/reel/QA_SELECTED/';
  const context = await page.context().browser().browserType().launchPersistentContext('E:/HFNEW-EXTENSAO/qa-chrome-profile', {
    executablePath: 'E:/HFNEW-EXTENSAO/qa-browsers/chromium-1247/chrome-win64/chrome.exe',
    headless: true, acceptDownloads: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  let queued = 0;
  let worker, hub;
  const jobs = [];
  const unexpected = [];
  const apiResponses = {
    '/api/status': { status: 'operational' },
    '/api/auth/status': { authorized: true, role: 'owner', name: 'Isolated extension QA' },
    '/api/workspaces/current': { access: { modules: { bulk_download: true } } },
    '/api/bulk-download/health': { status: 'operational', workers: 2, carousel_downloads: false },
    '/api/bulk-download/extension/inbox': { items: [{ url: postUrl, platform: 'instagram', media_type: 'video', title: 'QA Reel com player blob', media_url: '', preview_url: '', thumbnail: '' }] },
  };
  try {
    await context.route(/^https?:\/\//, async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname === 'app.hfnew.com.br') {
        if (url.pathname.startsWith('/assets/')) return route.fulfill({ path: `${repo}/dist${url.pathname}` });
        return route.fulfill({ path: `${repo}/dist/index.html`, contentType: 'text/html' });
      }
      if (url.hostname === 'api.hfnew.com.br') {
        const cors = { 'Access-Control-Allow-Origin': 'https://app.hfnew.com.br', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        if (url.pathname === '/api/bulk-download/jobs' && request.method() === 'POST') {
          const body = request.postDataJSON();
          if (body.items?.length !== 1 || body.items[0].url !== postUrl || body.items[0].media_url !== mediaUrl) throw Error('Wrong selected video reached the queue');
          queued++;
          jobs.push({ id: `qa-${queued}`, filename: 'qa-export.mp4', platform: 'instagram', title: body.items[0].title, status: 'completed', output_format: 'video', media_type: 'video', progress: 100, size_bytes: 4252544 });
          return route.fulfill({ json: { jobs: jobs.slice(-1), total: 1 }, headers: cors });
        }
        if (url.pathname === '/api/bulk-download/jobs') return route.fulfill({ json: { jobs }, headers: cors });
        if (/\/api\/bulk-download\/jobs\/qa-\d+\/file$/.test(url.pathname)) return route.fulfill({ path: video, contentType: 'video/mp4', headers: { ...cors, 'Content-Disposition': 'attachment; filename="qa-export.mp4"' } });
        if (apiResponses[url.pathname]) return route.fulfill({ json: apiResponses[url.pathname], headers: cors });
      }
      if (url.hostname === 'www.instagram.com') {
        const post = url.pathname.startsWith('/reel/');
        const data = JSON.stringify({ items: [
          { code: 'NEIGHBOR', video_url: 'https://scontent.cdninstagram.com/wrong.mp4' },
          { code: 'QA_SELECTED', video_versions: [{ url: mediaUrl, width: 1080, height: 1920 }], video_duration: 14 },
        ] });
        return route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Extension QA</title><nav><a href="/direct/inbox">Inbox</a></nav>${post ? `<link rel="canonical" href="${postUrl}"><main><video src="blob:https://www.instagram.com/unavailable-to-server"></video><script type="application/json">${data}</script></main>` : '<main>Local fixture: public profile</main>'}` });
      }
      if (url.hostname === 'scontent.cdninstagram.com' && url.pathname === '/qa-selected.mp4') return route.fulfill({ path: video, contentType: 'video/mp4', headers: { 'Access-Control-Allow-Origin': '*' } });
      unexpected.push(request.url());
      return route.abort();
    });
    await context.addInitScript(() => {
      if (location.hostname === 'app.hfnew.com.br') {
        localStorage.setItem('alliance_dark_auth_token', 'local-qa-not-real');
        Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
      }
    });
    worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    if (manifest.version !== '1.6.0') throw Error('Wrong extension loaded');
    const instagram = await context.newPage();
    await instagram.goto(postUrl);
    hub = await context.newPage();
    await hub.goto('https://app.hfnew.com.br/baixar-em-massa');
    await hub.getByRole('heading', { name: 'Baixar em Massa', exact: true }).waitFor();
    await hub.getByText('Instagram conectado', { exact: true }).waitFor();
    const save = hub.locator('.bulk-media-card').first().getByRole('button', { name: 'Salvar', exact: true });
    await save.waitFor();
    const pending = hub.waitForEvent('download');
    await save.click();
    const download = await pending;
    if (await download.failure()) throw Error('Browser download failed');
    await download.saveAs('E:/HFNEW-EXTENSAO/qa-export.mp4');
    if (queued !== 1) throw Error('The extension did not create exactly one download job');
    if (hub.url() !== 'https://app.hfnew.com.br/baixar-em-massa') throw Error('Save navigated away from the HUB');
    if (instagram.isClosed()) throw Error('The user-opened Instagram tab was closed');
    const temporaryPages = context.pages().filter(candidate => candidate !== instagram && candidate.url() === postUrl);
    if (temporaryPages.length) throw Error('Temporary Reel tab remained open');
    const state = await worker.evaluate(() => chrome.storage.local.get('hfBulkLastMediaResolve'));
    if (state.hfBulkLastMediaResolve?.status !== 'success') throw Error('Extension did not confirm resolution');
    if (unexpected.length) throw Error(`Unmocked external requests: ${unexpected.join(',')}`);
    return { EXTENSION_LOADED: manifest.version, BLOB_REEL_TO_HUB: 'OK', QUEUED_SELECTED_MP4: 'OK', DOWNLOADED_MP4: 'E:/HFNEW-EXTENSAO/qa-export.mp4', EXISTING_POST_TAB_REUSED: 'OK', USER_TABS_PRESERVED: 'OK', LIVE_ACCOUNT_ACCESS: 'NOT_USED_CONTROLLED_FIXTURES' };
  } catch (error) {
    const storage = worker ? await worker.evaluate(() => chrome.storage.local.get(null)).catch(() => ({})) : {};
    const visible = hub ? await hub.locator('body').innerText().catch(() => '') : '';
    throw Error(JSON.stringify({ error: error.message, queued, storage, visible, unexpected, pages: context.pages().map(tab => tab.url()) }));
  } finally {
    await context.close();
  }
}
