async (page) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.getByRole('button', { name: 'Logo Falcão Zoeira' }).click();
  await page.getByRole('checkbox', { name: 'Usar logo', exact: true }).waitFor();
  if (!await page.getByRole('checkbox', { name: 'Usar logo', exact: true }).isChecked()) throw new Error('Logo not enabled');
  await page.locator('input[type="file"][accept="video/mp4,video/quicktime,video/webm,video/x-matroska"]').setInputFiles('E:/HFNEW-TOP10-TOOLS/verification/top10-full-smoke.mp4');
  await page.getByRole('button', { name: 'Exportar MP4', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.t10-header')?.textContent.includes('1/10 cenas'));
  await page.getByRole('button', { name: 'Assistir tudo', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.t10-stage video')].some(v => v.videoWidth === 720 && v.currentTime > 1.2 && !v.paused));
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.t10-stage video')].some(v => v.src.includes('asset_') && v.muted && v.videoWidth === 720 && v.readyState >= 2));
  const state = await page.locator('.t10-stage').evaluate(stage => [...stage.querySelectorAll('video')].map(v => ({ src: new URL(v.src).pathname, width: v.videoWidth, ready: v.readyState, muted: v.muted })));
  await page.locator('.t10-stage').scrollIntoViewIfNeeded();
  await page.locator('.t10-stage').screenshot({ path: 'E:/HFNEW-TOP10-TOOLS/animated-logo/preview-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.t10-stage').screenshot({ path: 'E:/HFNEW-TOP10-TOOLS/animated-logo/preview-mobile.png' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error('Mobile overflow');
  await page.getByRole('button', { name: 'Título e logo', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Logo Falcão Zoeira' }).screenshot({ path: 'E:/HFNEW-TOP10-TOOLS/animated-logo/logo-button-mobile.png' });
  console.log(JSON.stringify({ state, mobileOverflow: overflow }));
}
