async (page) => {
  if (!page.url().startsWith('http://127.0.0.1:5184/')) throw Error('Loopback QA only');
  await page.unroute('**/api/top10/media/**');
  await page.route('**/api/auth/status', route => route.fulfill({ json: { authorized: true, role: 'owner', name: 'Local QA' } }));
  await page.route('**/api/workspaces/current', route => route.fulfill({ json: { access: { modules: { top10: true } } } }));
  await page.evaluate(() => localStorage.setItem('alliance_dark_auth_token', 'local-qa-not-a-real-token'));
  await page.reload();
  await page.getByRole('heading', { name: 'TOP 10', exact: true }).waitFor();
  const button = page.getByRole('button', { name: 'Baixar MP4', exact: true });
  await button.waitFor();
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('/media/') && !request.headers().range) {
      requests.push({ method: request.method(), requestId: request.headers()['x-request-id'], url: request.url() });
    }
  });
  for (const mode of ['no-picker', 'blocked-picker']) {
    await page.evaluate(mode => {
      Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: mode === 'no-picker' ? undefined : () => Promise.reject(new DOMException('Not available here', 'SecurityError')) });
    }, mode);
    const pending = page.waitForEvent('download');
    await button.click();
    const download = await pending;
    if (await download.failure()) throw Error('Native download failed');
    if (download.suggestedFilename() !== 'top10_download_test.mp4') throw Error('Wrong download filename');
    await download.saveAs(`E:/HFNEW-TOP10-TOOLS/download-preview/${mode}.mp4`);
    await page.getByText('Download enviado ao navegador.', { exact: false }).waitFor();
    if (page.url() !== 'http://127.0.0.1:5184/top-10') throw Error('Download navigated away from editor');
  }
  await page.evaluate(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: () => {
      window.__pickerOpened = true;
      return navigator.storage.getDirectory().then(root => root.getFileHandle('top10-stream-test.mp4', { create: true }));
    } });
  });
  await button.click();
  await page.getByText('MP4 salvo no computador', { exact: true }).waitFor();
  const streamed = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const file = await (await root.getFileHandle('top10-stream-test.mp4')).getFile();
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return { size: file.size, hash: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join(''), pickerOpened: window.__pickerOpened };
  });
  if (!streamed.pickerOpened || streamed.size < 1000) throw Error('Streaming write did not complete');
  if (requests.some(request => request.requestId)) throw Error('Media used the central JSON client');
  if (!requests.some(request => request.method === 'HEAD') || !requests.some(request => request.method === 'GET')) throw Error('Missing validated HEAD/GET downloads');
  await page.route('**/api/top10/media/**', route => route.fulfill({ status: 404, json: { detail: 'Arquivo nao encontrado - QA' } }));
  await button.click();
  await page.getByText('Falha ao baixar MP4 (HTTP 404). Arquivo nao encontrado - QA', { exact: true }).waitFor();
  if (await button.isDisabled()) throw Error('Download button stayed disabled after failure');
  return { NATIVE_DOWNLOAD: 'OK', BLOCKED_PICKER_FALLBACK: 'OK', STREAM_WRITE: streamed, HTTP_ERROR_VISIBLE: 'OK', EDITOR_PRESERVED: 'OK' };
}
